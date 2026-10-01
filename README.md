# Jurisprudência STJ

Site de uso interno que reúne a jurisprudência do Superior Tribunal de Justiça a partir do [Portal de Dados Abertos do STJ](https://dadosabertos.web.stj.jus.br/). Ele fica hospedado no Cloudflare Pages, com acesso por usuário e senha, e uma rotina do GitHub Actions o atualiza uma vez por dia, às 7h (horário de Brasília).

**O que o site oferece**

- **Visão geral:** o que mudou no STJ, com as movimentações dos repetitivos, os destaques do mês, as próximas sessões relevantes e as novidades do seu radar.
- **Meu radar:** você cadastra assuntos, números de processo e a sua OAB. O site mostra, por prioridade, o que surgiu em repetitivos, acórdãos, pautas e publicações, e marca o que é novo desde a última visita. Fica salvo no navegador, e pode ser levado a outro aparelho por link.
- **Destaques:** os acórdãos com sinais de relevância (Corte Especial, Seções, tese, rito repetitivo, embargos de divergência, superação de entendimento), com filtro por área do direito. A rotina fica de fora.
- **Pesquisa:** os acórdãos dos últimos 12 meses, com filtros por órgão, área, classe, relator e número, e a opção de ocultar decisões de rotina.
- **Repetitivos:** temas, controvérsias, IAC, SIRDR e PUIL, com linha do tempo, processos vinculados, UF de origem e a indicação de quais estão em pauta.
- **Pautas:** o que vai a julgamento nos próximos dias, com busca por processo, OAB ou advogado (sem os nomes das partes), e os acórdãos publicados no DJEN.
- **Verificar petição:** confere os temas, os precedentes e as súmulas citados em um texto ou arquivo (PDF, DOCX, TXT) e sugere precedentes qualificados com assunto parecido. Tudo roda no navegador.
- **STF:** o nome do site, no alto do menu, escolhe o tribunal exibido: **Radar STJ** (padrão), **Radar STF** ou **Radar STJ · STF**. No STF entram os temas de repercussão geral, as súmulas e súmulas vinculantes, o Informativo do STF (resumos dos julgamentos de destaque, desde a edição 1.184) e a composição (Plenário e Turmas, com fotos); a escolha fica guardada no navegador.

---

## Hospedagem e publicação

- **Repositório (GitHub, privado):** guarda o código. A rotina `.github/workflows/atualizar.yml` baixa os dados do STJ, monta o site em `_site`, confere o resultado (`scripts/teste-acesso.mjs` e `scripts/teste-site.mjs`) e publica.
- **Site (Cloudflare Pages, projeto `jurisprudencia-stj-gkreis10`):** a função `functions/_middleware.js` exige usuário e senha em todas as páginas e em todos os arquivos de dados. A senha fica no segredo `SITE_ACCESS_PASSWORD` do projeto na Cloudflare, nunca no repositório.
- **Credenciais da rotina (GitHub → Settings → Secrets and variables → Actions):** segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` e variável `CLOUDFLARE_DEPLOY` = `true`.
- **Quando mudam só arquivos do site** (`site/`, `functions/`), a rotina remonta o site com os dados guardados, sem consultar o STJ. A consulta completa ocorre na execução diária e quando mudam as rotinas ou as fontes.
- **Limites do plano gratuito da Cloudflare:** 20 mil arquivos por site e 25 MiB por arquivo. A conferência automática avisa a partir de 18 mil arquivos e bloqueia a publicação acima dos limites.

---

## Periodicidade das fontes

| Conteúdo | Frequência de publicação pelo STJ | Defasagem típica |
|---|---|---|
| Espelhos de acórdãos | mensal, por órgão julgador | alguns dias a algumas semanas após o fim do mês |
| Precedentes qualificados | diária | 1 dia |
| Metadados das íntegras (DJEN) | diária | cerca de 2 semanas |
| Pautas futuras | diária | 1 dia |
| STF: temas de repercussão geral, súmulas, Informativo e composição | páginas oficiais do STF; o portal bloqueia as máquinas do GitHub, e a coleta é feita por tarefa agendada (segunda e quinta) que envia as mudanças ao repositório (`fontes/stf/`) | até 4 dias |

O site nunca estará mais atualizado do que a própria base aberta do STJ. Para acompanhar julgados do mesmo dia, continue usando o Informativo de Jurisprudência e o acompanhamento processual.

## Manutenção

- **Histórico de mudanças dos temas:** o registro começa na primeira execução e guarda os últimos 180 dias.
- **Tamanho do acervo:** o parâmetro `--desde` em `.github/workflows/atualizar.yml` define desde quando o site mantém os acórdãos. O resumo de cada execução informa o espaço ocupado e a quantidade de arquivos.
- **Falhas do portal do STJ:** quando uma fonte não responde, o site mantém os dados anteriores e a aba **Sobre** exibe o aviso. A rotina tenta de novo na execução seguinte.
- **Falha na publicação:** se a publicação na Cloudflare falhar, a execução fica marcada com erro e o GitHub avisa por e-mail; o site continua na versão anterior.
- **Rotina desativada:** o GitHub desativa rotinas agendadas após 60 dias sem atividade no repositório. A própria rotina se reativa a cada execução, mas, se ela parar, basta abrir **Actions → Atualizar e publicar** e clicar em **Enable workflow**.
- **STF (`scripts/stf.py`):** lê a lista oficial de temas de repercussão geral (`todostemas.asp`), as teses (`verTeseTema.asp`, só as novas), as súmulas (`sumariosumulas.asp`, só as novas ou alteradas) e as páginas de composição. O portal do STF envia a cadeia de certificados incompleta; o certificado intermediário oficial fica em `fontes/stf/`. Com o STF bloqueando o GitHub (erro 403), a rotina diária usa o registro `fontes/stf/` (temas, súmulas, histórico e Informativo), atualizado duas vezes por semana por uma tarefa agendada que coleta (`python scripts/stf.py --coletar`, que dispensa o restante do código) e envia só as linhas alteradas (`scripts/stf_envio.py`). O Informativo do STF (`informativoNNNN.htm`, publicação aberta) é lido a partir da edição 1.004 (fev/2021; as anteriores usam outro formato); o registro `informativos.json` guarda um julgado por linha. A pesquisa de acórdãos do STF tem proteção contra robôs e não é usada.
- **Ministro novo no STF:** a rotina avisa no registro da execução ("ministro(a) do STF fora do registro") e já o exibe, sem data de posse nem foto. Para completar, acrescente-o em `fontes/stf/ministros.json` (nome, data da posse e identificador do Wikidata).
- **Execução local (para testes):**
  ```bash
  python3 scripts/atualizar.py
  cd site && python3 -m http.server 8000   # abrir http://localhost:8000
  ```

## Estrutura

```
scripts/atualizar.py            baixa e prepara os dados (somente biblioteca padrão do Python)
scripts/stf.py                  dados do STF (repercussão geral, súmulas, Informativo e composição)
scripts/stf_envio.py            diferenças do registro do STF para envio ao GitHub pelo navegador
fontes/stf/                     registro dos ministros do STF, teses e súmulas já coletadas, certificado intermediário
site/index.html, app.js, style.css   o site (estático, sem dependências)
.github/workflows/atualizar.yml  rotina diária de atualização e publicação
```

## Aviso

Projeto independente, sem vínculo com o STJ. O site reproduz os dados oficiais sem alterar o texto das ementas. Antes de citar qualquer julgado, confira o inteiro teor no site do STJ.
