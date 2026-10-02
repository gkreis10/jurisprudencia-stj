// Conferência automática do site montado (_site), antes de cada publicação.
//
// Verifica a integridade e o tamanho dos arquivos de dados, abre todas as seções num navegador
// sem interface, faz uma pesquisa, uma busca por número e uma verificação de petição, e confere
// alguns requisitos de acessibilidade. Se algo falhar, a rotina termina com erro e o site
// publicado continua sendo a versão anterior (o GitHub avisa o responsável por e-mail).
//
// Uso: node scripts/teste-site.mjs [pasta]   (padrão: _site)
// Requer playwright-core (ou playwright) e um Chrome/Chromium; CHROME indica o executável.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, createReadStream, readdirSync, appendFileSync } from "node:fs";
import { join, extname, resolve } from "node:path";

const RAIZ = resolve(process.argv[2] || "_site");
const falhas = [], avisos = [];
const falha = (m) => { falhas.push(m); console.log(`  FALHA: ${m}`); };
const ok = (m) => console.log(`  ok: ${m}`);
const json = (p) => JSON.parse(readFileSync(join(RAIZ, p), "utf8"));
const tam = (p) => (existsSync(join(RAIZ, p)) ? statSync(join(RAIZ, p)).size : -1);

// ---------------------------------------------------------------- 1. dados e tamanhos
console.log("1. Arquivos de dados");
let man = {}, recentes = [], temas = [];
try {
  man = json("data/manifest.json");
  if (!man.meses?.length) falha("manifest sem meses de acórdãos"); else ok(`manifest: ${man.meses.length} meses`);
  if (man.erros?.length) avisos.push(`rotina com erros: ${man.erros.join("; ")}`);
} catch (e) { falha(`manifest.json ilegível: ${e.message}`); }
const minimos = { "data/temas.json": 2000, "data/sumulas.json": 600, "data/recentes.json": 100, "data/pautas.json": 1, "data/indice.json": 100 };
for (const [p, n] of Object.entries(minimos)) {
  try { const d = json(p); if (!Array.isArray(d) || d.length < n) falha(`${p}: ${d.length ?? 0} itens (mínimo ${n})`); else ok(`${p}: ${d.length} itens`); if (p.includes("recentes")) recentes = d; if (p.includes("temas")) temas = d; }
  catch (e) { falha(`${p} ilegível: ${e.message}`); }
}
try { const pn = json("data/painel.json"); if (!Array.isArray(pn.ev) || !pn.dest) falha("painel.json incompleto"); else ok("painel.json"); } catch (e) { falha(`painel.json ilegível: ${e.message}`); }
let semFrag = 0;
for (let i = 0; i < 100; i++) { const k = String(i).padStart(2, "0"); if (tam(`data/numeros/n${k}.json`) < 0 || tam(`data/numeros/r${k}.json`) < 0) semFrag++; }
if (semFrag) falha(`${semFrag} fragmentos do índice de números ausentes`); else ok("índice de números: 100 fragmentos");
// Limites do plano gratuito da Cloudflare Pages: 20 mil arquivos por site e 25 MiB por arquivo.
// Acima de 18 mil arquivos fica o aviso (sem bloquear); acima dos limites a publicação falharia.
{
  let n = 0, bytes = 0, maior = 0, maiorNome = "";
  const passar = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const c = join(d, e.name); if (e.isDirectory()) passar(c); else if (e.isFile()) { const t = statSync(c).size; n++; bytes += t; if (t > maior) { maior = t; maiorNome = c.slice(RAIZ.length + 1); } } } };
  passar(RAIZ);
  const mb = Math.round(bytes / 1e6), maiorMb = (maior / 2 ** 20).toFixed(1);
  if (n > 20000) falha(`site com ${n} arquivos, acima do limite de 20.000 da Cloudflare`);
  else if (n > 18000) { avisos.push(`site com ${n} arquivos (aviso a partir de 18.000; limite de 20.000)`); console.log(`::warning title=Arquivos do site::O site tem ${n} arquivos; o limite da Cloudflare é 20.000.`); }
  else ok(`arquivos do site: ${n} de 20.000`);
  if (maior > 25 * 2 ** 20) falha(`${maiorNome} com ${maiorMb} MiB, acima do limite de 25 MiB por arquivo da Cloudflare`);
  else ok(`maior arquivo: ${maiorNome} (${maiorMb} MiB de 25 MiB)`);
  if (process.env.GITHUB_STEP_SUMMARY) { try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Espaço do site: ${mb} MB em ${n} arquivos (limite da Cloudflare: 20.000 arquivos${n > 18000 ? " — ATENÇÃO: acima de 18.000" : ""}); maior arquivo: ${maiorMb} MiB de 25 MiB.\n`); } catch { /* opcional */ } }
}
// Limites de tamanho: um arquivo que cresce sem controle deixa o site lento.
const limites = { "app.js": 800e3, "style.css": 250e3, "index.html": 30e3, "data/painel.json": 400e3, "data/recentes.json": 4e6, "data/manifest.json": 400e3 };
for (const [p, lim] of Object.entries(limites)) { const t = tam(p); if (t < 0) falha(`${p} ausente`); else if (t > lim) falha(`${p} com ${Math.round(t / 1e3)} KB (limite ${Math.round(lim / 1e3)} KB)`); }
let maiorFrag = 0; for (let i = 0; i < 100; i++) maiorFrag = Math.max(maiorFrag, tam(`data/numeros/n${String(i).padStart(2, "0")}.json`));
if (maiorFrag > 2.5e6) falha(`fragmento do índice de números com ${Math.round(maiorFrag / 1e3)} KB (limite 2.500 KB)`); else ok(`maior fragmento do índice: ${Math.round(maiorFrag / 1e3)} KB`);
if (man.monocraticas?.v) {
  let falta = 0, maior = 0;
  for (let i = 0; i < 100; i++) { const k = String(i).padStart(2, "0"); const t = tam(`data/monocraticas/m${k}.json.gz`); if (t < 0 || tam(`data/monocraticas/r${k}.json.gz`) < 0) falta++; maior = Math.max(maior, t); }
  if (falta) falha(`${falta} fragmentos das decisões monocráticas ausentes`);
  else if (maior > 1.5e6) falha(`fragmento das monocráticas com ${Math.round(maior / 1e3)} KB compactados (limite 1.500 KB)`);
  else ok(`monocráticas: ${man.monocraticas.n} decisões, maior fragmento ${Math.round(maior / 1e3)} KB`);
}
for (const v of ["pdf.min.js", "pdf.worker.min.js", "mammoth.browser.min.js", "inter-latin-wght-normal.woff2", "source-serif-4-latin-opsz-normal.woff2"]) if (tam(`vendor/${v}`) <= 0) falha(`vendor/${v} ausente`);
if (!/Content-Security-Policy/.test(readFileSync(join(RAIZ, "index.html"), "utf8"))) falha("index.html sem política de segurança de conteúdo");

// ---------------------------------------------------------------- 2. navegador
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".gz": "application/gzip", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain" };
const srv = createServer((req, res) => {
  const p = join(RAIZ, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!p.startsWith(RAIZ) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TIPOS[extname(p)] || "application/octet-stream" });
  createReadStream(p).pipe(res);
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;

let pw;
for (const m of [process.env.PW_MODULE, "playwright-core", "playwright"].filter(Boolean)) { try { pw = await import(m); break; } catch { /* tenta o próximo */ } }
if (!pw) { falha("playwright não instalado"); fim(); }
const exe = process.env.CHROME || ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((x) => existsSync(x));
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
const errosPag = [];
page.on("pageerror", (e) => errosPag.push(`erro de script: ${e.message}`));
page.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/Failed to load resource/.test(t)) errosPag.push(t); if (/Content Security Policy/i.test(t)) errosPag.push(`política de segurança: ${t}`); });
page.on("requestfailed", (r) => { if (!/\.json$/.test(r.url()) && !/aborted/i.test(r.failure()?.errorText || "")) errosPag.push(`falha ao carregar ${r.url().replace(BASE, "")}`); });
page.on("request", (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) errosPag.push(`recurso externo: ${r.url()}`); });

const esperarTela = async () => {
  await page.waitForFunction(() => { const v = document.querySelector("#view"); return v && v.textContent.trim().length > 40 && !v.querySelector(".esq"); }, null, { timeout: 45000 });
};
const acessibilidade = async (rota) => {
  const r = await page.evaluate(() => {
    const ids = {}; for (const el of document.querySelectorAll("[id]")) ids[el.id] = (ids[el.id] || 0) + 1;
    const dup = Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k);
    const semAlt = [...document.querySelectorAll("#view img:not([alt])")].length;
    const semNome = [...document.querySelectorAll("#view button, #view a[href]")].filter((b) => !b.hidden && b.offsetParent !== null && !(b.textContent.trim() || b.getAttribute("aria-label") || b.getAttribute("title"))).length;
    const abas = [...document.querySelectorAll('[role="tab"]')].filter((t) => t.parentElement?.getAttribute("role") !== "tablist").length;
    return { dup, semAlt, semNome, abas };
  });
  if (r.dup.length) falha(`${rota}: ids repetidos (${r.dup.slice(0, 5).join(", ")})`);
  if (r.semAlt) falha(`${rota}: ${r.semAlt} imagem(ns) sem texto alternativo`);
  if (r.semNome) falha(`${rota}: ${r.semNome} botão(ões) ou link(s) sem nome acessível`);
  if (r.abas) falha(`${rota}: ${r.abas} aba(s) fora de uma lista de abas`);
};

console.log("2. Seções");
await page.goto(BASE + "#painel");
const rotas = await page.evaluate(() => [...document.querySelectorAll("#menu a[data-v]")].map((a) => a.dataset.v));
if (rotas.length < 10) falha(`menu com ${rotas.length} seções`);
for (const r of rotas) {
  errosPag.length = 0;
  try {
    await page.goto(BASE + "#" + r); await esperarTela();
    const txt = await page.$eval("#view", (v) => v.textContent);
    if (/Não foi possível carregar os dados|A base ainda não foi gerada/.test(txt)) falha(`${r}: tela de erro`);
    else ok(r);
    await acessibilidade(r);
  } catch (e) { falha(`${r}: não abriu (${e.message.split("\n")[0]})`); }
  for (const e of [...new Set(errosPag)]) falha(`${r}: ${e}`);
}

console.log("3. Pesquisa");
const info = () => page.$eval("#ac-info", (e) => e.textContent);
try {
  await page.goto(BASE + "#pesquisa"); await page.waitForFunction(() => /recentemente|resultado/.test(document.querySelector("#ac-info")?.textContent || ""), null, { timeout: 30000 });
  // Pesquisa textual nos últimos 3 meses (em todo o acervo, um termo comum levaria minutos).
  await page.goto(BASE + "#pesquisa?p=u3"); await page.waitForSelector("#ac-q");
  await page.fill("#ac-q", "prescrição"); await page.press("#ac-q", "Enter");
  await page.waitForFunction(() => /resultado|Exibindo/.test(document.querySelector("#ac-info")?.textContent || ""), null, { timeout: 180000 });
  const t = await info(); const n = +(/([\d.]+)\s+resultado|Exibindo os ([\d.]+)/.exec(t)?.slice(1).find(Boolean) || "0").replace(/\./g, "");
  if (!n) falha(`pesquisa "prescrição" sem resultados (${t.slice(0, 120)})`); else ok(`pesquisa "prescrição" (3 meses): ${n} resultados`);
  if (await page.$(".aviso-falha")) falha("pesquisa com arquivos não consultados");
  const r0 = recentes.find((x) => x.cl && x.n);
  if (r0) {
    const cb = String(r0.cl).split(/\s+(?:no|na|nos|nas|em)\s+/i).pop().split(/\s+/)[0];
    await page.fill("#ac-q", `${cb} ${r0.n}`); await page.press("#ac-q", "Enter");
    await page.waitForFunction(() => /rocesso/.test(document.querySelector("#ac-info")?.textContent || ""), null, { timeout: 60000 });
    const nn = await page.$$eval("#ac-lista > li", (l) => l.length);
    if (!nn) falha(`busca por número ${cb} ${r0.n} sem resultado`); else ok(`busca por número ${cb} ${r0.n}`);
  }
} catch (e) { falha(`pesquisa: ${e.message.split("\n")[0]}`); }

console.log("4. Verificar petição");
try {
  const r0 = recentes.find((x) => x.cl && x.n) || {};
  const cb = String(r0.cl || "REsp").split(/\s+(?:no|na|nos|nas|em)\s+/i).pop().split(/\s+/)[0];
  const tm = temas.find((x) => x.tp === "Tema" && x.tese) || { n: 1 };
  await page.goto(BASE + "#verificar"); await page.waitForSelector("#vf-txt");
  await page.fill("#vf-txt", `Conforme o Tema ${tm.n} do STJ e a Súmula 7/STJ, e ainda o ${cb} ${r0.n}/SP. Texto de teste suficiente para a verificação automática.`);
  await page.click("#vf-ok"); await page.waitForSelector("#vf-copiar", { timeout: 60000 });
  const t = await page.$eval("#vf-res", (e) => e.innerText);
  if (!new RegExp(`Tema ${tm.n}\\b`).test(t)) falha(`verificar: Tema ${tm.n} não identificado`);
  if (!/Súmula 7\/STJ/.test(t)) falha("verificar: Súmula 7/STJ não identificada");
  if (r0.n && !/Encontrado/.test(t)) falha(`verificar: ${cb} ${r0.n} não encontrado`);
  if (!falhas.some((f) => f.startsWith("verificar"))) ok("verificar petição");
} catch (e) { falha(`verificar: ${e.message.split("\n")[0]}`); }
for (const e of [...new Set(errosPag)]) falha(`pesquisa/verificar: ${e}`);

// ---------------------------------------------------------------- 5. STF
// Os dados do STF vêm de outra fonte: se ainda não existirem, o teste só avisa (o STJ continua publicável).
console.log("5. Modos STF e STJ + STF");
if (tam("data/stf-temas.json") < 0) avisos.push("dados do STF ausentes (data/stf-temas.json): modos STF não conferidos");
else {
  try {
    const rg = json("data/stf-temas.json"), sf = tam("data/stf-sumulas.json") > 0 ? json("data/stf-sumulas.json") : [], cp = tam("data/stf-composicao.json") > 0 ? json("data/stf-composicao.json") : { ministros: [] };
    if (rg.length < 1000) falha(`stf-temas.json: ${rg.length} temas (mínimo 1.000)`); else ok(`stf-temas.json: ${rg.length} temas, ${rg.filter((x) => x.tese).length} com tese`);
    // Na carga inicial, as súmulas entram aos poucos: abaixo do esperado, só avisa.
    if (sf.length < 700) avisos.push(`stf-sumulas.json: ${sf.length} súmulas (esperadas mais de 700; carga inicial em andamento?)`); else ok(`stf-sumulas.json: ${sf.length} súmulas (${sf.filter((x) => x.v).length} vinculantes)`);
    if (cp.ministros.length < 8) falha(`stf-composicao.json: ${cp.ministros.length} ministros`); else ok(`stf-composicao.json: ${cp.ministros.length} ministros, ${cp.ministros.filter((m) => m.foto).length} com foto`);
    // A escolha do tribunal é gravada antes de o site carregar (o site regrava as preferências ao sair da página).
    await page.addInitScript(() => {
      const t = sessionStorage.getItem("teste-trib"); if (!t) return;
      try { const o = JSON.parse(localStorage.getItem("radar-stj.v1") || "{}"); o.trib = t; localStorage.setItem("radar-stj.v1", JSON.stringify(o)); } catch { /* sem armazenamento */ }
    });
    const modo = async (t) => {
      await page.goto(BASE + "#painel");
      await page.evaluate((t) => sessionStorage.setItem("teste-trib", t), t);
      await page.reload(); await esperarTela();
    };
    for (const t of ["stf", "ambos"]) {
      await modo(t);
      const marca = await page.$eval("#marca-nome", (e) => e.textContent);
      if (marca !== (t === "stf" ? "Radar STF" : "Radar STJ · STF")) falha(`modo ${t}: marca "${marca}"`);
      const rotasT = await page.evaluate(() => [...document.querySelectorAll("#menu a[data-v]")].map((a) => a.dataset.v));
      for (const r of rotasT) {
        errosPag.length = 0;
        try {
          await page.goto(BASE + "#" + r); await esperarTela();
          const txt = await page.$eval("#view", (v) => v.textContent);
          if (/Não foi possível carregar os dados/.test(txt)) falha(`${t}/${r}: tela de erro`);
          await acessibilidade(`${t}/${r}`);
        } catch (e) { falha(`${t}/${r}: não abriu (${e.message.split("\n")[0]})`); }
        for (const e of [...new Set(errosPag)]) falha(`${t}/${r}: ${e}`);
      }
      if (t === "stf" && rotasT.includes("pesquisa")) falha("modo stf: Pesquisa do STJ no menu");
      if (t === "ambos" && !rotasT.includes("pesquisa")) falha("modo ambos: Pesquisa ausente do menu");
      ok(`modo ${t}: ${rotasT.length} seções`);
    }
    // Atualize-se no modo STF: cartões do STF, sem erro, com tipos do STF no filtro.
    await modo("stf");
    await page.goto(BASE + "#atualize"); await esperarTela();
    await page.waitForSelector("#fd article, #fd .reel", { timeout: 15000 }).catch(() => {});
    const nFeed = await page.$$eval("#fd article, #fd .reel", (l) => l.length);
    const txtFeed = await page.$eval("#view", (v) => v.textContent);
    if (/Não foi possível carregar os dados/.test(txtFeed)) falha("Atualize-se (STF): tela de erro");
    else if (!nFeed && !/em dia|nenhuma|Nada/i.test(txtFeed)) falha("Atualize-se (STF): sem cartões nem aviso");
    else ok(`Atualize-se (STF): ${nFeed} cartões carregados`);
    if (/Julgado · STJ|Repetitivo/.test(await page.$$eval("#fd .selo", (l) => l.map((e) => e.textContent).join(" ")).catch(() => ""))) falha("Atualize-se (STF): cartão do STJ no modo STF");
    // Conferência de citações do STF (modo STJ + STF) e composição com as duas abas.
    const rgT = rg.find((x) => x.tese) || { n: 69 }, sv = sf.find((x) => x.v) || null;
    await page.goto(BASE + "#verificar"); await page.waitForSelector("#vf-txt");
    await page.fill("#vf-txt", `Conforme o Tema ${rgT.n} da repercussão geral e a Súmula Vinculante ${sv?.n || 13}, além do Tema 1 do STJ. Texto de teste suficiente para a verificação automática.`);
    await page.click("#vf-ok"); await page.waitForSelector("#vf-copiar", { timeout: 60000 });
    const tv = await page.$eval("#vf-res", (e) => e.innerText);
    if (!new RegExp(`Tema ${rgT.n}/STF`).test(tv)) falha(`verificar (STF): Tema ${rgT.n}/STF não conferido`);
    else if (sv && !new RegExp(`Súmula Vinculante ${sv.n}/STF`).test(tv)) falha(`verificar (STF): Súmula Vinculante ${sv.n} não conferida`);
    else ok("verificar petição com citações do STF");
    await page.goto(BASE + "#composicao?t=stf"); await esperarTela();
    if (!(await page.$("#view [data-min]"))) falha("composição do STF sem ministros"); else ok("composição do STF");
    // Perfil do ministro do STF: contato do gabinete e relatorias, quando o registro traz os perfis.
    if (cp.ministros.some((m) => m.gabinete)) {
      const mg = cp.ministros.find((m) => m.gabinete);
      await page.goto(BASE + "#composicao?t=stf&aba=ministros"); await esperarTela();
      await page.click(`#view [data-min="${mg.id}"]`); await page.waitForSelector("#gaveta-corpo .cp-contato", { timeout: 8000 }).catch(() => falha("perfil do STF: contato do gabinete ausente"));
      const tg = await page.$eval("#gaveta-corpo", (e) => e.innerText).catch(() => "");
      if (!/@stf\.jus\.br/.test(tg)) falha("perfil do STF: sem e-mail do gabinete"); else ok(`perfil do STF (${mg.curto}): gabinete, ${/Informativo do STF/.test(tg) ? "julgados no Informativo" : "sem julgados no Informativo"}`);
      await page.keyboard.press("Escape");
      await page.goto(BASE + "#composicao?t=stf&aba=contatos"); await esperarTela();
      const ng = await page.$$eval("#view .cp-gab", (l) => l.length);
      if (ng < cp.ministros.filter((m) => m.gabinete).length) falha(`contatos do STF: ${ng} cartões`); else ok(`contatos do STF: ${ng} cartões`);
    }
    // Carrossel da Visão geral no modo STF.
    await page.goto(BASE + "#painel"); await esperarTela();
    const nCar = await page.$$eval("#car .car-sl", (l) => l.length).catch(() => 0);
    if (!nCar) avisos.push("Visão geral (STF): carrossel sem destaques"); else ok(`Visão geral (STF): carrossel com ${nCar} destaques`);
    if (nCar) {
      const ci = await page.$$eval("#car .car-sl", (l) => ({ n: l.length, img: l.filter((e) => e.querySelector(".car-img")).length, prog: l.filter((e) => e.querySelector(".car-prog")).length, atual: l.findIndex((e) => e.classList.contains("atual")) }));
      if (tam("data/carrossel-fundos.json") > 2 && ci.img < ci.n) falha(`carrossel: ${ci.n - ci.img} destaque(s) sem imagem`);
      else if (ci.n > 1 && (ci.prog < ci.n || ci.atual !== 0)) falha("carrossel: barra de tempo ausente");
      else ok(`carrossel: ${ci.img} de ${ci.n} destaques com imagem, barra de tempo ativa`);
    }
    // Pauta do STF (opcional até a primeira coleta com pauta).
    if (tam("data/stf-pauta.json") > 0) {
      await page.goto(BASE + "#pautastf"); await esperarTela();
      const tp = await page.$eval("#view", (e) => e.innerText).catch(() => "");
      if (!/Temas de repercussão geral em pauta/i.test(tp) || !/Sessões virtuais/i.test(tp)) falha("Pauta do STF: página incompleta"); else ok("Pauta do STF");
    }
    // Informativo do STF (opcional até a primeira coleta): edições, busca, resumo completo e edições antigas.
    if (tam("data/stf-informativos.json") > 0) {
      const inf = json("data/stf-informativos.json");
      if (inf.length < 100) avisos.push(`stf-informativos.json: ${inf.length} julgados (esperados mais de 100)`); else ok(`stf-informativos.json: ${inf.length} julgados, edição ${inf[0].n}`);
      const ixI = tam("data/stf-informativos-indice.json") > 0 ? json("data/stf-informativos-indice.json") : null;
      if (ixI) {
        if (!ixI.eds?.length || ixI.eds[0][0] !== inf[0].n) falha("Informativo do STF: índice de edições incompatível com os dados recentes");
        for (const a of ixI.antigos) if (tam(`data/stf-informativos/${a}.json`) <= 0) falha(`Informativo do STF: faltou data/stf-informativos/${a}.json`);
        ok(`stf-informativos-indice.json: ${ixI.eds.length} edições (da nº ${ixI.eds.at(-1)[0]}), ${ixI.antigos.length} ano(s) antigos`);
      }
      await page.goto(BASE + "#infostf"); await esperarTela();
      const n0 = await page.$$eval("#is-lista .jt-ed", (l) => l.length);
      if (!n0) falha("Informativo do STF: nenhuma edição listada");
      await page.click("#is-lista .jt-ed-cab"); await page.waitForSelector("#is-lista .jt-ed.aberta [data-info-stf]", { timeout: 15000 }).catch(() => falha("Informativo do STF: edição não abriu"));
      await page.fill("#is-q", inf[0].p.split(",")[0].replace(/\./g, "")); await page.waitForTimeout(800);
      const n1 = await page.$$eval("#is-lista [data-info-stf]", (l) => l.length);
      if (!n1) falha("Informativo do STF: busca por processo sem resultado");
      await page.click("#is-lista [data-info-stf]"); await page.waitForSelector("#gis-copiar", { timeout: 8000 }).catch(() => falha("Informativo do STF: resumo completo não abriu"));
      if (ixI?.antigos.length) {
        const ano = ixI.antigos[0];
        await page.goto(BASE + `#infostf?e=a:${ano}&q=`); await esperarTela();
        const nA = await page.waitForSelector("#is-lista .jt-ed", { timeout: 30000 }).then(() => page.$$eval("#is-lista .jt-ed", (l) => l.length)).catch(() => 0);
        if (!nA) falha(`Informativo do STF: ano antigo ${ano} sem edições`);
        else ok(`Informativo do STF: edições, busca, resumo e ano antigo (${ano})`);
      } else ok("Informativo do STF: edições, busca e resumo");
    }
  } catch (e) { falha(`STF: ${e.message.split("\n")[0]}`); }
  for (const e of [...new Set(errosPag)]) falha(`STF: ${e}`);
}

await browser.close();
fim();

function fim() {
  srv.close();
  for (const a of avisos) console.log(`  aviso: ${a}`);
  console.log(falhas.length ? `\n${falhas.length} falha(s): o site NÃO será publicado nesta execução.` : "\nTudo certo.");
  process.exit(falhas.length ? 1 : 0);
}
