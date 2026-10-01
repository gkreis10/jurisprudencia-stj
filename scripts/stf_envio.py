"""Prepara o envio das mudanças do registro do STF (fontes/stf/) ao GitHub pelo navegador.

O GitHub bloqueia a coleta do STF e o navegador não aceita arquivos grandes colados de uma vez; por isso
só as linhas que mudaram são enviadas. O navegador reconstrói cada arquivo a partir da versão publicada
no repositório, aplicando as diferenças, e confere a assinatura (SHA-256) antes de anexar ao envio.

Uso:  python scripts/stf_envio.py PASTA_BASE PASTA_NOVA SAIDA "mensagem do commit" [arquivo ...]
  arquivo     caminhos a comparar (padrão: os três arquivos de fontes/stf/); todos na mesma pasta do repositório
  PASTA_BASE  cópia do repositório ANTES da coleta (contém fontes/stf/*.json)
  PASTA_NOVA  cópia DEPOIS da coleta
  SAIDA       pasta onde gravar passo1.js (reconstrução), passo3.js (envio) e resumo.json
Sem mudanças além da linha "atualizado", nada é gerado e o código de saída é 3.
"""
from __future__ import annotations

import base64
import difflib
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

ARQUIVOS = ["fontes/stf/temas.json", "fontes/stf/sumulas.json", "fontes/stf/historico.json", "fontes/stf/informativos.json", "fontes/stf/ministros.json", "fontes/stf/pauta.json"]
REPO = "gkreis10/jurisprudencia-stj"
LIMITE_B64 = 150_000  # acima disso o navegador não comporta: avisar o usuário


def linhas(t: str) -> list[str]:
    return re.findall(r"[^\n]*\n|[^\n]+$", t)


def ler(p: Path) -> str:
    return p.read_bytes().decode("utf-8") if p.exists() else ""


def sem_data(t: str) -> list[str]:
    return [x for x in linhas(t) if not x.lstrip().startswith('"atualizado"')]


PASSO1 = """(async()=>{
const B64='__B64__';
const bin=Uint8Array.from(atob(B64),c=>c.charCodeAt(0));
const txt=await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
const ops=JSON.parse(txt);const out={},rel={};
const sp=t=>t.match(/[^\\n]*\\n|[^\\n]+$/g)||[];
for(const [path,o] of Object.entries(ops)){
  const r=await fetch('/__REPO__/raw/main/'+path);
  const base=r.status===200?await r.text():'';
  const a=sp(base);let res='';
  for(const op of o.ops){res+=typeof op==='string'?op:a.slice(op[0],op[1]).join('');}
  const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(res)))].slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join('');
  rel[path]={ok:h===o.h,h,esperado:o.h,bytes:res.length};out[path]=res;
}
if(Object.values(rel).every(x=>x.ok))sessionStorage.setItem('__fs',JSON.stringify(out));
return rel;})()"""

PASSO3 = """(async()=>{
const fs=JSON.parse(sessionStorage.getItem('__fs'));
const dt=new DataTransfer();
for(const [p,t] of Object.entries(fs)){dt.items.add(new File([t],p.split('/').pop(),{type:'application/json'}));}
const inp=document.querySelector('#upload-manifest-files-input');
inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));
await new Promise(r=>setTimeout(r,4000));
const c=document.querySelector('#commit-summary-input');
const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
set.call(c,'__MSG__');c.dispatchEvent(new Event('input',{bubbles:true}));
const b=[...document.querySelectorAll('button')].find(x=>/Commit changes/.test(x.textContent)&&!x.disabled);
if(!b)return 'botão Commit changes indisponível';
b.click();return 'commit enviado: '+Object.keys(fs).join(', ');})()"""


def main() -> int:
    if len(sys.argv) < 5:
        print(__doc__)
        return 1
    base, nova, saida, msg = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4]
    arquivos = sys.argv[5:] or ARQUIVOS
    if len({str(Path(f).parent) for f in arquivos}) > 1:
        print("Os arquivos de um mesmo envio precisam estar na mesma pasta do repositório.")
        return 1
    saida.mkdir(parents=True, exist_ok=True)
    ops_todos, resumo = {}, {}
    for f in arquivos:
        a_txt, b_txt = ler(base / f), ler(nova / f)
        if not b_txt or sem_data(a_txt) == sem_data(b_txt):
            continue
        a, b = linhas(a_txt), linhas(b_txt)
        ops, mudou = [], 0
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
            if tag == "equal":
                ops.append([i1, i2])
            else:
                mudou += max(i2 - i1, j2 - j1)
                if j2 > j1:
                    ops.append("".join(b[j1:j2]))
        ops_todos[f] = {"ops": ops, "h": hashlib.sha256(b_txt.encode("utf-8")).hexdigest()[:16]}
        resumo[f] = {"linhas_alteradas": mudou, "bytes": len(b_txt.encode("utf-8"))}
    if not ops_todos:
        print("SEM MUDANÇAS: o registro continua igual ao publicado.")
        return 3
    b64 = base64.b64encode(gzip.compress(json.dumps(ops_todos, ensure_ascii=False).encode("utf-8"))).decode()
    resumo["_b64"] = len(b64)
    resumo["_pasta"] = str(Path(arquivos[0]).parent)
    (saida / "resumo.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=1), encoding="utf-8")
    if len(b64) > LIMITE_B64:
        print(f"MUDANÇAS GRANDES DEMAIS para o navegador ({len(b64)} caracteres): avisar o usuário.")
        return 4
    (saida / "passo1.js").write_text(PASSO1.replace("__B64__", b64).replace("__REPO__", REPO), encoding="utf-8")
    (saida / "passo3.js").write_text(PASSO3.replace("__MSG__", msg.replace("'", "’")), encoding="utf-8")
    print(json.dumps(resumo, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
