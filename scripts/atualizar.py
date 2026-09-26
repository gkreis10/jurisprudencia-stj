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
import zipfile
import json
import shutil
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
ESQUEMA = 7  # aumente quando mudar o enriquecimento; os arquivos são refeitos sem novo download


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
# Submatérias por matéria, na ordem de exibição: (chave, rótulo, grupo, expressão sobre o texto sem acentos).
# A ordem de exibição segue a estrutura das leis de regência (no Civil, a do Código Civil).
SUBAREAS = {
    "civil": [
        ("pessoas", "Pessoas, capacidade e pessoa jurídica", "Parte geral", r"capacidade civil|incapaz|emancipacao|morte presumida|ausente|pessoa juridica sem fins|associac(ao|oes) civil|fundacao privada|domicilio civil"),
        ("personalidade", "Direitos da personalidade, imagem e honra", "Parte geral", r"direitos? da personalidade|direito (a|de) imagem|uso (indevido )?da imagem|nome civil|retificacao de (nome|registro civil)|\bhonra\b|privacidade|intimidade|esquecimento|liberdade de (imprensa|expressao)|materia jornalistica|redes sociais|provedor|marco civil"),
        ("bens", "Bens", "Parte geral", r"bens? (publicos? dominicais|moveis|imoveis por|acessorios|fungiveis)|pertenca|frutos e rendimentos|benfeitorias"),
        ("negocio-juridico", "Negócio jurídico, vícios e nulidades", "Parte geral", r"negocio juridico|nulidade (do|de|da) (negocio|contrato|ato|clausula|escritura|doacao)|anulabilidade|anulacao (do|de) (negocio|contrato|escritura)|vicios? de consentimento|coacao|estado de perigo|simulacao|fraude contra credores|pauliana|reserva mental"),
        ("prescricao-civ", "Prescrição e decadência", "Parte geral", r"prescricao|prescricional|decadencia|decadencial"),
        ("obrigacoes", "Obrigações, pagamento e inadimplemento", "Obrigações", r"obrigac|adimplemento|inadimplemento|juros (de mora|moratorios|remuneratorios)|correcao monetaria|clausula penal|multa (contratual|compensatoria|moratoria)|perdas e danos|quitacao|novacao|cessao de credito|assuncao de divida|solidariedade passiva|\barras\b|termo inicial dos juros"),
        ("enriquecimento", "Enriquecimento sem causa e pagamento indevido", "Obrigações", r"enriquecimento (sem causa|ilicito|indevido)|pagamento indevido|repeticao (do|de) indebito|restituicao em dobro|gestao de negocios"),
        ("contratos", "Contratos em geral e revisão contratual", "Contratos", r"\bcontrat|revisao contratual|onerosidade excessiva|resolucao (do|de) contrato|rescisao contratual|boa-fe objetiva|funcao social do contrato|exceptio|evicao|vicios? redibitori"),
        ("compra-venda", "Compra e venda, promessa e doação", "Contratos", r"compra e venda|promessa de compra|compromisso de compra|adjudicacao compulsoria|doacao|permuta|direito de preferencia|retrovenda|outorga (uxoria|conjugal)"),
        ("locacao", "Locação", "Contratos", r"locacao|locatari|locador|alugue(l|is)|despejo|renovatoria|8\.245|inquilinato"),
        ("servicos-emp", "Prestação de serviços, empreitada, mandato e corretagem", "Contratos", r"prestacao de servicos?|empreitada|corretagem|corretor|mandato|mandatario|honorarios contratuais|comodato|contrato de deposito|construcao civil"),
        ("transporte", "Transporte", "Contratos", r"contrato de transporte|transporte (de pessoas|de passageiros|de carga|de mercadorias|rodoviario|maritimo|ferroviario)|transportador|conhecimento de transporte"),
        ("seguros", "Seguros", "Contratos", r"\bseguros?\b|securitari|dpvat|seguradora|segurado\b|sinistro|indenizacao securitaria"),
        ("fianca", "Fiança e garantias pessoais", "Contratos", r"fianca|fiador|carta de fianca|garantia fidejussoria"),
        ("dano-moral", "Dano moral", "Responsabilidade civil", r"dano moral|danos morais|extrapatrimonia|in re ipsa|abalo moral|quantum indenizatorio"),
        ("resp-civil", "Responsabilidade civil e indenização", "Responsabilidade civil", r"responsabilidade civil|danos? materia|indenizac|dever de indenizar|ato ilicito|lucros cessantes|dano estetico|perda de uma chance|responsabilidade objetiva|nexo (de )?causal|pensionamento|pensao mensal vitalicia"),
        ("acidentes", "Acidentes de trânsito", "Responsabilidade civil", r"acidente de transito|colisao|atropelamento|acidente automobilistico|veiculo automotor"),
        ("resp-profissional", "Erro médico e responsabilidade de profissionais", "Responsabilidade civil", r"erro medico|responsabilidade (civil )?(do|de|dos) (medicos?|hospita|profissiona|advogad|dentista)|hospital|clinica|cirurgi|obrigacao de meio"),
        ("posse", "Posse e ações possessórias", "Direito das coisas", r"\bposse\b|possessori|reintegracao de posse|manutencao de posse|interdito proibitorio|esbulho|turbacao|direito de retencao"),
        ("usucapiao", "Usucapião", "Direito das coisas", r"usucapiao|prescricao aquisitiva"),
        ("propriedade", "Propriedade e direito de vizinhança", "Direito das coisas", r"propriedade|reivindicat|imissao na posse|direitos? de vizinhanca|uso anormal|passagem forcada|aluviao|acessao|demarcacao"),
        ("condominio", "Condomínio", "Direito das coisas", r"condomin|cotas? condominia|taxas? condominia|sindico|convencao de condominio|multipropriedade|assembleia condominial"),
        ("direitos-reais", "Direitos reais sobre coisa alheia e garantias reais", "Direito das coisas", r"direitos? rea(l|is)|usufruto|servidao|direito de superficie|direito real de habitacao|hipoteca|penhor|anticrese|\blaje\b"),
        ("registros", "Registros públicos e atividade notarial", "Direito das coisas", r"registro de imoveis|registros? publicos?|6\.015|cartorio|tabeliao|tabelionato|notari|registrador|matricula (do|de) imove|averbacao|incorporacao imobiliaria|loteamento|escritura publica"),
        ("autoral", "Direitos autorais", "Propriedade intelectual", r"direitos? autora|\becad\b|obras? (intelectua|musica|literari|audiovisua)|9\.610|execucao publica|plagio"),
    ],
    "familia": [
        ("casamento", "Casamento e regime de bens", "Família", r"casamento|regime de bens|pacto antenupcial|comunhao (parcial|universal)|separacao (total|obrigatoria|convencional|legal) de bens|meacao"),
        ("uniao-estavel", "União estável", "Família", r"uniao estavel|companheir|concubin|uniao homoafetiva|uniao paralela"),
        ("divorcio", "Divórcio, separação e partilha", "Família", r"divorcio|separacao judicial|partilha de bens|dissolucao (da sociedade conjugal|da uniao|do casamento)|sobrepartilha"),
        ("alimentos", "Alimentos", "Família", r"alimentos|alimentar|pensao alimenticia|prisao civil|revisional de alimentos|exoneracao de alimentos|alimentando|alimentante"),
        ("filiacao", "Filiação e paternidade", "Família", r"paternidade|maternidade|filiacao|investigacao de paternidade|exame de dna|socioafetiv|multiparentalidade|registro de nascimento|reproducao assistida"),
        ("guarda", "Guarda, convivência e poder familiar", "Família", r"\bguarda\b|convivencia familiar|regime de visitas|direito de visita|alienacao parental|poder familiar|destituicao"),
        ("adocao", "Adoção", "Família", r"adocao|adotan|adotad|cadastro nacional de adocao|habilitacao para adocao"),
        ("infancia", "Criança e adolescente", "Família", r"crianca e do adolescente|\beca\b|medida socioeducativa|ato infracional|acolhimento institucional|menor de idade"),
        ("curatela", "Curatela, tutela e interdição", "Família", r"curatela|curador|interdicao|tomada de decisao apoiada|\btutor\b|tutela de menor"),
        ("sucessao-legitima", "Sucessão legítima e direitos dos herdeiros", "Sucessões", r"sucessao legitima|vocacao hereditaria|herdeir|heranca|concorrencia sucessoria|conjuge sobrevivente|companheir[oa] sobrevivente|colacao|sonegados|direito real de habitacao|renuncia a heranca|cessao de direitos hereditarios|sucess"),
        ("testamento", "Testamentos e legados", "Sucessões", r"testament|legado|legatari|codicilo|fideicomisso|disposicao de ultima vontade|legitima dos herdeiros"),
        ("inventario", "Inventário e arrolamento", "Sucessões", r"inventario|arrolamento|inventariante|espolio|partilha (em|no) inventario"),
    ],
    "consumidor": [
        ("planos-saude", "Planos de saúde", "Contratos de consumo", r"planos? de saude|operadora|\bans\b|rol de procedimentos|cobertura|home care|reajuste por faixa etaria|coparticipacao|seguro saude"),
        ("bancos-cons", "Bancos e crédito ao consumidor", "Contratos de consumo", r"instituic(ao|oes) financeira|correntista|conta corrente|emprestimo consignado|descontos? indevidos?|cartao de credito|cheque especial|financiamento de veiculo"),
        ("imoveis-cons", "Imóveis, incorporação e consórcios", "Contratos de consumo", r"compra e venda de imove|incorporadora|construtora|atraso na entrega|consorcio|cooperativa habitacional|distrato imobiliario|lote"),
        ("educacao-cons", "Ensino e mensalidades", "Contratos de consumo", r"instituic(ao|oes) de ensino|mensalidade|faculdade particular|curso superior|escola particular|diploma"),
        ("aereo", "Transporte aéreo e turismo", "Serviços", r"transporte aereo|companhia aerea|\bvoo\b|voos|bagagem|overbooking|pacote turistico|agencia de viagens|hotel"),
        ("essenciais", "Energia, água, telefonia e internet", "Serviços", r"energia eletrica|telefonia|agua e esgoto|servicos? essencia|concessionaria de (energia|agua|servico)|internet|tv por assinatura|fornecimento de energia|corte (de|do) fornecimento"),
        ("veiculos", "Veículos", "Serviços", r"veiculo|montadora|concessionaria de veiculos|automovel|recall"),
        ("fornecedor", "Vício e fato do produto ou serviço", "Responsabilidade do fornecedor", r"fato do produto|vicio do produto|fato do servico|vicio do servico|responsabilidade (civil )?(objetiva|do fornecedor|solidaria)|defeito|cadeia de fornecimento|garantia legal"),
        ("cadastros", "Cadastros, negativação e protesto", "Responsabilidade do fornecedor", r"cadastro|inadimplentes|negativac|inscricao indevida|\bspc\b|serasa|protesto|credit scoring|score"),
        ("praticas", "Práticas e cláusulas abusivas", "Práticas comerciais", r"abusiv|venda casada|arrependimento|cobranca indevida|repeticao em dobro|clausula (de )?(eleicao|limitativa)"),
        ("publicidade", "Oferta, publicidade e comércio eletrônico", "Práticas comerciais", r"publicidade|oferta|comercio eletronico|compra (pela|na|por) internet|marketplace|plataforma digital|propaganda"),
        ("superendividamento", "Superendividamento", "Práticas comerciais", r"superendividamento|minimo existencial|14\.181"),
        ("defesa-cons", "Defesa do consumidor em juízo", "Defesa em juízo", r"inversao do onus|hipossuficien|foro do (domicilio do )?consumidor|acao coletiva de consumo|procon|relacao de consumo|consumidor por equiparacao|bystander"),
    ],
    "bancario": [
        ("juros", "Juros, capitalização e encargos", "Contratos bancários", r"juros|capitalizacao|anatocismo|taxa media|comissao de permanencia|encargos (moratorios|contratuais)|tarifa|\bcet\b"),
        ("contratos-banc", "Contratos bancários e cédulas de crédito", "Contratos bancários", r"contratos? bancari|cedula de credito|mutuo|emprestimo|financiamento|consignado|conta corrente|prestacao de contas|cheque especial|renegociacao"),
        ("cartao", "Cartão de crédito", "Contratos bancários", r"cartao de credito|rotativo|cartao consignado|\brmc\b"),
        ("fiduciaria", "Alienação fiduciária e busca e apreensão", "Garantias", r"alienacao fiduciaria|busca e apreensao|garantia fiduciaria|cessao fiduciaria|purgacao da mora|9\.514|decreto-lei 911"),
        ("garantias-banc", "Aval e outras garantias bancárias", "Garantias", r"\baval\b|avalista|garantidor|devedor solidario|penhor"),
        ("sfh", "Sistema Financeiro da Habitação", "Crédito imobiliário", r"sistema financeiro da habitacao|\bsfh\b|\bfcvs\b|mutuario|crédito imobiliario|credito imobiliario"),
        ("fraudes", "Fraudes e segurança bancária", "Responsabilidade", r"fraude|golpe|\bpix\b|seguranca bancaria|fortuito interno|saque indevido|transacoes? nao reconhecid|sumula 479"),
        ("sigilo", "Sigilo bancário e dados", "Responsabilidade", r"sigilo bancario|quebra de sigilo|dados bancarios|\blgpd\b|protecao de dados"),
    ],
    "empresarial": [
        ("sociedades", "Sociedades e sócios", "Direito societário", r"societari|sociedade (limitada|anonima|empresaria|simples)|\bsocios?\b|acionista|quotas|assembleia geral|administrador da sociedade|acordo de socios"),
        ("dissolucao", "Dissolução e apuração de haveres", "Direito societário", r"dissolucao (parcial|total|da sociedade)|apuracao de haveres|retirada de socio|exclusao de socio|direito de recesso"),
        ("desconsideracao", "Desconsideração da personalidade jurídica", "Direito societário", r"desconsideracao da personalidade|desconsideracao inversa|incidente de desconsideracao|grupo economico|confusao patrimonial|desvio de finalidade"),
        ("recuperacao", "Recuperação judicial", "Crise da empresa", r"recuperacao (judicial|extrajudicial)|plano de recuperacao|stay period|credito extraconcursal|classes? de credores|recuperanda"),
        ("falencia", "Falência", "Crise da empresa", r"falenc|falid|massa falida|concordata|administrador judicial|habilitacao de credito|classificacao de creditos|11\.101"),
        ("titulos", "Títulos de crédito", "Títulos e contratos", r"titulos? de credito|duplicata|nota promissoria|cheque|letra de cambio|endosso|\baval\b|protesto de titulo"),
        ("contratos-emp", "Contratos empresariais", "Títulos e contratos", r"arrendamento mercantil|leasing|franquia|representacao comercial|contrato de distribuicao|factoring|fomento mercantil|contrato empresarial|agencia e distribuicao"),
        ("marcas", "Marcas, concorrência desleal e nome empresarial", "Propriedade industrial", r"\bmarcas?\b|trade dress|conjunto-imagem|nome empresarial|concorrencia desleal|nome de dominio"),
        ("patentes", "Patentes e desenho industrial", "Propriedade industrial", r"patente|propriedade industrial|\binpi\b|desenho industrial|modelo de utilidade|9\.279"),
        ("arbitragem", "Arbitragem", "Solução de conflitos", r"arbitragem|arbitral|clausula compromissoria|compromisso arbitral|9\.307"),
        ("mercado", "Mercado de capitais e concorrência", "Mercado", r"mercado de capitais|\bcvm\b|valores mobiliarios|\bcade\b|antitruste|ordem economica|bolsa de valores"),
    ],
    "proc-civil": [
        ("partes", "Partes, legitimidade e intervenção de terceiros", "Parte geral", r"legitimidade|ilegitimidade|litisconsorcio|intervencao de terceiros|denunciacao da lide|chamamento ao processo|assistencia simples|amicus curiae|substituicao processual|interesse de agir|capacidade processual"),
        ("competencia", "Competência", "Parte geral", r"competencia|conflito de competencia|\bforo\b|conexao|continencia|prevencao|clausula de eleicao"),
        ("honorarios", "Honorários advocatícios", "Parte geral", r"honorarios|sucumbencia|verba honoraria|art\. 85"),
        ("gratuidade", "Gratuidade da justiça, custas e depósitos", "Parte geral", r"custas|gratuidade|justica gratuita|assistencia judiciaria|depositos? (judicia|recursa)|despesas processuais|caucao"),
        ("atos-proc", "Prazos, citação, intimação e nulidades", "Parte geral", r"citacao|intimacao|nulidade|revelia|prazos? processua|contagem (do|de) prazo|comunicacao dos atos|processo eletronico"),
        ("tutela", "Tutelas provisórias", "Parte geral", r"tutela (provisoria|de urgencia|antecipada|cautelar|de evidencia)|liminar|medida cautelar|efeito suspensivo"),
        ("provas-pc", "Provas e ônus da prova", "Conhecimento", r"\bprovas?\b|pericia|onus da prova|cerceamento de defesa|depoimento|testemunh|prova emprestada|julgamento antecipado"),
        ("sentenca", "Sentença, coisa julgada e ação rescisória", "Conhecimento", r"julgamento (extra|ultra|citra) petita|sentenca (extra|ultra|citra) petita|nulidade da sentenca|coisa julgada|acao rescisoria|querela nullitatis|preclusao|fundamentacao deficiente|ausencia de fundamentacao|art\. 489"),
        ("especiais", "Procedimentos especiais", "Conhecimento", r"acao monitoria|monitori|embargos de terceiro|possessoria|acao de exigir contas|prestacao de contas|consignacao em pagamento|divisao e demarcacao|acao popular|habilitacao|restauracao de autos"),
        ("ms", "Mandado de segurança", "Conhecimento", r"mandado de seguranca|direito liquido e certo|autoridade coatora|habeas data|12\.016"),
        ("coletivo", "Processo coletivo e ação civil pública", "Conhecimento", r"acao civil publica|acao coletiva|direitos (difusos|coletivos|individuais homogeneos)|tutela coletiva|7\.347|legitimidade do ministerio publico"),
        ("cumprimento", "Cumprimento de sentença e liquidação", "Execução", r"cumprimento (de|da) sentenca|liquidacao|impugnacao ao cumprimento|multa do art\. 523|astreintes|multa cominatoria|obrigacao de fazer"),
        ("execucao-tit", "Execução de título extrajudicial", "Execução", r"execucao de titulo|titulos? executivos?|embargos a execucao|excecao de pre-executividade|prescricao intercorrente|execucao por quantia"),
        ("penhora", "Penhora, bem de família e expropriação", "Execução", r"penhora|impenhorab|bem de familia|arresto|bloqueio (de valores|judicial|de ativos)|sisbajud|bacenjud|expropria|leilao|arrematacao|adjudicacao|fraude (a|contra) execucao|medidas atipicas"),
        ("recurso-especial", "Recurso especial e admissibilidade", "Recursos", r"recurso especial|admissibilidade|prequestionamento|sumula (n\. )?(7|5|83|211)|reexame|dissidio jurisprudencial|cotejo analitico"),
        ("agravos-embargos", "Agravos e embargos de declaração", "Recursos", r"agravo (interno|de instrumento|regimental|em recurso especial)|embargos de declaracao|omissao|contradicao|obscuridade|taxatividade mitigada|art\. 1\.015"),
        ("apelacao", "Apelação e julgamento nos tribunais", "Recursos", r"apelacao|julgamento ampliado|art\. 942|tecnica de ampliacao|sustentacao oral|reformatio in pejus|efeito devolutivo"),
        ("precedentes-pc", "Precedentes, IRDR e embargos de divergência", "Recursos", r"recursos? especia(l|is) repetitiv|\birdr\b|incidente de resolucao|\biac\b|precedente qualificado|embargos de divergencia|distinguishing|superacao de precedente|reclamacao"),
        ("preparo", "Preparo, tempestividade e deserção", "Recursos", r"tempestividade|intempestiv|preparo|desercao|feriado local|prazo recursal"),
    ],
    "tributario": [
        ("icms", "ICMS", "Tributos estaduais", r"\bicms\b|difal|substituicao tributaria progressiva|credito de icms"),
        ("ipva-itcmd", "IPVA e ITCMD", "Tributos estaduais", r"\bipva\b|\bitcmd\b|\bitcd\b|causa mortis"),
        ("ir", "Imposto de renda e CSLL", "Tributos federais", r"imposto (sobre a )?renda|\birpf\b|\birpj\b|\bcsll\b|lucro (real|presumido)|ganho de capital"),
        ("pis-cofins", "PIS e Cofins", "Tributos federais", r"\bpis\b|cofins|pasep|insumos?|nao cumulatividade"),
        ("contrib-prev", "Contribuições previdenciárias e de terceiros", "Tributos federais", r"contribuic\w* previdenciari|cota patronal|\brat\b|\bsat\b|terceiros|salario-educacao|\bincra\b|\bsesc\b|\bsenai\b|\bsebrae\b|seguridade social|folha de salarios"),
        ("ipi-aduana", "IPI, IOF e comércio exterior", "Tributos federais", r"\bipi\b|\biof\b|importacao|exportacao|drawback|aduaneir|reintegra|imposto de importacao"),
        ("simples", "Simples Nacional", "Tributos federais", r"simples nacional|microempresa|empresa de pequeno porte|\bmei\b"),
        ("municipais", "ISS, IPTU e ITBI", "Tributos municipais", r"\biss\b|issqn|\biptu\b|\bitbi\b|taxa de coleta de lixo"),
        ("taxas", "Taxas e contribuições especiais", "Tributos municipais", r"\btaxas?\b|contribuicao de melhoria|\bcide\b|contribuicao de iluminacao|\bcosip\b"),
        ("imunidade", "Imunidades e isenções", "Normas gerais", r"imunidade|isencao|beneficio fiscal|incentivo fiscal|nao incidencia|aliquota zero"),
        ("credito-trib", "Lançamento, prescrição e decadência", "Normas gerais", r"credito tributario|lancamento|prescricao|decadencia|denuncia espontanea|parcelamento|refis|suspensao da exigibilidade"),
        ("responsabilidade-trib", "Responsabilidade tributária e redirecionamento", "Normas gerais", r"responsabilidade tributaria|redirecionamento|dissolucao irregular|sucessao empresarial|substituicao tributaria|solidariedade tributaria|art\. 135"),
        ("compensacao", "Compensação e repetição de indébito", "Normas gerais", r"compensacao|repeticao de indebito|restituicao|creditamento|precatorio"),
        ("exec-fiscal", "Execução fiscal", "Processo tributário", r"execucao fiscal|certidao de divida ativa|\bcda\b|embargos a execucao fiscal|6\.830|garantia do juizo"),
        ("processo-trib", "Processo administrativo fiscal e certidões", "Processo tributário", r"processo administrativo fiscal|\bcarf\b|certidao (negativa|positiva)|\bcnd\b|arrolamento de bens|mandado de seguranca preventivo"),
    ],
    "administrativo": [
        ("servidores", "Servidores: remuneração e vantagens", "Agentes públicos", r"servidor|servidores|remuneracao|vencimentos|gratificac|adicional|reajuste|cargo publico|acumulacao de cargos|teto remuneratorio|licenca"),
        ("concursos", "Concursos públicos", "Agentes públicos", r"concurso publico|edital|candidato|nomeacao|cadastro de reserva|teste de aptidao|heteroidentificacao|banca examinadora"),
        ("militares", "Militares", "Agentes públicos", r"militar|militares|forcas armadas|policia militar|bombeiro|reforma militar"),
        ("pad", "Processo administrativo e disciplinar", "Agentes públicos", r"processo administrativo disciplinar|\bpad\b|demissao|sindicancia|poder disciplinar|penalidade administrativa|processo administrativo"),
        ("improbidade", "Improbidade administrativa", "Controle", r"improbidade|8\.429|14\.230|enriquecimento ilicito do agente"),
        ("controle", "Atos administrativos, poder de polícia e controle", "Controle", r"poder de policia|tribunal de contas|\btcu\b|atos? administrativ|anulacao do ato|autotutela|discricionari|sancao administrativa"),
        ("licitacoes", "Licitações", "Contratações públicas", r"licitac|pregao|14\.133|8\.666|dispensa de licitacao|inexigibilidade"),
        ("contratos-adm", "Contratos administrativos e concessões", "Contratações públicas", r"contratos? administrativ|concessao|permissao de servico|parceria publico|equilibrio economico|reequilibrio|concessionaria de servico"),
        ("desapropriacao", "Desapropriação e bens públicos", "Bens e intervenção", r"desapropria|bens? publico|terreno de marinha|faixa de dominio|servidao administrativa|tombamento|indenizacao expropriatoria|juros compensatorios"),
        ("resp-estado", "Responsabilidade civil do Estado", "Responsabilidade", r"responsabilidade (civil|objetiva) do estado|responsabilidade civil do ente|ente publico|37, ?§ ?6|omissao estatal"),
        ("regulacao", "Agências reguladoras e serviços públicos", "Regulação", r"agencia reguladora|anatel|aneel|anvisa|\bans\b|antt|anac|saneamento|servicos? publicos?"),
        ("transito", "Trânsito e multas", "Regulação", r"transito|\bcnh\b|detran|infracao de transito|habilitacao para dirigir|apreensao de veiculo|multa de transito|lei seca"),
        ("conselhos", "Conselhos profissionais", "Regulação", r"conselhos? (profissiona|de fiscalizacao|regional|federal)|\bcrm\b|\bcrea\b|\bcrf\b|anuidade|exercicio profissional"),
        ("saude-pub", "Saúde pública e medicamentos", "Direitos sociais", r"medicamento|\bsus\b|tratamento medico|internacao|fornecimento de (remedio|medicamento)"),
        ("ensino-pub", "Ensino público e financiamento estudantil", "Direitos sociais", r"ensino|educacao|universidade|instituicao federal de ensino|\bfies\b|\benem\b|vaga em creche"),
        ("fgts", "FGTS", "Direitos sociais", r"\bfgts\b|fundo de garantia"),
    ],
    "previdenciario": [
        ("aposentadorias", "Aposentadorias e tempo especial", "Benefícios", r"aposentadoria|tempo de contribuicao|tempo especial|atividade especial|conversao de tempo|agentes nocivos|\bppp\b"),
        ("incapacidade", "Benefícios por incapacidade", "Benefícios", r"auxilio-doenca|auxilio por incapacidade|aposentadoria por invalidez|incapacidade|pericia medica|reabilitacao"),
        ("pensao-morte", "Pensão por morte e qualidade de segurado", "Benefícios", r"pensao por morte|dependente|qualidade de segurado|periodo de graca"),
        ("assistencial", "Benefício assistencial (BPC/LOAS)", "Benefícios", r"\bbpc\b|\bloas\b|amparo assistencial|beneficio assistencial|miserabilidade|renda per capita"),
        ("outros-benef", "Salário-maternidade, auxílio-reclusão e outros", "Benefícios", r"salario-maternidade|auxilio-reclusao|salario-familia|auxilio-acidente"),
        ("rural", "Trabalhador rural", "Segurados", r"rural|segurado especial|boia-fria|inicio de prova material"),
        ("acidentaria", "Acidente de trabalho", "Segurados", r"acidente (do|de) trabalho|acidentari|doenca ocupacional"),
        ("revisao", "Revisão e cálculo de benefícios", "Cálculo e revisão", r"revisao|renda mensal|salario de beneficio|fator previdenciario|vida toda|decadencia|desaposentacao|reafirmacao da der|teto"),
        ("devolucao", "Devolução de valores e desconto", "Cálculo e revisão", r"devolucao de valores|valores recebidos|boa-fe|desconto (em|no) beneficio|tutela antecipada revogada"),
        ("custeio", "Custeio e contribuições do segurado", "Custeio", r"salario de contribuicao|debito previdenciario|contribuicao do segurado|indenizacao de contribuicoes|contribuinte individual"),
        ("privada", "Previdência privada", "Previdência complementar", r"previdencia (privada|complementar)|entidade (fechada|aberta)|resgate de reserva|plano de beneficios|patrocinador"),
    ],
    "ambiental": [
        ("dano-amb", "Dano ambiental e reparação", "Responsabilidade", r"dano ambiental|reparacao|recuperacao ambiental|poluicao|degradacao"),
        ("resp-amb", "Responsabilidade ambiental", "Responsabilidade", r"responsabilidade (civil )?ambiental|propter rem|poluidor|risco integral|solidari"),
        ("areas-prot", "Áreas protegidas e Código Florestal", "Proteção", r"preservacao permanente|\bapp\b|reserva legal|codigo florestal|unidade de conservacao|12\.651|mata atlantica"),
        ("urbanistico", "Urbanismo e parcelamento do solo", "Proteção", r"urbanistic|parcelamento do solo|loteamento irregular|plano diretor|zoneamento|ocupacao irregular"),
        ("recursos-nat", "Recursos hídricos, mineração e resíduos", "Proteção", r"recursos hidricos|mineracao|minerar|lavra|garimpo|residuos|aterro"),
        ("fauna", "Fauna e pesca", "Proteção", r"fauna|animais silvestres|\bpesca\b|\bcaca\b"),
        ("sancoes-amb", "Infrações e licenciamento", "Administrativo ambiental", r"multa|infracao|auto de infracao|licenciamento|licenca ambiental|ibama"),
    ],
    "penal": [
        ("dosimetria", "Dosimetria, regime e substituição da pena", "Parte geral", r"dosimetria|pena-base|aplicacao da pena|agravante|atenuante|reincidencia|maus antecedentes|regime (inicial|prisional|semiaberto|fechado)|substituicao da pena|minorante|majorante|continuidade delitiva|trafico privilegiado"),
        ("punibilidade", "Prescrição, insignificância e extinção da punibilidade", "Parte geral", r"prescricao|extincao da punibilidade|insignificancia|bagatela|crime impossivel|atipicidade"),
        ("exec-penal", "Execução penal", "Parte geral", r"execucao penal|progressao|livramento condicional|remicao|falta grave|indulto|comutacao|detracao|saida temporaria|7\.210"),
        ("pessoa", "Crimes contra a vida e lesões", "Crimes em espécie", r"homicidio|lesao corporal|feminicidio|aborto|infanticidio|induzimento"),
        ("violencia-dom", "Violência doméstica", "Crimes em espécie", r"violencia domestica|maria da penha|11\.340|medidas protetivas|ambito domestico"),
        ("honra", "Crimes contra a honra e a liberdade", "Crimes em espécie", r"injuria|calunia|difamacao|ameaca|perseguicao|stalking|sequestro|carcere privado"),
        ("patrimonio", "Crimes patrimoniais", "Crimes em espécie", r"furto|roubo|estelionato|receptacao|extorsao|latrocinio|apropriacao indebita|dano qualificado"),
        ("sexuais", "Crimes sexuais", "Crimes em espécie", r"estupro|dignidade sexual|vulneravel|pornografia|importunacao|assedio sexual"),
        ("drogas", "Drogas", "Legislação especial", r"trafico|drogas|entorpecente|11\.343|associacao para o trafico"),
        ("armas-transito", "Armas e crimes de trânsito", "Legislação especial", r"arma de fogo|municao|10\.826|desarmamento|crimes? de transito|embriaguez ao volante|9\.503"),
        ("administracao", "Crimes contra a administração pública", "Legislação especial", r"peculato|corrupcao|concussao|prevaricacao|desacato|fraude (em|a) licitac|crimes? contra a administracao|contrabando|descaminho"),
        ("economicos", "Crimes econômicos, tributários e lavagem", "Legislação especial", r"lavagem|sonegacao|crimes? (tributari|contra a ordem tributaria)|8\.137|apropriacao indebita (tributaria|previdenciaria)|evasao de divisas|sistema financeiro nacional|7\.492"),
        ("orcrim", "Organização criminosa", "Legislação especial", r"organizacao criminosa|12\.850|associacao criminosa|milicia"),
        ("ambientais-penal", "Crimes ambientais", "Legislação especial", r"crimes? ambienta|9\.605"),
    ],
    "proc-penal": [
        ("acao-penal", "Denúncia, ação penal e trancamento", "Investigação e ação penal", r"denuncia|queixa|acao penal|inepcia|justa causa|trancamento|inquerito policial|investigacao"),
        ("acordos", "ANPP, transação e colaboração premiada", "Investigação e ação penal", r"\banpp\b|acordo de nao persecucao|transacao penal|suspensao condicional do processo|colaboracao premiada|delacao"),
        ("competencia-pp", "Competência", "Investigação e ação penal", r"competencia|conflito de competencia|justica (federal|estadual|militar|eleitoral)|foro por prerrogativa"),
        ("prisoes", "Prisões e medidas cautelares", "Medidas cautelares", r"prisao preventiva|prisao em flagrante|prisao domiciliar|medidas? cautelar|custodia cautelar|excesso de prazo|audiencia de custodia|liberdade provisoria|\bfianca\b|monitoramento eletronico"),
        ("provas-pp", "Provas, buscas e interceptações", "Provas", r"\bprovas?\b|busca (pessoal|domiciliar|veicular)|ingresso (em|no) domicilio|fundada suspeita|interceptacao|quebra de sigilo|cadeia de custodia|confissao|ilicit|celular|dados telematicos"),
        ("reconhecimento", "Reconhecimento de pessoas", "Provas", r"reconhecimento (pessoal|fotografico|de pessoas)|art\. 226"),
        ("nulidades-pp", "Nulidades e direito de defesa", "Procedimento", r"nulidade|cerceamento de defesa|defesa tecnica|ampla defesa|contraditorio|citacao|intimacao|interrogatorio|emendatio|mutatio"),
        ("juri", "Tribunal do Júri", "Procedimento", r"\bjuri\b|pronuncia|quesit|conselho de sentenca|plenario"),
        ("hc", "Habeas corpus", "Recursos e ações", r"habeas corpus|writ|ordem de oficio|constrangimento ilegal"),
        ("recursos-pp", "Recursos e revisão criminal", "Recursos e ações", r"revisao criminal|recurso em sentido estrito|apelacao criminal|embargos infringentes|recurso especial criminal"),
    ],
    "trabalho": [],
}
# Assuntos amplos: só entram no selo quando nenhum assunto específico da mesma matéria se aplica.
SUB_GENERICOS = {"contratos", "obrigacoes", "resp-civil", "prescricao-civ", "negocio-juridico", "praticas", "defesa-cons", "contratos-banc",
                 "atos-proc", "provas-pc", "recurso-especial", "agravos-embargos", "servidores", "controle", "credito-trib", "revisao",
                 "dano-amb", "provas-pp", "nulidades-pp", "acao-penal", "dosimetria", "punibilidade", "sociedades", "competencia", "competencia-pp"}
SUBAREAS_RE = {a: [(k, re.compile(rx)) for k, _, _, rx in lst] for a, lst in SUBAREAS.items()}
RE_CLASSE_SEG = re.compile(r"^(agravo|agravos|recurso|recursos|embargos|habeas corpus|mandado de seguranca|conflito|peticao|reclamacao|acao rescisoria|proposta de afetacao|questao de ordem|pedido|incidente|tutela provisoria|medida cautelar)\b[^.]{0,110}$")


def _texto_sub(em: str) -> str:
    cab = sem_acento((em or "").split("\n", 1)[0][:900])
    segs = re.split(r"[.;]\s+", cab)
    fora = [s for i, s in enumerate(segs) if not (_segmento_rotulo(s) or (i < 4 and RE_CLASSE_SEG.match(s.strip())))]
    return ". ".join(fora)[:700]


def subareas(texto_norm: str, areas: list[str], limite: int = 4) -> list[str]:
    """Assuntos específicos de cada matéria (até três por matéria); os amplos vêm por último."""
    out: list[str] = []
    for a in areas or []:
        achados = [k for k, rx in SUBAREAS_RE.get(a, []) if rx.search(texto_norm)]
        achados.sort(key=lambda k: k in SUB_GENERICOS)
        out += [f"{a}/{k}" for k in achados[:3]]
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


# O STJ publica os espelhos em arquivos mensais a partir de maio de 2022 e, para o período
# anterior, um arquivo histórico compactado (20220508.zip) com todos os acórdãos até 08/05/2022.
INICIO_MENSAIS = "2022-05"


def atualizar_espelhos(corte: str, estado: dict) -> dict:
    """Baixa os arquivos novos ou alterados e distribui os acórdãos em
    site/data/acordaos/AAAA-MM/<orgao>.json, pelo mês de publicação (a partir de `corte`)."""
    base = SITE_DATA / "acordaos"
    pendentes = []
    ultimos = {}
    for slug in ORGAOS:
        pac = pacote(f"espelhos-de-acordaos-{slug}")
        for r in pac["resources"]:
            d = data_recurso(r)
            nome = nome_recurso(r).lower()
            versao = r.get("last_modified") or r.get("metadata_modified") or r.get("created")
            if nome.endswith(".zip"):
                # Arquivo histórico: processado uma vez para cada início de acervo.
                chave = f"{r['id']}|{corte}"
                if corte < INICIO_MENSAIS and estado.get(chave) != versao:
                    pendentes.append((slug, r, versao, chave))
                continue
            if not d or not nome.endswith(".json"):
                continue
            ultimos[slug] = max(ultimos.get(slug, ""), d)
            if f"{d[:4]}-{d[4:6]}" < corte:
                continue
            if estado.get(r["id"]) == versao:
                continue
            pendentes.append((slug, r, versao, r["id"]))
    log(f"Espelhos: {len(pendentes)} arquivo(s) novo(s) ou alterado(s).")

    def processar(item):
        slug, r, versao, chave = item
        bruto = baixar(r["url"], timeout=1800)
        if nome_recurso(r).lower().endswith(".zip"):
            registros = []
            with zipfile.ZipFile(io.BytesIO(bruto)) as z:
                for info in z.infolist():
                    # Cada arquivo interno cobre um período e leva a data final no nome (ex.: 20201231.json).
                    fim = re.search(r"(\d{8})", info.filename)
                    if not info.filename.lower().endswith(".json") or (fim and f"{fim.group(1)[:4]}-{fim.group(1)[4:6]}" < corte):
                        continue
                    dados = _json_tolerante(z.read(info).decode("utf-8-sig"))
                    if isinstance(dados, dict):
                        dados = next((v for v in dados.values() if isinstance(v, list)), [])
                    registros.extend(x for x in dados if isinstance(x, dict))
            registros = [x for x in registros if (data_br_para_iso(x.get("dataPublicacao")) or data_compacta_para_iso(x.get("dataDecisao")))[:7] >= corte]
            log(f"  arquivo histórico de {ORGAOS[slug]}: {len(registros)} acórdãos a partir de {corte}")
            return slug, r, versao, chave, registros
        return slug, r, versao, chave, _json_tolerante(bruto.decode("utf-8-sig"))

    # Agrupa em memória por (mês, órgão) e grava ao final de cada arquivo.
    # Um arquivo defeituoso não interrompe os demais; é tentado de novo na próxima execução.
    falhas = []
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {ex.submit(processar, p): p for p in pendentes}
        for f in as_completed(futs):
            try:
                slug, r, versao, chave, registros = f.result()
            except Exception as e:  # noqa: BLE001
                slug, r, _, _ = futs[f]
                falhas.append(f"{ORGAOS[slug]} {nome_recurso(r)}: {e}")
                log(f"  ! {ORGAOS[slug]} {nome_recurso(r)}: {e}")
                continue
            por_mes: dict[str, dict] = {}
            for reg in registros:
                t = limpar_vazios(transformar_espelho(reg, slug))
                if not t.get("id"):
                    continue
                mes = (t.get("dj") or t.get("dd") or "")[:7]
                if not re.fullmatch(r"\d{4}-\d{2}", mes) or mes < corte:
                    continue
                por_mes.setdefault(mes, {})[str(t["id"])] = enriquecer(t)
            for mes, novos in por_mes.items():
                arq = base / mes / f"{slug}.json"
                atuais = {str(x["id"]): x for x in ler_json(arq, [])}
                atuais.update(novos)
                lista = sorted(atuais.values(), key=lambda x: (x.get("dj", ""), x.get("id", 0)), reverse=True)
                gravar_json(arq, lista)
            estado[chave] = versao
            log(f"  + {ORGAOS[slug]} {nome_recurso(r)}: {sum(len(v) for v in por_mes.values())} acórdãos no acervo")
    if falhas:
        estado["_falhas_espelhos"] = falhas[:20]
    else:
        estado.pop("_falhas_espelhos", None)
    return ultimos


def _json_tolerante(txt: str):
    """Lê o JSON do STJ; se houver defeito pontual (vírgula ausente entre registros), recupera registro a registro."""
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        pass
    try:
        return json.loads(re.sub(r"\}\s*\n(\s*)\{", r"},\n\1{", txt))
    except json.JSONDecodeError:
        pass
    dec, out = json.JSONDecoder(), []
    i = txt.find("[") + 1
    n = len(txt)
    while i < n:
        while i < n and txt[i] in " \t\r\n,":
            i += 1
        if i >= n or txt[i] == "]":
            break
        try:
            obj, i = dec.raw_decode(txt, i)
            out.append(obj)
        except json.JSONDecodeError:
            prox = txt.find("\n{", i + 1)  # descarta o trecho corrompido e segue para o próximo registro
            if prox < 0:
                break
            i = prox + 1
    if not out:
        raise ValueError("arquivo JSON ilegível")
    log(f"  (arquivo com defeito de formatação: {len(out)} registro(s) recuperado(s))")
    return out


def podar_meses(corte: str) -> list[str]:
    base = SITE_DATA / "acordaos"
    if not base.exists():
        return []
    todos = sorted(p.name for p in base.iterdir() if p.is_dir() and re.fullmatch(r"\d{4}-\d{2}", p.name))
    if not todos:
        return []
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
def classe_base(cl) -> str:
    """Classe do recurso principal: "AgInt nos EDcl no AREsp" -> "AREsp" (REsp e AREsp têm numerações próprias)."""
    partes = re.split(r"\s+(?:no|na|nos|nas|em)\s+", str(cl or "").strip())
    return (partes[-1].split() or [""])[0]


def _frag(num: str) -> str:
    """Fragmento do índice de números: os dois últimos dígitos."""
    return num[-2:].rjust(2, "0")


def gerar_numeros(meses_disp: list[str]) -> dict:
    """Índice por número (e por registro) fragmentado pelos dois últimos dígitos, para que o
    navegador baixe só o pedaço de que precisa (cerca de 1% do índice) em vez do índice inteiro.
    Cada linha: [número, registro, mês, órgão, id, classe, relator, julgamento, publicação]
    (relator como posição na lista "r" do fragmento; datas como AAAAMMDD), para que o
    "Verificar petição" confira os dados citados sem baixar os arquivos mensais."""
    meses = sorted(meses_disp)
    orgs = list(ORGAOS)
    por_n: dict[str, list] = {}
    por_r: dict[str, list] = {}
    total = 0
    for mi, mes in enumerate(meses):
        for oi, slug in enumerate(orgs):
            for r in ler_json(SITE_DATA / "acordaos" / mes / f"{slug}.json", []):
                n = re.sub(r"\D", "", str(r.get("n") or ""))
                if not n:
                    continue
                reg = re.sub(r"\D", "", str(r.get("reg") or ""))
                por_n.setdefault(_frag(n), []).append([n, reg, mi, oi, r.get("id"), classe_base(r.get("cl")),
                                                       str(r.get("rel") or "").strip(),
                                                       (r.get("dd") or "").replace("-", ""), (r.get("dj") or "").replace("-", "")])
                if reg:
                    por_r.setdefault(_frag(reg), []).append([reg, n])
                total += 1
    pasta = SITE_DATA / "numeros"
    if pasta.exists():
        shutil.rmtree(pasta)
    for k in (f"{i:02d}" for i in range(100)):
        linhas = por_n.get(k, [])
        rels = sorted({x[6] for x in linhas})
        pos = {nome: i for i, nome in enumerate(rels)}
        for x in linhas:
            x[6] = pos[x[6]]
        gravar_json(pasta / f"n{k}.json", {"m": meses, "o": orgs, "r": rels, "l": linhas})
        gravar_json(pasta / f"r{k}.json", {"l": sorted({tuple(x) for x in por_r.get(k, [])})})
    (SITE_DATA / "numeros.json").unlink(missing_ok=True)  # índice único antigo (32 MB)
    log(f"Números de processo indexados: {total} (100 fragmentos).")
    return {"v": 3, "n": total}


# --------------------------------------------------------------------------
# 6a'. Acórdãos mais recentes de cada órgão, para a tela inicial da Pesquisa
#      (sem baixar os arquivos mensais completos).
# --------------------------------------------------------------------------
RECENTES_POR_ORGAO = 40


def gerar_recentes(meses_disp: list[str]) -> int:
    ultimos = sorted(meses_disp)[-2:]
    lista = []
    for slug in ORGAOS:
        regs = []
        for mes in ultimos:
            regs += [r for r in ler_json(SITE_DATA / "acordaos" / mes / f"{slug}.json", []) if r.get("s", 0) > -2]
        regs.sort(key=lambda r: (r.get("dj", ""), r.get("s", 0)), reverse=True)
        lista += regs[:RECENTES_POR_ORGAO]
    lista.sort(key=lambda r: (r.get("dj", ""), r.get("s", 0)), reverse=True)
    gravar_json(SITE_DATA / "recentes.json", lista)
    log(f"Recentes da Pesquisa: {len(lista)} acórdãos ({', '.join(ultimos)}).")
    return len(lista)


# --------------------------------------------------------------------------
# 6a''. Resumo da página inicial: só o que o painel mostra (movimentações dos
#       repetitivos, pautas relevantes e destaques do último mês), para que a
#       abertura do site não dependa dos arquivos completos.
# --------------------------------------------------------------------------
def gerar_painel() -> int:
    hoje = HOJE.isoformat()
    desde = (HOJE - dt.timedelta(days=31)).isoformat()
    temas = ler_json(SITE_DATA / "temas.json", [])
    idx = {f"{x.get('tp')}-{x.get('n')}": x for x in temas}
    evs = []
    for x in temas:
        for campo, k, txt in (("afet", "afet", "Afetado ao rito"), ("julg", "julg", "Julgado"), ("pub", "pub", "Acórdão publicado")):
            if (x.get(campo) or "") >= desde:
                evs.append({"d": x[campo], "k": k, "tp": x.get("tp"), "n": x.get("n"), "txt": txt})
    for h in ler_json(SITE_DATA / "historico_temas.json", []):
        if (h.get("d") or "") < desde or f"{h.get('tp')}-{h.get('n')}" not in idx:
            continue
        ev = h.get("ev")
        txt = f"Situação: {h.get('de')} → {h.get('para')}" if ev == "situacao" else "Incluído na base" if ev == "novo" else "Tese firmada registrada" if ev == "tese" else "Tese alterada"
        evs.append({"d": h["d"], "k": "mud", "tp": h.get("tp"), "n": h.get("n"), "txt": txt})
    vistos, ev_ok = set(), []
    for e in sorted(evs, key=lambda e: (e["d"], e["n"] or 0), reverse=True):
        chave = (e["k"], e["tp"], e["n"], e["d"], e["txt"])
        if chave in vistos:
            continue
        vistos.add(chave)
        x = idx.get(f"{e['tp']}-{e['n']}", {})
        e.update(limpar_vazios({"tese": (x.get("tese") or "")[:400], "q": (x.get("q") or "")[:400]}))
        ev_ok.append(e)
    lim = (HOJE + dt.timedelta(days=21)).isoformat()
    pautas = [limpar_vazios({"d": p.get("d"), "o": p.get("o"), "p": p.get("p"), "pet": p.get("pet"), "rel": p.get("rel"), "temas": p.get("temas")})
              for p in ler_json(SITE_DATA / "pautas.json", [])
              if hoje <= (p.get("d") or "") <= lim and (p.get("temas") or re.search(r"secao|especial", p.get("o") or ""))]
    dest = ler_json(SITE_DATA / "destaques.json", [])
    mes = (dest[0].get("dj") or "")[:7] if dest else ""
    do_mes, chaves = [], set()
    for r in dest:
        if not (r.get("dj") or "").startswith(mes):
            continue
        k = f"{r.get('o')}|{r.get('dd') or ''}|{(r.get('em') or r.get('h') or '')[:400]}"
        if k in chaves:
            continue
        chaves.add(k)
        do_mes.append(r)
    top = sorted(do_mes, key=lambda r: -r.get("s", 0))[:3]
    gravar_json(SITE_DATA / "painel.json", {"em": hoje, "ev": ev_ok, "pautas": pautas, "dest": {"mes": mes, "n": len(do_mes), "top": top}})
    log(f"Resumo do painel: {len(ev_ok)} movimentações, {len(pautas)} pautas, {len(do_mes)} destaques ({mes}).")
    return 1


# --------------------------------------------------------------------------
# 6b. Índice da pesquisa por palavras: para cada palavra (sem acento, como
#     aparece no texto), os arquivos mensais (mês e órgão) em que ela aparece. Assim o
#     navegador baixa só os arquivos que podem conter o termo pesquisado. As
#     palavras presentes em boa parte do acervo ficam marcadas como "*" (não
#     reduzem a busca). A leitura de cada mês é guardada em cache e só se
#     refaz quando o arquivo muda.
# --------------------------------------------------------------------------
BUSCA_VERSAO = 2
BUSCA_BASE = 2000
BUSCA_FREQ = 0.5
_RE_TOK = re.compile(r"[a-z0-9]+")


def _norm_js(s: str) -> str:
    """Mesma normalização do site: decompõe, retira os acentos e passa a minúsculas."""
    return re.sub(r"[\u0300-\u036f]", "", unicodedata.normalize("NFD", s or "")).lower()


def _chaves_busca(lista: list) -> list[str]:
    vistos, chaves = set(), set()
    for r in lista:
        partes = [r.get(k) for k in ("em", "tese", "tj", "tema", "notas", "info")] + [" ".join(map(str, r.get("leg") or []))]
        txt = _norm_js("\n".join(",".join(map(str, x)) if isinstance(x, list) else str(x or "") for x in partes))
        for w in _RE_TOK.findall(txt):
            if w in vistos:
                continue
            vistos.add(w)
            if len(w) >= 3 and not any(c.isdigit() for c in w):
                chaves.add(w)
    return sorted(chaves)


def _facetas_busca(lista: list) -> dict:
    """Relatores, classes e matérias presentes num arquivo mensal (para os filtros da Pesquisa)."""
    rel, cls, mat = {}, {}, set()
    for r in lista:
        if r.get("rel"):
            k = _norm_js(r["rel"])
            rel.setdefault(k, [r["rel"], 0])[1] += 1
        if r.get("cl"):
            k = _norm_js(r["cl"])
            cls.setdefault(k, [r["cl"], 0])[1] += 1
        mat.update(r.get("ar") or [])
        mat.update(r.get("sa") or [])
    return {"r": rel, "c": cls, "m": sorted(mat)}


def _posting(ids: list[int]) -> str:
    ids, out, ant_id = sorted(ids), [], 0
    for x in ids:
        out.append(_b36(x - ant_id))
        ant_id = x
    return ".".join(out)


def _b36(n: int) -> str:
    dig = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while True:
        n, r = divmod(n, 36)
        out = dig[r] + out
        if not n:
            return out


def gerar_indice_busca(meses_disp: list[str]) -> dict:
    orgs = list(ORGAOS)
    pasta_cache = CACHE / "busca"
    pasta_cache.mkdir(parents=True, exist_ok=True)
    inv: dict[str, list[int]] = {}
    facR: dict[str, list] = {}
    facC: dict[str, list] = {}
    facM: dict[str, list[int]] = {}
    n_arq, lidos = 0, 0
    for mes in sorted(meses_disp):
        a, m = int(mes[:4]), int(mes[5:7])
        base_id = ((a - BUSCA_BASE) * 12 + m - 1) * len(orgs)
        arq_cache = pasta_cache / f"{mes}.json.gz"
        try:
            ant = json.loads(gzip.decompress(arq_cache.read_bytes())) if arq_cache.exists() else {}
        except Exception:  # noqa: BLE001
            ant = {}
        if ant.get("_v") != BUSCA_VERSAO:
            ant = {}
        novo, mudou = {"_v": BUSCA_VERSAO}, False
        for i, slug in enumerate(orgs):
            arq = SITE_DATA / "acordaos" / mes / f"{slug}.json"
            if not arq.exists():
                continue
            bruto = arq.read_bytes()
            h = hashlib.md5(bruto).hexdigest()
            velho = ant.get(slug) or {}
            if velho.get("h") == h and "f" in velho:
                chaves, fac = velho["k"], velho["f"]
            else:
                lista = json.loads(bruto)
                chaves = velho["k"] if velho.get("h") == h else _chaves_busca(lista)
                fac = _facetas_busca(lista)
                mudou, lidos = True, lidos + 1
            novo[slug] = {"h": h, "k": chaves, "f": fac}
            sid = base_id + i
            for k in chaves:
                inv.setdefault(k, []).append(sid)
            for k, (nome, n) in fac["r"].items():
                e = facR.setdefault(k, [nome, 0, []]); e[1] += n; e[2].append(sid)
            for k, (nome, n) in fac["c"].items():
                e = facC.setdefault(k, [nome, 0, []]); e[1] += n; e[2].append(sid)
            for k in fac["m"]:
                facM.setdefault(k, []).append(sid)
            n_arq += 1
        if mudou or set(novo) != set(ant):
            arq_cache.write_bytes(gzip.compress(json.dumps(novo, ensure_ascii=False, separators=(",", ":")).encode(), compresslevel=6, mtime=0))
    # Apaga o cache de meses que saíram do acervo.
    for f in pasta_cache.glob("*.json.gz"):
        if f.name[:7] not in meses_disp:
            f.unlink()
    limite = max(1, int(n_arq * BUSCA_FREQ))
    por_pref: dict[str, dict] = {}
    frequentes = 0
    for k, ids in inv.items():
        if len(ids) > limite:
            v, frequentes = "*", frequentes + 1
        else:
            ids.sort()
            v, ant_id = [], 0
            for x in ids:
                v.append(_b36(x - ant_id))
                ant_id = x
            v = ".".join(v)
        por_pref.setdefault(k[:2], {})[k] = v
    # Partes grandes são divididas pela letra seguinte, para o navegador baixar pouco por palavra.
    fila, final = list(por_pref.items()), {}
    while fila:
        pref, d = fila.pop()
        tam = sum(len(k) + len(v) + 6 for k, v in d.items())
        if tam <= 120_000 or len(pref) >= 5:
            final[pref] = d
            continue
        sub: dict[str, dict] = {}
        for k, v in d.items():
            sub.setdefault(k[: len(pref) + 1] if len(k) > len(pref) else pref + "_", {})[k] = v
        fila.extend(sub.items())
    por_pref = final
    pasta = SITE_DATA / "busca"
    pasta.mkdir(exist_ok=True)
    for f in pasta.glob("*.json"):
        if f.stem not in por_pref and not f.stem.startswith("_"):
            f.unlink()
    total = 0
    for pref, d in por_pref.items():
        total += gravar_json(pasta / f"{pref}.json", d) or 0
    # Filtros de relator, classe e matéria: em que arquivos mensais cada valor aparece.
    gravar_json(pasta / "_r.json", {k: [v[0], v[1], _posting(v[2])] for k, v in facR.items()})
    gravar_json(pasta / "_c.json", {k: [v[0], v[1], _posting(v[2])] for k, v in facC.items()})
    gravar_json(pasta / "_m.json", {k: _posting(v) for k, v in facM.items()})
    log(f"Índice de busca: {len(inv)} palavras em {n_arq} arquivos ({lidos} relidos; {frequentes} frequentes); {len(por_pref)} partes.")
    return {"v": BUSCA_VERSAO, "base": BUSCA_BASE, "orgs": orgs, "de": min(meses_disp, default=""), "ate": max(meses_disp, default=""), "arquivos": n_arq, "palavras": len(inv), "partes": sorted(por_pref), "facetas": 1}


# --------------------------------------------------------------------------
# 7. Súmulas do STJ. Base: extração guardada em fontes/sumulas-fonte.json (com
#    o ramo do direito de cada enunciado). A cada execução, confere o PDF
#    oficial de verbetes (arquivo estático do SCON) e acrescenta enunciados
#    novos e cancelamentos, guardados em .cache/sumulas-novas.json.
# --------------------------------------------------------------------------
SUMULAS_FONTE = RAIZ / "fontes" / "sumulas-fonte.json"
SUMULAS_NOVAS = CACHE / "sumulas-novas.json"
RAMO_AREA = [
    ("proc-penal", r"processual penal"), ("proc-civil", r"processual civil"), ("penal", r"penal"),
    ("tributario", r"tributario"), ("administrativo", r"administrativo"), ("bancario", r"bancario"),
    ("previdenciario", r"previdenciario"), ("consumidor", r"consumidor"), ("empresarial", r"empresarial"),
    ("familia", r"crianca e do adolescente"), ("ambiental", r"ambiental"), ("civil", r"direito civil"),
]
ASSUNTO_FAMILIA = re.compile(r"alimentos|paternidade|divorcio|regime de bens|uniao estavel|guarda|sucess|prisao civil")
RE_CIT_SUM = re.compile(r"\((?:S[ÚU]MULA \d+, )?(CORTE ESPECIAL|PRIMEIRA SE[ÇC][ÃA]O|SEGUNDA SE[ÇC][ÃA]O|TERCEIRA SE[ÇC][ÃA]O)[^()]*\)")
ORG_SUM = {"CORTE ESPECIAL": "Corte Especial", "PRIMEIRA SECAO": "Primeira Seção", "SEGUNDA SECAO": "Segunda Seção", "TERCEIRA SECAO": "Terceira Seção"}


SUMULAS_PDF = "https://scon.stj.jus.br/docs_internet/jurisprudencia/tematica/download/SU/Verbetes/VerbetesSTJ.pdf"


def _pdf_linhas(conteudo: bytes) -> list[tuple[float, str]]:
    """Linhas de texto de um PDF, com a margem esquerda de cada uma."""
    import pdfplumber  # dependência instalada no fluxo do GitHub Actions
    out = []
    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        for pg in pdf.pages:
            for ln in pg.extract_text_lines():
                t = (ln.get("text") or "").strip()
                if t:
                    out.append((float(ln.get("x0") or 0), t))
    return out


def _juntar(linhas: list[str]) -> str:
    """Une linhas quebradas pela diagramação, preservando palavras hifenizadas."""
    out = ""
    for t in linhas:
        if not out:
            out = t
        elif re.search(r"[A-Za-zÀ-ÿ]-$", out) and t[:1].islower():
            out += t
        else:
            out += " " + t
    return out


SUMULAS_RAMOS_PDF = "https://scon.stj.jus.br/docs_internet/jurisprudencia/tematica/download/SU/RamosDoDireito/SumulasSTJ_Ramos.pdf"


def _ramos_sumulas_pdf() -> dict[int, str]:
    """Ramo e assunto de cada súmula, lidos do sumário do PDF oficial organizado por ramo do direito."""
    import pdfplumber
    bruto = baixar(SUMULAS_RAMOS_PDF, tentativas=2, timeout=300)
    if not bruto.startswith(b"%PDF"):
        raise RuntimeError("resposta sem PDF")
    mapa, atual = {}, None
    with pdfplumber.open(io.BytesIO(bruto)) as pdf:
        for pg in pdf.pages[:80]:  # o sumário ocupa as primeiras páginas
            achou = False
            for ln in (pg.extract_text() or "").split("\n"):
                ln = ln.strip()
                s_ = re.match(r"^S[úu]mula (\d+)\s+\d+$", ln)
                r_ = re.match(r"^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ ,/()-]+ - .+?)\s+\d+$", ln)
                if s_ and atual:
                    mapa.setdefault(int(s_.group(1)), atual)
                    achou = True
                elif r_:
                    atual, achou = r_.group(1).strip(), True
            if not achou and mapa:
                break
    return mapa


def _coletar_sumulas_pdf() -> dict[int, dict]:
    """Enunciados publicados no PDF oficial de verbetes (arquivo estático do SCON)."""
    bruto = baixar(SUMULAS_PDF, tentativas=2, timeout=120)
    if not bruto.startswith(b"%PDF"):
        raise RuntimeError("resposta sem PDF")
    out, atual = {}, None
    for _, t in _pdf_linhas(bruto):
        m = re.match(r"^\S?\s*S[ÚU]MULA (\d+)$", t)
        if m:
            atual = {"n": int(m.group(1)), "l": [], "canc": False}
            out[atual["n"]] = atual
            continue
        if atual is None or t == "VEJA MAIS" or re.match(r"^scon\.stj\.jus\.br/", t) or t.startswith("Enunciados das") or t == "Súmulas do STJ":
            continue
        if t in ("(SÚMULA CANCELADA)", "(SÚMULA ALTERADA)"):
            atual["canc"] = atual["canc"] or "CANCELADA" in t
            continue
        t = re.sub(r"^\(S[ÚU]MULA (?:ALTERADA|CANCELADA)\)\s*", "", t)
        atual["l"].append(t)
    return {n: {"n": n, "txt": re.sub(r"\s+", " ", _juntar(x["l"])).strip(), "canc": x["canc"]} for n, x in out.items() if x["l"]}


def atualizar_sumulas() -> dict:
    fonte = ler_json(SUMULAS_FONTE, {})
    brutas = [dict(x) for x in fonte.get("sumulas", [])]
    coletado = fonte.get("coletadoEm", "")
    # Enunciados obtidos do PDF em execuções anteriores (guardados no cache do Actions).
    extras = ler_json(SUMULAS_NOVAS, {})
    ext = extras.get("sumulas", {}) if isinstance(extras, dict) else {}
    por_n = {x.get("n"): x for x in brutas}
    for k, x in ext.items():
        por_n[int(k)] = {**x, "ramo": (por_n.get(int(k)) or {}).get("ramo") or x.get("ramo", "")}
    coletado = max(coletado, extras.get("em", "") if isinstance(extras, dict) else "")
    verificado = ""
    try:
        pdf = _coletar_sumulas_pdf()
        if len(pdf) < 0.9 * max(len(por_n), 1):
            raise RuntimeError(f"apenas {len(pdf)} enunciados lidos")
        novas, canceladas = 0, 0
        for n, x in pdf.items():
            ja = por_n.get(n)
            if not ja:
                por_n[n] = ext[str(n)] = {"n": n, "ramo": "", "txt": x["txt"]}
                novas += 1
            elif x["canc"] and "cancel" not in sem_acento(ja.get("txt") or "").lower():
                ja["txt"] = x["txt"]
                ext[str(n)] = ja
                canceladas += 1
        verificado = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        if novas or canceladas:
            coletado = verificado
            gravar_json(SUMULAS_NOVAS, {"em": verificado, "sumulas": ext})
        log(f"Súmulas: PDF oficial conferido ({len(pdf)} enunciados; {novas} nova(s), {canceladas} cancelamento(s)).")
    except Exception as e:  # noqa: BLE001
        log(f"Súmulas: PDF oficial indisponível ({e}); usando a extração de {coletado[:10] or 'arquivo local'}.")
    # Súmula nova ainda sem o ramo do direito atribuído pelo STJ: consulta o PDF das súmulas
    # organizadas por ramo (arquivo estático, grande) só nesse caso, e guarda o resultado.
    sem_ramo = [n for n, x in por_n.items() if not (x.get("ramo") or "").strip()]
    if sem_ramo:
        try:
            ramos = _ramos_sumulas_pdf()
            achados = 0
            for n in sem_ramo:
                if ramos.get(n):
                    por_n[n]["ramo"] = ramos[n]
                    ext[str(n)] = por_n[n]
                    achados += 1
            if achados:
                gravar_json(SUMULAS_NOVAS, {"em": coletado, "sumulas": ext})
            log(f"Súmulas: ramo do direito obtido para {achados} de {len(sem_ramo)} enunciado(s) sem classificação.")
        except Exception as e:  # noqa: BLE001
            log(f"Súmulas: PDF por ramo do direito indisponível ({e}); a matéria fica deduzida pelo texto.")
    brutas = sorted(por_n.values(), key=lambda x: -(x.get("n") or 0))
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
        if not ar:  # enunciado novo, ainda sem o ramo do direito atribuído pelo STJ
            ar = _areas_por_termos(sem_acento(enunciado), ORG_NOME.get(sem_acento(org).upper(), ""))
        sa = subareas(f"{an} {sem_acento(enunciado)}", ar)
        lista.append(limpar_vazios({"n": x.get("n"), "ramo": ramo.title().replace(" Do ", " do ").replace(" Da ", " da ").replace(" E ", " e "),
            "ass": assunto.capitalize(), "t": enunciado, "nota": nota, "org": org, "julg": julg, "pub": pub, "sit": sit, "ar": ar, "sa": sa}))
    lista.sort(key=lambda s: -(s.get("n") or 0))
    gravar_json(SITE_DATA / "sumulas.json", lista)
    vig = sum(1 for s in lista if s.get("sit") != "cancelada")
    log(f"Súmulas: {len(lista)} ({vig} vigentes).")
    return {"n": len(lista), "vigentes": vig, "coletadoEm": coletado, "verificadoEm": verificado, "ultima": max((s.get("n") or 0 for s in lista), default=0)}


# --------------------------------------------------------------------------
# 8. Informativo de Jurisprudência do STJ (curadoria oficial do Tribunal).
#    Base: extrações guardadas em fontes/. A cada execução, procura as edições
#    seguintes no PDF oficial (arquivo estático do SCON), converte as notas e
#    guarda o resultado em .cache/informativos-novos.json.
# --------------------------------------------------------------------------
INFO_FONTE = RAIZ / "fontes" / "informativos-fonte.json"
MESES_PT = {m: i + 1 for i, m in enumerate("janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro".split())}
RAMO_INFO = [
    ("proc-penal", r"processual penal"), ("proc-civil", r"processual civil"), ("penal", r"direito penal"),
    ("tributario", r"tributario"), ("administrativo", r"administrativo"), ("bancario", r"bancario"),
    ("penal", r"execucao penal"),
    ("previdenciario", r"previdenciario"), ("consumidor", r"consumidor"), ("empresarial", r"empresarial|falimentar|recuperacao|marcario|propriedade industrial|societario"),
    ("familia", r"crianca e do adolescente|familia|sucess"), ("ambiental", r"ambiental"), ("civil", r"direito civil|registral|notarial|autoral|digital"),
    ("trabalho", r"trabalho"),
]
RE_PROC_INFO = re.compile(r"((?:[A-Z][A-Za-z]*\s(?:no|na|nos|nas|em)\s)*[A-Z][A-Za-z]+)\s(\d{1,3}(?:\.\d{3})+|\d+)-([A-Z]{2})\b")


def _itens_info(t: str) -> str:
    """Separa em linhas os itens numerados colados no texto ("...anular.2. É")."""
    t = re.sub(r"(?<=[.;:])\s*(?=(?:\d{1,2}|[IVX]{1,4})[.)]\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ])", "\n", (t or "").strip())
    return re.sub(r"\n{2,}", "\n", t)


def _data_pt(txt: str) -> str:
    """Última data por extenso do texto ("18 a 29 de junho de 2012", "1º de junho de 2012")."""
    t = sem_acento(txt or "").replace("º", "").replace("°", "")
    ms = re.findall(r"(\d{1,2})o? (?:de )?([a-z]+)(?: de (\d{4}))?", t)
    ano = re.findall(r"\b((?:19|20)\d{2})\b", t)
    for d, mes, a in reversed(ms):
        if mes in MESES_PT and (a or ano):
            return f"{a or ano[-1]}-{MESES_PT[mes]:02d}-{int(d):02d}"
    return ""


INFO_PDF = "https://scon.stj.jus.br/docs_internet/informativos/PDF/Inf{:04d}.pdf"
INFO_NOVOS = CACHE / "informativos-novos.json"
_ROT_INFO = [("Processo", "PROCESSO"), ("Ramo do Direito", "RAMO DO DIREITO"), ("Tema", "TEMA")]
_SEC_INFO = re.compile(r"^(?:RECURSOS? REPETITIVOS?.*|CORTE ESPECIAL|(?:PRIMEIRA|SEGUNDA|TERCEIRA) SE[ÇC][ÃA]O|(?:PRIMEIRA|SEGUNDA|TERCEIRA|QUARTA|QUINTA|SEXTA) TURMA|PROPOSTA DE .*|S[ÚU]MULAS?(?: .*)?|INCIDENTE DE .*|PLEN[ÁA]RIO|PRESID[ÊE]NCIA)$")
_ADIC_INFO = {"LEGISLAÇÃO": "Legislação", "PRECEDENTES QUALIFICADOS": "Precedentes Qualificados", "SÚMULAS": "Súmulas",
              "JURISPRUDÊNCIA EM TESES": "Jurisprudência em Teses", "DOUTRINA": "Doutrina", "ENUNCIADOS": "Enunciados"}


def _ler_informativo_pdf(num: int, conteudo: bytes) -> dict | None:
    """Converte o PDF oficial de uma edição do Informativo nas notas usadas pelo site."""
    linhas = _pdf_linhas(conteudo)
    if not linhas:
        return None
    cab, ini = None, 0
    for ini, (_, t) in enumerate(linhas[:8]):
        cab = re.search(r"(?:N[úu]mero|n\.)\s*(\d+)\s+(?:Bras[íi]lia,\s*)?(\d{1,2}º? de [a-zç]+ de \d{4})", t)
        if cab:
            break
    if not cab or int(cab.group(1)) != num:
        return None
    ruido = re.compile(r"^(?:Informativo|de Jurisprud[êe]ncia|(?:V[ÍI]DEO DO JULGAMENTO|[ÁA]UDIO DO TEXTO)(?:\s+(?:V[ÍI]DEO DO JULGAMENTO|[ÁA]UDIO DO TEXTO))*|Informativo de Jurisprud[êe]ncia n\. \d+ .*|N[úu]mero \d+ Bras[íi]lia,.*)$")
    linhas = [linhas[ini]] + [(x, re.sub(r"\s*(?:V[ÍI]DEO DO JULGAMENTO|[ÁA]UDIO DO TEXTO)\s*", " ", t).strip()) for x, t in linhas[ini + 1:] if not ruido.match(t)]
    linhas = [(x, t) for x, t in linhas if t]
    notas, nota, campo, sec, sub = [], None, None, "", None

    def fechar():
        if not nota:
            return
        x = {"sec": nota["sec"]}
        for k, _ in _ROT_INFO:
            x[k] = _juntar(nota.get(k, []))
        for k in ("destaque", "teor"):
            pars, atual, ant = [], [], None
            for x0, t in nota.get(k, []):
                if atual and ant is not None and x0 > ant + 20:  # recuo de primeira linha: novo parágrafo
                    pars.append(_juntar(atual))
                    atual = []
                atual.append(t)
                ant = x0
            if atual:
                pars.append(_juntar(atual))
            x[k] = "\n".join(pars)
        x["adic"] = "\n".join(f"{r} {_juntar(v)}" for r, v in nota.get("adic", []) if v)
        notas.append({k: v for k, v in x.items() if v})

    def rotulo_proc(t):
        return t == "PROCESSO" or (t.startswith("PROCESSO ") and bool(re.search(r"\d|Rel\.|segredo", t, re.I)))

    def titulo(t):
        return t == t.upper() and len(re.findall(r"[A-ZÀ-Ý]", t)) >= 5 and not t.startswith(("PROCESSO", "RAMO DO DIREITO", "TEMA ")) \
            and t not in ("DESTAQUE", "INFORMAÇÕES DO INTEIRO TEOR", "INFORMAÇÕES ADICIONAIS", "SAIBA MAIS") and t not in _ADIC_INFO

    pular = 0
    for i, (x0, t) in enumerate(linhas[1:], 1):
        if pular:
            pular -= 1
            continue
        if t.startswith("Este periódico destaca"):
            continue
        prox = linhas[i + 1][1] if i + 1 < len(linhas) else ""
        prox2 = linhas[i + 2][1] if i + 2 < len(linhas) else ""
        # Depois de "Saiba mais" e das informações adicionais há listas em maiúsculas
        # (ramos da Jurisprudência em Teses): ali só vale um nome de seção conhecido.
        livre = campo not in ("saiba", "adic") and nota is not None
        sec1 = titulo(t) and rotulo_proc(prox) and (livre or _SEC_INFO.match(t))
        sec2 = titulo(t) and titulo(prox) and rotulo_proc(prox2) and (livre or (_SEC_INFO.match(f"{t} {prox}") and not _SEC_INFO.match(prox)))
        if nota is None and not sec:
            sec1 = sec1 or (titulo(t) and rotulo_proc(prox))
        if sec1 or sec2:
            fechar()
            nota, campo, sec = None, None, t if sec1 else f"{t} {prox}"
            pular = 0 if sec1 else 1
            continue
        if re.match(r"^S[ÚU]MULAS?$", t) and re.match(r"^S[ÚU]MULA N", prox):
            fechar()
            nota, campo, sec = None, None, t
            continue
        if sec.startswith(("SÚMULA", "SUMULA")) and re.match(r"^S[ÚU]MULA N\. ?\d+", t):
            fechar()  # enunciado aprovado, revisado ou cancelado: o texto vem logo abaixo
            nota, campo = {"sec": sec, "Tema": [t[:1] + t[1:].lower().replace("n. ", "n. ")]}, "destaque"
            continue
        if rotulo_proc(t):
            fechar()
            nota, campo = {"sec": sec}, "Processo"
            resto = t[8:].strip()
            if resto:
                nota.setdefault(campo, []).append(resto)
            continue
        if nota is None:
            continue
        if campo in ("Processo", "Ramo do Direito") and t.startswith("RAMO DO DIREITO"):
            campo = "Ramo do Direito"
            nota.setdefault(campo, []).append(t[15:].strip())
            continue
        if campo in ("Processo", "Ramo do Direito") and (t.startswith("TEMA ") or t == "TEMA"):
            campo = "Tema"
            nota.setdefault(campo, []).append(t[4:].strip())
            continue
        if t == "DESTAQUE":
            campo = "destaque"
            continue
        if t == "INFORMAÇÕES DO INTEIRO TEOR":
            campo = "teor"
            continue
        if t == "INFORMAÇÕES ADICIONAIS":
            campo, sub = "adic", None
            continue
        if t == "SAIBA MAIS":
            campo = "saiba"
            continue
        if campo == "adic":
            if t in _ADIC_INFO or (t == t.upper() and len(re.findall(r"[A-ZÀ-Ý]", t)) >= 5 and not re.search(r"\d", t)):
                sub = [_ADIC_INFO.get(t) or t[:1] + t[1:].lower(), []]
                nota.setdefault("adic", []).append(sub)
            elif sub:
                sub[1].append(t)
            continue
        if campo in ("destaque", "teor"):
            nota.setdefault(campo, []).append((x0, t))
        elif campo and campo != "saiba":
            nota.setdefault(campo, []).append(t)
    fechar()
    if not notas:
        return None
    return {"tit": f"Informativo nº {num} {cab.group(2).strip()}.", "notas": notas}


def _coletar_informativos_pdf(desde: int) -> dict:
    """Busca as edições posteriores à última conhecida no PDF oficial (arquivo estático)."""
    out = {}
    for n in range(desde, desde + 8):
        bruto = baixar(INFO_PDF.format(n), tentativas=2, timeout=120)
        if not bruto.startswith(b"%PDF"):
            break  # edição ainda não publicada: o servidor devolve arquivo vazio
        ed = _ler_informativo_pdf(n, bruto)
        if not ed:
            log(f"Informativo: não foi possível ler o PDF da edição {n}.")
            break
        out[str(n)] = ed
    return out


INFO_FONTES_ANTIGAS = RAIZ / "fontes" / "informativos"
RE_CIT_ANTIGA = re.compile(r"((?:[A-Z][A-Za-z]*\s(?:no|na|nos|nas|em)\s)*[A-Z][A-Za-z]+ \d[\d.]*-[A-Z]{2},?\s*Rel\.\s*(?:Min|Ministr)[^;]*?julgad[oa]s?\s+em\s+\d{1,2}/\d{1,2}/\d{4})")
ORG_NOME = {sem_acento(v).upper(): k for k, v in ORGAOS.items()}


# Notas antigas não trazem o ramo do direito: deduz pela linguagem e pelo órgão.
_TERMOS_AREA = [
    ("tributario", r"tribut|imposto|icms|\biss\b|ipi\b|contribuic\w+ (social|previdenciaria)|cofins|execucao fiscal|fisco"),
    ("previdenciario", r"previdenci|\binss\b|aposentadoria|beneficio assistencial|auxilio-doenca"),
    ("administrativo", r"servidor|administracao publica|licitac|improbidade|concurso publico|desapropria|ente publico|poder publico"),
    ("ambiental", r"ambiental|meio ambiente"),
    ("consumidor", r"consumidor|\bcdc\b|fornecedor|relacao de consumo|plano de saude"),
    ("bancario", r"bancari|instituicao financeira|cedula de credito|alienacao fiduciaria|cartao de credito"),
    ("empresarial", r"falencia|recuperacao judicial|sociedade|societari|marca|patente|duplicata|cheque|nota promissoria"),
    ("familia", r"alimentos|divorcio|uniao estavel|paternidade|heranca|sucess|inventario|guarda"),
    ("proc-penal", r"habeas corpus|prisao preventiva|denuncia|acao penal|tribunal do juri|nulidade processual penal|flagrante"),
    ("penal", r"\bcrime|\bpena\b|delito|furto|roubo|trafico|homicidio|estupro|execucao penal"),
    ("proc-civil", r"\bcpc\b|recurso especial|agravo|embargos|execucao|cumprimento de sentenca|honorarios|competencia|tutela|acao rescisoria|citacao|coisa julgada"),
    ("civil", r"contrato|responsabilidade civil|dano moral|indeniza|posse|propriedade|usucapiao|condominio|locacao|seguro|prescricao"),
]
_PERMITIDAS_ORG = {"penal": {"penal", "proc-penal", "ambiental"}, "privado": {"civil", "consumidor", "bancario", "empresarial", "familia", "proc-civil"}, "publico": {"tributario", "previdenciario", "administrativo", "ambiental", "proc-civil"}}


def _areas_por_termos(t: str, slug: str) -> list[str]:
    grupo = "penal" if slug in PENAIS else "privado" if slug in PRIVADO else "publico" if slug in PUBLICO else ""
    out = [a for a, rx in _TERMOS_AREA if re.search(rx, t) and (not grupo or a in _PERMITIDAS_ORG[grupo])]
    return out[:2]


def _nota_info(num: str, i: int, x: dict, data: str) -> tuple[dict | None, list]:
    """Normaliza uma nota do Informativo (formato atual, com destaque, ou antigo, narrativo)."""
    orgao, sec = "", (x.get("sec") or "")
    if x.get("antigo"):
        tema = (x.get("tit") or "").strip()
        txt = (x.get("txt") or "").strip()
        if not txt:
            return None, []
        cits = [m.group(1) for m in RE_CIT_ANTIGA.finditer(txt)]
        proc = "; ".join(cits)
        corpo = txt
        if cits and txt.rstrip(". ").endswith(cits[-1].rstrip(". ")):
            corpo = txt[: txt.rfind(cits[0])].strip() if txt.rfind(cits[0]) > 60 else txt
        slug = ORG_NOME.get(sem_acento(sec).upper(), "")
        orgao = ORGAOS.get(slug, "")
        ar = areas_do_direito(f"{tema}. {corpo[:600]}", slug) if tema or corpo else []
        if not ar:
            ar = _areas_por_termos(sem_acento(f"{tema} {corpo[:1500]}"), slug)
        dest, teor, adic = corpo, "", ""
        ramo = ""
    else:
        proc = x.get("Processo") or ""
        ramo_n = sem_acento(x.get("Ramo do Direito") or "")
        ar = []
        for k, rx in RAMO_INFO:
            if re.search(rx, ramo_n) and k not in ar:
                ar.append(k)
        tema = (x.get("Tema") or "").strip()
        dest = _itens_info(x.get("destaque") or "")
        if not dest:
            return None, []
        teor, adic = _itens_info(x.get("teor") or ""), (x.get("adic") or "")
        ramo = re.sub(r"\b(Do|Da|Dos|Das|De|E)\b", lambda m: m.group(1).lower(), (x.get("Ramo do Direito") or "").title())
    procs, vistos_p = [], set()
    for m in RE_PROC_INFO.finditer(proc):
        n_ = re.sub(r"\D", "", m.group(2))
        if n_ not in vistos_p and not m.group(1).startswith("Tema"):
            vistos_p.add(n_)
            procs.append({"cl": m.group(1), "n": n_, "uf": m.group(3)})
    rel = re.search(r"Rel\.\s+(?:Min\.|Ministr[oa]|Desembargador[a]? convocad[oa] do [A-Z0-9]+|Juiz[a]? convocad[oa])\s+([^,]+)", proc)
    julg = re.search(r"julgad[oa]s? em (\d{1,2})/(\d{1,2})/(\d{4})", proc)
    if not orgao:
        for nome in ORGAOS.values():
            if nome in proc:
                orgao = nome
                break
    tm = re.search(r"\(Tema (\d[\d.]*)\)", proc)
    nid = f"{num}-{i + 1}"
    longo = len(dest) > 900
    reg = limpar_vazios({
        "id": nid, "ed": int(num), "d": data, "sec": sec.title().replace(" De ", " de ").replace(" Da ", " da "), "ramo": ramo,
        "ar": ar, "sa": subareas(sem_acento(f"{tema} {dest[:800]}"), ar), "tema": tema, "t": dest[:900] + ("…" if longo else ""), "lg": 1 if longo else None,
        "proc": proc[:600], "p": procs[:4], "rel": rel.group(1).strip() if rel else "", "org": orgao,
        "julg": f"{julg.group(3)}-{int(julg.group(2)):02d}-{int(julg.group(1)):02d}" if julg else "",
        "tr": int(tm.group(1).replace(".", "")) if tm else None, "an": 1 if x.get("antigo") else None,
    })
    return reg, [teor[:6000] if teor else (dest if longo else ""), adic[:800]]


def atualizar_informativos() -> dict:
    fonte = ler_json(INFO_FONTE, {})
    eds = dict(fonte.get("edicoes", {}))
    coletado, verificado = fonte.get("coletadoEm", ""), ""
    # Edições lidas do PDF oficial em execuções anteriores (guardadas no cache do Actions).
    extras = ler_json(INFO_NOVOS, {})
    for k, v in (extras.get("edicoes") or {}).items():
        eds.setdefault(k, v)
    if extras.get("em"):
        coletado = max(coletado, extras["em"])
    if eds:
        try:
            novas = _coletar_informativos_pdf(max(int(k) for k in eds) + 1)
            verificado = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
            if novas:
                eds.update(novas)
                coletado = verificado
                gravar_json(INFO_NOVOS, {"em": verificado, "edicoes": {**(extras.get("edicoes") or {}), **novas}})
                log(f"Informativo: {len(novas)} edição(ões) nova(s) lida(s) do PDF oficial ({', '.join(novas)}).")
            else:
                log("Informativo: nenhuma edição nova no STJ.")
        except Exception as e:  # noqa: BLE001
            log(f"Informativo: PDF oficial indisponível ({e}); usando a extração de {coletado[:10]}.")
    # Edições antigas, extraídas em lotes e guardadas fora do site publicado.
    for arq in sorted(INFO_FONTES_ANTIGAS.glob("*.json")) if INFO_FONTES_ANTIGAS.exists() else []:
        for k, v in ler_json(arq, {}).get("edicoes", {}).items():
            eds.setdefault(k, v)
    todas, teores = [], {}
    for num, ed in eds.items():
        data = _data_pt(ed.get("tit", ""))
        for i, x in enumerate(ed.get("notas", [])):
            reg, teor = _nota_info(num, i, x, data)
            if reg:
                todas.append(reg)
                if any(teor):
                    teores[reg["id"]] = teor
    todas.sort(key=lambda x: (-x["ed"], x["id"]))
    ultima = max((x["ed"] for x in todas), default=0)
    corte = ultima - 103  # cerca de dois anos de edições ficam no arquivo principal
    recentes = [x for x in todas if x["ed"] > corte]
    gravar_json(SITE_DATA / "informativos.json", recentes)
    pasta = SITE_DATA / "informativos"
    pasta.mkdir(exist_ok=True)
    for f in pasta.glob("*.json"):
        f.unlink()
    por_ano, teor_ano, idx = {}, {}, {}
    for x in todas:
        ano = (x.get("d") or "0000")[:4]
        idx.setdefault(x["ed"], [x["ed"], x.get("d", ""), ano, 0])[3] += 1
        if x["ed"] <= corte:
            por_ano.setdefault(ano, []).append(x)
        if x["id"] in teores:
            teor_ano.setdefault(ano, {})[x["id"]] = teores[x["id"]]
    for ano, l in por_ano.items():
        gravar_json(pasta / f"{ano}.json", l)
    for ano, d in teor_ano.items():
        gravar_json(pasta / f"teor-{ano}.json", d)
    gravar_json(pasta / "indice.json", {"corte": corte, "eds": sorted(idx.values(), key=lambda e: -e[0]), "antigos": sorted(por_ano)})
    gravar_json(SITE_DATA / "informativos-teor.json", {k: v for x in recentes if (v := teores.get(x["id"])) for k in [x["id"]]})
    log(f"Informativo: {len(todas)} notas de {len(eds)} edições ({len(recentes)} no arquivo principal).")
    return {"n": len(todas), "edicoes": len(eds), "ultima": ultima, "ultimaData": next((x.get("d", "") for x in todas if x["ed"] == ultima), ""), "primeira": min((x["ed"] for x in todas), default=0), "coletadoEm": coletado, "verificadoEm": verificado}


# --------------------------------------------------------------------------
# 9. Jurisprudência em Teses (STJ): teses consolidadas por assunto, com os
#    precedentes de cada uma. Extraída pelo navegador (o STJ recusa robôs).
# --------------------------------------------------------------------------
JT_FONTE = RAIZ / "fontes" / "jurisprudencia-em-teses.json"
JT_NOVAS = RAIZ / "fontes" / "teses"
RAMO_JT = RAMO_INFO + [("empresarial", r"propriedade intelectual"), ("administrativo", r"direitos humanos")]


def _iso_br(d: str) -> str:
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", d or "")
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else ""


def atualizar_teses() -> dict:
    fonte = ler_json(JT_FONTE, {})
    eds, ramos = dict(fonte.get("edicoes", {})), {k: list(v) for k, v in fonte.get("ramos", {}).items()}
    coletado = fonte.get("coletadoEm", "")
    # Coletas semanais feitas pelo navegador (scripts/coletar-teses.js), gravadas em fontes/teses/.
    for arq in sorted(JT_NOVAS.glob("*.json")) if JT_NOVAS.exists() else []:
        lote = ler_json(arq, {})
        eds.update({str(k): v for k, v in (lote.get("edicoes") or {}).items()})
        for r, lst in (lote.get("ramos") or {}).items():
            atual = ramos.setdefault(r, [])
            atual[:0] = [str(e) for e in lst if str(e) not in atual]
        coletado = max(coletado, lote.get("coletadoEm", ""))
    ramo_de = {}
    for r, lst in ramos.items():
        for e in lst:
            ramo_de.setdefault(str(e), []).append(r.title().replace(" Do ", " do ").replace(" Da ", " da ").replace(" E ", " e ").replace(" De ", " de "))
    out = []
    for k, e in eds.items():
        rs = ramo_de.get(str(k), [])
        ar = []
        for r in rs:
            for a, rx in RAMO_JT:
                if re.search(rx, sem_acento(r)) and a not in ar:
                    ar.append(a)
        if not ar and re.search(r"autoral|marco civil|internet", sem_acento(e.get("tit", ""))):
            ar = ["civil"]
        teses = []
        for t in e.get("teses", []):
            txt = sem_acento(f"{e.get('tit', '')} {t.get('t', '')}")
            ar_t = [] if ar else _areas_por_termos(txt, "")  # edições temáticas (ex.: Covid-19)
            sa = subareas(txt, ar or ar_t)
            teses.append(limpar_vazios({"n": t.get("n"), "t": t.get("t", ""), "ac": t.get("ac", [])[:8], "nac": t.get("nac"), "dm": t.get("dm"), "ar": ar_t, "sa": sa}))
        out.append(limpar_vazios({"ed": int(k), "tit": e.get("tit", ""), "ramo": rs, "ar": ar, "disp": _iso_br(e.get("disp")), "ate": _iso_br(e.get("ate")), "teses": teses}))
    out.sort(key=lambda x: -x["ed"])
    if out:
        gravar_json(SITE_DATA / "teses.json", out)
    n = sum(len(x["teses"]) for x in out)
    log(f"Jurisprudência em Teses: {len(out)} edições, {n} teses.")
    return {"edicoes": len(out), "teses": n, "coletadoEm": coletado,
            "ultima": out[0]["ed"] if out else 0, "ultimaData": out[0].get("disp", "") if out else ""}


# Rótulos das submatérias, lidos pelo site.
def gravar_taxonomia() -> None:
    gravar_json(SITE_DATA / "submaterias.json", {a: [[k, rot, g] for k, rot, g, _ in lst] for a, lst in SUBAREAS.items() if lst})


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--meses", type=int, default=12, help="meses de acórdãos mantidos no site")
    ap.add_argument("--desde", default="", help="AAAA-MM: primeiro mês do acervo (tem precedência sobre --meses)")
    ap.add_argument("--dias-radar", type=int, default=15, help="dias de publicação no radar")
    args = ap.parse_args()
    corte = args.desde if re.fullmatch(r"\d{4}-\d{2}", args.desde or "") else mes_menos(f"{HOJE.year:04d}-{HOJE.month:02d}", args.meses)
    log(f"Acervo de acórdãos a partir de {corte}.")

    SITE_DATA.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    estado = ler_json(CACHE / "estado.json", {})
    erros = []

    ultimos = {}
    try:
        ultimos = atualizar_espelhos(corte, estado)
        erros += [f"espelhos: {x}" for x in estado.get("_falhas_espelhos", [])]
    except Exception as e:  # noqa: BLE001
        erros.append(f"espelhos: {e}")
        log("ERRO espelhos:", e)
    finally:
        gravar_json(CACHE / "estado.json", estado)
    try:
        migrar_esquema(estado)
    finally:
        gravar_json(CACHE / "estado.json", estado)
    meses_disp = podar_meses(corte)

    destaques = {}
    try:
        destaques = gerar_destaques(meses_disp)
    except Exception as e:  # noqa: BLE001
        erros.append(f"destaques: {e}")
        log("ERRO destaques:", e)

    numeros = {}
    try:
        numeros = gerar_numeros(meses_disp)
    except Exception as e:  # noqa: BLE001
        erros.append(f"números: {e}")
        log("ERRO números:", e)
    try:
        gerar_recentes(meses_disp)
    except Exception as e:  # noqa: BLE001
        erros.append(f"recentes: {e}")
        log("ERRO recentes:", e)

    busca = {}
    try:
        busca = gerar_indice_busca(meses_disp)
    except Exception as e:  # noqa: BLE001
        erros.append(f"índice de busca: {e}")
        log("ERRO índice de busca:", e)

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

    informativos = {}
    try:
        informativos = atualizar_informativos()
    except Exception as e:  # noqa: BLE001
        erros.append(f"informativos: {e}")
        log("ERRO informativos:", e)

    teses = {}
    try:
        teses = atualizar_teses()
    except Exception as e:  # noqa: BLE001
        erros.append(f"teses: {e}")
        log("ERRO teses:", e)

    composicao = {}
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from composicao import atualizar_composicao
        composicao = atualizar_composicao()
    except Exception as e:  # noqa: BLE001
        erros.append(f"composicao: {e}")
        log("ERRO composição:", e)

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
    painel = 0
    try:
        painel = gerar_painel()
    except Exception as e:  # noqa: BLE001
        erros.append(f"painel: {e}")
        log("ERRO painel:", e)
    meses_info = []
    for mes in sorted(meses_disp, reverse=True):
        org = {}
        for slug in ORGAOS:
            arq = SITE_DATA / "acordaos" / mes / f"{slug}.json"
            if arq.exists():
                org[slug] = {"n": len(ler_json(arq, [])), "kb": round(arq.stat().st_size / 1024)}
        meses_info.append({"m": mes, "orgaos": org})
    agora = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    for sec in (temas, radar, destaques, pautas, composicao):
        if sec:
            sec["em"] = agora
    manifesto = {
        "atualizadoEm": agora,
        "orgaos": ORGAOS,
        "meses": meses_info,
        "ultimoArquivoEspelhos": ultimos or manifesto_ant.get("ultimoArquivoEspelhos", {}),
        "espelhosEm": agora if not any(x.startswith("espelhos") for x in erros) else manifesto_ant.get("espelhosEm", ""),
        "temas": temas or manifesto_ant.get("temas", {}),
        "radar": radar or manifesto_ant.get("radar", {}),
        "destaques": destaques or manifesto_ant.get("destaques", {}),
        "pautas": pautas or manifesto_ant.get("pautas", {}),
        "sumulas": sumulas or manifesto_ant.get("sumulas", {}),
        "informativos": informativos or manifesto_ant.get("informativos", {}),
        "teses": teses or manifesto_ant.get("teses", {}),
        "composicao": composicao or manifesto_ant.get("composicao", {}),
        "busca": busca or manifesto_ant.get("busca", {}),
        "numeros": numeros or manifesto_ant.get("numeros", {}),
        "painel": painel,
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
