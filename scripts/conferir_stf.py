"""Alerta de atraso da coleta do STF.

O portal do STF recusa as máquinas do GitHub; os dados do STF vêm de um registro coletado à parte, às segundas
e quintas-feiras (tarefa agendada do Claude). Se o registro tiver mais de LIMITE dias, este programa termina
com erro: a execução diária do GitHub fica marcada como falha e o GitHub avisa o dono do repositório por e-mail.
Roda depois da publicação, por isso nunca impede a atualização do site."""
import datetime as dt
import json
import sys
from pathlib import Path

LIMITE = 5  # dias: a maior pausa normal é de quinta a segunda (4 dias)
arq = Path("site/data/manifest.json")
if not arq.exists():
    sys.exit(0)
stf = json.loads(arq.read_text(encoding="utf-8")).get("stf") or {}
agora = dt.datetime.now(dt.timezone.utc)
atrasadas = []
for nome in ("temas", "sumulas", "informativos", "composicao", "pauta"):
    f = stf.get(nome) or {}
    if f.get("origem") != "registro" or not f.get("em"):
        continue  # coletado direto pelo GitHub: a rotina diária já cuida
    dias = (agora - dt.datetime.fromisoformat(f["em"])).total_seconds() / 86400
    if dias > LIMITE:
        atrasadas.append(f"{nome} ({dias:.0f} dias)")
if atrasadas:
    print(f"::error title=Coleta do STF atrasada::Sem coleta do STF há mais de {LIMITE} dias: {', '.join(atrasadas)}. "
          "Verifique a tarefa agendada \"Atualizar registro do STF\" (computador ligado e aplicativo aberto).")
    sys.exit(1)
print("Coleta do STF em dia.")
