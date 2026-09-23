# Jurisprudência STJ

Site público e gratuito que reúne a jurisprudência do Superior Tribunal de Justiça a partir do [Portal de Dados Abertos do STJ](https://dadosabertos.web.stj.jus.br/). Ele fica hospedado no GitHub Pages, e uma rotina do GitHub Actions o atualiza duas vezes por dia, às 7h e às 19h (horário de Brasília).

**O que o site oferece**

- **Acórdãos.** Os espelhos de acórdãos da Corte Especial, das três Seções e das seis Turmas, com os últimos 12 meses sempre disponíveis. A pesquisa cobre a ementa, a tese e as referências legislativas, com filtros por órgão, período, classe, relator e número do processo, e cada resultado traz link para o inteiro teor oficial e botão para copiar a citação.
- **Repetitivos.** Os temas repetitivos, as controvérsias, os IAC, os SIRDR e os PUIL, com a situação atual, a questão submetida, a tese firmada e a indicação de suspensão.
- **Início.** As movimentações recentes dos precedentes qualificados (afetações, julgamentos, acórdãos publicados e mudanças de situação).
- **Radar DJEN.** Os acórdãos publicados nos últimos 15 dias disponíveis na base diária.

Os filtros de cada pesquisa ficam no endereço da página, de modo que basta copiar o link para compartilhar uma pesquisa pronta.

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
| Metadados das íntegras (Radar) | diária | cerca de 2 semanas |

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
