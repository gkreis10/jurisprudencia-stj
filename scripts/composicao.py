"""Composição do STJ: órgãos julgadores, ministros, contatos dos gabinetes e perfis.

Fontes oficiais do STJ (www.stj.jus.br):
  - Composição completa (PDF atualizado pela Assessoria para Assuntos Funcionais de Magistrados);
  - Ministros em atividade e currículos (verMinistrosSTJ / verCurriculoMinistro);
  - Contatos das unidades (contatosUnidades.json).
Quando o portal do STJ recusa o acesso automatizado, usa a última extração guardada em
fontes/composicao/ (feita pelo navegador). Fotos: Wikimedia Commons, via Wikidata, com crédito,
hospedadas como miniaturas em site/img/ministros.
"""
from __future__ import annotations

import datetime as dt
import difflib
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / "fontes" / "composicao"
SAIDA = RAIZ / "site" / "data" / "composicao.json"
CACHE_FOTOS = RAIZ / ".cache" / "fotos-ministros.json"
UA = "RadarSTJ/1.0 (https://gkreis10.github.io/jurisprudencia-stj/)"
STJ = "https://www.stj.jus.br"
URL_PDF = f"{STJ}/sites/portalp/SiteAssets/Paginas/Institucional/Composicao/Composicao-do-STJ.pdf"
URL_CONTATOS = f"{STJ}/sites/portalp/WebPub/NovoPortal/assets/json/contatosUnidades.json"
URL_CV = STJ + "/web/verCurriculoMinistro?parametro=1&cod_matriculamin={}"

ORGAOS = [  # (chave, nome no PDF, rótulo, tipo)
    ("plenario", "PLENÁRIO", "Plenário", "plenario"),
    ("corte-especial", "CORTE ESPECIAL", "Corte Especial", "julgador"),
    ("primeira-secao", "PRIMEIRA SEÇÃO", "Primeira Seção", "julgador"),
    ("segunda-secao", "SEGUNDA SEÇÃO", "Segunda Seção", "julgador"),
    ("terceira-secao", "TERCEIRA SEÇÃO", "Terceira Seção", "julgador"),
    ("primeira-turma", "PRIMEIRA TURMA", "Primeira Turma", "julgador"),
    ("segunda-turma", "SEGUNDA TURMA", "Segunda Turma", "julgador"),
    ("terceira-turma", "TERCEIRA TURMA", "Terceira Turma", "julgador"),
    ("quarta-turma", "QUARTA TURMA", "Quarta Turma", "julgador"),
    ("quinta-turma", "QUINTA TURMA", "Quinta Turma", "julgador"),
    ("sexta-turma", "SEXTA TURMA", "Sexta Turma", "julgador"),
    ("conselho-administracao", "CONSELHO DE ADMINISTRAÇÃO", "Conselho de Administração", "administrativo"),
    ("cjf", "CONSELHO DA", "Conselho da Justiça Federal", "externo"),
    ("enfam", "ENFAM***", "Enfam", "externo"),
    ("tse", "TRIBUNAL SUPERIOR", "Tribunal Superior Eleitoral", "externo"),
    ("cejusc", "CEJUSC", "Cejusc", "administrativo"),
]
NOMES_PDF = {n: k for k, n, _, _ in ORGAOS}
AREA = {"primeira-secao": "Direito Público", "segunda-secao": "Direito Privado", "terceira-secao": "Direito Penal",
        "primeira-turma": "Direito Público", "segunda-turma": "Direito Público", "terceira-turma": "Direito Privado",
        "quarta-turma": "Direito Privado", "quinta-turma": "Direito Penal", "sexta-turma": "Direito Penal"}
PARTICULAS = {"de", "da", "do", "dos", "das", "e"}


def log(*a):
    print(*a, flush=True)


def baixar(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()


def tokens(nome: str) -> list[str]:
    return [t for t in re.findall(r"[a-z]+\.?", sem_acento(nome)) if t.rstrip(".") not in PARTICULAS]


def casa_nome(curto: str, completo: str) -> bool:
    """'Villas Bôas Cueva' ⊂ 'Ricardo Villas Bôas Cueva'; aceita iniciais ('Daniela R. Teixeira')."""
    tc, tl = tokens(curto), tokens(completo)
    if not tc:
        return False
    for t in tc:
        if t.endswith("."):
            if not any(x.startswith(t[:-1]) for x in tl):
                return False
        elif t not in tl and not (len(t) >= 7 and any(difflib.SequenceMatcher(None, t, x).ratio() >= 0.9 for x in tl)):
            return False  # tolera um erro de digitação em nomes longos ("Paciornick")
    return True


def _data(txt: str) -> str:
    m = re.search(r"(\d{1,2})º?/(\d{1,2})/(\d{4})", txt or "")
    return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else ""


# ------------------------------------------------------------------ PDF
def ler_pdf(caminho: Path) -> dict:
    import pdfplumber  # instalado na rotina (pip install pdfplumber)

    with pdfplumber.open(caminho) as pdf:
        pg = pdf.pages[0]
        texto = pg.extract_text() or ""
        tb = pg.find_tables()[0]
        tabela = tb.extract()
        caixas = [r.cells for r in tb.rows]
    m = re.search(r"Composi[çc][ãa]o\s*[–-]\s*(\d{1,2}/\d{1,2}/\d{4})", texto)
    data_pdf = _data(m.group(1)) if m else ""
    # Cada órgão: cabeçalho numa célula; o conteúdo, nas linhas seguintes da mesma coluna.
    # Células mescladas (p. ex., dias de sessão) valem para todos os órgãos que abrangem.
    blocos: dict[str, list[str]] = {}
    sessoes: dict[str, list[str]] = {}
    atual: dict[float, str] = {}  # x inicial da coluna -> órgão
    comissoes, nota_comissoes, em_comissoes = [], "", False
    for i, linha in enumerate(tabela):
        for j, cel in enumerate(linha):
            if not cel or not cel.strip():
                continue
            c = cel.strip()
            x0, _, x1, _ = caixas[i][j] or (0, 0, 0, 0)
            if c.startswith("COMISSÕES PERMANENTES"):
                em_comissoes = True
                continue
            if em_comissoes:
                if c.startswith("***"):
                    nota_comissoes = c.lstrip("*").strip()
                else:
                    comissoes.append(_comissao(c))
                continue
            chave = NOMES_PDF.get(c.split("\n")[0].strip())
            if chave:
                atual[round(x0)] = chave
                blocos.setdefault(chave, []).extend(c.split("\n")[1:])
                continue
            alvos = [k for x, k in atual.items() if x0 - 1 <= x < x1 - 1]
            if len(alvos) > 1:
                for k in alvos:
                    sessoes.setdefault(k, []).append(re.sub(r"\s+", " ", c))
            elif alvos:
                blocos[alvos[0]].extend(c.split("\n"))
    return {"data": data_pdf, "blocos": blocos, "sessoes": sessoes, "comissoes": [x for x in comissoes if x["nome"]], "nota_comissoes": nota_comissoes}


def _comissao(c: str) -> dict:
    titulo, obs, membros = [], [], []
    for l in (x.strip() for x in c.split("\n")):
        if not l:
            continue
        if not membros and not obs and l == l.upper():
            titulo.append(l)
        elif not membros and not obs and re.match(r"^[A-ZÇÃÁÉÍÓÚÂÊÔÕ ,]+-", l):
            a, b = l.split("-", 1)
            titulo.append(a)
            obs.append(b)
        elif not membros and re.search(r"anteriores|\bn\.\s*\d", l):
            obs.append(l)
        else:
            mc = re.search(r"\((Presidente|Vice-Presidente)\)", l)
            membros.append({"nome": l.replace(mc.group(0), "").strip() if mc else l, **({"cargo": mc.group(1)} if mc else {})})
    nome = re.sub(r"\s+", " ", " ".join(titulo)).strip().replace(", ", ", ").title().replace(" E ", " e ").replace(" Da ", " da ").replace(" De ", " de ")
    return {"nome": nome, "obs": " ".join(obs), "membros": membros}


RE_MEMBRO = re.compile(r"^(\d{1,2})\.\s*(.+?)\s*$")


def _membros(linhas: list[str], chave: str) -> dict:
    membros, notas, presid, legenda = [], [], "", {}
    for l in linhas:
        l = l.strip()
        if not l or l in ("Direito Público", "Direito Privado", "Direito Penal", "JUSTIÇA FEDERAL", "ELEITORAL"):
            continue
        mi = re.match(r"^Ingresso:\s*(.+)$", l)
        if mi and membros:
            membros[-1]["ingresso"] = _data(mi.group(1))
            continue
        mm = RE_MEMBRO.match(l)
        if mm:
            nome = mm.group(2)
            posse = _data(nome) if chave == "plenario" else ""
            if posse:
                nome = re.sub(r"\s*\d{1,2}º?/\d{1,2}/\d{4}\s*$", "", nome)
            cargo = ""
            mc = re.search(r"\((Presidente|Vice-Presidente)\)", nome)
            if mc:
                cargo = mc.group(1)
                nome = nome.replace(mc.group(0), "").strip()
            marca = re.search(r"(\*+|\d)$", nome)
            simbolo = ""
            if marca and not re.search(r"\d{4}$", nome):
                simbolo = marca.group(1)
                nome = nome[: marca.start()].strip()
            membros.append({"n": int(mm.group(1)), "nome": nome, **({"posse": posse} if posse else {}), **({"cargo": cargo} if cargo else {}), **({"marca": simbolo} if simbolo else {})})
            continue
        mp = re.match(r"^\*\s*Presid[êe]ncia:\s*(.+)$", l)
        if mp:
            presid = re.sub(r"\s*\ba\s*(?=\d)", " a ", mp.group(1)).strip()
            continue
        if chave == "plenario":
            ml = re.match(r"^(\d)\s+(\D.+)$", l)
            if ml:
                legenda[ml.group(1)] = ml.group(2).strip()
                continue
            mpl = re.match(r"^Presid[êe]ncia:\s*(.+)$", l)
            if mpl:
                presid = re.sub(r"\s*\ba\s*(?=\d)", " a ", mpl.group(1)).strip()
                continue
            if l.startswith("*Em disponibilidade"):
                continue
        notas.append(l)
    for m in membros:
        if chave == "plenario" and m.get("marca", "").isdigit() and m["marca"] in legenda:
            m["funcao"] = legenda[m["marca"]]
        if chave == "plenario" and m.get("cargo") and presid:
            m["mandato"] = presid
    # Quem preside o colegiado vem marcado com um asterisco e a nota "*Presidência: …".
    for m in membros:
        if m.get("marca") == "*" and presid and chave != "plenario":
            m["cargo"] = "Presidente"
            m["mandato"] = presid
        elif m.get("marca") == "**":
            m["obs"] = "Desembargador(a) convocado(a)"
        elif m.get("marca") == "*" and chave == "plenario":
            m["obs"] = "Em disponibilidade"
    return {"membros": membros, "notas": notas}


def _lista_livre(linhas: list[str], nomes: list[str]) -> dict:
    """Órgãos sem numeração (CJF, Enfam, TSE, Cejusc): nome seguido de funções e biênio."""
    itens, notas, grupo = [], [], ""
    for l in (x.strip() for x in linhas):
        if not l or l in ("JUSTIÇA FEDERAL", "ELEITORAL"):
            continue
        if re.match(r"^(Art\.|Res\.)", l):
            notas.append(l)
            continue
        if re.match(r"^(Membros|Ministros)\b", l):
            grupo = l
            continue
        base = re.sub(r"\s*\((\d{4}/\d{2})\)\s*$", "", l)
        if l.lower() == "(vago)" or (len(tokens(base)) >= 2 and any(casa_nome(base, n) for n in nomes)):
            per = re.search(r"\((\d{4}/\d{2})\)\s*$", l)
            itens.append({"nome": "(vago)" if l.lower() == "(vago)" else base, "papeis": [], **({"grupo": grupo} if grupo else {}), **({"mandato": per.group(1)} if per else {})})
            continue
        if itens:
            mb = re.match(r"^Biênio\s+(\d{4}/\d{2})$", l)
            mp = re.match(r"^(.+?)\s*\((\d{4}/\d{2})\)$", l)
            if mb:
                itens[-1]["mandato"] = mb.group(1)
            elif mp:
                itens[-1]["papeis"].append(mp.group(1))
                itens[-1]["mandato"] = mp.group(2)
            else:
                itens[-1]["papeis"].append(l)
        else:
            notas.append(l)
    for it in itens:
        if not it["papeis"]:
            it.pop("papeis")
    return {"membros": itens, "notas": notas}


# ------------------------------------------------------------------ currículos
SECOES = ["Formação Acadêmica", "Funções Atuais", "Outras Atividades", "Principais Atividades Exercidas", "Atividade Docente", "Magistério", "Condecorações, títulos, medalhas", "Publicações"]


def perfil(cv: str) -> dict:
    out = {}
    m = re.search(r"Nascimento:\s*(.+)", cv or "")
    if m:
        out["nascimento"] = m.group(1).strip().rstrip(".")
    posicoes = sorted((cv.find("\n" + s + "\n"), s) for s in SECOES if cv.find("\n" + s + "\n") >= 0)
    for i, (ini, sec) in enumerate(posicoes):
        fim = posicoes[i + 1][0] if i + 1 < len(posicoes) else len(cv)
        linhas = [l.strip() for l in cv[ini + len(sec) + 2: fim].split("\n") if l.strip() and not l.startswith("Áreas do conhecimento") and not l.startswith("Palavras-chave") and l != "Formação acadêmica/titulação"]
        if sec == "Publicações":
            out["publicacoes"] = len([l for l in linhas if re.match(r"^\d+[.-]", l)]) or None
            continue
        chave = {"Formação Acadêmica": "formacao", "Funções Atuais": "funcoes", "Outras Atividades": "outras", "Principais Atividades Exercidas": "atividades",
                 "Atividade Docente": "docencia", "Magistério": "docencia", "Condecorações, títulos, medalhas": "condecoracoes"}[sec]
        limite = {"formacao": 14, "funcoes": 12, "outras": 8, "atividades": 16, "docencia": 8, "condecoracoes": 10}[chave]
        out[chave] = [l[:400] for l in linhas[:limite]]
        if len(linhas) > limite:
            out[chave + "_mais"] = len(linhas) - limite
    return {k: v for k, v in out.items() if v}


# ------------------------------------------------------------------ fotos (Wikimedia Commons)
def _wd(url: str):
    for tentativa in range(3):
        try:
            time.sleep(1.0)
            return json.loads(baixar(url, 30))
        except urllib.error.HTTPError as e:
            if e.code != 429 or tentativa == 2:
                raise
            time.sleep(5 * (tentativa + 1))


FALHAS_WD = [0]


def foto_wikidata(nomes: list[str], cache: dict) -> dict | None:
    chave = nomes[0]
    if chave in cache:
        return cache[chave] or None
    if FALHAS_WD[0] >= 3:  # Wikidata limitando as consultas: tenta de novo na próxima execução
        return None
    res = None
    try:
        for nome in dict.fromkeys(nomes):
            q = urllib.parse.urlencode({"action": "wbsearchentities", "search": nome, "language": "pt", "uselang": "pt", "format": "json", "limit": 6})
            for it in _wd(f"https://www.wikidata.org/w/api.php?{q}").get("search", []):
                desc = sem_acento(it.get("description", ""))
                if not (re.search(r"superior tribunal de justica|\bstj\b|superior court of justice", desc)
                        or (re.search(r"brasil|brazil", desc) and re.search(r"juri|jurist|magistrad|juiz|judge|ministr|desembargad|advogad|lawyer", desc))):
                    continue
                ent = _wd(f"https://www.wikidata.org/wiki/Special:EntityData/{it['id']}.json")["entities"][it["id"]]
                p18 = ent.get("claims", {}).get("P18")
                if p18:
                    arq = p18[0]["mainsnak"]["datavalue"]["value"].replace(" ", "_")
                    res = {"url": "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(arq) + "?width=360",
                           "credito": "Wikimedia Commons", "pagina": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(arq), "wd": it["id"]}
                break
            if res:
                break
    except Exception as e:  # noqa: BLE001
        log(f"  foto de {chave}: {e}")
        FALHAS_WD[0] += 1
        return None  # não guarda no cache: tenta de novo na próxima execução
    cache[chave] = res or {}
    return res


FOTOS_SITE = RAIZ / "site" / "img" / "ministros"


def foto_local(foto: dict | None) -> dict | None:
    """Usa a miniatura hospedada no próprio site (site/img/ministros); baixa a que faltar."""
    if not foto or not foto.get("pagina"):
        return foto
    import hashlib
    nome = hashlib.md5(foto["pagina"].encode()).hexdigest()[:12] + ".jpg"
    arq = FOTOS_SITE / nome
    if not arq.exists():
        try:
            bruto = baixar(re.sub(r"\?width=\d+", "", foto["url"]) + "?width=330", 60)
            if bruto[:3] != b"\xff\xd8\xff" or len(bruto) > 400_000:
                raise ValueError("resposta sem imagem JPEG")
            FOTOS_SITE.mkdir(parents=True, exist_ok=True)
            arq.write_bytes(bruto)
        except Exception as e:  # noqa: BLE001
            log(f"  miniatura de {foto['pagina'].rsplit(':', 1)[-1]}: {e}")
            return foto  # mantém o endereço original do Wikimedia Commons
    return {**foto, "url": f"img/ministros/{nome}", "orig": foto["url"]}


# ------------------------------------------------------------------ principal
def atualizar_composicao() -> dict:
    FONTE.mkdir(parents=True, exist_ok=True)
    fonte = json.loads((FONTE / "stj-composicao.json").read_text(encoding="utf-8")) if (FONTE / "stj-composicao.json").exists() else {}
    pdf = FONTE / "Composicao-do-STJ.pdf"
    origem = "extração guardada"
    try:
        bruto = baixar(URL_PDF)
        if bruto[:4] == b"%PDF":
            pdf = RAIZ / ".cache" / "Composicao-do-STJ.pdf"
            pdf.parent.mkdir(parents=True, exist_ok=True)
            pdf.write_bytes(bruto)
            origem = "portal do STJ"
    except Exception as e:  # noqa: BLE001
        log(f"Composição: portal do STJ indisponível ({e}); usando a extração guardada.")
    contatos = fonte.get("contatos", [])
    try:
        contatos = json.loads(baixar(URL_CONTATOS)) or contatos
    except Exception:  # noqa: BLE001
        pass
    lido = ler_pdf(pdf)
    blocos = lido["blocos"]
    orgaos = []
    nomes_plen = [x["nome"] for x in _membros(blocos.get("plenario", []), "plenario")["membros"]] + [re.split(r"\s+-\s+", m["nome"])[0] for m in fonte.get("ministros", [])]
    for chave, _, rot, tipo in ORGAOS:
        if chave not in blocos:
            continue
        o = {"id": chave, "nome": rot, "tipo": tipo, **({"area": AREA[chave]} if chave in AREA else {})}
        o.update(_membros(blocos[chave], chave) if tipo in ("plenario", "julgador", "administrativo") and chave != "cejusc" else _lista_livre(blocos[chave], nomes_plen))
        orgaos.append(o)
    for o in orgaos:
        if o["id"] in lido["sessoes"]:
            o["sessoes"] = lido["sessoes"][o["id"]]
    turmas = [o for o in orgaos if o["id"].endswith("-turma")]
    padrao = next((o["sessoes"] for o in turmas if o.get("sessoes")), None)
    for o in turmas:  # a linha de sessões do PDF, abaixo das Turmas, vale para todas elas
        if padrao and not o.get("sessoes"):
            o["sessoes"] = padrao
    for o in orgaos:
        o["sessoes"] = [re.sub(r"(\d) (as|os)\b", r"\1\2", x) for x in o.get("sessoes", [])] or None
        if not o["sessoes"]:
            o.pop("sessoes")
    comissoes = lido["comissoes"]
    plen = next((o for o in orgaos if o["id"] == "plenario"), {"membros": []})
    fonte_min = fonte.get("ministros", [])
    base = [dict(x, tipo="ministro") for x in plen["membros"] if "vago" not in x["nome"].lower()]
    vistos = set()
    for o in turmas:  # desembargadores convocados (marcados com ** nas Turmas)
        for x in o.get("membros", []):
            if x.get("marca") == "**" and x["nome"] not in vistos:
                vistos.add(x["nome"])
                base.append({"nome": x["nome"], "tipo": "convocado"})
    ministros = []
    # Fotos já identificadas ficam guardadas (fontes/ e .cache/): o Wikidata só é consultado para quem falta.
    cache = json.loads((FONTE / "fotos.json").read_text()) if (FONTE / "fotos.json").exists() else {}
    if CACHE_FOTOS.exists():
        cache.update({k: v for k, v in json.loads(CACHE_FOTOS.read_text()).items() if v or k not in cache})
    for b in base:
        nome = b["nome"]
        fm = next((m for m in fonte_min if casa_nome(re.split(r"\s+-\s+", m["nome"])[0], nome) or casa_nome(nome, re.split(r"\s+-\s+", m["nome"])[0])), None)
        curto, membro_de, funcoes = None, [], []
        if b.get("cargo"):
            funcoes.append(f"{b['cargo']} do STJ" + (f" ({b['mandato']})" if b.get("mandato") else ""))
        if b.get("funcao"):
            funcoes.append(b["funcao"])
        for o in orgaos:
            if o["id"] == "plenario":
                continue
            for x in o.get("membros", []):
                if casa_nome(x["nome"], nome):
                    curto = curto or x["nome"]
                    cargo = x.get("cargo") or " e ".join(x.get("papeis", []))
                    membro_de.append({"id": o["id"], "nome": o["nome"], **({"cargo": cargo} if cargo else {}), **({"grupo": x["grupo"]} if x.get("grupo") else {}), **({"mandato": x["mandato"]} if x.get("mandato") else {}), **({"ingresso": x["ingresso"]} if x.get("ingresso") else {})})
                    if x.get("cargo") == "Presidente":
                        funcoes.append(f"Presidente da {o['nome']}")
        for cm in comissoes:
            for x in cm["membros"]:
                if casa_nome(x["nome"], nome):
                    membro_de.append({"id": "comissao", "nome": "Comissão de " + cm["nome"] if not cm["nome"].startswith("Gestora") else "Comissão " + cm["nome"], **({"cargo": x["cargo"]} if x.get("cargo") else {})})
        gab = next((c for c in contatos if re.match(r"Gabinete d[oa] (Ministr[oa]|Desembargador[a]? Convocad[oa]) ", c.get("UNIDADE", ""))
                    and casa_nome(re.sub(r"^Gabinete d[oa] (Ministr[oa]|Desembargador[a]? Convocad[oa]) ", "", c["UNIDADE"]), (re.split(r"\s+-\s+", fm["nome"])[0] if fm else nome))), None)
        cod = fm["cod"] if fm else None
        cv = (fonte.get("curriculos") or {}).get(cod, "") if cod else ""
        nome_completo = re.split(r"\s+-\s+", fm["nome"])[0] if fm else nome
        foto = foto_local(foto_wikidata([nome_completo, curto or nome, nome], cache)) if b["tipo"] == "ministro" else None
        emails = [re.sub(r"\s+", " ", e).strip() for e in (gab.get("EMAIL_INSTITUCIONAL") or "").split("\n") if e.strip()] if gab else []
        ministros.append({k: v for k, v in {
            "genero": ("f" if re.match(r"Gabinete da ", gab.get("UNIDADE", "")) else "m") if gab else None,
            "id": cod or "conv-" + re.sub(r"[^a-z]+", "-", sem_acento(nome)).strip("-"), "tipo": b["tipo"], "nome": nome_completo, "curto": curto or nome,
            "uf": (fm or {}).get("uf"), "antiguidade": b.get("n"), "posse": b.get("posse"), "cargo": b.get("cargo"), "obs": b.get("obs"),
            "funcoes": funcoes, "orgaos": membro_de,
            "gabinete": {k2: v2 for k2, v2 in {"unidade": gab.get("UNIDADE"), "chefe": re.sub(r"^Chefe de Gabinete:\s*", "", gab.get("GESTOR_UNIDADE") or ""), "telefones": re.sub(r"\s+", " ", gab.get("TELEFONES") or "").strip(), "emails": emails}.items() if v2} if gab else None,
            "perfil": perfil(cv) if cv else None, "curriculo": URL_CV.format(cod) if cod else None, "foto": foto,
        }.items() if v not in (None, "", [], {})})
    # Liga cada integrante de órgão ou comissão ao respectivo perfil.
    for grupo in [o.get("membros", []) for o in orgaos] + [c["membros"] for c in comissoes]:
        for x in grupo:
            mid = next((m["id"] for m in ministros if casa_nome(x["nome"], m["nome"]) or casa_nome(x["nome"], m["curto"])), None)
            if mid:
                x["mid"] = mid
            x.pop("marca", None)
    CACHE_FOTOS.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FOTOS.write_text(json.dumps(cache, ensure_ascii=False))
    ministros.sort(key=lambda x: (x["tipo"] != "ministro", x.get("antiguidade") or 99))
    out = {"data": lido["data"], "origem": origem, "coletadoEm": fonte.get("coletadoEm", ""), "geradoEm": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
           "fontes": {"composicao": URL_PDF, "ministros": STJ + "/web/verMinistrosSTJ?parametro=1", "contatos": STJ + "/sites/portalp/Contato-e-ajuda/Fale-conosco/Contatos-da-Unidades-STJ"},
           "orgaos": orgaos, "comissoes": comissoes, "nota_comissoes": lido.get("nota_comissoes"),
           "notas": [l for l in plen.get("notas", []) if l.startswith("Diretor")], "ministros": ministros}
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"Composição de {lido['data']} ({origem}): {len(orgaos)} órgãos, {len(ministros)} ministros, {sum(1 for x in ministros if x.get('foto'))} com foto.")
    return {"data": lido["data"], "ministros": len(ministros), "origem": origem}


if __name__ == "__main__":
    atualizar_composicao()
