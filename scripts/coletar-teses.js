// Coleta da Jurisprudência em Teses (STJ) pelo navegador.
//
// O STJ recusa acessos automatizados de servidores às páginas da Jurisprudência em Teses e
// não publica arquivo aberto de cada edição. Por isso a coleta é feita no navegador, na página
// https://processo.stj.jus.br/SCON/jt/ (mesma origem das consultas abaixo).
//
// Uso (no console da página, ou pela ferramenta de JavaScript do navegador):
//   await coletarTeses({ ultima: 285, desde: "2026-09-23" })
// ultima: maior edição já guardada no repositório; desde: data (AAAA-MM-DD) da última coleta,
// para trazer também as edições que o STJ atualizou depois dela.
// Devolve { coletadoEm, edicoes: { "286": {...} }, ramos: { "DIREITO CIVIL": ["286"] } },
// no mesmo formato de fontes/jurisprudencia-em-teses.json. O resultado vai para
// fontes/teses/AAAA-MM-DD.json, que a rotina diária mescla ao arquivo principal.
async function coletarTeses({ ultima, desde }) {
  const ler = async (url) => {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(`${r.status} em ${url}`);
    const h = new TextDecoder("iso-8859-1").decode(await r.arrayBuffer());
    return new DOMParser().parseFromString(h, "text/html");
  };
  const limpo = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const iso = (br) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(br || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };

  // 1. Página inicial: edição mais recente e edições atualizadas (com a data da última versão).
  const home = await ler("/SCON/jt/jt.jsp");
  const recente = Math.max(...[...home.querySelectorAll(".numeroSumula")].map((e) => +limpo(e.textContent)).filter(Boolean), 0);
  if (!recente) throw new Error("Não encontrei a edição mais recente na página inicial.");
  const alvo = new Set();
  for (let n = ultima + 1; n <= recente; n++) alvo.add(n);
  for (const tr of home.querySelectorAll("tr")) {
    const m = /EDI[ÇC][ÃA]O N\.\s*(\d+)/i.exec(tr.textContent || "");
    const d = iso((/(\d{2}\/\d{2}\/\d{4})/.exec(tr.textContent || "") || [])[1]);
    if (m && d && (!desde || d > desde)) alvo.add(+m[1]);
  }

  // 2. Cada edição: título, datas, ramo e teses com os julgados.
  const edicoes = {}, ramos = {};
  for (const n of [...alvo].sort((a, b) => a - b)) {
    const doc = await ler(`/SCON/jt/doc.jsp?livre='${n}' INPATH(TIT)`);
    const bloco = doc.querySelector(".gridEdicaoJT");
    if (!bloco) continue;
    const datas = [...bloco.querySelectorAll(".clsData")].map((e) => limpo(e.textContent));
    const html = doc.documentElement.innerHTML;
    const ramo = limpo((/clsMateriaJT">([^<]+)</.exec(html) || [])[1]);
    const teses = [];
    for (const t of doc.querySelectorAll(".clsTemasJT.redacaoAtual")) {
      const txt = limpo(t.querySelector(".clsSubmitPesquisaTema")?.textContent);
      const mm = /^(\d+)\)\s*(.*)$/.exec(txt);
      if (!mm) continue;
      // Referência legislativa em itálico, logo abaixo do enunciado ("Resolução CNE/CEB n. 02/2018.").
      const ref = [...t.children].filter((c) => c.tagName === "DIV" && c.querySelector(":scope > i") && !c.className).map((c) => limpo(c.textContent)).join(" ");
      if (ref) mm[2] = `${mm[2]} ${ref}`;
      const grupos = {};
      for (const h4 of t.querySelectorAll("h4")) {
        const lista = h4.nextElementSibling?.classList.contains("clsJulgadosJT") ? h4.nextElementSibling : null;
        grupos[limpo(h4.textContent)] = lista ? [...lista.children].map((d) => limpo(d.textContent)).filter(Boolean) : [];
      }
      const ac = grupos["Acórdãos"] || [];
      const dm = grupos["Decisões Monocráticas"] || [];
      const sm = [...t.querySelectorAll(".saibaMais")].map((s) => limpo(s.textContent)).join("");
      teses.push({ n: +mm[1], t: mm[2], ac, nac: ac.length, dm: dm.length, sm });
    }
    if (!teses.length) continue;
    edicoes[String(n)] = { ed: String(n), tit: limpo(bloco.querySelector(".clsVerbete")?.textContent), ate: datas[0] || "", disp: datas[1] || "", teses };
    if (ramo) (ramos[ramo] = ramos[ramo] || []).push(String(n));
    await new Promise((r) => setTimeout(r, 800)); // pausa entre páginas, para não sobrecarregar o STJ
  }
  return { fonte: "STJ — Jurisprudência em Teses (processo.stj.jus.br/SCON/jt)", coletadoEm: new Date().toISOString().slice(0, 10), recente, edicoes, ramos };
}
