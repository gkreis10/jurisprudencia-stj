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
ESQUEMA = 5  # aumente quando mudar o enriquecimento; os arquivos são refeitos sem novo download


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
    ("penal", r"processual penal|processo penal|execucao penal|\bpenal\b"),
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
    ("penal", PENAIS, r"habeas corpus|trafico de drogas|dosimetria|prisao preventiva|\bjuri\b|execucao penal|\bcrimes?\b|\bpena\b"),
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
        res = [a for a in res if a not in {"familia", "consumidor", "bancario", "empresarial", "penal"} or a in _rotulos_explicitos(cab)]
    elif orgao in PRIVADO:
        res = [a for a in res if a not in {"tributario", "previdenciario", "penal"} or a in _rotulos_explicitos(cab)]
    elif orgao in PENAIS:
        res = [a for a in res if a in {"penal", "ambiental"} or a in _rotulos_explicitos(cab)]
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
    ("previdenciario", r"previdenci"), ("penal", r"penal"), ("consumidor", r"consumidor"), ("ambiental", r"ambiental"),
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
    ("mudanca", 4, r"superacao|overruling|mudanca de (entendimento|orientacao|jurisprudencia)|alteracao (do|de) entendimento|revisao (da|de) (tese|jurisprudencia|entendimento)|nova orientacao|evolucao jurisprudencial"),
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
                        "reg": r.get("reg"), "dj": r.get("dj"), "s": sc, "ar": r.get("ar"), "h": cab,
                        "tese": (r.get("tese") or "")[:600],
                        "tj": (r.get("tj") or "")[:900],
                    }))
    # Fila do "Atualize-se": acórdãos recentes com tese ou relevância alta.
    lim_feed = (dt.date.today() - dt.timedelta(days=80)).isoformat()
    feed = []
    for mes in recentes:
        for arq in sorted((SITE_DATA / "acordaos" / mes).glob("*.json")):
            for r in ler_json(arq, []):
                if (r.get("dj") or "") < lim_feed:
                    continue
                if not (r.get("tese") or r.get("tj") or r.get("s", 0) >= LIMIAR_DESTAQUE):
                    continue
                feed.append(limpar_vazios({
                    "id": r.get("id"), "m": mes, "o": r.get("o"), "cl": r.get("cl"), "n": r.get("n"),
                    "reg": r.get("reg"), "dj": r.get("dj"), "dd": r.get("dd"), "rel": r.get("rel"),
                    "s": r.get("s", 0), "ar": r.get("ar"), "rz": r.get("rz"),
                    "h": (r.get("em") or "").split("\n", 1)[0][:320],
                    "tese": (r.get("tese") or "")[:600], "tj": (r.get("tj") or "")[:900],
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

    temas = {}
    try:
        temas = atualizar_temas()
    except Exception as e:  # noqa: BLE001
        erros.append(f"temas: {e}")
        log("ERRO temas:", e)

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
