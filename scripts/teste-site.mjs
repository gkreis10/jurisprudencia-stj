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
import { readFileSync, existsSync, statSync, createReadStream } from "node:fs";
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
// Limites de tamanho: um arquivo que cresce sem controle deixa o site lento.
const limites = { "app.js": 800e3, "style.css": 250e3, "index.html": 30e3, "data/painel.json": 400e3, "data/recentes.json": 4e6, "data/manifest.json": 400e3 };
for (const [p, lim] of Object.entries(limites)) { const t = tam(p); if (t < 0) falha(`${p} ausente`); else if (t > lim) falha(`${p} com ${Math.round(t / 1e3)} KB (limite ${Math.round(lim / 1e3)} KB)`); }
let maiorFrag = 0; for (let i = 0; i < 100; i++) maiorFrag = Math.max(maiorFrag, tam(`data/numeros/n${String(i).padStart(2, "0")}.json`));
if (maiorFrag > 2.5e6) falha(`fragmento do índice de números com ${Math.round(maiorFrag / 1e3)} KB (limite 2.500 KB)`); else ok(`maior fragmento do índice: ${Math.round(maiorFrag / 1e3)} KB`);
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

await browser.close();
fim();

function fim() {
  srv.close();
  for (const a of avisos) console.log(`  aviso: ${a}`);
  console.log(falhas.length ? `\n${falhas.length} falha(s): o site NÃO será publicado nesta execução.` : "\nTudo certo.");
  process.exit(falhas.length ? 1 : 0);
}
