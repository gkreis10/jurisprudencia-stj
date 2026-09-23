# Jurisprudência STJ

Site público e gratuito que reúne a jurisprudência do Superior Tribunal de Justiça a partir do [Portal de Dados Abertos do STJ](https://dadosabertos.web.stj.jus.br/). Ele fica hospedado no GitHub Pages, e uma rotina do GitHub Actions o atualiza duas vezes por dia, às 7h e às 19h (horário de Brasília).

**O que o site oferece**

- **Visão geral:** o que mudou no STJ, com as movimentações dos repetitivos, os destaques do mês, as próximas sessões relevantes e as novidades do seu radar.
- **Meu radar:** você cadastra assuntos, números de processo e a sua OAB. O site mostra, por prioridade, o que surgiu em repetitivos, acórdãos, pautas e publicações, e marca o que é novo desde a última visita. Fica salvo no navegador, e pode ser levado a outro aparelho por link.
- **Destaques:** os acórdãos com sinais de relevância (Corte Especial, Seções, tese, rito repetitivo, embargos de divergência, superação de entendimento), com filtro por área do direito. A rotina fica de fora.
- **Pesquisa:** os acórdãos dos últimos 12 meses, com filtros por órgão, área, classe, relator e número, e a opção de ocultar decisões de rotina.
- **Repetitivos:** temas, controvérsias, IAC, SIRDR e PUIL, com linha do tempo, processos vinculados, UF de origem e a indicação de quais estão em pauta.
- **Pautas:** o que vai a julgamento nos próximos dias, com busca por processo, OAB ou advogado (sem os nomes das partes), e os acórdãos publicados no DJEN.
- **Verificar petição:** confere os temas, os precedentes e as súmulas citados em um texto ou arquivo (PDF, DOCX, TXT) e sugere precedentes qualificados com assunto parecido. Tudo roda no navegador.

---

## Como publicar (cerca de 10 minutos, uma única vez)

### 1. Criar a conta e o repositório

1. Crie uma conta gratuita em <https://github.com/signup>, se ainda não tiver uma.
2. Acesse <https://github.com/new> e preencha:
   - **Repository name:** `jurisprudencia-stj` (ou outro nome de sua preferência);
   - **Public**, que é a opção necessária para o GitHub Pages gratuito;
   - mantenha desmarcada a opção "Add a README".
3. Clique em **Create repository**.

### 2. Enviar os arquivos

1. Na página do repositório recém-criado, clique no link **uploading an existing file**.
2. Descompacte o arquivo `jurisprudencia-stj.zip` no seu computador.
3. Abra a pasta descompactada, selecione **todo o conteúdo** (incluindo a pasta `.github`) e arraste para a área de upload do navegador.
   - No Mac, a pasta `.github` fica oculta no Finder. Para exibi-la, use **Cmd + Shift + .** (ponto).
   - No Windows, ative em Explorador de Arquivos → Exibir → Itens ocultos.
4. Clique em **Commit changes**.

Confira se a lista de arquivos do repositório mostra `.github/workflows/atualizar.yml`. Sem esse arquivo, a atualização automática não funciona.

### 3. Ativar o GitHub Pages

1. No repositório, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.

### 4. Rodar a primeira carga

1. Abra a aba **Actions**. Se o GitHub pedir, clique em **I understand my workflows, go ahead and enable them**.
2. Clique em **Atualizar e publicar**, depois em **Run workflow** e confirme em **Run workflow**.
3. A primeira execução baixa os 12 meses de acórdãos e leva de 5 a 15 minutos. As execuções seguintes baixam apenas o que for novo.
4. Ao terminar, o endereço do site aparece na execução e em **Settings → Pages**. O formato é `https://SEU-USUARIO.github.io/jurisprudencia-stj/`.

Depois disso, não é preciso fazer mais nada: o site se atualiza sozinho.

### Opcional: domínio próprio

Em **Settings → Pages → Custom domain**, informe um endereço como `jurisprudencia.seudominio.com.br` e crie no seu provedor de DNS um registro `CNAME` que aponte para `SEU-USUARIO.github.io`.

---

## Periodicidade das fontes

| Conteúdo | Frequência de publicação pelo STJ | Defasagem típica |
|---|---|---|
| Espelhos de acórdãos | mensal, por órgão julgador | alguns dias a algumas semanas após o fim do mês |
| Precedentes qualificados | diária | 1 dia |
| Metadados das íntegras (DJEN) | diária | cerca de 2 semanas |
| Pautas futuras | diária | 1 dia |

O site nunca estará mais atualizado do que a própria base aberta do STJ. Para acompanhar julgados do mesmo dia, continue usando o Informativo de Jurisprudência e o acompanhamento processual.

## Manutenção

- **Histórico de mudanças dos temas:** o registro começa na primeira execução e guarda os últimos 180 dias.
- **Tamanho do acervo:** o parâmetro `--meses 12` em `.github/workflows/atualizar.yml` define quantos meses de acórdãos o site mantém. Doze meses somam cerca de 130 MB, e o GitHub Pages admite até 1 GB.
- **Falhas do portal do STJ:** quando uma fonte não responde, o site mantém os dados anteriores e a aba **Sobre** exibe o aviso. A rotina tenta de novo na execução seguinte.
- **Rotina desativada:** o GitHub desativa rotinas agendadas após 60 dias sem atividade no repositório. A própria rotina se reativa a cada execução, mas, se ela parar, basta abrir **Actions → Atualizar e publicar** e clicar em **Enable workflow**.
- **Execução local (para testes):**
  ```bash
  python3 scripts/atualizar.py
  cd site && python3 -m http.server 8000   # abrir http://localhost:8000
  ```

## Estrutura

```
scripts/atualizar.py            baixa e prepara os dados (somente biblioteca padrão do Python)
site/index.html, app.js, style.css   o site (estático, sem dependências)
.github/workflows/atualizar.yml  rotina diária de atualização e publicação
```

## Aviso

Projeto independente, sem vínculo com o STJ. O site reproduz os dados oficiais sem alterar o texto das ementas. Antes de citar qualquer julgado, confira o inteiro teor no site do STJ.
