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
    inf = ler(SAIDA / "stf-informativos.json", [])
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
PRIMEIRA_EDICAO = 1184  # edições anteriores não são coletadas (limite de tamanho do site)


def paragrafos_html(b: bytes) -> list[tuple[str, list[str]]]:
    t = b.decode("cp1252", errors="replace")
    out = []
    for m in re.finditer(r"(?is)<p\b[^>]*>(.*?)</p>", t):
        p = m.group(1)
        hrefs = [html.unescape(h) for h in re.findall(r"(?is)<a\b[^>]*href\s*=\s*[\"']?([^\"'\s>]+)", p)]
        p = re.sub(r"(?i)<br\s*/?>", " ", p)
        x = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", p))).strip()
        if x:
            out.append((x, hrefs))
    return out


def data_dmy(s: str) -> str:
    m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", s or "")
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else ""


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
    ini = next((i for i, (x, _) in enumerate(ps) if re.match(r"^1 (PLEN[ÁA]RIO|INFORMATIVO)$", x)), None)
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
                cab_ramo = x.split(" – ", 1)
                ramos.append(cab_ramo[0].strip().capitalize())
                desc += [d.strip().capitalize() for d in (cab_ramo[1].split(";") if len(cab_ramo) > 1 else []) if d.strip()]
                continue
            if ramos and not x.startswith("ODS") and x != "Resumo:":
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
        if x.startswith("ODS:"):
            cur["ods"] = x[4:].strip()
            continue
        if re.match(r"^Teses? fixadas?:?$", x, re.I):
            modo = "tese"
            cur.setdefault("ts", [])
            continue
        if x == "Resumo:":
            modo = "resumo"
            continue
        if re.match(r"^\(\d+\) ", x):
            cur["nt"].append(x)
            continue
        if re.match(r"^[A-Z][A-Za-z]{1,7}\s\d(?:(?!\.\s)[^\n]){0,400}?\s(?:relator|relatora|redator|redatora)\b", x[:500]) and re.search(r"julgamento|julgado|Turma|Plenário", x):
            mr = re.search(r"(?:relator|relatora)\s+(?:para o acórdão\s+)?((?:Ministra|Ministro)\s+[^,]+)", x)
            cur["fe"] = x
            if mr:
                cur["rel"] = mr.group(1).strip()
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


def json_linhas_informativos(julgados: list[dict], ultima: int) -> str:
    js = sorted(julgados, key=lambda j: (-j["n"], int(j["id"].split("-")[1])))
    corpo = ",\n".join(json.dumps(j, ensure_ascii=False, separators=(",", ":")) for j in js)
    return f'{{\n"atualizado":"{HOJE}",\n"ultima":{ultima},\n"julgados":[\n{corpo}\n]\n}}\n'


def saida_informativos(julgados: list[dict]) -> list[dict]:
    """Julgados ordenados e com as matérias do site (ar, sa), quando as rotinas do STJ estão carregadas."""
    out = []
    for j in sorted(julgados, key=lambda j: (-j["n"], int(j["id"].split("-")[1]))):
        x = dict(j)
        ar, sa = areas_stf(j.get("ra", []), f"{j['t']} {' '.join(j.get('ds', []))} {' '.join(j.get('ts', [])[:1])}")
        if ar:
            x["ar"] = ar
        if sa:
            x["sa"] = sa
        out.append(x)
    return out


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
        gravar(SAIDA / "stf-informativos.json", saida_informativos(julgados))
        return {"julgados": len(julgados), "origem": "registro", "dataRegistro": reg.get("atualizado", ""), "ultima": ultima_reg}
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
    gravar(SAIDA / "stf-informativos.json", saida_informativos(julgados))
    log(f"STF: {len(julgados)} julgados do Informativo (até a edição {ultima_reg}); {baixadas} edição(ões) baixada(s).")
    return {"julgados": len(julgados), "edicoes_baixadas": baixadas, "ultima": ultima_reg}


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
    try:
        ids, cargos_pag = ler_composicao_atual(decodificar(baixar(URL_COMPOSICAO, 60)), ministros)
        turmas = ler_turmas(decodificar(baixar(URL_TURMAS, 60)), ministros)
        if len(ids) < 8 or len(turmas.get("primeira-turma", [])) < 3 or len(turmas.get("segunda-turma", [])) < 3:
            raise RuntimeError(f"página com formato inesperado ({len(ids)} ministros; turmas {[len(turmas.get(k, [])) for k in ('primeira-turma', 'segunda-turma')]})")
        ativos = set(ids)
        ordem_oficial = ids
    except Exception as e:  # noqa: BLE001
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
        x = {"id": m["id"], "genero": m["genero"], "tipo": "ministro", "nome": m["nome"], "curto": m["curto"],
             "antiguidade": i, "posse": "" if m.get("novo") else m["posse"], "orgaos": orgs, "indicacao": m.get("indicacao", ""),
             "perfil": {"nascimento": data_extenso(m["nascimento"])} if m.get("nascimento") else {},
             "pagina": m.get("pagina", "")}
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
           "secretarioTurmas": turmas.get("secretario", ""), "orgaos": orgaos, "ministros": saida_min}
    gravar(SAIDA / "stf-composicao.json", obj)
    novos = [m["curto"] for m in lista if m.get("novo")]
    log(f"STF: composição com {len(saida_min)} ministros ({origem}); {sum(1 for x in saida_min if x.get('foto'))} com foto.")
    return {"ministros": len(saida_min), "origem": origem, **({"foraDoRegistro": novos} if novos else {})}


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--teses", type=int, default=2000, help="máximo de teses baixadas nesta execução")
    ap.add_argument("--sumulas", type=int, default=1000, help="máximo de enunciados de súmula baixados nesta execução")
    ap.add_argument("--minutos", type=int, default=25, help="tempo máximo para baixar teses e enunciados")
    ap.add_argument("--so", default="", help="temas, sumulas, informativos ou composicao (padrão: todos)")
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
        falhou = [n for n, r in res.items() if "erro" in r or r.get("origem") == "registro"]
        if falhou:
            log(f"COLETA NÃO REALIZADA: portal do STF indisponível para {', '.join(falhou)}; registro mantido.")
            raise SystemExit(2)
        exportar_registro()
        log("COLETA CONCLUÍDA: " + json.dumps(res, ensure_ascii=False))
        return
    for nome, f in (("temas", lambda: atualizar_temas(args.teses)), ("sumulas", lambda: atualizar_sumulas(args.sumulas)), ("informativos", atualizar_informativos), ("composicao", atualizar_composicao)):
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
        for nome in ("temas", "sumulas", "informativos", "composicao"):
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
