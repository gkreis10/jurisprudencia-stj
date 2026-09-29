// Conferência da lista de ministros e dos currículos (STJ) pelo navegador.
//
// O portal do STJ recusa acessos automatizados de servidores a estas páginas; por isso a coleta é
// feita no navegador, numa página de https://www.stj.jus.br/web/ (mesma origem das consultas).
//
// Uso (a coleta leva cerca de um minuto; rode em segundo plano e consulte o resultado depois):
//   window.__min = null; coletarMinistros(ref).then((r) => (window.__min = r), (e) => (window.__min = { erro: e.message }));
// "ref" é o resumo do que o repositório já tem, gerado por referenciaMinistros() numa página do
// github.com (o repositório é privado e não pode ser lido de uma página do STJ).
//   ... depois: window.__min
// Devolve { mudou, resumo, arquivo }. Se mudou for true, "arquivo" é o novo conteúdo de
// fontes/composicao/ministros-atualizacoes.json: a lista atual de ministros (em ordem de
// antiguidade) e os currículos que mudaram em relação à extração guardada no repositório.
// scripts/composicao.py aplica esse arquivo sobre fontes/composicao/stj-composicao.json.
// Resumo das extrações guardadas no repositório: lista de ministros e uma impressão digital
// (SHA-256) de cada currículo. Rode numa página de https://github.com/, com a sessão aberta.
async function referenciaMinistros() {
  const REPO = "https://github.com/gkreis10/jurisprudencia-stj/raw/main/fontes/composicao/";
  const ler = async (n) => { const r = await fetch(`${REPO}${n}?x=${Date.now()}`, { cache: "no-store" }); if (!r.ok) throw new Error(`${r.status} em ${n}`); return r.json(); };
  const base = await ler("stj-composicao.json");
  let ant = { ministros: null, curriculos: {} };
  try { ant = await ler("ministros-atualizacoes.json"); } catch { /* ainda não existe */ }
  const imp = async (o) => Object.fromEntries(await Promise.all(Object.entries(o || {}).map(async ([c, t]) => [c, await digital(t)])));
  return { lista: (ant.ministros || base.ministros || []).map((m) => ({ cod: m.cod, nome: m.nome, uf: m.uf })), base: await imp(base.curriculos), ant: await imp(ant.curriculos) };
}
async function digital(t) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(t || "").replace(/\s+/g, "")));
  return [...new Uint8Array(d)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function coletarMinistros(ref) {
  if (!ref?.lista) throw new Error("Falta o resumo do repositório (referenciaMinistros).");
  const SECOES = ["Formação Acadêmica", "Funções Atuais", "Outras Atividades", "Principais Atividades Exercidas", "Atividade Docente", "Magistério", "Condecorações, títulos, medalhas", "Publicações"];
  const ler = async (url) => {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(`${r.status} em ${url}`);
    return new DOMParser().parseFromString(new TextDecoder("windows-1252").decode(await r.arrayBuffer()), "text/html");
  };
  const limpo = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const semEspaco = (s) => String(s || "").replace(/\s+/g, "");
  // innerText (com as quebras de linha da página) só existe em elemento presente no documento.
  const textoDe = (el) => {
    const d = document.createElement("div");
    d.style.cssText = "position:absolute;left:-10000px;top:0;width:900px";
    d.innerHTML = el.outerHTML;
    document.body.appendChild(d);
    const t = d.innerText;
    d.remove();
    return t.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
  };
  // Dos dados pessoais, guarda só a data de nascimento (filiação e estado civil ficam de fora).
  const limparCurriculo = (t) => {
    const L = t.split("\n"), i = L.findIndex((l) => l.trim() === "Dados Pessoais");
    if (i < 0) return t;
    let j = L.findIndex((l, k) => k > i && SECOES.includes(l.trim()));
    if (j < 0) j = L.length;
    const nasc = L.slice(i, j).map((l) => /^(?:Data de )?Nascimento\s*:\s*(.+)/i.exec(l.trim())).find(Boolean);
    return [...L.slice(0, i), ...(nasc ? ["", `Nascimento: ${nasc[1].trim()}`] : []), "", ...L.slice(j)].join("\n").trim();
  };

  // 1. O que o repositório já tem (extração base + atualizações anteriores), em resumo.
  const listaAnt = ref.lista;

  // 2. Ministros em atividade, em ordem de antiguidade.
  const lista = await ler("/web/verMinistrosSTJ?parametro=2");
  const ministros = [], vistos = new Set();
  for (const linha of lista.querySelectorAll(".clsMinistrosLinha")) {
    const a = [...linha.querySelectorAll('a[href*="cod_matriculamin"]')].find((x) => limpo(x.textContent));
    const cod = (/cod_matriculamin=(\d+)/.exec(a?.getAttribute("href") || "") || [])[1];
    if (!a || !cod || vistos.has(cod)) continue;
    vistos.add(cod);
    ministros.push({ ordem: ministros.length + 1, nome: limpo(a.textContent), cod, uf: limpo(linha.querySelector(".clsMinistrosNaturalidade")?.textContent) });
  }
  if (ministros.length < 25) throw new Error(`Lista de ministros incompleta (${ministros.length}); nada foi alterado.`);

  // 3. Currículo de cada ministro. O arquivo guarda os que diferem da extração base; "mudou"
  // compara com as atualizações já gravadas.
  const difBase = {}, falhas = []; let cvMudou = false; const novos = {};
  for (const m of ministros) {
    try {
      const doc = await ler(`/web/verCurriculoMinistro?parametro=1&cod_matriculamin=${m.cod}`);
      const el = doc.querySelector(`.curriculo${m.cod}`);
      if (!el) { falhas.push(m.cod); continue; }
      const t = limparCurriculo(textoDe(el));
      const h = await digital(t);
      if (h !== ref.base[m.cod]) difBase[m.cod] = t;
      if (h !== (ref.ant[m.cod] || ref.base[m.cod])) { novos[m.cod] = t; cvMudou = true; }
    } catch { falhas.push(m.cod); }
    await new Promise((r) => setTimeout(r, 600)); // pausa entre páginas, para não sobrecarregar o portal
  }

  const chave = (l) => JSON.stringify(l.map((m) => [m.cod, m.nome, m.uf]));
  const listaMudou = chave(ministros) !== chave(listaAnt);
  const entraram = ministros.filter((m) => !listaAnt.some((x) => x.cod === m.cod)).map((m) => m.nome);
  const sairam = listaAnt.filter((x) => !ministros.some((m) => m.cod === x.cod)).map((m) => m.nome);
  const mudou = listaMudou || cvMudou;
  return {
    mudou,
    resumo: { ministros: ministros.length, listaMudou, entraram, sairam, curriculosAtualizados: Object.keys(novos).map((c) => ministros.find((m) => m.cod === c)?.nome || c), falhas },
    arquivo: mudou ? {
      fonte: "STJ — Ministros em atividade e currículos (www.stj.jus.br/web/verMinistrosSTJ)",
      coletadoEm: new Date().toISOString().slice(0, 10),
      ministros,
      curriculos: difBase,
    } : null,
  };
}
