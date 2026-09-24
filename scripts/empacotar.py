"""Monta a pasta publicada (_site) a partir de site/.

Os arquivos mensais de acórdãos vão compactados (.json.gz), para que o acervo longo caiba
no limite do GitHub Pages; o site descompacta no navegador. Os meses mais recentes também
seguem em .json, para navegadores sem suporte a descompactação.
"""
from __future__ import annotations

import gzip
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM, DESTINO = RAIZ / "site", RAIZ / "_site"
MESES_EM_JSON = 12


def main() -> None:
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    shutil.copytree(ORIGEM, DESTINO, ignore=lambda d, nomes: ["acordaos"] if Path(d) == ORIGEM / "data" else [])
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
