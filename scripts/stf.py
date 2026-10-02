"""Supremo Tribunal Federal: temas de repercussão geral, súmulas (comuns e vinculantes) e composição.

Fontes oficiais (portal.stf.jus.br), páginas públicas, uma consulta por vez e com intervalo:
  - Temas de repercussão geral: jurisprudenciaRepercussao/todostemas.asp (lista completa, uma página)
    e verTeseTema.asp (texto da tese, baixado só quando surge ou muda a data da tese);
  - Súmulas: jurisprudencia/sumariosumulas.asp (base=30 comuns, base=26 vinculantes); o enunciado
    de cada uma é baixado só quando ela é nova ou muda de situação;
  - Composição: páginas "Composição atual" e "Composição das Turmas".
O portal do STF envia a cadeia de certificados incompleta: o certificado intermediário oficial
(GlobalSign GCC R6 AlphaSSL CA 2025) fica em fontes/stf/. O acesso se identifica como robô do Radar.
A pesquisa de acórdãos do STF (jurisprudencia.stf.jus.br) tem proteção contra robôs e não é usada.

Fotos dos ministros: Wikimedia Commons, via Wikidata (identificadores em fontes/stf/ministros.json).
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import ssl
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# As rotinas do STJ (atualizar, composicao) só são carregadas quando necessárias; a coleta do
# registro (--coletar) roda sem elas, com apenas este arquivo e fontes/stf/.
SO_REGISTRO = False


def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()


def _A():
    import atualizar
    return atualizar


def _C():
    import composicao
    return composicao

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / "fontes" / "stf"
CACHE = RAIZ / ".cache"
SAIDA = RAIZ / "site" / "data"
UA = "Mozilla/5.0 (compatible; RadarSTJ/1.0; +https://jurisprudencia-stj-gkreis10.pages.dev/)"
PORTAL = "https://portal.stf.jus.br"
URL_TEMAS = f"{PORTAL}/jurisprudenciaRepercussao/todostemas.asp"
URL_TESE = f"{PORTAL}/jurisprudenciaRepercussao/verTeseTema.asp?numTema={{}}"
URL_SUMULAS = f"{PORTAL}/jurisprudencia/sumariosumulas.asp?base={{}}"
URL_SUMULA = f"{PORTAL}/jurisprudencia/sumariosumulas.asp?base={{}}&sumula={{}}"
URL_COMPOSICAO = f"{PORTAL}/textos/verTexto.asp?servico=bibliotecaConsultaProdutoBibliotecaPastaMinistro&pagina=ComposicaoAtual"
URL_TURMAS = f"{PORTAL}/textos/verTexto.asp?servico=sobreStfComposicaoTurma&pagina=principal"
HOJE = dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).date().isoformat()
INTERVALO = 1.0
# Tempo máximo, por execução, para baixar teses e enunciados um a um. A carga inicial (cerca de
# 1.300 teses e 800 súmulas) se completa em poucas execuções; depois, cada dia baixa só o que é novo.
TEMPO_MAX = 25 * 60
INICIO = time.monotonic()
sem_tempo = lambda fr=1.0: time.monotonic() - INICIO > TEMPO_MAX * fr  # noqa: E731


def log(*a):
    print(*a, flush=True)


_CTX = None


def contexto() -> ssl.SSLContext:
    global _CTX
    if _CTX is None:
        _CTX = ssl.create_default_context()
        for p in FONTE.glob("*.pem"):
            _CTX.load_verify_locations(str(p))
    return _CTX


def baixar(url: str, timeout: int = 120, tentativas: int = 3) -> bytes:
    for t in range(tentativas):
        try:
            time.sleep(INTERVALO)
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9"})
            with urllib.request.urlopen(req, timeout=timeout, context=contexto()) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if isinstance(e, urllib.error.HTTPError) and e.code in (403, 404):
                raise
            if t == tentativas - 1:
                raise
            time.sleep(5 * (t + 1))
    raise RuntimeError("inalcançável")


def decodificar(b: bytes) -> str:
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        return b.decode("latin-1")


def limpo(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s or "")
    s = html.unescape(re.sub(r"<[^>]+>", " ", s)).replace("​", "").replace("\xa0", " ")
    return re.sub(r"[ \t\r\f\v]+", " ", re.sub(r"\s*\n\s*", "\n", s)).strip()


def uma_linha(s: str) -> str:
    return re.sub(r"\s+", " ", limpo(s)).strip()


def data_iso(s: str) -> str:
    m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", s or "")
    return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else ""


MESES = "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split()


def data_extenso(iso: str) -> str:
    a, m, d = iso.split("-")
    return f"{int(d)} de {MESES[int(m) - 1]} de {a}"


def ler(caminho: Path, padrao):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return padrao


def gravar(caminho: Path, obj, compacto: bool = True) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    txt = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) if compacto else json.dumps(obj, ensure_ascii=False, indent=1)
    caminho.write_text(txt + ("\n" if not compacto else ""), encoding="utf-8")


# ------------------------------------------------------------------ matérias
# Os assuntos do STF seguem a tabela processual unificada do CNJ ("6039-DIREITO TRIBUTÁRIO | ...").
RAMO_STF = [
    ("proc-civil", r"processual civil"), ("proc-penal", r"processual penal"), ("penal", r"^direito penal"),
    ("tributario", r"tributario"), ("administrativo", r"administrativo"), ("previdenciario", r"previdenci"),
    ("consumidor", r"consumidor"), ("ambiental", r"ambiental"), ("trabalho", r"^direito do trabalho"),
    ("familia", r"crianca e do adolescente"), ("civil", r"^direito civil"),
]


def areas_stf(ass: list[str], texto: str) -> tuple[list[str], list[str]]:
    if SO_REGISTRO:
        return [], []
    A = _A()
    ar: list[str] = []
    for a in ass:
        top = sem_acento(a.split("|")[0]).strip()
        top = re.sub(r"^\d+-\s*", "", top)
        k = next((k for k, rx in RAMO_STF if re.search(rx, top)), "")
        if k == "civil" and re.search(r"\|\s*familia|\|\s*sucess", sem_acento(a)):
            k = "familia"
        if k and k not in ar:
            ar.append(k)
    if not ar:  # sem assunto: tenta pela redação, como nos temas do STJ
        ar = A.areas_do_tema({"q": texto, "org": ""})
    ar = ar[:4]
    t = sem_acento(texto)
    sa: list[str] = []
    for a in ar:
        if a in A.SUBAREAS_RE:
            sa += A.subareas(t, [a], 2)
    return ar, sa[:6]


# ------------------------------------------------------------------ temas de repercussão geral
def ler_temas(pagina: str) -> list[dict]:
    out = []
    for r in re.findall(r"<tr>([\s\S]*?)</tr>", pagina):
        tds = re.findall(r"<td[^>]*>([\s\S]*?)</td>", r)
        if len(tds) != 6:
            continue
        m = re.search(r"incidente=(\d+)&numeroProcesso=(\d+)&classeProcesso=(\w+)&numeroTema=(\d+)", tds[0])
        n = int(m.group(4)) if m else int(re.sub(r"\D", "", uma_linha(tds[0])) or 0)
        if not n:
            continue
        titulo = uma_linha((re.search(r"<a[^>]*>([\s\S]*?)</a>", tds[1]) or [None, ""])[1])
        dicas = re.findall(r'title="([^"]*)"><strong>([^<]*)</strong>', tds[1])
        desc = re.sub(r"^Descri[çc][ãa]o:\s*", "", next((uma_linha(d) for d, rot in dicas if "Descri" in rot), ""))
        ass = next(([uma_linha(x) for x in re.split(r"<br\s*/?>", html.unescape(d)) if x.strip()] for d, rot in dicas if "Assunto" in rot), [])
        lc = uma_linha((re.search(r'detalhe\.asp\?incidente=\d+[^>]*>([\s\S]*?)</a>', tds[2]) or [None, ""])[1])
        pron = re.search(r"verPronunciamento\.asp\?pronunciamento=(\d+)", tds[2])
        rel = uma_linha(re.split(r"<p", tds[3])[0])
        rg = re.search(r'<p class="text-(success|danger)"><strong>([^<]*)</strong></p>\s*([\d/]*)', tds[4])
        sit = re.search(r'title="([^"]*)"><strong>([^<]*)</strong>', tds[4])
        dtese = data_iso(uma_linha(tds[5]))
        x = {"tp": "RG", "n": n, "q": titulo, "desc": desc, "lc": lc, "rel": re.sub(r"^MIN(ISTRO|\.)\s*", "", rel).title().replace(" De ", " de ").replace(" Da ", " da ").replace(" Do ", " do ").replace(" Dos ", " dos ").replace(" E ", " e "),
             "rgs": ("sim" if rg and rg.group(1) == "success" else "nao") if rg else "",
             "rgt": rg.group(2).strip() if rg else "Em definição", "rgd": data_iso(rg.group(3)) if rg else "",
             "sit": sit.group(2).strip() if sit else "", "sitd": data_iso(sit.group(1)) if sit else "",
             "dtese": dtese, "ass": ass}
        if x["rel"] == "Presidente":  # "MINISTRO PRESIDENTE": manifestação da Presidência do Tribunal
            x["rel"] = "Presidência do STF"
        if m:
            x["inc"] = m.group(1)
        if pron:
            x["pron"] = pron.group(1)
        if "reafirma" in sem_acento(x["rgt"]).lower():
            x["reaf"] = 1
        out.append({k: v for k, v in x.items() if v not in ("", [], None)})
    return out


def tese_do_tema(n: int) -> str:
    t = decodificar(baixar(URL_TESE.format(n), 60))
    cels = re.findall(r"<td[^>]*>([\s\S]*?)</td>", t)
    # Colunas: Tema, Leading Case, Tese (a tese é a última célula com texto).
    textos = [limpo(c) for c in cels if limpo(c)]
    return textos[-1] if len(textos) >= 3 else ""


# Registro dos temas (com as teses) guardado no repositório: usado quando o portal do STF recusa o
# acesso a partir dos servidores da rotina. Um tema por linha, para as atualizações terem diferenças pequenas.
REGISTRO_TEMAS = FONTE / "temas.json"
REGISTRO_SUMULAS = FONTE / "sumulas.json"
REGISTRO_HISTORICO = FONTE / "historico.json"
CAMPOS_REGISTRO = ["n", "q", "desc", "lc", "rel", "rgs", "rgt", "rgd", "sit", "sitd", "dtese", "ass", "inc", "pron", "reaf", "tese"]


def json_linhas(obj) -> str:
    if isinstance(obj, dict):
        return "{\n" + ",\n".join(f"{json.dumps(k, ensure_ascii=False)}:{json.dumps(v, ensure_ascii=False, separators=(',', ':'))}" for k, v in obj.items()) + "\n}\n"
    return "[\n" + ",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in obj) + "\n]\n"


def exportar_registro() -> None:
    """Grava em fontes/stf/ o retrato atual (temas com teses e súmulas), a partir dos dados coletados."""
    temas = ler(SAIDA / "stf-temas.json", [])
    if len(temas) >= 1000:
        reg = [{k: x[k] for k in CAMPOS_REGISTRO if k in x} for x in temas]
        linhas = ",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in reg)
        REGISTRO_TEMAS.write_text(f'{{\n"atualizado":"{HOJE}",\n"temas":[\n{linhas}\n]\n}}\n', encoding="utf-8")
    cache = {**ler(REGISTRO_SUMULAS, {}), **ler(CACHE / "stf-sumulas.json", {})}
    cache.pop("atualizado", None)
    if len(cache) >= 700:
        REGISTRO_SUMULAS.write_text(json_linhas({"atualizado": HOJE, **dict(sorted(cache.items(), key=lambda kv: (not kv[1].get("v"), kv[1]["n"])))}), encoding="utf-8")
    inf = INFORMATIVOS_REGISTRO
    if len(inf) >= 100:
        inf = [{k: v for k, v in j.items() if k not in ("ar", "sa")} for j in inf]
        REGISTRO_INFORMATIVOS.write_text(json_linhas_informativos(inf, max(j["n"] for j in inf)), encoding="utf-8")
    hist = ler(SAIDA / "stf-historico.json", None)
    if isinstance(hist, list) and (hist or REGISTRO_HISTORICO.exists()):
        REGISTRO_HISTORICO.write_text(json_linhas(hist), encoding="utf-8")
    log(f"Registro do STF gravado: {len(temas)} temas, {len(cache)} súmulas.")


def preparar_base() -> None:
    """Base das novidades quando a coleta roda fora do GitHub: o registro vira a 'execução anterior'."""
    reg = ler(REGISTRO_TEMAS, {})
    if not reg.get("temas"):
        raise SystemExit("registro de temas ausente")
    gravar(CACHE / "stf-temas-anterior.json", reg["temas"])
    hist = ler(REGISTRO_HISTORICO, [])
    gravar(CACHE / "stf-historico.json", hist if isinstance(hist, list) else [])
    log(f"Base preparada: {len(reg['temas'])} temas do registro de {reg.get('atualizado', '?')}; {len(hist)} evento(s) de histórico.")


def temas_do_registro(e: Exception) -> dict:
    reg = ler(REGISTRO_TEMAS, {})
    if not reg.get("temas"):
        raise e
    log(f"  temas do STF: {e}; usando o registro de {reg.get('atualizado', '?')}")
    temas = []
    for x0 in reg["temas"]:
        x = {"tp": "RG", **x0}
        ass = [a.strip() for a in str(x.get("ass", "")).split(";") if a.strip()]
        x["ar"], x["sa"] = areas_stf(ass, f"{x['q']} {x.get('desc', '')} {x.get('tese', '')}")
        for k in ("ar", "sa"):
            if not x[k]:
                del x[k]
        temas.append(x)
    temas.sort(key=lambda t: -t["n"])
    gravar(SAIDA / "stf-temas.json", temas)
    hist = ler(REGISTRO_HISTORICO, None)
    gravar(SAIDA / "stf-historico.json", hist if isinstance(hist, list) else ler(CACHE / "stf-historico.json", []))
    return {"temas": len(temas), "origem": "registro", "dataRegistro": reg.get("atualizado", "")}


def atualizar_temas(limite_teses: int) -> dict:
    try:
        pagina = decodificar(baixar(URL_TEMAS, 180))
        temas = ler_temas(pagina)
        if len(temas) < 1000:
            raise RuntimeError(f"lista de temas do STF incompleta ({len(temas)})")
    except Exception as e:  # noqa: BLE001
        return temas_do_registro(e)
    semente = {str(x["n"]): {"d": x["dtese"], "t": x["tese"]} for x in ler(REGISTRO_TEMAS, {}).get("temas", []) if x.get("tese") and x.get("dtese")}
    cache = {**semente, **ler(CACHE / "stf-teses.json", {})}
    novas = 0
    for x in sorted(temas, key=lambda t: -t["n"]):
        k = str(x["n"])
        c = cache.get(k)
        if not x.get("dtese"):
            continue
        if c and c.get("d") == x["dtese"] and c.get("t"):
            x["tese"] = c["t"]
            continue
        if novas >= limite_teses or sem_tempo(0.55):  # o restante do tempo fica para as súmulas
            if c and c.get("t"):
                x["tese"] = c["t"]
            continue
        try:
            t = tese_do_tema(x["n"])
            novas += 1
        except Exception as e:  # noqa: BLE001
            log(f"  tese do Tema {k}/STF: {e}")
            t = (c or {}).get("t", "")
        if t:
            cache[k] = {"d": x["dtese"], "t": t}
            x["tese"] = t
    gravar(CACHE / "stf-teses.json", {k: v for k, v in cache.items() if semente.get(k) != v})
    for x in temas:
        x["ar"], x["sa"] = areas_stf(x.get("ass", []), f"{x['q']} {x.get('desc', '')} {x.get('tese', '')}")
        if not x["sa"]:
            del x["sa"]
        if not x["ar"]:
            del x["ar"]
        x["ass"] = "; ".join(re.sub(r"^\d+-", "", a) for a in x.get("ass", []))
        if not x["ass"]:
            del x["ass"]
    temas.sort(key=lambda t: -t["n"])
    # Histórico: comparação com a execução anterior (base das novidades).
    anterior = {t["n"]: t for t in ler(CACHE / "stf-temas-anterior.json", [])}
    hist = ler(CACHE / "stf-historico.json", [])
    if anterior:
        for x in temas:
            a = anterior.get(x["n"])
            if not a:
                hist.append({"d": HOJE, "tp": "RG", "n": x["n"], "ev": "novo", "para": x.get("rgt", "")})
                continue
            if a.get("rgt") != x.get("rgt"):
                hist.append({"d": HOJE, "tp": "RG", "n": x["n"], "ev": "rg", "de": a.get("rgt", ""), "para": x.get("rgt", "")})
            if a.get("sit") != x.get("sit"):
                hist.append({"d": HOJE, "tp": "RG", "n": x["n"], "ev": "situacao", "de": a.get("sit", ""), "para": x.get("sit", "")})
            if x.get("tese") and a.get("tese") != x.get("tese"):
                hist.append({"d": HOJE, "tp": "RG", "n": x["n"], "ev": "tese" if not a.get("tese") else "tese-alterada"})
    limite = (dt.date.fromisoformat(HOJE) - dt.timedelta(days=120)).isoformat()
    hist = [h for h in hist if h["d"] >= limite]
    gravar(CACHE / "stf-temas-anterior.json", temas)
    gravar(CACHE / "stf-historico.json", hist)
    gravar(SAIDA / "stf-temas.json", temas)
    gravar(SAIDA / "stf-historico.json", hist)
    sem = sum(1 for x in temas if x.get("dtese") and not x.get("tese"))
    log(f"STF: {len(temas)} temas de repercussão geral; {novas} tese(s) baixada(s); {sem} tese(s) ainda por baixar; {len(hist)} evento(s).")
    return {"temas": len(temas), "teses_novas": novas, "teses_pendentes": sem}


# ------------------------------------------------------------------ súmulas
def lista_sumulas(base: int) -> list[dict]:
    t = decodificar(baixar(URL_SUMULAS.format(base), 90))
    out = []
    for sid, rot, st in re.findall(r'sumula=(\d+)">\s*([^<]*?)\s*(?:<em>\(([^)]*)\)</em>)?\s*</a>', t):
        m = re.search(r"(\d+)\s*$", html.unescape(rot).replace("\xa0", " ").strip())
        if m:
            out.append({"id": sid, "n": int(m.group(1)), "st": (st or "").replace("​", "").replace("&#8203;", "").strip().lower()})
    return out


def secoes(t: str) -> dict[str, str]:
    ini = t.find('<div class="titulo-formulario">')
    fim = t.find("<footer", ini)
    corpo = t[ini:fim] if ini >= 0 else t
    out: dict[str, str] = {}
    for tit, par in re.findall(r'<div class="titulo">([\s\S]*?)</div>\s*<div class="parCOM">([\s\S]*?)</div>', corpo):
        out.setdefault(uma_linha(tit), par)
    return out


def sumula_detalhe(base: int, sid: str) -> dict:
    t = decodificar(baixar(URL_SUMULA.format(base, sid), 90))
    sec = secoes(t)
    if not sec:
        return {}
    chaves = list(sec)
    x: dict = {}
    if re.match(r"S[úu]mula", chaves[0]):
        x["t"] = uma_linha(sec[chaves[0]])
    obs = limpo(next((v for k, v in sec.items() if k.startswith("Observa")), ""))
    if obs:
        d = re.search(r"Data de (aprova[çc][ãa]o|publica[çc][ãa]o) do enunciado:\s*([^\n]*)", obs)
        if d:
            x["data"] = data_iso(d.group(2))
            x["datat"] = d.group(1).lower().replace("aprovacao", "aprovação").replace("publicacao", "publicação")
        notas = [re.sub(r"^[●•]\s*", "", l).strip() for l in obs.split("\n") if l.strip().startswith(("●", "•"))]
        if notas:
            x["obs"] = notas
        rgs = sorted({int(n) for n in re.findall(r"Tema (\d+) de Repercuss", obs)})
        if rgs:
            x["rg"] = rgs
    tese = next((v for k, v in sec.items() if k.startswith("Tese de Repercuss")), "")
    if tese:
        x["teseRg"] = re.sub(r"^[●•]\s*", "", uma_linha(tese))
    prec = next((v for k, v in sec.items() if k.startswith("Precedente Representativo")), "")
    if prec:
        ref = re.findall(r"\[([^\]]{5,300})\]", limpo(prec))
        if ref:
            x["prec"] = ref[-1].strip()
    return x


def atualizar_sumulas(limite: int) -> dict:
    semente = ler(REGISTRO_SUMULAS, {})
    data_reg = semente.pop("atualizado", "")
    cache = {**semente, **ler(CACHE / "stf-sumulas.json", {})}
    sem_acesso = []
    lista = []
    for base, vinc in ((26, True), (30, False)):  # vinculantes primeiro
        try:
            itens = lista_sumulas(base)
        except Exception as e:  # noqa: BLE001
            log(f"  lista de súmulas do STF (base {base}): {e}")
            itens = []
            sem_acesso.append(base)
        if not itens:  # sem acesso: mantém o que já se tem
            itens = [{"id": v["id"], "n": v["n"], "st": v.get("st", "")} for v in cache.values() if bool(v.get("v")) == vinc]
        for it in itens:
            it["v"] = vinc
        lista += itens
    baixadas = 0
    out = []
    for it in lista:
        k = f"{'SV' if it['v'] else 'S'}{it['n']}"
        c = cache.get(k)
        if not c or c.get("id") != it["id"] or c.get("st", "") != it["st"] or not c.get("t"):
            if baixadas < limite and not sem_tempo():
                try:
                    det = sumula_detalhe(26 if it["v"] else 30, it["id"])
                    baixadas += 1
                    if det.get("t"):
                        c = {**it, **det}
                        cache[k] = c
                except Exception as e:  # noqa: BLE001
                    log(f"  súmula {k}/STF: {e}")
        if not c or not c.get("t"):
            continue
        c = {**c, "st": it["st"]}
        x = {"n": c["n"], "v": 1 if c.get("v") else 0, "t": c["t"], "sit": c["st"] or "vigente", "id": c["id"]}
        for f in ("data", "datat", "obs", "rg", "teseRg", "prec"):
            if c.get(f):
                x[f] = c[f]
        x["ar"], sa = areas_stf([], x["t"])
        if sa:
            x["sa"] = sa
        if not x["ar"]:
            del x["ar"]
        out.append(x)
    gravar(CACHE / "stf-sumulas.json", {k: v for k, v in cache.items() if semente.get(k) != v})
    out.sort(key=lambda s: (-s["v"], -s["n"]))
    if out:
        gravar(SAIDA / "stf-sumulas.json", out)
    log(f"STF: {sum(1 for s in out if not s['v'])} súmulas e {sum(1 for s in out if s['v'])} súmulas vinculantes; {baixadas} enunciado(s) baixado(s).")
    if not out:
        raise RuntimeError("portal do STF indisponível e sem registro de súmulas")
    return {"sumulas": len(out), "baixadas": baixadas, **({"origem": "registro", "dataRegistro": data_reg} if len(sem_acesso) == 2 else {})}


# ------------------------------------------------------------------ Informativo do STF
# Publicação oficial e aberta (www.stf.jus.br/arquivo/informativo): resumos dos julgamentos de destaque.
URL_INFORMATIVO = "https://www.stf.jus.br/arquivo/informativo/documento/informativo{}.htm"
URL_INFORMATIVO_ATUAL = "https://www.stf.jus.br/arquivo/informativo/documento/informativo.htm"
REGISTRO_INFORMATIVOS = FONTE / "informativos.json"
PRIMEIRA_EDICAO = 1004  # o registro semanal começa aqui; as edições 1 a 1003 ficam no arquivo fixo abaixo
ARQUIVO_ANTIGOS = FONTE / "informativos-antigos"  # um arquivo por ano (1996 a 2020), coletado uma única vez
INFORMATIVOS_REGISTRO: list[dict] = []  # julgados do registro, da última coleta (para exportar_registro)


def decodificar(b: bytes) -> str:
    """As edições mais recentes estão em UTF-8; as anteriores, em Windows-1252."""
    try:
        return b.decode("utf-8-sig")
    except UnicodeDecodeError:
        return b.decode("cp1252", errors="replace")


def paragrafos_html(b: bytes) -> list[tuple[str, list[str]]]:
    t = decodificar(b)
    out = []
    for m in re.finditer(r"(?is)<p\b[^>]*>(.*?)</p>", t):
        p = m.group(1)
        hrefs = [html.unescape(h) for h in re.findall(r"(?is)<a\b[^>]*href\s*=\s*[\"']?([^\"'\s>]+)", p)]
        p = re.sub(r"(?i)<br\s*/?>", " ", p)
        x = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", p))).strip()
        if x:
            out.append((x, hrefs))
    if len(out) < 40:  # edições sem <p> (texto separado por <br>)
        return [(x, []) for x in linhas_html(b)]
    return out


def data_dmy(s: str) -> str:
    m = re.search(r"(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)", s or "")
    return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else ""


def tema_do_titulo(t: str) -> int:
    m = re.search(r"Tema\s+([\d.]+)\s+RG", t)
    return int(m.group(1).replace(".", "")) if m else 0


def ler_informativo(n: int, b: bytes) -> list[dict]:
    ps = paragrafos_html(b)
    cab = " ".join(x for x, _ in ps[:12])
    m = re.search(r"Data de divulga[çc][ãa]o:\s*(\d{1,2})[º°o]?\s+de\s+(\w+)\s+de\s+(\d{4})", cab)
    if not m:
        raise RuntimeError(f"edição {n}: data de divulgação não encontrada")
    mes = MESES.index(m.group(2).lower()) + 1
    data = f"{m.group(3)}-{mes:02d}-{int(m.group(1)):02d}"
    # O corpo começa no segundo "1 PLENÁRIO" (o primeiro está no sumário, em caixa mista); em edições
    # mais antigas, em "1 INFORMATIVO" seguido de "1.1 Plenário".
    ini = next((i for i, (x, _) in enumerate(ps) if re.match(r"^1 ?-? ?(PLEN[ÁA]RIO|INFORMATIVO)$", x)), None)
    if ini is None:
        raise RuntimeError(f"edição {n}: corpo não encontrado")
    orgao, ramos, desc, cur, modo = "", [], [], None, ""
    julgados: list[dict] = []

    def fechar():
        nonlocal cur, modo
        if cur and cur.get("t") and cur.get("r"):
            cur["o"] = cur.get("o") or orgao
            julgados.append(cur)
        cur, modo = None, ""

    for x, hr in ps[ini:]:
        if x == "Sumário":
            fechar()
            continue
        if re.match(r"^2 (PLEN[ÁA]RIO VIRTUAL|INOVA)", x, re.I):  # fim do corpo: seções seguintes não são julgados
            fechar()
            break
        if re.match(r"^\d+ [A-ZÁÉÍÓÚÂÊÔÃÕÇ ]+$", x) and x == x.upper():
            fechar()
            nome = re.sub(r"^\d+ ", "", x)
            if nome.startswith("INOVA"):
                break
            orgao = "Plenário" if nome.startswith("PLEN") else "Turmas" if nome.startswith("TURMA") else orgao
            continue
        mo = re.match(r"^(?:\d+\.\d+ )?(Plenário|Primeira Turma|Segunda Turma)$", x, re.I)
        if mo and (cur is None or len(x) < 20):
            fechar()
            orgao = mo.group(1).title()
            continue
        if cur is None:
            if x == x.upper() and len(x) > 10 and not x.startswith("ODS"):
                cab_ramo = re.split(r"\s[–-]\s", x, maxsplit=1)
                ramos.append(cab_ramo[0].strip().capitalize())
                desc += [d.strip().capitalize() for d in (cab_ramo[1].split(";") if len(cab_ramo) > 1 else []) if d.strip()]
                continue
            if ramos and not x.startswith("ODS") and not re.match(r"^Resumo:?$", x, re.I):
                partes = re.split(r"\s[–-]\s", x)
                proc = partes[-1].strip() if len(partes) > 1 and re.search(r"\d", partes[-1]) and len(partes[-1]) < 500 else ""
                titulo = " – ".join(partes[:-1]).strip() if proc else x
                inc = next((re.search(r"incidente=(\d+)", h).group(1) for h in hr if "processos/detalhe.asp" in h and "incidente=" in h), "")
                cur = {"id": f"{n}-{len(julgados) + 1}", "n": n, "d": data, "o": orgao, "ra": list(dict.fromkeys(ramos)), "ds": list(dict.fromkeys(desc)), "t": titulo, "p": proc, "r": [], "nt": []}
                if tema_do_titulo(x):
                    cur["tema"] = tema_do_titulo(x)
                if inc:
                    cur["inc"] = inc
                ramos, desc = [], []
            continue
        if re.match(r"^ODS\b", x):
            cur["ods"] = re.sub(r"^ODS:?\s*", "", x).strip()
            continue
        if re.match(r"^Teses? fixadas?:?$", x, re.I):
            modo = "tese"
            cur.setdefault("ts", [])
            continue
        if re.match(r"^Resumo:?$", x, re.I):
            modo = "resumo"
            continue
        if re.match(r"^\(\d+\) ", x):
            cur["nt"].append(x)
            continue
        if re.match(r"^[A-Z][A-Za-z]{1,7}\s\d(?:(?!\.\s)[^\n]){0,400}?[\s,](?:relator|relatora|redator|redatora|rel\.)(?=\s|$)", x[:500]) and re.search(r"julgamento|julgado|Turma|Plenário", x):
            mr = re.search(r"(relator|relatora|rel\.)\s+(?:para o acórdão\s+)?((?:Ministra|Ministro|Min\.)\s+[^,]+)", x)
            cur["fe"] = x
            if mr:
                rel = mr.group(2).strip()
                fem = mr.group(1) == "relatora" or sem_acento(re.sub(r"^(Ministra|Ministro|Min\.)\s+", "", rel)).lower() in MULHERES
                cur["rel"] = re.sub(r"^(Ministra|Ministro|Min\.)", "Ministra" if fem else "Ministro", rel)
            mp = re.match(r"^(.+?),\s*(?:relator|relatora|rel\.)(?=\s)", x)
            if mp and not cur.get("p"):
                cur["p"] = mp.group(1).strip()
            jd = data_dmy(x)
            if jd:
                cur["jd"] = jd
            tm = re.search(r"(Primeira|Segunda) Turma", x)
            if tm and cur["o"] in ("Turmas", ""):
                cur["o"] = f"{tm.group(1)} Turma"
            fechar()
            continue
        (cur["ts"] if modo == "tese" else cur["r"]).append(x)
    fechar()
    return julgados


# --- Edições 1 a 1003 (1995 a janeiro de 2021): texto corrido; cada julgado é um título curto, um ou mais
# parágrafos e a identificação do processo (em linha própria ou no fim do último parágrafo).
SECAO_ANTIGA = re.compile(r"^(PLEN[ÁA]RIO|PLENO|PRIMEIRA TURMA|SEGUNDA TURMA|1[ªa] TURMA|2[ªa] TURMA|REPERCUSS[ÃA]O GERAL)\s*:?$", re.I)
FIM_ANTIGO = re.compile(
    r"^(TRANSCRI[ÇC][ÕO]ES|INOVA[ÇC][ÕO]ES (LEGISLATIVAS|NORMATIVAS)|CLIPPING.*|OUTRAS INFORMA[ÇC][ÕO]ES|PLEN[ÁA]RIO VIRTUAL EM EVID.*|SESS[ÕO]ES? VIRTUA.*|DADOS DO INFORMATIVO|"
    r"SESS[ÕO]ES(ORDIN.*|)|CLASSIFICA[ÇC][ÃA]O DE ASSUNTOS|LEGISLA[ÇC][ÃA]O|OUTROS ASSUNTOS|INFORMATIVO EM REDE|SESS[ÕO]ES ORDIN.*|JULGAMENTOS|PRA[ÇC]A DOS TR[ÊE]S PODERES.*|[ÍI]NDICE (SISTEM|NUM).*|ACESSE.*)$", re.I)
MULHERES = {"ellen gracie", "carmen lucia", "rosa weber"}
PARTICULAS = {"da", "de", "do", "das", "dos", "e"}


def linhas_html(b: bytes, colapsar: bool = True) -> list[str]:
    t = decodificar(b)
    m = re.search(r"(?is)<body[^>]*>(.*)</body>", t)
    t = m.group(1) if m else t
    t = re.sub(r"(?is)<(script|style)\b.*?</\1>", "", t)
    if colapsar:  # em muitas edições, as quebras de linha do código-fonte HTML são só quebras forçadas do texto
        t = re.sub(r"\s+", " ", t)
    t = re.sub(r"(?i)</?(p|div|tr|li|h\d|table|pre|td|br|center|blockquote|dd|dt|ul|ol)\b[^>]*>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", "", t)).replace("\xa0", " ")
    out: list[str] = []
    for x in (re.sub(r"[ \t\r\f]+", " ", y).strip() for y in t.split("\n")):
        if not x:
            continue
        # Linha cortada no meio da frase (quebra forçada no HTML): continua na seguinte.
        if out and (out[-1].endswith(",") or (x[0].islower() and not out[-1].endswith((".", ";", ":", "?", "!", "”", '"', ")")))):
            out[-1] = f"{out[-1]} {x}"
        else:
            out.append(x)
    return out


def data_antiga(s: str) -> str:
    """Data em d.m.aa, d/m/aa ou d.m.aaaa (ano de dois dígitos: 90 a 99 = 1900; 00 a 89 = 2000)."""
    m = re.search(r"(?<![\d.])(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?!\d)", s or "")
    if not m:
        return ""
    a = int(m.group(3))
    a = a + (1900 if a >= 90 else 2000) if a < 100 else a
    d, mes = int(m.group(1)), int(m.group(2))
    return f"{a}-{mes:02d}-{d:02d}" if 1 <= d <= 31 and 1 <= mes <= 12 else ""


def relator_antigo(x: str) -> str:
    red = re.search(r"(?i)\bred\.?\s*p/\s*o?\s*ac\.?(?:[óo]rd[ãa]o)?\s*(?:Min\.?|Ministr[oa])\s*([^,;(]+)", x)
    m = re.search(r"(?i)\brel(?:ator|atora)?\s*\.?\s*(?:orig\.?\s*)?(?:p/\s*o?\s*ac\.?(?:[óo]rd[ãa]o)?\s*)?(?:Min\.?|Ministr[oa])?\s*([^,;(]+)", x)
    g = red or m
    nome = re.sub(r"(?i)^(Min\.?|Ministr[oa])\s+", "", g.group(1).strip(" .")) if g else ""
    nome = re.sub(r"\s+\d{1,2}[./].*$", "", nome).strip(" .")
    if not nome or len(nome) > 45:
        return ""
    if nome.isupper() or nome.islower():
        nome = " ".join(p.lower() if p.lower() in PARTICULAS else p.capitalize() for p in nome.split())
    if nome.lower().startswith("presidente"):
        return "Presidente"
    return ("Ministra " if sem_acento(nome).lower() in MULHERES else "Ministro ") + nome


# Relatores do Informativo: forma única do nome (as edições antigas trazem variações e erros de digitação).
RELATORES = ["Marco Aurélio", "Gilmar Mendes", "Joaquim Barbosa", "Dias Toffoli", "Ricardo Lewandowski", "Cármen Lúcia",
             "Sepúlveda Pertence", "Ilmar Galvão", "Maurício Corrêa", "Carlos Velloso", "Luiz Fux", "Moreira Alves", "Ellen Gracie",
             "Eros Grau", "Celso de Mello", "Roberto Barroso", "Cezar Peluso", "Néri da Silveira", "Edson Fachin", "Octavio Gallotti",
             "Ayres Britto", "Sydney Sanches", "Rosa Weber", "Teori Zavascki", "Nelson Jobim", "Alexandre de Moraes", "Nunes Marques",
             "Menezes Direito", "Cristiano Zanin", "Flávio Dino", "André Mendonça", "Francisco Rezek", "Paulo Brossard", "Aldir Passarinho"]
APELIDOS_REL = {"carlos britto": "Ayres Britto", "carlos ayres britto": "Ayres Britto", "luis roberto barroso": "Roberto Barroso",
                "pertence": "Sepúlveda Pertence", "rezek": "Francisco Rezek", "luis roberto": "Roberto Barroso"}
MINISTRAS_REL = {"Cármen Lúcia", "Ellen Gracie", "Rosa Weber"}


def relator_canonico(rel: str) -> str:
    """"Ministro Mar-co Aurélio", "Ministro istra Ellen Gracie", "Ministra Carmén Lúcia" -> forma única; lixo -> ""."""
    import difflib
    if not rel:
        return ""
    t = re.sub(r"(?i)^\s*(ministr[oa]\s+)", "", rel.strip())
    if re.fullmatch(r"(?i)(istro\s+)?presidente", t):
        return "Presidente"
    t = re.sub(r"(?i)^(?:istr[oa]|in[áa]ri[oa]\)?|a\s+orig\.|a|:|\))\s*", "", t)
    t = re.sub(r"(?i)^(?:Min\.?|Mi\.)\s*", "", t)
    t = re.sub(r"(\w)-(\w)", r"\1\2", t)
    t = re.split(r"\s+(?:e\s|julgamento\b)|\s*[.;,]\s*\d|\.\d", t)[0].strip(" .")
    if not t:
        return ""
    k = sem_acento(t).lower()
    if k in APELIDOS_REL:
        nome = APELIDOS_REL[k]
    else:
        chaves = {sem_acento(n).lower(): n for n in RELATORES}
        if k in chaves:
            nome = chaves[k]
        else:
            m = difflib.get_close_matches(k, list(chaves), n=1, cutoff=0.82)
            if not m:
                return ""
            nome = chaves[m[0]]
    return ("Ministra " if nome in MINISTRAS_REL else "Ministro ") + nome



def linha_final_antiga(x: str) -> bool:
    """Linha de identificação do processo: "RE 454737/SP, rel. Min. Cezar Peluso, 18.9.2008. (RE-454737)"."""
    if len(x) > 600:
        return False
    if len(x) < 220 and re.search(r"\(\w{1,6}-\d+\)\s*$", x) and data_antiga(x):  # sem relator (ex.: "PSV 100/DF, 17.3.2016. (PSV-100)")
        return True
    m = re.search(r"(?i)\brel(?:ator|atora)?\b", x)
    return bool(m and m.start() <= 140 and re.search(r"\d", x[: m.start()]) and (data_antiga(x) or re.search(r"(?i)\bsess[ãa]o\b|\b(19|20)\d\d\b", x)))


def final_embutido(x: str) -> tuple[str, str]:
    """Separa do fim de um parágrafo a identificação do processo ("... . ADIn 561 DF, rel. Min. Celso de Mello, sessão de 23.08.95.")."""
    ms = list(re.finditer(r"(?i)\brel(?:ator|atora)?\b", x))
    if not ms or not data_antiga(x[ms[-1].start():]) or len(x) - ms[-1].start() > 260:
        return x, ""
    pre = x[: ms[-1].start()]
    cortes = [pre.rfind(c) + len(c) for c in (". ", ".) ", "; ", ".” ", ".\" ", ") ")]
    corte = max(cortes)
    if corte <= 0 or len(pre) - corte > 110 or not re.search(r"\d", pre[corte:]):
        return x, ""
    return x[:corte].strip(), x[corte:].strip()


def data_edicao_antiga(ls: list[str]) -> str:
    """Data do cabeçalho ("Brasília, 14 a 18 de dezembro de 2020") ou, quando há, a de divulgação; "" se ilegível."""
    i = next((k for k, x in enumerate(ls[:30]) if "Data de divulga" in x), None)
    if i is not None:
        t = " ".join(ls[i: i + 2])
    else:
        c = next((k for k, x in enumerate(ls[:14]) if re.search(r"(?i)\bN[º°o]\s*\.?\s*\d", x)), None)
        t = ls[c] if c is not None else ""
    t = re.sub(r"(\d)\s*de\b", r"\1 de", t.lower())
    t = re.sub(r"([a-zç])de\b", r"\1 de", t)
    ms = list(re.finditer(r"janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro", t))
    if not ms:
        return ""
    m = ms[-1]
    dia = re.search(r"(\d{1,2})[º°o]?\s*(?:de\s*)?$", t[: m.start()].strip())
    ano = re.findall(r"\b(19\d\d|20\d\d)\b", t[m.end():])
    if not dia or not ano:
        return ""
    mes = MESES.index("março" if m.group(0).startswith("mar") else m.group(0)) + 1
    return f"{ano[-1]}-{mes:02d}-{int(dia.group(1)):02d}"


def ler_informativo_antigo(n: int, b: bytes, data: str = "") -> list[dict]:
    """Lê a edição de duas formas (quebras do código-fonte como espaço ou como separador de parágrafo) e
    fica com a que identificar mais julgados; em empate aproximado, a primeira, de texto mais limpo."""
    l1 = linhas_html(b)
    data = data_edicao_antiga(l1) or data
    a = _ler_antigo(n, l1, data)
    c = _ler_antigo(n, linhas_html(b, False), data)
    pont = lambda r: sum(1 for j in r if j.get("p") or j.get("rel"))  # noqa: E731
    return a if pont(a) >= 0.9 * pont(c) else c


def _ler_antigo(n: int, ls: list[str], data: str = "") -> list[dict]:
    data = data_edicao_antiga(ls) or data
    if not data:
        raise RuntimeError(f"edição {n}: data não encontrada")
    # Início do corpo: primeiro título de seção em maiúsculas ("PLENÁRIO"); sem ele, a seção em caixa mista
    # depois do índice; sem ela, o título que antecede o primeiro parágrafo longo.
    ini = next((i for i, x in enumerate(ls) if i >= 8 and SECAO_ANTIGA.match(x) and x == x.upper() and not x.startswith("REPERCUSS")), None)
    if ini is None:
        ix = next((i for i, x in enumerate(ls) if re.match(r"(?i)^(ÍNDICE DE ASSUNTOS|SUMÁRIO)$", x)), 12)
        ini = next((i for i, x in enumerate(ls) if i > ix and re.match(r"(?i)^(Plen[áa]rio|Primeira Turma|Segunda Turma)$", x)), None)
    if ini is None:
        p1 = next((i for i, x in enumerate(ls) if i >= 8 and len(x) > 200), None)
        if p1 is None:
            raise RuntimeError(f"edição {n}: corpo não encontrado")
        ini = p1 - 1
    orgao, ramos, desc = "", [], []
    julgados: list[dict] = []
    cur: dict | None = None
    finais: list[str] = []

    def fechar():
        nonlocal cur, finais
        if cur and cur["r"]:
            if not finais:
                cur["r"][-1], fim = final_embutido(cur["r"][-1])
                if fim:
                    finais = [fim]
                if not cur["r"][-1]:
                    cur["r"].pop()
            junk = re.match(r"^(\d+ª parte|[\d./\s]+|—|\*.*|Em|Secretaria.*|DJE? .*|Coordenadoria.*)$", cur["t"], re.I) or (not finais and sum(map(len, cur["r"])) < 90)
            if cur["r"] and not junk:
                if finais:
                    procs = [re.split(r",?\s*(?:rel|relator)\b", f, maxsplit=1, flags=re.I)[0].strip(" ,.") for f in finais]
                    cur["p"] = "; ".join(dict.fromkeys(p for p in procs if p))[:200]
                    cur["fe"] = " | ".join(finais)
                    rel = relator_antigo(finais[0])
                    if rel:
                        cur["rel"] = rel
                    jd = data_antiga(finais[0])
                    if jd:
                        cur["jd"] = jd
                julgados.append(cur)
        cur, finais = None, []

    for x in ls[ini:]:
        if FIM_ANTIGO.match(x):
            break
        if re.match(r"(?i)^(\d+[ªa] )?Parte( \d+)?\s*:?$", x) or x in ("Download deste Informativo",) or x.upper().startswith("A ASSESSORIA DO MIN"):
            continue
        sec = SECAO_ANTIGA.match(x)
        if sec:
            fechar()
            nome = sec.group(1).upper()
            if nome.startswith("PLEN"):
                orgao = "Plenário"
            elif nome.startswith(("PRIMEIRA", "1")):
                orgao = "Primeira Turma"
            elif nome.startswith(("SEGUNDA", "2")):
                orgao = "Segunda Turma"
            ramos, desc = [], []
            continue
        if linha_final_antiga(x):
            if cur is not None and cur["r"]:
                finais.append(x)
            continue
        if cur is not None and finais:
            fechar()
        if re.match(r"^\(\d+\) ", x) and cur is not None:
            cur["nt"].append(x)
            continue
        if x.startswith("ODS:") and cur is not None:
            cur["ods"] = x[4:].strip()
            continue
        # Cabeçalho de ramo do Direito (edições a partir de 2017), em maiúsculas.
        if x == x.upper() and len(x) > 12 and re.match(r"^DIREITO\b", x) and cur is None or (x == x.upper() and re.match(r"^DIREITO\b", x) and len(x) < 160):
            fechar()
            partes = re.split(r"\s[–-]\s", x, maxsplit=1)
            ramos.append(partes[0].strip().capitalize())
            if len(partes) > 1:
                desc += [d.strip().capitalize() for d in partes[1].split(";") if d.strip()]
            continue
        eh_titulo = len(x) <= 200 and not x.endswith((".", ";", ":", "”", '"')) and not re.match(r"^\(?\d+\)", x)
        if eh_titulo and (cur is None or cur["r"]):
            fechar()
            titulo = re.sub(r"\s*[-:]$", "", x).strip()
            cur = {"id": f"{n}-{len(julgados) + 1}", "n": n, "d": data, "o": orgao, "ra": list(dict.fromkeys(ramos)), "ds": list(dict.fromkeys(desc)), "t": titulo, "p": "", "r": [], "nt": []}
            ramos, desc = [], []
        elif cur is not None:
            cur["r"].append(x)
    fechar()
    for k, j in enumerate(julgados, 1):
        j["id"] = f"{n}-{k}"
    return julgados


def gerar_antigos(pasta_htm: Path) -> dict:
    """Uso único: lê as edições 1 a 1003 baixadas em pasta_htm (informativoN.htm ou iN.htm) e grava
    fontes/stf/informativos-antigos/AAAA.json. Edições sem data legível recebem a data interpolada."""
    arqs: dict[int, Path] = {}
    for p in pasta_htm.glob("*.htm"):
        m = re.search(r"(\d+)", p.stem)
        if m and 1 <= int(m.group(1)) < PRIMEIRA_EDICAO:
            arqs[int(m.group(1))] = p
    datas: dict[int, str] = {}
    for n, p in arqs.items():
        d = data_edicao_antiga(linhas_html(p.read_bytes()))
        if d:
            datas[n] = d
    def vizinha(n: int) -> str:
        ant = max((k for k in datas if k < n), default=None)
        prox = min((k for k in datas if k > n), default=None)
        base = ant if ant is not None else prox
        if base is None:
            return ""
        return (dt.date.fromisoformat(datas[base]) + dt.timedelta(days=7 * (n - base))).isoformat()
    todos: list[dict] = []
    falhas: dict[int, str] = {}
    for n in sorted(arqs):
        try:
            b = arqs[n].read_bytes()
            novos = []
            if n >= 1000:  # a partir daqui o formato é o estruturado (Resumo, teses)
                try:
                    novos = ler_informativo(n, b)
                except Exception:  # noqa: BLE001
                    novos = []
            todos += novos or ler_informativo_antigo(n, b, "" if n in datas else vizinha(n))
        except Exception as e:  # noqa: BLE001
            falhas[n] = str(e)
    por_ano: dict[str, list[dict]] = {}
    for j in todos:
        por_ano.setdefault(j["d"][:4], []).append(j)
    ARQUIVO_ANTIGOS.mkdir(parents=True, exist_ok=True)
    for a, l in sorted(por_ano.items()):
        l.sort(key=lambda j: (j["n"], int(j["id"].split("-")[1])))
        corpo = ",\n".join(json.dumps(j, ensure_ascii=False, separators=(",", ":")) for j in l)
        (ARQUIVO_ANTIGOS / f"{a}.json").write_text(f'{{\n"atualizado":"{HOJE}",\n"julgados":[\n{corpo}\n]\n}}\n', encoding="utf-8")
    return {"edicoes": len(arqs), "julgados": len(todos), "anos": sorted(por_ano), "falhas": falhas, "sem_data": sorted(set(arqs) - set(datas))}


def json_linhas_informativos(julgados: list[dict], ultima: int) -> str:
    js = sorted(julgados, key=lambda j: (-j["n"], int(j["id"].split("-")[1])))
    corpo = ",\n".join(json.dumps(j, ensure_ascii=False, separators=(",", ":")) for j in js)
    return f'{{\n"atualizado":"{HOJE}",\n"ultima":{ultima},\n"julgados":[\n{corpo}\n]\n}}\n'


def julgados_antigos() -> list[dict]:
    """Edições 1 a 1003, guardadas à parte (fontes/stf/informativos-antigos/AAAA.json)."""
    out: list[dict] = []
    if ARQUIVO_ANTIGOS.is_dir():
        for arq in sorted(ARQUIVO_ANTIGOS.glob("*.json")):
            out += ler(arq, {}).get("julgados", [])
    return out


def saida_informativos(julgados: list[dict]) -> list[dict]:
    """Julgados ordenados e com as matérias do site (ar, sa), quando as rotinas do STJ estão carregadas."""
    out = []
    for j in sorted(julgados, key=lambda j: (-j["n"], int(j["id"].split("-")[1]))):
        x = dict(j)
        if x.get("rel"):
            x["rel"] = relator_canonico(x["rel"])
            if not x["rel"]:
                x.pop("rel")
        corpo = " ".join(j.get("ts", [])[:1]) or (j.get("r") or [""])[0][:300]
        ar, sa = areas_stf(j.get("ra", []), f"{j['t']} {' '.join(j.get('ds', []))} {corpo}")
        if ar:
            x["ar"] = ar
        if sa:
            x["sa"] = sa
        out.append(x)
    return out


def gravar_informativos_site(registro: list[dict]) -> int:
    """Grava os dados do site: recentes (2 últimos anos) em stf-informativos.json, os demais anos em
    stf-informativos/AAAA.json e o índice das edições (carregado antes de abrir qualquer ano)."""
    global INFORMATIVOS_REGISTRO
    INFORMATIVOS_REGISTRO = registro
    todos = saida_informativos(registro + julgados_antigos())
    por_ano: dict[str, list[dict]] = {}
    for x in todos:
        por_ano.setdefault((x.get("d") or "0000")[:4], []).append(x)
    ult_ano = max(por_ano)
    recentes_de = str(int(ult_ano) - 1)
    recentes = [x for a, l in por_ano.items() if a >= recentes_de for x in l]
    antigos = sorted(a for a in por_ano if a < recentes_de)
    gravar(SAIDA / "stf-informativos.json", sorted(recentes, key=lambda j: (-j["n"], int(j["id"].split("-")[1]))))
    pasta = SAIDA / "stf-informativos"
    if pasta.is_dir():
        for velho in pasta.glob("*.json"):
            velho.unlink()
    for a in antigos:
        gravar(pasta / f"{a}.json", por_ano[a])
    eds: dict[int, list[dict]] = {}
    for x in todos:
        eds.setdefault(x["n"], []).append(x)
    indice = []
    for n in sorted(eds, reverse=True):
        l = eds[n]
        ramos: dict[str, int] = {}
        for x in l:
            for r in (x.get("ar") or [])[:1]:
                ramos[r] = ramos.get(r, 0) + 1
        indice.append([n, l[0].get("d", ""), len(l), [r for r, _ in sorted(ramos.items(), key=lambda kv: -kv[1])[:3]],
                       [x["t"][:140] for x in sorted(l, key=lambda j: int(j["id"].split("-")[1]))[:2]]])
    corte = min(x["n"] for x in recentes)
    mat: dict[str, int] = {}
    for x in todos:
        for k in list(x.get("ar") or []) + list(x.get("sa") or []):
            mat[k] = mat.get(k, 0) + 1
    # Por relator: julgados, primeiro e último ano e as matérias mais frequentes (perfil do ministro na Composição).
    rels: dict[str, list] = {}
    for x in todos:
        r = x.get("rel")
        if not r or r == "Presidente":
            continue
        e = rels.setdefault(r, [0, "9999", "0000", {}])
        e[0] += 1
        a = (x.get("d") or "")[:4]
        if a:
            e[1], e[2] = min(e[1], a), max(e[2], a)
        for k in (x.get("ar") or [])[:1]:
            e[3][k] = e[3].get(k, 0) + 1
    rels_out = {r: [e[0], e[1], e[2], [k for k, _ in sorted(e[3].items(), key=lambda kv: -kv[1])[:4]]] for r, e in sorted(rels.items())}
    gravar(SAIDA / "stf-informativos-indice.json", {"corte": corte, "antigos": antigos, "mat": mat, "eds": indice, "rels": rels_out})
    return len(todos)


def atualizar_informativos(limite: int = 80) -> dict:
    """Edições novas do Informativo do STF (as já guardadas no registro não são baixadas de novo, salvo a última)."""
    reg = ler(REGISTRO_INFORMATIVOS, {})
    julgados = list(reg.get("julgados", []))
    ultima_reg = int(reg.get("ultima", 0))
    try:
        atual = baixar(URL_INFORMATIVO_ATUAL, 90)
        m = re.search(rb"N[\xba\xb0o]\s*(\d{4})/\d{4}", atual) or re.search(rb"informativo(\d{4})", atual)
        ultima = int(m.group(1)) if m else 0
        if not ultima:
            raise RuntimeError("número da edição atual não encontrado")
    except Exception as e:  # noqa: BLE001
        if not julgados:
            raise
        log(f"  Informativo do STF: {e}; usando o registro de {reg.get('atualizado', '?')}")
        total = gravar_informativos_site(julgados)
        return {"julgados": total, "origem": "registro", "dataRegistro": reg.get("atualizado", ""), "ultima": ultima_reg}
    de = max(PRIMEIRA_EDICAO, ultima_reg) if ultima_reg else PRIMEIRA_EDICAO  # a última do registro é baixada de novo (correções)
    baixadas = 0
    for n in range(de, ultima + 1):
        if baixadas >= limite or sem_tempo():
            break
        try:
            b = atual if n == ultima else baixar(URL_INFORMATIVO.format(n), 90)
            novos = ler_informativo(n, b)
        except Exception as e:  # noqa: BLE001
            log(f"  Informativo {n}/STF: {e}")
            continue
        julgados = [j for j in julgados if j["n"] != n] + novos
        baixadas += 1
        ultima_reg = max(ultima_reg, n)
        time.sleep(INTERVALO)
    total = gravar_informativos_site(julgados)
    log(f"STF: {total} julgados do Informativo (até a edição {ultima_reg}); {baixadas} edição(ões) baixada(s).")
    return {"julgados": total, "edicoes_baixadas": baixadas, "ultima": ultima_reg}


# ------------------------------------------------------------------ composição
def _miolo(t: str) -> tuple[str, str]:
    """Texto do corpo da página (entre "Última atualização" e o rodapé) e a data de atualização."""
    txt = limpo(re.sub(r"<(script|style)[\s\S]*?</\1>", "", t))
    i = txt.find("Última atualização")
    j = txt.find("Essa informação foi útil", i)
    corpo = txt[i: j if j > 0 else None] if i >= 0 else txt
    d = re.search(r"Última atualização:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})", corpo)
    data = (d.group(1) if "-" in d.group(1) else data_iso(d.group(1))) if d else ""
    return corpo, data


def _acha(linha: str, ministros: list[dict]) -> str:
    b = sem_acento(linha).lower()
    for m in ministros:
        if any(sem_acento(v).lower() in b for v in [m["curto"], *m.get("variantes", [])]):
            return m["id"]
    return ""


def ler_composicao_atual(t: str, ministros: list[dict]) -> tuple[list[str], dict]:
    """Ministros em exercício e cargos (Presidente, Vice-Presidente, Decano) da página "Composição atual"."""
    corpo, _ = _miolo(t)
    ids, cargos = [], {}
    linhas = [l.strip() for l in corpo.split("\n") if l.strip()]
    for i, l in enumerate(linhas):
        mid = _acha(l, ministros)
        # Nome depois de "Ministro"/"Ministra" que não está no registro: ministro novo (posse recente).
        if not mid and i and linhas[i - 1] in ("Ministro", "Ministra") and re.fullmatch(r"[A-ZÀ-Ý][\wÀ-ÿ'.]+(?: [\wÀ-ÿ'.]+){1,5}", l):
            novo = {"id": re.sub(r"[^a-z0-9]+", "-", sem_acento(l).lower()).strip("-"), "curto": l, "nome": l, "genero": "f" if linhas[i - 1] == "Ministra" else "m", "posse": "9999-12-31", "novo": True}
            ministros.append(novo)
            mid = novo["id"]
            log(f"  AVISO: ministro(a) do STF fora do registro: {l}. Acrescente-o(a) em fontes/stf/ministros.json.")
        if mid and mid not in ids:
            ids.append(mid)
            nxt = linhas[i + 1] if i + 1 < len(linhas) else ""
            c = re.match(r"^\((Presidente|Vice-Presidente|Decan[oa])\)$", nxt) or re.search(r"\((Presidente|Vice-Presidente|Decan[oa])\)", l)
            if c:
                cargos[mid] = c.group(1)
    return ids, cargos


def ler_turmas(t: str, ministros: list[dict]) -> dict:
    """Integrantes e presidentes das Turmas, da página oficial "Composição das Turmas"."""
    corpo, data = _miolo(t)
    out: dict = {"primeira-turma": [], "segunda-turma": []}
    atual = None
    for l in (l.strip() for l in corpo.split("\n")):
        b = sem_acento(l).lower()
        if re.fullmatch(r"primeira turma", b):
            atual = "primeira-turma"
            continue
        if re.fullmatch(r"segunda turma", b):
            atual = "segunda-turma"
            continue
        m = re.match(r"Secret[áa]ri[oa]:?\s*(.+)", l)
        if m:
            out["secretario"] = m.group(1).strip()
            atual = None
            continue
        mid = _acha(l, ministros) if atual else ""
        if mid:
            out[atual].append({"id": mid, "presidente": bool(re.search(r"-\s*Presidente\b", l))})
    if data:
        out["data"] = data
    return out


# ------------------------------------------------------------ perfis dos ministros (portal do STF)
URL_PASTA = "https://portal.stf.jus.br/textos/verTexto.asp?servico=bibliotecaConsultaProdutoBibliotecaPastaMinistro&pagina="
URL_GABINETE = "https://portal.stf.jus.br/textos/verTexto.asp?servico={}&pagina=principal"


def _data_br(s):
    m = re.search(r"(\d{1,2})º?/(\d{1,2})/(\d{4})", s)
    return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else ""


def ler_pagina_ministro(corpo: str) -> dict:
    """Página principal da pasta do ministro: naturalidade e datas (indicação, nomeação, posses)."""
    out = {"datas": []}
    for l in (x.strip() for x in corpo.split("\n")):
        m = re.match(r"Data de Nascimento\s*:\s*([\dº/]+)\s*,\s*(.+)$", l)
        if m:
            out["nascimento"] = _data_br(m.group(1))
            out["natural"] = m.group(2).strip().replace("/", " (", 1) + ")" if "/" in m.group(2) else m.group(2).strip()
            continue
        m = re.match(r"((?:Indicação|Nomeação|Posse)[^:]{3,140}?)\s*:\s*([\dº/]+)\s*$", l)
        if m and _data_br(m.group(2)):
            rot = re.sub(r"\s+", " ", m.group(1)).strip()
            rot = rot.replace("Supremo Tribunal Federal", "STF").replace("Conselho Nacional de Justiça", "CNJ").replace("Conselho Nacional de Justica", "CNJ")
            out["datas"].append([rot, _data_br(m.group(2))])
    out["datas"].sort(key=lambda x: x[1])
    return out


def ler_curriculo(corpo: str, html: str) -> dict:
    """Página "Currículo e Biografia": vaga ocupada e o currículo oficial (PDF), quando publicado."""
    out = {}
    t = re.sub(r"\s+", " ", corpo)
    m = re.search(r"vaga decorrente d[aoá]\s+(aposentadoria(?: voluntária)?|falecimento)\s+d[oa]\s+(?:então\s+)?(Ministr[oa])\s+([^.;,\[\]]+?)(?:[.;,]|\s+Diário)", t, re.I)
    if m:
        out["vaga"] = {"motivo": m.group(1).lower().replace(" voluntária", ""), "antecessor": f"{m.group(2)} {m.group(3).strip()}"}
    pdfs = [u for u in re.findall(r"https?://www\.stf\.jus\.br/arquivo/[^'\" <>]+?\.pdf", html, re.I) if not re.search(r"/\d{3}\.pdf$", u)]
    if pdfs:
        out["curriculo"] = pdfs[0].replace("http://", "https://")
    return out


def ler_gabinete(corpo: str) -> dict:
    """Página do gabinete: chefia, telefones e e-mails, com o rótulo de cada um (audiência, memoriais...)."""
    linhas = [re.sub(r"\s+", " ", x).strip() for x in corpo.split("\n")]
    linhas = [x for x in linhas if x and not re.search(r"pessoas já viram|^Última atualização|^\d{4}-\d{2}-\d{2}$", x)]
    out = {"emails": []}
    ctx_email: dict[str, str] = {}
    for i, l in enumerate(linhas):
        if re.match(r"^GABINETE\s+MINISTR", l, re.I):
            out["unidade"] = l.title().replace(" Do ", " do ").replace(" Da ", " da ").replace(" De ", " de ")
        m = re.match(r"^(?:Dr[a]?\.\s*)?(.+?)\s*[-–]\s*Chefe de Gabinete$", l, re.I)
        if m and "chefe" not in out:
            out["chefe"] = m.group(1).strip()
        m = re.match(r"^Chefe de Gabinete\s*:?\s*(.*)$", l, re.I)
        if m and "chefe" not in out:
            nome = m.group(1).strip() or (linhas[i + 1] if i + 1 < len(linhas) else "")
            if nome and not re.search(r"@|\d|:", nome):
                out["chefe"] = nome
        if re.search(r"telefone|contato", l, re.I) and re.search(r"\d{4}\s*-?\s*\d{3}", l) and "telefones" not in out:
            tel = re.sub(r"^.*?(?:telefones?(?: para contato)?|contato)\s*:?\s*", "", l, flags=re.I)
            tel = re.sub(r"\s*-\s*(?=\d{4})", "-", re.sub(r"\s*–\s*", "-", tel)).replace("61 - ", "(61) ").replace("61 3217", "(61) 3217")
            out["telefones"] = tel.strip(" .")
        for e in re.findall(r"[\w.+-]+@stf\.jus\.br", l):
            rot = re.split(r"\s*:\s*", l)[0] if ":" in l else ""
            rot = re.sub(r"(?i)^e-?mail\s*(institucional)?\s*(para)?\s*", "", rot).strip(" :-")
            if e in rot or len(rot) > 90:
                rot = ""
            ja = next((x for x in out["emails"] if x["e"] == e), None)
            if ja is None:
                out["emails"].append({"e": e, **({"rot": rot[0].upper() + rot[1:]} if rot else {})})
                if not rot and re.search(r"audi[êe]ncia", l, re.I):
                    ctx_email[e] = "Solicitação de audiência"
            elif rot and "rot" not in ja and len(l) < 160:
                ja["rot"] = rot[0].upper() + rot[1:]
    if "telefones" not in out:
        tel = next((re.search(r"\(?61\)?\s*-?\s*3217\s*-\s*\d{4}", x).group(0) for x in linhas if re.search(r"\(?61\)?\s*-?\s*3217\s*-\s*\d{4}", x)), "")
        if tel:
            out["telefones"] = tel
    if out.get("telefones"):
        t = re.sub(r"^\(?61\)?\s*-?\s*", "", out["telefones"])
        t = re.sub(r"/\s*(?:\(?61\)?\s*)?3217\s*-\s*", "/ ", t)  # "3217-4372 / 3217-4702" -> "3217-4372 / 4702"
        out["telefones"] = "(61) " + re.sub(r"\s*/\s*", " / ", t)
    for x in out["emails"]:
        if "rot" not in x and x["e"] in ctx_email:
            x["rot"] = ctx_email[x["e"]]
    if not out["emails"]:
        out.pop("emails")
    return out


def _slug(m: dict) -> str:
    return re.sub(r"[^A-Za-z]", "", sem_acento(m["curto"]).title().replace(" De ", " "))


URL_QUEM = "https://cms.stf.jus.br/post-sobreostf/quem-e-quem/"


def ler_quem_e_quem(t: str) -> dict:
    """Página "Quem é quem" do STF: contatos da Presidência e das Secretarias das Turmas."""
    x = re.sub(r"(?is)<(script|style).*?</\1>", "", t)
    x = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>|</h\d>|</td>|</tr>", "\n", x)
    linhas = [re.sub(r"\s+", " ", l).strip() for l in html.unescape(re.sub(r"<[^>]+>", "", x)).split("\n")]
    linhas = [l for l in linhas if l]
    out = {}
    for chave, tit in (("presidencia", "Gabinete da Presidência"), ("primeira-turma", "Primeira Turma"), ("segunda-turma", "Segunda Turma")):
        if tit not in linhas:
            continue
        i = linhas.index(tit)
        bloco = linhas[i + 1: i + 16]
        fim = next((k for k, l in enumerate(bloco) if k > 3 and l in ("Telefone", "Solicitação de audiência") and k + 1 < len(bloco) and not re.search(r"@|\d{4}", bloco[k + 1])), len(bloco) - 1)
        bloco = bloco[: fim + 1]
        d = {"nome": bloco[0], "cargo": bloco[1]} if len(bloco) > 2 else {}
        k = bloco.index("Contatos") + 1 if "Contatos" in bloco else bloco.index("Contato") + 1 if "Contato" in bloco else 3
        while k + 1 < len(bloco):
            v, rot = bloco[k], bloco[k + 1]
            if re.search(r"\d{4}", v):
                d["telefone"] = "(61) " + re.sub(r"\s*[–-]\s*", "-", re.sub(r"^\(?61\)?\s*", "", v))
            elif "@" in v:
                d.setdefault("emails", []).append({"e": v, "rot": rot})
            k += 2
        if d.get("telefone") or d.get("emails"):
            out[chave] = d
    return out


def coletar_perfis(ministros: list[dict], ids: list[str], anteriores: dict) -> dict:
    """Perfil oficial de cada ministro em exercício: página da pasta do ministro, currículo e gabinete.

    Uma página que falhar mantém o que já se sabia daquele ministro.
    """
    out = {}
    for m in ministros:
        if m["id"] not in ids:
            continue
        pasta = m.get("pasta") or _slug(m)
        gab = m.get("gab") or ("sobreStfMinistra" if m.get("genero") == "f" else "sobreStfMinistro") + _slug(m)
        ant = anteriores.get(m["id"], {})
        p = {k: v for k, v in ant.items()}
        try:
            corpo, _ = _miolo(decodificar(baixar(URL_PASTA + pasta + "Principal", 60)))
            novo = ler_pagina_ministro(corpo)
            if novo.get("datas"):
                p.update(novo)
            h = decodificar(baixar(URL_PASTA + pasta + "CurriculoBiografia", 60))
            corpo, _ = _miolo(h)
            p.update(ler_curriculo(corpo, h))
        except Exception as e:  # noqa: BLE001
            log(f"  perfil de {m['curto']}: {e}")
        try:
            corpo, data = _miolo(decodificar(baixar(URL_GABINETE.format(gab), 60)))
            g = ler_gabinete(corpo)
            if g.get("telefones") or g.get("emails"):
                p["gabinete"] = {**g, "url": URL_GABINETE.format(gab), **({"atualizado": data} if data else {})}
        except Exception as e:  # noqa: BLE001
            log(f"  gabinete de {m['curto']}: {e}")
        p["pasta"] = URL_PASTA + pasta + "Principal"
        out[m["id"]] = p
    return out


def foto_wd(qid: str, cache: dict) -> dict | None:
    if qid in cache:
        return cache[qid] or None
    try:
        ent = _C()._wd(f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json")["entities"][qid]
    except Exception as e:  # noqa: BLE001
        log(f"  Wikidata {qid}: {e}")
        return None
    p18 = ent.get("claims", {}).get("P18")
    res = {}
    if p18:
        arq = p18[0]["mainsnak"]["datavalue"]["value"].replace(" ", "_")
        res = {"url": "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(arq) + "?width=360",
               "credito": "Wikimedia Commons", "pagina": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(arq), "wd": qid}
    cache[qid] = res
    return res or None


def atualizar_composicao() -> dict:
    semente = ler(FONTE / "ministros.json", {})
    ministros = semente["ministros"]
    anterior = ler(SAIDA / "stf-composicao.json", {})
    origem = "portal do STF"
    data_registro = ""
    try:
        ids, cargos_pag = ler_composicao_atual(decodificar(baixar(URL_COMPOSICAO, 60)), ministros)
        turmas = ler_turmas(decodificar(baixar(URL_TURMAS, 60)), ministros)
        if len(ids) < 8 or len(turmas.get("primeira-turma", [])) < 3 or len(turmas.get("segunda-turma", [])) < 3:
            raise RuntimeError(f"página com formato inesperado ({len(ids)} ministros; turmas {[len(turmas.get(k, [])) for k in ('primeira-turma', 'segunda-turma')]})")
        ativos = set(ids)
        ordem_oficial = ids
    except Exception as e:  # noqa: BLE001
        # O portal recusa a rotina do GitHub. Vale o que a coleta fora do GitHub conferiu e guardou no registro
        # (ministros.json: ordem, cargos, turmas e a data da conferência).
        if semente.get("conferido") and semente.get("ordem"):
            log(f"  composição do STF: {e}; usa o registro, conferido em {semente['conferido']}")
            origem = "registro do Radar"
            ativos = set(semente["ordem"])
            ordem_oficial = list(semente["ordem"])
            turmas = semente.get("turmas", {})
            cargos_pag = semente.get("cargos", {})
            data_registro = semente["conferido"]
        else:
            log(f"  composição do STF: {e}; mantém a última conhecida")
            if anterior.get("ministros"):
                return {"ministros": len(anterior["ministros"]), "origem": "anterior"}
            origem = "registro do Radar"
            ativos = {m["id"] for m in ministros}
            turmas = semente.get("turmas", {})
            cargos_pag = semente.get("cargos", {})
            ordem_oficial = []
    cargos = cargos_pag
    lista = [m for m in ministros if m["id"] in ativos]
    lista.sort(key=lambda m: m["posse"])  # antiguidade no STF: data da posse
    cache_fotos = ler(CACHE / "fotos-stf.json", {})
    saida_min = []
    presid_turma = {k: next((x["id"] for x in v if x["presidente"]), "") for k, v in turmas.items() if isinstance(v, list)}
    nome_turma = {"primeira-turma": "Primeira Turma", "segunda-turma": "Segunda Turma"}
    for i, m in enumerate(lista, 1):
        orgs = [{"id": "plenario", "nome": "Plenário", **({"cargo": cargos[m["id"]]} if m["id"] in cargos else {})}]
        for k in ("primeira-turma", "segunda-turma"):
            if any(x["id"] == m["id"] for x in turmas.get(k, [])):
                orgs.append({"id": k, "nome": nome_turma[k], **({"cargo": "Presidente"} if presid_turma.get(k) == m["id"] else {})})
        foto = _C().foto_local(foto_wd(m["wd"], cache_fotos)) if m.get("wd") else None
        if not foto:
            ant = next((x for x in anterior.get("ministros", []) if x["id"] == m["id"]), {})
            if ant.get("foto") and (RAIZ / "site" / ant["foto"]["url"]).exists():
                foto = ant["foto"]
        pr = semente.get("perfis", {}).get(m["id"], {})
        perfil = {"nascimento": data_extenso(m["nascimento"])} if m.get("nascimento") else {}
        perfil.update({k: pr[k] for k in ("natural", "datas", "vaga", "curriculo", "pasta") if pr.get(k)})
        perfil.update({k: m[k] for k in ("formacao", "atuacao", "fonteCv") if m.get(k)})
        x = {"id": m["id"], "genero": m["genero"], "tipo": "ministro", "nome": m["nome"], "curto": m["curto"],
             "antiguidade": i, "posse": "" if m.get("novo") else m["posse"], "orgaos": orgs, "indicacao": m.get("indicacao", ""),
             "perfil": perfil, "pagina": m.get("pagina", ""), **({"gabinete": pr["gabinete"]} if pr.get("gabinete") else {})}
        if foto:
            x["foto"] = foto
        saida_min.append({k: v for k, v in x.items() if v not in ("", None, {})})
    gravar(CACHE / "fotos-stf.json", cache_fotos)
    # Plenário na ordem oficial do STF (Presidente, Vice-Presidente e os demais por antiguidade).
    plen = sorted(saida_min, key=lambda x: ordem_oficial.index(x["id"]) if x["id"] in ordem_oficial else 99 + x["antiguidade"])
    orgaos = [{"id": "plenario", "nome": "Plenário", "tipo": "plenario",
               "membros": [{"n": x["antiguidade"], "nome": x["nome"], "posse": x["posse"], "mid": x["id"], **({"cargo": cargos[x["id"]]} if x["id"] in cargos else {})} for x in plen]}]
    for k in ("primeira-turma", "segunda-turma"):
        membros = []
        for j, t in enumerate(turmas.get(k, []), 1):
            mm = next((x for x in saida_min if x["id"] == t["id"]), None)
            if mm:
                membros.append({"n": j, "nome": mm["nome"], "mid": mm["id"], **({"cargo": "Presidente"} if t["presidente"] else {})})
        orgaos.append({"id": k, "nome": nome_turma[k], "tipo": "julgador", "membros": membros})
    vagas = 11 - len(saida_min)
    obj = {"data": turmas.get("data", "") or HOJE, "origem": origem, "geradoEm": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
           "fontes": {"composicao": URL_COMPOSICAO, "turmas": URL_TURMAS}, "vagas": max(0, vagas),
           "secretarioTurmas": turmas.get("secretario", ""), "orgaos": orgaos, "ministros": saida_min,
           **({"contatos": semente["contatos"], "urlContatos": URL_QUEM} if semente.get("contatos") else {})}
    gravar(SAIDA / "stf-composicao.json", obj)
    novos = [m["curto"] for m in lista if m.get("novo")]
    log(f"STF: composição com {len(saida_min)} ministros ({origem}); {sum(1 for x in saida_min if x.get('foto'))} com foto.")
    return {"ministros": len(saida_min), "origem": origem, **({"dataRegistro": data_registro} if data_registro else {}), **({"foraDoRegistro": novos} if novos else {})}


def gravar_ministros(semente: dict) -> None:
    """Grava fontes/stf/ministros.json no mesmo desenho de sempre (um ministro por linha)."""
    j = lambda x: json.dumps(x, ensure_ascii=False)  # noqa: E731
    t = semente.get("turmas", {})
    corpo_t = ",\n".join(f'  {j(k)}: {j(t[k])}' for k in ("data", "primeira-turma", "segunda-turma", "secretario") if k in t)
    linhas = [
        "{",
        f' "_sobre": {j(semente["_sobre"])},',
        f' "atualizado": {j(semente["atualizado"])},',
        f' "conferido": {j(semente["conferido"])},',
        f' "ordem": {j(semente["ordem"])},',
        ' "ministros": [',
        ",\n".join(f"  {j(m)}" for m in semente["ministros"]),
        " ],",
        f' "cargos": {j(semente.get("cargos", {}))},',
        ' "turmas": {',
        corpo_t,
        " }" + ("," if semente.get("perfis") else ""),
    ]
    if semente.get("perfis"):
        pf = semente["perfis"]
        linhas += [' "perfis": {', ",\n".join(f"  {j(k)}: {j(pf[k])}" for k in pf), " }" + ("," if semente.get("contatos") else "")]
    if semente.get("contatos"):
        linhas[-1] = linhas[-1].rstrip(",") + "," if not semente.get("perfis") else linhas[-1]
        linhas.append(f' "contatos": {j(semente["contatos"])}')
    linhas.append("}")
    (FONTE / "ministros.json").write_text("\n".join(linhas) + "\n", encoding="utf-8")


def conferir_composicao() -> dict:
    """Coleta fora do GitHub: confere as páginas oficiais do STF e guarda o resultado no registro (ministros.json).

    O registro só é regravado quando algo mudou ou quando a última conferência tem mais de 6 dias, para não
    gerar envio à toa; o site mostra a data dessa conferência como a da verificação da composição.
    """
    semente = ler(FONTE / "ministros.json", {})
    trabalho = [dict(m) for m in semente["ministros"]]
    ids, cargos = ler_composicao_atual(decodificar(baixar(URL_COMPOSICAO, 60)), trabalho)
    turmas = ler_turmas(decodificar(baixar(URL_TURMAS, 60)), trabalho)
    if len(ids) < 8 or len(turmas.get("primeira-turma", [])) < 3 or len(turmas.get("segunda-turma", [])) < 3:
        raise RuntimeError(f"página com formato inesperado ({len(ids)} ministros; turmas {[len(turmas.get(k, [])) for k in ('primeira-turma', 'segunda-turma')]})")
    novos = [m["curto"] for m in trabalho if m.get("novo")]
    if novos:
        log("  AVISO: a composição oficial traz ministro(a) fora do registro; ministros.json não foi alterado.")
        return {"ministros": len(ids), "origem": "portal do STF", "foraDoRegistro": novos}
    perfis = coletar_perfis(trabalho, ids, semente.get("perfis", {}))
    contatos = semente.get("contatos", {})
    try:
        novos_c = ler_quem_e_quem(decodificar(baixar(URL_QUEM, 60)))
        if novos_c.get("primeira-turma") and novos_c.get("segunda-turma"):
            contatos = novos_c
    except Exception as e:  # noqa: BLE001
        log(f"  contatos (Quem é quem): {e}")
    mudou_perfis = perfis != semente.get("perfis", {}) or contatos != semente.get("contatos", {})
    mudou = ids != semente.get("ordem") or cargos != semente.get("cargos") or turmas != semente.get("turmas")
    try:
        idade = (dt.date.fromisoformat(HOJE) - dt.date.fromisoformat(semente.get("conferido", "2000-01-01"))).days
    except ValueError:
        idade = 999
    if mudou or mudou_perfis or idade >= 6:
        semente.update({"atualizado": HOJE, "conferido": HOJE, "ordem": ids, "cargos": cargos, "turmas": turmas, "perfis": perfis, "contatos": contatos})
        gravar_ministros(semente)
    log(f"STF: composição conferida nas páginas oficiais ({len(ids)} ministros; {'houve mudança' if mudou else 'sem mudança'}"
        f"{'; perfis atualizados' if mudou_perfis else ''}).")
    return {"ministros": len(ids), "origem": "portal do STF", "mudou": mudou, "perfis": len(perfis), **({"perfisMudaram": True} if mudou_perfis else {})}


# ------------------------------------------------------------ pauta do Plenário e das Turmas (portal do STF)
REGISTRO_PAUTA = FONTE / "pauta.json"
URL_PAUTA_SERV = f"{PORTAL}/pauta/services/calendario-service.asp"
URL_PAUTA_DIA = f"{PORTAL}/pauta/pesquisarCalendario.asp?data={{}}"
URL_PAUTA_VIRTUAL = "https://www.stf.jus.br/portal/pauta/listarJulgamentoVirtual.asp?dataInicio={}&dataFim={}"
NOME_COLEGIADO = {"TP": "Plenário", "1T": "Primeira Turma", "2T": "Segunda Turma"}


def _br_iso(s: str) -> str:
    d, m, a = s[:10].split("/")
    return f"{a}-{m}-{d}" + (s[10:] if len(s) > 10 else "")


def coletar_pauta() -> dict:
    """Sessões presenciais (Plenário e Turmas) e o calendário das sessões virtuais, dos serviços da página oficial
    "Pauta de julgamentos": da semana passada até o fim do mês seguinte ao próximo."""
    hoje = dt.date.fromisoformat(HOJE)
    meses, a, m = [], hoje.year, hoje.month
    for _ in range(3):
        meses.append((a, m))
        a, m = (a + 1, 1) if m == 12 else (a, m + 1)
    desde = (hoje - dt.timedelta(days=7)).isoformat()
    presenciais, virtuais = [], {}
    for a, m in meses:
        cal = json.loads(decodificar(baixar(f"{URL_PAUTA_SERV}?dados=calendarios&mes={m:02d}&ano={a}", 60)))
        for v in cal.get("julgamentosVirtuais", []):
            ini, fim = _br_iso(v["dataInicial"]), _br_iso(v["dataFinal"])
            if fim >= desde:
                virtuais[(ini, fim)] = {"ini": ini, "fim": fim, "TP": int(v.get("qtdProcessosPlenario") or 0),
                                        "1T": int(v.get("qtdPrimeiraTurma") or 0), "2T": int(v.get("qtdSegundaTurma") or 0)}
        for dia in cal.get("diasPresenciais", []):
            iso = f"{a}-{m:02d}-{int(dia):02d}"
            if iso < desde:
                continue
            br = f"{int(dia):02d}/{m:02d}/{a}"
            d = json.loads(decodificar(baixar(f"{URL_PAUTA_SERV}?dados=sessao-presencial&data={br}", 60)))
            for c in d.get("colegiados", []):
                for se in c.get("sessoes", []):
                    itens = []
                    for i in se.get("incidentes", []):
                        x = {"cl": i.get("classe") or "", "num": str(i.get("numero") or ""),
                             "rel": re.sub(r"^MIN(?:ISTR[OA])?\.?\s*", "", i.get("relator") or "").title().replace(" De ", " de ").replace(" Da ", " da ").replace(" Do ", " do ").replace(" Dos ", " dos ").replace(" E ", " e "),
                             "res": re.sub(r"\s+", " ", i.get("resumoTema") or "").strip()}
                        for k, rot in (("ministroVista", "vista"), ("destaque", "dest")):
                            if i.get(k):
                                x[rot] = re.sub(r"^MIN(?:ISTR[OA])?\.?\s*", "", i[k]).title().replace(" De ", " de ").replace(" Da ", " da ")
                        if i.get("repercussaoGeral") == "S":
                            x["rg"] = 1
                        if i.get("materiaRelevante") == "S":
                            x["relev"] = 1
                        if i.get("cadeia"):
                            x["cadeia"] = i["cadeia"]
                        itens.append({k: v for k, v in x.items() if v not in ("", None)})
                    presenciais.append({"d": iso, "o": c.get("codigo") or "", "nome": c.get("descricao") or NOME_COLEGIADO.get(c.get("codigo"), ""),
                                        "ini": _br_iso(se.get("dataInicio") or br), "tipo": {"E": "extraordinária", "O": "ordinária"}.get(se.get("tipo"), ""),
                                        "num": f"{se.get('numero')}/{se.get('ano')}" if se.get("numero") else "", **({"obs": se["observacao"]} if se.get("observacao") else {}),
                                        "itens": itens})
    presenciais.sort(key=lambda x: (x["ini"], x["o"]))
    # Temas de repercussão geral ainda sem tese: sessões (virtuais ou presenciais) em que o paradigma está pautado.
    temas_pauta = []
    reg_t = ler(REGISTRO_TEMAS, {}).get("temas", [])
    pend = [t for t in reg_t if not t.get("tese") and t.get("rgs") != "nao" and "Cancelado" not in (t.get("sit") or "")]
    for t in pend:
        m = re.match(r"([A-Z]{2,5})\s*([\d.]+)", t.get("lc") or "")
        if not m:
            continue
        cl, num = m.group(1), m.group(2).replace(".", "")
        try:
            hist = json.loads(decodificar(baixar(f"{PORTAL}/pauta/services/processo-service.asp?classe={cl}&numero={num}", 40)) or "[]")
        except Exception as e:  # noqa: BLE001
            log(f"  pauta do Tema {t['n']}: {e}")
            continue
        vistos = set()
        for g in hist if isinstance(hist, list) else []:
            for x in g.get("processos", []):
                fim = _br_iso(x.get("dataFim") or x.get("dataSessao") or "01/01/2000")[:10]
                ini = _br_iso(x.get("dataInicio") or x.get("dataSessao") or "01/01/2000")[:10]
                if fim < desde or (ini, x.get("codigoColegiado")) in vistos:
                    continue
                vistos.add((ini, x.get("codigoColegiado")))
                temas_pauta.append({"tema": t["n"], "cl": cl, "num": num, "ini": ini, "fim": fim, "o": x.get("codigoColegiado") or "TP",
                                    "amb": "virtual" if x.get("ambienteSessao") == "V" else "presencial"})
    out = {"conferido": HOJE, "presenciais": presenciais, "virtuais": sorted(virtuais.values(), key=lambda v: v["ini"]),
           "temas": sorted(temas_pauta, key=lambda x: (x["ini"], x["tema"]))}
    REGISTRO_PAUTA.write_text(json_pauta(out), encoding="utf-8")
    log(f"STF: pauta conferida ({len(presenciais)} sessões presenciais, {sum(len(x['itens']) for x in presenciais)} processos; {len(virtuais)} sessões virtuais; "
        f"{len(temas_pauta)} pauta(s) de temas de RG sem tese).")
    return {"sessoes": len(presenciais), "processos": sum(len(x["itens"]) for x in presenciais), "virtuais": len(virtuais)}


def json_pauta(o: dict) -> str:
    j = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":"))  # noqa: E731
    pres = ",\n".join(j(x) for x in o["presenciais"])
    virt = ",\n".join(j(x) for x in o["virtuais"])
    tem = ",\n".join(j(x) for x in o.get("temas", []))
    return f'{{\n"conferido":"{o["conferido"]}",\n"presenciais":[\n{pres}\n],\n"virtuais":[\n{virt}\n],\n"temas":[\n{tem}\n]\n}}\n'


def atualizar_pauta() -> dict:
    """Pauta do STF no site: coleta direta quando o portal responde; senão, o registro da coleta fora do GitHub.
    Liga cada recurso extraordinário com repercussão geral ao tema do qual é paradigma."""
    origem = "portal do STF"
    try:
        r = coletar_pauta()
    except Exception as e:  # noqa: BLE001
        log(f"  pauta do STF: {e}; usa o registro")
        origem = "registro"
        r = {}
    reg = ler(REGISTRO_PAUTA, {})
    if not reg.get("presenciais") and not reg.get("virtuais"):
        return {"erro": "pauta sem dados"}
    temas = ler(SAIDA / "stf-temas.json", [])
    por_lc = {}
    for t in temas:
        m = re.match(r"([A-Z]{2,5})\s*([\d.]+)", t.get("lc") or "")
        if m:
            por_lc[(m.group(1), m.group(2).replace(".", ""))] = t["n"]
    for se in reg.get("presenciais", []):
        for x in se["itens"]:
            n = por_lc.get((x["cl"], x["num"]))
            if n:
                x["tema"] = n
    reg["urls"] = {"dia": URL_PAUTA_DIA, "virtual": URL_PAUTA_VIRTUAL}
    gravar(SAIDA / "stf-pauta.json", reg)
    n = sum(len(x["itens"]) for x in reg.get("presenciais", []))
    return {"processos": n, "sessoes": len(reg.get("presenciais", [])), "origem": origem, **({"dataRegistro": reg.get("conferido", "")} if origem == "registro" else {})}


# ------------------------------------------------------------ notícias do STF (portal de notícias, WordPress)
URL_NOTICIAS = "https://noticias.stf.jus.br/wp-json/wp/v2/postsnoticias?per_page=30&_embed=wp:featuredmedia"
REGISTRO_NOTICIAS = FONTE / "noticias.json"
PASTA_FOTOS_NOT = SAIDA / "noticias"
# Fora do carrossel: avisos institucionais, campanhas, eventos e a pauta do dia (que já tem página própria).
NOT_FORA = re.compile(r"(?i)^nota d|ilumina|campanha|moot|inscri[çc]|concurso|semin[áa]rio|congresso|palestra|exposi[çc]|"
                      r"direito sem juridiqu|confira a pauta|r[áa]dio|tv justi[çc]a|podcast|visita|homenage|posse d[eo]s? servidor")
NOT_JUR = re.compile(r"(?i)\b(ADI|ADC|ADO|ADPF|RE|ARE|HC|MS|Rcl|Pet|Inq|AP|tema|repercuss[ãa]o|plen[áa]rio|turma|ministr[oa]|relator|decis[ãa]o|julg|"
                     r"mant[ée]m|valida|fixa|derruba|suspende|nega|analisa|inconstitucional|constitucional)")


def _limpo_html(t: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t or ""))).strip()


def coletar_noticias() -> list[dict]:
    """Últimas notícias do STF sobre julgamentos, com a foto de destaque (tamanho médio) e o crédito."""
    dados = json.loads(decodificar(baixar(URL_NOTICIAS, 60)))
    out = []
    for x in dados:
        tit = _limpo_html(x.get("title", {}).get("rendered", ""))
        res = _limpo_html(x.get("excerpt", {}).get("rendered", ""))
        if not tit or NOT_FORA.search(tit) or not NOT_JUR.search(f"{tit} {res}"):
            continue
        fm = ((x.get("_embedded") or {}).get("wp:featuredmedia") or [{}])[0] or {}
        tam = (fm.get("media_details") or {}).get("sizes") or {}
        foto = next((tam[k]["source_url"] for k in ("large", "medium_large", "full") if k in tam and tam[k].get("width", 9999) <= 1100), "")
        cred = _limpo_html((fm.get("caption") or {}).get("rendered", ""))
        out.append({"id": x["id"], "d": x.get("date", "")[:16].replace("T", " "), "t": tit, "r": res, "url": x.get("link", ""),
                    **({"foto": foto} if foto else {}), **({"cred": cred} if cred else {}), **({"alt": fm["alt_text"]} if fm.get("alt_text") else {})})
        if len(out) >= 8:
            break
    if len(out) < 2:
        raise RuntimeError(f"só {len(out)} notícia(s) aproveitável(is)")
    return out


REGISTRO_FUNDOS = RAIZ / "fontes" / "carrossel-fundos.json"
PASTA_FUNDOS = SAIDA / "fundos"


def baixar_fundos() -> int:
    """Fotos institucionais (Flickr oficial do STF e do STJ) de fundo dos destaques do carrossel sem foto própria.
    A lista fica em fontes/carrossel-fundos.json; baixa só as que faltam e grava a relação em site/data."""
    lista = ler(REGISTRO_FUNDOS, {}).get("fotos", [])
    PASTA_FUNDOS.mkdir(parents=True, exist_ok=True)
    ok, usadas = [], set()
    def obter(url: str, arq: Path, limite: int) -> bool:
        if arq.exists():
            return True
        try:
            b = baixar(url, 60, 2)
            if b[:3] != b"\xff\xd8\xff":
                raise ValueError("resposta sem imagem")
            if len(b) > limite:
                raise ValueError(f"imagem grande demais ({len(b)} bytes)")
            arq.write_bytes(b)
            return True
        except Exception as e:  # noqa: BLE001
            log(f"  foto de fundo {arq.name}: {e}")
            return False
    for f in lista:
        arq = PASTA_FUNDOS / f"{f['id']}.jpg"
        if not obter(f["url"], arq, 700_000):
            continue
        usadas.add(arq.name)
        # Versão maior (1600 px) para telas de alta densidade; opcional.
        arq_g = PASTA_FUNDOS / f"{f['id']}-g.jpg"
        tem_g = bool(f.get("urlG")) and obter(f["urlG"], arq_g, 1_000_000)
        if tem_g:
            usadas.add(arq_g.name)
        ok.append({"f": f"data/fundos/{arq.name}", **({"g": f"data/fundos/{arq_g.name}"} if tem_g else {}), "trib": f["trib"], "cred": f"{f['cred']} ({f['lic']})" if f.get("lic") and f["lic"] != "domínio público" else f["cred"], "alt": f.get("alt", "")})
    for velho in PASTA_FUNDOS.glob("*.jpg"):
        if velho.name not in usadas:
            velho.unlink()
    gravar(SAIDA / "carrossel-fundos.json", ok)
    return len(ok)


def atualizar_noticias() -> dict:
    """Notícias do STF no site (carrossel da Visão geral). Coleta direta; se o portal recusar, o registro da coleta
    fora do GitHub. As fotos são copiadas para o próprio site (a política de conteúdo não carrega imagens de fora)."""
    try:
        fundos = baixar_fundos()
    except Exception as e:  # noqa: BLE001
        log(f"  fotos de fundo: {e}")
        fundos = 0
    origem = "portal do STF"
    try:
        nots = coletar_noticias()
        REGISTRO_NOTICIAS.write_text(json.dumps({"atualizado": HOJE, "noticias": nots}, ensure_ascii=False, indent=0), encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        log(f"  notícias do STF: {e}; usa o registro")
        origem = "registro"
        nots = ler(REGISTRO_NOTICIAS, {}).get("noticias", [])
    if not nots:
        return {"erro": "sem notícias", "fundos": fundos}
    PASTA_FOTOS_NOT.mkdir(parents=True, exist_ok=True)
    usadas = set()
    for n in nots:
        if not n.get("foto"):
            continue
        arq = PASTA_FOTOS_NOT / f"{n['id']}-l.jpg"  # tamanho grande (1024 px), para o carrossel ampliado
        if not arq.exists():
            try:
                b = baixar(n["foto"], 60)
                if b[:3] != b"\xff\xd8\xff" and b[:4] != b"\x89PNG":
                    raise ValueError("resposta sem imagem")
                if len(b) > 600_000:
                    raise ValueError(f"imagem grande demais ({len(b)} bytes)")
                arq.write_bytes(b)
            except Exception as e:  # noqa: BLE001
                log(f"  foto da notícia {n['id']}: {e}")
                continue
        n["img"] = f"data/noticias/{arq.name}"
        usadas.add(arq.name)
    for velho in PASTA_FOTOS_NOT.glob("*.jpg"):
        if velho.name not in usadas:
            velho.unlink()
    gravar(SAIDA / "stf-noticias.json", [{k: v for k, v in n.items() if k != "foto"} for n in nots])
    return {"noticias": len(nots), "fotos": len(usadas), "fundos": fundos, "origem": origem,
            **({"dataRegistro": ler(REGISTRO_NOTICIAS, {}).get("atualizado", "")} if origem == "registro" else {})}


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--teses", type=int, default=2000, help="máximo de teses baixadas nesta execução")
    ap.add_argument("--sumulas", type=int, default=1000, help="máximo de enunciados de súmula baixados nesta execução")
    ap.add_argument("--minutos", type=int, default=25, help="tempo máximo para baixar teses e enunciados")
    ap.add_argument("--so", default="", help="temas, sumulas, informativos, composicao, pauta ou noticias (padrão: todos)")
    ap.add_argument("--exportar", action="store_true", help="grava o registro em fontes/stf/ (temas e súmulas)")
    ap.add_argument("--coletar", action="store_true", help="coleta temas e súmulas só para o registro (fora do GitHub), sem as rotinas do STJ, e já o exporta")
    ap.add_argument("--preparar", action="store_true", help="usa o registro como base de comparação (coleta fora do GitHub)")
    args = ap.parse_args()
    if args.exportar:
        return exportar_registro()
    if args.preparar:
        return preparar_base()
    global TEMPO_MAX, SO_REGISTRO
    TEMPO_MAX = args.minutos * 60
    res = {}
    if args.coletar:
        SO_REGISTRO = True
        preparar_base()
        for nome, f in (("temas", lambda: atualizar_temas(args.teses)), ("sumulas", lambda: atualizar_sumulas(args.sumulas)), ("informativos", atualizar_informativos)):
            try:
                res[nome] = f()
            except Exception as e:  # noqa: BLE001
                log(f"STF ({nome}): falhou: {e}")
                res[nome] = {"erro": str(e)[:200]}
        try:
            nots = coletar_noticias()
            REGISTRO_NOTICIAS.write_text(json.dumps({"atualizado": HOJE, "noticias": nots}, ensure_ascii=False, indent=0), encoding="utf-8")
            res["noticias"] = {"noticias": len(nots)}
        except Exception as e:  # noqa: BLE001
            log(f"STF (notícias): não coletadas: {e}")
            res["noticias"] = {"erro": str(e)[:200]}
        try:
            res["pauta"] = coletar_pauta()
        except Exception as e:  # noqa: BLE001
            log(f"STF (pauta): não conferida: {e}")
            res["pauta"] = {"erro": str(e)[:200]}
        try:
            res["composicao"] = conferir_composicao()
        except Exception as e:  # noqa: BLE001
            log(f"STF (composicao): não conferida: {e}")  # não impede o envio dos demais
            res["composicao"] = {"erro": str(e)[:200]}
        falhou = [n for n, r in res.items() if n not in ("composicao", "pauta", "noticias") and ("erro" in r or r.get("origem") == "registro")]
        if falhou:
            log(f"COLETA NÃO REALIZADA: portal do STF indisponível para {', '.join(falhou)}; registro mantido.")
            raise SystemExit(2)
        exportar_registro()
        log("COLETA CONCLUÍDA: " + json.dumps(res, ensure_ascii=False))
        return
    for nome, f in (("temas", lambda: atualizar_temas(args.teses)), ("sumulas", lambda: atualizar_sumulas(args.sumulas)), ("informativos", atualizar_informativos), ("composicao", atualizar_composicao), ("pauta", atualizar_pauta), ("noticias", atualizar_noticias)):
        if args.so and nome != args.so:
            continue
        try:
            res[nome] = f()
        except Exception as e:  # noqa: BLE001
            log(f"STF ({nome}): falhou: {e}")  # o site continua com os dados da execução anterior
            res[nome] = {"erro": str(e)[:200]}
    gravar(CACHE / "stf-resumo.json", {"em": HOJE, **res})
    # Situação de cada fonte do STF no manifesto do site (a data só avança quando a coleta dá certo).
    man_arq = SAIDA / "manifest.json"
    man = ler(man_arq, None)
    if man is not None:
        agora = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        ant = man.get("stf", {})
        stf = {}
        for nome in ("temas", "sumulas", "informativos", "composicao", "pauta", "noticias"):
            r = res.get(nome)
            reg = r and "erro" not in r and r.get("origem") in ("registro", "registro do Radar")
            if reg and ant.get(nome) and ant[nome].get("origem") != "registro":
                stf[nome] = ant[nome]  # a última coleta direta continua valendo
            elif reg:
                stf[nome] = {"em": (r.get("dataRegistro") or HOJE) + "T12:00:00+00:00", "origem": "registro", **{k: v for k, v in r.items() if k not in ("origem", "dataRegistro")}}
            elif r and "erro" not in r and r.get("origem") != "anterior":
                stf[nome] = {"em": agora, **{k: v for k, v in r.items() if k != "origem"}}
            elif ant.get(nome):
                stf[nome] = ant[nome]
        if (SAIDA / "stf-temas.json").exists():
            man["stf"] = stf
            man_arq.write_text(json.dumps(man, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
