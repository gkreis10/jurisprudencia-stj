#!/usr/bin/env python3
"""
Atualiza os dados do site "Jurisprudência STJ" a partir do Portal de Dados
Abertos do STJ (https://dadosabertos.web.stj.jus.br).

Fontes utilizadas (todas oficiais e públicas):
  1. Espelhos de acórdãos (Corte Especial, Seções e Turmas) - publicação mensal.
  2. Precedentes qualificados (temas repetitivos, controvérsias, IAC, SIRDR,
     PUIL) - atualização diária.
  3. Metadados das íntegras publicadas no Diário da Justiça - atualização
     diária (usados no "Radar" de acórdãos recém-publicados).

Uso:
  python scripts/atualizar.py            # atualização incremental
  python scripts/atualizar.py --meses 12 # janela de meses mantida no site

Somente biblioteca padrão do Python 3.9+.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import unicodedata
import datetime as dt
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

API = "https://dadosabertos.web.stj.jus.br/api/3/action/package_show?id="
UA = "jurisprudencia-stj-site/1.0 (+atualizacao automatica de dados abertos)"

ORGAOS = {
    "corte-especial": "Corte Especial",
    "primeira-secao": "Primeira Seção",
    "segunda-secao": "Segunda Seção",
    "terceira-secao": "Terceira Seção",
    "primeira-turma": "Primeira Turma",
    "segunda-turma": "Segunda Turma",
    "terceira-turma": "Terceira Turma",
    "quarta-turma": "Quarta Turma",
    "quinta-turma": "Quinta Turma",
    "sexta-turma": "Sexta Turma",
}
TURMAS = [k for k in ORGAOS if k.endswith("-turma")]

RAIZ = Path(__file__).resolve().parent.parent
SITE_DATA = RAIZ / "site" / "data"
CACHE = RAIZ / ".cache"
HOJE = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).date()


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------
# Rede
# --------------------------------------------------------------------------
def baixar(url: str, tentativas: int = 5, timeout: int = 600) -> bytes:
    ultimo = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            ultimo = e
            espera = 10 * (i + 1)
            log(f"  ! falha ({e}); nova tentativa em {espera}s: {url[-70:]}")
            time.sleep(espera)
    raise RuntimeError(f"Falha ao baixar {url}: {ultimo}")


def pacote(pid: str) -> dict:
    return json.loads(baixar(API + pid, timeout=120))["result"]


def nome_recurso(r: dict) -> str:
    """Nome do arquivo (ex.: 20260831.json); alguns recursos vêm sem nome."""
    nome = (r.get("name") or "").strip()
    if not re.search(r"\d{8}", nome):
        nome = r.get("url", "").rsplit("/", 1)[-1]
    return nome


def data_recurso(r: dict) -> str | None:
    m = re.search(r"(\d{8})", nome_recurso(r))
    return m.group(1) if m else None


# --------------------------------------------------------------------------
# Utilidades de texto
# --------------------------------------------------------------------------
PARAGRAFO = re.compile(
    r"^(\d+(\.\d+)*\s*[.)-]\s|[IVXLC]+\s*[.)–-]\s|[a-z]\)\s|\([a-z0-9]+\)\s|"
    r"(CASO EM EXAME|QUESTÃO EM DISCUSSÃO|RAZÕES DE DECIDIR|DISPOSITIVO|TESE)\b)"
)


def normalizar_ementa(txt: str | None) -> str:
    if not txt:
        return ""
    linhas = [l.strip() for l in txt.replace("\r", "").split("\n")]
    out: list[str] = []
    for l in linhas:
        if not l:
            continue
        # Só abre parágrafo quando a linha anterior encerra uma frase; evita
        # quebrar enumerações internas como "(ii)" que caíram no início da linha.
        novo = bool(PARAGRAFO.match(l)) and (
            not out
            or re.search(r"[.;:!?]\s*$", out[-1])
            or re.fullmatch(r"[IVXLC]+\s*[.)–-]\s*[A-ZÀ-Ü ,]+", out[-1])  # títulos "I. CASO EM EXAME"
        )
        if out and not novo:
            out[-1] += " " + l
        else:
            out.append(l)
    return "\n".join(re.sub(r"\s{2,}", " ", p) for p in out)


def compactar(txt) -> str:
    if not txt:
        return ""
    if isinstance(txt, list):
        txt = "\n".join(str(t) for t in txt)
    return re.sub(r"[ \t]+", " ", str(txt).replace("\r", "")).strip()


def ref_legislativa(itens) -> list[str]:
    if not itens:
        return []
    res = []
    for s in itens:
        s = re.sub(r"\*+", " ", str(s))
        s = re.sub(r"\s+", " ", s).strip()
        s = re.sub(r"\bART:0*(\d+)", r"art. \1", s)
        s = re.sub(r"\bPAR:0*(\d+)", r"§ \1", s)
        s = re.sub(r"\bPAR:UNICO", "par. único", s)
        s = re.sub(r"\bINC:0*(\d+)", r"inc. \1", s)
        s = re.sub(r"\bLET:(\w+)", r"al. \1", s)
        s = re.sub(r"\bLEI:0*(\d+)", r"Lei \1", s)
        s = re.sub(r"\bANO:(\d{4})", r"/\1", s)
        s = re.sub(r"\bLEG:(\w+)\s*", "", s)
        res.append(s)
    return res


def data_br_para_iso(txt: str | None) -> str:
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", txt or "")
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else ""


def data_compacta_para_iso(txt: str | None) -> str:
    m = re.fullmatch(r"(\d{4})(\d{2})(\d{2})", (txt or "").strip())
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""


def gravar_json(caminho: Path, obj) -> int:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    dados = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    tmp = caminho.with_suffix(".tmp")
    tmp.write_text(dados, encoding="utf-8")
    tmp.replace(caminho)
    return len(dados.encode("utf-8"))


def ler_json(caminho: Path, padrao):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return padrao


def mes_menos(ano_mes: str, n: int) -> str:
    a, m = map(int, ano_mes.split("-"))
    total = a * 12 + (m - 1) - n
    return f"{total // 12:04d}-{total % 12 + 1:02d}"



# --------------------------------------------------------------------------
# Enriquecimento: área do direito e relevância
# --------------------------------------------------------------------------
ESQUEMA = 6  # aumente quando mudar o enriquecimento; os arquivos são refeitos sem novo download


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()


# Área do direito: primeiro a rotulação oficial que abre a verbetação
# ("DIREITO TRIBUTÁRIO.", "PROCESSUAL CIVIL E CONSUMIDOR."); depois palavras-chave,
# aceitas somente quando o órgão julgador tem competência para a matéria.
PRIVADO = {"segunda-secao", "terceira-turma", "quarta-turma"}
PUBLICO = {"primeira-secao", "primeira-turma", "segunda-turma"}
PENAIS = {"terceira-secao", "quinta-turma", "sexta-turma"}
TODOS = PRIVADO | PUBLICO | PENAIS | {"corte-especial"}

ROTULOS = [
    ("proc-penal", r"processual penal|processo penal"),
    ("penal", r"(?<!processual )(?<!processo )\bpenal\b|execucao penal"),
    ("proc-civil", r"processual civil|processo civil|direito processual\b(?! penal)"),
    ("civil", r"(?<!processual )(?<!processo )\bcivil\b|direito privado"),
    ("familia", r"(?<!bem de )\bfamilia\b|sucessoes|sucessorio"),
    ("consumidor", r"consumidor"),
    ("empresarial", r"empresarial|comercial|falimentar|societario|recuperacao judicial"),
    ("bancario", r"bancario"),
    ("tributario", r"tributario|\bfiscal\b"),
    ("administrativo", r"administrativo|adminstrativo"),
    ("previdenciario", r"previdenciario"),
    ("ambiental", r"ambiental"),
    ("trabalho", r"trabalho|trabalhista"),
]
ROTULOS_RE = [(k, re.compile(v)) for k, v in ROTULOS]
PALAVRAS_ROTULO = set("""direito direitos e do da de dos das o a processual processo penal civil privado publico
familia sucessoes sucessorio consumidor empresarial comercial falimentar societario recuperacao judicial bancario
tributario fiscal execucao administrativo previdenciario ambiental trabalho trabalhista constitucional internacional
eleitoral registral notarial urbanistico economico securitario imobiliario agrario desportivo militar sancionador
financeiro minerario ementa adminstrativo""".split())

TEMAS_CHAVE = [
    ("familia", PRIVADO, r"(?<!bem de )\bfamilia\b|alimentos (gravidicos|provisorios|definitivos|avoengos)|pensao alimenticia|acao de alimentos|execucao de alimentos|obrigacao alimentar|\bguarda (compartilhada|unilateral|de (menor|filho|crianca))|divorcio|uniao estavel|paternidade|maternidade|inventario|partilha|heranca|herdeir|testament|sucessao (hereditaria|causa mortis|testamentaria)|regime de bens|adocao|alienacao parental|poder familiar|curatela|interdicao"),
    ("consumidor", PRIVADO, r"consumidor|\bcdc\b|plano de saude|operadora de (plano de )?saude|relacao de consumo"),
    ("bancario", PRIVADO, r"bancari|instituicao financeira|cedula de credito|alienacao fiduciaria|cartao de credito|juros remuneratorios|capitalizacao de juros|superendividamento|contrato de mutuo|emprestimo consignado"),
    ("empresarial", PRIVADO, r"recuperacao judicial|falencia|societari|sociedade (anonima|limitada|empresaria)|dissolucao (parcial )?de sociedade|propriedade industrial|\bmarcas?\b|patente|titulo de credito|duplicata|nota promissoria"),
    ("civil", PRIVADO, r"responsabilidade civil|\bcontrat|dano moral|danos morais|usucapiao|\bposse\b|condominio|locacao|direito de propriedade|\bseguro\b|compra e venda|direito autoral"),
    ("tributario", PUBLICO, r"\bicms\b|\bpis\b|cofins|imposto|\biss\b|\bipi\b|\biptu\b|execucao fiscal|credito tributario|contribuicao (previdenciaria|social)|\btributo"),
    ("administrativo", PUBLICO, r"servidor publico|servidores publicos|improbidade|licitacao|concurso publico|desapropriacao|responsabilidade civil do estado|ato administrativo|agencia reguladora|processo administrativo disciplinar"),
    ("previdenciario", PUBLICO, r"aposentadoria|beneficio previdenciario|\binss\b|auxilio-doenca|pensao por morte|\brgps\b"),
    ("ambiental", TODOS, r"meio ambiente|dano ambiental|ambiental"),
    ("penal", PENAIS, r"trafico de drogas|dosimetria|execucao penal|\bcrimes?\b|\bpena\b|furto|roubo|estelionato|homicidio|estupro"),
    ("proc-penal", PENAIS, r"habeas corpus|prisao preventiva|prisao em flagrante|\bjuri\b|nulidade|busca (pessoal|domiciliar)|denuncia|acao penal|revisao criminal|competencia"),
    ("proc-civil", PRIVADO | PUBLICO, r"cumprimento de sentenca|honorarios advocaticios|acao rescisoria|tutela provisoria|agravo de instrumento|embargos a execucao|embargos de terceiro"),
]
TEMAS_CHAVE_RE = [(k, orgs, re.compile(v)) for k, orgs, v in TEMAS_CHAVE]


def _segmento_rotulo(seg: str) -> bool:
    palavras = re.findall(r"[a-z]+", seg)
    return bool(palavras) and all(w in PALAVRAS_ROTULO for w in palavras) and any(w not in {"direito", "e", "do", "da", "de", "dos", "das", "o", "a", "ementa"} for w in palavras)


def areas_do_direito(em: str, orgao: str) -> list[str]:
    cab = sem_acento((em or "").split("\n", 1)[0][:700])
    res: list[str] = []
    for seg in re.split(r"[.;]\s+", cab)[:6]:
        if _segmento_rotulo(seg):
            for k, rx in ROTULOS_RE:
                if rx.search(seg) and k not in res:
                    res.append(k)
    comp = orgao if orgao in TODOS else ""
    for k, orgs, rx in TEMAS_CHAVE_RE:
        if k in res or orgao == "corte-especial":  # na Corte Especial vale só a rotulação oficial
            continue
        if comp not in orgs:
            continue
        if rx.search(cab):
            res.append(k)
    if not res and orgao in PENAIS:
        res.append("penal")
    # Uma matéria só entra se o órgão julga aquele ramo (evita "família" na 1ª Seção).
    if orgao in PUBLICO:
        res = [a for a in res if a not in {"familia", "consumidor", "bancario", "empresarial", "penal", "proc-penal"} or a in _rotulos_explicitos(cab)]
    elif orgao in PRIVADO:
        res = [a for a in res if a not in {"tributario", "previdenciario", "penal", "proc-penal"} or a in _rotulos_explicitos(cab)]
    elif orgao in PENAIS:
        res = [a for a in res if a in {"penal", "proc-penal", "ambiental"} or a in _rotulos_explicitos(cab)]
    return res[:4]


def _rotulos_explicitos(cab: str) -> set[str]:
    out = set()
    for seg in re.split(r"[.;]\s+", cab)[:6]:
        if _segmento_rotulo(seg):
            out |= {k for k, rx in ROTULOS_RE if rx.search(seg)}
    return out


ORG_TEMA_GRUPO = {"Primeira Seção": PUBLICO, "Segunda Seção": PRIVADO, "Terceira Seção": PENAIS, "Corte Especial": TODOS}
RAMOS_TEMA = [
    ("proc-civil", r"processual civil"), ("administrativo", r"administrativo"),
    ("tributario", r"tributario|^pis$|pasep|^simples$|^sesc$|^senac$"), ("civil", r"direito civil"),
    ("previdenciario", r"previdenci"), ("proc-penal", r"processual penal"), ("penal", r"(?<!processual )\bpenal"), ("consumidor", r"consumidor"), ("ambiental", r"ambiental"),
]


def areas_do_tema(t: dict) -> list[str]:
    ass = t.get("ass", "")
    tops = [re.sub(r"^\d+-\s*", "", x).strip() for x in ass.split(",")]
    res = []
    for top in tops:
        if top and top.upper() == top and re.search(r"[A-Z]", top):
            tn = sem_acento(top)
            for k, rx in RAMOS_TEMA:
                if re.search(rx, tn) and k not in res:
                    res.append(k)
    grupo = ORG_TEMA_GRUPO.get(t.get("org", ""), TODOS)
    texto = sem_acento(f"{ass} {t.get('q', '')}")
    for k, orgs, rx in TEMAS_CHAVE_RE:
        if k not in res and (grupo is TODOS or grupo & orgs) and rx.search(texto):
            res.append(k)
    return res[:4]


# Submatérias: cada matéria geral tem subtemas. Só entram quando a matéria-mãe
# foi identificada. A classificação usa a verbetação (sem o nome da classe
# processual) ou, nos temas, os assuntos e a questão submetida.
SUBAREAS = {
    "civil": [
        ("resp-civil", "Responsabilidade civil", r"responsabilidade civil|dano moral|danos morais|danos? materia|indenizacao por danos?|dever de indenizar|ato ilicito|lucros cessantes|dano estetico|perda de uma chance"),
        ("contratos", "Contratos", r"\bcontrat|compra e venda|locacao|fianca|comodato|prestacao de servicos?|empreitada|doacao|distrato"),
        ("seguros", "Seguros", r"\bseguros?\b|securitari|dpvat|seguradora"),
        ("posse-prop", "Posse, propriedade e condomínio", r"usucapiao|\bposse\b|possessori|reivindicat|propriedade|condominio|registro de imoveis|incorporacao imobiliaria|direito real|servidao|hipoteca|multipropriedade"),
        ("obrigacoes", "Obrigações e prescrição", r"prescricao|decadencia|obrigac|juros de mora|correcao monetaria|pagamento indevido|enriquecimento sem causa"),
        ("personalidade", "Direitos da personalidade e autorais", r"direitos? autora|\becad\b|direito de imagem|direitos da personalidade|nome civil|honra|liberdade de imprensa|esquecimento"),
    ],
    "familia": [
        ("alimentos", "Alimentos", r"alimentos|alimentar|pensao alimenticia|prisao civil"),
        ("uniao-divorcio", "Casamento, união estável e divórcio", r"divorcio|uniao estavel|casamento|regime de bens|partilha de bens|separacao"),
        ("sucessoes", "Sucessões", r"sucess|heranca|herdeir|inventario|testament|arrolamento|legitima"),
        ("filiacao", "Filiação, guarda e adoção", r"paternidade|maternidade|filiacao|\bguarda\b|adocao|alienacao parental|poder familiar|convivencia|visitas|socioafetiv"),
        ("infancia", "Criança e adolescente", r"crianca e do adolescente|\beca\b|medida socioeducativa|ato infracional|menor de idade"),
        ("curatela", "Curatela e interdição", r"curatela|interdicao|tomada de decisao apoiada"),
    ],
    "consumidor": [
        ("planos-saude", "Planos de saúde", r"planos? de saude|operadora|\bans\b|rol de procedimentos|cobertura"),
        ("cadastros", "Cadastros e negativação", r"cadastro|inadimplentes|negativac|inscricao indevida|\bspc\b|serasa|protesto|credit scoring"),
        ("fornecedor", "Responsabilidade do fornecedor", r"fato do produto|vicio do produto|fato do servico|vicio do servico|responsabilidade (civil )?(objetiva|do fornecedor)|defeito|recall"),
        ("servicos", "Serviços e transporte", r"energia eletrica|telefonia|agua e esgoto|servicos? essencia|transporte aereo|companhia aerea|\bvoo\b|bagagem|internet"),
        ("imoveis-cons", "Imóveis e consórcios", r"compra e venda de imovel|incorporadora|construtora|atraso na entrega|consorcio|cooperativa habitacional"),
        ("praticas", "Práticas e cláusulas abusivas", r"abusiv|publicidade|venda casada|oferta|arrependimento|superendividamento"),
    ],
    "bancario": [
        ("contratos-banc", "Contratos e juros bancários", r"contratos? bancari|juros|capitalizacao|tarifa|cedula de credito|mutuo|emprestimo|consignado|prestacao de contas"),
        ("fiduciaria", "Alienação fiduciária", r"alienacao fiduciaria|busca e apreensao|garantia fiduciaria"),
        ("cartao", "Cartão de crédito", r"cartao de credito|rotativo"),
        ("sfh", "Sistema Financeiro da Habitação", r"sistema financeiro da habitacao|\bsfh\b|\bfcvs\b"),
        ("fraudes", "Fraudes e segurança bancária", r"fraude|golpe|\bpix\b|seguranca bancaria|fortuito interno|saque indevido"),
    ],
    "empresarial": [
        ("recuperacao", "Recuperação judicial e falência", r"recuperacao (judicial|extrajudicial)|falenc|concordata|administrador judicial|plano de recuperacao"),
        ("societario", "Direito societário", r"societari|sociedade|socios?\b|dissolucao|desconsideracao da personalidade|quotas|acionista|apuracao de haveres"),
        ("titulos", "Títulos de crédito", r"titulos? de credito|duplicata|nota promissoria|cheque|letra de cambio|endosso|\baval\b"),
        ("propriedade-ind", "Propriedade industrial", r"\bmarcas?\b|patente|propriedade industrial|\binpi\b|concorrencia desleal|trade dress|nome empresarial"),
        ("contratos-emp", "Contratos empresariais", r"arrendamento mercantil|leasing|franquia|representacao comercial|distribuicao|factoring"),
    ],
    "proc-civil": [
        ("recursos", "Recursos", r"embargos de divergencia|embargos de declaracao|agravo de instrumento|apelacao|recurso especial repetitivo|admissibilidade|preparo|tempestividade|sustentacao oral"),
        ("execucao", "Execução e cumprimento de sentença", r"execucao|cumprimento de sentenca|penhora|impenhorab|bem de familia|fraude (a|contra) execucao|astreintes|prescricao intercorrente|expropria|liquidacao"),
        ("competencia", "Competência", r"competencia|conflito de competencia|\bforo\b|conexao|prevencao"),
        ("honorarios", "Honorários, custas e gratuidade", r"honorarios|sucumbencia|custas|gratuidade|justica gratuita|assistencia judiciaria"),
        ("tutela", "Tutelas provisórias", r"tutela (provisoria|de urgencia|antecipada|cautelar|de evidencia)|liminar|medida cautelar"),
        ("coletivo", "Processo coletivo", r"acao civil publica|acao coletiva|direitos (difusos|coletivos|individuais homogeneos)|ministerio publico"),
        ("coisa-julgada", "Ação rescisória e coisa julgada", r"acao rescisoria|coisa julgada|querela nullitatis|preclusao"),
        ("provas-pc", "Provas, citação e nulidades", r"\bprovas?\b|pericia|cerceamento de defesa|nulidade|citacao|intimacao"),
        ("ms", "Mandado de segurança e ações especiais", r"mandado de seguranca|habeas data|acao monitoria|embargos de terceiro|possessoria|arbitragem"),
    ],
    "tributario": [
        ("icms", "ICMS", r"\bicms\b|difal"),
        ("ir", "Imposto de renda", r"imposto (sobre a )?renda|\birpf\b|\birpj\b|\bcsll\b"),
        ("pis-cofins", "PIS e Cofins", r"\bpis\b|cofins|pasep"),
        ("contrib-prev", "Contribuições previdenciárias", r"contribuic\w* previdenciari|cota patronal|\brat\b|\bsat\b|terceiros|salario-educacao|\bincra\b|\bsesc\b|\bsenai\b|seguridade social"),
        ("municipais", "ISS, IPTU e ITBI", r"\biss\b|issqn|\biptu\b|\bitbi\b"),
        ("ipi-aduana", "IPI e comércio exterior", r"\bipi\b|importacao|exportacao|drawback|aduaneir|reintegra"),
        ("exec-fiscal", "Execução fiscal", r"execucao fiscal|redirecionamento|dissolucao irregular|certidao de divida ativa|\bcda\b|embargos a execucao fiscal"),
        ("credito-trib", "Crédito, prescrição e compensação", r"credito tributario|prescricao|decadencia|compensacao|repeticao de indebito|restituicao|denuncia espontanea|parcelamento|refis|lancamento|responsabilidade tributaria"),
        ("outros-trib", "IPVA, ITCMD, IOF e taxas", r"\bipva\b|\bitcmd\b|\biof\b|\btaxas?\b|imunidade|isencao"),
    ],
    "administrativo": [
        ("servidores", "Servidores públicos", r"servidor|servidores|concurso publico|cargo publico|militar|remuneracao|vencimentos|processo administrativo disciplinar|\bpad\b"),
        ("improbidade", "Improbidade administrativa", r"improbidade"),
        ("licitacoes", "Licitações e contratos", r"licitac|contratos? administrativ|concessao|permissao de servico|parceria publico"),
        ("desapropriacao", "Desapropriação e bens públicos", r"desapropria|bens? publico|terreno de marinha|faixa de dominio|servidao administrativa|tombamento"),
        ("resp-estado", "Responsabilidade do Estado", r"responsabilidade (civil|objetiva) do estado|responsabilidade civil do ente|ente publico"),
        ("regulacao", "Regulação, trânsito e conselhos", r"agencia reguladora|anatel|aneel|anvisa|telefonia|energia|saneamento|agua e esgoto|transito|conselhos? (profissiona|de fiscalizacao)|farmac|\bfgts\b"),
        ("saude-pub", "Saúde pública e medicamentos", r"medicamento|\bsus\b|tratamento medico|internacao"),
    ],
    "previdenciario": [
        ("beneficios", "Aposentadorias e benefícios", r"aposentadoria|auxilio|beneficio|pensao por morte|salario-maternidade|\bbpc\b|\bloas\b|amparo assistencial"),
        ("rural", "Trabalhador rural", r"rural|segurado especial|boia-fria"),
        ("privada", "Previdência privada", r"previdencia (privada|complementar)|entidade (fechada|aberta)"),
        ("acidentaria", "Acidente de trabalho", r"acidente (do|de) trabalho|acidentari|auxilio-acidente"),
        ("custeio", "Custeio e revisão", r"salario de contribuicao|salario de beneficio|debito previdenciario|revisao|decadencia"),
    ],
    "ambiental": [
        ("dano-amb", "Dano ambiental", r"dano ambiental|reparacao|recuperacao ambiental|poluicao"),
        ("areas-prot", "Áreas protegidas", r"preservacao permanente|\bapp\b|reserva legal|codigo florestal|unidade de conservacao"),
        ("sancoes-amb", "Infrações e licenciamento", r"multa|infracao|auto de infracao|licenciamento"),
    ],
    "penal": [
        ("dosimetria", "Dosimetria e regime", r"dosimetria|pena-base|aplicacao da pena|agravante|atenuante|reincidencia|maus antecedentes|regime (inicial|prisional|semiaberto|fechado)|substituicao da pena|minorante|majorante|continuidade delitiva"),
        ("drogas", "Drogas", r"trafico|drogas|entorpecente|11\.343"),
        ("patrimonio", "Crimes patrimoniais", r"furto|roubo|estelionato|receptacao|extorsao|latrocinio|apropriacao indebita|dano qualificado"),
        ("pessoa", "Crimes contra a pessoa", r"homicidio|lesao corporal|feminicidio|violencia domestica|maria da penha|ameaca|injuria|calunia|difamacao"),
        ("sexuais", "Crimes sexuais", r"estupro|dignidade sexual|vulneravel|pornografia|importunacao"),
        ("exec-penal", "Execução penal", r"execucao penal|progressao|livramento condicional|remicao|falta grave|indulto|comutacao|detracao|saida temporaria"),
        ("armas-transito", "Armas e trânsito", r"arma de fogo|municao|10\.826|desarmamento|crimes? de transito|embriaguez ao volante"),
        ("economicos", "Crimes econômicos e contra a administração", r"lavagem|sonegacao|crimes? (tributari|contra a ordem tributaria)|peculato|corrupcao|concussao|licitac|organizacao criminosa|8\.137|apropriacao indebita tributaria|descaminho|contrabando"),
        ("punibilidade", "Prescrição, insignificância e punibilidade", r"prescricao|extincao da punibilidade|insignificancia|bagatela|crime impossivel"),
    ],
    "proc-penal": [
        ("prisoes", "Prisões e cautelares", r"prisao preventiva|prisao em flagrante|prisao domiciliar|medidas? cautelar|custodia cautelar|excesso de prazo|audiencia de custodia|liberdade provisoria|\bfianca\b|monitoramento eletronico"),
        ("provas-pp", "Provas e nulidades", r"\bprovas?\b|nulidade|busca (pessoal|domiciliar|veicular)|ingresso (em|no) domicilio|fundada suspeita|interceptacao|reconhecimento (pessoal|fotografico|de pessoas)|cadeia de custodia|confissao|ilicit"),
        ("competencia-pp", "Competência", r"competencia|conflito de competencia|justica (federal|estadual|militar|eleitoral)"),
        ("juri", "Tribunal do Júri", r"\bjuri\b|pronuncia|quesit|conselho de sentenca"),
        ("recursos-pp", "Recursos, revisão e habeas corpus", r"revisao criminal|recurso em sentido estrito|apelacao criminal|embargos infringentes|habeas corpus (coletivo|preventivo)"),
        ("acao-penal", "Ação penal e acordos", r"denuncia|queixa|acao penal|\banpp\b|acordo de nao persecucao|transacao penal|suspensao condicional do processo|colaboracao premiada|delacao|representacao"),
    ],
    "trabalho": [],
}
SUBAREAS_RE = {a: [(k, re.compile(rx)) for k, _, rx in lst] for a, lst in SUBAREAS.items()}
RE_CLASSE_SEG = re.compile(r"^(agravo|agravos|recurso|recursos|embargos|habeas corpus|mandado de seguranca|conflito|peticao|reclamacao|acao rescisoria|proposta de afetacao|questao de ordem|pedido|incidente|tutela provisoria|medida cautelar)\b[^.]{0,110}$")


def _texto_sub(em: str) -> str:
    cab = sem_acento((em or "").split("\n", 1)[0][:900])
    segs = re.split(r"[.;]\s+", cab)
    fora = [s for i, s in enumerate(segs) if not (_segmento_rotulo(s) or (i < 4 and RE_CLASSE_SEG.match(s.strip())))]
    return ". ".join(fora)[:700]


def subareas(texto_norm: str, areas: list[str], limite: int = 3) -> list[str]:
    out: list[str] = []
    for a in areas or []:
        for k, rx in SUBAREAS_RE.get(a, []):
            if rx.search(texto_norm):
                out.append(f"{a}/{k}")
                if len([x for x in out if x.startswith(a + "/")]) >= 2:
                    break
    return out[:limite]


RE_TESE = re.compile(r"teses? de julgamento\s*:?\s*", re.I)
RE_FIM_TESE = re.compile(r"\n?\s*(dispositivos? (legais? )?relevantes?|legisla[cç][aã]o relevante|jurisprud[eê]ncia relevante|jurisprud[eê]ncia citada)", re.I)


def extrair_tese(em: str) -> str:
    if not em:
        return ""
    m = RE_TESE.search(em)
    if not m:
        d = re.search(r"dispositivo e tese", em, re.I)
        m = re.search(r"\btese\s*:\s*", em[d.end():], re.I) if d else None
        if not m:
            return ""
        ini = d.end() + m.end()
    else:
        ini = m.end()
    txt = em[ini:ini + 2500]
    f = RE_FIM_TESE.search(txt)
    if f:
        txt = txt[: f.start()]
    return txt.strip(" \n:;\"“”'")[:1500]


SINAIS = [
    ("mudanca", 4, r"superacao (?:do|de|da|dos|das) (?:entendimento|precedente|jurisprudencia|tese|orientacao)|overruling|mudanca de (entendimento|orientacao|jurisprudencia)|alteracao (do|de) entendimento|revisao (da|de) (tese|jurisprudencia|entendimento)|nova orientacao|evolucao jurisprudencial"),
    ("inedito", 4, r"questao (nova|inedita)|primeira vez|tema inedito|nao ha precedentes"),
    ("repetitivo", 3, r"recursos? especia(l|is) repetitiv|rito dos (recursos )?repetitivos|tema repetitivo|representativo d[ae] controversia|precedente qualificado|incidente de assuncao de competencia"),
    ("modulacao", 3, r"modulacao"),
    ("distincao", 3, r"distinguishing|\bdistincao\b"),
    ("divergencia", 2, r"embargos de divergencia|dissidio jurisprudencial|divergencia (entre|jurisprudencial)"),
]
SINAIS_RE = [(k, p, re.compile(v)) for k, p, v in SINAIS]
ROTINA = [
    (re.compile(r"sumula (n\.? ?)?7(/stj|\b)"), 2),
    (re.compile(r"sumula (n\.? ?)?(284|283|282|356)(/stf|\b)"), 1),
    (re.compile(r"sumula (n\.? ?)?(83|211|182|115|126|5)(/stj|\b)"), 1),
    (re.compile(r"embargos de declaracao rejeitados|embargos rejeitados|ausencia de omissao|inexistencia de (omissao|vicio)"), 2),
    (re.compile(r"agravo (interno|regimental) (nao provido|desprovido|improvido)|agravo (interno|regimental) a que se nega"), 1),
    (re.compile(r"reexame (de|do conjunto) (fatos|provas|fatico)|revolvimento"), 1),
    (re.compile(r"intempestiv|deficiencia (na|de) fundamentacao|nao impugnacao (especifica )?dos fundamentos"), 1),
]


def pontuar(r: dict) -> tuple[int, list[str]]:
    """Relevância heurística (quanto maior, mais importante) e os motivos."""
    s, rz = 0, []
    o, cl, em = r.get("o", ""), r.get("cl", ""), sem_acento(r.get("em", ""))
    if o == "corte-especial":
        s += 5; rz.append("ce")
    elif o.endswith("-secao"):
        s += 4; rz.append("secao")
    if cl.startswith("ProAfR"):
        s += 6; rz.append("afetacao")
    if re.match(r"^(EREsp|EAREsp|EDv)", cl):
        s += 4; rz.append("eresp")
    if re.match(r"^(IAC|IRDR|IUJ|PUIL)", cl):
        s += 4; rz.append("iac")
    if cl in ("REsp", "RMS", "CC", "MS", "HC", "RHC", "AR", "Rcl"):
        s += 1
    if re.match(r"^(AgInt|AgRg|EDcl)", cl):
        s -= 1
    if r.get("tese"):
        s += 6; rz.append("tese")
    if r.get("tema"):
        s += 3
        if "repetitivo" not in rz:
            rz.append("repetitivo")
    for k, p, rx in SINAIS_RE:
        if rx.search(em):
            s += p
            if k not in rz:
                rz.append(k)
    s -= min(sum(p for rx, p in ROTINA if rx.search(em)), 4)
    if re.search(r"recurso especial (parcialmente )?provido|recurso provido|ordem concedida", em[-400:]):
        s += 1
    return s, rz


def enriquecer(r: dict) -> dict:
    r["ar"] = areas_do_direito(r.get("em", ""), r.get("o", ""))
    r["sa"] = subareas(_texto_sub(r.get("em", "")), r["ar"])
    if not r["sa"]:
        r.pop("sa")
    r["tj"] = extrair_tese(r.get("em", ""))
    if not r["tj"]:
        r.pop("tj")
    r["s"], r["rz"] = pontuar(r)
    if not r["ar"]:
        r.pop("ar")
    if not r["rz"]:
        r.pop("rz")
    return r


def migrar_esquema(estado: dict) -> None:
    if estado.get("_esquema") == ESQUEMA:
        return
    base = SITE_DATA / "acordaos"
    n = 0
    for arq in sorted(base.glob("*/*.json")) if base.exists() else []:
        lista = [enriquecer(x) for x in ler_json(arq, [])]
        gravar_json(arq, lista)
        n += len(lista)
    estado["_esquema"] = ESQUEMA
    log(f"Esquema {ESQUEMA}: {n} acórdãos reprocessados.")

# --------------------------------------------------------------------------
# 1. Espelhos de acórdãos
# --------------------------------------------------------------------------
def transformar_espelho(r: dict, slug: str) -> dict:
    dj = data_br_para_iso(r.get("dataPublicacao"))
    reg = str(r.get("numeroRegistro") or "")
    return {
        "id": r.get("id"),
        "cl": (r.get("siglaClasse") or "").strip(),
        "n": str(r.get("numeroProcesso") or "").strip(),
        "reg": reg,
        "o": slug,
        "rel": (r.get("ministroRelator") or "").strip(),
        "dj": dj,
        "djt": compactar(r.get("dataPublicacao")),
        "dd": data_compacta_para_iso(r.get("dataDecisao")),
        "em": normalizar_ementa(r.get("ementa")),
        "tese": compactar(r.get("teseJuridica")),
        "tema": compactar(r.get("tema")),
        "notas": compactar(r.get("notas")),
        "info": compactar(r.get("informacoesComplementares")),
        "leg": ref_legislativa(r.get("referenciasLegislativas")),
        "tipo": (r.get("tipoDeDecisao") or "").strip(),
    }


def limpar_vazios(d: dict) -> dict:
    return {k: v for k, v in d.items() if v not in ("", None, [], {})}


def atualizar_espelhos(meses: int, estado: dict) -> dict:
    """Baixa os arquivos mensais novos ou alterados e distribui os acórdãos em
    site/data/acordaos/AAAA-MM/<orgao>.json, pelo mês de publicação."""
    base = SITE_DATA / "acordaos"
    corte_download = mes_menos(f"{HOJE.year:04d}-{HOJE.month:02d}", meses + 1)
    pendentes = []
    ultimos = {}
    for slug in ORGAOS:
        pac = pacote(f"espelhos-de-acordaos-{slug}")
        for r in pac["resources"]:
            d = data_recurso(r)
            if not d or not nome_recurso(r).endswith(".json"):
                continue
            ultimos[slug] = max(ultimos.get(slug, ""), d)
            if f"{d[:4]}-{d[4:6]}" < corte_download:
                continue
            chave = r["id"]
            versao = r.get("last_modified") or r.get("metadata_modified") or r.get("created")
            if estado.get(chave) == versao:
                continue
            pendentes.append((slug, r, versao))
    log(f"Espelhos: {len(pendentes)} arquivo(s) novo(s) ou alterado(s).")

    def processar(item):
        slug, r, versao = item
        bruto = baixar(r["url"])
        return slug, r, versao, json.loads(bruto.decode("utf-8"))

    # Agrupa em memória por (mês, órgão) e grava ao final de cada arquivo.
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = [ex.submit(processar, p) for p in pendentes]
        for f in as_completed(futs):
            slug, r, versao, registros = f.result()
            por_mes: dict[str, dict] = {}
            for reg in registros:
                t = enriquecer(limpar_vazios(transformar_espelho(reg, slug)))
                if not t.get("id"):
                    continue
                mes = (t.get("dj") or t.get("dd") or "")[:7]
                if not re.fullmatch(r"\d{4}-\d{2}", mes):
                    continue
                por_mes.setdefault(mes, {})[str(t["id"])] = t
            for mes, novos in por_mes.items():
                arq = base / mes / f"{slug}.json"
                atuais = {str(x["id"]): x for x in ler_json(arq, [])}
                atuais.update(novos)
                lista = sorted(atuais.values(), key=lambda x: (x.get("dj", ""), x.get("id", 0)), reverse=True)
                gravar_json(arq, lista)
            estado[r["id"]] = versao
            log(f"  + {ORGAOS[slug]} {nome_recurso(r)}: {len(registros)} acórdãos")
    return ultimos


def podar_meses(meses: int) -> list[str]:
    base = SITE_DATA / "acordaos"
    if not base.exists():
        return []
    todos = sorted(p.name for p in base.iterdir() if p.is_dir() and re.fullmatch(r"\d{4}-\d{2}", p.name))
    if not todos:
        return []
    corte = mes_menos(todos[-1], meses - 1)
    for m in todos:
        if m < corte:
            for f in (base / m).glob("*"):
                f.unlink()
            (base / m).rmdir()
            log(f"  - mês {m} removido (fora da janela)")
    return [m for m in todos if m >= corte]


# --------------------------------------------------------------------------
# 2. Precedentes qualificados
# --------------------------------------------------------------------------
ORG_TEMA = {"S1": "Primeira Seção", "S2": "Segunda Seção", "S3": "Terceira Seção", "CE": "Corte Especial"}


def atualizar_temas() -> dict:
    pac = pacote("precedentes-qualificados")
    url = next(r["url"] for r in pac["resources"] if nome_recurso(r).lower().startswith("temas"))
    texto = baixar(url).decode("utf-8-sig")
    linhas = list(csv.DictReader(io.StringIO(texto)))
    temas = []
    for x in linhas:
        try:
            num = int(x.get("numeroPrecedente") or 0)
        except ValueError:
            num = 0
        temas.append(limpar_vazios({
            "seq": x.get("sequencialPrecedente"),
            "tp": x.get("tipoPrecedente", "").strip(),
            "n": num,
            "sit": x.get("situacao", "").strip(),
            "org": ORG_TEMA.get(x.get("orgaoJulgador", "").strip(), x.get("orgaoJulgador", "").strip()),
            "q": compactar(x.get("questaoSubmetidaAJulgamento")),
            "tese": compactar(x.get("teseFirmada")),
            "afet": x.get("dataPrimeiraAfetacao", "").strip(),
            "julg": x.get("dataJulgamento", "").strip(),
            "pub": x.get("dataPublicacaoAcordao", "").strip(),
            "ass": compactar(x.get("Assuntos")),
            "anot": compactar(x.get("anotacoesNUGEPNAC")),
            "info": compactar(x.get("informacoesComplementares")),
            "delim": compactar(x.get("delimitacaoJulgado")),
            "ant": compactar(x.get("entendimentoAnterior")),
            "leg": compactar(x.get("referenciaLegislativa")),
            "sum": compactar(x.get("sumulaOriginada")),
            "rg": compactar(x.get("numeroRepercussaoGeralSTF")),
            "rgd": compactar(x.get("descricaoRepercussaoGeral")),
        }))
    for t in temas:
        a = areas_do_tema(t)
        if a:
            t["ar"] = a
            sa = subareas(sem_acento(f"{t.get('ass', '')} {t.get('q', '')} {t.get('tese', '')}"), a)
            if sa:
                t["sa"] = sa
    # A base oficial traz algumas linhas repetidas: mantém uma por registro.
    unicos = {}
    for t in temas:
        unicos[t.get("seq") or f'{t.get("tp")}-{t.get("n")}'] = t
    temas = list(unicos.values())
    temas.sort(key=lambda t: (t.get("tp") != "Tema", -t.get("n", 0)))

    # Histórico de alterações (comparação com a execução anterior).
    anterior = {f'{t.get("tp")}-{t.get("n")}': t for t in ler_json(CACHE / "temas_anterior.json", [])}
    hist = ler_json(CACHE / "historico_temas.json", [])
    hoje = HOJE.isoformat()
    if anterior:
        for t in temas:
            k = f'{t.get("tp")}-{t.get("n")}'
            a = anterior.get(k)
            if a is None:
                hist.append({"d": hoje, "tp": t.get("tp"), "n": t.get("n"), "ev": "novo", "para": t.get("sit", "")})
                continue
            if a.get("sit") != t.get("sit"):
                hist.append({"d": hoje, "tp": t.get("tp"), "n": t.get("n"), "ev": "situacao", "de": a.get("sit", ""), "para": t.get("sit", "")})
            if a.get("tese", "") != t.get("tese", "") and t.get("tese"):
                hist.append({"d": hoje, "tp": t.get("tp"), "n": t.get("n"), "ev": "tese" if not a.get("tese") else "tese-alterada"})
    limite = (HOJE - dt.timedelta(days=180)).isoformat()
    hist = [h for h in hist if h["d"] >= limite]
    gravar_json(CACHE / "temas_anterior.json", temas)
    gravar_json(CACHE / "historico_temas.json", hist)
    gravar_json(SITE_DATA / "historico_temas.json", hist)
    gravar_json(SITE_DATA / "temas.json", temas)
    log(f"Precedentes qualificados: {len(temas)} registros; {len(hist)} evento(s) no histórico.")

    # Processos vinculados aos precedentes (leading cases, tribunal de origem).
    try:
        urlp = next(r["url"] for r in pac["resources"] if nome_recurso(r).lower().startswith("processos"))
        linhas = list(csv.DictReader(io.StringIO(baixar(urlp).decode("utf-8-sig"))))
        procs = []
        for x in linhas:
            try:
                num = int(x.get("numeroPrecedente") or 0)
            except ValueError:
                continue
            procs.append(limpar_vazios({
                "tp": x.get("tipoPrecedente", "").strip(), "n": num,
                "p": (x.get("Processo") or "").strip(),
                "reg": (x.get("numeroRegistro") or "").strip(),
                "lc": (x.get("leadingCase") or "").strip() == "S",
                "uf": (x.get("origemUF") or "").strip(),
                "trib": (x.get("siglaTribunalOrigem") or "").strip(),
                "rel": (x.get("ministroRelator") or x.get("NOME_MINISTRO_AFETACAO") or "").strip(),
                "afet": (x.get("dataAfetacao") or "").strip(),
                "julg": (x.get("dataJulgamento") or "").strip(),
                "susp": int(x.get("quantidadeProcessosSuspensoNaOrigem") or 0) if (x.get("quantidadeProcessosSuspensoNaOrigem") or "").strip().isdigit() else 0,
            }))
        gravar_json(SITE_DATA / "processos_temas.json", procs)
        log(f"Processos vinculados a precedentes: {len(procs)}.")
    except Exception as e:  # noqa: BLE001
        log("  ! processos vinculados indisponíveis:", e)
    return {"n": len(temas), "temas": sum(1 for t in temas if t.get("tp") == "Tema")}


# --------------------------------------------------------------------------
# 3. Radar de acórdãos recém-publicados (metadados das íntegras)
# --------------------------------------------------------------------------
def mapa_relator_turma(meses_disp: list[str]) -> dict:
    """Turma mais frequente de cada relator nos 2 meses mais recentes."""
    cont: dict[str, dict[str, int]] = {}
    for mes in meses_disp[-2:]:
        for slug in TURMAS:
            for r in ler_json(SITE_DATA / "acordaos" / mes / f"{slug}.json", []):
                nome = re.sub(r"\s*\(.*?\)", "", r.get("rel", "")).strip().upper()
                if nome:
                    cont.setdefault(nome, {}).setdefault(slug, 0)
                    cont[nome][slug] += 1
    return {n: max(c, key=c.get) for n, c in cont.items()}


def atualizar_radar(dias: int, meses_disp: list[str]) -> dict:
    pac = pacote("integras-de-decisoes-terminativas-e-acordaos-do-diario-da-justica")
    metas = [r for r in pac["resources"] if nome_recurso(r).startswith("metadados") and re.search(r"\d{8}", nome_recurso(r))]
    # Um arquivo por data de publicação (se houver reenvio, vale o mais recente).
    por_data = {}
    for r in metas:
        d = data_recurso(r)
        v = r.get("last_modified") or r.get("created") or ""
        if d not in por_data or v > (por_data[d].get("last_modified") or por_data[d].get("created") or ""):
            por_data[d] = r
    metas = [por_data[d] for d in sorted(por_data)][-dias:]
    cache_dir = CACHE / "radar"
    cache_dir.mkdir(parents=True, exist_ok=True)
    mapa = mapa_relator_turma(meses_disp)
    itens = []
    datas = []
    for r in metas:
        d = data_recurso(r)
        arq = cache_dir / f"{d}.json"
        versao = r.get("last_modified") or r.get("created")
        cache = ler_json(arq, None)
        if not cache or cache.get("v") != versao:
            bruto = json.loads(baixar(r["url"]).decode("utf-8"))
            ac = []
            for x in bruto:
                if (x.get("tipoDocumento") or "").upper() != "ACÓRDÃO":
                    continue
                rel = (x.get("NM_MINISTRO") or "").strip()
                ac.append(limpar_vazios({
                    "d": x.get("dataPublicacao"),
                    "p": (x.get("processo") or "").strip(),
                    "r": (x.get("recurso") or "").strip(),
                    "rel": rel,
                    "t": (x.get("teor") or "").strip(),
                    "reg": str(x.get("numeroRegistro") or ""),
                }))
            cache = {"v": versao, "itens": ac}
            gravar_json(arq, cache)
        for it in cache["itens"]:
            nome = re.sub(r"\s*\(.*?\)", "", it.get("rel", "")).strip().upper()
            if nome in mapa:
                it = dict(it, tr=mapa[nome])
            itens.append(it)
        datas.append(f"{d[:4]}-{d[4:6]}-{d[6:]}")
    # remove caches antigos
    manter = {f"{data_recurso(r)}.json" for r in metas}
    for f in cache_dir.glob("*.json"):
        if f.name not in manter:
            f.unlink()
    vistos = set()
    unicos = []
    for it in itens:
        k = (it.get("d"), it.get("reg"), it.get("r"), it.get("t"))
        if k not in vistos:
            vistos.add(k)
            unicos.append(it)
    itens = sorted(unicos, key=lambda x: (x.get("d", ""), x.get("p", "")), reverse=True)
    gravar_json(SITE_DATA / "radar.json", itens)
    log(f"Radar: {len(itens)} acórdãos publicados em {len(datas)} dia(s).")
    return {"n": len(itens), "dias": datas}



# --------------------------------------------------------------------------
# 4. Pautas futuras (sem nomes das partes; apenas advogados e OAB)
# --------------------------------------------------------------------------
ORG_PAUTA = {"T1": "primeira-turma", "T2": "segunda-turma", "T3": "terceira-turma", "T4": "quarta-turma",
             "T5": "quinta-turma", "T6": "sexta-turma", "S1": "primeira-secao", "S2": "segunda-secao",
             "S3": "terceira-secao", "CE": "corte-especial"}


def atualizar_pautas() -> dict:
    pac = pacote("pautas-futuras")
    arqs = [r for r in pac["resources"] if re.search(r"\d{8}", nome_recurso(r)) and nome_recurso(r).endswith(".gz")]
    if not arqs:
        raise RuntimeError("nenhum arquivo de pauta")
    ult = max(arqs, key=lambda r: data_recurso(r))
    bruto = json.loads(gzip.decompress(baixar(ult["url"])).decode("utf-8"))
    reg2t: dict[str, list] = {}
    for x in ler_json(SITE_DATA / "processos_temas.json", []):
        if x.get("reg"):
            reg2t.setdefault(x["reg"], []).append([x["tp"], x["n"]])
    hoje = HOJE.isoformat()
    itens, vistos = [], set()
    for x in bruto:
        d = data_br_para_iso(x.get("dataSessão") or x.get("dataSessao"))
        if not d or d < hoje:
            continue
        o = ORG_PAUTA.get((x.get("orgaoJulgador") or "").strip(), "")
        reg = str(x.get("numeroRegistro") or "")
        pet = (x.get("siglaPeticao") or "").strip()
        k = (d, o, reg, pet, x.get("numeroPeticao"))
        if k in vistos:
            continue
        vistos.add(k)
        seg = (x.get("segredoDeJustica") or "N").upper() == "S"
        adv = []
        if not seg:
            for parte in x.get("partes") or []:
                for a in parte.get("advogados") or []:
                    par = [(a.get("codigoOAB") or "").strip(), (a.get("nomeAdvogado") or "").strip()]
                    if par[0] and par not in adv:
                        adv.append(par)
        temas = reg2t.get(reg, [])
        cl = (x.get("siglaClasse") or "").strip()
        s = 0
        if o == "corte-especial":
            s += 3
        elif o.endswith("secao"):
            s += 3
        if temas:
            s += 6
        if re.match(r"^(EREsp|EAREsp|IAC|PUIL|ProAfR)", cl):
            s += 3
        if not pet:
            s += 1
        itens.append(limpar_vazios({
            "d": d, "o": o, "p": (x.get("processo") or "").strip(), "cl": cl, "reg": reg,
            "pet": pet, "rel": (x.get("Relator") or "").strip(), "pub": data_br_para_iso(x.get("dataPublicacaoPauta")),
            "seg": seg, "adv": adv, "temas": temas, "s": s,
        }))
    itens.sort(key=lambda i: (i["d"], -i.get("s", 0), i.get("o", ""), i.get("p", "")))
    gravar_json(SITE_DATA / "pautas.json", itens)
    log(f"Pautas: {len(itens)} processos em sessões a partir de hoje (arquivo {nome_recurso(ult)}).")
    return {"n": len(itens), "arquivo": data_recurso(ult), "comTema": sum(1 for i in itens if i.get("temas"))}


# --------------------------------------------------------------------------
# 5a. Relevância para o "Atualize-se": separa teses de julgamento que só
#     aplicam óbices processuais ou entendimento consolidado.
# --------------------------------------------------------------------------
_SUMULAS_ADM = r"(?:5|7|13|83|115|123|126|182|187|207|211|279|280|281|282|283|284|356|315|316|518|568|691|735)"
RE_GENERICO = re.compile("|".join([
    r"sumulas? (?:n[.oº]* ?)?" + _SUMULAS_ADM + r"\b", r"sumulas? (?:n[.oº]* ?)?\d+ e " + _SUMULAS_ADM + r"\b",
    r"enunciado n\. ?691", r"embargos de declaracao", r"omissao|obscuridade|contradicao|ambiguidade", r"rediscuss",
    r"mero inconformismo", r"reexame (?:do |de )?(?:conjunto |acervo )?(?:fatic|de fatos|probat)", r"revolvimento",
    r"fatico-probatori", r"prequestionament", r"inovacao recursal", r"preclusao consumativa",
    r"impugna\w* (?:especific|integral|de forma especific)", r"arts?\. ?1\.?022", r"arts?\. ?489", r"arts?\. ?619",
    r"art\. ?1\.?021, ?§ ?4", r"arts?\. ?1\.?026", r"habeas corpus substitutivo", r"flagrante ilegalidade",
    r"supressao de instancia", r"dissidio jurisprudencial", r"cotejo analitico", r"similitude fatica",
    r"deficiencia (?:de|na) fundamentacao", r"fundamentacao deficiente", r"decisao monocratica", r"colegialidade",
    r"entendimento dominante", r"intempestiv|tempestividade|desercao|preparo recursal",
    r"nao conhecimento do recurso|nao se conhece", r"prisao preventiva", r"custodia cautelar", r"periculum libertatis",
    r"risco de reiteracao", r"ordem publica", r"condicoes pessoais favoraveis", r"pena-base", r"dosimetria",
    r"fundamentos? (?:nao impugnad|suficientes? para manter)", r"agravo (?:interno|regimental) (?:nao|que nao|contra)",
    r"negativa de prestacao jurisdicional", r"competencia (?:do|ao) relator", r"reformatio in pejus",
    r"dispositivos? constituciona", r"materia constitucional", r"litigancia de ma-fe", r"multa (?:do|prevista no) art",
    r"honorarios recursais", r"nao (?:e|sao) cabive\w* (?:o |a )?(?:agravo|recurso|embargos|em recurso especial)",
    r"recurso especial (?:nao|e inadmissivel)", r"via (?:estreita|eleita) do habeas", r"nao comporta (?:o )?revolvimento",
    r"irrisori|exorbitant", r"atos normativos secundarios",
    r"honorarios (?:advocaticios )?(?:na via )?recursa", r"majoracao dos honorarios", r"§ ?11 do art\. ?85", r"art\. ?85, ?§ ?11",
    r"perda (?:superveniente )?(?:do|de) (?:interesse|objeto)", r"indeferimento liminar", r"sucedaneo", r"regimento interno",
    r"distinguir ou superar", r"sumula 343", r"nao conhec", r"inadmissibilidade", r"mera revisao", r"reexame de tese",
    r"alegac\w* generica", r"razoes (?:do|de) (?:recurso|agravo)", r"juizo de admissibilidade", r"efeitos infringentes",
    r"vicio (?:do|no) julgado", r"requisitos de admissibilidade", r"ausencia de interesse recursal",
    r"paradigma", r"via eleita", r"aderencia estrita", r"pre-?constituida", r"embargos de divergencia (?:nao|exige|pressup|so|somente)",
    r"inteiro teor do acordao", r"certidao de julgamento", r"meio de impugnacao",
    r"nao ha (?:ofensa|violacao) (?:aos?|ao|as?) (?:arts?|dispositivos)", r"inviavel a analise", r"nao se admite a analise",
]))
RE_DESFECHO_VAZIO = re.compile(r"(?:recurso|agravo|agravos|embargos|pedido|habeas corpus|ordem)[^.]{0,40}(?:nao conhecid|rejeitad|nao provid|desprovid|improvid|denegad|indeferid)\w*\.?\s*$")
_PARE = set("a o os as de do da dos das e em no na nos nas que para por com se ao aos um uma ou nao sua seu art lei sob quando como mais ser sao".split())
_CLASSES_MERITO = {"REsp", "EREsp", "EAREsp", "RMS", "CC", "MS", "HC", "RHC", "ProAfR", "IAC", "Pet", "Rcl", "SIRDR", "IDC", "AR", "APn"}


def itens_tese(t: str) -> list[tuple[str, str]]:
    """Divide a tese de julgamento em itens numerados: [(número, texto)]."""
    t = (t or "").strip()
    partes = re.split(r"(?:^|\s)(\d{1,2})\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])", t)
    if len(partes) < 3:
        return [("", t)] if t else []
    out = []
    if partes[0].strip():
        out.append(("", partes[0].strip()))
    for i in range(1, len(partes) - 1, 2):
        txt = partes[i + 1].strip()
        if len(txt) > 25:
            out.append((partes[i], txt))
    return out


def itens_substantivos(r: dict) -> list[tuple[str, str]]:
    return [(n, t) for n, t in itens_tese(r.get("tj") or "") if len(t) >= 70 and not RE_GENERICO.search(sem_acento(t))]


def _assinatura(t: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{4,}", sem_acento(t)) if w not in _PARE}


def cabecalho(em: str | None, lim: int = 600) -> str:
    """Verbetação sem cortar no meio da palavra."""
    cab = (em or "").split("\n", 1)[0].strip()
    if len(cab) <= lim:
        return cab
    corte = cab.rfind(". ", 0, lim)
    return cab[: corte + 1] if corte > lim * 0.5 else cab[:lim].rsplit(" ", 1)[0] + "…"


def assunto_curto(em: str | None) -> str:
    """Até três segmentos de assunto da verbetação, sem ramo do direito,
    classe processual nem desfecho: 'Previdência privada. Resgate de contribuições.'"""
    cab = (em or "").split("\n", 1)[0]
    segs = [x.strip() for x in re.split(r"\.\s+(?=[A-Za-zÀ-ÿ])", cab) if x.strip()]
    out = []
    for i, sg in enumerate(segs):
        n = sem_acento(sg)
        if re.match(r"^(ementa|tema|temas|controversia|iac)\b", n) or re.search(r"repetitiv|admissibilidade|dissidio|via eleita|nao demonstrad|aderencia estrita", n) or _segmento_rotulo(n) or (i < 4 and RE_CLASSE_SEG.match(n)) or RE_DESFECHO_VAZIO.search(n + ".") or re.search(r"provid|provimento|conhecid|rejeitad|concedid|denegad|parcialmente|procedente|improcedente|acolhid", n):
            continue
        if len(sg) > 60:
            if out:
                break
            continue
        out.append(sg.rstrip("."))
        if len(out) == 3:
            break
    return ". ".join(out)


def selecionar_feed(cands: list[dict]) -> list[dict]:
    """Escolhe os acórdãos da fila: teses jurídicas, destaques e teses de julgamento
    com conteúdo próprio, descontando os entendimentos reiterados em série."""
    out, pool = [], []
    for r in cands:
        toks = (r.get("cl") or "").split(" ")
        cl0 = toks[0]
        # Fora da fila: embargos de declaração, recursos extraordinários (juízo de
        # admissibilidade para o STF) e propostas de afetação (já entram como tema).
        if cl0 in ("EDcl", "ProAfR") or "RE" in toks:
            if not r.get("tese"):
                continue
        sub = itens_substantivos(r)
        # A fila só traz julgados com uma tese legível: tese jurídica ou itens
        # próprios da tese de julgamento. Os demais ficam nos Destaques.
        if not r.get("tese") and not sub:
            continue
        cab = sem_acento((r.get("em") or "").split("\n", 1)[0])
        r["_vazio"] = 1 if RE_DESFECHO_VAZIO.search(cab) else 0
        if r["_vazio"] and not r.get("tese"):
            continue
        if r.get("tese") or r.get("s", 0) >= LIMIAR_DESTAQUE:
            r["_fs"] = r.get("s", 0) + 6 + 2 * min(len(sub), 2)
            r["_sub"] = sub
            out.append(r)
            continue
        r["_sub"] = sub
        r["_sig"] = [_assinatura(t) for _, t in sub]
        pool.append(r)
    for r in pool:
        r["_rep"] = 0
    for i, a in enumerate(pool):
        for b in pool[i + 1:]:
            if any(len(x & y) / max(1, len(x | y)) >= 0.34 for x in a["_sig"] for y in b["_sig"]):
                a["_rep"] += 1
                b["_rep"] += 1
    for r in pool:
        cl0 = (r.get("cl") or "").split(" ")[0]
        r["_fs"] = r.get("s", 0) + 2 * min(len(r["_sub"]), 3) + (3 if cl0 in _CLASSES_MERITO else 0) - 1.5 * min(r["_rep"], 5) - 4 * r["_vazio"]
        if r["_fs"] >= 2:
            out.append(r)
    return out


# --------------------------------------------------------------------------
# 5. Destaques e índice leve para o "Meu radar"
# --------------------------------------------------------------------------
LIMIAR_DESTAQUE = 6


def gerar_destaques(meses_disp: list[str]) -> dict:
    recentes = sorted(meses_disp)[-3:]
    dest, indice = [], []
    for mes in recentes:
        for arq in sorted((SITE_DATA / "acordaos" / mes).glob("*.json")):
            for r in ler_json(arq, []):
                sc = r.get("s", 0)
                if sc >= LIMIAR_DESTAQUE:
                    dest.append(r)
                if sc >= -1:
                    cab = (r.get("em") or "").split("\n", 1)[0][:320]
                    indice.append(limpar_vazios({
                        "id": r.get("id"), "m": mes, "o": r.get("o"), "cl": r.get("cl"), "n": r.get("n"),
                        "reg": r.get("reg"), "dj": r.get("dj"), "s": sc, "ar": r.get("ar"), "sa": r.get("sa"), "h": cab,
                        "tese": (r.get("tese") or "")[:600],
                        "tj": (r.get("tj") or "")[:900],
                    }))
    # Fila do "Atualize-se": acórdãos recentes com tese ou relevância alta.
    lim_feed = (dt.date.today() - dt.timedelta(days=80)).isoformat()
    cands = []
    for mes in recentes:
        for arq in sorted((SITE_DATA / "acordaos" / mes).glob("*.json")):
            for r in ler_json(arq, []):
                if (r.get("dj") or "") >= lim_feed and (r.get("tese") or r.get("tj") or r.get("s", 0) >= LIMIAR_DESTAQUE):
                    r["m"] = mes
                    cands.append(r)
    feed, vistos = [], set()
    for r in sorted(selecionar_feed(cands), key=lambda x: -x.get("_fs", 0)):
        # Vários recursos do mesmo repetitivo trazem a mesma tese: fica um só.
        ass = " ".join(re.findall(r"[a-z0-9]{3,}", sem_acento(re.sub(r"^\W*tese\s*\d*\s*:?", "", r.get("tese") or r.get("tj") or "", flags=re.I))[:220]))[:120]
        if ass in vistos:
            continue
        vistos.add(ass)
        sub = r.get("_sub") or []
        todos = itens_tese(r.get("tj") or "")
        # Na fila, mostra só os itens com conteúdo próprio da tese de julgamento.
        tj = "\n".join(f"{n}. {t}" if n else t for n, t in sub) if sub and len(sub) < len(todos) else (r.get("tj") or "")
        feed.append(limpar_vazios({
            "id": r.get("id"), "m": r["m"], "o": r.get("o"), "cl": r.get("cl"), "n": r.get("n"),
            "reg": r.get("reg"), "dj": r.get("dj"), "dd": r.get("dd"), "rel": r.get("rel"),
            "s": r.get("s", 0), "fs": round(r.get("_fs", 0), 1), "ar": r.get("ar"), "sa": r.get("sa"), "rz": r.get("rz"),
            "h": cabecalho(r.get("em")), "as": assunto_curto(r.get("em")),
            "tese": (r.get("tese") or "")[:600], "tj": tj[:900],
            "tjp": 1 if tj != (r.get("tj") or "") else 0,
        }))
    feed.sort(key=lambda r: (r.get("dj", ""), r.get("s", 0)), reverse=True)
    gravar_json(SITE_DATA / "atualize.json", feed)
    dest.sort(key=lambda r: (r.get("dj", ""), r.get("s", 0)), reverse=True)
    indice.sort(key=lambda r: (r.get("dj", ""), r.get("s", 0)), reverse=True)
    gravar_json(SITE_DATA / "destaques.json", dest)
    gravar_json(SITE_DATA / "indice.json", indice)
    log(f"Destaques: {len(dest)}; índice do radar: {len(indice)}; fila do Atualize-se: {len(feed)} ({', '.join(recentes)}).")
    return {"n": len(dest), "indice": len(indice), "feed": len(feed), "meses": recentes, "limiar": LIMIAR_DESTAQUE}

# --------------------------------------------------------------------------
# 6a. Índice de números de processo (todo o acervo), para a busca por número.
# --------------------------------------------------------------------------
def gerar_numeros(meses_disp: list[str]) -> int:
    meses = sorted(meses_disp)
    orgs = list(ORGAOS)
    linhas = []
    for mi, mes in enumerate(meses):
        for oi, slug in enumerate(orgs):
            for r in ler_json(SITE_DATA / "acordaos" / mes / f"{slug}.json", []):
                n = re.sub(r"\D", "", str(r.get("n") or ""))
                if n:
                    linhas.append([n, str(r.get("reg") or ""), mi, oi, r.get("id")])
    gravar_json(SITE_DATA / "numeros.json", {"m": meses, "o": orgs, "l": linhas})
    log(f"Números de processo indexados: {len(linhas)}.")
    return len(linhas)


# --------------------------------------------------------------------------
# 7. Súmulas do STJ (página oficial SCON). O site oficial costuma recusar
#    acessos automatizados; nesse caso vale a última extração guardada no
#    repositório (site/sumulas-fonte.json).
# --------------------------------------------------------------------------
SUMULAS_FONTE = RAIZ / "site" / "sumulas-fonte.json"
RAMO_AREA = [
    ("proc-penal", r"processual penal"), ("proc-civil", r"processual civil"), ("penal", r"penal"),
    ("tributario", r"tributario"), ("administrativo", r"administrativo"), ("bancario", r"bancario"),
    ("previdenciario", r"previdenciario"), ("consumidor", r"consumidor"), ("empresarial", r"empresarial"),
    ("familia", r"crianca e do adolescente"), ("ambiental", r"ambiental"), ("civil", r"direito civil"),
]
ASSUNTO_FAMILIA = re.compile(r"alimentos|paternidade|divorcio|regime de bens|uniao estavel|guarda|sucess|prisao civil")
RE_CIT_SUM = re.compile(r"\((?:S[ÚU]MULA \d+, )?(CORTE ESPECIAL|PRIMEIRA SE[ÇC][ÃA]O|SEGUNDA SE[ÇC][ÃA]O|TERCEIRA SE[ÇC][ÃA]O)[^()]*\)")
ORG_SUM = {"CORTE ESPECIAL": "Corte Especial", "PRIMEIRA SECAO": "Primeira Seção", "SEGUNDA SECAO": "Segunda Seção", "TERCEIRA SECAO": "Terceira Seção"}


def _coletar_sumulas_online() -> list[dict]:
    out = []
    for i in range(1, 1001, 100):
        url = f"https://scon.stj.jus.br/SCON/sumstj/toc.jsp?b=SUMU&numDocsPagina=100&l=100&i={i}&ordenacao=%40NUM&p=false&h=true&tipo_visualizacao="
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"})
        with urllib.request.urlopen(req, timeout=60) as r:
            html = r.read().decode(r.headers.get_content_charset() or "latin-1", "replace")
        blocos = re.findall(r'class="numeroSumula">\s*(\d+)\s*<.*?class="ramoSumula">(.*?)</span>(.*?)</a>', html, re.S)
        for n, ramo, txt in blocos:
            limpo = lambda x: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", x)).strip()
            out.append({"n": int(n), "ramo": limpo(ramo), "txt": limpo(txt)})
        if len(blocos) < 100:
            break
    return out


def atualizar_sumulas() -> dict:
    fonte = ler_json(SUMULAS_FONTE, {})
    brutas = fonte.get("sumulas", [])
    coletado = fonte.get("coletadoEm", "")
    try:
        novas = _coletar_sumulas_online()
        confiaveis = sum(1 for x in novas if "julgad" in (x.get("txt") or "") or "DJ" in (x.get("txt") or ""))
        if novas and len(novas) >= len(brutas) and confiaveis >= 0.9 * len(novas):
            brutas, coletado = novas, dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
            log(f"Súmulas: {len(novas)} lidas da página oficial.")
    except Exception as e:  # noqa: BLE001
        log(f"Súmulas: página oficial indisponível ({e}); usando a extração de {coletado[:10] or 'arquivo local'}.")
    lista = []
    for x in brutas:
        ramo, _, assunto = (x.get("ramo") or "").partition(" - ")
        txt = x.get("txt") or ""
        enunciado, nota, org, julg, pub = txt, "", "", "", ""
        m = None
        for m in RE_CIT_SUM.finditer(txt):
            break
        if m:
            enunciado = txt[:m.start()].strip()
            nota = txt[m.end():].strip()
            cit = m.group(0)
            org = ORG_SUM.get(sem_acento(m.group(1)).upper().strip(), m.group(1).title())
            j = re.search(r"julgad[oa] em (\d{1,2})/(\d{1,2})/(\d{4})", cit)
            if j:
                julg = f"{j.group(3)}-{int(j.group(2)):02d}-{int(j.group(1)):02d}"
            d = re.search(r"(?<!REP)DJe?\s*(?:de\s*)?(\d{1,2})/(\d{1,2})/(\d{4})", cit)
            if d:
                pub = f"{d.group(3)}-{int(d.group(2)):02d}-{int(d.group(1)):02d}"
        nn = sem_acento(nota)
        sit = "cancelada" if "determinou o cancelamento" in nn or "foi cancelada" in nn else ("alterada" if re.search(r"alteracao|nova redacao|redacao anterior", nn) else "vigente")
        rn, an = sem_acento(ramo), sem_acento(assunto)
        ar = []
        for k, rx in RAMO_AREA:
            if re.search(rx, rn) and k not in ar:
                ar.append(k)
                break
        if "civil" in ar and ASSUNTO_FAMILIA.search(an):
            ar.append("familia")
        sa = subareas(f"{an} {sem_acento(enunciado)}", ar)
        lista.append(limpar_vazios({"n": x.get("n"), "ramo": ramo.title().replace(" Do ", " do ").replace(" Da ", " da ").replace(" E ", " e "),
            "ass": assunto.capitalize(), "t": enunciado, "nota": nota, "org": org, "julg": julg, "pub": pub, "sit": sit, "ar": ar, "sa": sa}))
    lista.sort(key=lambda s: -(s.get("n") or 0))
    gravar_json(SITE_DATA / "sumulas.json", lista)
    vig = sum(1 for s in lista if s.get("sit") != "cancelada")
    log(f"Súmulas: {len(lista)} ({vig} vigentes).")
    return {"n": len(lista), "vigentes": vig, "coletadoEm": coletado}


# Rótulos das submatérias, lidos pelo site.
def gravar_taxonomia() -> None:
    gravar_json(SITE_DATA / "submaterias.json", {a: [[k, rot] for k, rot, _ in lst] for a, lst in SUBAREAS.items() if lst})


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--meses", type=int, default=12, help="meses de acórdãos mantidos no site")
    ap.add_argument("--dias-radar", type=int, default=15, help="dias de publicação no radar")
    args = ap.parse_args()

    SITE_DATA.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    estado = ler_json(CACHE / "estado.json", {})
    erros = []

    ultimos = {}
    try:
        ultimos = atualizar_espelhos(args.meses, estado)
    except Exception as e:  # noqa: BLE001
        erros.append(f"espelhos: {e}")
        log("ERRO espelhos:", e)
    finally:
        gravar_json(CACHE / "estado.json", estado)
    try:
        migrar_esquema(estado)
    finally:
        gravar_json(CACHE / "estado.json", estado)
    meses_disp = podar_meses(args.meses)

    destaques = {}
    try:
        destaques = gerar_destaques(meses_disp)
    except Exception as e:  # noqa: BLE001
        erros.append(f"destaques: {e}")
        log("ERRO destaques:", e)

    try:
        gerar_numeros(meses_disp)
    except Exception as e:  # noqa: BLE001
        erros.append(f"números: {e}")
        log("ERRO números:", e)

    temas = {}
    try:
        temas = atualizar_temas()
    except Exception as e:  # noqa: BLE001
        erros.append(f"temas: {e}")
        log("ERRO temas:", e)

    sumulas = {}
    try:
        sumulas = atualizar_sumulas()
        gravar_taxonomia()
    except Exception as e:  # noqa: BLE001
        erros.append(f"súmulas: {e}")
        log("ERRO súmulas:", e)

    radar = {}
    try:
        radar = atualizar_radar(args.dias_radar, meses_disp)
    except Exception as e:  # noqa: BLE001
        erros.append(f"radar: {e}")
        log("ERRO radar:", e)

    pautas = {}
    try:
        pautas = atualizar_pautas()
    except Exception as e:  # noqa: BLE001
        erros.append(f"pautas: {e}")
        log("ERRO pautas:", e)

    # Manifesto lido pelo site
    manifesto_ant = ler_json(SITE_DATA / "manifest.json", {})
    meses_info = []
    for mes in sorted(meses_disp, reverse=True):
        org = {}
        for slug in ORGAOS:
            arq = SITE_DATA / "acordaos" / mes / f"{slug}.json"
            if arq.exists():
                org[slug] = {"n": len(ler_json(arq, [])), "kb": round(arq.stat().st_size / 1024)}
        meses_info.append({"m": mes, "orgaos": org})
    manifesto = {
        "atualizadoEm": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "orgaos": ORGAOS,
        "meses": meses_info,
        "ultimoArquivoEspelhos": ultimos or manifesto_ant.get("ultimoArquivoEspelhos", {}),
        "temas": temas or manifesto_ant.get("temas", {}),
        "radar": radar or manifesto_ant.get("radar", {}),
        "destaques": destaques or manifesto_ant.get("destaques", {}),
        "pautas": pautas or manifesto_ant.get("pautas", {}),
        "sumulas": sumulas or manifesto_ant.get("sumulas", {}),
        "esquema": ESQUEMA,
        "erros": erros,
    }
    gravar_json(SITE_DATA / "manifest.json", manifesto)
    log("Concluído." + (f" Com {len(erros)} erro(s)." if erros else ""))
    # Falha total apenas se nada pôde ser atualizado.
    if len(erros) >= 5:
        sys.exit(1)


if __name__ == "__main__":
    main()
