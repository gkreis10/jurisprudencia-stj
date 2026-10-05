"""Notícias do STJ para o carrossel da Visão geral.

Lê o feed oficial de notícias do STJ (RSS), que o Tribunal oferece para leitura por programas e aplicativos
(https://www.stj.jus.br/sites/portalp/Comunicacao/conte%C3%BAdos-por-feed-(rss)). Um único acesso por execução.
Grava site/data/stj-noticias.json (título, resumo, data e link de cada notícia) e registra a data no manifesto.
Se o feed não responder, nada é alterado e o site segue sem as notícias do STJ (ou com as da execução anterior).
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

URL = "https://res.stj.jus.br/hrestp-c-portalp/RSS.xml"
UA = "jurisprudencia-stj-site/1.0 (+atualizacao automatica de dados abertos)"
SAIDA = Path(__file__).resolve().parent.parent / "site" / "data"
CONTEUDO = "{https://purl.org/rss/1.0/modules/content/}encoded"
MESES = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6, "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}
MAXIMO = 8


def texto(h: str) -> str:
    h = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", h or "", flags=re.I)
    h = re.sub(r"<[^>]+>", " ", h)
    t = html.unescape(h).replace("​", " ")
    return re.sub(r"\s+", " ", t).strip()


def resumo(conteudo: str, titulo: str) -> str:
    """Primeiro trecho com texto do corpo da notícia, sem legendas de foto (o feed repete o título na descrição)."""
    h = re.sub(r"<figure[\s\S]*?</figure>|<figcaption[\s\S]*?</figcaption>", " ", conteudo or "", flags=re.I)
    h = re.sub(r"</(p|div|h\d|li)>|<br\s*/?>", "\n", h, flags=re.I)
    for bloco in h.split("\n"):
        t = texto(bloco)
        if len(t) > 40 and t != titulo:
            return t[:400]
    return texto(h)[:400]


def data_iso(s: str) -> str:
    # Formato do feed: "Seg, out 5 2026 07:20:00"
    m = re.search(r"([a-zç]{3})\w*\s+(\d{1,2})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?", (s or "").lower())
    if not m or m.group(1) not in MESES:
        return ""
    try:
        d = dt.datetime(int(m.group(3)), MESES[m.group(1)], int(m.group(2)), int(m.group(4) or 0), int(m.group(5) or 0))
    except ValueError:
        return ""
    return d.strftime("%Y-%m-%dT%H:%M")


def ler_feed(bruto: bytes) -> list[dict]:
    canal = ET.fromstring(bruto).find("channel")
    out = []
    for it in canal.findall("item") if canal is not None else []:
        t = texto(it.findtext("title"))
        url = (it.findtext("link") or it.findtext("guid") or "").strip()
        if not t or not url.startswith("https://www.stj.jus.br/"):
            continue
        out.append({"t": t, "r": resumo(it.findtext(CONTEUDO) or "", t), "d": data_iso(it.findtext("pubDate")), "url": url})
    out.sort(key=lambda x: x["d"], reverse=True)
    return out[:MAXIMO]


def main() -> int:
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            nots = ler_feed(r.read())
    except Exception as e:  # noqa: BLE001
        print(f"Notícias do STJ: feed indisponível ({e}); nada alterado.")
        return 0
    if not nots:
        print("Notícias do STJ: o feed veio sem notícias; nada alterado.")
        return 0
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / "stj-noticias.json").write_text(json.dumps(nots, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    man_arq = SAIDA / "manifest.json"
    if man_arq.exists():
        man = json.loads(man_arq.read_text(encoding="utf-8"))
        man["noticiasSTJ"] = {"em": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "noticias": len(nots)}
        man_arq.write_text(json.dumps(man, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Notícias do STJ: {len(nots)} notícias (a mais recente de {nots[0]['d']}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
