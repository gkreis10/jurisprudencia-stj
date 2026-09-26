"""Monta a pasta publicada (_site) a partir de site/.

Os arquivos mensais de acórdãos vão compactados (.json.gz), para que o acervo longo caiba
no limite do GitHub Pages; o site descompacta no navegador. Os meses mais recentes também
seguem em .json, para navegadores sem suporte a descompactação.
"""
from __future__ import annotations

import base64
import gzip
import hashlib
import io
import shutil
import sys
import tarfile
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM, DESTINO = RAIZ / "site", RAIZ / "_site"
MESES_EM_JSON = 3

# Leitores de PDF e DOCX usados pelo "Verificar petição" e fontes do site, servidos pelo próprio site (sem CDN).
# Vêm dos pacotes oficiais no registro do npm, em versões fixas, e só são publicados se o
# hash SHA-384 conferir com o fixado aqui (o mesmo do atributo integrity em app.js).
VENDOR = [
    ("https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-3.11.174.tgz", {
        "package/build/pdf.min.js": ("pdf.min.js", "/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e"),
        "package/build/pdf.worker.min.js": ("pdf.worker.min.js", "SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2"),
        "package/LICENSE": ("LICENSE-pdfjs.txt", None),
    }),
    # Fontes do site (Inter e Source Serif 4, licença SIL OFL), servidas sem depender do Google Fonts.
    ("https://registry.npmjs.org/@fontsource-variable/inter/-/inter-5.3.0.tgz", {
        "package/files/inter-latin-wght-normal.woff2": ("inter-latin-wght-normal.woff2", "l0ql7Q1zqvX5klAVRwYjcMVCkCxg5dMTdghsIlC3pYkX6wwEHerh2bP/4yAao3Im"),
        "package/LICENSE": ("LICENSE-inter.txt", None),
    }),
    ("https://registry.npmjs.org/@fontsource-variable/source-serif-4/-/source-serif-4-5.3.0.tgz", {
        "package/files/source-serif-4-latin-opsz-normal.woff2": ("source-serif-4-latin-opsz-normal.woff2", "evn7x+azr6PYq3DOgeObuTOkVKceROkR3IcrDIFMJS5hIy3mOsEj1SfRA80PvQ+7"),
        "package/LICENSE": ("LICENSE-source-serif-4.txt", None),
    }),
    ("https://registry.npmjs.org/mammoth/-/mammoth-1.6.0.tgz", {
        "package/mammoth.browser.min.js": ("mammoth.browser.min.js", "nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz"),
        "package/LICENSE": ("LICENSE-mammoth.txt", None),
    }),
]


def vendor(destino: Path) -> None:
    cache = RAIZ / ".cache" / "vendor"
    cache.mkdir(parents=True, exist_ok=True)
    destino.mkdir(parents=True, exist_ok=True)
    for url, arquivos in VENDOR:
        faltam = [n for n, _ in arquivos.values() if not (cache / n).exists()]
        if faltam:
            try:
                with urllib.request.urlopen(url, timeout=60) as r:
                    pacote = tarfile.open(fileobj=io.BytesIO(r.read()), mode="r:gz")
                for membro, (nome, sha) in arquivos.items():
                    dados = pacote.extractfile(membro).read()
                    if sha and base64.b64encode(hashlib.sha384(dados).digest()).decode() != sha:
                        print(f"AVISO: hash divergente em {nome}; arquivo não publicado.", file=sys.stderr)
                        continue
                    (cache / nome).write_bytes(dados)
            except Exception as e:  # noqa: BLE001
                print(f"AVISO: não foi possível obter {url}: {e}", file=sys.stderr)
        for nome, sha in arquivos.values():
            arq = cache / nome
            if arq.exists() and (not sha or base64.b64encode(hashlib.sha384(arq.read_bytes()).digest()).decode() == sha):
                shutil.copyfile(arq, destino / nome)
    print("Leitores de arquivo (vendor):", ", ".join(sorted(p.name for p in destino.iterdir())))


def main() -> None:
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    shutil.copytree(ORIGEM, DESTINO, ignore=lambda d, nomes: ["acordaos"] if Path(d) == ORIGEM / "data" else [])
    vendor(DESTINO / "vendor")
    base = ORIGEM / "data" / "acordaos"
    meses = sorted(p.name for p in base.iterdir() if p.is_dir()) if base.exists() else []
    recentes = set(meses[-MESES_EM_JSON:])
    bruto = compacto = 0
    for mes in meses:
        dest = DESTINO / "data" / "acordaos" / mes
        dest.mkdir(parents=True, exist_ok=True)
        for arq in sorted((base / mes).glob("*.json")):
            dados = arq.read_bytes()
            gz = gzip.compress(dados, compresslevel=9, mtime=0)
            (dest / (arq.name + ".gz")).write_bytes(gz)
            bruto += len(dados)
            compacto += len(gz)
            if mes in recentes:
                shutil.copyfile(arq, dest / arq.name)
                compacto += len(dados)
    total = sum(f.stat().st_size for f in DESTINO.rglob("*") if f.is_file())
    print(f"Acórdãos: {len(meses)} meses; {bruto / 1e6:.0f} MB em JSON -> {compacto / 1e6:.0f} MB publicados. Site: {total / 1e6:.0f} MB.")
    if total > 950e6:
        print("AVISO: o site passa de 950 MB; o limite do GitHub Pages é 1 GB.", file=sys.stderr)


if __name__ == "__main__":
    main()
