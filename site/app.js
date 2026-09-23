/* Radar STJ — aplicação estática, sem dependências (bibliotecas de PDF/DOCX
   são carregadas sob demanda apenas na verificação de petição). */
(() => {
  "use strict";

  // =================================================================== util
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fmtInt = (n) => Number(n || 0).toLocaleString("pt-BR");
  const fmtData = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
  const fmtDataCit = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : ""; };
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const MESES_L = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const fmtMes = (am) => { const [a, m] = String(am).split("-"); return `${MESES[+m - 1]}/${a}`; };
  const fmtMesL = (am) => { const [a, m] = String(am).split("-"); return `${MESES_L[+m - 1]} de ${a}`; };
  const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const fmtDiaL = (iso) => { const d = new Date(iso + "T12:00:00Z"); return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES_L[d.getUTCMonth()]}`; };
  const fmtNumProc = (n) => String(n || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const somaDias = (iso, d) => new Date(new Date(iso + "T12:00:00Z").getTime() + d * 864e5).toISOString().slice(0, 10);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const digitos = (s) => String(s || "").replace(/\D/g, "");
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const MINUSC = new Set(["de", "da", "do", "das", "dos", "e"]);
  const titulo = (s) => String(s || "").toLowerCase().replace(/(^|[\s(\-])([\p{L}])/gu, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => (MINUSC.has(w.toLowerCase()) ? w.toLowerCase() : w))
    .replace(/\b(Tj|Trf|Stj|Tjdft)(\w*)\b/gi, (w) => w.toUpperCase());
  const relatorFmt = (rel) => (/convocad/i.test(rel) ? titulo(rel) : `Min. ${titulo(rel)}`);

  // Verbetação em caixa alta → frase legível, preservando siglas e números.
  const SIGLAS = new Set(("STJ STF TST TSE CNJ CPC CPP CF CDC CTN CLT ECA LINDB LEF LRF ANS ANTT ANEEL ANATEL ANVISA BACEN CVM INSS FGTS ICMS IPI ISS ISSQN IPTU IPVA ITBI ITCMD IRPJ IRPF CSLL PIS COFINS PASEP CPRB DIFAL SUS MPF MPT MP OAB TJ TRF TRT RE REsp AREsp HC RHC RMS EREsp EAREsp IAC IRDR PUIL IRPF SFH CCB CRI UF DF LC EC ADI ADC ADPF CNH DPVAT SPC IPCA INPC SELIC IGP-M CBS IBS CNPJ CPF PIX ECAD INPI CADE SUSEP PREVIC PGFN CARF DNIT CEF BB BNDES ONU OMS PL CNIS RPV RPPS RGPS IN CPMF IOF IE SIMPLES ABNT FIES").split(" "));
  const ROMANOS = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV)$/;
  function frase(txt) {
    if (!txt) return "";
    txt = txt.replace(/^\s*ementa\s*[.:–-]?\s*/i, "");
    // Converte apenas os trechos em caixa alta (a verbetação), frase por frase.
    const sentencas = txt.split(/(?<=\.)\s+/);
    const out = sentencas.map((sen) => {
      const letras = sen.replace(/[^A-Za-zÀ-ÿ]/g, "");
      const maius = letras.replace(/[^A-ZÀ-Ý]/g, "").length;
      if (!letras.length || maius / letras.length < 0.7) return sen;
      const t = sen.split(/(\s+|[.,;:()\/"“”'–—-])/).map((p) => {
        if (!/[A-ZÀ-Ü]/.test(p)) return p;
        if (SIGLAS.has(p) || ROMANOS.test(p) || /\d/.test(p)) return p;
        return p.toLowerCase();
      }).join("");
      return t.replace(/^(["“(]?)([a-zà-ü])/, (m, a, b) => a + b.toUpperCase());
    }).join(" ");
    return out;
  }

  // ================================================================ ícones
  const I = {
    painel: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    radar: '<path d="M18 16v-5a6 6 0 1 0-12 0v5l-1.5 2h15z"/><path d="M10 21h4"/>',
    destaques: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    pesquisa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    repetitivos: '<path d="M12 4v16M6.5 7h11M6.5 7 3.5 13h6zM17.5 7l-3 6h6z"/>',
    pautas: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    verificar: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14l2 2 4-4"/>',
    sobre: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    mais: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    externo: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    copiar: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
    salvar: '<path d="M6 4h12v17l-6-4-6 4z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    mais1: '<path d="M12 5v14M5 12h14"/>',
    seta: '<path d="m9 6 6 6-6 6"/>',
    alerta: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
    raio: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
    filtro: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
    arquivo: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  };
  const ico = (k, cls = "") => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${I[k] || ""}</svg>`;

  // ============================================================ armazenamento
  const CHAVE = "radar-stj.v1";
  const Store = {
    ler() {
      try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; }
    },
    gravar(o) { try { localStorage.setItem(CHAVE, JSON.stringify(o)); } catch { /* sem armazenamento */ } },
  };
  const P = Object.assign({ termos: [], procs: [], oabs: [], salvos: {}, vistoEm: null }, Store.ler());
  if (!P.vistoEm) { P.vistoEm = somaDias(hojeISO(), -7); Store.gravar(P); }
  const salvarP = () => Store.gravar(P);

  // ================================================================ avisos
  function toast(msg) {
    const box = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { el.classList.add("sai"); setTimeout(() => el.remove(), 200); }, 2400);
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

  // =================================================================== URLs
  const URLS = {
    inteiroTeor: (reg, dj) => `https://processo.stj.jus.br/processo/revista/inteiroteor/?num_registro=${encodeURIComponent(reg)}&dt_publicacao=${encodeURIComponent(fmtData(dj))}`,
    processo: (reg) => `https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaNumeroRegistro&termo=${encodeURIComponent(reg)}`,
    tema: (tp, n) => {
      const cod = { "Tema": "T", "Controvérsia": "C", "IAC": "I", "SIRDR": "S", "PUIL": "P" }[tp] || "T";
      return `https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=${cod}&cod_tema_inicial=${n}&cod_tema_final=${n}`;
    },
  };

  // ============================================================ rótulos
  const AREAS = {
    "proc-civil": "Processo Civil", civil: "Civil", consumidor: "Consumidor", familia: "Família e Sucessões",
    empresarial: "Empresarial", bancario: "Bancário", tributario: "Tributário", administrativo: "Administrativo",
    previdenciario: "Previdenciário", ambiental: "Ambiental", penal: "Penal e Processo Penal", trabalho: "Trabalho",
  };
  const MOTIVOS = {
    ce: "Corte Especial", secao: "Seção", afetacao: "Afetação ao rito repetitivo", eresp: "Embargos de divergência",
    iac: "IAC / PUIL", tese: "Tese firmada", repetitivo: "Recurso repetitivo", mudanca: "Sinal de mudança de entendimento",
    inedito: "Questão nova", modulacao: "Modulação de efeitos", distincao: "Distinção (distinguishing)", divergencia: "Divergência",
  };
  const nivelAc = (s) => (s >= 10 ? "alta" : s >= 6 ? "rel" : s >= 2 ? "acomp" : "");
  const NIVEL_TX = { alta: "Alta relevância", rel: "Relevante", acomp: "Acompanhar" };
  const seloNivel = (n) => (n ? `<span class="selo ${n}"><span class="ponto ${n}"></span>${NIVEL_TX[n]}</span>` : "");

  function grupoSituacao(sit) {
    const s = norm(sit);
    if (/acordao publicado|transito|merito julgado/.test(s)) return "julgado";
    if (/afetad|em julgamento|pendente|admitido|sobrestad/.test(s)) return "andamento";
    if (/cancelad|revisad|prejudicad|indeferid|finalizada/.test(s)) return "cancelado";
    return "outro";
  }
  const seloSit = (sit) => {
    const cls = { andamento: "rel", julgado: "ok", cancelado: "canc" }[grupoSituacao(sit)] || "";
    return `<span class="selo ${cls}">${esc(sit || "—")}</span>`;
  };

  // ================================================================ consulta
  // Motor de pesquisa por termos, no estilo da pesquisa de jurisprudência do STJ:
  //   palavras inteiras (prova ≠ corporal), "expressão exata", E, OU, NÃO (ou -termo),
  //   parênteses, truncamento com $ (process$), ADJn (na ordem, até n palavras)
  //   e PROXn (em qualquer ordem, até n palavras), além de tema:1234.
  const Busca = (() => {
    const cache = new Map();
    const LIM = "[a-z0-9]";
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    function lex(q) {
      const out = [];
      const re = /\s*(\(|\)|"[^"]*"?|-(?=[^\s-])|[^\s()"]+)/g; let m;
      while ((m = re.exec(q))) {
        const s = m[1];
        if (s === "(" || s === ")") { out.push({ t: s }); continue; }
        if (s === "-") { out.push({ t: "op", v: "NAO" }); continue; }
        if (s.startsWith('"')) {
          const palavras = norm(s.replace(/"/g, "")).split(/[^a-z0-9$]+/).filter(Boolean);
          if (palavras.length) out.push({ t: "frase", v: palavras });
          continue;
        }
        const n = norm(s);
        if (n === "e" || n === "and" || n === "&") { out.push({ t: "op", v: "E" }); continue; }
        if (n === "ou" || n === "or" || n === "|") { out.push({ t: "op", v: "OU" }); continue; }
        if (n === "nao" || n === "not") { out.push({ t: "op", v: "NAO" }); continue; }
        let mm = /^adj(\d{0,2})$/.exec(n); if (mm) { out.push({ t: "op", v: "ADJ", n: +(mm[1] || 1) }); continue; }
        mm = /^prox(\d{0,2})$/.exec(n); if (mm) { out.push({ t: "op", v: "PROX", n: +(mm[1] || 3) }); continue; }
        mm = /^tema:(\d+)$/.exec(n); if (mm) { out.push({ t: "tema", v: +mm[1] }); continue; }
        const partes = n.split(/[^a-z0-9$*]+/).filter(Boolean).map((p) => p.replace(/\*/g, "$"));
        if (!partes.length) continue;
        if (partes.length === 1) out.push({ t: "termo", v: partes[0] });
        else out.push({ t: "frase", v: partes });
      }
      return out;
    }
    function parse(q) {
      const tk = lex(q); let i = 0;
      const peek = () => tk[i];
      const isOp = (x, v) => x && x.t === "op" && (!v || x.v === v);
      function pOu() {
        let a = pE();
        while (isOp(peek(), "OU")) { i++; const b = pE(); if (!b) break; a = a ? { t: "ou", a: [a, b] } : b; }
        return a;
      }
      function pE() {
        let a = pNao();
        while (peek() && peek().t !== ")" && !isOp(peek(), "OU")) {
          if (isOp(peek(), "E")) { i++; if (!peek() || peek().t === ")") break; }
          const b = pNao(); if (!b) break;
          a = a ? { t: "e", a: [a, b] } : b;
        }
        return a;
      }
      function pNao() {
        if (isOp(peek(), "NAO")) { i++; const x = pNao(); return x ? { t: "nao", a: [x] } : null; }
        return pProx();
      }
      function pProx() {
        let a = pAtomo();
        while (isOp(peek(), "ADJ") || isOp(peek(), "PROX")) {
          const op = tk[i++]; const b = pAtomo(); if (!b) break;
          a = { t: op.v.toLowerCase(), n: op.n, a: [a, b] };
        }
        return a;
      }
      function pAtomo() {
        const x = peek(); if (!x) return null;
        if (x.t === "(") { i++; const e = pOu(); if (peek() && peek().t === ")") i++; else throw new Error("Parêntese não fechado."); return e; }
        if (x.t === ")") { i++; return null; }
        if (x.t === "op") { i++; return null; }
        i++;
        return x.t === "termo" ? { t: "termo", v: x.v } : x.t === "frase" ? { t: "frase", v: x.v } : { t: "tema", v: x.v };
      }
      const ast = pOu();
      while (i < tk.length) { const extra = pOu(); if (!extra) { i++; continue; } }
      return ast;
    }
    function reDe(no) {
      const k = JSON.stringify(no);
      if (cache.has(k)) return cache.get(k);
      const pal = (w) => (w.endsWith("$") ? `${esc(w.slice(0, -1))}${LIM}*` : esc(w));
      let src;
      if (no.t === "termo") src = `(?<!${LIM})${pal(no.v)}(?!${LIM})`;
      else src = `(?<!${LIM})${no.v.map(pal).join(`[^a-z0-9]+`)}(?!${LIM})`;
      const re = new RegExp(src);
      cache.set(k, re);
      return re;
    }
    function posicoes(no, tokens) {
      const ws = no.t === "termo" ? [no.v] : no.v;
      const ok = (tok, w) => (w.endsWith("$") ? tok.startsWith(w.slice(0, -1)) : tok === w);
      const res = [];
      for (let i = 0; i + ws.length <= tokens.length; i++) {
        let bate = true;
        for (let j = 0; j < ws.length; j++) if (!ok(tokens[i + j], ws[j])) { bate = false; break; }
        if (bate) res.push([i, i + ws.length - 1]);
      }
      return res;
    }
    function avaliar(no, doc) {
      switch (no.t) {
        case "termo": case "frase": return reDe(no).test(doc.t);
        case "tema": return reTema(no.v).test(doc.t);
        case "e": return no.a.every((x) => avaliar(x, doc));
        case "ou": return no.a.some((x) => avaliar(x, doc));
        case "nao": return !avaliar(no.a[0], doc);
        case "adj": case "prox": {
          const [x, y] = no.a;
          const simples = (z) => z.t === "termo" || z.t === "frase";
          if (!simples(x) || !simples(y)) return avaliar(x, doc) && avaliar(y, doc);
          if (!avaliar(x, doc) || !avaliar(y, doc)) return false;
          if (!doc.tok) doc.tok = doc.t.match(/[a-z0-9]+/g) || [];
          const px = posicoes(x, doc.tok), py = posicoes(y, doc.tok);
          for (const [a0, a1] of px) for (const [b0, b1] of py) {
            if (no.t === "adj" && b0 > a1 && b0 - a1 <= no.n) return true;
            if (no.t === "prox" && (b0 > a1 ? b0 - a1 : a0 - b1) >= 1 && (b0 > a1 ? b0 - a1 : a0 - b1) <= no.n) return true;
          }
          return false;
        }
        default: return true;
      }
    }
    function positivos(no, neg = false, out = []) {
      if (!no) return out;
      if (no.t === "nao") return positivos(no.a[0], !neg, out);
      if ((no.t === "termo" || no.t === "frase") && !neg) out.push(no);
      (no.a || []).forEach((x) => positivos(x, neg, out));
      return out;
    }
    function explicar(no) {
      if (!no) return "";
      const f = (x, topo) => {
        switch (x.t) {
          case "termo": return x.v.endsWith("$") ? `palavras começadas por “${x.v.slice(0, -1)}”` : `“${x.v}”`;
          case "frase": return `a expressão exata “${x.v.join(" ")}”`;
          case "tema": return `menção ao tema ${x.v}`;
          case "e": { const s = x.a.map((y) => f(y)).join(" e "); return topo ? s : `(${s})`; }
          case "ou": { const s = x.a.map((y) => f(y)).join(" ou "); return topo ? s : `(${s})`; }
          case "nao": return `sem ${f(x.a[0])}`;
          case "adj": return `${f(x.a[0])} seguido de ${f(x.a[1])} (até ${x.n} palavra${x.n > 1 ? "s" : ""})`;
          case "prox": return `${f(x.a[0])} perto de ${f(x.a[1])} (até ${x.n} palavras)`;
          default: return "";
        }
      };
      return f(no, true);
    }
    function compilar(q) {
      q = String(q || "").trim();
      if (!q) return { vazio: true, termos: [], testa: () => true, pontua: () => 0, explicacao: "" };
      let ast = null, erro = "";
      try { ast = parse(q); } catch (e) { erro = e.message; ast = parse(q.replace(/[()]/g, " ")); }
      const termos = positivos(ast);
      const temTexto = !!ast;
      return {
        vazio: !temTexto, erro, ast, termos,
        explicacao: explicar(ast),
        temTema: JSON.stringify(ast || {}).includes('"t":"tema"'),
        testa: (texto) => !ast || avaliar(ast, { t: texto }),
        pontua(texto, cabeca = "") {
          let s = 0;
          for (const t of termos) {
            const re = new RegExp(reDe(t).source, "g");
            const n = (texto.match(re) || []).length;
            s += Math.min(n, 6) + (cabeca && reDe(t).test(cabeca) ? 4 : 0);
          }
          // Bônus quando as palavras soltas aparecem juntas, na ordem digitada.
          const soltas = termos.filter((t) => t.t === "termo").map((t) => t.v);
          if (soltas.length > 1 && reDe({ t: "frase", v: soltas }).test(texto)) s += 8;
          return s;
        },
      };
    }
    return { compilar };
  })();
  const reTema = (n) => new RegExp(`(tema|controversia|iac)[^0-9]{0,30}(n[.ºo°]*\\s*)?${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\\.?")}(?![0-9])`, "i");
  function destacar(htmlEsc, termos) {
    const t = (termos || []).filter((x) => (x.t === "termo" ? x.v.replace("$", "").length >= 2 : true));
    if (!t.length) return htmlEsc;
    const mapa = { a: "[aáàâãä]", e: "[eéèêë]", i: "[iíìîï]", o: "[oóòôõö]", u: "[uúùûü]", c: "[cç]", n: "[nñ]" };
    const pal = (w) => {
      const pref = w.endsWith("$"); const base = pref ? w.slice(0, -1) : w;
      return base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[aeioucn]/g, (c) => mapa[c]) + (pref ? "[\\p{L}\\p{N}]*" : "");
    };
    const partes = t.map((x) => (x.t === "termo" ? pal(x.v) : x.v.map(pal).join("[^\\p{L}\\p{N}<>]+")));
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${partes.join("|")})(?![\\p{L}\\p{N}])`, "giu");
    return htmlEsc.split(/(<[^>]+>)/).map((seg) => (seg.startsWith("<") ? seg : seg.replace(re, "<mark>$1</mark>"))).join("");
  }
  const AJUDA_BUSCA = `
    <div class="ajuda-busca" hidden>
      <p><b>Como pesquisar.</b> As palavras são buscadas inteiras: <code>oral</code> não encontra “corporal”.</p>
      <table>
        <tr><td><code>prova oral</code></td><td>as duas palavras, em qualquer lugar (E implícito)</td></tr>
        <tr><td><code>"prova oral"</code></td><td>expressão exata</td></tr>
        <tr><td><code>dano e moral</code></td><td>as duas palavras</td></tr>
        <tr><td><code>guarda ou visitas</code></td><td>uma ou outra</td></tr>
        <tr><td><code>alimentos não gravídicos</code> · <code>-gravídicos</code></td><td>exclui a palavra</td></tr>
        <tr><td><code>(usucapião ou posse) e rural</code></td><td>agrupa com parênteses</td></tr>
        <tr><td><code>prescri$</code></td><td>prescrição, prescricional, prescrito…</td></tr>
        <tr><td><code>dano adj moral</code> · <code>adj2</code></td><td>na ordem, até 1 (ou 2) palavras de distância</td></tr>
        <tr><td><code>juros prox5 mora</code></td><td>perto, em qualquer ordem, até 5 palavras</td></tr>
        <tr><td><code>tema:1365</code></td><td>acórdãos que mencionam o tema</td></tr>
      </table>
      <div class="chips" style="margin-top:8px">
        <button type="button" class="chip" aria-pressed="false" data-ex='"prova oral"'>"prova oral"</button>
        <button type="button" class="chip" aria-pressed="false" data-ex="(plano de saúde) e (rol ou cobertura) não odontológico">plano de saúde…</button>
        <button type="button" class="chip" aria-pressed="false" data-ex="prescri$ adj2 intercorrente">prescri$ adj2 intercorrente</button>
      </div>
    </div>`;
  function ligarAjuda(raiz, campo, aplicar) {
    const bt = raiz.querySelector("[data-ajuda]"), box = raiz.querySelector(".ajuda-busca");
    if (!bt || !box) return;
    bt.addEventListener("click", () => { box.hidden = !box.hidden; bt.setAttribute("aria-expanded", String(!box.hidden)); });
    box.addEventListener("click", (e) => { const c = e.target.closest("[data-ex]"); if (!c) return; campo.value = c.dataset.ex; aplicar(); campo.focus(); });
  }
  const explicacaoHTML = (c) => (c.vazio ? "" : `<span class="explica">${c.erro ? `${esc(c.erro)} ` : ""}Buscando ${esc(c.explicacao)}</span>`);

  // ================================================================= dados
  const D = { man: null, orgaos: {}, shards: new Map(), cache: {} };
  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${r.status} ao carregar ${url}`);
    return r.json();
  }
  function carregar(nome, prep) {
    if (!D.cache[nome]) D.cache[nome] = getJSON(`data/${nome}.json`).then((x) => (prep ? prep(x) : x)).catch((e) => { delete D.cache[nome]; throw e; });
    return D.cache[nome];
  }
  const temas = () => carregar("temas", async (t) => {
    const hist = await getJSON("data/historico_temas.json").catch(() => []);
    for (const x of t) {
      x._n = norm([x.tp, x.n, x.q, x.tese, x.ass, x.anot, x.info, x.delim, x.leg, x.sum, x.org, x.sit].join(" "));
      x._g = grupoSituacao(x.sit);
      if (/^\*?\s*aguardando/i.test(x.tese || "")) { x._teseAguarda = x.tese.replace(/^\*\s*/, ""); x.tese = ""; }
      x._mov = [x.afet, x.julg, x.pub].filter(Boolean).sort().pop() || "";
    }
    const idx = new Map(t.map((x) => [`${x.tp}-${x.n}`, x]));
    for (const ev of hist) { const x = idx.get(`${ev.tp}-${ev.n}`); if (x && ev.d > x._mov) x._mov = ev.d; }
    t.hist = hist; t.idx = idx;
    return t;
  });
  const procTemas = () => carregar("processos_temas", (l) => {
    const porTema = new Map(), porReg = new Map(), porNum = new Map();
    for (const x of l) {
      const k = `${x.tp}-${x.n}`;
      if (!porTema.has(k)) porTema.set(k, []);
      porTema.get(k).push(x);
      if (x.reg) { if (!porReg.has(x.reg)) porReg.set(x.reg, []); porReg.get(x.reg).push(x); }
      const nd = digitos(x.p); if (nd) { if (!porNum.has(nd)) porNum.set(nd, []); porNum.get(nd).push(x); }
    }
    return { lista: l, porTema, porReg, porNum };
  });
  const pautas = () => carregar("pautas", (l) => {
    for (const x of l) x._b = norm(`${x.p} ${x.pet || ""} ${x.rel || ""} ${(x.adv || []).map((a) => a.join(" ")).join(" ")}`);
    return l;
  });
  const destaques = () => carregar("destaques");
  const indice = () => carregar("indice", (l) => { for (const x of l) x._n = norm(`${x.h} ${x.tese || ""} ${x.tj || ""}`); return l; });
  const djen = () => carregar("radar", (l) => { for (const x of l) x._p = norm(`${x.p} ${x.r || ""}`); return l; });

  function shard(mes, slug) {
    const k = `${mes}/${slug}`;
    if (!D.shards.has(k)) D.shards.set(k, getJSON(`data/acordaos/${mes}/${slug}.json`).catch((e) => { D.shards.delete(k); throw e; }));
    return D.shards.get(k);
  }
  async function carregarShards(pares, onProg) {
    const res = []; let feitos = 0; let i = 0;
    const trab = async () => { while (i < pares.length) { const [m, o] = pares[i++]; res.push(...(await shard(m, o))); onProg?.(++feitos, pares.length); } };
    await Promise.all(Array.from({ length: Math.min(6, pares.length) }, trab));
    return res;
  }
  function temasEmPauta(pl) {
    const m = new Map();
    for (const p of pl) for (const [tp, n] of p.temas || []) { const k = `${tp}-${n}`; if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
    return m;
  }

  // ==================================================== movimentações dos temas
  function eventosTemas(t, desde) {
    const evs = [];
    for (const x of t) {
      if (x.afet >= desde) evs.push({ d: x.afet, k: "afet", t: x, txt: "Afetado ao rito" });
      if (x.julg >= desde) evs.push({ d: x.julg, k: "julg", t: x, txt: "Julgado" });
      if (x.pub >= desde) evs.push({ d: x.pub, k: "pub", t: x, txt: "Acórdão publicado" });
    }
    for (const h of t.hist) {
      if (h.d < desde) continue;
      const x = t.idx.get(`${h.tp}-${h.n}`); if (!x) continue;
      const txt = h.ev === "situacao" ? `Situação: ${h.de} → ${h.para}` : h.ev === "novo" ? "Incluído na base" : h.ev === "tese" ? "Tese firmada registrada" : "Tese alterada";
      evs.push({ d: h.d, k: "mud", t: x, txt });
    }
    const vistos = new Set();
    return evs.filter((e) => { const k = `${e.k}|${e.t.tp}|${e.t.n}|${e.d}|${e.txt}`; if (vistos.has(k)) return false; vistos.add(k); return true; })
      .sort((a, b) => (b.d > a.d ? 1 : b.d < a.d ? -1 : b.t.n - a.t.n));
  }

  // ============================================================ meu radar
  async function calcularRadar() {
    if (!P.termos.length && !P.procs.length && !P.oabs.length) return [];
    const [t, ix, pl, dj, pt] = await Promise.all([temas(), indice(), pautas(), djen(), procTemas()]);
    const emPauta = temasEmPauta(pl);
    const hoje = hojeISO(), lim30 = somaDias(hoje, -30);
    const out = new Map();
    const add = (k, item) => { if (!out.has(k)) out.set(k, item); else if (ordNivel(item.nivel) < ordNivel(out.get(k).nivel)) out.set(k, item); };
    for (const termo of P.termos) {
      const tm = /^tema\s*:?\s*(\d+)$/i.exec(termo.trim());
      const cons = tm ? null : Busca.compilar(termo);
      if (cons && cons.vazio) continue;
      const casa = (txt) => cons.testa(txt);
      for (const x of t) {
        if (tm ? x.n !== +tm[1] || x.tp !== "Tema" : !casa(x._n)) continue;
        const pts = emPauta.get(`${x.tp}-${x.n}`);
        const nivel = pts ? "alta" : x._mov >= lim30 ? "alta" : x._g === "andamento" ? "rel" : "acomp";
        const d = pts ? pts[0].d : x._mov;
        add(`t|${x.tp}|${x.n}`, { tipo: "tema", nivel, d, dNovo: pts ? (pts[0].pub || x._mov) : x._mov, termo, obj: x, pauta: pts?.[0] });
      }
      const rT = tm ? reTema(tm[1]) : null;
      let c = 0;
      for (const r of ix) {
        if (tm ? !rT.test(r._n) : !casa(r._n)) continue;
        const nivel = nivelAc(r.s) || "acomp";
        add(`a|${r.id}`, { tipo: "acordao", nivel, d: r.dj, dNovo: r.dj, termo, obj: r });
        if (++c >= 150) break;
      }
    }
    for (const proc of P.procs) {
      const nd = digitos(proc); if (!nd) continue;
      const bate = (reg, p) => reg === nd || digitos(p) === nd;
      for (const p of pl) if (bate(p.reg, p.p)) add(`p|${p.reg}|${p.d}|${p.pet || ""}`, { tipo: "pauta", nivel: "alta", d: p.d, dNovo: p.pub || hoje, termo: proc, obj: p });
      for (const x of dj) if (bate(x.reg, x.p)) add(`d|${x.reg}|${x.d}|${x.r || ""}`, { tipo: "djen", nivel: "rel", d: x.d, dNovo: x.d, termo: proc, obj: x });
      for (const r of ix) if (bate(r.reg, r.n)) add(`a|${r.id}`, { tipo: "acordao", nivel: "rel", d: r.dj, dNovo: r.dj, termo: proc, obj: r });
      for (const v of pt.porReg.get(nd) || pt.porNum.get(nd) || []) {
        const x = t.idx.get(`${v.tp}-${v.n}`);
        if (x) add(`t|${x.tp}|${x.n}`, { tipo: "tema", nivel: "rel", d: x._mov, dNovo: x._mov, termo: proc, obj: x, vinculo: v });
      }
    }
    for (const oab of P.oabs) {
      const alvo = normOAB(oab);
      for (const p of pl) if ((p.adv || []).some((a) => a[0] === alvo)) add(`p|${p.reg}|${p.d}|${p.pet || ""}`, { tipo: "pauta", nivel: "alta", d: p.d, dNovo: p.pub || hoje, termo: oab, obj: p });
    }
    const lista = [...out.values()];
    for (const it of lista) it.novo = (it.dNovo || "") > P.vistoEm;
    lista.sort((a, b) => (b.novo - a.novo) || (ordNivel(a.nivel) - ordNivel(b.nivel)) || String(b.d).localeCompare(String(a.d)));
    return lista;
  }
  const ordNivel = (n) => ({ alta: 0, rel: 1, acomp: 2 }[n] ?? 3);
  function normOAB(s) {
    const m = /([A-Za-z]{2})\s*[-/ ]?\s*(\d{1,6})\s*([A-Za-z])?/.exec(String(s || ""));
    return m ? `${m[1].toUpperCase()}${m[2].padStart(6, "0")}${m[3] ? m[3].toUpperCase() : ""}` : "";
  }
  async function atualizarContadorFeed() {
    const n = await contarNaoLidos();
    $$(".cont-feed").forEach((el) => { el.textContent = n > 99 ? "99+" : n; el.hidden = !n; });
    return n;
  }
  async function atualizarContadorRadar() {
    try {
      const l = await calcularRadar();
      D.radarNovos = l.filter((x) => x.novo).length;
    } catch { D.radarNovos = 0; }
    $$(".cont-radar").forEach((el) => { el.textContent = D.radarNovos > 99 ? "99+" : D.radarNovos; el.hidden = !D.radarNovos; });
  }

  // ============================================================== cartões
  function chaveDuplicata(r) { return `${r.o}|${r.dd || ""}|${String(r.em || r.h || "").slice(0, 400)}`; }
  function agrupar(lista) {
    const mapa = new Map(), res = [];
    for (const r of lista) {
      const k = chaveDuplicata(r);
      if (mapa.has(k)) mapa.get(k)._dup.push(r);
      else { const g = r; g._dup = []; mapa.set(k, g); res.push(g); }
    }
    return res;
  }
  function citacao(r) {
    const veic = (/^(\S+)/.exec(r.djt || "")?.[1] || "DJEN").replace(/[^A-Za-z]/g, "") || "DJEN";
    return `(STJ, ${r.cl} n. ${fmtNumProc(r.n)}, Rel. ${relatorFmt(r.rel)}, ${D.orgaos[r.o]}, julgado em ${fmtDataCit(r.dd)}, ${veic} de ${fmtDataCit(r.dj)}.)`;
  }
  const REG_AC = new Map();
  const mesDe = (r) => String(r.m || r.dj || r.dd || "").slice(0, 7);
  function blocoTese(r, termos, compacto = false) {
    const txt = r.tese || r.tj;
    if (!txt) return "";
    const rot = r.tese ? "Tese jurídica" : "Tese de julgamento";
    const ps = String(txt).split(/\n+/).filter(Boolean);
    const corpo = ps.map((p) => `<p>${destacar(esc(p), termos)}</p>`).join("");
    return `<div class="tese${compacto ? " compacta" : ""}"><b>${rot}</b>${corpo}</div>`;
  }
  function cardAcordao(r, opts = {}) {
    REG_AC.set(String(r.id), r);
    const termos = opts.termos || [];
    const em = r.em || r.h || "";
    const [cab, ...corpo] = em.split("\n");
    const niv = nivelAc(r.s ?? 0);
    const salvo = !!P.salvos[`a:${r.id}`];
    const motivos = (r.rz || []).filter((k) => MOTIVOS[k]).slice(0, 4).map((k) => `<span class="selo pri">${esc(MOTIVOS[k])}</span>`).join("");
    const areas = (r.ar || []).slice(0, 2).map((k) => `<span class="selo">${esc(AREAS[k] || k)}</span>`).join("");
    const temCorpo = corpo.length > 0;
    const dups = r._dup?.length ? `<p class="duplic">Mesma ementa em ${r._dup.length} outro(s) processo(s): ${r._dup.slice(0, 6).map((d) => `${esc(d.cl)} ${fmtNumProc(d.n)}`).join(", ")}${r._dup.length > 6 ? "…" : ""}</p>` : "";
    return `<li class="card item" data-id="${esc(r.id)}">
      <div class="item-cab"><button type="button" class="item-tit item-abrir" data-a="abrir" title="Abrir o julgado completo">${esc(r.cl)} ${fmtNumProc(r.n)}</button>
        <span class="meta"><span>${esc(D.orgaos[r.o] || "")}</span>${r.rel ? `<span>Rel. ${esc(relatorFmt(r.rel))}</span>` : ""}${r.dd ? `<span>Julg. ${fmtData(r.dd)}</span>` : ""}<span>Publ. ${fmtData(r.dj)}</span></span></div>
      ${niv || motivos || areas ? `<div class="item-sel">${seloNivel(niv)}${motivos}${areas}</div>` : ""}
      ${blocoTese(r, termos, true)}
      <p class="verb">${destacar(esc(frase(cab)), termos)}</p>
      ${temCorpo ? `<div class="expansivel"><div><div class="texto-serif">${corpo.map((p) => `<p>${destacar(esc(p), termos)}</p>`).join("")}</div></div></div>` : ""}
      ${dups}
      <div class="acoes">
        ${temCorpo ? `<button type="button" class="link-acao" data-a="ementa">Ver ementa completa</button>` : `<button type="button" class="link-acao" data-a="abrir">Ver julgado completo</button>`}
        <a class="link-acao" href="${URLS.inteiroTeor(r.reg, r.dj)}" target="_blank" rel="noopener">Inteiro teor oficial ${ico("externo")}</a>
        <span class="dir">
          ${r.em ? `<button type="button" class="btn-ico" data-a="cit" title="Copiar ementa e citação" aria-label="Copiar ementa e citação">${ico("copiar")}</button>` : ""}
          <button type="button" class="btn-ico btn-salvar" data-a="salvar" aria-pressed="${salvo}" title="${salvo ? "Remover dos salvos" : "Salvar"}" aria-label="Salvar">${ico("salvar")}</button>
        </span>
      </div></li>`;
  }
  function minimoAcordao(r) {
    return { k: "a", id: r.id, m: mesDe(r), cl: r.cl, n: r.n, o: r.o, rel: r.rel, dd: r.dd, dj: r.dj, reg: r.reg, h: (r.em || r.h || "").split("\n")[0], tese: r.tese, tj: r.tj, s: r.s, rz: r.rz, ar: r.ar };
  }
  function ligarCards(ul) {
    ul.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-a]"); if (!b) return;
      const li = b.closest("[data-id]"); const r = REG_AC.get(li?.dataset.id); if (!r) return;
      const a = b.dataset.a;
      if (a === "ementa") {
        const e = li.querySelector(".expansivel"); e.classList.toggle("aberto");
        b.textContent = e.classList.contains("aberto") ? "Recolher ementa" : "Ver ementa completa";
      }
      if (a === "abrir") abrirAcordao(r);
      if (a === "cit") copiar(`${r.em}\n${citacao(r)}`, "Ementa e citação copiadas.");
      if (a === "salvar") alternarSalvo(`a:${r.id}`, minimoAcordao(r), b);
    });
  }
  async function abrirAcordao(ref) {
    let r = ref.em ? ref : null;
    if (!r) {
      try { const l = await shard(mesDe(ref), ref.o); r = l.find((x) => String(x.id) === String(ref.id)); } catch { /* fora do acervo */ }
    }
    if (!r) { abrirGaveta("Julgado", `${ref.cl} ${fmtNumProc(ref.n)}`, `<p class="texto-serif">${esc(frase(ref.h || ""))}</p><div class="acoes"><a class="btn btn-pri" href="${URLS.inteiroTeor(ref.reg, ref.dj)}" target="_blank" rel="noopener">Abrir inteiro teor no STJ ${ico("externo")}</a></div>`); return; }
    REG_AC.set(String(r.id), r);
    const [cab, ...corpo] = (r.em || "").split("\n");
    const salvo = !!P.salvos[`a:${r.id}`];
    const motivos = (r.rz || []).filter((k) => MOTIVOS[k]).map((k) => `<span class="selo pri">${esc(MOTIVOS[k])}</span>`).join("");
    const areas = (r.ar || []).map((k) => `<span class="selo">${esc(AREAS[k] || k)}</span>`).join("");
    const extra = [["Relator(a)", r.rel ? relatorFmt(r.rel) : ""], ["Julgamento", fmtData(r.dd)], ["Publicação", `${(r.djt || "").split(/\s/)[0] || "DJ"} ${fmtData(r.dj)}`], ["Tema", r.tema], ["Notas", r.notas], ["Informações complementares", r.info], ["Referências legislativas", (r.leg || []).join("\n")]]
      .filter(([, v]) => v).map(([l, v]) => `<dt>${l}</dt><dd>${esc(v).replace(/\n/g, "<br>")}</dd>`).join("");
    abrirGaveta(`${D.orgaos[r.o] || ""}${r.dd ? " · julgado em " + fmtData(r.dd) : ""}`, `${r.cl} ${fmtNumProc(r.n)}`, `
      <div class="item-sel">${seloNivel(nivelAc(r.s ?? 0))}${motivos}${areas}</div>
      <div class="acoes" style="margin:4px 0 14px">
        <a class="btn btn-pri btn-peq" href="${URLS.inteiroTeor(r.reg, r.dj)}" target="_blank" rel="noopener">Inteiro teor oficial ${ico("externo")}</a>
        <a class="btn btn-claro btn-peq" href="${URLS.processo(r.reg)}" target="_blank" rel="noopener">Consulta processual</a>
        <button type="button" class="btn btn-claro btn-peq" id="ga-cit">${ico("copiar")} Copiar ementa e citação</button>
        <button type="button" class="btn btn-claro btn-peq btn-salvar" id="ga-salvar" aria-pressed="${salvo}">${ico("salvar")} ${salvo ? "Salvo" : "Salvar"}</button>
      </div>
      ${blocoTese(r, [])}
      <h3>Ementa</h3>
      <p class="verb">${esc(frase(cab))}</p>
      <div class="texto-serif" style="margin-top:10px">${corpo.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      ${extra ? `<h3>Dados do julgado</h3><dl class="dl">${extra}</dl>` : ""}`);
    $("#ga-cit").addEventListener("click", () => copiar(`${r.em}\n${citacao(r)}`, "Ementa e citação copiadas."));
    $("#ga-salvar").addEventListener("click", (e) => { alternarSalvo(`a:${r.id}`, minimoAcordao(r), e.currentTarget); e.currentTarget.lastChild.textContent = P.salvos[`a:${r.id}`] ? " Salvo" : " Salvar"; });
  }
  function alternarSalvo(chave, obj, botao) {
    if (P.salvos[chave]) { delete P.salvos[chave]; toast("Removido dos salvos."); }
    else { P.salvos[chave] = { ...obj, salvoEm: hojeISO() }; toast("Salvo. Veja em Meu radar → Salvos."); }
    salvarP();
    if (botao) { botao.setAttribute("aria-pressed", String(!!P.salvos[chave])); }
  }

  // =============================================================== gaveta
  let focoAnterior = null;
  function abrirGaveta(sobre, titulo, html) {
    focoAnterior = document.activeElement;
    $("#gaveta-sobre").textContent = sobre; $("#gaveta-tit").textContent = titulo; $("#gaveta-corpo").innerHTML = html;
    const g = $("#gaveta"), v = $("#veu");
    g.hidden = false; v.hidden = false;
    requestAnimationFrame(() => { g.classList.add("vis"); v.classList.add("vis"); });
    $("#gaveta-corpo").scrollTop = 0;
    setTimeout(() => $("#gaveta-fechar").focus(), 50);
    document.body.style.overflow = "hidden";
  }
  function fecharGaveta() {
    const g = $("#gaveta"), v = $("#veu");
    if (g.hidden) return;
    g.classList.remove("vis"); v.classList.remove("vis");
    setTimeout(() => { g.hidden = true; v.hidden = true; }, 220);
    document.body.style.overflow = "";
    focoAnterior?.focus?.();
  }

  async function abrirTema(tp, n) {
    const [t, pt, pl] = await Promise.all([temas(), procTemas(), pautas()]);
    const x = t.idx.get(`${tp}-${n}`); if (!x) return toast("Tema não encontrado.");
    const procs = pt.porTema.get(`${tp}-${n}`) || [];
    const regs = new Set(procs.map((p) => p.reg));
    const emPauta = pl.filter((p) => regs.has(p.reg));
    const marcos = [];
    if (x.afet) marcos.push({ d: x.afet, cls: "", t: "Afetação ao rito" });
    for (const h of t.hist.filter((h) => h.tp === tp && h.n === n)) marcos.push({ d: h.d, cls: "mud", t: h.ev === "situacao" ? `Situação alterada: ${h.de} → ${h.para}` : h.ev === "novo" ? "Incluído na base" : "Tese registrada/alterada" });
    if (x.julg) marcos.push({ d: x.julg, cls: "julg", t: "Julgamento" });
    if (x.pub) marcos.push({ d: x.pub, cls: "pub", t: "Publicação do acórdão" });
    for (const p of emPauta) marcos.push({ d: p.d, cls: "pauta futuro", t: `Em pauta: ${p.p}${p.pet ? " (" + p.pet + ")" : ""} · ${D.orgaos[p.o] || ""}` });
    marcos.sort((a, b) => a.d.localeCompare(b.d));
    const salvo = !!P.salvos[`t:${tp}-${n}`];
    const det = [["Informações complementares", x.info], ["Anotações NUGEPNAC", x.anot], ["Delimitação do julgado", x.delim], ["Entendimento anterior", x.ant],
      ["Referência legislativa", x.leg], ["Súmula originada", x.sum], ["Repercussão geral no STF", x.rg ? `Tema ${x.rg}${x.rgd ? " — " + x.rgd : ""}` : ""], ["Assuntos", x.ass]]
      .filter(([, v]) => v).map(([l, v]) => `<dt>${l}</dt><dd>${esc(v)}</dd>`).join("");
    const html = `
      <div class="item-sel">${seloSit(x.sit)}${/suspens/i.test(x.info || "") && x._g === "andamento" ? `<span class="selo rel">Suspensão determinada</span>` : ""}${emPauta.length ? `<span class="selo alta">Em pauta</span>` : ""}<span class="selo">${esc(x.org || "")}</span></div>
      ${x.q ? `<h3>Questão submetida</h3><p class="texto-serif">${esc(x.q)}</p>` : ""}
      ${x.tese ? `<div class="tese"><b>Tese firmada</b>${esc(x.tese)}</div>` : ""}
      <div class="acoes" style="margin-top:14px">
        <a class="btn btn-claro btn-peq" href="${URLS.tema(tp, n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>
        <a class="btn btn-claro btn-peq" href="#pesquisa?q=tema:${n}&p=u12&r=0" data-fechar>Acórdãos que citam</a>
        <button type="button" class="btn btn-claro btn-peq" id="g-radar">${ico("radar")} Acompanhar</button>
        <button type="button" class="btn btn-claro btn-peq btn-salvar" id="g-salvar" aria-pressed="${salvo}">${ico("salvar")} ${salvo ? "Salvo" : "Salvar"}</button>
      </div>
      <h3>Linha do tempo</h3>
      ${marcos.length ? `<ol class="tl">${marcos.map((m) => `<li class="${m.cls}"><div class="d">${fmtData(m.d)}${m.d > hojeISO() ? " (futuro)" : ""}</div><div class="t">${esc(m.t)}</div></li>`).join("")}</ol>` : `<p class="nota">Sem datas registradas.</p>`}
      ${procs.length ? `<h3>Processos vinculados (${procs.length})</h3><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Processo</th><th>Origem</th><th>Relator(a)</th></tr></thead><tbody>
        ${procs.slice(0, 40).map((p) => `<tr><td class="num">${esc(p.p)}${p.lc ? ` <span class="selo pri">Leading case</span>` : ""}</td><td>${esc(p.trib || "")}${p.uf ? ` · ${esc(p.uf)}` : ""}</td><td>${esc(titulo(p.rel || ""))}</td></tr>`).join("")}
      </tbody></table></div>` : ""}
      ${det ? `<h3>Mais informações</h3><dl class="dl">${det}</dl>` : ""}`;
    abrirGaveta(`${tp === "Tema" ? "Tema repetitivo" : tp} · ${x.org || "STJ"}`, `${tp} ${n}`, html);
    $("#g-radar").addEventListener("click", () => { adicionarTermo(tp === "Tema" ? `tema ${n}` : String(n)); });
    $("#g-salvar").addEventListener("click", (e) => { alternarSalvo(`t:${tp}-${n}`, { k: "t", tp, n }, e.currentTarget); e.currentTarget.lastChild.textContent = P.salvos[`t:${tp}-${n}`] ? " Salvo" : " Salvar"; });
    $$("[data-fechar]", $("#gaveta-corpo")).forEach((a) => a.addEventListener("click", fecharGaveta));
  }
  function adicionarTermo(t) {
    t = t.trim(); if (!t) return;
    if (!P.termos.some((x) => norm(x) === norm(t))) { P.termos.push(t); salvarP(); toast(`“${t}” adicionado ao seu radar.`); atualizarContadorRadar(); }
    else toast("Esse assunto já está no seu radar.");
  }
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-abrir-tema]"); if (!a) return;
    const li = a.closest("[data-tema]"); if (!li) return;
    ev.preventDefault();
    const [tp, n] = li.dataset.tema.split("|"); abrirTema(tp, +n);
  });

  function linhaTema(t, extra = "", termos = []) {
    const areas = (t.ar || []).slice(0, 2).map((k) => `<span class="selo">${esc(AREAS[k] || k)}</span>`).join("");
    return `<li class="card item" data-tema="${esc(t.tp)}|${t.n}">
      <div class="item-cab"><button type="button" class="item-tit item-abrir" data-abrir-tema>${esc(t.tp)} ${t.n}</button>${seloSit(t.sit)}${extra}
        <span class="meta"><span>${esc(t.org || "—")}</span>${t._mov ? `<span>Últ. mov. ${fmtData(t._mov)}</span>` : ""}</span></div>
      ${areas ? `<div class="item-sel">${areas}</div>` : ""}
      ${t.tese ? `<div class="tese compacta"><b>Tese firmada</b><p>${destacar(esc(t.tese), termos)}</p></div>` : t._teseAguarda ? `<p class="nota">Julgado; tese aguardando a publicação do acórdão.</p>` : ""}
      ${t.q ? `<p class="texto-serif${t.tese ? " questao" : ""}">${t.tese ? "<b>Questão:</b> " : ""}${destacar(esc(t.q), termos)}</p>` : ""}
      <div class="acoes"><button type="button" class="link-acao" data-abrir-tema>Detalhes e linha do tempo ${ico("seta")}</button>
        <a class="link-acao" href="${URLS.tema(t.tp, t.n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a></div></li>`;
  }

  // ========================================================= ATUALIZE-SE
  // Leitura em cartões: uma novidade por tela, tese em destaque com marca-texto
  // nas expressões decisivas, filtros facetados e fila que aprende com a leitura.
  const FEED_TIPOS = {
    tese: { rot: "Tese firmada", selo: "Tese firmada", longo: "Tese firmada em repetitivo", cls: "ok", peso: 100 },
    afetacao: { rot: "Tema afetado", selo: "Tema afetado", longo: "Novo tema afetado", cls: "rel", peso: 75 },
    pauta: { rot: "Em pauta", selo: "Vai a julgamento", longo: "Repetitivo em pauta", cls: "alta", peso: 70 },
    publicado: { rot: "Acórdão publicado", selo: "Acórdão publicado", longo: "Acórdão de repetitivo publicado", cls: "acomp", peso: 55 },
    julgado: { rot: "Julgados", selo: "Julgado", longo: "Julgados das Turmas e Seções", cls: "pri", peso: 40 },
  };
    const PERIODOS = [[0, "Qualquer data"], [3, "Últimos 3 dias"], [7, "Últimos 7 dias"], [15, "Últimos 15 dias"], [30, "Últimos 30 dias"]];
  const FILTRO_VAZIO = () => ({ ar: [], tp: [], per: 0, tese: "", org: [], rel: "" });
  const feedJulgados = () => carregar("atualize").catch(() => destaques());

  function feedF() {
    if (!P.feedF) { P.feedF = FILTRO_VAZIO(); if (P.feedAreas?.length) P.feedF.ar = [...P.feedAreas]; }
    return P.feedF;
  }
  const pesos = () => (P.feedPeso = P.feedPeso || {});
  function ajustarPeso(areas, d) {
    const p = pesos();
    for (const a of areas) p[a] = Math.max(-8, Math.min(12, (p[a] || 0) + d));
    salvarP();
  }

  async function itensFeed() {
    const [t, ds, pl] = await Promise.all([temas(), feedJulgados(), pautas()]);
    const hoje = hojeISO(), desde = somaDias(hoje, -45);
    const itens = [];
    const idade = (d) => Math.abs((new Date(hoje) - new Date(d)) / 864e5);
    const deTema = (x, extra) => ({ t: x, ar: x.ar || [], org: x.org || "", tese: !!x.tese, _n: norm(`${x.q || ""} ${x.tese || ""} ${x.ass || ""}`), ...extra });
    for (const x of t) {
      if (x.julg >= desde && (x.tese || x._teseAguarda)) itens.push(deTema(x, { k: `tese:${x.tp}-${x.n}`, tipo: "tese", d: x.julg }));
      else if (x.pub >= desde && x.tese) itens.push(deTema(x, { k: `pub:${x.tp}-${x.n}`, tipo: "publicado", d: x.pub }));
      if (x.afet >= desde && x.q) itens.push(deTema(x, { k: `afet:${x.tp}-${x.n}`, tipo: "afetacao", d: x.afet, tese: false }));
    }
    const lim = somaDias(hoje, 21);
    const vistosP = new Set();
    for (const p of pl) {
      if (!p.temas?.length || p.d > lim || p.d < hoje) continue;
      for (const [tp, n] of p.temas) {
        const x = t.idx.get(`${tp}-${n}`); const k = `pauta:${tp}-${n}:${p.d}`;
        if (x && !vistosP.has(k)) { vistosP.add(k); itens.push(deTema(x, { k, tipo: "pauta", d: p.d, p, org: D.orgaos[p.o] || x.org || "", rel: p.rel || "", tese: false })); }
      }
    }
    const vistosA = new Set();
    for (const r of ds) {
      if (r.dj < somaDias(hoje, -80)) continue;
      const chave = `${r.o}|${r.dd || ""}|${(r.em || r.h || "").split("\n")[0].slice(0, 300)}|${String(r.tese || r.tj || "").slice(0, 160)}`;
      if (vistosA.has(chave)) continue; vistosA.add(chave);
      if (!(r.s >= 6 || r.tese || r.tj)) continue;
      itens.push({ k: `ac:${r.id}`, tipo: "julgado", d: r.dj, r, ar: r.ar || [], org: D.orgaos[r.o] || "", rel: r.rel || "", tese: !!(r.tese || r.tj), _n: norm(`${r.h || (r.em || "").split("\n")[0]} ${r.tese || ""} ${r.tj || ""}`) });
    }
    // Termos do "Meu radar" viram prioridade na fila.
    const radar = (P.termos || []).map((termo) => ({ termo, tm: /^tema\s*:?\s*(\d+)$/i.exec(termo.trim()), c: /^tema\s*:?\s*\d+$/i.test(termo.trim()) ? null : Busca.compilar(termo) })).filter((x) => x.tm || (x.c && !x.c.vazio && !x.c.erro));
    const pw = pesos();
    for (const it of itens) {
      const hit = radar.find((q) => (q.tm ? it.t && it.t.n === +q.tm[1] : q.c.testa(it._n)));
      if (hit) it.radar = hit.termo;
      const gosto = it.ar.length ? Math.max(...it.ar.map((a) => pw[a] || 0)) : 0;
      it.gosto = gosto;
      it.p0 = FEED_TIPOS[it.tipo].peso + (it.r ? Math.min(it.r.fs ?? it.r.s ?? 0, 20) + (it.tese ? 4 : 0) : 0)
        + (it.tipo === "pauta" ? 20 - idade(it.d) : -idade(it.d) * 0.9) + gosto * 3 + (hit ? 18 : 0);
    }
    itens.sort((a, b) => b.p0 - a.p0);
    // Intercala tipos para o ritmo da leitura não ficar monótono.
    const filas = {}; itens.forEach((i) => (filas[i.tipo] = filas[i.tipo] || []).push(i));
    const ordem = ["tese", "julgado", "afetacao", "julgado", "pauta", "julgado", "publicado", "julgado"];
    const out = []; let vazias = 0, j = 0, ultArea = "";
    const tirar = (f, tipo) => {
      // Entre julgados, evita duas matérias iguais seguidas quando há alternativa próxima.
      if (tipo !== "julgado") return f.shift();
      const i = f.slice(0, 6).findIndex((x) => (x.ar[0] || "") !== ultArea);
      const [x] = f.splice(Math.max(0, i), 1); ultArea = x.ar[0] || ""; return x;
    };
    while (vazias < ordem.length) { const tp = ordem[j++ % ordem.length], f = filas[tp]; if (f?.length) { out.push(tirar(f, tp)); vazias = 0; } else vazias++; }
    return out;
  }
  // Um item passa pelos filtros? `sem` ignora uma dimensão (contagem facetada).
  function passaFeed(it, f, sem = "") {
    if (sem !== "ar" && f.ar.length && !it.ar.some((a) => f.ar.includes(a))) return false;
    if (sem !== "tp" && f.tp.length && !f.tp.includes(it.tipo)) return false;
    if (sem !== "per" && f.per && Math.abs((new Date(hojeISO()) - new Date(it.d)) / 864e5) > f.per) return false;
    if (sem !== "tese" && f.tese && (f.tese === "com") !== it.tese) return false;
    if (sem !== "org" && f.org.length && !f.org.includes(it.org)) return false;
    if (sem !== "rel" && f.rel && norm(it.rel) !== norm(f.rel)) return false;
    return true;
  }
  const nFiltros = (f) => f.ar.length + f.tp.length + (f.per ? 1 : 0) + (f.tese ? 1 : 0) + f.org.length + (f.rel ? 1 : 0);
  function lidos() { return (P.lidos = P.lidos || {}); }
  function marcarLido(k) { const l = lidos(); if (!l[k]) { l[k] = hojeISO(); const ks = Object.keys(l); if (ks.length > 4000) ks.slice(0, ks.length - 4000).forEach((x) => delete l[x]); salvarP(); } }
  const lidosHoje = () => { const h = hojeISO(); return Object.values(lidos()).filter((d) => d === h).length; };
  async function contarNaoLidos() {
    try { const it = await itensFeed(); const f = feedF(); return it.filter((x) => !lidos()[x.k] && passaFeed(x, f)).length; } catch { return 0; }
  }

  const tempoLeitura = (txt) => { const w = String(txt || "").split(/\s+/).length; const s = Math.max(10, Math.round((w / 210) * 60 / 5) * 5); return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`; };
  const saudacao = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };

  function cartaoFeed(it, i, total) {
    const tp = FEED_TIPOS[it.tipo];
    const areas = it.ar.slice(0, 2).map((k) => `<button type="button" class="selo area" data-f="area" data-ar="${k}" title="Ler só ${esc(AREAS[k] || k)}">${esc(AREAS[k] || k)}</button>`).join("");
    let kicker = "", principal = "", apoio = "", meta = "", acoes = "", rotTexto = "", marcar = false;
    if (it.t) {
      const x = it.t;
      kicker = `${x.tp} ${x.n} · ${esc(it.org || x.org || "")}`;
      if (it.tipo === "tese" || it.tipo === "publicado") {
        rotTexto = x.tese ? "O STJ fixou" : "Tema julgado";
        principal = x.tese ? esc(x.tese) : `Julgado em ${fmtData(x.julg)}. A tese será divulgada com a publicação do acórdão.`;
        marcar = !!x.tese;
        apoio = x.q ? `<b>Questão:</b> ${esc(x.q)}` : "";
        meta = it.tipo === "tese" ? `Julgado em ${fmtData(x.julg)}` : `Acórdão publicado em ${fmtData(x.pub)}`;
      } else if (it.tipo === "afetacao") {
        rotTexto = "O STJ vai decidir";
        principal = esc(x.q);
        apoio = /suspens/i.test(x.info || "") ? `<b>Atenção:</b> há determinação de suspensão de processos sobre a matéria.` : "";
        meta = `Afetado em ${fmtData(x.afet)}`;
      } else {
        rotTexto = "Em julgamento";
        principal = esc(x.q || "");
        apoio = `${esc(it.p.p)}${it.p.pet ? " (" + esc(it.p.pet) + ")" : ""} · ${esc(it.org)} · ${esc(relatorFmt(it.p.rel || ""))}`;
        meta = `Sessão de ${fmtDiaL(it.p.d)}`;
      }
      acoes = `<button type="button" class="btn btn-claro btn-peq" data-f="tema">${ico("repetitivos")} Linha do tempo</button>
        <a class="btn btn-claro btn-peq so-largo" href="${URLS.tema(x.tp, x.n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>`;
    } else {
      const r = it.r;
      REG_AC.set(String(r.id), r);
      kicker = `${esc(r.cl)} ${fmtNumProc(r.n)} · ${esc(it.org)}`;
      const tese = r.tese || r.tj;
      const cab = frase((r.em || r.h || "").split("\n")[0]);
      rotTexto = tese ? (r.tese ? "Tese jurídica" : "Tese de julgamento") : "O que foi decidido";
      principal = tese ? esc(String(tese).trim().replace(/^["“']+/, "").replace(/["”']+(?=\.?$)/, "")).replace(/\n+/g, "<br>") : esc(cab);
      marcar = !!tese;
      apoio = tese ? esc(cab) : "";
      const motivos = (r.rz || []).filter((k) => MOTIVOS[k]).slice(0, 2).map((k) => MOTIVOS[k]).join(" · ");
      meta = `${r.tjp ? "Só os itens com conteúdo próprio; a tese completa está na ementa. " : ""}${r.rel ? esc(relatorFmt(r.rel)) + " · " : ""}${r.dd ? `julgado em ${fmtData(r.dd)} · ` : ""}publicado em ${fmtData(r.dj)}${motivos ? ` · ${esc(motivos)}` : ""}`;
      acoes = `<button type="button" class="btn btn-claro btn-peq" data-f="acordao">${ico("arquivo")} Ler a ementa</button>
        <a class="btn btn-claro btn-peq so-largo" href="${URLS.inteiroTeor(r.reg, r.dj)}" target="_blank" rel="noopener">Inteiro teor ${ico("externo")}</a>`;
    }
    const salvoK = it.t ? `t:${it.t.tp}-${it.t.n}` : `a:${it.r.id}`;
    const salvo = !!P.salvos[salvoK];
    const novo = it.d > (D.feedVistoAnt || "") && it.tipo !== "pauta" && !lidos()[it.k];
    const pers = it.radar ? `<span class="selo radar" title="Corresponde a um termo do Meu radar">${ico("radar")} ${esc(it.radar.length > 28 ? it.radar.slice(0, 26) + "…" : it.radar)}</span>`
      : it.gosto >= 4 ? `<span class="selo gosto">Do seu interesse</span>` : "";
    const txtPrinc = principal.replace(/<[^>]+>/g, " ");
    return `<article class="reel" data-k="${esc(it.k)}" data-i="${i}" aria-label="Novidade ${i + 1} de ${total}">
      <div class="reel-in">
        <header class="reel-cab"><span class="selo ${tp.cls}">${tp.selo}</span>${areas}${pers}${novo ? '<span class="novo">Novo</span>' : ""}<span class="reel-tempo">${ico("raio")} ${tempoLeitura(txtPrinc + " " + apoio)}</span></header>
        <p class="reel-kicker">${kicker}</p>
        <p class="reel-rot">${rotTexto}</p>
        <div class="reel-texto${txtPrinc.length > 420 ? " longo" : ""}"><p>${principal}</p></div>
        <button type="button" class="reel-mais" data-f="mais" hidden>Continuar lendo ${ico("seta")}</button>
        ${apoio ? `<p class="reel-apoio">${apoio}</p>` : ""}
        <p class="reel-meta">${meta}</p>
        <footer class="reel-acoes">
          ${acoes}
          <span class="dir">
            <button type="button" class="menos" data-f="menos" title="Mostrar menos desta matéria">Menos disso</button>
            <button type="button" class="btn-ico so-largo" data-f="copiar" title="Copiar" aria-label="Copiar">${ico("copiar")}</button>
            <button type="button" class="btn-ico" data-f="compartilhar" title="Compartilhar" aria-label="Compartilhar">${ico("link")}</button>
            <button type="button" class="btn-ico btn-salvar" data-f="salvar" aria-pressed="${salvo}" title="Salvar (ou toque duas vezes no cartão)" aria-label="Salvar">${ico("salvar")}</button>
          </span>
        </footer>
        <span class="estouro" aria-hidden="true">${ico("salvar")}</span>
      </div>
    </article>`;
  }

  function capaFeed(vis, f) {
    const naoLidos = vis.filter((x) => !lidos()[x.k]).length;
    const por = (tps) => vis.filter((x) => tps.includes(x.tipo) && !lidos()[x.k]).length;
    const blocos = [
      [["tese", "publicado"], "teses firmadas", "ok"], [["afetacao"], "temas afetados", "rel"],
      [["pauta"], "repetitivos em pauta", "alta"], [["julgado"], "julgados relevantes", "pri"],
    ].map(([tps, rot, cls]) => ({ tps, rot, cls, n: por(tps) })).filter((b) => b.n);
    const contA = {}; vis.forEach((x) => { if (!lidos()[x.k]) x.ar.forEach((a) => (contA[a] = (contA[a] || 0) + 1)); });
    const top = Object.entries(contA).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const at = D.man?.atualizadoEm ? new Date(D.man.atualizadoEm) : null;
    return `<article class="reel reel-capa" data-i="-1"><div class="reel-in">
      <p class="reel-kicker">${esc(fmtDiaL(hojeISO()))}${at ? ` · base atualizada às ${at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
      <h2 class="capa-tit">${saudacao()}. ${!naoLidos ? "Você está em dia." : (() => { const rep = naoLidos - por(["julgado"]), jul = por(["julgado"]);
        const partes = [rep ? `<b>${fmtInt(rep)}</b> movimento${rep > 1 ? "s" : ""} nos repetitivos` : "", jul ? `<b>${fmtInt(jul)}</b> julgado${jul > 1 ? "s" : ""} para ler` : ""].filter(Boolean);
        return `${nFiltros(f) ? "Nos filtros escolhidos: " : "Há "}${partes.join(" e ")}.`; })()}</h2>
      ${blocos.length ? `<div class="capa-grade">${blocos.map((b) => `<button type="button" class="capa-bloco ${b.cls}" data-capa-tp="${b.tps.join(",")}"><b>${fmtInt(b.n)}</b><span>${b.rot}</span></button>`).join("")}</div>` : ""}
      ${top.length ? `<p class="reel-rot" style="margin-top:22px">Em alta nas matérias</p><div class="capa-areas">${top.map(([a, n]) => `<button type="button" class="chip" data-capa-ar="${a}">${esc(AREAS[a] || a)} <span class="n">${n}</span></button>`).join("")}</div>` : ""}
      <p class="capa-dica">${naoLidos ? `Role para começar ${ico("seta")}` : "Desative “Só não lidos” para rever o que já passou."}</p>
    </div></article>`;
  }

  async function vAtualize(main) {
    document.body.classList.add("modo-feed");
    const todos = await itensFeed();
    D.feedVistoAnt = P.feedVisto || somaDias(hojeISO(), -3);
    if (P.feedVisto !== hojeISO()) { P.feedVisto = hojeISO(); salvarP(); }
    const f = feedF();
    let soNovos = P.feedSoNovos !== false;
    const sessao = { lidos: new Set(), areas: {} };
    main.innerHTML = `
      <div class="feed-barra">
        <div class="fd-filtros rolagem" id="fd-filtros"></div>
        <div class="fd-progl"><div class="feed-prog"><i id="fd-prog"></i></div><span class="feed-cont" id="fd-cont"></span></div>
      </div>
      <div class="feed" id="fd" tabindex="0" aria-label="Novidades da jurisprudência. Use as setas para navegar."></div>
      <div class="fd-veu" id="fd-veu" hidden></div>
      <div class="fd-pop" id="fd-pop" role="dialog" aria-modal="false" hidden></div>
      <div class="feed-nav"><button type="button" class="btn-ico" id="fd-ant" aria-label="Anterior">${ico("seta")}</button><button type="button" class="btn-ico" id="fd-prox" aria-label="Próximo">${ico("seta")}</button></div>`;
    const box = $("#fd");
    let vis = [], feitos = 0, atual = -1, obs = null, timer = null, ativoEl = null, ativoDesde = 0;
    const LOTE = 25;

    // ------------------------------------------------------------ filtros
    const conta = (dim, pred) => todos.filter((x) => passaFeed(x, f, dim) && (!soNovos || !lidos()[x.k]) && pred(x)).length;
    const rotulo = {
      ar: () => (f.ar.length === 1 ? AREAS[f.ar[0]] || "Matéria" : f.ar.length ? `Matéria · ${f.ar.length}` : "Matéria"),
      tp: () => (f.tp.length === 1 ? FEED_TIPOS[f.tp[0]].rot : f.tp.length ? `Tipo · ${f.tp.length}` : "Tipo"),
      per: () => (f.per ? PERIODOS.find((p) => p[0] === f.per)[1] : "Período"),
      tese: () => (f.tese === "com" ? "Com tese" : f.tese === "sem" ? "Sem tese" : "Tese"),
      org: () => (f.org.length === 1 ? f.org[0] : f.org.length ? `Órgão · ${f.org.length}` : "Órgão"),
      rel: () => (f.rel ? relatorFmt(f.rel) : "Relator"),
    };
    const ativo = { ar: () => f.ar.length, tp: () => f.tp.length, per: () => f.per, tese: () => f.tese, org: () => f.org.length, rel: () => f.rel };
    const desenharFiltros = () => {
      $("#fd-filtros").innerHTML = `<button type="button" class="fpill novos" id="fd-novos" aria-pressed="${soNovos}">${ico("raio")} Só não lidos</button>` + Object.keys(rotulo).map((k) => `<button type="button" class="fpill" data-fp="${k}" aria-pressed="${!!ativo[k]()}" aria-haspopup="dialog">${esc(rotulo[k]())}${ico("seta")}</button>`).join("")
        + (nFiltros(f) ? `<button type="button" class="fpill limpar" id="fd-limpar">${ico("x")} Limpar</button>` : "");
    };
    const opcao = (dim, val, txt, n, marcado) => `<button type="button" class="chip" data-op="${dim}" data-val="${esc(val)}" aria-pressed="${marcado}">${esc(txt)} <span class="n">${n === "" ? "" : fmtInt(n)}</span></button>`;
    function conteudoPop(dim) {
      if (dim === "ar") {
        const c = {}; todos.filter((x) => passaFeed(x, f, "ar") && (!soNovos || !lidos()[x.k])).forEach((x) => x.ar.forEach((a) => (c[a] = (c[a] || 0) + 1)));
        const lista = Object.keys(AREAS).filter((a) => c[a] || f.ar.includes(a)).sort((a, b) => (c[b] || 0) - (c[a] || 0));
        return `<h3>Matéria</h3><div class="chips">${f.ar.length ? opcao("ar", "", "Todas", "", false) : ""}${lista.map((a) => opcao("ar", a, AREAS[a], c[a] || 0, f.ar.includes(a))).join("")}</div>`;
      }
      if (dim === "tp") return `<h3>Tipo de novidade</h3><div class="chips">${Object.entries(FEED_TIPOS).map(([k, v]) => opcao("tp", k, v.longo, conta("tp", (x) => x.tipo === k), f.tp.includes(k))).join("")}</div>`;
      if (dim === "per") return `<h3>Período</h3><div class="chips">${PERIODOS.map(([d, txt]) => opcao("per", d, txt, conta("per", (x) => !d || Math.abs((new Date(hojeISO()) - new Date(x.d)) / 864e5) <= d), f.per === d)).join("")}</div><p class="nota">Pautas contam pela proximidade da sessão.</p>`;
      if (dim === "tese") return `<h3>Tese</h3><div class="chips">${[["", "Todas"], ["com", "Com tese firmada ou de julgamento"], ["sem", "Sem tese"]].map(([v, txt]) => opcao("tese", v, txt, conta("tese", (x) => !v || (v === "com") === x.tese), f.tese === v)).join("")}</div>`;
      if (dim === "org") {
        const c = {}; todos.filter((x) => passaFeed(x, f, "org") && (!soNovos || !lidos()[x.k]) && x.org).forEach((x) => (c[x.org] = (c[x.org] || 0) + 1));
        const nomes = Object.values(D.orgaos).filter((o) => c[o] || f.org.includes(o));
        return `<h3>Órgão julgador</h3><div class="chips">${nomes.map((o) => opcao("org", o, o, c[o] || 0, f.org.includes(o))).join("")}</div>`;
      }
      const c = {}; todos.filter((x) => passaFeed(x, f, "rel") && (!soNovos || !lidos()[x.k]) && x.rel).forEach((x) => { const k = titulo(x.rel); c[k] = (c[k] || 0) + 1; });
      const lista = Object.entries(c).sort((a, b) => b[1] - a[1]);
      return `<h3>Relator(a)</h3><input type="search" class="campo" id="fd-rel-q" placeholder="Digite o nome" autocomplete="off">
        <div class="chips" id="fd-rel-l" style="margin-top:10px">${f.rel ? opcao("rel", "", "Todos", "", false) : ""}${lista.map(([nome, n]) => opcao("rel", nome, nome, n, norm(nome) === norm(f.rel))).join("")}</div>`;
    }
    const pop = $("#fd-pop"), veu = $("#fd-veu");
    let popDim = "";
    function abrirPop(dim, botao) {
      popDim = dim;
      pop.innerHTML = `<div class="fd-pop-cab"><span class="alca"></span><button type="button" class="btn-ico" data-fechar-pop aria-label="Fechar">${ico("x")}</button></div>${conteudoPop(dim)}`;
      const folha = matchMedia("(max-width: 860px)").matches;
      pop.classList.toggle("folha", folha);
      if (!folha) {
        const r = botao.getBoundingClientRect();
        pop.style.left = `${Math.min(r.left, innerWidth - 400)}px`; pop.style.top = `${r.bottom + 8}px`;
      } else { pop.style.left = ""; pop.style.top = ""; }
      pop.hidden = false; veu.hidden = !folha;
      requestAnimationFrame(() => { pop.classList.add("vis"); veu.classList.add("vis"); });
      const q = $("#fd-rel-q", pop);
      if (q) {
        if (!folha) q.focus();
        q.addEventListener("input", () => { const t = norm(q.value); $$("#fd-rel-l [data-op]", pop).forEach((b) => { b.hidden = !!t && !norm(b.dataset.val).includes(t); }); });
      }
    }
    function fecharPop() {
      if (pop.hidden) return;
      pop.classList.remove("vis"); veu.classList.remove("vis"); popDim = "";
      setTimeout(() => { if (!pop.classList.contains("vis")) { pop.hidden = true; veu.hidden = true; } }, 200);
    }
    const aplicar = () => { salvarP(); desenharFiltros(); montar(); };
    pop.addEventListener("click", (e) => {
      if (e.target.closest("[data-fechar-pop]")) return fecharPop();
      const b = e.target.closest("[data-op]"); if (!b) return;
      const { op, val } = b.dataset;
      if (op === "ar" && !val) f.ar = [];
      else if (op === "tp" || op === "org" || op === "ar") { f[op] = f[op].includes(val) ? f[op].filter((x) => x !== val) : [...f[op], val]; }
      if (op === "per") f.per = +val;
      if (op === "tese") f.tese = val;
      if (op === "rel") f.rel = norm(val) === norm(f.rel) ? "" : val;
      aplicar();
      if (op === "per" || op === "tese" || op === "rel" || (op === "ar" && !val)) fecharPop(); else abrirPop(op, $(`[data-fp="${op}"]`));
    });
    veu.addEventListener("click", fecharPop);
    const foraPop = (e) => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest("[data-fp]")) fecharPop(); };
    document.addEventListener("pointerdown", foraPop);
    $("#fd-filtros").addEventListener("click", (e) => {
      if (e.target.closest("#fd-limpar")) { Object.assign(f, FILTRO_VAZIO()); fecharPop(); return aplicar(); }
      if (e.target.closest("#fd-novos")) { soNovos = !soNovos; P.feedSoNovos = soNovos; fecharPop(); return aplicar(); }
      const b = e.target.closest("[data-fp]"); if (!b) return;
      if (popDim === b.dataset.fp) return fecharPop();
      abrirPop(b.dataset.fp, b);
    });
    // -------------------------------------------------------------- fila
    const fimHTML = () => {
      const top = Object.entries(sessao.areas).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([a, n]) => `${esc(AREAS[a] || a)} ${n}`).join(" · ");
      return `<article class="reel reel-fim" data-i="${vis.length}"><div class="reel-in">
        <div class="vazio-ico" style="margin:0 0 14px">${ico("destaques")}</div>
        <p class="reel-kicker">Fim da fila</p>
        <div class="reel-texto"><p>${vis.length ? "Você está em dia com estas novidades." : "Nada novo nos filtros escolhidos."}</p></div>
        <p class="reel-apoio">${sessao.lidos.size ? `Nesta leitura: <b>${sessao.lidos.size}</b> novidade${sessao.lidos.size > 1 ? "s" : ""}${top ? ` — ${top}` : ""}. ` : ""}Os repetitivos e as pautas mudam todos os dias; os acórdãos com ementa chegam em lotes mensais.</p>
        <footer class="reel-acoes">${nFiltros(f) ? `<button type="button" class="btn btn-pri btn-peq" id="fd-sem-filtro">Ver sem filtros</button>` : `<a class="btn btn-pri btn-peq" href="#destaques">Ver todos os destaques</a>`}<a class="btn btn-claro btn-peq" href="#radar">Meu radar e salvos</a>${soNovos ? `<button type="button" class="btn btn-fant btn-peq" id="fd-rever">Rever os já lidos</button>` : ""}</footer>
      </div></article>`;
    };
    function anexar() {
      if (feitos >= vis.length) return;
      const ate = Math.min(vis.length, feitos + LOTE);
      let html = "";
      for (let i = feitos; i < ate; i++) html += cartaoFeed(vis[i], i, vis.length);
      feitos = ate;
      if (feitos >= vis.length) html += fimHTML();
      box.insertAdjacentHTML("beforeend", html);
      $$(".reel:not([data-obs])", box).forEach((el) => { el.dataset.obs = "1"; obs.observe(el); });
      $("#fd-rever")?.addEventListener("click", () => { soNovos = false; P.feedSoNovos = false; aplicar(); });
      $("#fd-sem-filtro")?.addEventListener("click", () => { Object.assign(f, FILTRO_VAZIO()); aplicar(); });
    }
    function montar() {
      sairCartao();
      vis = todos.filter((x) => passaFeed(x, f) && (!soNovos || !lidos()[x.k]));
      feitos = 0; atual = -1;
      obs?.disconnect(); criarObs();
      box.innerHTML = capaFeed(vis, f);
      anexar();
      box.scrollTop = 0;
      atualizarProg();
    }
    const atualizarProg = () => {
      const n = vis.length, pos = Math.max(0, Math.min(atual + 1, n));
      const hoje = lidosHoje();
      $("#fd-cont").textContent = n ? `${pos ? `${pos} de ` : ""}${fmtInt(n)}${hoje ? ` · ${hoje} lido${hoje > 1 ? "s" : ""} hoje` : ""}` : "Nada novo";
      $("#fd-prog").style.transform = `scaleX(${n ? pos / n : 1})`;
    };
    function sairCartao() {
      if (!ativoEl) return;
      const it = vis[+ativoEl.dataset.i];
      const seg = (performance.now() - ativoDesde) / 1000;
      if (it && seg > 7) ajustarPeso(it.ar, 0.6);
      ativoEl.classList.remove("ativo"); ativoEl = null;
    }
    function entrarCartao(el) {
      if (ativoEl === el) return;
      sairCartao();
      ativoEl = el; ativoDesde = performance.now();
      el.classList.add("ativo", "visto");
      atual = +(el.dataset.i ?? -1);
      atualizarProg();
      const txt = $(".reel-texto", el), par = $(".reel-texto p", el), mais = $(".reel-mais", el);
      if (par && mais && !txt.classList.contains("aberto")) mais.hidden = par.scrollHeight <= par.clientHeight + 4;
      if (atual >= feitos - 6) anexar();
      clearTimeout(timer);
      const it = vis[atual];
      if (it) timer = setTimeout(() => {
        marcarLido(it.k);
        if (!sessao.lidos.has(it.k)) { sessao.lidos.add(it.k); it.ar.forEach((a) => (sessao.areas[a] = (sessao.areas[a] || 0) + 1)); }
        $(".novo", el)?.remove(); atualizarProg();
      }, 1500);
    }
    function criarObs() {
      obs = new IntersectionObserver((ents) => {
        for (const e of ents) if (e.isIntersecting && e.intersectionRatio >= 0.6) entrarCartao(e.target);
      }, { root: box, threshold: [0.6] });
    }
    const ir = (d) => {
      const els = $$(".reel", box);
      const idx = els.indexOf(ativoEl) + d;
      els[Math.max(0, Math.min(els.length - 1, idx))]?.scrollIntoView({ block: "start", behavior: "instant" });
    };
    $("#fd-ant").addEventListener("click", () => ir(-1));
    $("#fd-prox").addEventListener("click", () => ir(1));

    // ------------------------------------------------------------ ações
    function salvarItem(it, botao, forcar = false) {
      const k = it.t ? `t:${it.t.tp}-${it.t.n}` : `a:${it.r.id}`;
      if (forcar && P.salvos[k]) return false;
      if (it.t) alternarSalvo(k, { k: "t", tp: it.t.tp, n: it.t.n }, botao);
      else alternarSalvo(k, minimoAcordao(it.r), botao);
      if (P.salvos[k]) ajustarPeso(it.ar, 1.5);
      return true;
    }
    function estourar(el) {
      const s = $(".estouro", el); if (!s) return;
      s.classList.remove("vai"); void s.offsetWidth; s.classList.add("vai");
    }
    let toque = { t: 0, x: 0, y: 0 };
    box.addEventListener("pointerup", (e) => {
      if (e.target.closest("button, a, input, .reel-capa")) return;
      const el = e.target.closest(".reel[data-k]"); if (!el) return;
      const agora = performance.now();
      if (agora - toque.t < 320 && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) < 30) {
        const it = vis[+el.dataset.i];
        if (it) { if (salvarItem(it, $(".btn-salvar", el), true)) estourar(el); else toast("Já está nos salvos."); }
        getSelection()?.removeAllRanges();
        toque.t = 0;
      } else toque = { t: agora, x: e.clientX, y: e.clientY };
    });
    box.addEventListener("click", async (e) => {
      const capaTp = e.target.closest("[data-capa-tp]"), capaAr = e.target.closest("[data-capa-ar]");
      if (capaTp) { f.tp = capaTp.dataset.capaTp.split(","); return aplicar(); }
      if (capaAr) { f.ar = [capaAr.dataset.capaAr]; return aplicar(); }
      const b = e.target.closest("[data-f]"); if (!b) return;
      const el = b.closest(".reel"); const it = vis[+el.dataset.i]; if (!it) return;
      const fn = b.dataset.f;
      const textoIt = it.t ? `${it.t.tp} ${it.t.n}/STJ — ${it.t.tese ? "Tese: " + it.t.tese : it.t.q}` : `${it.r.tese || it.r.tj ? (it.r.tese ? "Tese jurídica: " : "Tese de julgamento: ") + (it.r.tese || it.r.tj) + "\n" : ""}${citacao(it.r)}`;
      if (fn === "mais") { $(".reel-texto", el).classList.add("aberto"); b.hidden = true; }
      if (fn === "area") { f.ar = [b.dataset.ar]; aplicar(); toast(`Lendo só ${AREAS[b.dataset.ar] || ""}.`); }
      if (fn === "tema") abrirTema(it.t.tp, it.t.n);
      if (fn === "acordao") abrirAcordao(it.r);
      if (fn === "copiar") copiar(textoIt, "Copiado.");
      if (fn === "menos") {
        ajustarPeso(it.ar, -3);
        toast(it.ar.length ? `Certo. ${AREAS[it.ar[0]] || "Esta matéria"} vai aparecer menos.` : "Certo, vamos mostrar menos disso.");
        ir(1);
      }
      if (fn === "compartilhar") {
        const url = it.t ? URLS.tema(it.t.tp, it.t.n) : URLS.inteiroTeor(it.r.reg, it.r.dj);
        if (navigator.share) { try { await navigator.share({ title: "Radar STJ", text: textoIt, url }); } catch { /* cancelado */ } }
        else copiar(`${textoIt}\n${url}`, "Texto e link copiados para compartilhar.");
      }
      if (fn === "salvar") salvarItem(it, b);
    });
    const tecla = (e) => {
      if (!document.body.classList.contains("modo-feed") || /input|textarea|select/i.test(document.activeElement.tagName) || !$("#gaveta").hidden) return;
      if (e.key === "Escape") return fecharPop();
      if (["ArrowDown", "j", "PageDown", " "].includes(e.key)) { e.preventDefault(); ir(1); }
      if (["ArrowUp", "k", "PageUp"].includes(e.key)) { e.preventDefault(); ir(-1); }
      if (e.key === "s" && ativoEl?.dataset.k) { const it = vis[+ativoEl.dataset.i]; if (it) { salvarItem(it, $(".btn-salvar", ativoEl)); } }
      if ((e.key === "o" || e.key === "Enter") && ativoEl?.dataset.k) $('[data-f="acordao"], [data-f="tema"]', ativoEl)?.click();
    };
    document.addEventListener("keydown", tecla);
    D.saiFeed = () => {
      sairCartao();
      document.removeEventListener("keydown", tecla); document.removeEventListener("pointerdown", foraPop);
      obs?.disconnect(); clearTimeout(timer); document.body.classList.remove("modo-feed");
      atualizarContadorFeed();
    };
    desenharFiltros(); montar();
    setTimeout(() => box.focus({ preventScroll: true }), 60);
  }

  // ============================================================== roteador
  const VIEWS = [
    { id: "painel", tit: "Visão geral", sobre: "Painel diário", ico: "painel", fn: vPainel },
    { id: "atualize", tit: "Atualize-se", sobre: "Leitura do dia", ico: "raio", fn: vAtualize, cont2: true },
    { id: "radar", tit: "Meu radar", sobre: "Seus interesses", ico: "radar", fn: vRadar, cont: true },
    { id: "destaques", tit: "Destaques", sobre: "Acórdãos relevantes", ico: "destaques", fn: vDestaques },
    { id: "pesquisa", tit: "Pesquisa de acórdãos", sobre: "Acervo de 12 meses", ico: "pesquisa", fn: vPesquisa },
    { id: "repetitivos", tit: "Precedentes qualificados", sobre: "Repetitivos, IAC e controvérsias", ico: "repetitivos", fn: vRepetitivos },
    { id: "pautas", tit: "Pautas e publicações", sobre: "O que vai ser julgado", ico: "pautas", fn: vPautas },
    { id: "verificar", tit: "Verificar petição", sobre: "Conferência de citações", ico: "verificar", fn: vVerificar },
    { id: "sobre", tit: "Sobre o Radar STJ", sobre: "Fontes e método", ico: "sobre", fn: vSobre },
  ];
  function montarNav() {
    $("#menu").innerHTML = VIEWS.map((v, i) => `${i === 7 ? '<div class="sep"></div>' : ""}<a href="#${v.id}" data-v="${v.id}">${ico(v.ico)}<span>${v.tit === "Precedentes qualificados" ? "Repetitivos" : v.tit === "Pesquisa de acórdãos" ? "Pesquisa" : v.tit === "Pautas e publicações" ? "Pautas" : v.tit === "Visão geral" ? "Visão geral" : v.tit === "Sobre o Radar STJ" ? "Sobre" : v.tit}</span>${v.cont ? '<span class="cont cont-radar" hidden></span>' : ""}${v.cont2 ? '<span class="cont cont-feed" hidden></span>' : ""}</a>`).join("");
    const inf = [["painel", "Início"], ["atualize", "Atualize-se"], ["radar", "Radar"], ["pesquisa", "Pesquisa"]];
    $("#barra-inf").innerHTML = inf.map(([id, l]) => `<a href="#${id}" data-v="${id}">${ico(VIEWS.find((v) => v.id === id).ico)}<span>${l}</span>${id === "radar" ? '<span class="cont cont-radar" hidden></span>' : ""}${id === "atualize" ? '<span class="cont cont-feed" hidden></span>' : ""}</a>`).join("")
      + `<button type="button" id="inf-mais" aria-haspopup="dialog">${ico("mais")}<span>Mais</span></button>`;
    $("#inf-mais").addEventListener("click", () => {
      abrirGaveta("Navegação", "Mais seções", `<nav class="lista">${VIEWS.filter((v) => !["painel", "atualize", "radar", "pesquisa"].includes(v.id)).map((v) =>
        `<a class="card item" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit" href="#${v.id}" data-fechar>${ico(v.ico)}<span><b>${v.tit}</b><br><span class="meta">${v.sobre}</span></span></a>`).join("")}</nav>`);
      $$("[data-fechar]", $("#gaveta-corpo")).forEach((a) => a.addEventListener("click", fecharGaveta));
    });
  }
  function lerHash() {
    const h = location.hash.replace(/^#/, "");
    const [v, qs] = h.split("?");
    return { v: VIEWS.some((x) => x.id === v) ? v : "painel", p: new URLSearchParams(qs || "") };
  }
  function gravarHash(v, params) {
    const qs = new URLSearchParams();
    for (const [k, val] of Object.entries(params)) if (val !== "" && val != null && val !== false) qs.set(k, val === true ? "1" : val);
    const s = qs.toString();
    history.replaceState(null, "", `#${v}${s ? "?" + s : ""}`);
  }
  let viewAtual = null;
  async function rotear() {
    fecharGaveta();
    if (D.saiFeed) { D.saiFeed(); D.saiFeed = null; }
    const { v, p } = lerHash();
    const def = VIEWS.find((x) => x.id === v);
    $$("[data-v]").forEach((a) => a.classList.toggle("ativa", a.dataset.v === v));
    $("#topo-titulo").textContent = def.tit;
    $("#topo-sobre").textContent = def.sobre;
    document.title = `${def.tit} · Radar STJ`;
    const main = $("#view");
    const mesma = viewAtual === v;
    viewAtual = v;
    if (!mesma) {
      main.innerHTML = esqueleto();
      main.classList.remove("view-entra"); void main.offsetWidth; main.classList.add("view-entra");
      window.scrollTo({ top: 0 });
    }
    try { await def.fn(main, p, mesma); }
    catch (e) {
      console.error(e);
      main.innerHTML = `<div class="card vazio"><div class="vazio-ico">${ico("alerta")}</div><h3>Não foi possível carregar os dados</h3><p>${esc(e.message)}</p><button class="btn btn-claro" onclick="location.reload()">Tentar de novo</button></div>`;
    }
  }
  const esqueleto = () => `<div class="lista">${Array.from({ length: 3 }, () => `<div class="card item"><div class="esq" style="height:14px;width:40%"></div><div class="esq" style="height:12px;width:90%;margin-top:14px"></div><div class="esq" style="height:12px;width:75%;margin-top:8px"></div></div>`).join("")}</div>`;
  const vazio = (icone, tit, txt, acao = "") => `<div class="card vazio"><div class="vazio-ico">${ico(icone)}</div><h3>${tit}</h3><p>${txt}</p>${acao}</div>`;

  // ================================================================ PAINEL
  async function vPainel(main) {
    const [t, pl, ds] = await Promise.all([temas(), pautas(), destaques()]);
    const hoje = hojeISO();
    const ev7 = eventosTemas(t, somaDias(hoje, -7));
    const ev30 = eventosTemas(t, somaDias(hoje, -30));
    const mesUlt = ds[0]?.dj?.slice(0, 7);
    const dsMes = agrupar(ds.filter((r) => r.dj?.startsWith(mesUlt)));
    const lim14 = somaDias(hoje, 14);
    const plRel = pl.filter((p) => p.d <= lim14 && (p.temas?.length || /secao|especial/.test(p.o)));
    const plTema = pl.filter((p) => p.temas?.length);
    const radar = await calcularRadar();
    const naoLidos = await contarNaoLidos();
    const novosRadar = radar.filter((x) => x.novo);
    const configurado = P.termos.length + P.procs.length + P.oabs.length > 0;

    main.innerHTML = `
      <section class="hero">
        <p class="sobretitulo">${fmtDiaL(hoje)}</p>
        <h2>O que mudou no STJ?</h2>
        <p>Movimentações em repetitivos, acórdãos que merecem leitura, o que vai a julgamento e o que aconteceu nos assuntos que você acompanha.</p>
        <a class="btn-feed" href="#atualize">${ico("raio")}<span><b>${naoLidos ? `${fmtInt(naoLidos)} novidade${naoLidos > 1 ? "s" : ""} para ler` : "Você está em dia"}</b><small>${naoLidos ? "Leitura rápida, uma tese por vez" : "Rever as últimas teses e julgados"}</small></span>${ico("seta")}</a>
        <form class="hero-busca" id="hero-f" role="search">
          <input id="hero-q" type="search" placeholder="Assunto, “tema 1234” ou número do processo" aria-label="Pesquisar">
          <button class="btn btn-pri" type="submit" aria-label="Pesquisar">${ico("pesquisa")}<span class="so-largo">Pesquisar</span></button>
        </form>
        <div class="hero-dicas">
          <button type="button" data-ir="#repetitivos?sit=andamento">Repetitivos em andamento</button>
          <button type="button" data-ir="#destaques?a=civil">Destaques de Direito Civil</button>
          <button type="button" data-ir="#destaques?a=consumidor">Destaques de Consumidor</button>
          <button type="button" data-ir="#pautas?rel=1">Pautas relevantes</button>
        </div>
      </section>
      <div class="stats">
        <a class="stat" href="#repetitivos?s=mov">
          <span class="stat-ico ico-azul">${ico("repetitivos")}</span><span><b>${fmtInt(ev7.length)}</b><span>movimentações em repetitivos nos últimos 7 dias</span></span></a>
        <a class="stat" href="#destaques">
          <span class="stat-ico ico-lar">${ico("destaques")}</span><span><b>${fmtInt(dsMes.length)}</b><span>destaques entre os acórdãos de ${mesUlt ? fmtMes(mesUlt) : "—"}</span></span></a>
        <a class="stat" href="#pautas?rel=1">
          <span class="stat-ico ico-verde">${ico("pautas")}</span><span><b>${fmtInt(plRel.length)}</b><span>processos relevantes em pauta nos próximos 14 dias</span></span></a>
        <a class="stat" href="#radar">
          <span class="stat-ico ico-verm">${ico("radar")}</span><span><b>${configurado ? fmtInt(novosRadar.length) : "—"}</b><span>${configurado ? "novidades no seu radar desde a última visita" : "configure o seu radar de assuntos"}</span></span></a>
      </div>

      <div class="grade-2 secao">
        <section>
          <div class="secao-cab"><div><h2>Precedentes qualificados</h2><p>Afetações, julgamentos e publicações dos últimos 30 dias</p></div>
            <a class="link-acao" href="#repetitivos?s=mov">Ver todos ${ico("seta")}</a></div>
          <div class="card card-pad">${ev30.length ? `<ol class="eventos">${ev30.slice(0, 9).map((e) => `
            <li class="evento" data-tema="${esc(e.t.tp)}|${e.t.n}"><span class="quando">${fmtData(e.d)}</span><span class="marco"><i class="${e.k}"></i></span>
              <div><div class="evento-tit"><button type="button" data-abrir-tema>${esc(e.t.tp)} ${e.t.n} · ${esc(e.txt)}</button></div>
              <div class="evento-txt">${esc(e.t.tese ? "Tese: " + e.t.tese : e.t.q || "")}${e.t._teseAguarda && e.k !== "afet" ? " · Tese aguardando a publicação do acórdão." : ""}</div></div></li>`).join("")}</ol>` : `<p class="nota">Nenhuma movimentação no período.</p>`}</div>
        </section>
        <section>
          <div class="secao-cab"><div><h2>Seu radar</h2><p>${configurado ? `${P.termos.length} assunto(s), ${P.procs.length + P.oabs.length} processo(s)/OAB` : "Acompanhe assuntos, processos e OAB"}</p></div>
            <a class="link-acao" href="#radar">${configurado ? "Abrir" : "Configurar"} ${ico("seta")}</a></div>
          ${configurado ? (radar.length ? `<div class="card card-pad"><ol class="eventos">${radar.slice(0, 5).map(itemRadarCompacto).join("")}</ol></div>`
            : `<div class="card card-pad"><p class="nota">Nada encontrado ainda para os seus assuntos.</p></div>`)
            : `<div class="card card-pad"><p class="texto-serif" style="margin-bottom:12px">Cadastre os assuntos que você acompanha (por exemplo, <i>prescrição intercorrente</i> ou <i>tema 1365</i>), os números dos seus processos ou a sua OAB. O site avisa quando houver novidade.</p><a class="btn btn-pri" href="#radar">${ico("mais1")} Configurar meu radar</a></div>`}

          <div class="secao-cab" style="margin-top:22px"><div><h2>Próximas sessões</h2><p>Repetitivos em pauta e julgamentos das Seções e da Corte Especial</p></div>
            <a class="link-acao" href="#pautas?rel=1">Ver pautas ${ico("seta")}</a></div>
          <div class="card card-pad">${(plTema.length ? plTema : plRel).length ? `<ol class="eventos">${unicos([...plTema, ...plRel.filter((p) => !p.temas?.length)], (p) => `${p.p}|${p.d}|${p.pet || ""}`).slice(0, 6).map((p) => `
            <li class="evento"><span class="quando">${fmtData(p.d)}</span><span class="marco"><i class="pauta"></i></span>
              <div><div class="evento-tit">${esc(p.p)}${p.pet ? ` (${esc(p.pet)})` : ""} · ${esc(D.orgaos[p.o] || "")}</div>
              <div class="evento-txt">${p.temas?.length ? `Vinculado a ${p.temas.map(([tp, n]) => `${tp} ${n}`).join(", ")}` : `Rel. ${esc(p.rel || "")}`}</div></div></li>`).join("")}</ol>` : `<p class="nota">Nenhuma sessão relevante nos próximos dias.</p>`}</div>
        </section>
      </div>

      <section class="secao">
        <div class="secao-cab"><div><h2>Destaques recentes</h2><p>Acórdãos que a classificação automática considera mais relevantes em ${mesUlt ? fmtMesL(mesUlt) : "—"}</p></div>
          <a class="link-acao" href="#destaques">Ver todos ${ico("seta")}</a></div>
        <ol class="lista" id="painel-dest">${dsMes.sort((a, b) => b.s - a.s).slice(0, 4).map((r) => cardAcordao(r)).join("")}</ol>
      </section>`;
    ligarCards($("#painel-dest"));
    $("#hero-f").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = $("#hero-q").value.trim(); if (!q) return;
      const tm = /^tema\s*:?\s*(\d+)$/i.exec(q);
      if (tm) location.hash = `#repetitivos?q=${tm[1]}&tipo=Tema`;
      else if (/^[\d.\s/-]{5,}$/.test(q)) location.hash = `#pesquisa?n=${digitos(q)}&p=u12`;
      else location.hash = `#pesquisa?q=${encodeURIComponent(q)}&p=u3`;
    });
    $$("[data-ir]", main).forEach((b) => b.addEventListener("click", () => (location.hash = b.dataset.ir)));
  }
  function unicos(l, chave) { const v = new Set(); return l.filter((x) => { const k = chave(x); if (v.has(k)) return false; v.add(k); return true; }); }
  function itemRadarCompacto(it) {
    const o = it.obj;
    let tit = "", txt = "";
    if (it.tipo === "tema") { tit = `${o.tp} ${o.n}`; txt = it.pauta ? `Em pauta em ${fmtData(it.pauta.d)} · ${o.q || ""}` : o.tese ? `Tese: ${o.tese}` : o.q || ""; }
    if (it.tipo === "acordao") { tit = `${o.cl} ${fmtNumProc(o.n)} · ${D.orgaos[o.o] || ""}`; txt = frase(o.h || ""); }
    if (it.tipo === "pauta") { tit = `${o.p}${o.pet ? " (" + o.pet + ")" : ""} em pauta`; txt = `${fmtDiaL(o.d)} · ${D.orgaos[o.o] || ""} · Rel. ${o.rel || ""}`; }
    if (it.tipo === "djen") { tit = `${o.p} · acórdão publicado`; txt = `${o.r || ""} ${o.t || ""} · Rel. ${titulo(o.rel)}`; }
    const tema = it.tipo === "tema" ? ` data-tema="${esc(o.tp)}|${o.n}"` : "";
    return `<li class="evento"${tema}><span class="quando">${fmtData(it.d)}</span><span class="marco"><span class="ponto ${it.nivel}" style="margin-top:0"></span></span>
      <div><div class="evento-tit">${tema ? `<button type="button" data-abrir-tema>${esc(tit)}</button>` : esc(tit)} ${it.novo ? '<span class="selo novo">Novo</span>' : ""}</div>
      <div class="evento-txt">${esc(txt)}</div><div class="meta" style="margin-top:2px"><span>por “${esc(it.termo)}”</span></div></div></li>`;
  }

  // ============================================================ MEU RADAR
  const TIPO_RADAR = { tema: "Repetitivo", acordao: "Acórdão", pauta: "Em pauta", djen: "Publicação no DJEN" };
  function areasItem(it) { return it.obj?.ar || (it.tipo === "pauta" && it.temaObj?.ar) || []; }
  function itemRadarLinha(it, termos) {
    const o = it.obj;
    const novo = it.novo ? '<span class="selo novo">Novo</span>' : "";
    const nivel = `<span class="ponto ${it.nivel}" title="${NIVEL_TX[it.nivel] || ""}"></span>`;
    const areas = areasItem(it).slice(0, 2).map((k) => `<span class="selo">${esc(AREAS[k] || k)}</span>`).join("");
    const por = `<span class="meta"><span>por “${esc(it.termo)}”</span></span>`;
    if (it.tipo === "acordao") {
      REG_AC.set(String(o.id), o);
      const tese = o.tese || o.tj;
      return `<li class="card item item-radar" data-id="${esc(o.id)}">
        <div class="item-cab">${nivel}<button type="button" class="item-tit item-abrir" data-a="abrir">${esc(o.cl)} ${fmtNumProc(o.n)}</button>${novo}
          <span class="meta"><span>${esc(D.orgaos[o.o] || "")}</span><span>Publ. ${fmtData(o.dj)}</span></span></div>
        <div class="item-sel"><span class="selo pri">${TIPO_RADAR.acordao}</span>${areas}</div>
        ${tese ? `<div class="tese compacta"><b>${o.tese ? "Tese jurídica" : "Tese de julgamento"}</b><p>${destacar(esc(tese), termos)}</p></div>` : ""}
        <p class="verb verb-curta">${destacar(esc(frase(o.h || "")), termos)}</p>
        <div class="acoes"><button type="button" class="link-acao" data-a="abrir">Ver julgado completo ${ico("seta")}</button>
          <a class="link-acao" href="${URLS.inteiroTeor(o.reg, o.dj)}" target="_blank" rel="noopener">Inteiro teor oficial ${ico("externo")}</a>${por}</div></li>`;
    }
    if (it.tipo === "tema") {
      return `<li class="card item item-radar" data-tema="${esc(o.tp)}|${o.n}">
        <div class="item-cab">${nivel}<button type="button" class="item-tit item-abrir" data-abrir-tema>${esc(o.tp)} ${o.n}</button>${seloSit(o.sit)}${it.pauta ? `<span class="selo alta">Em pauta ${fmtData(it.pauta.d)}</span>` : ""}${novo}
          <span class="meta"><span>${esc(o.org || "")}</span>${o._mov ? `<span>Últ. mov. ${fmtData(o._mov)}</span>` : ""}</span></div>
        ${areas ? `<div class="item-sel">${areas}</div>` : ""}
        ${o.tese ? `<div class="tese compacta"><b>Tese firmada</b><p>${destacar(esc(o.tese), termos)}</p></div>` : `<p class="texto-serif">${destacar(esc(o.q || ""), termos)}</p>`}
        <div class="acoes"><button type="button" class="link-acao" data-abrir-tema>Detalhes e linha do tempo ${ico("seta")}</button>
          <a class="link-acao" href="${URLS.tema(o.tp, o.n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>${por}</div></li>`;
    }
    if (it.tipo === "pauta") {
      return `<li class="card item item-radar">
        <div class="item-cab">${nivel}<span class="item-tit">${esc(o.p)}${o.pet ? ` (${esc(o.pet)})` : ""}</span><span class="selo alta">Em pauta</span>${novo}
          <span class="meta"><span>${fmtDiaL(o.d)}</span><span>${esc(D.orgaos[o.o] || "")}</span><span>Rel. ${esc(o.rel || "")}</span></span></div>
        ${o.temas?.length ? `<p class="texto-serif">Vinculado a ${o.temas.map(([tp, n]) => `${esc(tp)} ${n}`).join(", ")}.</p>` : ""}
        <div class="acoes"><a class="link-acao" href="${URLS.processo(o.reg)}" target="_blank" rel="noopener">Consulta processual ${ico("externo")}</a>${por}</div></li>`;
    }
    return `<li class="card item item-radar">
      <div class="item-cab">${nivel}<span class="item-tit">${esc(o.p)}</span><span class="selo acomp">Acórdão publicado</span>${novo}
        <span class="meta"><span>DJEN ${fmtData(o.d)}</span><span>${esc(o.r || "")} ${esc(o.t || "")}</span><span>Rel. ${esc(titulo(o.rel))}</span></span></div>
      <div class="acoes"><a class="link-acao" href="${URLS.inteiroTeor(o.reg, o.d)}" target="_blank" rel="noopener">Inteiro teor oficial ${ico("externo")}</a>${por}</div></li>`;
  }

  async function vRadar(main, p) {
    if (p.get("importar")) {
      try {
        const o = JSON.parse(decodeURIComponent(escape(atob(p.get("importar")))));
        for (const k of ["termos", "procs", "oabs"]) for (const v of o[k] || []) if (!P[k].includes(v)) P[k].push(v);
        salvarP(); toast("Radar importado.");
      } catch { toast("Não foi possível importar o link."); }
      gravarHash("radar", {});
    }
    const aba = p.get("aba") || "novidades";
    const F = { nivel: "", tipo: "", area: "", termo: "" };
    main.innerHTML = `
      <div class="radar-grade">
        <aside class="radar-lado">
          <div class="card card-pad radar-bloco">
            <h3>Assuntos</h3><p>Use os mesmos operadores da pesquisa: <code>"prova oral"</code>, <code>e</code>, <code>ou</code>, <code>não</code>, <code>prescri$</code>, <code>tema 1234</code>.</p>
            <form class="adicionar" data-lista="termos"><input placeholder='Ex.: "prescrição intercorrente"' aria-label="Novo assunto"><button class="btn btn-pri" type="submit" aria-label="Adicionar">${ico("mais1")}</button></form>
            <div class="tags" data-tags="termos"></div>
            <div class="sugestoes" id="rd-sug"></div>
          </div>
          <div class="card card-pad radar-bloco">
            <h3>Processos</h3><p>Número do processo ou do registro. Avisa quando entrar em pauta ou tiver acórdão publicado.</p>
            <form class="adicionar" data-lista="procs"><input placeholder="Ex.: REsp 2222623" aria-label="Novo processo"><button class="btn btn-pri" type="submit" aria-label="Adicionar">${ico("mais1")}</button></form>
            <div class="tags" data-tags="procs"></div>
          </div>
          <div class="card card-pad radar-bloco">
            <h3>OAB</h3><p>Mostra os processos com a sua inscrição nas próximas pautas.</p>
            <form class="adicionar" data-lista="oabs"><input placeholder="Ex.: RS 12345" aria-label="Nova OAB"><button class="btn btn-pri" type="submit" aria-label="Adicionar">${ico("mais1")}</button></form>
            <div class="tags" data-tags="oabs"></div>
          </div>
          <div class="card card-pad radar-bloco">
            <h3>Outro dispositivo</h3><p>O radar fica salvo neste navegador. Para usá-lo em outro aparelho, abra lá o link abaixo.</p>
            <button type="button" class="btn btn-claro btn-peq" id="rd-link">${ico("link")} Copiar link do meu radar</button>
          </div>
        </aside>
        <section>
          <div class="barra-filtros" style="justify-content:space-between">
            <div class="segmentos" role="tablist">
              <button type="button" role="tab" data-aba="novidades" aria-selected="${aba === "novidades"}">Novidades</button>
              <button type="button" role="tab" data-aba="salvos" aria-selected="${aba === "salvos"}">Salvos (${Object.keys(P.salvos).length})</button>
            </div>
            <button type="button" class="btn btn-claro btn-peq" id="rd-visto" hidden>Marcar tudo como visto</button>
          </div>
          <div class="card card-pad filtros-radar" id="rd-filtros" hidden>
            <div class="chips" id="rd-nivel"></div>
            <div class="barra-filtros" style="margin-top:10px">
              <select id="rd-tipo" class="sel-auto" aria-label="Tipo"><option value="">Tudo</option><option value="tema">Repetitivos</option><option value="acordao">Acórdãos</option><option value="pauta">Pautas</option><option value="djen">Publicações no DJEN</option></select>
              <select id="rd-termo" class="sel-auto" aria-label="Assunto"><option value="">Todos os assuntos</option></select>
            </div>
            <div class="chips rolagem" id="rd-areas" style="margin-top:10px"></div>
          </div>
          <div id="rd-corpo" style="margin-top:14px"></div>
        </section>
      </div>`;
    const SUGESTOES = ['"prescrição intercorrente"', '"plano de saúde"', '"dano moral" e "in re ipsa"', '"honorários advocatícios"', '"recuperação judicial"', '"alimentos"', '"bem de família"', '"execução fiscal"'];
    const redesenharTags = () => {
      for (const k of ["termos", "procs", "oabs"]) {
        $(`[data-tags="${k}"]`, main).innerHTML = P[k].map((v, i) => `<span class="tag">${esc(v)}<button type="button" data-rm="${k}|${i}" aria-label="Remover ${esc(v)}">${ico("x")}</button></span>`).join("") || `<span class="nota">Nenhum cadastrado.</span>`;
      }
      const sug = SUGESTOES.filter((s) => !P.termos.includes(s)).slice(0, 5);
      $("#rd-sug", main).innerHTML = sug.length ? `<p class="nota" style="margin-top:10px">Sugestões:</p><div class="chips" style="margin-top:6px">${sug.map((s) => `<button type="button" class="chip" aria-pressed="false" data-sug='${esc(s)}'>${ico("mais1")} ${esc(s.replace(/"/g, ""))}</button>`).join("")}</div>` : "";
    };
    redesenharTags();
    $$("form.adicionar", main).forEach((f) => f.addEventListener("submit", (e) => {
      e.preventDefault();
      const k = f.dataset.lista, inp = $("input", f); let v = inp.value.trim(); if (!v) return;
      if (k === "oabs") { const o = normOAB(v); if (!o) return toast("Informe UF e número, por exemplo RS 12345."); v = o; }
      if (k === "procs" && !digitos(v)) return toast("Informe o número do processo.");
      if (!P[k].includes(v)) P[k].push(v);
      salvarP(); inp.value = ""; redesenharTags(); render(); atualizarContadorRadar();
    }));
    $(".radar-lado", main).addEventListener("click", (e) => {
      const s = e.target.closest("[data-sug]");
      if (s) { P.termos.push(s.dataset.sug); salvarP(); redesenharTags(); render(); atualizarContadorRadar(); return; }
      const b = e.target.closest("[data-rm]"); if (!b) return;
      const [k, i] = b.dataset.rm.split("|"); P[k].splice(+i, 1); salvarP(); redesenharTags(); render(); atualizarContadorRadar();
    });
    $("#rd-link").addEventListener("click", () => {
      const cod = btoa(unescape(encodeURIComponent(JSON.stringify({ termos: P.termos, procs: P.procs, oabs: P.oabs }))));
      copiar(`${location.origin}${location.pathname}#radar?importar=${encodeURIComponent(cod)}`, "Link do radar copiado.");
    });
    $$("[data-aba]", main).forEach((b) => b.addEventListener("click", () => { gravarHash("radar", { aba: b.dataset.aba === "salvos" ? "salvos" : "" }); vRadar(main, new URLSearchParams(b.dataset.aba === "salvos" ? "aba=salvos" : "")); }));
    $("#rd-tipo", main).addEventListener("change", (e) => { F.tipo = e.target.value; desenhar(); });
    $("#rd-termo", main).addEventListener("change", (e) => { F.termo = e.target.value; desenhar(); });
    $("#rd-nivel", main).addEventListener("click", (e) => { const b = e.target.closest("[data-nv]"); if (!b) return; F.nivel = b.dataset.nv; desenhar(); });
    $("#rd-areas", main).addEventListener("click", (e) => { const b = e.target.closest("[data-ar]"); if (!b) return; F.area = b.dataset.ar; desenhar(); });
    $("#rd-visto", main).addEventListener("click", () => { P.vistoEm = hojeISO(); salvarP(); atualizarContadorRadar(); render(); toast("Tudo marcado como visto."); });

    let lista = [], lim = 40;
    async function render() {
      const corpo = $("#rd-corpo", main);
      if (aba === "salvos") { $("#rd-filtros", main).hidden = true; $("#rd-visto", main).hidden = true; return renderSalvos(corpo); }
      if (!P.termos.length && !P.procs.length && !P.oabs.length) {
        $("#rd-filtros", main).hidden = true; $("#rd-visto", main).hidden = true;
        corpo.innerHTML = vazio("radar", "Seu radar está vazio", "Cadastre à esquerda os assuntos que você acompanha, ou toque em uma das sugestões. O site mostra o que surgiu, por prioridade, e marca o que é novo desde a sua última visita.");
        return;
      }
      corpo.innerHTML = esqueleto();
      const [t, pl] = await Promise.all([temas(), pautas()]);
      lista = await calcularRadar();
      for (const it of lista) if (it.tipo === "pauta" && it.obj.temas?.length) { const [tp, n] = it.obj.temas[0]; it.temaObj = t.idx.get(`${tp}-${n}`); }
      void pl;
      $("#rd-filtros", main).hidden = false; $("#rd-visto", main).hidden = false;
      $("#rd-termo", main).innerHTML = `<option value="">Todos os assuntos</option>` + [...new Set(lista.map((x) => x.termo))].map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
      $("#rd-termo", main).value = F.termo;
      lim = 40; desenhar();
    }
    function desenhar() {
      const base = lista.filter((x) => (!F.tipo || x.tipo === F.tipo) && (!F.termo || x.termo === F.termo));
      const cont = { alta: 0, rel: 0, acomp: 0 }; base.forEach((x) => cont[x.nivel]++);
      const novos = base.filter((x) => x.novo).length;
      $("#rd-nivel", main).innerHTML = [["", `Todos <span class="n">${base.length}</span>`], ["novo", `Novos <span class="n">${novos}</span>`], ["alta", `<span class="ponto alta"></span> Alta <span class="n">${cont.alta}</span>`], ["rel", `<span class="ponto rel"></span> Relevante <span class="n">${cont.rel}</span>`], ["acomp", `<span class="ponto acomp"></span> Acompanhar <span class="n">${cont.acomp}</span>`]]
        .map(([k, l2]) => `<button type="button" class="chip" data-nv="${k}" aria-pressed="${F.nivel === k}">${l2}</button>`).join("");
      const b2 = base.filter((x) => !F.nivel || (F.nivel === "novo" ? x.novo : x.nivel === F.nivel));
      const ca = {}; b2.forEach((x) => areasItem(x).forEach((a) => (ca[a] = (ca[a] || 0) + 1)));
      $("#rd-areas", main).innerHTML = `<button type="button" class="chip" data-ar="" aria-pressed="${!F.area}">Todas as matérias</button>` + Object.keys(AREAS).filter((a) => ca[a]).sort((a, b) => ca[b] - ca[a]).map((a) => `<button type="button" class="chip" data-ar="${a}" aria-pressed="${F.area === a}">${AREAS[a]} <span class="n">${ca[a]}</span></button>`).join("");
      const vis = b2.filter((x) => !F.area || areasItem(x).includes(F.area));
      const termos = [...new Set(vis.map((x) => x.termo))].flatMap((q) => Busca.compilar(q).termos);
      const corpo = $("#rd-corpo", main);
      corpo.innerHTML = `
        <div class="barra-res"><p><b>${fmtInt(vis.length)}</b> resultado(s) · novidades contadas desde ${fmtData(P.vistoEm)}</p></div>
        ${vis.length ? `<ol class="lista" id="rd-lista">${vis.slice(0, lim).map((x) => itemRadarLinha(x, termos)).join("")}</ol>${vis.length > lim ? `<button class="btn btn-claro btn-mais" id="rd-mais">Mostrar mais (${fmtInt(vis.length - lim)})</button>` : ""}` : vazio("radar", "Nada neste filtro", "Troque os filtros acima para ver os demais resultados.")}
        <p class="legenda" style="margin-top:12px"><span><span class="ponto alta"></span> tema em pauta ou movimentado há menos de 30 dias; processo seu em pauta; acórdão de alta relevância</span><span><span class="ponto rel"></span> tema em andamento; acórdão relevante; acórdão publicado no seu processo</span><span><span class="ponto acomp"></span> demais resultados</span></p>`;
      const ul = $("#rd-lista", main); if (ul) ligarCards(ul);
      $("#rd-mais", main)?.addEventListener("click", () => { lim += 40; desenhar(); });
    }
    function renderSalvos(corpo) {
      const s = Object.values(P.salvos).sort((a, b) => (b.salvoEm || "").localeCompare(a.salvoEm || ""));
      if (!s.length) { corpo.innerHTML = vazio("salvar", "Nenhum item salvo", "Use o botão de marcador nos acórdãos e temas para guardar os precedentes que você quer ter à mão."); return; }
      corpo.innerHTML = `<ol class="lista" id="rd-salvos"></ol>`;
      const ul = $("#rd-salvos", main);
      temas().then((t) => {
        ul.innerHTML = s.map((x) => x.k === "t" ? (t.idx.get(`${x.tp}-${x.n}`) ? linhaTema(t.idx.get(`${x.tp}-${x.n}`)) : "") : cardAcordao({ ...x, em: "", h: x.h })).join("");
      });
      ligarCards(ul);
    }
    render();
  }

  // ============================================================ DESTAQUES
  function campoBusca(id, ph, valor = "") {
    return `<div class="campo-busca">${ico("pesquisa")}<input id="${id}" type="search" placeholder='${esc(ph)}' value="${esc(valor)}" autocomplete="off" spellcheck="false">
      <button type="button" class="btn-ajuda" data-ajuda aria-expanded="false" title="Como pesquisar">?</button></div>`;
  }
  async function vDestaques(main, p) {
    const ds = await destaques();
    const meses = [...new Set(ds.map((r) => r.dj.slice(0, 7)))].sort().reverse();
    const f = { a: p.get("a") || "", m: p.get("m") || (meses[0] || ""), o: p.get("o") || "", n: p.get("n") || "", q: p.get("q") || "", t: p.get("t") === "1" };
    const porMes = D.man.meses[0] ? Object.values(D.man.meses[0].orgaos).reduce((s, x) => s + x.n, 0) : 0;
    main.innerHTML = `
      <p class="aviso info">${ico("sobre")}<span>Dos cerca de ${fmtInt(Math.round(porMes / 100) * 100)} acórdãos publicados por mês, aqui ficam os que reúnem sinais de relevância: Corte Especial ou Seção, tese, rito repetitivo, embargos de divergência, afetação, superação de entendimento. A rotina (Súmula 7, embargos rejeitados) fica de fora. <a href="#sobre">Como funciona</a></span></p>
      <div class="card card-pad" style="margin-top:14px" id="ds-f">
        <div class="barra-filtros">
          ${campoBusca("ds-q", 'Filtrar por termos. Ex.: "bem de família" ou impenhorab$', f.q)}
          <select id="ds-m" class="sel-auto" aria-label="Mês">${meses.map((m) => `<option value="${m}">${fmtMesL(m)}</option>`).join("")}<option value="todos">Últimos 3 meses</option></select>
          <select id="ds-o" class="sel-auto" aria-label="Órgão"><option value="">Todos os órgãos</option><option value="sup">Corte Especial e Seções</option><option value="turmas">Turmas</option></select>
          <select id="ds-n" class="sel-auto" aria-label="Nível"><option value="">Relevantes e alta</option><option value="alta">Só alta relevância</option></select>
        </div>
        ${AJUDA_BUSCA}
        <div class="barra-filtros" style="margin-top:12px"><label class="alternar"><input type="checkbox" id="ds-t"><span class="trilho"></span>Só com tese</label></div>
        <div class="chips rolagem" id="ds-areas" style="margin-top:12px"></div>
      </div>
      <div class="barra-res"><p id="ds-info"></p></div>
      <ol class="lista" id="ds-lista"></ol>
      <button class="btn btn-claro btn-mais" id="ds-mais" hidden>Mostrar mais</button>`;
    $("#ds-m").value = f.m; $("#ds-o").value = f.o; $("#ds-n").value = f.n; $("#ds-t").checked = f.t;
    const ul = $("#ds-lista"); ligarCards(ul);
    let lista = [], mostrados = 0, termos = [];
    const render = (reset) => {
      if (reset) { ul.innerHTML = ""; mostrados = 0; }
      const lote = lista.slice(mostrados, mostrados + 20);
      ul.insertAdjacentHTML("beforeend", lote.map((r) => cardAcordao(r, { termos })).join(""));
      mostrados += lote.length;
      if (!lista.length) ul.innerHTML = vazio("destaques", "Nenhum destaque com esses filtros", "Tente outra matéria, amplie o período ou revise os termos.");
      const b = $("#ds-mais"); b.hidden = mostrados >= lista.length; b.textContent = `Mostrar mais (${fmtInt(lista.length - mostrados)})`;
    };
    const aplicar = () => {
      f.q = $("#ds-q").value; f.m = $("#ds-m").value; f.o = $("#ds-o").value; f.n = $("#ds-n").value; f.t = $("#ds-t").checked;
      gravarHash("destaques", { ...f, m: f.m === meses[0] ? "" : f.m });
      const c = Busca.compilar(f.q); termos = c.termos;
      const base = ds.filter((r) => (f.m === "todos" || r.dj.startsWith(f.m)) && (!f.o || (f.o === "sup" ? !r.o.endsWith("turma") : r.o.endsWith("turma"))) && (!f.n || r.s >= 10)
        && (!f.t || r.tese || r.tj) && (c.vazio || c.testa(r._n || (r._n = norm([r.em, r.tese, r.tj, r.tema, r.notas].join("\n"))))));
      const cont = {}; base.forEach((r) => (r.ar || []).forEach((a) => (cont[a] = (cont[a] || 0) + 1)));
      $("#ds-areas").innerHTML = `<button type="button" class="chip" data-ar="" aria-pressed="${!f.a}">Todas as matérias</button>` +
        Object.keys(AREAS).filter((a) => cont[a] || f.a === a).sort((a, b) => (cont[b] || 0) - (cont[a] || 0)).map((a) => `<button type="button" class="chip" data-ar="${a}" aria-pressed="${f.a === a}">${AREAS[a]} <span class="n">${cont[a] || 0}</span></button>`).join("");
      lista = agrupar(base.filter((r) => !f.a || (r.ar || []).includes(f.a))).sort((a, b) => (b.s - a.s) || b.dj.localeCompare(a.dj));
      $("#ds-info").innerHTML = `<b>${fmtInt(lista.length)}</b> destaque(s)${f.m && f.m !== "todos" ? ` em ${fmtMesL(f.m)}` : " nos últimos 3 meses"} · por relevância ${explicacaoHTML(c)}`;
      render(true);
    };
    $("#ds-areas").addEventListener("click", (e) => { const b = e.target.closest("[data-ar]"); if (!b) return; f.a = b.dataset.ar; aplicar(); });
    $("#ds-q").addEventListener("input", debounce(aplicar, 250));
    ["#ds-m", "#ds-o", "#ds-n", "#ds-t"].forEach((s) => $(s).addEventListener("change", aplicar));
    $("#ds-mais").addEventListener("click", () => render(false));
    ligarAjuda($("#ds-f"), $("#ds-q"), aplicar);
    aplicar();
  }

  // ============================================================= PESQUISA
  async function vPesquisa(main, p, mesma) {
    if (!mesma || !$("#ac-q")) {
      const meses = D.man.meses;
      main.innerHTML = `
        <div class="card card-pad" id="ac-f">
          <div class="barra-filtros">
            ${campoBusca("ac-q", 'Termos da ementa ou da tese. Ex.: "prova oral" e nulidade')}
            <select id="ac-periodo" class="sel-auto" aria-label="Período">${[["u1", `Último mês (${meses[0] ? fmtMes(meses[0].m) : "—"})`], ["u3", "Últimos 3 meses"], ["u6", "Últimos 6 meses"], ["u12", "Últimos 12 meses"]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}<optgroup label="Mês">${meses.map((m) => `<option value="${m.m}">${fmtMesL(m.m)}</option>`).join("")}</optgroup></select>
            <button type="button" class="btn btn-claro" id="ac-mais-f" aria-expanded="false">${ico("filtro")} Filtros <span id="ac-nf"></span></button>
          </div>
          ${AJUDA_BUSCA}
          <div class="painel-filtros fechado" id="ac-pf"><div>
            <div class="grade-filtros" style="padding-top:12px">
              <div class="campo"><label for="ac-orgao">Órgão julgador</label><select id="ac-orgao"><option value="">Todos</option>${Object.entries(D.orgaos).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></div>
              <div class="campo"><label for="ac-area">Matéria</label><select id="ac-area"><option value="">Todas</option>${Object.entries(AREAS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></div>
              <div class="campo"><label for="ac-classe">Classe</label><input id="ac-classe" list="ac-classes" placeholder="REsp, AgInt, EREsp"><datalist id="ac-classes"></datalist></div>
              <div class="campo"><label for="ac-rel">Relator(a)</label><input id="ac-rel" list="ac-rels" placeholder="Nome"><datalist id="ac-rels"></datalist></div>
              <div class="campo"><label for="ac-proc">Número do processo</label><input id="ac-proc" inputmode="numeric" placeholder="Ex.: 2222623"></div>
              <div class="campo"><label for="ac-ordem">Ordenar por</label><select id="ac-ordem"><option value="auto">Automático</option><option value="rel">Relevância</option><option value="data">Mais recentes</option><option value="julg">Data de julgamento</option></select></div>
            </div>
          </div></div>
          <div class="barra-filtros" style="margin-top:12px;gap:18px">
            <label class="alternar"><input type="checkbox" id="ac-rotina" checked><span class="trilho"></span>Ocultar decisões de rotina</label>
            <label class="alternar"><input type="checkbox" id="ac-tese"><span class="trilho"></span>Só com tese</label>
            <label class="alternar"><input type="checkbox" id="ac-dest"><span class="trilho"></span>Só destaques</label>
          </div>
        </div>
        <div class="barra-res"><p id="ac-info" aria-live="polite"></p><div class="progresso" id="ac-prog" hidden><i></i></div>
          <button type="button" class="btn btn-fant btn-peq" id="ac-link">${ico("link")} Copiar link da pesquisa</button></div>
        <ol class="lista" id="ac-lista"></ol>
        <button class="btn btn-claro btn-mais" id="ac-mais" hidden>Mostrar mais</button>`;
      const rodar = debounce(() => buscar(), 300);
      ["#ac-q", "#ac-classe", "#ac-rel", "#ac-proc"].forEach((s) => $(s).addEventListener("input", rodar));
      ["#ac-periodo", "#ac-orgao", "#ac-area", "#ac-ordem", "#ac-rotina", "#ac-dest", "#ac-tese"].forEach((s) => $(s).addEventListener("change", () => buscar()));
      $("#ac-mais-f").addEventListener("click", (e) => { const pf = $("#ac-pf"); pf.classList.toggle("fechado"); e.currentTarget.setAttribute("aria-expanded", String(!pf.classList.contains("fechado"))); });
      $("#ac-link").addEventListener("click", () => copiar(location.href, "Link copiado."));
      $("#ac-mais").addEventListener("click", () => renderLista(false));
      ligarCards($("#ac-lista"));
      ligarAjuda($("#ac-f"), $("#ac-q"), () => buscar());
    }
    $("#ac-q").value = p.get("q") || "";
    $("#ac-periodo").value = p.get("p") || "u1"; if (!$("#ac-periodo").value) $("#ac-periodo").value = "u1";
    $("#ac-orgao").value = p.get("o") || "";
    $("#ac-area").value = p.get("a") || "";
    $("#ac-classe").value = p.get("c") || "";
    $("#ac-rel").value = p.get("rl") || "";
    $("#ac-proc").value = p.get("n") || "";
    $("#ac-ordem").value = p.get("s") || "auto";
    $("#ac-rotina").checked = p.get("r") !== "0";
    $("#ac-dest").checked = p.get("x") === "1";
    $("#ac-tese").checked = p.get("t") === "1";
    const nf = ["#ac-orgao", "#ac-area", "#ac-classe", "#ac-rel", "#ac-proc"].filter((s) => $(s).value).length;
    if (nf) $("#ac-pf").classList.remove("fechado");
    if (p.get("foco")) setTimeout(() => $("#ac-q").focus(), 50);
    await buscar();
  }
  const AC = { lista: [], mostrados: 0, termos: [], token: 0, dl: false };
  async function buscar() {
    const tk = ++AC.token;
    const f = { q: $("#ac-q").value, p: $("#ac-periodo").value, o: $("#ac-orgao").value, a: $("#ac-area").value, c: $("#ac-classe").value.trim(), rl: $("#ac-rel").value.trim(), n: digitos($("#ac-proc").value), s: $("#ac-ordem").value, r: $("#ac-rotina").checked, x: $("#ac-dest").checked, t: $("#ac-tese").checked };
    gravarHash("pesquisa", { ...f, p: f.p === "u1" ? "" : f.p, s: f.s === "auto" ? "" : f.s, r: f.r ? "" : "0", x: f.x, t: f.t });
    const nf = [f.o, f.a, f.c, f.rl, f.n].filter(Boolean).length;
    $("#ac-nf").textContent = nf ? `(${nf})` : "";
    const todos = D.man.meses.map((m) => m.m);
    const meses = /^\d{4}-\d{2}$/.test(f.p) ? [f.p] : todos.slice(0, +(/^u(\d+)$/.exec(f.p)?.[1] || 1));
    const orgs = f.o ? [f.o] : Object.keys(D.orgaos);
    const pares = [];
    for (const m of meses) { const info = D.man.meses.find((x) => x.m === m); for (const o of orgs) if (info?.orgaos[o]) pares.push([m, o]); }
    const pend = pares.filter(([m, o]) => !D.shards.has(`${m}/${o}`)).length;
    const prog = $("#ac-prog");
    if (pend) { prog.hidden = false; prog.firstElementChild.style.width = "0"; $("#ac-info").textContent = `Carregando ${pares.length} arquivo(s)…`; }
    const dados = await carregarShards(pares, (a, b) => { if (tk === AC.token) prog.firstElementChild.style.width = `${(a / b) * 100}%`; });
    if (tk !== AC.token) return;
    prog.hidden = true;
    const cons = Busca.compilar(f.q);
    const cN = norm(f.c), rN = norm(f.rl);
    const reCl = cN ? new RegExp(`(^|\\s)${reEsc(cN)}(\\s|$)`) : null;
    const temTexto = !cons.vazio;
    const res = [];
    for (const r of dados) {
      const sc0 = r.s ?? 0;
      if (f.n && !(String(r.n).includes(f.n) || String(r.reg).includes(f.n))) continue;
      if (f.r && !f.n && sc0 <= (temTexto ? -3 : -2)) continue;
      if (f.x && sc0 < 6) continue;
      if (f.t && !r.tese && !r.tj) continue;
      if (f.a && !(r.ar || []).includes(f.a)) continue;
      if (reCl && !reCl.test(norm(r.cl))) continue;
      if (rN && !norm(r.rel).includes(rN)) continue;
      if (temTexto) {
        if (r._n === undefined) r._n = norm([r.em, r.tese, r.tj, r.tema, r.notas, r.info, (r.leg || []).join(" ")].join("\n"));
        if (!cons.testa(r._n)) continue;
        const i = r._n.indexOf("\n");
        r._sc = cons.pontua(r._n, r._n.slice(0, i > 0 ? i : 400)) + Math.max(0, sc0) * 0.6 + (r.tese || r.tj ? 1 : 0);
      } else r._sc = sc0;
      res.push(r);
    }
    const ordem = f.s === "auto" ? (temTexto ? "rel" : "data") : f.s;
    const ord = {
      data: (a, b) => (b.dj || "").localeCompare(a.dj || "") || (b.s ?? 0) - (a.s ?? 0),
      julg: (a, b) => (b.dd || "").localeCompare(a.dd || ""),
      rel: (a, b) => (b._sc || 0) - (a._sc || 0) || (b.dj || "").localeCompare(a.dj || ""),
    }[ordem];
    res.sort(ord);
    AC.lista = agrupar(res.map((r) => Object.assign(r, { _dup: [] }))); AC.termos = cons.termos;
    const rot = meses.length === 1 ? fmtMesL(meses[0]) : `${fmtMes(meses[meses.length - 1])} a ${fmtMes(meses[0])}`;
    $("#ac-info").innerHTML = `<b>${fmtInt(AC.lista.length)}</b> resultado(s) · ${rot}${f.r ? " · rotina oculta" : ""} · ${ordem === "rel" ? "por relevância" : ordem === "julg" ? "por data de julgamento" : "mais recentes primeiro"} ${explicacaoHTML(cons)}`;
    renderLista(true);
    if (!AC.dl) {
      AC.dl = true;
      const cls = new Map(), rels = new Set();
      for (const r of dados) { cls.set(r.cl, (cls.get(r.cl) || 0) + 1); rels.add(r.rel); }
      $("#ac-classes").innerHTML = [...cls].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([c]) => `<option value="${esc(c)}">`).join("");
      $("#ac-rels").innerHTML = [...rels].sort().map((r) => `<option value="${esc(titulo(r))}">`).join("");
    }
  }
  function renderLista(reset) {
    const ul = $("#ac-lista");
    if (reset) { ul.innerHTML = ""; AC.mostrados = 0; }
    const lote = AC.lista.slice(AC.mostrados, AC.mostrados + 20);
    ul.insertAdjacentHTML("beforeend", lote.map((r) => cardAcordao(r, { termos: AC.termos })).join(""));
    AC.mostrados += lote.length;
    if (!AC.lista.length) ul.innerHTML = vazio("pesquisa", "Nenhum acórdão encontrado", "Amplie o período, desligue “Ocultar decisões de rotina” ou revise os termos. Toque em “?” para ver como combinar palavras.");
    const b = $("#ac-mais"); b.hidden = AC.mostrados >= AC.lista.length; b.textContent = `Mostrar mais (${fmtInt(AC.lista.length - AC.mostrados)})`;
  }

  // ========================================================== REPETITIVOS
  async function vRepetitivos(main, p) {
    const [t, pt, pl] = await Promise.all([temas(), procTemas(), pautas()]);
    const emPauta = temasEmPauta(pl);
    const ufs = new Map();
    for (const x of pt.lista) if (x.uf) { const k = `${x.tp}-${x.n}`; if (!ufs.has(k)) ufs.set(k, new Set()); ufs.get(k).add(x.uf); }
    const todasUF = [...new Set(pt.lista.map((x) => x.uf).filter(Boolean))].sort();
    const f = { q: p.get("q") || "", tipo: p.has("tipo") ? (p.get("tipo") === "todos" ? "" : p.get("tipo")) : "Tema", sit: p.get("sit") || "", org: p.get("org") || "", uf: p.get("uf") || "", a: p.get("a") || "", susp: p.get("susp") === "1", pauta: p.get("pauta") === "1", s: p.get("s") || "mov" };
    main.innerHTML = `
      <div class="card card-pad" id="rp-f">
        <div class="barra-filtros">
          ${campoBusca("rp-q", 'Questão, tese ou assunto. Ex.: "prescrição intercorrente" ou o número do tema', f.q)}
          <select id="rp-tipo" class="sel-auto" aria-label="Tipo"><option value="Tema">Temas repetitivos</option><option value="Controvérsia">Controvérsias</option><option value="IAC">IAC</option><option value="SIRDR">SIRDR</option><option value="PUIL">PUIL</option><option value="">Todos os tipos</option></select>
          <select id="rp-org" class="sel-auto" aria-label="Órgão"><option value="">Todos os órgãos</option><option>Corte Especial</option><option>Primeira Seção</option><option>Segunda Seção</option><option>Terceira Seção</option></select>
          <select id="rp-uf" class="sel-auto" aria-label="UF de origem"><option value="">Qualquer origem</option>${todasUF.map((u) => `<option>${u}</option>`).join("")}</select>
          <select id="rp-s" class="sel-auto" aria-label="Ordenar"><option value="mov">Última movimentação</option><option value="num">Número</option></select>
        </div>
        ${AJUDA_BUSCA}
        <div class="chips rolagem" id="rp-areas" style="margin-top:12px"></div>
        <div class="barra-filtros" style="margin-top:12px;justify-content:space-between">
          <div class="chips" id="rp-sit"></div>
          <div class="barra-filtros" style="gap:18px">
            <label class="alternar"><input type="checkbox" id="rp-pauta"><span class="trilho"></span>Em pauta</label>
            <label class="alternar"><input type="checkbox" id="rp-susp"><span class="trilho"></span>Com suspensão</label>
          </div>
        </div>
      </div>
      <div class="barra-res"><p id="rp-info"></p><button type="button" class="btn btn-fant btn-peq" id="rp-link">${ico("link")} Copiar link</button></div>
      <ol class="lista" id="rp-lista"></ol>
      <button class="btn btn-claro btn-mais" id="rp-mais" hidden>Mostrar mais</button>`;
    $("#rp-tipo").value = f.tipo; $("#rp-org").value = f.org; $("#rp-uf").value = f.uf; $("#rp-s").value = f.s; $("#rp-susp").checked = f.susp; $("#rp-pauta").checked = f.pauta;
    let lista = [], mostrados = 0, termos = [];
    const render = (reset) => {
      const ul = $("#rp-lista");
      if (reset) { ul.innerHTML = ""; mostrados = 0; }
      const lote = lista.slice(mostrados, mostrados + 25);
      ul.insertAdjacentHTML("beforeend", lote.map((x) => {
        const pts = emPauta.get(`${x.tp}-${x.n}`);
        const ex = `${pts ? `<span class="selo alta">Em pauta ${fmtData(pts[0].d)}</span>` : ""}${/suspens/i.test(x.info || "") && x._g === "andamento" ? `<span class="selo rel">Suspensão</span>` : ""}`;
        return linhaTema(x, ex, termos);
      }).join(""));
      mostrados += lote.length;
      if (!lista.length) ul.innerHTML = vazio("repetitivos", "Nenhum registro encontrado", "Revise os filtros ou os termos da pesquisa.");
      const b = $("#rp-mais"); b.hidden = mostrados >= lista.length; b.textContent = `Mostrar mais (${fmtInt(lista.length - mostrados)})`;
    };
    const aplicar = () => {
      f.q = $("#rp-q").value; f.tipo = $("#rp-tipo").value; f.org = $("#rp-org").value; f.uf = $("#rp-uf").value; f.s = $("#rp-s").value; f.susp = $("#rp-susp").checked; f.pauta = $("#rp-pauta").checked;
      gravarHash("repetitivos", { ...f, tipo: f.tipo === "Tema" ? "" : f.tipo || "todos", s: f.s === "mov" ? "" : f.s });
      const qT = f.q.trim(); const numero = /^\d+$/.test(qT) ? +qT : null;
      const c = numero != null ? Busca.compilar("") : Busca.compilar(f.q); termos = c.termos;
      const base = t.filter((x) => (!f.tipo || x.tp === f.tipo) && (!f.org || x.org === f.org) && (!f.uf || ufs.get(`${x.tp}-${x.n}`)?.has(f.uf))
        && (!f.susp || /suspens/i.test(x.info || "")) && (!f.pauta || emPauta.has(`${x.tp}-${x.n}`))
        && (numero != null ? x.n === numero : c.testa(x._n)));
      const ca = {}; base.forEach((x) => (x.ar || []).forEach((a) => (ca[a] = (ca[a] || 0) + 1)));
      $("#rp-areas").innerHTML = `<button type="button" class="chip" data-ar="" aria-pressed="${!f.a}">Todas as matérias</button>` + Object.keys(AREAS).filter((a) => ca[a] || f.a === a).sort((a, b) => (ca[b] || 0) - (ca[a] || 0)).map((a) => `<button type="button" class="chip" data-ar="${a}" aria-pressed="${f.a === a}">${AREAS[a]} <span class="n">${fmtInt(ca[a] || 0)}</span></button>`).join("");
      const b2 = base.filter((x) => !f.a || (x.ar || []).includes(f.a));
      const cont = { andamento: 0, julgado: 0, cancelado: 0 }; b2.forEach((x) => cont[x._g] !== undefined && cont[x._g]++);
      $("#rp-sit").innerHTML = [["", "Todas", b2.length], ["andamento", "Em andamento", cont.andamento], ["julgado", "Julgados", cont.julgado], ["cancelado", "Cancelados/revisados", cont.cancelado]]
        .map(([k, l, n]) => `<button type="button" class="chip" data-sit="${k}" aria-pressed="${f.sit === k}">${l} <span class="n">${fmtInt(n)}</span></button>`).join("");
      lista = b2.filter((x) => !f.sit || x._g === f.sit);
      lista.sort(f.s === "num" ? (a, b) => b.n - a.n : (a, b) => (b._mov || "").localeCompare(a._mov || "") || b.n - a.n);
      $("#rp-info").innerHTML = `<b>${fmtInt(lista.length)}</b> registro(s) ${explicacaoHTML(c)}`;
      render(true);
    };
    $("#rp-sit").addEventListener("click", (e) => { const b = e.target.closest("[data-sit]"); if (!b) return; f.sit = b.dataset.sit; aplicar(); });
    $("#rp-areas").addEventListener("click", (e) => { const b = e.target.closest("[data-ar]"); if (!b) return; f.a = b.dataset.ar; aplicar(); });
    $("#rp-q").addEventListener("input", debounce(aplicar, 200));
    ["#rp-tipo", "#rp-org", "#rp-uf", "#rp-s", "#rp-susp", "#rp-pauta"].forEach((s) => $(s).addEventListener("change", aplicar));
    $("#rp-mais").addEventListener("click", () => render(false));
    $("#rp-link").addEventListener("click", () => copiar(location.href, "Link copiado."));
    ligarAjuda($("#rp-f"), $("#rp-q"), aplicar);
    aplicar();
    const ab = p.get("abrir"); if (ab) { const i = ab.lastIndexOf("-"); abrirTema(ab.slice(0, i), +ab.slice(i + 1)); }
  }

  // =============================================================== PAUTAS
  async function vPautas(main, p) {
    const aba = p.get("aba") === "djen" ? "djen" : "pautas";
    main.innerHTML = `
      <div class="segmentos" role="tablist" style="margin-bottom:14px">
        <button type="button" role="tab" data-aba="pautas" aria-selected="${aba === "pautas"}">Próximas sessões</button>
        <button type="button" role="tab" data-aba="djen" aria-selected="${aba === "djen"}">Publicados no DJEN</button>
      </div><div id="pt-corpo"></div>`;
    $$("[data-aba]", main).forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.aba === "djen" ? "#pautas?aba=djen" : "#pautas"; }));
    if (aba === "djen") return vDjen($("#pt-corpo"), p);
    const pl = await pautas();
    const corpo = $("#pt-corpo");
    const dias = [...new Set(pl.map((x) => x.d))].sort();
    const f = { q: p.get("q") || "", o: p.get("o") || "", d: p.get("d") || "", rel: p.get("rel") === "1" };
    corpo.innerHTML = `
      <div class="card card-pad">
        <div class="barra-filtros">
          <div class="campo-busca">${ico("pesquisa")}<input id="pt-q" type="search" placeholder="Processo, OAB (RS 12345) ou nome do advogado" value="${esc(f.q)}"></div>
          <select id="pt-o" class="sel-auto" aria-label="Órgão"><option value="">Todos os órgãos</option>${Object.entries(D.orgaos).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
          <label class="alternar"><input type="checkbox" id="pt-rel"><span class="trilho"></span>Só relevantes</label>
        </div>
        <div class="chips rolagem" id="pt-dias" style="margin-top:12px"></div>
      </div>
      <p class="aviso info" style="margin-top:12px">${ico("sobre")}<span>Pautas publicadas pelo STJ (arquivo de ${fmtData(`${String(D.man.pautas?.arquivo || "").slice(0, 4)}-${String(D.man.pautas?.arquivo || "").slice(4, 6)}-${String(D.man.pautas?.arquivo || "").slice(6, 8)}`)}). “Relevantes” reúne processos vinculados a precedentes qualificados, embargos de divergência e julgamentos das Seções e da Corte Especial. Por privacidade, o site não exibe os nomes das partes; processos em segredo de justiça aparecem sem advogados.</span></p>
      <div class="barra-res"><p id="pt-info"></p></div>
      <div id="pt-lista"></div>
      <button class="btn btn-claro btn-mais" id="pt-mais" hidden>Mostrar mais</button>`;
    $("#pt-o").value = f.o; $("#pt-rel").checked = f.rel;
    let lista = [], lim = 150, termoOAB = "", qN = "";
    const render = () => {
      const vis = lista.slice(0, lim);
      const porDia = new Map(); vis.forEach((x) => { if (!porDia.has(x.d)) porDia.set(x.d, []); porDia.get(x.d).push(x); });
      $("#pt-lista").innerHTML = vis.length ? [...porDia].map(([d, l]) => `
        <section class="dia"><div class="dia-cab"><h3>${fmtDiaL(d)}</h3><span>${fmtInt(lista.filter((x) => x.d === d).length)} processo(s)</span></div>
          <div class="card tabela-wrap"><table class="tabela"><thead><tr><th>Processo</th><th>Órgão</th><th>Relator(a)</th><th>Observações</th><th></th></tr></thead><tbody>
          ${l.map((x) => {
            const advM = termoOAB || qN ? (x.adv || []).filter((a) => a[0] === termoOAB || (qN && norm(a[1]).includes(qN))) : [];
            return `<tr><td class="num">${esc(x.p)}${x.pet ? `<div class="sub">${esc(x.pet)}</div>` : ""}</td><td>${esc(D.orgaos[x.o] || "")}</td><td>${esc(x.rel || "")}</td>
              <td>${x.temas?.length ? x.temas.map(([tp, n]) => `<a class="selo alta" href="#repetitivos?abrir=${encodeURIComponent(tp)}-${n}">${esc(tp)} ${n}</a>`).join(" ") : ""}${/^(EREsp|EAREsp)/.test(x.cl) ? ' <span class="selo pri">Divergência</span>' : ""}${x.seg ? ' <span class="selo canc">Segredo de justiça</span>' : ""}${advM.length ? `<div class="sub">${advM.map((a) => `${esc(titulo(a[1]))} (${esc(a[0])})`).join("; ")}</div>` : ""}</td>
              <td class="links"><a href="${URLS.processo(x.reg)}" target="_blank" rel="noopener">Processo</a></td></tr>`;
          }).join("")}</tbody></table></div></section>`).join("") : vazio("pautas", "Nenhum processo encontrado", "Revise os filtros. Para localizar seus processos, pesquise pela OAB ou pelo número.");
      $("#pt-mais").hidden = lista.length <= lim;
    };
    const aplicar = () => {
      f.q = $("#pt-q").value.trim(); f.o = $("#pt-o").value; f.rel = $("#pt-rel").checked;
      gravarHash("pautas", f);
      termoOAB = /^[A-Za-z]{2}\s*[-/ ]?\s*\d{1,6}[A-Za-z]?$/.test(f.q) ? normOAB(f.q) : "";
      const nd = digitos(f.q); qN = !termoOAB && !/^\d+$/.test(f.q.replace(/[\s.-]/g, "")) ? norm(f.q) : "";
      const base = pl.filter((x) => (!f.o || x.o === f.o) && (!f.rel || f.q || x.s >= 3)
        && (!f.q || (termoOAB ? (x.adv || []).some((a) => a[0] === termoOAB) : /^\d+$/.test(f.q.replace(/[\s./-]/g, "")) ? (x.reg === nd || digitos(x.p) === nd || digitos(x.p).includes(nd)) : x._b.includes(qN))));
      const cont = {}; base.forEach((x) => (cont[x.d] = (cont[x.d] || 0) + 1));
      $("#pt-dias").innerHTML = `<button type="button" class="chip" data-d="" aria-pressed="${!f.d}">Todas as datas <span class="n">${fmtInt(base.length)}</span></button>` + dias.filter((d) => cont[d]).map((d) => `<button type="button" class="chip" data-d="${d}" aria-pressed="${f.d === d}">${fmtData(d).slice(0, 5)} <span class="n">${cont[d]}</span></button>`).join("");
      lista = base.filter((x) => !f.d || x.d === f.d);
      $("#pt-info").innerHTML = `<b>${fmtInt(lista.length)}</b> processo(s) em pauta${f.rel && !f.q ? " · só relevantes" : f.q ? " · busca em todas as pautas" : ""}`;
      lim = 150; render();
    };
    $("#pt-dias").addEventListener("click", (e) => { const b = e.target.closest("[data-d]"); if (!b) return; f.d = b.dataset.d; aplicar(); });
    $("#pt-q").addEventListener("input", debounce(aplicar, 250));
    ["#pt-o", "#pt-rel"].forEach((s) => $(s).addEventListener("change", aplicar));
    $("#pt-mais").addEventListener("click", () => { lim += 150; render(); });
    aplicar();
  }
  async function vDjen(corpo, p) {
    const rad = await djen();
    const dias = [...new Set(rad.map((x) => x.d))].sort().reverse();
    corpo.innerHTML = `
      <div class="card card-pad"><div class="barra-filtros">
        <div class="campo-busca">${ico("pesquisa")}<input id="dj-q" type="search" placeholder="Classe ou número do processo"></div>
        <select id="dj-d" class="sel-auto" aria-label="Data"><option value="">Todas as datas</option>${dias.map((d) => `<option value="${d}">${fmtData(d)}</option>`).join("")}</select>
        <select id="dj-t" class="sel-auto" aria-label="Turma"><option value="">Qualquer Turma</option>${Object.entries(D.orgaos).filter(([k]) => k.endsWith("turma")).map(([k, v]) => `<option value="${k}">${esc(v)} (aprox.)</option>`).join("")}</select>
        <input id="dj-r" class="sel-auto" list="dj-rels" placeholder="Relator(a)" style="max-width:220px"><datalist id="dj-rels">${[...new Set(rad.map((x) => x.rel))].sort().map((r) => `<option value="${esc(titulo(r))}">`).join("")}</datalist>
      </div></div>
      <p class="aviso" style="margin-top:12px">${ico("alerta")}<span>Acórdãos publicados no Diário da Justiça nos últimos dias disponíveis na base diária do STJ, que chega com cerca de duas semanas de atraso. A base não traz ementa nem órgão julgador; a Turma é estimada pelo relator.</span></p>
      <div class="barra-res"><p id="dj-info"></p></div>
      <div class="card tabela-wrap"><table class="tabela"><thead><tr><th>Publicação</th><th>Processo</th><th>Recurso</th><th>Relator(a)</th><th>Resultado</th><th></th></tr></thead><tbody id="dj-tb"></tbody></table></div>
      <button class="btn btn-claro btn-mais" id="dj-mais" hidden>Mostrar mais</button>`;
    let lista = [], lim = 100;
    const render = () => {
      $("#dj-tb").innerHTML = lista.slice(0, lim).map((x) => `<tr><td>${fmtData(x.d)}</td><td class="num">${esc(x.p)}</td><td>${esc(x.r || "—")}</td><td>${esc(relatorFmt(x.rel))}${x.tr ? `<div class="sub">${esc(D.orgaos[x.tr])} (aprox.)</div>` : ""}</td><td>${esc(x.t || "—")}</td><td class="links"><a href="${URLS.inteiroTeor(x.reg, x.d)}" target="_blank" rel="noopener">Inteiro teor</a></td></tr>`).join("") || `<tr><td colspan="6" class="sub">Nenhum resultado.</td></tr>`;
      $("#dj-mais").hidden = lista.length <= lim;
    };
    const aplicar = () => {
      const q = norm($("#dj-q").value).split(/\s+/).filter(Boolean), d = $("#dj-d").value, t = $("#dj-t").value, r = norm($("#dj-r").value.trim());
      lista = rad.filter((x) => (!d || x.d === d) && (!t || x.tr === t) && (!r || norm(x.rel).includes(r)) && q.every((w) => x._p.includes(w)));
      $("#dj-info").innerHTML = `<b>${fmtInt(lista.length)}</b> acórdão(s)`; lim = 100; render();
    };
    ["#dj-q", "#dj-r"].forEach((s) => $(s).addEventListener("input", debounce(aplicar, 200)));
    ["#dj-d", "#dj-t"].forEach((s) => $(s).addEventListener("change", aplicar));
    $("#dj-mais").addEventListener("click", () => { lim += 100; render(); });
    aplicar();
  }

  // ======================================================= VERIFICAR PETIÇÃO
  const STOP = new Set("para pela pelo pelos pelas como mais menos entre sobre quando onde qual quais que isso esta este essa esse aquela aquele sendo seria sera será foram tambem também ainda apenas desde assim porque pois sem com dos das nos nas aos numa num uma umas uns ser ter tem sua seu suas seus lhe lhes cujo cuja artigo art arts inciso lei nao não sim caso fato fatos parte partes autos recurso recursos especial acordao acórdão tribunal justica justiça superior stj direito direitos processo processos acao ação sentenca sentença decisao decisão juizo juízo pedido pedidos presente conforme razao razão modo forma termos devera deverá deve devem pode podem houve haver sido tendo deste desta disso nesse neste".split(" "));
  const tokens = (s) => norm(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w));
  let TFIDF = null;
  async function indiceTemas() {
    if (TFIDF) return TFIDF;
    const t = await temas();
    const docs = t.filter((x) => (x.tp === "Tema" || x.tp === "IAC") && (x.q || x.tese));
    const df = new Map();
    const vecs = docs.map((x) => { const tf = new Map(); for (const w of tokens(`${x.q} ${x.tese || ""} ${x.ass || ""}`)) tf.set(w, (tf.get(w) || 0) + 1); for (const w of tf.keys()) df.set(w, (df.get(w) || 0) + 1); return tf; });
    const N = docs.length;
    const idf = (w) => Math.log((N + 1) / ((df.get(w) || 0) + 1)) + 1;
    const pesos = vecs.map((tf) => { const v = new Map(); let n2 = 0; for (const [w, c] of tf) { const p = (1 + Math.log(c)) * idf(w); v.set(w, p); n2 += p * p; } return { v, n: Math.sqrt(n2) || 1 }; });
    TFIDF = { docs, pesos, idf };
    return TFIDF;
  }
  async function temasSemelhantes(texto, k = 8) {
    const { docs, pesos, idf } = await indiceTemas();
    const tf = new Map(); for (const w of tokens(texto.slice(0, 60000))) tf.set(w, (tf.get(w) || 0) + 1);
    const q = new Map(); let n2 = 0; for (const [w, c] of tf) { const p = (1 + Math.log(c)) * idf(w); q.set(w, p); n2 += p * p; }
    const qn = Math.sqrt(n2) || 1;
    return pesos.map((d, i) => { let s = 0; for (const [w, p] of q) { const x = d.v.get(w); if (x) s += x * p; } return { t: docs[i], s: s / (d.n * qn) }; })
      .filter((x) => x.s > 0.12 && x.t._g !== "cancelado").sort((a, b) => b.s - a.s).slice(0, k);
  }
  function carregarScript(src) {
    return new Promise((ok, erro) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => erro(new Error("Falha ao carregar " + src)); document.head.appendChild(s); });
  }
  async function lerArquivo(arq) {
    const nome = arq.name.toLowerCase();
    if (/\.(txt|md)$/.test(nome)) return arq.text();
    if (nome.endsWith(".pdf")) {
      if (!window.pdfjsLib) await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf = await window.pdfjsLib.getDocument({ data: await arq.arrayBuffer() }).promise;
      let txt = "";
      for (let i = 1; i <= pdf.numPages; i++) { const pg = await pdf.getPage(i); const c = await pg.getTextContent(); txt += c.items.map((x) => x.str).join(" ") + "\n"; }
      return txt;
    }
    if (nome.endsWith(".docx")) {
      if (!window.mammoth) await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
      const r = await window.mammoth.extractRawText({ arrayBuffer: await arq.arrayBuffer() });
      return r.value;
    }
    throw new Error("Formato não suportado. Use PDF, DOCX, TXT ou MD.");
  }
  async function vVerificar(main) {
    main.innerHTML = `
      <div class="verif-grade">
        <section class="card card-pad">
          <h2 style="margin:0 0 4px;font:700 19px/1.3 var(--serif)">Cole o texto ou envie o arquivo</h2>
          <p class="nota" style="color:var(--tx-3);font-size:13.5px;margin:0 0 12px">O arquivo é lido no seu navegador e não é enviado a nenhum servidor.</p>
          <div class="solta" id="vf-solta">${ico("arquivo")}<div style="margin-top:6px">Arraste um PDF, DOCX, TXT ou MD, ou <label style="color:var(--pri);font-weight:600;cursor:pointer">escolha um arquivo<input type="file" id="vf-arq" accept=".pdf,.docx,.txt,.md" hidden></label></div><div id="vf-nome" class="meta" style="justify-content:center;margin-top:6px"></div></div>
          <textarea id="vf-txt" rows="14" style="margin-top:12px" placeholder="Ou cole aqui o texto da petição, do recurso ou do parecer…"></textarea>
          <div class="acoes"><button class="btn btn-pri" id="vf-ok">${ico("verificar")} Verificar citações</button><button class="btn btn-fant" id="vf-limpar">Limpar</button></div>
        </section>
        <section id="vf-res">${vazio("verificar", "O que esta verificação faz", "Localiza os temas, precedentes e súmulas citados no texto; informa a situação atual de cada tema (tese firmada, em andamento, cancelado ou revisado); indica processos citados que são leading cases de repetitivos ou estão em pauta; e sugere precedentes qualificados com assunto parecido.")}</section>
      </div>`;
    const solta = $("#vf-solta");
    const receber = async (arq) => {
      if (!arq) return;
      $("#vf-nome").textContent = `Lendo ${arq.name}…`;
      try { $("#vf-txt").value = await lerArquivo(arq); $("#vf-nome").textContent = `${arq.name} carregado.`; verificar(); }
      catch (e) { $("#vf-nome").textContent = e.message; }
    };
    $("#vf-arq").addEventListener("change", (e) => receber(e.target.files[0]));
    ["dragenter", "dragover"].forEach((t) => solta.addEventListener(t, (e) => { e.preventDefault(); solta.classList.add("sobre"); }));
    ["dragleave", "drop"].forEach((t) => solta.addEventListener(t, (e) => { e.preventDefault(); solta.classList.remove("sobre"); }));
    solta.addEventListener("drop", (e) => receber(e.dataTransfer.files[0]));
    $("#vf-ok").addEventListener("click", verificar);
    $("#vf-limpar").addEventListener("click", () => { $("#vf-txt").value = ""; $("#vf-nome").textContent = ""; });
  }
  async function verificar() {
    const txt = $("#vf-txt").value;
    const res = $("#vf-res");
    if (txt.trim().length < 40) { toast("Cole um texto um pouco maior."); return; }
    res.innerHTML = esqueleto();
    const [t, pt, pl, ix, dj] = await Promise.all([temas(), procTemas(), pautas(), indice(), djen()]);
    // Temas citados
    const citTemas = new Map();
    const reT = /\b(tema|temas|controv[ée]rsia|iac)\s+(?:repetitivo\s+|n[º°o.]*\s*|de\s+n[º°o.]*\s*)*(\d{1,2}(?:\.\d{3})|\d{1,4})(?:\s*(?:\/|do|da)\s*(stj|stf|superior tribunal de justi[çc]a|supremo))?/gi;
    let m;
    while ((m = reT.exec(txt))) {
      const tipo = /^controv/i.test(m[1]) ? "Controvérsia" : /^iac/i.test(m[1]) ? "IAC" : "Tema";
      const n = +m[2].replace(/\./g, ""); const corte = norm(m[3] || "");
      const depois = txt.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (/stf|supremo/.test(corte) || /^\s*(da repercuss|de repercuss|do stf|do supremo)/i.test(depois)) continue;
      const k = `${tipo}-${n}`; if (!citTemas.has(k)) citTemas.set(k, { tipo, n, trecho: txt.slice(Math.max(0, m.index - 60), m.index + 90) });
    }
    // Precedentes citados
    const citProc = new Map();
    const reP = /\b((?:(?:AgInt|AgRg|EDcl|EREsp|EAREsp)\s+(?:no|nos|na|em)\s+)*(?:REsp|AREsp|EREsp|EAREsp|RMS|HC|RHC|CC|MS|Rcl|AR|AgInt|AgRg))\s*(?:n[º°o.]*\s*)?(\d{1,3}(?:\.\d{3})+|\d{4,7})(?:\s*\/\s*([A-Z]{2}))?/g;
    while ((m = reP.exec(txt))) { const nd = digitos(m[2]); if (nd.length < 4) continue; const k = nd; if (!citProc.has(k)) citProc.set(k, { cl: m[1].replace(/\s+/g, " "), n: nd, uf: m[3] || "" }); }
    // Súmulas
    const citSum = new Map();
    const reS = /\bs[úu]mulas?\s+(?:vinculante\s+)?(?:n[º°o.]*\s*)?(\d{1,3})(?:\s*(?:\/|do|da)\s*(stj|stf))?/gi;
    while ((m = reS.exec(txt))) { const tr = (m[2] || "").toUpperCase() || "—"; const k = `${m[1]}/${tr}`; if (!citSum.has(k)) citSum.set(k, { n: m[1], tr }); }

    const alertas = [];
    const linhasTema = [...citTemas.values()].map((c) => {
      const x = t.idx.get(`${c.tipo}-${c.n}`);
      if (!x) return `<div class="cit"><span class="cit-tit">${c.tipo} ${c.n}</span><span class="selo canc">Não localizado</span><div class="cit-txt">Não consta da base de precedentes do STJ. Confira se o número está correto ou se o tema é de outro tribunal.</div></div>`;
      let nota = "", selo = seloSit(x.sit);
      if (x._g === "cancelado") { nota = `<b>Atenção:</b> a situação atual é “${esc(x.sit)}”. Revise o uso deste precedente.`; alertas.push(`${c.tipo} ${c.n} está ${x.sit.toLowerCase()}`); }
      else if (x._teseAguarda) nota = `Julgado; ${esc(x._teseAguarda.charAt(0).toLowerCase() + x._teseAguarda.slice(1))}`;
      else if (x._g === "andamento") { nota = `Ainda sem tese firmada.${/suspens/i.test(x.info || "") ? " <b>Há determinação de suspensão</b> de processos." : ""}`; }
      else if (x.tese) nota = `<b>Tese:</b> ${esc(x.tese)}`;
      return `<div class="cit" data-tema="${esc(x.tp)}|${x.n}"><span class="cit-tit"><button type="button" class="link-acao" data-abrir-tema>${esc(x.tp)} ${x.n}</button></span>${selo}<div class="cit-txt">${nota}</div></div>`;
    });
    const linhasProc = [...citProc.values()].slice(0, 40).map((c) => {
      const vinc = pt.porNum.get(c.n) || [];
      const pauta = pl.filter((p) => digitos(p.p) === c.n);
      const ac = ix.find((r) => r.n === c.n);
      const pub = dj.find((x) => digitos(x.p) === c.n);
      const notas = [];
      for (const v of vinc) { const x = t.idx.get(`${v.tp}-${v.n}`); notas.push(`${v.lc ? "Leading case" : "Processo vinculado"} ${v.tp === "Controvérsia" ? "à" : "ao"} <button type="button" class="link-acao" data-tema-direto="${esc(v.tp)}|${v.n}">${esc(v.tp)} ${v.n}</button>${x ? ` (${esc(x.sit)})` : ""}`); }
      for (const p of pauta) notas.push(`<b>Em pauta</b> em ${fmtData(p.d)} · ${esc(D.orgaos[p.o] || "")}${p.pet ? " (" + esc(p.pet) + ")" : ""}`);
      if (ac) notas.push(`Acórdão publicado em ${fmtData(ac.dj)} · ${esc(D.orgaos[ac.o] || "")}`);
      if (pub && !ac) notas.push(`Acórdão publicado no DJEN em ${fmtData(pub.d)}`);
      return `<div class="cit"><span class="cit-tit">${esc(c.cl)} ${fmtNumProc(c.n)}${c.uf ? "/" + esc(c.uf) : ""}</span>${notas.length ? '<span class="selo pri">Localizado</span>' : '<span class="selo">Sem registro recente</span>'}<div class="cit-txt">${notas.join("<br>") || "Não aparece entre os precedentes qualificados, as pautas nem os acórdãos dos últimos meses na base do site. Isso não indica problema; confira no STJ se necessário."}</div></div>`;
    });
    const sem = await temasSemelhantes(txt, 6);
    const jaCit = new Set(citTemas.keys());
    const sugest = sem.filter((x) => !jaCit.has(`${x.t.tp}-${x.t.n}`));
    res.innerHTML = `
      <div class="card card-pad">
        <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr));margin:0">
          <div class="stat" style="cursor:default"><span><b>${citTemas.size}</b><span>tema(s) citado(s)</span></span></div>
          <div class="stat" style="cursor:default"><span><b>${citProc.size}</b><span>precedente(s) citado(s)</span></span></div>
          <div class="stat" style="cursor:default"><span><b>${citSum.size}</b><span>súmula(s) citada(s)</span></span></div>
        </div>
        ${alertas.length ? `<p class="aviso" style="margin-top:12px">${ico("alerta")}<span><b>Pontos de atenção:</b> ${alertas.map(esc).join("; ")}.</span></p>` : ""}
      </div>
      <div class="card card-pad" style="margin-top:12px"><h3 style="margin:0 0 6px">Temas citados</h3>${linhasTema.join("") || '<p class="nota">Nenhum tema identificado no texto.</p>'}</div>
      <div class="card card-pad" style="margin-top:12px"><h3 style="margin:0 0 6px">Precedentes citados</h3>${linhasProc.join("") || '<p class="nota">Nenhum número de processo identificado.</p>'}</div>
      ${citSum.size ? `<div class="card card-pad" style="margin-top:12px"><h3 style="margin:0 0 6px">Súmulas citadas</h3><p class="nota" style="margin-bottom:8px">A base aberta do STJ não traz as súmulas; confira a redação e a vigência no site do tribunal.</p><div class="chips">${[...citSum.values()].map((s) => `<span class="selo">Súmula ${esc(s.n)}${s.tr !== "—" ? "/" + esc(s.tr) : ""}</span>`).join("")}</div></div>` : ""}
      <div class="card card-pad" style="margin-top:12px"><h3 style="margin:0 0 2px">Precedentes qualificados com assunto parecido</h3><p class="nota" style="margin-bottom:6px">Sugestões automáticas por semelhança de palavras, que não foram citadas no texto. Confira a pertinência.</p>
        ${sugest.length ? sugest.map((x) => `<div class="cit" data-tema="${esc(x.t.tp)}|${x.t.n}"><span class="cit-tit"><button type="button" class="link-acao" data-abrir-tema>${esc(x.t.tp)} ${x.t.n}</button></span>${seloSit(x.t.sit)}<div class="cit-txt">${esc(x.t.tese ? "Tese: " + x.t.tese : x.t.q)}</div></div>`).join("") : '<p class="nota">Nenhuma sugestão com semelhança suficiente.</p>'}</div>`;
    $$("[data-tema-direto]", res).forEach((b) => b.addEventListener("click", () => { const [tp, n] = b.dataset.temaDireto.split("|"); abrirTema(tp, +n); }));
  }

  // ================================================================= SOBRE
  async function vSobre(main) {
    const m = D.man;
    const total = m.meses.reduce((s, x) => s + Object.values(x.orgaos).reduce((a, b) => a + b.n, 0), 0);
    main.innerHTML = `<div class="card card-pad texto-serif" style="max-width:820px">
      <p>O Radar STJ organiza a jurisprudência do Superior Tribunal de Justiça a partir do <a href="https://dadosabertos.web.stj.jus.br/" target="_blank" rel="noopener">Portal de Dados Abertos do STJ</a>. Uma rotina automática consulta o portal duas vezes por dia e publica o que houver de novo.</p>
      <h3 style="font-family:var(--ui)">Fontes</h3>
      <ul>
        <li><b>Acórdãos (espelhos):</b> ementa, tese, relator, datas e referências legislativas da Corte Especial, das Seções e das Turmas. O STJ divulga um arquivo por mês e órgão, poucos dias após o fim do mês. O site mantém os últimos 12 meses.</li>
        <li><b>Precedentes qualificados:</b> temas repetitivos, controvérsias, IAC, SIRDR e PUIL, com os processos vinculados. A atualização é diária.</li>
        <li><b>Pautas futuras:</b> processos incluídos nas próximas sessões. A atualização é diária. Por privacidade, o site não exibe os nomes das partes.</li>
        <li><b>Publicações no DJEN:</b> metadados diários dos acórdãos publicados, com cerca de duas semanas de defasagem.</li>
      </ul>
      <h3 style="font-family:var(--ui)">Como a relevância é calculada</h3>
      <p>Cada acórdão recebe uma pontuação automática. Somam pontos o julgamento pela Corte Especial (+5) ou por Seção (+4), a tese jurídica registrada (+6), a afetação ao rito repetitivo (+6), os embargos de divergência (+4), o tema repetitivo (+3) e as menções a superação ou mudança de entendimento e a questão nova (+4), a modulação e a distinção (+3) e a divergência (+2). Perdem pontos os agravos internos e os embargos de declaração (−1) e os fundamentos de rotina, como Súmula 7, Súmulas 283/284 do STF, embargos rejeitados e reexame de provas (até −4).</p>
      <p>No Atualize-se, a tese de julgamento de cada acórdão é lida item por item. Saem da fila os julgados em que todos os itens apenas aplicam óbices ou entendimentos consolidados (Súmulas 5, 7, 83, 182, 211, 282 e 284, prequestionamento, embargos de declaração, prisão preventiva por fundamentação usual, dosimetria), e perdem posição os que repetem em série a mesma tese. Quando só parte dos itens tem conteúdo próprio, o cartão mostra apenas esses itens; a tese completa continua na ementa.</p>
      <p>Com 10 pontos ou mais, o acórdão é de <b>alta relevância</b>; de 6 a 9, <b>relevante</b>; de 2 a 5, marcado para <b>acompanhar</b>. A área do direito é identificada pelas palavras da verbetação. É uma triagem para orientar a leitura, e não uma avaliação jurídica.</p>
      <h3 style="font-family:var(--ui)">Privacidade</h3>
      <p>O seu radar (assuntos, processos e OAB) e os itens salvos ficam apenas no seu navegador. A verificação de petição roda no seu computador, e o texto não é enviado a nenhum servidor.</p>
      <h3 style="font-family:var(--ui)">Situação da base</h3>
      <p>Última execução: ${new Date(m.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. ${fmtInt(total)} acórdãos de ${m.meses.length ? fmtMes(m.meses[m.meses.length - 1].m) : "—"} a ${m.meses.length ? fmtMes(m.meses[0].m) : "—"}; ${fmtInt(m.temas?.n)} precedentes qualificados; ${fmtInt(m.pautas?.n)} processos em pauta; ${fmtInt(m.destaques?.n)} destaques nos últimos 3 meses.</p>
      ${m.erros?.length ? `<p class="aviso">${ico("alerta")}<span>Na última execução, parte das fontes não respondeu (${esc(m.erros.join("; "))}). Os dados anteriores foram mantidos.</span></p>` : ""}
      <h3 style="font-family:var(--ui)">Cautelas</h3>
      <p>O texto das ementas é o oficial; apenas a verbetação, que o STJ publica em caixa alta, é exibida em letras minúsculas para facilitar a leitura, e o botão de copiar traz o texto original. Antes de citar qualquer julgado, confira o inteiro teor no site do STJ. Os processos em segredo de justiça não constam da base aberta. Este é um projeto independente, sem vínculo com o STJ.</p>
    </div>`;
  }

  // =================================================================== init
  async function init() {
    montarNav();
    $("#veu").addEventListener("click", fecharGaveta);
    $("#gaveta-fechar").addEventListener("click", fecharGaveta);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fecharGaveta();
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); irParaBusca(); }
    });
    $("#topo-busca").addEventListener("click", irParaBusca);
    const topo = $("#topo");
    window.addEventListener("scroll", () => topo.classList.toggle("rolou", window.scrollY > 4), { passive: true });
    try { D.man = await getJSON("data/manifest.json"); }
    catch { $("#view").innerHTML = vazio("alerta", "A base ainda não foi gerada", "Rode a rotina de atualização (veja o README)."); return; }
    D.orgaos = D.man.orgaos;
    const q = new Date(D.man.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    $("#lat-atualizado").textContent = `Atualizado em ${q}`;
    window.addEventListener("hashchange", rotear);
    await rotear();
    atualizarContadorRadar();
    atualizarContadorFeed();
  }
  function irParaBusca() {
    const campo = $("#view input[type=search]");
    if (campo) { campo.focus(); campo.select?.(); }
    else location.hash = "#pesquisa?foco=1";
  }
  init();
})();
