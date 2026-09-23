/* Jurisprudência STJ — aplicação estática (sem dependências). */
(() => {
  "use strict";

  // ------------------------------------------------------------------ util
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const fmtInt = (n) => Number(n || 0).toLocaleString("pt-BR");
  const fmtData = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
  const fmtDataCit = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : ""; };
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const fmtMes = (am) => { const [a, m] = am.split("-"); return `${MESES[+m - 1]}/${a}`; };
  const fmtNumProc = (n) => String(n || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const menosDias = (iso, d) => new Date(new Date(iso + "T12:00:00Z").getTime() - d * 864e5).toISOString().slice(0, 10);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const MINUSC = new Set(["de", "da", "do", "das", "dos", "e"]);
  const titulo = (s) => String(s || "").toLowerCase().replace(/(^|[\s(\-])([\p{L}])/gu, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => (MINUSC.has(w.toLowerCase()) ? w.toLowerCase() : w))
    .replace(/\b(Tj|Trf|Stj|Tjdft)(\w*)\b/gi, (w) => w.toUpperCase());
  const relatorFmt = (rel) => {
    const t = titulo(rel);
    return /convocad/i.test(rel) ? t : `Min. ${t}`;
  };

  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2200);
  }
  async function copiar(txt, msg = "Copiado.") {
    try { await navigator.clipboard.writeText(txt); }
    catch {
      const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* sem suporte */ }
      ta.remove();
    }
    toast(msg);
  }

  const URLS = {
    inteiroTeor: (reg, dj) => `https://processo.stj.jus.br/processo/revista/inteiroteor/?num_registro=${encodeURIComponent(reg)}&dt_publicacao=${encodeURIComponent(fmtData(dj))}`,
    processo: (reg) => `https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaNumeroRegistro&termo=${encodeURIComponent(reg)}`,
    tema: (tp, n) => {
      const cod = { "Tema": "T", "Controvérsia": "C", "IAC": "I", "SIRDR": "S", "PUIL": "P" }[tp] || "T";
      return `https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=${cod}&cod_tema_inicial=${n}&cod_tema_final=${n}`;
    },
  };

  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${r.status} ao carregar ${url}`);
    return r.json();
  }

  // ---------------------------------------------------------- consulta
  // Termos soltos (E), "frases exatas", -exclusão e tema:1234.
  function parseConsulta(q) {
    const res = { inc: [], exc: [], tema: null, bruto: q.trim() };
    const re = /(-?)"([^"]+)"|(-?)(\S+)/g; let m;
    while ((m = re.exec(q))) {
      const neg = m[1] || m[3];
      let termo = m[2] ?? m[4];
      const tm = /^tema:(\d+)$/i.exec(termo);
      if (tm && !neg) { res.tema = +tm[1]; continue; }
      termo = norm(termo).trim();
      if (!termo || (termo.length < 2 && !/\d/.test(termo))) continue;
      (neg ? res.exc : res.inc).push(termo);
    }
    return res;
  }
  function destacar(htmlEsc, termos) {
    if (!termos.length) return htmlEsc;
    // Destaque tolerante a acentos: constrói regex por caractere.
    const mapa = { a: "[aáàâãä]", e: "[eéèêë]", i: "[iíìîï]", o: "[oóòôõö]", u: "[uúùûü]", c: "[cç]", n: "[nñ]" };
    const partes = termos.filter((t) => t.length >= 2).map((t) =>
      t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[aeioucn]/g, (c) => mapa[c]));
    if (!partes.length) return htmlEsc;
    const re = new RegExp(`(${partes.join("|")})`, "gi");
    return htmlEsc.split(/(<[^>]+>)/).map((seg) => (seg.startsWith("<") ? seg : seg.replace(re, "<mark>$1</mark>"))).join("");
  }

  // ------------------------------------------------------------ estado
  const S = {
    man: null,
    orgaos: {},
    shards: new Map(),
    temas: null,
    hist: null,
    radar: null,
  };

  function setStatus(txt, erro = false) { const el = $("#status"); el.textContent = txt; el.classList.toggle("erro", erro); }

  // ------------------------------------------------------------ roteador
  const ABAS = ["inicio", "acordaos", "repetitivos", "radar", "sobre"];
  function lerHash() {
    const h = location.hash.replace(/^#/, "");
    const [aba, qs] = h.split("?");
    return { aba: ABAS.includes(aba) ? aba : "inicio", p: new URLSearchParams(qs || "") };
  }
  function gravarHash(aba, params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== "" && v != null && v !== false) qs.set(k, v === true ? "1" : v);
    const s = qs.toString();
    history.replaceState(null, "", `#${aba}${s ? "?" + s : ""}`);
  }
  const iniciadas = new Set();
  async function rotear() {
    const { aba, p } = lerHash();
    document.querySelectorAll(".aba").forEach((s) => (s.hidden = s.id !== `aba-${aba}`));
    document.querySelectorAll(".abas a").forEach((a) => a.classList.toggle("ativa", a.dataset.aba === aba));
    const fn = { inicio: abaInicio, acordaos: abaAcordaos, repetitivos: abaRepetitivos, radar: abaRadar, sobre: abaSobre }[aba];
    try { await fn(p, !iniciadas.has(aba)); iniciadas.add(aba); }
    catch (e) { console.error(e); setStatus("Não foi possível carregar os dados: " + e.message, true); }
  }

  // ------------------------------------------------------ carregadores
  async function carregarTemas() {
    if (!S.temas) {
      const [t, h] = await Promise.all([getJSON("data/temas.json"), getJSON("data/historico_temas.json").catch(() => [])]);
      for (const x of t) {
        x._n = norm([x.tp, x.n, x.q, x.tese, x.ass, x.anot, x.info, x.delim, x.leg, x.sum, x.org, x.sit].join(" "));
        x._g = grupoSituacao(x.sit);
        x._mov = [x.afet, x.julg, x.pub].filter(Boolean).sort().pop() || "";
      }
      const idx = new Map(t.map((x) => [`${x.tp}-${x.n}`, x]));
      for (const ev of h) { const x = idx.get(`${ev.tp}-${ev.n}`); if (x && ev.d > x._mov) x._mov = ev.d; }
      S.temas = t; S.hist = h; S.temaIdx = idx;
    }
    return S.temas;
  }
  async function carregarRadar() {
    if (!S.radar) {
      S.radar = await getJSON("data/radar.json");
      for (const x of S.radar) x._p = norm(`${x.p} ${x.r || ""}`);
    }
    return S.radar;
  }
  function carregarShard(mes, slug) {
    const k = `${mes}/${slug}`;
    if (!S.shards.has(k)) {
      S.shards.set(k, getJSON(`data/acordaos/${mes}/${slug}.json`).catch((e) => { S.shards.delete(k); throw e; }));
    }
    return S.shards.get(k);
  }
  async function carregarVarios(pares, onProg) {
    const res = []; let feitos = 0; let i = 0;
    const trab = async () => {
      while (i < pares.length) {
        const [m, o] = pares[i++];
        res.push(...(await carregarShard(m, o)));
        onProg(++feitos, pares.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, pares.length) }, trab));
    return res;
  }

  function grupoSituacao(sit) {
    const s = norm(sit);
    if (/afetad|em julgamento|pendente|admitido|sobrestad/.test(s)) return "andamento";
    if (/acordao publicado|transito|merito julgado/.test(s)) return "julgado";
    if (/cancelad|revisad|prejudicad|indeferid|finalizada/.test(s)) return "cancelado";
    return "outro";
  }
  const seloSit = (sit) => {
    const g = grupoSituacao(sit);
    const cls = { andamento: "and", julgado: "ok", cancelado: "canc" }[g] || "";
    return `<span class="selo ${cls}">${esc(sit || "—")}</span>`;
  };

  // ============================================================ INÍCIO
  async function abaInicio(p, primeira) {
    await carregarTemas();
    if (primeira) $("#ini-janela").addEventListener("change", () => renderInicio());
    renderInicio();
    // Acórdãos do último mês
    const ult = S.man.meses[0];
    if (ult) {
      const ent = Object.entries(ult.orgaos).sort((a, b) => b[1].n - a[1].n);
      const max = Math.max(1, ...ent.map(([, v]) => v.n));
      const total = ent.reduce((s, [, v]) => s + v.n, 0);
      $("#ini-mes-nota").textContent = `${fmtInt(total)} acórdãos publicados em ${fmtMes(ult.m)}, conforme os espelhos já divulgados pelo STJ.`;
      $("#ini-orgaos").innerHTML = ent.map(([slug, v]) =>
        `<li><a href="#acordaos?p=${ult.m}&o=${slug}">${esc(S.orgaos[slug])}</a><span class="barra"><i style="width:${(v.n / max) * 100}%"></i></span><span class="num">${fmtInt(v.n)}</span></li>`).join("");
    }
    // Radar
    const rad = await carregarRadar();
    const porDia = {};
    for (const x of rad) porDia[x.d] = (porDia[x.d] || 0) + 1;
    const dias = Object.keys(porDia).sort().reverse().slice(0, 10);
    const maxd = Math.max(1, ...dias.map((d) => porDia[d]));
    $("#ini-radar-nota").textContent = dias.length ? `Últimos dias com publicação disponível na base diária (a mais recente é de ${fmtData(dias[0])}).` : "Sem dados.";
    $("#ini-radar").innerHTML = dias.map((d) =>
      `<li><a href="#radar?d=${d}">${fmtData(d)}</a><span class="barra"><i style="width:${(porDia[d] / maxd) * 100}%"></i></span><span class="num">${fmtInt(porDia[d])}</span></li>`).join("");
  }

  let filtroKpi = "";
  function renderInicio() {
    const jan = +$("#ini-janela").value;
    const desde = menosDias(hojeISO(), jan);
    const evs = [];
    for (const t of S.temas) {
      if (t.afet >= desde) evs.push({ d: t.afet, k: "afet", t, txt: "Afetação" });
      if (t.julg >= desde) evs.push({ d: t.julg, k: "julg", t, txt: "Julgamento" });
      if (t.pub >= desde) evs.push({ d: t.pub, k: "pub", t, txt: "Acórdão publicado" });
    }
    for (const h of S.hist) {
      if (h.d < desde) continue;
      const t = S.temaIdx.get(`${h.tp}-${h.n}`); if (!t) continue;
      const txt = h.ev === "situacao" ? `Situação: ${h.de} → ${h.para}` : h.ev === "novo" ? "Incluído na base" : h.ev === "tese" ? "Tese firmada registrada" : "Tese alterada";
      evs.push({ d: h.d, k: "mud", t, txt });
    }
    const vistos = new Set();
    for (let i = evs.length - 1; i >= 0; i--) {
      const k = `${evs[i].k}|${evs[i].t.tp}|${evs[i].t.n}|${evs[i].d}|${evs[i].txt}`;
      if (vistos.has(k)) evs.splice(i, 1); else vistos.add(k);
    }
    const cont = { afet: 0, julg: 0, pub: 0, mud: 0 };
    evs.forEach((e) => cont[e.k]++);
    const rot = { afet: "afetações", julg: "julgamentos", pub: "acórdãos publicados", mud: "mudanças registradas" };
    $("#ini-kpis").innerHTML = Object.keys(cont).map((k) =>
      `<button type="button" class="kpi ${filtroKpi === k ? "ativo" : ""}" data-k="${k}"><b>${fmtInt(cont[k])}</b><span>${rot[k]}</span></button>`).join("");
    $("#ini-kpis").querySelectorAll(".kpi").forEach((b) => b.addEventListener("click", () => { filtroKpi = filtroKpi === b.dataset.k ? "" : b.dataset.k; renderInicio(); }));
    const lista = evs.filter((e) => !filtroKpi || e.k === filtroKpi).sort((a, b) => (b.d > a.d ? 1 : b.d < a.d ? -1 : b.t.n - a.t.n));
    $("#ini-eventos").innerHTML = lista.length ? lista.slice(0, 200).map((e) => {
      const t = e.t;
      const tx = t.tese ? `Tese: ${t.tese}` : t.q || "";
      return `<li><span class="ev-data">${fmtData(e.d)}</span><div>
        <div class="ev-tit"><a href="#repetitivos?q=${encodeURIComponent(t.n)}&tipo=${encodeURIComponent(t.tp)}">${esc(t.tp)} ${t.n}</a> · ${esc(e.txt)} ${seloSit(t.sit)} <span class="meta">${esc(t.org || "")}</span></div>
        <div class="ev-txt">${esc(tx)}</div></div></li>`;
    }).join("") : `<li><span></span><div class="nota">Nenhuma movimentação no período.</div></li>`;
  }

  // ========================================================== ACÓRDÃOS
  const AC = { lista: [], mostrados: 0, termos: [], token: 0 };
  function periodoMeses(v) {
    const meses = S.man.meses.map((m) => m.m);
    if (/^\d{4}-\d{2}$/.test(v)) return meses.includes(v) ? [v] : [];
    const n = +(/^u(\d+)$/.exec(v)?.[1] || 1);
    return meses.slice(0, n);
  }
  async function abaAcordaos(p, primeira) {
    if (primeira) {
      $("#ac-orgao").innerHTML += Object.entries(S.orgaos).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
      const meses = S.man.meses;
      $("#ac-periodo").innerHTML =
        [["u1", `Último mês disponível (${meses[0] ? fmtMes(meses[0].m) : "—"})`], ["u3", "Últimos 3 meses"], ["u6", "Últimos 6 meses"], ["u12", "Últimos 12 meses"]]
          .map(([v, l]) => `<option value="${v}">${l}</option>`).join("") +
        `<optgroup label="Mês específico">${meses.map((m) => `<option value="${m.m}">${fmtMes(m.m)}</option>`).join("")}</optgroup>`;
      const rodar = debounce(() => buscarAcordaos(), 280);
      ["#ac-q", "#ac-classe", "#ac-rel", "#ac-proc"].forEach((s) => $(s).addEventListener("input", rodar));
      ["#ac-orgao", "#ac-periodo", "#ac-qualif", "#ac-ordem"].forEach((s) => $(s).addEventListener("change", () => buscarAcordaos()));
      $("#f-ac").addEventListener("submit", (e) => { e.preventDefault(); buscarAcordaos(); });
      $("#ac-mais").addEventListener("click", () => renderAcordaos(false));
      $("#ac-link").addEventListener("click", () => copiar(location.href, "Link copiado."));
      $("#ac-lista").addEventListener("click", cliqueCard);
    }
    if (p.toString() || primeira) {
      $("#ac-q").value = p.get("q") || "";
      $("#ac-orgao").value = p.get("o") || "";
      $("#ac-periodo").value = p.get("p") || "u1";
      if (!$("#ac-periodo").value) $("#ac-periodo").value = "u1";
      $("#ac-classe").value = p.get("c") || "";
      $("#ac-rel").value = p.get("r") || "";
      $("#ac-proc").value = p.get("n") || "";
      $("#ac-qualif").checked = p.get("x") === "1";
      $("#ac-ordem").value = p.get("s") || "data";
      await buscarAcordaos();
    }
  }

  function textoBusca(r) {
    if (r._n === undefined) r._n = norm([r.em, r.tese, r.tema, r.notas, r.info, (r.leg || []).join(" ")].join("\n"));
    return r._n;
  }
  const reTema = (n) => new RegExp(`(tema|controversia|iac)[^0-9]{0,30}(n[.ºo°]*\\s*)?${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\\.?")}\\b`, "i");
  const ehQualificado = (r) => !!(r.tese || r.tema || /^ProAfR|IAC|IRDR|^EREsp|^EAREsp/.test(r.cl || "") || /repetitiv|afeta[cç]|tema\s/i.test(r.notas || ""));

  async function buscarAcordaos() {
    const tk = ++AC.token;
    const f = {
      q: $("#ac-q").value, o: $("#ac-orgao").value, p: $("#ac-periodo").value,
      c: $("#ac-classe").value.trim(), r: $("#ac-rel").value.trim(), n: $("#ac-proc").value.replace(/\D/g, ""),
      x: $("#ac-qualif").checked, s: $("#ac-ordem").value,
    };
    gravarHash("acordaos", { ...f, p: f.p === "u1" ? "" : f.p, s: f.s === "data" ? "" : f.s });
    const meses = periodoMeses(f.p);
    const orgs = f.o ? [f.o] : Object.keys(S.orgaos);
    const pares = [];
    for (const m of meses) {
      const info = S.man.meses.find((x) => x.m === m);
      for (const o of orgs) if (info?.orgaos[o]) pares.push([m, o]);
    }
    const kb = pares.reduce((s, [m, o]) => s + (S.man.meses.find((x) => x.m === m).orgaos[o].kb || 0), 0);
    const pendentes = pares.filter(([m, o]) => !S.shards.has(`${m}/${o}`)).length;
    const prog = $("#ac-prog");
    if (pendentes) {
      prog.hidden = false; prog.firstElementChild.style.width = "0";
      $("#ac-info").textContent = `Carregando ${pares.length} arquivo(s) (cerca de ${fmtInt(Math.round(kb / 1024))} MB antes da compressão)…`;
    }
    let dados;
    try {
      dados = await carregarVarios(pares, (a, b) => { if (tk === AC.token) prog.firstElementChild.style.width = `${(a / b) * 100}%`; });
    } catch (e) {
      prog.hidden = true;
      $("#ac-info").textContent = "Falha ao carregar parte dos dados. Tente novamente.";
      throw e;
    }
    if (tk !== AC.token) return;
    prog.hidden = true;

    const cons = parseConsulta(f.q);
    const cN = norm(f.c), rN = norm(f.r);
    const rTema = cons.tema ? reTema(cons.tema) : null;
    const res = [];
    for (const r of dados) {
      if (f.n && !(String(r.n).includes(f.n) || String(r.reg).includes(f.n))) continue;
      if (cN && !new RegExp(`(^|\\s)${cN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(norm(r.cl))) continue;
      if (rN && !norm(r.rel).includes(rN)) continue;
      if (f.x && !ehQualificado(r)) continue;
      if (rTema && !rTema.test(`${r.tema || ""} ${r.notas || ""} ${norm(r.em)}`)) continue;
      if (cons.inc.length || cons.exc.length) {
        const t = textoBusca(r);
        if (!cons.inc.every((w) => t.includes(w))) continue;
        if (cons.exc.some((w) => t.includes(w))) continue;
        if (f.s === "rel") {
          const cab = t.slice(0, t.indexOf("\n") > 0 ? t.indexOf("\n") : 400);
          r._score = cons.inc.reduce((s, w) => s + t.split(w).length - 1 + (cab.includes(w) ? 5 : 0), 0);
        }
      }
      res.push(r);
    }
    const ord = {
      data: (a, b) => (b.dj || "").localeCompare(a.dj || "") || (b.dd || "").localeCompare(a.dd || ""),
      julg: (a, b) => (b.dd || "").localeCompare(a.dd || "") || (b.dj || "").localeCompare(a.dj || ""),
      rel: (a, b) => (b._score || 0) - (a._score || 0) || (b.dj || "").localeCompare(a.dj || ""),
    }[f.s];
    res.sort(ord);
    AC.lista = res; AC.termos = cons.inc; AC.mostrados = 0;
    const rotPer = meses.length === 1 ? fmtMes(meses[0]) : meses.length ? `${fmtMes(meses[meses.length - 1])} a ${fmtMes(meses[0])}` : "—";
    $("#ac-info").textContent = `${fmtInt(res.length)} acórdão(s) · publicação em ${rotPer} · ${fmtInt(dados.length)} na seleção`;
    renderAcordaos(true);
    if (!AC.datalists) montarDatalists(dados);
  }
  function montarDatalists(dados) {
    AC.datalists = true;
    const cls = new Map(), rels = new Map();
    for (const r of dados) { cls.set(r.cl, (cls.get(r.cl) || 0) + 1); rels.set(r.rel, (rels.get(r.rel) || 0) + 1); }
    $("#ac-classes").innerHTML = [...cls].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([c]) => `<option value="${esc(c)}">`).join("");
    $("#ac-rels").innerHTML = [...rels].sort((a, b) => a[0].localeCompare(b[0])).map(([r]) => `<option value="${esc(titulo(r))}">`).join("");
  }

  function paragrafosEmenta(em) {
    const ps = String(em || "").split("\n");
    return { cab: ps[0] || "", corpo: ps.slice(1) };
  }
  function citacao(r) {
    const veic = (/^(\S+)/.exec(r.djt || "")?.[1] || "DJEN").replace(/[^A-Za-z]/g, "") || "DJEN";
    return `(STJ, ${r.cl} n. ${fmtNumProc(r.n)}, Rel. ${relatorFmt(r.rel)}, ${S.orgaos[r.o]}, julgado em ${fmtDataCit(r.dd)}, ${veic} de ${fmtDataCit(r.dj)}.)`;
  }
  function cardAcordao(r, i) {
    const { cab, corpo } = paragrafosEmenta(r.em);
    const termos = AC.termos;
    const corpoTxt = corpo.map((p) => `<p>${destacar(esc(p), termos)}</p>`).join("");
    const longo = corpo.join(" ").length > 700;
    const casouCorpo = termos.length && termos.some((w) => norm(corpo.join(" ")).includes(w)) && !termos.every((w) => norm(cab).includes(w));
    const recolher = longo && !casouCorpo;
    const qual = ehQualificado(r) ? `<span class="selo qual">${esc(/^ProAfR/.test(r.cl) ? "Afetação" : r.tema ? "Repetitivo / tema" : "Precedente qualificado")}</span>` : "";
    const extra = [];
    if (r.notas) extra.push(`<dt>Notas</dt><dd>${esc(r.notas)}</dd>`);
    if (r.tema) extra.push(`<dt>Tema</dt><dd>${esc(r.tema)}</dd>`);
    if (r.info) extra.push(`<dt>Informações complementares</dt><dd>${esc(r.info)}</dd>`);
    if (r.leg?.length) extra.push(`<dt>Referências legislativas</dt><dd>${r.leg.map(esc).join("<br>")}</dd>`);
    return `<li class="card" data-i="${i}">
      <div class="card-cab"><span class="card-tit">${esc(r.cl)} ${fmtNumProc(r.n)}</span>
        <span class="meta"><span>${esc(S.orgaos[r.o])}</span><span>Rel. ${esc(relatorFmt(r.rel))}</span><span>julg. ${fmtData(r.dd)}</span><span>${esc((r.djt || "").split(/\s/)[0] || "DJ")} ${fmtData(r.dj)}</span></span> ${qual}</div>
      <div class="ementa ${recolher ? "recolhida" : ""}">
        <p class="verbetacao">${destacar(esc(cab), termos)}</p>
        <div class="corpo">${corpoTxt}</div>
      </div>
      ${r.tese ? `<div class="tese"><b>Tese jurídica</b>${destacar(esc(r.tese), termos)}</div>` : ""}
      ${extra.length ? `<dl class="extra" hidden>${extra.join("")}</dl>` : ""}
      <div class="acoes">
        ${corpo.length && longo ? `<button type="button" data-a="ementa">${recolher ? "Ver ementa completa" : "Recolher ementa"}</button>` : ""}
        ${extra.length ? `<button type="button" data-a="extra">Notas e legislação</button>` : ""}
        <a href="${URLS.inteiroTeor(r.reg, r.dj)}" target="_blank" rel="noopener">Inteiro teor (STJ)</a>
        <a href="${URLS.processo(r.reg)}" target="_blank" rel="noopener">Consulta processual</a>
        <button type="button" data-a="cit">Copiar citação</button>
        <button type="button" data-a="em">Copiar ementa</button>
      </div></li>`;
  }
  function renderAcordaos(reset) {
    const ul = $("#ac-lista");
    if (reset) { ul.innerHTML = ""; AC.mostrados = 0; }
    const lote = AC.lista.slice(AC.mostrados, AC.mostrados + 25);
    ul.insertAdjacentHTML("beforeend", lote.map((r, j) => cardAcordao(r, AC.mostrados + j)).join(""));
    AC.mostrados += lote.length;
    if (!AC.lista.length) ul.innerHTML = `<li class="vazio">Nenhum acórdão encontrado com esses critérios. Tente ampliar o período ou remover filtros.</li>`;
    $("#ac-mais").hidden = AC.mostrados >= AC.lista.length;
    $("#ac-mais").textContent = `Mostrar mais (${fmtInt(AC.lista.length - AC.mostrados)} restantes)`;
  }
  function cliqueCard(ev) {
    const b = ev.target.closest("button[data-a]"); if (!b) return;
    const li = b.closest(".card"); const r = AC.lista[+li.dataset.i];
    const a = b.dataset.a;
    if (a === "ementa") { const e = li.querySelector(".ementa"); e.classList.toggle("recolhida"); b.textContent = e.classList.contains("recolhida") ? "Ver ementa completa" : "Recolher ementa"; }
    if (a === "extra") { const d = li.querySelector(".extra"); d.hidden = !d.hidden; }
    if (a === "cit") copiar(citacao(r), "Citação copiada.");
    if (a === "em") copiar(`${r.em.replace(/\n/g, "\n")}\n${citacao(r)}`, "Ementa copiada com a citação.");
  }

  // ======================================================= REPETITIVOS
  const RP = { lista: [], mostrados: 0, termos: [] };
  async function abaRepetitivos(p, primeira) {
    await carregarTemas();
    if (primeira) {
      const rodar = debounce(() => buscarTemas(), 200);
      $("#rp-q").addEventListener("input", rodar);
      ["#rp-tipo", "#rp-sit", "#rp-org", "#rp-susp", "#rp-ordem"].forEach((s) => $(s).addEventListener("change", () => buscarTemas()));
      $("#f-rp").addEventListener("submit", (e) => { e.preventDefault(); buscarTemas(); });
      $("#rp-mais").addEventListener("click", () => renderTemas(false));
      $("#rp-link").addEventListener("click", () => copiar(location.href, "Link copiado."));
      $("#rp-lista").addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-a]"); if (!b) return;
        const li = b.closest(".card"); const t = RP.lista[+li.dataset.i];
        if (b.dataset.a === "det") { const d = li.querySelector(".extra"); d.hidden = !d.hidden; b.textContent = d.hidden ? "Mais informações" : "Menos informações"; }
        if (b.dataset.a === "cit") copiar(`${t.tp} ${t.tp === "Tema" ? "Repetitivo " : ""}${t.n}/STJ${t.tese ? ` — Tese: ${t.tese}` : ""}`, "Copiado.");
      });
    }
    if (p.toString() || primeira) {
      $("#rp-q").value = p.get("q") || "";
      $("#rp-tipo").value = p.has("tipo") ? (p.get("tipo") === "todos" ? "" : p.get("tipo")) : "Tema";
      $("#rp-sit").value = p.get("sit") || "";
      $("#rp-org").value = p.get("org") || "";
      $("#rp-susp").checked = p.get("susp") === "1";
      $("#rp-ordem").value = p.get("s") || "mov";
    }
    buscarTemas();
  }
  function buscarTemas() {
    const f = { q: $("#rp-q").value, tipo: $("#rp-tipo").value, sit: $("#rp-sit").value, org: $("#rp-org").value, susp: $("#rp-susp").checked, s: $("#rp-ordem").value };
    gravarHash("repetitivos", { ...f, tipo: f.tipo === "Tema" ? "" : f.tipo || "todos", s: f.s === "mov" ? "" : f.s });
    const qTrim = f.q.trim();
    const numero = /^\d+$/.test(qTrim) ? +qTrim : null;
    const cons = numero ? { inc: [], exc: [] } : parseConsulta(f.q);
    const tipo = f.tipo === "todos" ? "" : f.tipo;
    const res = S.temas.filter((t) => {
      if (tipo && t.tp !== tipo) return false;
      if (f.sit && t._g !== f.sit) return false;
      if (f.org && t.org !== f.org) return false;
      if (f.susp && !/suspens/i.test(t.info || "")) return false;
      if (numero != null) return t.n === numero;
      if (!cons.inc.every((w) => t._n.includes(w))) return false;
      if (cons.exc.some((w) => t._n.includes(w))) return false;
      return true;
    });
    res.sort(f.s === "num" ? (a, b) => b.n - a.n : (a, b) => (b._mov || "").localeCompare(a._mov || "") || b.n - a.n);
    RP.lista = res; RP.termos = cons.inc; RP.mostrados = 0;
    $("#rp-info").textContent = `${fmtInt(res.length)} registro(s)`;
    renderTemas(true);
  }
  function cardTema(t, i) {
    const w = RP.termos;
    const datas = [["Afetação", t.afet], ["Julgamento", t.julg], ["Acórdão publicado", t.pub]].filter(([, d]) => d).map(([l, d]) => `<span>${l} ${fmtData(d)}</span>`).join("");
    const det = [
      ["Informações complementares", t.info], ["Anotações NUGEPNAC", t.anot], ["Delimitação do julgado", t.delim], ["Entendimento anterior", t.ant],
      ["Referência legislativa", t.leg], ["Súmula originada", t.sum], ["Repercussão geral no STF", t.rg ? `Tema ${t.rg}${t.rgd ? " — " + t.rgd : ""}` : ""], ["Assuntos", t.ass],
    ].filter(([, v]) => v).map(([l, v]) => `<dt>${l}</dt><dd>${destacar(esc(v), w)}</dd>`).join("");
    const suspenso = /suspens/i.test(t.info || "") && t._g === "andamento";
    return `<li class="card" data-i="${i}">
      <div class="card-cab"><span class="card-tit">${esc(t.tp)} ${t.n}</span> ${seloSit(t.sit)} ${suspenso ? `<span class="selo and">Suspensão determinada</span>` : ""}
        <span class="meta"><span>${esc(t.org || "—")}</span>${datas}</span></div>
      ${t.q ? `<div class="ementa"><p>${destacar(esc(t.q), w)}</p></div>` : ""}
      ${t.tese ? `<div class="tese"><b>Tese firmada</b>${destacar(esc(t.tese), w)}</div>` : ""}
      ${det ? `<dl class="extra" hidden>${det}</dl>` : ""}
      <div class="acoes">
        ${det ? `<button type="button" data-a="det">Mais informações</button>` : ""}
        <a href="${URLS.tema(t.tp, t.n)}" target="_blank" rel="noopener">Página oficial no STJ</a>
        ${["Tema", "Controvérsia", "IAC"].includes(t.tp) ? `<a href="#acordaos?q=tema:${t.n}&p=u12&x=1">Acórdãos relacionados neste site</a>` : ""}
        <button type="button" data-a="cit">Copiar referência</button>
      </div></li>`;
  }
  function renderTemas(reset) {
    const ul = $("#rp-lista");
    if (reset) { ul.innerHTML = ""; RP.mostrados = 0; }
    const lote = RP.lista.slice(RP.mostrados, RP.mostrados + 30);
    ul.insertAdjacentHTML("beforeend", lote.map((t, j) => cardTema(t, RP.mostrados + j)).join(""));
    RP.mostrados += lote.length;
    if (!RP.lista.length) ul.innerHTML = `<li class="vazio">Nenhum registro encontrado.</li>`;
    $("#rp-mais").hidden = RP.mostrados >= RP.lista.length;
    $("#rp-mais").textContent = `Mostrar mais (${fmtInt(RP.lista.length - RP.mostrados)} restantes)`;
  }

  // ============================================================= RADAR
  const RD = { lista: [], mostrados: 0 };
  async function abaRadar(p, primeira) {
    const rad = await carregarRadar();
    if (primeira) {
      const dias = [...new Set(rad.map((x) => x.d))].sort().reverse();
      $("#rd-dia").innerHTML += dias.map((d) => `<option value="${d}">${fmtData(d)}</option>`).join("");
      $("#rd-turma").innerHTML += Object.entries(S.orgaos).filter(([k]) => k.endsWith("turma")).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
      $("#rd-rels").innerHTML = [...new Set(rad.map((x) => x.rel))].sort().map((r) => `<option value="${esc(titulo(r))}">`).join("");
      const rodar = debounce(() => buscarRadar(), 200);
      ["#rd-rel", "#rd-q"].forEach((s) => $(s).addEventListener("input", rodar));
      ["#rd-dia", "#rd-turma"].forEach((s) => $(s).addEventListener("change", () => buscarRadar()));
      $("#f-rd").addEventListener("submit", (e) => { e.preventDefault(); buscarRadar(); });
      $("#rd-mais").addEventListener("click", () => renderRadar(false));
    }
    if (p.toString() || primeira) {
      $("#rd-dia").value = p.get("d") || "";
      $("#rd-turma").value = p.get("t") || "";
      $("#rd-rel").value = p.get("r") || "";
      $("#rd-q").value = p.get("q") || "";
    }
    buscarRadar();
  }
  function buscarRadar() {
    const f = { d: $("#rd-dia").value, t: $("#rd-turma").value, r: $("#rd-rel").value.trim(), q: $("#rd-q").value.trim() };
    gravarHash("radar", f);
    const rN = norm(f.r), qN = norm(f.q).split(/\s+/).filter(Boolean);
    RD.lista = S.radar.filter((x) => (!f.d || x.d === f.d) && (!f.t || x.tr === f.t) && (!rN || norm(x.rel).includes(rN)) && qN.every((w) => x._p.includes(w)));
    $("#rd-info").textContent = `${fmtInt(RD.lista.length)} acórdão(s) publicados`;
    renderRadar(true);
  }
  function renderRadar(reset) {
    const tb = $("#rd-tab tbody");
    if (reset) { tb.innerHTML = ""; RD.mostrados = 0; }
    const lote = RD.lista.slice(RD.mostrados, RD.mostrados + 100);
    tb.insertAdjacentHTML("beforeend", lote.map((x) => `<tr>
      <td>${fmtData(x.d)}</td><td><strong>${esc(x.p)}</strong></td><td>${esc(x.r || "—")}</td>
      <td>${esc(relatorFmt(x.rel))}${x.tr ? `<div class="nota">${esc(S.orgaos[x.tr])} (aprox.)</div>` : ""}</td>
      <td>${esc(x.t || "—")}</td>
      <td class="links"><a href="${URLS.inteiroTeor(x.reg, x.d)}" target="_blank" rel="noopener">Inteiro teor</a><a href="${URLS.processo(x.reg)}" target="_blank" rel="noopener">Processo</a></td></tr>`).join(""));
    RD.mostrados += lote.length;
    if (!RD.lista.length) tb.innerHTML = `<tr><td colspan="6" class="nota">Nenhum resultado.</td></tr>`;
    $("#rd-mais").hidden = RD.mostrados >= RD.lista.length;
    $("#rd-mais").textContent = `Mostrar mais (${fmtInt(RD.lista.length - RD.mostrados)} restantes)`;
  }

  // ============================================================= SOBRE
  async function abaSobre() {
    const m = S.man;
    const total = m.meses.reduce((s, x) => s + Object.values(x.orgaos).reduce((a, b) => a + b.n, 0), 0);
    const ult = Object.entries(m.ultimoArquivoEspelhos || {}).map(([k, v]) => `<li>${esc(S.orgaos[k])}: arquivo de ${fmtData(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`)}</li>`).join("");
    $("#sobre-base").innerHTML = `<p>Última execução da rotina: ${new Date(m.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (horário de Brasília).</p>
      <p>${fmtInt(total)} acórdãos, publicados de ${m.meses.length ? fmtMes(m.meses[m.meses.length - 1].m) : "—"} a ${m.meses.length ? fmtMes(m.meses[0].m) : "—"}; ${fmtInt(m.temas?.n)} precedentes qualificados; radar com ${fmtInt(m.radar?.n)} acórdãos.</p>
      ${ult ? `<p>Espelho mais recente divulgado pelo STJ:</p><ul>${ult}</ul>` : ""}
      ${m.erros?.length ? `<p class="status erro">Na última execução, parte das fontes não respondeu: ${esc(m.erros.join("; "))}. Os dados anteriores foram mantidos.</p>` : ""}
      <p>Dicas de pesquisa: termos separados são combinados (todos devem constar); use aspas para expressão exata, hífen para excluir (ex.: <code>-penal</code>) e <code>tema:1234</code> para localizar acórdãos que mencionem um tema.</p>`;
  }

  // ============================================================== init
  async function init() {
    try {
      S.man = await getJSON("data/manifest.json");
    } catch (e) {
      setStatus("A base ainda não foi gerada. Rode a rotina de atualização (veja o README).", true);
      return;
    }
    S.orgaos = S.man.orgaos;
    const total = S.man.meses.reduce((s, x) => s + Object.values(x.orgaos).reduce((a, b) => a + b.n, 0), 0);
    const quando = new Date(S.man.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    setStatus(`Base atualizada em ${quando} · ${fmtInt(total)} acórdãos (${S.man.meses.length ? fmtMes(S.man.meses[S.man.meses.length - 1].m) + " a " + fmtMes(S.man.meses[0].m) : "—"}) · ${fmtInt(S.man.temas?.temas)} temas repetitivos`);
    window.addEventListener("hashchange", rotear);
    rotear();
  }
  init();
})();
