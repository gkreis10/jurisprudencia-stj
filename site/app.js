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
    return out.replace(/\bin re ipsa\b/gi, "in re ipsa");
  }

  // ================================================================ ícones
  const I = {
    painel: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    radar: '<path d="M18 16v-5a6 6 0 1 0-12 0v5l-1.5 2h15z"/><path d="M10 21h4"/>',
    composicao: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16.2 14.1c2.7.4 4.8 2.8 4.8 5.9"/>',
    destaques: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    pesquisa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    repetitivos: '<path d="M12 4v16M6.5 7h11M6.5 7 3.5 13h6zM17.5 7l-3 6h6z"/>',
    pautas: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    verificar: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14l2 2 4-4"/>',
    sobre: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    mais: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    externo: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    copiar: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
    citar: '<path d="M5 7h5v5c0 3-1.6 5-4.5 6M14 7h5v5c0 3-1.6 5-4.5 6"/>',
    salvar: '<path d="M6 4h12v17l-6-4-6 4z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    mais1: '<path d="M12 5v14M5 12h14"/>',
    seta: '<path d="m9 6 6 6-6 6"/>',
    alerta: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
    raio: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
    filtro: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
    arquivo: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    semana: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8 14h8M8 17.5h5"/>',
    sumulas: '<path d="M5 4h11l3 3v13H5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4.5"/>',
    ordem: '<path d="M7 4v16M4 17l3 3 3-3M14 6h7M14 12h5M14 18h3"/>',
    pasta: '<path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v9.3A1.5 1.5 0 0 1 19 19.5H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    polegar: '<path d="M7 11v9H4v-9zM7 11l4-7c1.3 0 2.2 1 2 2.3L12.5 10H19a1.8 1.8 0 0 1 1.8 2.1l-1.2 6.4A2 2 0 0 1 17.6 20H7"/>',
    "polegar-b": '<path d="M7 13V4H4v9zM7 13l4 7c1.3 0 2.2-1 2-2.3L12.5 14H19a1.8 1.8 0 0 0 1.8-2.1l-1.2-6.4A2 2 0 0 0 17.6 4H7"/>',
    circulo: '<circle cx="12" cy="12" r="7.5"/>',
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
  function toast(msg, acao) {
    const box = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    if (acao) {
      const b = document.createElement("button"); b.type = "button"; b.className = "toast-acao"; b.textContent = acao.rot;
      b.addEventListener("click", () => { el.remove(); acao.fn(); });
      el.appendChild(b);
    }
    box.appendChild(el);
    setTimeout(() => { el.classList.add("sai"); setTimeout(() => el.remove(), 200); }, acao ? 6000 : 2400);
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
    previdenciario: "Previdenciário", ambiental: "Ambiental", penal: "Penal", "proc-penal": "Processo Penal", trabalho: "Trabalho",
  };
  // Cada matéria tem um matiz fixo, usado em todo o site (selos, filtros, cartões).
  const AREA_COR = { "proc-civil": 226, civil: 208, consumidor: 24, familia: 315, empresarial: 262, bancario: 190, tributario: 150, administrativo: 42, previdenciario: 172, ambiental: 105, penal: 0, "proc-penal": 340, trabalho: 290 };
  // Submatérias: só aparecem depois de escolher a matéria geral.
  const SUBAREAS = {
    "civil": { "pessoas": "Pessoas, capacidade e pessoa jurídica", "personalidade": "Direitos da personalidade, imagem e honra", "bens": "Bens", "negocio-juridico": "Negócio jurídico, vícios e nulidades", "prescricao-civ": "Prescrição e decadência", "obrigacoes": "Obrigações, pagamento e inadimplemento", "enriquecimento": "Enriquecimento sem causa e pagamento indevido", "contratos": "Contratos em geral e revisão contratual", "compra-venda": "Compra e venda, promessa e doação", "locacao": "Locação", "servicos-emp": "Prestação de serviços, empreitada, mandato e corretagem", "transporte": "Transporte", "seguros": "Seguros", "fianca": "Fiança e garantias pessoais", "dano-moral": "Dano moral", "resp-civil": "Responsabilidade civil e indenização", "acidentes": "Acidentes de trânsito", "resp-profissional": "Erro médico e responsabilidade de profissionais", "posse": "Posse e ações possessórias", "usucapiao": "Usucapião", "propriedade": "Propriedade e direito de vizinhança", "condominio": "Condomínio", "direitos-reais": "Direitos reais sobre coisa alheia e garantias reais", "registros": "Registros públicos e atividade notarial", "autoral": "Direitos autorais" },
    "familia": { "casamento": "Casamento e regime de bens", "uniao-estavel": "União estável", "divorcio": "Divórcio, separação e partilha", "alimentos": "Alimentos", "filiacao": "Filiação e paternidade", "guarda": "Guarda, convivência e poder familiar", "adocao": "Adoção", "infancia": "Criança e adolescente", "curatela": "Curatela, tutela e interdição", "sucessao-legitima": "Sucessão legítima e direitos dos herdeiros", "testamento": "Testamentos e legados", "inventario": "Inventário e arrolamento" },
    "consumidor": { "planos-saude": "Planos de saúde", "bancos-cons": "Bancos e crédito ao consumidor", "imoveis-cons": "Imóveis, incorporação e consórcios", "educacao-cons": "Ensino e mensalidades", "aereo": "Transporte aéreo e turismo", "essenciais": "Energia, água, telefonia e internet", "veiculos": "Veículos", "fornecedor": "Vício e fato do produto ou serviço", "cadastros": "Cadastros, negativação e protesto", "praticas": "Práticas e cláusulas abusivas", "publicidade": "Oferta, publicidade e comércio eletrônico", "superendividamento": "Superendividamento", "defesa-cons": "Defesa do consumidor em juízo" },
    "bancario": { "juros": "Juros, capitalização e encargos", "contratos-banc": "Contratos bancários e cédulas de crédito", "cartao": "Cartão de crédito", "fiduciaria": "Alienação fiduciária e busca e apreensão", "garantias-banc": "Aval e outras garantias bancárias", "sfh": "Sistema Financeiro da Habitação", "fraudes": "Fraudes e segurança bancária", "sigilo": "Sigilo bancário e dados" },
    "empresarial": { "sociedades": "Sociedades e sócios", "dissolucao": "Dissolução e apuração de haveres", "desconsideracao": "Desconsideração da personalidade jurídica", "recuperacao": "Recuperação judicial", "falencia": "Falência", "titulos": "Títulos de crédito", "contratos-emp": "Contratos empresariais", "marcas": "Marcas, concorrência desleal e nome empresarial", "patentes": "Patentes e desenho industrial", "arbitragem": "Arbitragem", "mercado": "Mercado de capitais e concorrência" },
    "proc-civil": { "partes": "Partes, legitimidade e intervenção de terceiros", "competencia": "Competência", "honorarios": "Honorários advocatícios", "gratuidade": "Gratuidade da justiça, custas e depósitos", "atos-proc": "Prazos, citação, intimação e nulidades", "tutela": "Tutelas provisórias", "provas-pc": "Provas e ônus da prova", "sentenca": "Sentença, coisa julgada e ação rescisória", "especiais": "Procedimentos especiais", "ms": "Mandado de segurança", "coletivo": "Processo coletivo e ação civil pública", "cumprimento": "Cumprimento de sentença e liquidação", "execucao-tit": "Execução de título extrajudicial", "penhora": "Penhora, bem de família e expropriação", "recurso-especial": "Recurso especial e admissibilidade", "agravos-embargos": "Agravos e embargos de declaração", "apelacao": "Apelação e julgamento nos tribunais", "precedentes-pc": "Precedentes, IRDR e embargos de divergência", "preparo": "Preparo, tempestividade e deserção" },
    "tributario": { "icms": "ICMS", "ipva-itcmd": "IPVA e ITCMD", "ir": "Imposto de renda e CSLL", "pis-cofins": "PIS e Cofins", "contrib-prev": "Contribuições previdenciárias e de terceiros", "ipi-aduana": "IPI, IOF e comércio exterior", "simples": "Simples Nacional", "municipais": "ISS, IPTU e ITBI", "taxas": "Taxas e contribuições especiais", "imunidade": "Imunidades e isenções", "credito-trib": "Lançamento, prescrição e decadência", "responsabilidade-trib": "Responsabilidade tributária e redirecionamento", "compensacao": "Compensação e repetição de indébito", "exec-fiscal": "Execução fiscal", "processo-trib": "Processo administrativo fiscal e certidões" },
    "administrativo": { "servidores": "Servidores: remuneração e vantagens", "concursos": "Concursos públicos", "militares": "Militares", "pad": "Processo administrativo e disciplinar", "improbidade": "Improbidade administrativa", "controle": "Atos administrativos, poder de polícia e controle", "licitacoes": "Licitações", "contratos-adm": "Contratos administrativos e concessões", "desapropriacao": "Desapropriação e bens públicos", "resp-estado": "Responsabilidade civil do Estado", "regulacao": "Agências reguladoras e serviços públicos", "transito": "Trânsito e multas", "conselhos": "Conselhos profissionais", "saude-pub": "Saúde pública e medicamentos", "ensino-pub": "Ensino público e financiamento estudantil", "fgts": "FGTS" },
    "previdenciario": { "aposentadorias": "Aposentadorias e tempo especial", "incapacidade": "Benefícios por incapacidade", "pensao-morte": "Pensão por morte e qualidade de segurado", "assistencial": "Benefício assistencial (BPC/LOAS)", "outros-benef": "Salário-maternidade, auxílio-reclusão e outros", "rural": "Trabalhador rural", "acidentaria": "Acidente de trabalho", "revisao": "Revisão e cálculo de benefícios", "devolucao": "Devolução de valores e desconto", "custeio": "Custeio e contribuições do segurado", "privada": "Previdência privada" },
    "ambiental": { "dano-amb": "Dano ambiental e reparação", "resp-amb": "Responsabilidade ambiental", "areas-prot": "Áreas protegidas e Código Florestal", "urbanistico": "Urbanismo e parcelamento do solo", "recursos-nat": "Recursos hídricos, mineração e resíduos", "fauna": "Fauna e pesca", "sancoes-amb": "Infrações e licenciamento" },
    "penal": { "dosimetria": "Dosimetria, regime e substituição da pena", "punibilidade": "Prescrição, insignificância e extinção da punibilidade", "exec-penal": "Execução penal", "pessoa": "Crimes contra a vida e lesões", "violencia-dom": "Violência doméstica", "honra": "Crimes contra a honra e a liberdade", "patrimonio": "Crimes patrimoniais", "sexuais": "Crimes sexuais", "drogas": "Drogas", "armas-transito": "Armas e crimes de trânsito", "administracao": "Crimes contra a administração pública", "economicos": "Crimes econômicos, tributários e lavagem", "orcrim": "Organização criminosa", "ambientais-penal": "Crimes ambientais" },
    "proc-penal": { "acao-penal": "Denúncia, ação penal e trancamento", "acordos": "ANPP, transação e colaboração premiada", "competencia-pp": "Competência", "prisoes": "Prisões e medidas cautelares", "provas-pp": "Provas, buscas e interceptações", "reconhecimento": "Reconhecimento de pessoas", "nulidades-pp": "Nulidades e direito de defesa", "juri": "Tribunal do Júri", "hc": "Habeas corpus", "recursos-pp": "Recursos e revisão criminal" },
  };
  // Grupo de cada submatéria, na ordem da lei de regência (no Civil, a do Código Civil).
  const SUBGRUPO = {
    "civil": { "pessoas": "Parte geral", "personalidade": "Parte geral", "bens": "Parte geral", "negocio-juridico": "Parte geral", "prescricao-civ": "Parte geral", "obrigacoes": "Obrigações", "enriquecimento": "Obrigações", "contratos": "Contratos", "compra-venda": "Contratos", "locacao": "Contratos", "servicos-emp": "Contratos", "transporte": "Contratos", "seguros": "Contratos", "fianca": "Contratos", "dano-moral": "Responsabilidade civil", "resp-civil": "Responsabilidade civil", "acidentes": "Responsabilidade civil", "resp-profissional": "Responsabilidade civil", "posse": "Direito das coisas", "usucapiao": "Direito das coisas", "propriedade": "Direito das coisas", "condominio": "Direito das coisas", "direitos-reais": "Direito das coisas", "registros": "Direito das coisas", "autoral": "Propriedade intelectual" },
    "familia": { "casamento": "Família", "uniao-estavel": "Família", "divorcio": "Família", "alimentos": "Família", "filiacao": "Família", "guarda": "Família", "adocao": "Família", "infancia": "Família", "curatela": "Família", "sucessao-legitima": "Sucessões", "testamento": "Sucessões", "inventario": "Sucessões" },
    "consumidor": { "planos-saude": "Contratos de consumo", "bancos-cons": "Contratos de consumo", "imoveis-cons": "Contratos de consumo", "educacao-cons": "Contratos de consumo", "aereo": "Serviços", "essenciais": "Serviços", "veiculos": "Serviços", "fornecedor": "Responsabilidade do fornecedor", "cadastros": "Responsabilidade do fornecedor", "praticas": "Práticas comerciais", "publicidade": "Práticas comerciais", "superendividamento": "Práticas comerciais", "defesa-cons": "Defesa em juízo" },
    "bancario": { "juros": "Contratos bancários", "contratos-banc": "Contratos bancários", "cartao": "Contratos bancários", "fiduciaria": "Garantias", "garantias-banc": "Garantias", "sfh": "Crédito imobiliário", "fraudes": "Responsabilidade", "sigilo": "Responsabilidade" },
    "empresarial": { "sociedades": "Direito societário", "dissolucao": "Direito societário", "desconsideracao": "Direito societário", "recuperacao": "Crise da empresa", "falencia": "Crise da empresa", "titulos": "Títulos e contratos", "contratos-emp": "Títulos e contratos", "marcas": "Propriedade industrial", "patentes": "Propriedade industrial", "arbitragem": "Solução de conflitos", "mercado": "Mercado" },
    "proc-civil": { "partes": "Parte geral", "competencia": "Parte geral", "honorarios": "Parte geral", "gratuidade": "Parte geral", "atos-proc": "Parte geral", "tutela": "Parte geral", "provas-pc": "Conhecimento", "sentenca": "Conhecimento", "especiais": "Conhecimento", "ms": "Conhecimento", "coletivo": "Conhecimento", "cumprimento": "Execução", "execucao-tit": "Execução", "penhora": "Execução", "recurso-especial": "Recursos", "agravos-embargos": "Recursos", "apelacao": "Recursos", "precedentes-pc": "Recursos", "preparo": "Recursos" },
    "tributario": { "icms": "Tributos estaduais", "ipva-itcmd": "Tributos estaduais", "ir": "Tributos federais", "pis-cofins": "Tributos federais", "contrib-prev": "Tributos federais", "ipi-aduana": "Tributos federais", "simples": "Tributos federais", "municipais": "Tributos municipais", "taxas": "Tributos municipais", "imunidade": "Normas gerais", "credito-trib": "Normas gerais", "responsabilidade-trib": "Normas gerais", "compensacao": "Normas gerais", "exec-fiscal": "Processo tributário", "processo-trib": "Processo tributário" },
    "administrativo": { "servidores": "Agentes públicos", "concursos": "Agentes públicos", "militares": "Agentes públicos", "pad": "Agentes públicos", "improbidade": "Controle", "controle": "Controle", "licitacoes": "Contratações públicas", "contratos-adm": "Contratações públicas", "desapropriacao": "Bens e intervenção", "resp-estado": "Responsabilidade", "regulacao": "Regulação", "transito": "Regulação", "conselhos": "Regulação", "saude-pub": "Direitos sociais", "ensino-pub": "Direitos sociais", "fgts": "Direitos sociais" },
    "previdenciario": { "aposentadorias": "Benefícios", "incapacidade": "Benefícios", "pensao-morte": "Benefícios", "assistencial": "Benefícios", "outros-benef": "Benefícios", "rural": "Segurados", "acidentaria": "Segurados", "revisao": "Cálculo e revisão", "devolucao": "Cálculo e revisão", "custeio": "Custeio", "privada": "Previdência complementar" },
    "ambiental": { "dano-amb": "Responsabilidade", "resp-amb": "Responsabilidade", "areas-prot": "Proteção", "urbanistico": "Proteção", "recursos-nat": "Proteção", "fauna": "Proteção", "sancoes-amb": "Administrativo ambiental" },
    "penal": { "dosimetria": "Parte geral", "punibilidade": "Parte geral", "exec-penal": "Parte geral", "pessoa": "Crimes em espécie", "violencia-dom": "Crimes em espécie", "honra": "Crimes em espécie", "patrimonio": "Crimes em espécie", "sexuais": "Crimes em espécie", "drogas": "Legislação especial", "armas-transito": "Legislação especial", "administracao": "Legislação especial", "economicos": "Legislação especial", "orcrim": "Legislação especial", "ambientais-penal": "Legislação especial" },
    "proc-penal": { "acao-penal": "Investigação e ação penal", "acordos": "Investigação e ação penal", "competencia-pp": "Investigação e ação penal", "prisoes": "Medidas cautelares", "provas-pp": "Provas", "reconhecimento": "Provas", "nulidades-pp": "Procedimento", "juri": "Procedimento", "hc": "Recursos e ações", "recursos-pp": "Recursos e ações" },
  };

  // Valor de filtro de matéria: "civil" (geral) ou "civil/contratos" (específica).
  // Matérias escolhidas no filtro: uma ou várias, separadas por vírgula ("civil,consumidor/plano"); vale qualquer uma.
  const listaMat = (v) => String(v || "").split(",").filter(Boolean);
  const casaMat1 = (v, ar, sa) => (v.includes("/") ? (sa || []).includes(v) : (ar || []).includes(v));
  const casaMat = (v, ar = [], sa = []) => !v || listaMat(v).some((x) => casaMat1(x, ar, sa));
  const rotMat = (v, curto = false) => { if (!v) return ""; if (v.includes(",")) return listaMat(v).map((x) => rotMat(x, true)).join(", "); const [a, s] = v.split("/"); return s ? (curto ? SUBAREAS[a]?.[s] || s : `${AREAS[a] || a} · ${SUBAREAS[a]?.[s] || s}`) : AREAS[a] || a; };
  function contarMat(itens, arDe, saDe) {
    const c = {};
    for (const x of itens) { for (const a of arDe(x) || []) c[a] = (c[a] || 0) + 1; for (const s of saDe(x) || []) c[s] = (c[s] || 0) + 1; }
    return c;
  }
  const seloArea = (k, attrs = "") => `<span class="selo area" style="--h:${AREA_COR[k] ?? 222}"${attrs}>${esc(AREAS[k] || k)}</span>`;
  // Selo da matéria com a submatéria, quando houver ("Civil · Contratos").
  const seloMat = (ar = [], sa = [], max = 1) => (ar || []).slice(0, max).map((a) => { const s = (sa || []).find((x) => x.startsWith(a + "/")); return `<span class="selo area" style="--h:${AREA_COR[a] ?? 222}">${esc(AREAS[a] || a)}${s ? `<span class="sub"> · ${esc(rotMat(s, true))}</span>` : ""}</span>`; }).join("");
  // Seletor de matérias em dois painéis: à esquerda as matérias; à direita os assuntos
  // da matéria aberta, agrupados como na lei de regência. No celular, um painel por vez.
  function htmlMaterias({ cont, sel, aberta, todas = "Todas as matérias", op = (v) => `data-op="${esc(v)}"` }) {
    const temSel = (a) => sel(a) || Object.keys(SUBAREAS[a] || {}).some((s) => sel(`${a}/${s}`));
    const areas = Object.keys(AREAS).filter((a) => !cont || cont[a] || temSel(a));
    if (cont) areas.sort((a, b) => (cont[b] || 0) - (cont[a] || 0));
    const n = (v) => (cont ? `<span class="n">${fmtInt(cont[v] || 0)}</span>` : "");
    const algum = areas.some(temSel);
    const subsDe = (a) => Object.entries(SUBAREAS[a] || {}).filter(([k]) => !cont || cont[`${a}/${k}`] || sel(`${a}/${k}`));
    const larga = !matchMedia("(max-width: 860px)").matches;
    // No computador, o painel da direita nunca fica vazio: abre a matéria marcada ou a primeira da lista.
    if (larga && (aberta === undefined || aberta === "" || !areas.includes(aberta))) aberta = areas.find((a) => temSel(a) && subsDe(a).length) || areas.find((a) => subsDe(a).length) || "";
    const esquerda = `<div class="mt2-areas" role="list"><button type="button" class="mt2-todas" ${op("")} aria-pressed="${!algum}">${esc(todas)}</button>${areas.map((a) => {
      const subs = subsDe(a);
      const attrs = subs.length ? `data-mt-abrir="${a}" aria-expanded="${aberta === a}"` : `${op(a)} aria-pressed="${sel(a)}"`;
      return `<button type="button" class="mt2-area${subs.length ? "" : " folha"}${temSel(a) ? " marcada" : ""}${aberta === a ? " aberta" : ""}" style="--h:${AREA_COR[a] ?? 222}" ${attrs}><i></i><span class="nome">${esc(AREAS[a])}</span>${n(a)}${subs.length ? ico("seta") : ""}</button>`;
    }).join("")}</div>`;
    let direita = `<div class="mt2-subs vazio"><p class="nota">Escolha uma matéria para ver os assuntos.</p></div>`;
    if (aberta && AREAS[aberta]) {
      const subs = subsDe(aberta), grupos = [];
      for (const [k, t] of subs) { const g = SUBGRUPO[aberta]?.[k] || ""; let gr = grupos.find((x) => x.g === g); if (!gr) grupos.push((gr = { g, itens: [] })); gr.itens.push([k, t]); }
      direita = `<div class="mt2-subs" style="--h:${AREA_COR[aberta] ?? 222}">
        <div class="mt2-subs-cab"><button type="button" class="mt2-voltar" data-mt-abrir="">${ico("seta", "gira")} Matérias</button><b>${esc(AREAS[aberta])}</b></div>
        <button type="button" class="mt2-sub geral" ${op(aberta)} aria-pressed="${sel(aberta)}"><span>Todos os assuntos de ${esc(AREAS[aberta])}</span>${n(aberta)}</button>
        ${grupos.map((gr) => `${gr.g && grupos.length > 1 ? `<p class="mt2-grupo">${esc(gr.g)}</p>` : ""}${gr.itens.map(([k, t]) => `<button type="button" class="mt2-sub" ${op(`${aberta}/${k}`)} aria-pressed="${sel(`${aberta}/${k}`)}"><span>${esc(t)}</span>${n(`${aberta}/${k}`)}</button>`).join("")}`).join("")}
      </div>`;
    }
    return `<div class="mt2${aberta ? " com-aberta" : ""}">${esquerda}${direita}</div>`;
  }
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
  // Sinônimos jurídicos usados na busca (sem acento, minúsculas). Cada grupo
  // reúne expressões equivalentes; buscar uma encontra as demais.
  const SINONIMOS = [
    "dano moral|dano extrapatrimonial|abalo moral|danos morais|danos extrapatrimoniais",
    "dano material|dano patrimonial|danos materiais|danos patrimoniais",
    "dano estetico|danos esteticos", "lucros cessantes|lucro cessante",
    "plano de saude|operadora de plano de saude|operadora de saude|saude suplementar|seguro saude",
    "honorarios advocaticios|honorarios sucumbenciais|honorarios de sucumbencia|verba honoraria",
    "justica gratuita|gratuidade de justica|gratuidade da justica|assistencia judiciaria gratuita|beneficio da gratuidade",
    "cumprimento de sentenca|execucao de titulo judicial", "execucao fiscal|executivo fiscal",
    "desconsideracao da personalidade juridica|desconsideracao da personalidade|idpj",
    "alimentos|pensao alimenticia|obrigacao alimentar|prestacao alimenticia",
    "uniao estavel|convivencia more uxorio", "usucapiao|prescricao aquisitiva",
    "cdc|codigo de defesa do consumidor", "cpc|codigo de processo civil", "cpp|codigo de processo penal",
    "ctn|codigo tributario nacional", "eca|estatuto da crianca e do adolescente", "lep|lei de execucao penal",
    "relacao de consumo|relacao consumerista",
    "inscricao indevida|negativacao indevida|cadastro de inadimplentes|cadastros de protecao ao credito|orgaos de protecao ao credito",
    "alienacao fiduciaria|propriedade fiduciaria|garantia fiduciaria",
    "tutela de urgencia|tutela antecipada|tutela provisoria|antecipacao de tutela|liminar",
    "agravo interno|agint", "agravo regimental|agrg", "embargos de declaracao|edcl|embargos declaratorios|aclaratorios",
    "recurso especial|resp|apelo nobre", "embargos de divergencia|eresp|earesp", "habeas corpus|hc|writ",
    "mandado de seguranca|mandamus", "acao rescisoria|rescisoria", "coisa julgada|res judicata",
    "prescricao|prazo prescricional", "decadencia|prazo decadencial",
    "juros de mora|juros moratorios", "correcao monetaria|atualizacao monetaria",
    "astreintes|multa cominatoria|multa diaria", "penhora online|penhora on line|sisbajud|bacenjud|bloqueio de ativos financeiros",
    "capitalizacao de juros|anatocismo|juros capitalizados", "cda|certidao de divida ativa",
    "repeticao de indebito|restituicao do indebito|restituicao de indebito", "itcmd|itcd",
    "improbidade administrativa|ato de improbidade|lia", "servidor publico|servidores publicos|funcionario publico",
    "responsabilidade civil do estado|responsabilidade objetiva do estado|responsabilidade civil do ente publico",
    "trafico de drogas|trafico de entorpecentes|trafico ilicito de entorpecentes",
    "trafico privilegiado|minorante do trafico|causa de diminuicao do art 33",
    "prisao preventiva|custodia cautelar|segregacao cautelar|prisao cautelar",
    "busca domiciliar|ingresso em domicilio|ingresso domiciliar|violacao de domicilio|invasao de domicilio",
    "busca pessoal|revista pessoal|abordagem policial", "anpp|acordo de nao persecucao penal",
    "dosimetria|dosimetria da pena|individualizacao da pena", "pena base|pena-base",
    "violencia domestica|maria da penha|lei maria da penha", "insignificancia|principio da insignificancia|bagatela",
    "juri|tribunal do juri", "reexame de provas|revolvimento fatico probatorio|reexame fatico probatorio|sumula 7",
    "dissidio jurisprudencial|divergencia jurisprudencial", "recurso repetitivo|recursos repetitivos|tema repetitivo|rito dos repetitivos",
    "irdr|incidente de resolucao de demandas repetitivas", "iac|incidente de assuncao de competencia",
    "previdencia privada|previdencia complementar|entidade fechada de previdencia",
    "fgts|fundo de garantia do tempo de servico", "inss|instituto nacional do seguro social|autarquia previdenciaria",
    "bpc|loas|beneficio de prestacao continuada|amparo assistencial",
    "auxilio doenca|beneficio por incapacidade temporaria", "aposentadoria por invalidez|aposentadoria por incapacidade permanente",
    "desapropriacao|expropriacao", "licitacao|procedimento licitatorio|certame licitatorio",
    "dano ambiental|degradacao ambiental", "app|area de preservacao permanente",
    "instituicao financeira|instituicoes financeiras|banco", "acao civil publica|acp",
    "ministerio publico|parquet|orgao ministerial", "cotas condominiais|taxas condominiais|despesas condominiais",
    "clausula penal|multa contratual", "litigancia de ma fe|ma fe processual",
    "paternidade socioafetiva|filiacao socioafetiva|socioafetividade", "estupro de vulneravel|estupro de vulneraveis",
    "seguro obrigatorio|dpvat", "locacao|contrato de locacao|inquilinato",
  ];
  // Singular aproximado, para comparar "danos morais" com "dano moral".
  function singular(w) {
    if (w.length < 4 || /\d/.test(w)) return w;
    if (/(oes|aes|aos)$/.test(w)) return w.slice(0, -3) + "ao";
    if (/ais$/.test(w)) return w.slice(0, -3) + "al";
    if (/eis$/.test(w)) return w.slice(0, -3) + "el";
    if (/ois$/.test(w)) return w.slice(0, -3) + "ol";
    if (/ns$/.test(w)) return w.slice(0, -2) + "m";
    if (/(r|z|s)es$/.test(w)) return w.slice(0, -2);
    if (/[^s]s$/.test(w)) return w.slice(0, -1);
    return w;
  }
  // Padrão que aceita singular e plural da palavra.
  function flexW(w) {
    if (w.length < 3 || /\d/.test(w)) return w;
    const b = singular(w);
    if (/ao$/.test(b)) return b.slice(0, -2) + "(?:ao|oes|aes|aos)";
    if (/al$/.test(b)) return b.slice(0, -2) + "(?:al|ais)";
    if (/el$/.test(b)) return b.slice(0, -2) + "(?:el|eis)";
    if (/ol$/.test(b)) return b.slice(0, -2) + "(?:ol|ois)";
    if (/m$/.test(b)) return b.slice(0, -1) + "(?:m|ns)";
    if (/[rzs]$/.test(b)) return b + "(?:es)?";
    return b + "s?";
  }
  const MAPA_SIN = (() => {
    const m = new Map();
    for (const g of SINONIMOS) {
      const itens = g.split("|").map((x) => x.split(/[^a-z0-9]+/).filter(Boolean));
      for (const it of itens) {
        const k = it.map(singular).join(" ");
        const vistos = new Set([k, ...(m.get(k) || []).map((y) => y.map(singular).join(" "))]);
        const outros = itens.filter((y) => { const ky = y.map(singular).join(" "); if (vistos.has(ky)) return false; vistos.add(ky); return true; });
        m.set(k, [...(m.get(k) || []), ...outros]);
      }
    }
    return m;
  })();
  // Número de processo ou de precedente: 2.219.808 = 2219808.
  const reNumero = (d) => d.length < 4 ? d : d.replace(/\B(?=(\d{3})+(?!\d))/g, "\\.?");

  const Busca = (() => {
    const cache = new Map();
    const LIM = "[a-z0-9]";
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    function lex(q) {
      const out = [];
      const re = /\s*(\(|\)|=?"[^"]*"?|-(?=[^\s-])|[^\s()"]+)/g; let m;
      while ((m = re.exec(q))) {
        let s = m[1], ex = false;
        if (s === "(" || s === ")") { out.push({ t: s }); continue; }
        if (s === "-") { out.push({ t: "op", v: "NAO" }); continue; }
        if (s.startsWith("=") && s.length > 1) { ex = true; s = s.slice(1); }
        if (s.startsWith('"')) {
          const palavras = norm(s.replace(/"/g, "")).split(/[^a-z0-9$]+/).filter(Boolean);
          if (palavras.length) out.push(ex ? { t: "frase", v: palavras, ex } : { t: "frase", v: palavras });
          continue;
        }
        const nm = /^(\d{1,3}(?:\.\d{3})+|\d{4,})(?:[-/][a-z]{2})?$/i.exec(s);
        if (nm) { out.push({ t: "termo", v: nm[1].replace(/\D/g, ""), num: true }); continue; }
        const n = norm(s);
        if (n === "e" || n === "and" || n === "&") { out.push({ t: "op", v: "E" }); continue; }
        if (n === "ou" || n === "or" || n === "|") { out.push({ t: "op", v: "OU" }); continue; }
        if (n === "nao" || n === "not") { out.push({ t: "op", v: "NAO" }); continue; }
        let mm = /^adj(\d{0,2})$/.exec(n); if (mm) { out.push({ t: "op", v: "ADJ", n: +(mm[1] || 1) }); continue; }
        mm = /^prox(\d{0,2})$/.exec(n); if (mm) { out.push({ t: "op", v: "PROX", n: +(mm[1] || 3) }); continue; }
        mm = /^tema:(\d+)$/.exec(n); if (mm) { out.push({ t: "tema", v: +mm[1] }); continue; }
        mm = /^sumula:(\d+)$/.exec(n); if (mm) { out.push({ t: "sum", v: +mm[1] }); continue; }
        const partes = n.split(/[^a-z0-9$*]+/).filter(Boolean).map((p) => p.replace(/\*/g, "$"));
        if (!partes.length) continue;
        const x = partes.length === 1 ? { t: "termo", v: partes[0] } : { t: "frase", v: partes };
        if (ex) x.ex = true;
        out.push(x);
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
        return x.t === "tema" || x.t === "sum" ? { t: x.t, v: x.v } : { ...x };
      }
      const ast = pOu();
      while (i < tk.length) { const extra = pOu(); if (!extra) { i++; continue; } }
      return ast;
    }
    // Acrescenta os sinônimos: "dano moral" vira ("dano moral" ou "dano extrapatrimonial" ou …).
    const alvo = (no) => no && (no.t === "termo" || no.t === "frase") && !no.ex && !no.num && !(no.t === "termo" ? [no.v] : no.v).some((w) => w.endsWith("$"));
    const palavras = (no) => (no.t === "termo" ? [no.v] : no.v);
    const alternativas = (ws, orig) => {
      const alts = MAPA_SIN.get(ws.map(singular).join(" "));
      if (!alts?.length) return null;
      return { t: "ou", sin: true, orig, a: [orig, ...alts.map((w) => (w.length === 1 ? { t: "termo", v: w[0] } : { t: "frase", v: w }))] };
    };
    function expandir(no) {
      if (!no) return no;
      if (alvo(no)) return alternativas(palavras(no), no) || no;
      if (no.t === "e") {
        const lista = [];
        const achatar = (x) => (x.t === "e" ? x.a.forEach(achatar) : lista.push(x));
        achatar(no);
        const res = [];
        for (let i = 0; i < lista.length;) {
          let feito = false;
          for (let k = Math.min(5, lista.length - i); k >= 2; k--) {
            const jan = lista.slice(i, i + k);
            if (!jan.every((x) => alvo(x) && x.t === "termo")) continue;
            const alt = alternativas(jan.map((x) => x.v), { t: "e", a: jan });
            if (alt) { res.push(alt); i += k; feito = true; break; }
          }
          if (!feito) { res.push(expandir(lista[i])); i++; }
        }
        return res.length === 1 ? res[0] : { t: "e", a: res };
      }
      if (no.a) return { ...no, a: no.a.map(expandir) };
      return no;
    }
    function reDe(no) {
      const k = JSON.stringify(no);
      if (cache.has(k)) return cache.get(k);
      const pal = (w) => (w.endsWith("$") ? `${esc(w.slice(0, -1))}${LIM}*` : no.ex ? esc(w) : flexW(w));
      let src;
      if (no.num) src = `(?<![0-9])${reNumero(no.v)}(?![0-9])`;
      else if (no.t === "termo") src = `(?<!${LIM})${pal(no.v)}(?!${LIM})`;
      else src = `(?<!${LIM})${no.v.map(pal).join(`[^a-z0-9]+`)}(?!${LIM})`;
      const re = new RegExp(src);
      cache.set(k, re);
      return re;
    }
    function posicoes(no, tokens) {
      const ws = no.t === "termo" ? [no.v] : no.v;
      const ok = (tok, w) => (w.endsWith("$") ? tok.startsWith(w.slice(0, -1)) : no.ex ? tok === w : new RegExp(`^${flexW(w)}$`).test(tok));
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
        case "sum": return reSumula(no.v).test(doc.t);
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
          case "termo": if (x.num) return `o número ${fmtNumProc(x.v)}`; return x.v.endsWith("$") ? `palavras começadas por “${x.v.slice(0, -1)}”` : `“${x.v}”`;
          case "frase": return `a expressão exata “${x.v.join(" ")}”`;
          case "tema": return `menção ao tema ${x.v}`;
          case "sum": return `menção à Súmula ${x.v}/STJ`;
          case "e": { const s = x.a.map((y) => f(y)).join(" e "); return topo ? s : `(${s})`; }
          case "ou": {
            if (x.sin) { const alts = x.a.slice(1, 4).map((y) => palavras(y).join(" ")); return `${x.orig.t === "e" ? `“${x.orig.a.map((y) => y.v).join(" ")}”` : f(x.orig, true)} ou sinônimos (${alts.join(", ")}${x.a.length > 4 ? "…" : ""})`; }
            const s = x.a.map((y) => f(y)).join(" ou "); return topo ? s : `(${s})`;
          }
          case "nao": return `sem ${f(x.a[0])}`;
          case "adj": return `${f(x.a[0])} seguido de ${f(x.a[1])} (até ${x.n} palavra${x.n > 1 ? "s" : ""})`;
          case "prox": return `${f(x.a[0])} perto de ${f(x.a[1])} (até ${x.n} palavras)`;
          default: return "";
        }
      };
      return f(no, true);
    }
    const STOP_BUSCA = new Set(["de", "da", "do", "das", "dos", "a", "o", "as", "os", "em", "no", "na", "nos", "nas", "para", "por", "com", "um", "uma", "ao", "aos", "pelo", "pela", "pelos", "pelas"]);
    function compilar(q) {
      q = String(q || "").trim();
      if (!q) return { vazio: true, termos: [], testa: () => true, pontua: () => 0, explicacao: "" };
      let ast = null, erro = "";
      const orig = norm(q).split(/\s+/).filter(Boolean);
      try { ast = parse(q); } catch (e) { erro = e.message; ast = parse(q.replace(/[()]/g, " ")); }
      ast = expandir(ast);
      // Palavras soltas: ignora artigos e preposições ("bem de família" → bem + família); a frase digitada segue valendo na pontuação.
      if (ast && ast.t === "e") {
        const a = ast.a.filter((x) => !(x.t === "termo" && !x.num && STOP_BUSCA.has(x.v)));
        if (a.length && a.length < ast.a.length) ast = a.length === 1 ? a[0] : { ...ast, a };
      }
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
          if (orig.length > soltas.length && soltas.length > 1 && orig.every((w) => /^[a-z0-9]+$/.test(w)) && reDe({ t: "frase", v: orig }).test(texto)) s += 10;
          return s;
        },
      };
    }
    return { compilar };
  })();
  const SEP_SUM = "(?:\\s*,\\s*|\\s+e\\s+)";
  const reSumula = (n) => new RegExp(`sumulas?\\s+(?:n[.oº°]*\\s*)?(?:\\d{1,3}${SEP_SUM})*${n}(?![0-9])(?:${SEP_SUM}\\d{1,3})*\\s*(?:\\/\\s*|do\\s+|desta\\s+|deste\\s+|da\\s+)(?:stj|superior tribunal|corte|tribunal)`);
  // Súmulas do STJ e temas repetitivos citados num texto (já normalizado).
  function refsDe(txt) {
    const t = norm(txt || ""); const sum = new Set(), tem = new Set();
    for (const m of t.matchAll(new RegExp(`sumulas?\\s+(?:n[.oº°]*\\s*)?((?:\\d{1,3}${SEP_SUM})*\\d{1,3})\\s*(?:\\/\\s*|do\\s+|desta\\s+|deste\\s+|da\\s+)(stj|superior tribunal|corte|tribunal)`, "g")))
      for (const n of m[1].split(/\D+/).filter(Boolean)) sum.add(+n);
    for (const m of t.matchAll(/temas?\s+(?:repetitivos?\s+)?(?:n[.oº°]*\s*)?(\d{1,2}\.?\d{3}|\d{2,4})(?![0-9])([^.;]{0,40})/g))
      if (!/repercussao|stf|supremo/.test(m[2])) tem.add(+m[1].replace(/\./g, ""));
    return { sum: [...sum].slice(0, 6), tem: [...tem].slice(0, 4) };
  }
  const linhaRefs = (txt) => { const r = refsDe(txt); if (!r.sum.length && !r.tem.length) return "";
    return `<p class="refs">Cita ${[...r.sum.map((n) => `<button type="button" data-ref="s:${n}">Súmula ${n}</button>`), ...r.tem.map((n) => `<button type="button" data-ref="t:${n}">Tema ${fmtNumProc(n)}</button>`)].join("")}</p>`; };
  const reTema = (n) => new RegExp(`(tema|controversia|iac)[^0-9]{0,30}(n[.ºo°]*\\s*)?${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\\.?")}(?![0-9])`, "i");
  function destacar(htmlEsc, termos) {
    const t = (termos || []).filter((x) => (x.t === "termo" ? x.v.replace("$", "").length >= 2 : true));
    if (!t.length) return htmlEsc;
    const mapa = { a: "[aáàâãä]", e: "[eéèêë]", i: "[iíìîï]", o: "[oóòôõö]", u: "[uúùûü]", c: "[cç]", n: "[nñ]" };
    const pal = (w, ex) => {
      const pref = w.endsWith("$"); const base = pref ? w.slice(0, -1) : w;
      const src = pref || ex ? base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : flexW(base);
      return src.replace(/[aeioucn]/g, (c) => mapa[c]) + (pref ? "[\\p{L}\\p{N}]*" : "");
    };
    const partes = t.map((x) => (x.num ? reNumero(x.v) : x.t === "termo" ? pal(x.v, x.ex) : x.v.map((w) => pal(w, x.ex)).join("[^\\p{L}\\p{N}<>]+")));
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${partes.join("|")})(?![\\p{L}\\p{N}])`, "giu");
    return htmlEsc.split(/(<[^>]+>)/).map((seg) => (seg.startsWith("<") ? seg : seg.replace(re, "<mark>$1</mark>"))).join("");
  }
  const AJUDA_BUSCA = `
    <div class="ajuda-busca">
      <p><b>Como pesquisar.</b> As palavras são buscadas inteiras (<code>oral</code> não encontra “corporal”), no singular e no plural, e com os sinônimos jurídicos mais comuns: <code>dano moral</code> também encontra “dano extrapatrimonial”.</p>
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
        <tr><td><code>2.219.808</code> · <code>2219808</code></td><td>número de processo, com ou sem pontos</td></tr>
        <tr><td><code>=dano</code> · <code>="plano de saúde"</code></td><td>só o termo exato, sem plural nem sinônimos</td></tr>
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
  const prepInfo = (x) => { if (x.an && x.tema) x.tema = frase(x.tema); x._n = norm(`${x.tema} ${x.t} ${x.ramo || ""} ${x.proc || ""} ${x.sec || ""}`); return x; };
  const informativos = () => carregar("informativos", (l) => { l.forEach(prepInfo); l.idx = new Map(l.map((x) => [x.id, x])); return l; });
  const infoIndice = () => carregar("informativos/indice");
  // Edições antigas ficam em arquivos por ano, carregados só quando pedidos.
  const infoAno = (ano) => carregar(`informativos/${ano}`, (l) => { l.forEach(prepInfo); return l; }).then(async (l) => { const r = await informativos(); for (const x of l) r.idx.set(x.id, x); return l; });
  const teorInfo = (x) => carregar(`informativos/teor-${(x?.d || "").slice(0, 4) || "0000"}`).catch(() => carregar("informativos-teor"));
  const URL_INFO = (ed) => `https://processo.stj.jus.br/jurisprudencia/externo/informativo/?acao=pesquisarumaedicao&livre=%27${String(ed).padStart(4, "0")}%27.cod.`;
  const sumulas = () => carregar("sumulas", (l) => { for (const x of l) { x._n = norm(`${x.t} ${x.ass || ""} ${x.ramo || ""} ${x.nota || ""}`); x._d = x.julg || x.pub || ""; } return l; });
  const indice = () => carregar("indice", (l) => { for (const x of l) x._n = norm(`${x.h} ${x.tese || ""} ${x.tj || ""}`); return l; });
  const djen = () => carregar("radar", (l) => { for (const x of l) x._p = norm(`${x.p} ${x.r || ""}`); return l; });

  // Arquivos mensais de acórdãos: publicados compactados (.json.gz) para caber o acervo longo;
  // o navegador descompacta. Sem suporte a descompactação, usa o .json (mantido para os meses recentes).
  async function getJSONgz(url) {
    if (typeof DecompressionStream !== "undefined") {
      try {
        // Meses antigos quase não mudam: aproveita o cache do navegador; os recentes são sempre conferidos.
        const mesArq = /acordaos\/(\d{4}-\d{2})\//.exec(url)?.[1] || "";
        const antigo = mesArq && D.man?.meses?.[3] && mesArq < D.man.meses[3].m;
        const r = await fetch(`${url}.gz`, { cache: antigo ? "default" : "no-cache" });
        if (r.ok) {
          const buf = new Uint8Array(await r.arrayBuffer());
          const txt = buf[0] === 0x1f && buf[1] === 0x8b ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(buf);
          return JSON.parse(txt);
        }
      } catch { /* tenta o .json */ }
    }
    return getJSON(url);
  }
  const MAX_SHARDS = 260; // cerca de dois anos de arquivos na memória; os mais antigos saem primeiro
  function shard(mes, slug) {
    const k = `${mes}/${slug}`;
    if (D.shards.has(k)) { const v = D.shards.get(k); D.shards.delete(k); D.shards.set(k, v); return v; }
    D.shards.set(k, getJSONgz(`data/acordaos/${mes}/${slug}.json`).catch((e) => { D.shards.delete(k); throw e; }));
    while (D.shards.size > MAX_SHARDS) D.shards.delete(D.shards.keys().next().value);
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
    const [t, ix, pl, dj, pt, inf] = await Promise.all([temas(), indice(), pautas(), djen(), procTemas(), informativos().catch(() => [])]);
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
      for (const x of inf) {
        if (tm ? x.tr !== +tm[1] : !casa(x._n)) continue;
        add(`i|${x.id}`, { tipo: "informativo", nivel: /repetitiv|corte especial/i.test(x.org || x.sec) ? "alta" : "rel", d: x.d, dNovo: x.d, termo, obj: x });
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
  // Só dá para montar a citação completa com relator e data de julgamento.
  const citavel = (r) => !!(r && r.cl && r.n && r.rel && r.dd && r.dj);
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
    const ps = String(txt).trim().replace(/^["“]+/, "").replace(/["”]+(?=\.?$)/, "").split(/\n+/).filter(Boolean);
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
    const motivos = (r.rz || []).filter((k) => MOTIVOS[k]).slice(0, 2).map((k) => `<span class="selo pri">${esc(MOTIVOS[k])}</span>`).join("");
    const areas = seloMat(r.ar, r.sa);
    const temCorpo = corpo.length > 0;
    const dups = r._dup?.length ? `<p class="duplic" title="${esc(r._dup.map((d) => `${d.cl} ${fmtNumProc(d.n)}`).join(", "))}">+ ${r._dup.length} processo(s) com a mesma ementa</p>` : "";
    return `<li class="card item" data-id="${esc(r.id)}">
      <div class="item-cab"><button type="button" class="item-tit item-abrir" data-a="abrir" title="Abrir o julgado completo">${esc(r.cl)} ${fmtNumProc(r.n)}</button>
        <span class="meta"><span>${esc(D.orgaos[r.o] || "")}</span>${r.rel ? `<span>Rel. ${esc(relatorFmt(r.rel))}</span>` : ""}${r.dd ? `<span>Julg. ${fmtData(r.dd)}</span>` : ""}<span>Publ. ${fmtData(r.dj)}</span></span></div>
      ${niv || motivos || areas ? `<div class="item-sel">${seloNivel(niv)}${motivos}${areas}</div>` : ""}
      ${blocoTese(r, termos, true)}
      <p class="verb">${destacar(esc(frase(cab)), termos)}</p>
      ${temCorpo ? `<div class="expansivel"><div><div class="texto-serif">${corpo.map((p) => `<p>${destacar(esc(p), termos)}</p>`).join("")}</div></div></div>` : ""}
      ${dups}${linhaRefs(em)}
      <div class="acoes">
        ${temCorpo ? `<button type="button" class="link-acao" data-a="ementa">Ver ementa completa</button>` : `<button type="button" class="link-acao" data-a="abrir">Ver julgado completo</button>`}
        <a class="link-acao" href="${URLS.inteiroTeor(r.reg, r.dj)}" target="_blank" rel="noopener">Inteiro teor oficial ${ico("externo")}</a>
        <span class="dir">
          ${citavel(r) ? `<button type="button" class="btn-ico" data-a="so-cit" title="Copiar só a citação" aria-label="Copiar só a citação">${ico("citar")}</button>` : ""}
          ${r.em ? `<button type="button" class="btn-ico" data-a="cit" title="Copiar ementa e citação" aria-label="Copiar ementa e citação">${ico("copiar")}</button>` : ""}
          <button type="button" class="btn-ico btn-salvar" data-a="salvar" aria-pressed="${salvo}" title="${salvo ? "Remover dos salvos" : "Salvar"}" aria-label="Salvar">${ico("salvar")}</button>
        </span>
      </div></li>`;
  }
  function minimoAcordao(r) {
    return { k: "a", id: r.id, m: mesDe(r), cl: r.cl, n: r.n, o: r.o, rel: r.rel, dd: r.dd, dj: r.dj, reg: r.reg, h: (r.em || r.h || "").split("\n")[0], tese: r.tese, tj: r.tj, s: r.s, rz: r.rz, ar: r.ar, sa: r.sa };
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
      if (a === "so-cit") copiar(citacao(r), "Citação copiada.");
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
    const areas = seloMat(r.ar, r.sa, 3);
    const extra = [["Relator(a)", r.rel ? relatorFmt(r.rel) : ""], ["Julgamento", fmtData(r.dd)], ["Publicação", `${(r.djt || "").split(/\s/)[0] || "DJ"} ${fmtData(r.dj)}`], ["Tema", r.tema], ["Notas", r.notas], ["Informações complementares", r.info], ["Referências legislativas", (r.leg || []).join("\n")]]
      .filter(([, v]) => v).map(([l, v]) => `<dt>${l}</dt><dd>${esc(v).replace(/\n/g, "<br>")}</dd>`).join("");
    abrirGaveta(`${D.orgaos[r.o] || ""}${r.dd ? " · julgado em " + fmtData(r.dd) : ""}`, `${r.cl} ${fmtNumProc(r.n)}`, `
      <div class="item-sel">${seloNivel(nivelAc(r.s ?? 0))}${motivos}${areas}</div>
      <div class="acoes" style="margin:4px 0 14px">
        <a class="btn btn-pri btn-peq" href="${URLS.inteiroTeor(r.reg, r.dj)}" target="_blank" rel="noopener">Inteiro teor oficial ${ico("externo")}</a>
        <a class="btn btn-claro btn-peq" href="${URLS.processo(r.reg)}" target="_blank" rel="noopener">Consulta processual</a>
        <button type="button" class="btn btn-claro btn-peq" id="ga-cit">${ico("copiar")} Copiar ementa e citação</button>
        <button type="button" class="btn btn-claro btn-peq" id="ga-socit">${ico("citar")} Copiar só a citação</button>
        <button type="button" class="btn btn-claro btn-peq btn-salvar" id="ga-salvar" aria-pressed="${salvo}">${ico("salvar")} ${salvo ? "Salvo" : "Salvar"}</button>
        <button type="button" class="btn btn-claro btn-peq" id="ga-org">${ico("arquivo")} Pasta e avaliação</button>
      </div>
      ${blocoTese(r, [])}
      <h3>Ementa</h3>
      <p class="verb">${esc(frase(cab))}</p>
      <div class="texto-serif" style="margin-top:10px">${corpo.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      ${linhaRefs(r.em)}
      ${extra ? `<h3>Dados do julgado</h3><dl class="dl">${extra}</dl>` : ""}`);
    $("#ga-cit").addEventListener("click", () => copiar(`${r.em}\n${citacao(r)}`, "Ementa e citação copiadas."));
    $("#ga-socit").addEventListener("click", () => copiar(citacao(r), "Citação copiada."));
    $("#ga-org").addEventListener("click", () => { const k = `a:${r.id}`; if (!P.salvos[k]) { P.salvos[k] = { ...minimoAcordao(r), salvoEm: hojeISO() }; salvarP(); avisarSalvos(); } organizarSalvo(k); });
    $("#ga-salvar").addEventListener("click", (e) => { alternarSalvo(`a:${r.id}`, minimoAcordao(r), e.currentTarget); e.currentTarget.lastChild.textContent = P.salvos[`a:${r.id}`] ? " Salvo" : " Salvar"; });
  }
  function alternarSalvo(chave, obj, botao) {
    if (P.salvos[chave]) {
      const antes = P.salvos[chave]; delete P.salvos[chave];
      toast("Removido dos salvos.", { rot: "Desfazer", fn: () => { P.salvos[chave] = antes; salvarP(); if (botao) botao.setAttribute("aria-pressed", "true"); avisarSalvos(); } });
    } else {
      P.salvos[chave] = { ...obj, salvoEm: hojeISO() };
      toast(pastas().length ? "Salvo. Quer colocá-lo numa pasta?" : "Salvo na aba Salvos.", { rot: pastas().length ? "Escolher pasta" : "Criar pasta", fn: () => organizarSalvo(chave) });
    }
    salvarP(); avisarSalvos();
    if (botao) { botao.setAttribute("aria-pressed", String(!!P.salvos[chave])); }
  }

  // ======================================================= organização dos salvos
  // Pastas (por tema, cliente ou processo), avaliação do precedente e anotação livre.
  const pastas = () => (P.pastas = P.pastas || []);
  const avisarSalvos = () => { document.dispatchEvent(new Event("salvos-mudou")); atualizarContadorSalvos(); };
  const ehPenal = (ar) => (ar || []).some((a) => a === "penal" || a === "proc-penal");
  const rotAval = (v, penal) => (v === "fav" ? "Favorável" : v === "desf" ? "Desfavorável" : "") + (v && penal ? " à defesa" : "");
  function tituloSalvo(x, k) {
    const t = x.k || k[0];
    if (t === "a") return `${x.cl} ${fmtNumProc(x.n)}`;
    if (t === "t") return `${x.tp} ${x.n}`;
    if (t === "j") return `Jurisprudência em Teses · ${String(x.id).replace("-", ", tese ")}`;
    if (t === "i") return "Nota do Informativo";
    return x.p ? String(x.p) : "Item salvo";
  }
  async function areasDoSalvo(x, k) {
    if (x.ar) return x.ar;
    const t = x.k || k[0];
    try {
      if (t === "t") return (await temas()).idx.get(`${x.tp}-${x.n}`)?.ar || [];
      if (t === "i") return (await informativos()).idx.get(x.id)?.ar || [];
      if (t === "j") return (await tesesJT()).idx.get(x.id)?.ar || [];
    } catch { /* sem dados */ }
    return [];
  }
  async function organizarSalvo(chave) {
    const x = P.salvos[chave]; if (!x) return;
    const penal = ehPenal(await areasDoSalvo(x, chave));
    abrirGaveta("Organizar salvo", tituloSalvo(x, chave), "");
    const corpo = $("#gaveta-corpo");
    const desenhar = () => {
      const sel = new Set(x.pastas || []);
      corpo.innerHTML = `
        <h3>Pastas</h3>
        ${pastas().length ? `<div class="chips">${pastas().map((p) => `<button type="button" class="chip" data-org-pasta="${esc(p)}" aria-pressed="${sel.has(p)}">${esc(p)}</button>`).join("")}</div>` : `<p class="nota">Nenhuma pasta ainda. Crie a primeira abaixo.</p>`}
        <form class="adicionar" id="org-nova" style="margin-top:10px"><input placeholder="Nova pasta. Ex.: Nulidade da busca domiciliar" aria-label="Nova pasta" maxlength="60"><button class="btn btn-pri" type="submit" aria-label="Criar pasta">${ico("mais1")}</button></form>
        <p class="nota">Um mesmo precedente pode ficar em mais de uma pasta.</p>
        <h3>Avaliação</h3>
        <div class="segmentos org-aval" role="radiogroup">${[["", "Não avaliado"], ["fav", rotAval("fav", penal)], ["desf", rotAval("desf", penal)]].map(([v, t]) => `<button type="button" role="radio" data-org-aval="${v}" aria-selected="${(x.aval || "") === v}">${t}</button>`).join("")}</div>
        <p class="nota">${penal ? "Indique se o precedente favorece ou prejudica a tese defensiva." : "Indique se o precedente favorece ou prejudica a tese que você sustenta."} A marcação é sua e fica só neste navegador.</p>
        <h3>Anotação</h3>
        <textarea id="org-nota" rows="4" placeholder="Por que este precedente importa, em que caso usar, ressalvas…">${esc(x.nota || "")}</textarea>
        <div class="acoes" style="margin-top:14px"><button type="button" class="btn btn-pri" data-org-fim>Concluir</button></div>`;
    };
    desenhar();
    const gravar = () => { salvarP(); avisarSalvos(); };
    corpo.onclick = (e) => {
      const bp = e.target.closest("[data-org-pasta]");
      if (bp) { const p = bp.dataset.orgPasta, l = new Set(x.pastas || []); l.has(p) ? l.delete(p) : l.add(p); x.pastas = [...l]; gravar(); desenhar(); return; }
      const ba = e.target.closest("[data-org-aval]");
      if (ba) { x.aval = ba.dataset.orgAval || undefined; gravar(); desenhar(); return; }
      if (e.target.closest("[data-org-fim]")) fecharGaveta();
    };
    corpo.oninput = (e) => { if (e.target.id === "org-nota") { x.nota = e.target.value.slice(0, 2000) || undefined; clearTimeout(organizarSalvo.t); organizarSalvo.t = setTimeout(gravar, 400); } };
    corpo.onsubmit = (e) => {
      if (e.target.id !== "org-nova") return;
      e.preventDefault();
      const nome = $("input", e.target).value.trim().replace(/\s+/g, " "); if (!nome) return;
      if (!pastas().some((p) => norm(p) === norm(nome))) pastas().push(nome);
      const real = pastas().find((p) => norm(p) === norm(nome));
      x.pastas = [...new Set([...(x.pastas || []), real])]; gravar(); desenhar();
    };
  }
  function gerenciarPastas() {
    abrirGaveta("Salvos", "Pastas e cópia de segurança", "");
    const corpo = $("#gaveta-corpo");
    const uso = (p) => Object.values(P.salvos).filter((x) => (x.pastas || []).includes(p)).length;
    const desenhar = () => {
      corpo.innerHTML = `${pastas().length ? `<ul class="lista-pastas">${pastas().map((p, i) => `<li><input value="${esc(p)}" data-pasta-nome="${i}" aria-label="Nome da pasta" maxlength="60"><span class="nota">${uso(p)} item(ns)</span><button type="button" class="btn-ico" data-pasta-apagar="${i}" title="Excluir pasta" aria-label="Excluir pasta">${ico("x")}</button></li>`).join("")}</ul>` : `<p class="nota">Nenhuma pasta criada.</p>`}
        <form class="adicionar" id="pasta-nova" style="margin-top:12px"><input placeholder="Nova pasta" aria-label="Nova pasta" maxlength="60"><button class="btn btn-pri" type="submit" aria-label="Criar pasta">${ico("mais1")}</button></form>
        <p class="nota">Excluir uma pasta não apaga os itens salvos; eles só deixam de estar nela. Para renomear, edite o nome e saia do campo.</p>
        <h3>Cópia de segurança</h3>
        <p class="nota">Os salvos, as pastas e as anotações ficam guardados neste navegador. Exporte um arquivo para levar a outro aparelho ou guardar uma cópia.</p>
        <div class="acoes"><button type="button" class="btn btn-claro btn-peq" data-salvos-exportar>${ico("arquivo")} Exportar salvos</button>
          <label class="btn btn-claro btn-peq" style="cursor:pointer">${ico("mais1")} Importar arquivo<input type="file" accept=".json,application/json" data-salvos-importar hidden></label></div>`;
    };
    desenhar();
    corpo.onclick = (e) => {
      const ap = e.target.closest("[data-pasta-apagar]");
      if (ap) { const p = pastas()[+ap.dataset.pastaApagar]; P.pastas = pastas().filter((x) => x !== p); for (const x of Object.values(P.salvos)) if (x.pastas) x.pastas = x.pastas.filter((y) => y !== p); salvarP(); avisarSalvos(); desenhar(); return; }
      if (e.target.closest("[data-salvos-exportar]")) {
        const blob = new Blob([JSON.stringify({ tipo: "radar-stj-salvos", versao: 1, exportadoEm: new Date().toISOString(), pastas: pastas(), salvos: P.salvos }, null, 1)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `radar-stj-salvos-${hojeISO()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    };
    corpo.onchange = async (e) => {
      const i = e.target.dataset?.pastaNome;
      if (i != null) {
        const velho = pastas()[+i], novo = e.target.value.trim().replace(/\s+/g, " ");
        if (!novo || novo === velho || pastas().some((p) => p !== velho && norm(p) === norm(novo))) { desenhar(); return; }
        P.pastas[+i] = novo; for (const x of Object.values(P.salvos)) if (x.pastas) x.pastas = x.pastas.map((y) => (y === velho ? novo : y));
        salvarP(); avisarSalvos(); desenhar(); return;
      }
      if (e.target.matches("[data-salvos-importar]") && e.target.files[0]) {
        try {
          const o = JSON.parse(await e.target.files[0].text());
          if (o.tipo !== "radar-stj-salvos" || typeof o.salvos !== "object") throw new Error();
          let n = 0;
          for (const [k, v] of Object.entries(o.salvos)) { if (!P.salvos[k]) n++; P.salvos[k] = { ...(P.salvos[k] || {}), ...v, pastas: [...new Set([...(P.salvos[k]?.pastas || []), ...(v.pastas || [])])] }; }
          for (const p of o.pastas || []) if (!pastas().includes(p)) pastas().push(p);
          salvarP(); avisarSalvos(); desenhar(); toast(`${n} item(ns) novo(s) importado(s).`);
        } catch { toast("Arquivo inválido: use um arquivo exportado pelo Radar STJ."); }
      }
    };
  }

  // =============================================================== gaveta
  let focoAnterior = null;
  function abrirGaveta(sobre, titulo, html) {
    focoAnterior = document.activeElement;
    $("#gaveta-sobre").textContent = sobre; $("#gaveta-tit").textContent = titulo; $("#gaveta-corpo").innerHTML = html;
    $("#gaveta-corpo").onclick = null; $("#gaveta-corpo").oninput = null; $("#gaveta-corpo").onsubmit = null; $("#gaveta-corpo").onchange = null;
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
  // Atalhos "Cita Súmula 7 · Tema 1.137": abrem o enunciado ou a tese sem sair da tela.
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-ref]"); if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const [k, n] = b.dataset.ref.split(":");
    if (k === "s") abrirSumula(+n); else abrirTema("Tema", +n);
  }, true);
  async function abrirSumula(n) {
    const l = await sumulas().catch(() => []);
    const x = l.find((y) => y.n === n);
    if (!x) return toast(`Súmula ${n} não encontrada na base do STJ.`);
    const [sit, cls] = SIT_SUM[x.sit] || SIT_SUM.vigente;
    abrirGaveta(`${x.org || "STJ"}${x.julg ? " · aprovada em " + fmtData(x.julg) : ""}`, `Súmula ${x.n}/STJ`, `
      <div class="item-sel"><span class="selo ${cls}">${sit}</span>${seloMat(x.ar, x.sa)}${x.ass ? `<span class="assunto">${esc(x.ass)}</span>` : ""}</div>
      <p class="enunciado-g${x.sit === "cancelada" ? " cancelada" : ""}">${esc(x.t)}</p>
      ${x.nota ? `<h3>${x.sit === "cancelada" ? "Cancelamento" : "Histórico da redação"}</h3><p class="texto-serif">${esc(x.nota)}</p>` : ""}
      <div class="acoes" style="margin-top:14px">
        <button type="button" class="btn btn-claro btn-peq" id="gs-copiar">${ico("copiar")} Copiar</button>
        <a class="btn btn-claro btn-peq" href="#pesquisa?q=sumula:${x.n}&p=u3" data-fechar>Acórdãos recentes que aplicam</a>
        <a class="btn btn-claro btn-peq" href="${URL_SUMULA(x.n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>
      </div>`);
    $("#gs-copiar").addEventListener("click", () => copiar(`Súmula ${x.n}/STJ: "${x.t}"`, "Súmula copiada."));
    $$("[data-fechar]", $("#gaveta-corpo")).forEach((a) => a.addEventListener("click", fecharGaveta));
  }
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-abrir-tema]"); if (!a) return;
    const li = a.closest("[data-tema]"); if (!li) return;
    ev.preventDefault();
    const [tp, n] = li.dataset.tema.split("|"); abrirTema(tp, +n);
  });

  function linhaTema(t, extra = "", termos = []) {
    const areas = seloMat(t.ar, t.sa, 2);
    return `<li class="card item" data-tema="${esc(t.tp)}|${t.n}">
      <div class="item-cab"><button type="button" class="item-tit item-abrir" data-abrir-tema>${esc(t.tp)} ${t.n}</button>${seloSit(t.sit)}${extra}
        <span class="meta"><span>${esc(t.org || "—")}</span>${t._mov ? `<span>Últ. mov. ${fmtData(t._mov)}</span>` : ""}</span></div>
      ${areas ? `<div class="item-sel">${areas}</div>` : ""}
      ${t.tese ? `<div class="tese compacta"><b>Tese firmada</b><p>${destacar(esc(t.tese), termos)}</p></div>` : t._teseAguarda ? `<p class="nota">Julgado; tese aguardando a publicação do acórdão.</p>` : ""}
      ${t.q ? `<p class="texto-serif${t.tese ? " questao" : ""}">${t.tese ? "<b>Questão:</b> " : ""}${destacar(esc(t.q), termos)}</p>` : ""}
      <div class="acoes"><button type="button" class="link-acao" data-abrir-tema>Detalhes e linha do tempo ${ico("seta")}</button>
        <a class="link-acao" href="${URLS.tema(t.tp, t.n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>
        <span class="dir">${botaoSalvar(`t:${t.tp}-${t.n}`, { k: "t", tp: t.tp, n: t.n })}</span></div></li>`;
  }

  // ========================================================= ATUALIZE-SE
  // Leitura em cartões: uma novidade por tela, tese em destaque com marca-texto
  // nas expressões decisivas, filtros facetados e fila que aprende com a leitura.
  const FEED_TIPOS = {
    tese: { rot: "Tese firmada", selo: "Tese firmada", longo: "Tese firmada em repetitivo", cls: "ok", peso: 100 },
    afetacao: { rot: "Tema afetado", selo: "Tema afetado", longo: "Novo tema afetado", cls: "rel", peso: 75 },
    pauta: { rot: "Em pauta", selo: "Vai a julgamento", longo: "Repetitivo em pauta", cls: "alta", peso: 70 },
    publicado: { rot: "Acórdão publicado", selo: "Acórdão publicado", longo: "Acórdão de repetitivo publicado", cls: "acomp", peso: 55 },
    informativo: { rot: "Informativo do STJ", selo: "Informativo", longo: "Destaques do Informativo do STJ", cls: "info", peso: 62 },
    julgado: { rot: "Julgados", selo: "Julgado", longo: "Julgados das Turmas e Seções", cls: "pri", peso: 40 },
  };
    const PERIODOS = [[0, "Qualquer data"], [3, "Últimos 3 dias"], [7, "Últimos 7 dias"], [15, "Últimos 15 dias"], [30, "Últimos 30 dias"]];
  const FILTRO_VAZIO = () => ({ ar: [], tp: [], per: 0, tese: "", org: [], rel: "", ord: "" });
  const feedJulgados = () => carregar("atualize").catch(() => destaques());

  function feedF() {
    if (!P.feedF) { P.feedF = FILTRO_VAZIO(); if (P.feedAreas?.length) P.feedF.ar = [...P.feedAreas]; }
    if (P.feedF.ord == null) P.feedF.ord = "";
    return P.feedF;
  }
  const pesos = () => (P.feedPeso = P.feedPeso || {});
  function ajustarPeso(areas, d) {
    const p = pesos();
    for (const a of areas) p[a] = Math.max(-8, Math.min(12, (p[a] || 0) + d));
    salvarP();
  }

  async function itensFeed() {
    const [t, ds, pl, inf] = await Promise.all([temas(), feedJulgados(), pautas(), informativos().catch(() => [])]);
    const hoje = hojeISO(), desde = somaDias(hoje, -45);
    const itens = [];
    const idade = (d) => Math.abs((new Date(hoje) - new Date(d)) / 864e5);
    const deTema = (x, extra) => ({ t: x, ar: x.ar || [], sa: x.sa || [], org: x.org || "", tese: !!x.tese, _n: norm(`${x.q || ""} ${x.tese || ""} ${x.ass || ""}`), ...extra });
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
    // Julgado de repetitivo cuja tese já está na fila como "tese firmada" não se repete.
    const temasFila = new Set(itens.filter((i) => i.t && i.tipo !== "afetacao").map((i) => i.t.n));
    // Notas do Informativo: a curadoria do próprio STJ, com tema e tese já prontos.
    const procsInfo = new Set();
    for (const x of inf) {
      if (!x.d || x.d < somaDias(hoje, -70) || /afeta/i.test(x.sec)) continue;
      (x.p || []).forEach((y) => procsInfo.add(y.n));
      if (x.tr && temasFila.has(x.tr)) continue;
      itens.push({ k: `inf:${x.id}`, tipo: "informativo", d: x.d, inf: x, ar: x.ar || [], sa: x.sa || [], org: x.org || x.sec || "", rel: x.rel || "", tese: true, _n: x._n });
    }
    for (const r of ds) {
      if (r.dj < somaDias(hoje, -80)) continue;
      const chave = `${r.o}|${r.dd || ""}|${(r.em || r.h || "").split("\n")[0].slice(0, 300)}|${String(r.tese || r.tj || "").slice(0, 160)}`;
      if (vistosA.has(chave)) continue; vistosA.add(chave);
      // Só entram julgados com tese legível; os demais continuam nos Destaques.
      if (!(r.tese || r.tj)) continue;
      const toks = String(r.cl || "").split(" ");
      if (!r.tese && (toks[0] === "EDcl" || toks[0] === "ProAfR" || toks.includes("RE"))) continue;
      const mt = /tema\s*(?:repetitivo\s*)?(?:n[.ºo°]*\s*)?(\d[\d.]*)/i.exec(r.h || (r.em || "").split("\n")[0]);
      if (mt && temasFila.has(+mt[1].replace(/\./g, ""))) continue;
      if (procsInfo.has(digitos(r.n))) continue;
      itens.push({ k: `ac:${r.id}`, tipo: "julgado", d: r.dj, r, ar: r.ar || [], sa: r.sa || [], org: D.orgaos[r.o] || "", rel: r.rel || "", tese: !!(r.tese || r.tj), _n: norm(`${r.h || (r.em || "").split("\n")[0]} ${r.tese || ""} ${r.tj || ""}`) });
    }
    // Termos do "Meu radar" viram prioridade na fila.
    const radar = (P.termos || []).map((termo) => ({ termo, tm: /^tema\s*:?\s*(\d+)$/i.exec(termo.trim()), c: /^tema\s*:?\s*\d+$/i.test(termo.trim()) ? null : Busca.compilar(termo) })).filter((x) => x.tm || (x.c && !x.c.vazio && !x.c.erro));
    const pw = pesos();
    for (const it of itens) {
      const hit = radar.find((q) => (q.tm ? it.t && it.t.n === +q.tm[1] : q.c.testa(it._n)));
      if (hit) it.radar = hit.termo;
      const gosto = it.ar.length ? Math.max(...it.ar.map((a) => pw[a] || 0)) : 0;
      it.gosto = gosto;
      it.p0 = FEED_TIPOS[it.tipo].peso + (it.inf && /repetitiv|corte especial|se[çc][ãa]o/i.test(it.org) ? 8 : 0) + (it.r ? Math.min(it.r.fs ?? it.r.s ?? 0, 20) + (it.tese ? 4 : 0) : 0)
        + (it.tipo === "pauta" ? 20 - idade(it.d) : -idade(it.d) * 0.9) + gosto * 3 + (hit ? 18 : 0);
    }
    itens.sort((a, b) => b.p0 - a.p0);
    // Intercala tipos para o ritmo da leitura não ficar monótono.
    const filas = {}; itens.forEach((i) => (filas[i.tipo] = filas[i.tipo] || []).push(i));
    const ordem = ["tese", "informativo", "julgado", "afetacao", "informativo", "julgado", "pauta", "informativo", "julgado", "publicado", "informativo", "julgado"];
    const out = []; let vazias = 0, j = 0, ultArea = "";
    const tirar = (f, tipo) => {
      // Entre julgados, evita duas matérias iguais seguidas quando há alternativa próxima.
      if (tipo !== "julgado" && tipo !== "informativo") return f.shift();
      const i = f.slice(0, 6).findIndex((x) => (x.ar[0] || "") !== ultArea);
      const [x] = f.splice(Math.max(0, i), 1); ultArea = x.ar[0] || ""; return x;
    };
    while (vazias < ordem.length) { const tp = ordem[j++ % ordem.length], f = filas[tp]; if (f?.length) { out.push(tirar(f, tp)); vazias = 0; } else vazias++; }
    return out;
  }
  // Um item passa pelos filtros? `sem` ignora uma dimensão (contagem facetada).
  function passaFeed(it, f, sem = "") {
    if (sem !== "ar" && f.ar.length && !f.ar.some((v) => casaMat(v, it.ar, it.sa))) return false;
    if (sem !== "tp" && f.tp.length && !f.tp.includes(it.tipo)) return false;
    if (sem !== "per" && f.per && Math.abs((new Date(hojeISO()) - new Date(it.d)) / 864e5) > f.per) return false;
    if (sem !== "tese" && f.tese && (f.tese === "com") !== it.tese) return false;
    if (sem !== "org" && f.org.length && !f.org.includes(it.org)) return false;
    if (sem !== "rel" && f.rel && !listaV(f.rel).some((r) => norm(r) === norm(it.rel))) return false;
    return true;
  }
  const nFiltros = (f) => f.ar.length + f.tp.length + (f.per ? 1 : 0) + (f.tese ? 1 : 0) + f.org.length + listaV(f.rel).length;
  function lidos() { return (P.lidos = P.lidos || {}); }
  function marcarLido(k) { const l = lidos(); if (l[k]) return false; l[k] = hojeISO(); const ks = Object.keys(l); if (ks.length > 4000) ks.slice(0, ks.length - 4000).forEach((x) => delete l[x]); salvarP(); return true; }
  const lidosHoje = () => { const h = hojeISO(); return Object.values(lidos()).filter((d) => d === h).length; };
  // ------------------------------------------------ constância e conquistas
  // Meta diária de leitura, sequência em dias úteis e conquistas por marcos. Tudo fica neste navegador.
  const METAS = [5, 10, 20];
  function hab() {
    if (!P.hab) {
      const dias = {}; Object.values(lidos()).forEach((d) => (dias[d] = (dias[d] || 0) + 1));
      P.hab = { meta: 10, dias, total: Object.values(dias).reduce((a, b) => a + b, 0), tipos: {}, areas: {}, zerou: {}, conq: {} };
    }
    return P.hab;
  }
  const diaUtil = (iso) => { const w = new Date(iso + "T12:00:00Z").getUTCDay(); return w > 0 && w < 6; };
  function sequencia() {
    const H = hab(), hoje = hojeISO();
    let n = 0, d = hoje;
    for (let i = 0; i < 800; i++, d = somaDias(d, -1)) {
      const ok = (H.dias[d] || 0) >= H.meta;
      if (!diaUtil(d)) { if (ok && d === hoje) n++; continue; }
      if (ok) n++;
      else if (d === hoje) continue; // hoje ainda não terminou
      else break;
    }
    return n;
  }
  function melhorSequencia() {
    const H = hab(); const dias = Object.keys(H.dias).sort(); if (!dias.length) return 0;
    let melhor = 0, atual = 0;
    for (let d = dias[0]; d <= hojeISO(); d = somaDias(d, 1)) {
      if (!diaUtil(d)) continue;
      if ((H.dias[d] || 0) >= H.meta) { atual++; melhor = Math.max(melhor, atual); } else if (d !== hojeISO()) atual = 0;
    }
    return Math.max(melhor, sequencia());
  }
  const CONQUISTAS = [
    { id: "seq", rot: "Constância", ico: "raio", niveis: [3, 5, 10, 20, 40], valor: () => melhorSequencia(), desc: (n) => `${n} dias úteis seguidos com a meta cumprida` },
    { id: "total", rot: "Leitor assíduo", ico: "arquivo", niveis: [25, 100, 300, 700, 1500], valor: () => hab().total, desc: (n) => `${fmtInt(n)} novidades lidas` },
    { id: "rep", rot: "Repetitivos em dia", ico: "repetitivos", niveis: [10, 40, 100, 250, 500], valor: () => ["tese", "afetacao", "publicado", "pauta"].reduce((a, k) => a + (hab().tipos[k] || 0), 0), desc: (n) => `${fmtInt(n)} teses firmadas, temas afetados e pautas de repetitivos` },
    { id: "info", rot: "Curadoria do STJ", ico: "destaques", niveis: [20, 80, 200, 500], valor: () => hab().tipos.informativo || 0, desc: (n) => `${fmtInt(n)} notas do Informativo` },
    { id: "fila", rot: "Fila em dia", ico: "semana", niveis: [1, 5, 15, 40, 100], valor: () => Object.keys(hab().zerou).length, desc: (n) => `chegou ao fim da fila em ${n} dia${n > 1 ? "s" : ""}` },
    { id: "mat", rot: "Especialista", ico: "sumulas", niveis: [30, 100, 250, 600], valor: () => Math.max(0, ...Object.values(hab().areas)), desc: (n) => `${fmtInt(n)} leituras em ${esc(AREAS[Object.entries(hab().areas).sort((a, b) => b[1] - a[1])[0]?.[0]] || "uma matéria")}` },
  ];
  const nivelDe = (c, v = c.valor()) => c.niveis.filter((x) => v >= x).length;
  function registrarLeitura(it) {
    const H = hab(), hoje = hojeISO();
    const antes = CONQUISTAS.map((c) => nivelDe(c)), metaAntes = (H.dias[hoje] || 0) >= H.meta;
    H.dias[hoje] = (H.dias[hoje] || 0) + 1; H.total++;
    if (it?.tipo) H.tipos[it.tipo] = (H.tipos[it.tipo] || 0) + 1;
    (it?.ar || []).slice(0, 1).forEach((a) => (H.areas[a] = (H.areas[a] || 0) + 1));
    const ks = Object.keys(H.dias).sort(); if (ks.length > 400) ks.slice(0, ks.length - 400).forEach((d) => delete H.dias[d]);
    salvarP();
    const avisos = [];
    if (!metaAntes && H.dias[hoje] >= H.meta) { const sq = sequencia(); avisos.push(`Meta de hoje cumprida${sq > 1 ? ` · ${sq} dias úteis seguidos` : ""}`); comemorar(); }
    CONQUISTAS.forEach((c, i) => { const n = nivelDe(c); if (n > antes[i]) { H.conq[`${c.id}${n}`] = hoje; avisos.push(`Conquista: ${c.rot}, nível ${n} (${c.desc(c.niveis[n - 1])})`); comemorar(); } });
    if (avisos.length) { salvarP(); avisos.forEach((a, i) => setTimeout(() => toast(a), i * 1600)); }
  }
  function registrarFilaZerada() { const H = hab(), hoje = hojeISO(); if (H.zerou[hoje]) return; const antes = nivelDe(CONQUISTAS[4]); H.zerou[hoje] = 1; const n = nivelDe(CONQUISTAS[4]); if (n > antes) { H.conq[`fila${n}`] = hoje; toast(`Conquista: Fila em dia, nível ${n}`); comemorar(); } salvarP(); }
  function comemorar() { const c = $("#fd-hab"); if (!c) return; c.classList.remove("festa"); void c.offsetWidth; c.classList.add("festa"); }
  function anelHab(tam = 30) {
    const H = hab(), feito = H.dias[hojeISO()] || 0, fr = Math.min(1, feito / H.meta), r = tam / 2 - Math.max(3.5, tam / 11) / 2 - 1, c = 2 * Math.PI * r;
    return `<svg class="hab-anel${fr >= 1 ? " ok" : ""}" viewBox="0 0 ${tam} ${tam}" width="${tam}" height="${tam}" style="width:${tam}px;height:${tam}px" aria-hidden="true"><circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" class="trilho" style="stroke-width:${Math.max(3.5, tam / 11)}"/><circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" class="feito" style="stroke-width:${Math.max(3.5, tam / 11)}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - fr)}" transform="rotate(-90 ${tam / 2} ${tam / 2})"/></svg>`;
  }
  function chipHab() {
    const H = hab(), feito = H.dias[hojeISO()] || 0, sq = sequencia();
    return `${anelHab()}<span class="hab-txt"><b>${Math.min(feito, 999)}/${H.meta}</b> hoje</span>${sq ? `<span class="hab-seq" title="Dias úteis seguidos com a meta cumprida">${ico("raio")}${sq}</span>` : ""}`;
  }
  function abrirHab() {
    const H = hab(), hoje = hojeISO(), feito = H.dias[hoje] || 0, sq = sequencia(), melhor = melhorSequencia();
    // Últimas 12 semanas, só dias úteis (colunas = semanas).
    const seg = somaDias(hoje, -((new Date(hoje + "T12:00:00Z").getUTCDay() + 6) % 7));
    let grade = "";
    for (let w = 11; w >= 0; w--) {
      grade += `<div class="hab-col">`;
      for (let d = 0; d < 5; d++) {
        const dia = somaDias(seg, -7 * w + d), n = H.dias[dia] || 0, niv = dia > hoje ? "fut" : n >= H.meta ? "n3" : n >= H.meta / 2 ? "n2" : n > 0 ? "n1" : "n0";
        grade += `<i class="${niv}" title="${fmtData(dia)}: ${n} lida${n === 1 ? "" : "s"}"></i>`;
      }
      grade += `</div>`;
    }
    const cards = CONQUISTAS.map((c) => {
      const v = c.valor(), n = nivelDe(c, v), prox = c.niveis[n], ant = n ? c.niveis[n - 1] : 0;
      const fr = prox ? Math.min(1, (v - ant) / (prox - ant)) : 1;
      return `<li class="conq${n ? " ganha" : ""}"><span class="conq-ico">${ico(c.ico)}</span><div><b>${esc(c.rot)}</b>${n ? `<span class="conq-niv">nível ${n} de ${c.niveis.length}</span>` : ""}
        <p>${prox ? `Próximo: ${c.desc(prox)}` : `Nível máximo: ${c.desc(c.niveis[c.niveis.length - 1])}`}</p>
        <div class="conq-barra"><i style="width:${Math.round(fr * 100)}%"></i></div><small>${fmtInt(v)}${prox ? ` de ${fmtInt(prox)}` : ""}</small></div></li>`;
    }).join("");
    abrirGaveta("Atualize-se", "Sua constância", `
      <div class="hab-topo">${anelHab(76)}<div><p class="hab-grande"><b>${feito}</b> de ${H.meta} novidades hoje</p>
        <p class="nota">${feito >= H.meta ? "Meta cumprida. O que vier agora é bônus." : `Faltam ${H.meta - feito} para a meta de hoje.`}</p></div></div>
      <div class="hab-nums"><div><b>${sq}</b><span>${sq === 1 ? "dia útil" : "dias úteis seguidos"}</span></div><div><b>${melhor}</b><span>melhor sequência</span></div><div><b>${fmtInt(H.total)}</b><span>novidades lidas</span></div></div>
      <h3>Meta diária</h3>
      <div class="pag-por hab-metas">${METAS.map((m) => `<button type="button" data-hab-meta="${m}" aria-pressed="${m === H.meta}">${m}</button>`).join("")}<span>novidades por dia</span></div>
      <h3>Últimas 12 semanas</h3>
      <div class="hab-grade">${grade}</div>
      <p class="nota">Cada quadrado é um dia útil; mais escuro, mais perto da meta. Fins de semana não contam contra a sequência.</p>
      <h3>Conquistas</h3>
      <ul class="conq-lista">${cards}</ul>
      <p class="nota">O progresso fica guardado neste navegador.</p>`);
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("#fd-hab, [data-hab-abrir]")) return abrirHab();
    const m = e.target.closest("[data-hab-meta]");
    if (m) { hab().meta = +m.dataset.habMeta; salvarP(); abrirHab(); const c = $("#fd-hab"); if (c) c.innerHTML = chipHab(); }
  });

  async function contarNaoLidos() {
    try { const it = await itensFeed(); const f = feedF(); return it.filter((x) => !lidos()[x.k] && passaFeed(x, f)).length; } catch { return 0; }
  }

  const tempoLeitura = (txt) => { const w = String(txt || "").split(/\s+/).length; const s = Math.max(10, Math.round((w / 210) * 60 / 5) * 5); return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`; };
  const saudacao = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };

  // Tese pronta para leitura: sem aspas, sem "Tese:" e sem numeração quando há um item só.
  function limparTeseTxt(t) { return limparTese(t, true); }
  function limparTese(t, texto = false) {
    const itens = String(t).trim().replace(/^["“']+|["”']+$/g, "").replace(/^\s*tese(?:\s*\d+)?\s*[:.-]\s*/i, "").split(/\n+|\s(?=\d{1,2}\.\s*\p{Lu})|(?<=[\p{Ll}\p{Lu})\]]\.)(?=\d{1,2}\.\s*\p{Lu})/u).map((x) => x.trim().replace(/^["“']+|["”']+$/g, "").replace(/^\s*tese(?:\s*\d+)?\s*[:.-]\s*/i, "")).filter(Boolean);
    const limpos = itens.map((x) => x.replace(/^\d{1,2}\.\s*/, ""));
    return texto ? limpos.join("\n") : limpos.map((x) => esc(x)).join("<br>");
  }
  function cartaoFeed(it, i, total) {
    const tp = FEED_TIPOS[it.tipo];
    const areas = it.ar.slice(0, 2).map((k, i) => { const sub = i === 0 ? (it.sa || []).find((x) => x.startsWith(k + "/")) : ""; const v = sub || k;
      return `<button type="button" class="selo area" data-f="area" data-ar="${v}" style="--h:${AREA_COR[k] ?? 222}" title="Ler só ${esc(rotMat(v))}">${esc(AREAS[k] || k)}${sub ? `<span class="sub"> · ${esc(rotMat(sub, true))}</span>` : ""}</button>`; }).join("");
    let kicker = "", principal = "", apoio = "", meta = "", acoes = "", rotTexto = "", marcar = false;
    if (it.inf) {
      const x = it.inf;
      const segs = x.tema.replace(/\.\s*$/, "").split(/\.\s+(?=\p{Lu})/u).filter((z) => !/^tema\s+\d/i.test(z));
      kicker = `<span class="reel-assunto">${esc(segs.slice(0, 4).join(" · "))}</span>`;
      rotTexto = "O STJ decidiu";
      principal = limparTese(x.t);
      marcar = true;
      meta = `${x.p?.[0] ? `${esc(x.p[0].cl)} ${fmtNumProc(x.p[0].n)} · ` : ""}${esc(x.org || x.sec)}${x.rel ? ` · Min. ${esc(x.rel)}` : ""} · Informativo ${x.ed}`;
      acoes = `<button type="button" class="btn btn-claro btn-peq" data-f="info">${ico("arquivo")} Ler a nota</button>
        <a class="btn btn-claro btn-peq so-largo" href="${URL_INFO(x.ed)}" target="_blank" rel="noopener">Informativo oficial ${ico("externo")}</a>`;
    } else if (it.t) {
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
      const cab = frase((r.em || r.h || "").split("\n")[0]);
      // Assunto em uma linha, no lugar do número do processo.
      const assunto = r.as ? frase(r.as).replace(/\.\s+(?=\p{Lu})/gu, " · ") : "";
      kicker = assunto ? `<span class="reel-assunto">${esc(assunto)}</span>` : `${esc(r.cl)} ${fmtNumProc(r.n)} · ${esc(it.org)}`;
      const tese = r.tese || r.tj;
      rotTexto = tese ? (r.tese ? "Tese jurídica" : "O STJ decidiu") : "O que foi decidido";
      principal = tese ? limparTese(tese) : esc(cab);
      marcar = !!tese;
      apoio = tese && !assunto ? esc(cab) : "";
      meta = `${assunto ? `${esc(r.cl)} ${fmtNumProc(r.n)} · ${esc(it.org)} · ` : ""}${r.rel ? esc(relatorFmt(r.rel)) + " · " : ""}${r.dd ? `julgado em ${fmtData(r.dd)}` : `publicado em ${fmtData(r.dj)}`}`;
      acoes = `<button type="button" class="btn btn-claro btn-peq" data-f="acordao">${ico("arquivo")} Ler a ementa</button>
        <a class="btn btn-claro btn-peq so-largo" href="${URLS.inteiroTeor(r.reg, r.dj)}" target="_blank" rel="noopener">Inteiro teor ${ico("externo")}</a>`;
    }
    const salvoK = it.inf ? `i:${it.inf.id}` : it.t ? `t:${it.t.tp}-${it.t.n}` : `a:${it.r.id}`;
    const salvo = !!P.salvos[salvoK];
    const novo = it.d > (D.feedVistoAnt || "") && it.tipo !== "pauta" && !lidos()[it.k];
    const pers = it.radar ? `<span class="selo radar" title="Corresponde a um termo do Meu radar">${ico("radar")} ${esc(it.radar.length > 28 ? it.radar.slice(0, 26) + "…" : it.radar)}</span>`
      : it.gosto >= 4 ? `<span class="selo gosto">Do seu interesse</span>` : "";
    const txtPrinc = principal.replace(/<[^>]+>/g, " ");
    return `<article class="reel" data-k="${esc(it.k)}" data-i="${i}" style="--h:${AREA_COR[it.ar[0]] ?? 222}" aria-label="Novidade ${i + 1} de ${total}">
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
            ${it.inf || citavel(it.r) ? `<button type="button" class="btn-ico so-largo" data-f="citacao" title="Copiar só a citação" aria-label="Copiar só a citação">${ico("citar")}</button>` : ""}
            <button type="button" class="btn-ico so-largo" data-f="copiar" title="Copiar tese e citação" aria-label="Copiar tese e citação">${ico("copiar")}</button>
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
      [["pauta"], "repetitivos em pauta", "alta"], [["informativo"], "destaques do Informativo", "info"], [["julgado"], "julgados relevantes", "pri"],
    ].map(([tps, rot, cls]) => ({ tps, rot, cls, n: por(tps) })).filter((b) => b.n);
    const contA = {}; vis.forEach((x) => { if (!lidos()[x.k]) x.ar.forEach((a) => (contA[a] = (contA[a] || 0) + 1)); });
    const top = Object.entries(contA).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const at = D.man?.atualizadoEm ? new Date(D.man.atualizadoEm) : null;
    return `<article class="reel reel-capa" data-i="-1"><div class="reel-in">
      <p class="reel-kicker">${esc(fmtDiaL(hojeISO()))}${at ? ` · base atualizada às ${at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
      <h2 class="capa-tit">${saudacao()}. ${!naoLidos ? "Você está em dia." : (() => { const jul = por(["julgado", "informativo"]), rep = naoLidos - jul;
        const partes = [rep ? `<b>${fmtInt(rep)}</b> movimento${rep > 1 ? "s" : ""} nos repetitivos` : "", jul ? `<b>${fmtInt(jul)}</b> tese${jul > 1 ? "s" : ""} de julgados para ler` : ""].filter(Boolean);
        return `${nFiltros(f) ? "Nos filtros escolhidos: " : "Há "}${partes.join(" e ")}.`; })()}</h2>
      ${blocos.length ? `<div class="capa-grade">${blocos.map((b) => `<button type="button" class="capa-bloco ${b.cls}" data-capa-tp="${b.tps.join(",")}"><b>${fmtInt(b.n)}</b><span>${b.rot}</span></button>`).join("")}</div>` : ""}
      ${top.length ? `<p class="reel-rot" style="margin-top:22px">Em alta nas matérias</p><div class="capa-areas">${top.map(([a, n]) => `<button type="button" class="chip area" style="--h:${AREA_COR[a] ?? 222}" data-capa-ar="${a}"><i></i>${esc(AREAS[a] || a)} <span class="n">${n}</span></button>`).join("")}</div>` : ""}
      <p class="capa-dica">${naoLidos ? `Role para começar ${ico("seta")}` : "Desative “Só não lidos” para rever o que já passou."}</p>
    </div></article>`;
  }

  // Ajuda de cada tela: um único "?" ao lado do título. Nas telas com campo de busca,
  // inclui o guia de pesquisa; os exemplos preenchem o campo da própria tela.
  const COMO_BUSCAR = () => `<h3>Como pesquisar</h3>${AJUDA_BUSCA}`;
  const ajuda = (titulo, html) => abrirGaveta("Como funciona", titulo, html);
  document.addEventListener("click", (e) => {
    const c = e.target.closest("#gaveta [data-ex]"); if (!c) return;
    const campo = $("#view .campo-busca input"); if (!campo) return;
    campo.value = c.dataset.ex; campo.dispatchEvent(new Event("input", { bubbles: true })); fecharGaveta(); campo.focus();
  });
  const AJUDA_VIEW = {
    painel: () => ajuda("O que é a Visão geral", `
      <p class="texto-serif">A Visão geral é o ponto de partida do dia: mostra, numa só tela, o que mudou no STJ.</p>
      <ul class="lista-ajuda">
        <li>O botão do alto leva ao <b>Atualize-se</b>, com as novidades ainda não lidas.</li>
        <li>O campo de busca aceita assunto, “tema 1234” ou número de processo e leva à Pesquisa.</li>
        <li>As abas resumem os <b>repetitivos</b> movimentados nos últimos 30 dias, as <b>pautas</b> com temas ou julgamentos na Corte Especial e nas Seções, os <b>destaques</b> do mês e as novidades do <b>Meu radar</b>.</li>
      </ul>`),
    semana: () => ajuda("O que é o Resumo da semana", `
      <p class="texto-serif">${EXPLICA.semana[1]}</p>
      <ul class="lista-ajuda">
        <li>Escolha a semana no filtro de data; os blocos do alto mostram quantos itens há de cada tipo e também servem de filtro.</li>
        <li>É possível agrupar por tipo, matéria ou dia e restringir a uma ou mais matérias.</li>
      </ul>`),
    destaques: (p) => p?.get("aba") === "auto"
      ? ajuda("O que é a Seleção automática", `
        <p class="texto-serif">Triagem feita pelo site sobre todos os acórdãos dos últimos três meses: ficam os julgados de relevância média ou alta, pela pontuação descrita em Sobre (órgão julgador, tese registrada, afetação, superação de entendimento, entre outros critérios).</p>
        <p>Para o Informativo oficial, que é a curadoria do próprio Tribunal, use a outra aba. Para períodos anteriores, use a Pesquisa.</p>${COMO_BUSCAR()}`)
      : ajuda("O que é o Informativo do STJ", `
        <p class="texto-serif">${EXPLICA.info[1]}</p>
        <ul class="lista-ajuda">
          <li>As notas vêm agrupadas por edição; toque na edição para abrir as notas. Por padrão, a lista traz todas as edições; o filtro Período restringe a uma edição, a um intervalo de datas ou às mais recentes.</li>
          <li>Em cada nota é possível ler o inteiro teor, copiar o destaque com a referência e salvar para acompanhar.</li>
        </ul>${COMO_BUSCAR()}`),
    pesquisa: () => ajuda("Como usar a Pesquisa", `
      <p class="texto-serif">Busca nas ementas, teses e referências legislativas de todo o acervo de acórdãos da Corte Especial, das Seções e das Turmas, desde 2000.</p>
      <ul class="lista-ajuda">
        <li>O campo aceita termos ou o número do processo (com ou sem classe e pontos). Pelo número, a busca percorre todo o acervo e as publicações recentes do DJEN.</li>
        <li>Por padrão, a busca abrange todo o acervo e percorre os arquivos mês a mês, do mais recente ao mais antigo, mostrando os resultados à medida que avança. Para respostas imediatas, restrinja o Período (por exemplo, últimos 12 meses).</li>
        <li>As decisões de rotina (Súmula 7, embargos rejeitados, falta de prequestionamento etc.) ficam ocultas; o filtro Exibir as mostra.</li>
        <li>Matéria aceita mais de uma escolha; os demais filtros restringem por órgão, classe, relator e processo.</li>
      </ul>${COMO_BUSCAR()}`),
    repetitivos: () => ajuda("O que são os Precedentes qualificados", `
      <p class="texto-serif">Temas repetitivos, controvérsias, incidentes de assunção de competência (IAC), SIRDR e PUIL do STJ, com a questão submetida, a tese firmada, a situação e os processos vinculados.</p>
      <ul class="lista-ajuda">
        <li>A cor da situação indica: verde, tese firmada ou tema julgado; âmbar, afetado ou em andamento; cinza, cancelado.</li>
        <li>Os filtros mostram os temas com suspensão de processos e os que estão em pauta; em cada tema há a linha do tempo e o link para a página oficial.</li>
      </ul>${COMO_BUSCAR()}`),
    sumulas: (p) => p?.get("aba") === "teses"
      ? ajuda("O que é a Jurisprudência em Teses", `<p class="texto-serif">${EXPLICA.teses[1]}</p>
        <p>As edições aparecem em ordem; toque na edição para ver as teses e os precedentes. Cada tese pode ser copiada com a referência completa ou salva.</p>${COMO_BUSCAR()}`)
      : ajuda("Como usar as Súmulas", `
        <p class="texto-serif">Todos os enunciados do STJ, com o órgão que os aprovou, as datas de julgamento e publicação e a situação atual.</p>
        <ul class="lista-ajuda">
          <li>Por padrão aparecem as vigentes, inclusive as de redação alterada ou revisada; o filtro Situação mostra as canceladas.</li>
          <li>Digite o número para ir direto ao enunciado. O botão de cópia traz o texto com a referência.</li>
        </ul>${COMO_BUSCAR()}`),
    pautas: () => ajuda("O que são as Pautas e publicações", `
      <p class="texto-serif">Processos incluídos nas próximas sessões de julgamento do STJ e, na outra aba, os acórdãos publicados no DJEN que ainda não chegaram ao arquivo mensal de ementas.</p>
      <ul class="lista-ajuda">
        <li>As pautas são atualizadas diariamente e indicam os processos vinculados a temas repetitivos.</li>
        <li>Para ser avisado quando um processo seu entrar em pauta, adicione o número ou a sua OAB no Meu radar.</li>
        <li>Por privacidade, o site não exibe os nomes das partes.</li>
      </ul>`),
    composicao: () => ajuda("Sobre a Composição", `
      <p class="texto-serif">Composição atual do STJ por órgão: Plenário, Corte Especial, Seções, Turmas, conselhos e comissões, conforme o documento oficial publicado pelo Tribunal.</p>
      <ul class="lista-ajuda">
        <li>A rotina do site confere o documento duas vezes ao dia e atualiza a página quando o STJ publica nova versão.</li>
        <li>Toque em um nome para ver o perfil: cargos, órgãos em que atua, contato do gabinete, resumo do currículo oficial e os acórdãos relatados no acervo.</li>
        <li>As fotos, quando disponíveis, vêm do acervo livre do Wikimedia Commons, com o crédito indicado.</li>
      </ul>`),
    verificar: () => ajuda("O que faz a Verificação de petição", `
      <p class="texto-serif">Confere as citações de um texto jurídico: localiza os temas, precedentes e súmulas citados e informa a situação atual de cada um.</p>
      <ul class="lista-ajuda">
        <li>Aponta temas cancelados, revisados ou ainda sem tese e processos citados que são casos-piloto de repetitivos ou estão em pauta.</li>
        <li>Sugere precedentes qualificados com assunto parecido, por semelhança de palavras.</li>
        <li>O arquivo é lido no próprio navegador e não é enviado a nenhum servidor.</li>
      </ul>`),
    sobre: () => ajuda("Sobre esta página", `<p class="texto-serif">Aqui estão as fontes de cada seção, a frequência de atualização, o método de cálculo da relevância e o significado das cores usadas no site.</p>`),
    radar: () => abrirGaveta("Como funciona", "O que o Meu radar faz", `
      <p class="texto-serif">O Meu radar acompanha, por você, os assuntos, processos e advogados que interessam ao seu trabalho. Ele relê os dados do STJ a cada atualização do site (duas vezes ao dia) e aponta o que surgiu desde a sua última visita.</p>
      <h3>Assunto (ex.: “prescrição intercorrente”)</h3>
      <p>O radar procura a expressão, com os sinônimos jurídicos usuais, em cinco fontes:</p>
      <ul class="lista-ajuda">
        <li><b>Recursos repetitivos e IAC</b>: questão submetida e tese firmada. Mostra as teses já fixadas e os temas pendentes, e avisa quando um deles entra em pauta.</li>
        <li><b>Súmulas</b> e <b>Jurisprudência em Teses</b>: os entendimentos consolidados sobre o assunto.</li>
        <li><b>Informativo de Jurisprudência</b>: as notas selecionadas pelo Tribunal.</li>
        <li><b>Acórdãos dos últimos meses</b>: cabeçalho da ementa e tese. Para buscar no texto integral das ementas desde 2000, use o link “Pesquisar em todo o acervo”.</li>
      </ul>
      <p>O <b>Panorama por assunto</b> reúne tudo isso numa página, na ordem em que interessa para a petição: teses vinculantes, temas pendentes, súmulas, teses do Tribunal, Informativo e julgados recentes. A aba <b>Novidades</b> mostra só o que é novo ou mudou, por prioridade.</p>
      <h3>Processo e OAB</h3>
      <ul class="lista-ajuda">
        <li><b>Processo</b>: avisa quando entra em pauta, quando há publicação no DJEN, acórdão divulgado ou vínculo com tema repetitivo.</li>
        <li><b>OAB</b>: mostra os processos em que a inscrição consta nas pautas de julgamento.</li>
      </ul>
      <h3>Como escrever o assunto</h3>
      <ul class="lista-ajuda">
        <li>Use aspas para a expressão exata: <b>"bem de família"</b>.</li>
        <li>Combine com e, ou, não: <b>"plano de saúde" e reembolso</b>; <b>alimentos não gravídicos</b>.</li>
        <li>Trunque com $: <b>prescri$</b>. Para um tema específico: <b>tema 1234</b>.</li>
      </ul>
      <p class="nota">Os dados ficam guardados neste navegador. O link “Copiar link para usar em outro aparelho” leva a mesma configuração para o celular ou outro computador.</p>`),
    salvos: () => ajuda("Como usar os Salvos", `
      <p class="texto-serif">Os Salvos são a sua biblioteca de precedentes. Tudo o que você marca com o marcador, em qualquer tela, aparece aqui.</p>
      <ul class="lista-ajuda">
        <li><b>Pastas</b>: crie uma pasta por tese, cliente ou processo (botão “+” ao lado de “Pastas”) e use “Colocar em pasta” em cada item. Um mesmo precedente pode estar em várias pastas; excluir uma pasta não apaga os itens.</li>
        <li><b>Avaliação</b>: marque o precedente como favorável ou desfavorável à tese que você sustenta. Nas matérias penais, a marcação é em relação à defesa. Os filtros à esquerda separam os favoráveis dos desfavoráveis.</li>
        <li><b>Anotação</b>: registre por que o precedente importa, em que caso usar ou alguma ressalva. A busca no alto também procura nas anotações.</li>
        <li><b>Copiar citações</b>: copia, de uma vez, as citações dos itens exibidos (por exemplo, os favoráveis de uma pasta), prontas para a petição.</li>
      </ul>
      <p class="nota">Os salvos ficam guardados neste navegador. Em “Cópia de segurança” você exporta um arquivo para guardar ou levar a outro aparelho.</p>`),
    atualize: () => abrirGaveta("Como funciona", "O que é o Atualize-se", `
      <p class="texto-serif">O Atualize-se é a leitura rápida do dia: uma novidade do STJ por cartão, com a tese em poucas linhas, para você se manter em dia em alguns minutos.</p>
      <h3>O que entra</h3>
      <ul class="lista-ajuda">
        <li><b>Teses firmadas</b> em recursos repetitivos e <b>acórdãos de repetitivos</b> publicados.</li>
        <li><b>Temas afetados</b> (questões que o STJ vai uniformizar) e <b>repetitivos em pauta</b>.</li>
        <li><b>Notas do Informativo</b>, a seleção oficial do próprio Tribunal.</li>
        <li><b>Julgados das Turmas e Seções</b> com tese legível. Ficam de fora as decisões de rotina (Súmula 7, embargos rejeitados etc.).</li>
      </ul>
      <h3>Em que ordem</h3>
      <p>A ordem sugerida combina relevância e novidade, dá preferência aos assuntos do seu <b>Meu radar</b> e às matérias que você mais lê, e alterna os tipos para a leitura não ficar repetitiva. Em “Ordenar” você troca para “Mais recentes”.</p>
      <h3>Como usar</h3>
      <ul class="lista-ajuda">
        <li>Role a tela ou use as setas do teclado (↑ ↓) para passar de um cartão a outro. O cartão lido fica marcado, e a barra no topo mostra o seu progresso.</li>
        <li>“Só não lidos” esconde o que você já viu. Os filtros restringem por matéria, tipo, período, tese, órgão e relator.</li>
        <li>Nos cartões, é possível abrir o julgado completo, copiar a tese com a referência e <b>salvar</b> para acompanhar no Meu radar. Um toque duplo no cartão também salva.</li>
        <li>O círculo no alto mostra a <b>meta do dia</b> (5, 10 ou 20 novidades) e a sequência de dias úteis em que ela foi cumprida. Toque nele para ver o histórico das últimas semanas e as <b>conquistas</b>, que sobem de nível com a leitura. O progresso fica guardado neste navegador.</li>
      </ul>
      <p class="nota">A seleção é automática, para orientar a leitura; confira sempre o inteiro teor antes de citar.</p>`),
  };
  // Verificar petição: abre o acórdão do acervo localizado pelo número do processo.
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-vf-ac]"); if (!b) return; const [id, m, o, cl, n] = b.dataset.vfAc.split("|"); abrirAcordao({ id, m, o, cl, n }); });
  // Precedente citado em pauta ou em outra lista: abre o detalhe na gaveta, sem trocar de aba.
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-abrir-precedente]"); if (!b) return; e.preventDefault(); const [tp, n] = b.dataset.abrirPrecedente.split("|"); abrirTema(tp, +n); });
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-topo-ajuda]"); if (b) AJUDA_VIEW[b.dataset.topoAjuda]?.(lerHash().p); });
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
        <div class="fd-progl"><div class="feed-prog"><i id="fd-prog"></i></div><span class="feed-cont" id="fd-cont"></span><button type="button" class="hab-chip" id="fd-hab" title="Sua constância: meta do dia, sequência e conquistas" aria-label="Sua constância">${chipHab()}</button></div>
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
      ar: () => (f.ar.length === 1 ? rotMat(f.ar[0]) || "Matéria" : f.ar.length ? `Matéria · ${f.ar.length}` : "Matéria"),
      tp: () => (f.tp.length === 1 ? FEED_TIPOS[f.tp[0]].rot : f.tp.length ? `Tipo · ${f.tp.length}` : "Tipo"),
      per: () => (f.per ? PERIODOS.find((p) => p[0] === f.per)[1] : "Período"),
      tese: () => (f.tese === "com" ? "Com tese" : f.tese === "sem" ? "Sem tese" : "Tese"),
      org: () => (f.org.length === 1 ? f.org[0] : f.org.length ? `Órgão · ${f.org.length}` : "Órgão"),
      rel: () => { const l = listaV(f.rel); return l.length === 1 ? relatorFmt(l[0]) : l.length ? `Relator · ${l.length}` : "Relator"; },
      ord: () => (f.ord === "rec" ? "Ordenar: mais recentes" : "Ordenar: sugerida"),
    };
    const ativo = { ar: () => f.ar.length, tp: () => f.tp.length, per: () => f.per, tese: () => f.tese, org: () => f.org.length, rel: () => f.rel, ord: () => false };
    const desenharFiltros = () => {
      $("#fd-filtros").innerHTML = `<button type="button" class="fpill novos" id="fd-novos" aria-pressed="${soNovos}">${ico("raio")} Só não lidos</button>` + Object.keys(rotulo).map((k) => `<button type="button" class="fpill${k === "ord" ? " ordem" : ""}" data-fp="${k}" aria-pressed="${!!ativo[k]()}" aria-haspopup="dialog">${k === "ord" ? ico("ordem") : ""}${esc(rotulo[k]())}${ico("seta")}</button>`).join("")
        + (nFiltros(f) ? `<button type="button" class="fpill limpar" id="fd-limpar">${ico("x")} Limpar</button>` : "");
    };
    const opcao = (dim, val, txt, n, marcado) => { const h = dim === "ar" && val ? AREA_COR[val] : null; return `<button type="button" class="chip${h != null ? " area" : ""}" data-op="${dim}" data-val="${esc(val)}" aria-pressed="${marcado}"${h != null ? ` style="--h:${h}"` : ""}>${h != null ? "<i></i>" : ""}${esc(txt)} <span class="n">${n === "" ? "" : fmtInt(n)}</span></button>`; };
    function conteudoPop(dim) {
      if (dim === "ar") {
        const c = contarMat(todos.filter((x) => passaFeed(x, f, "ar") && (!soNovos || !lidos()[x.k])), (x) => x.ar, (x) => x.sa);
        return `<h3>Matéria</h3>${htmlMaterias({ cont: c, sel: (v) => f.ar.includes(v), aberta: popAberta, todas: "Todas as matérias", op: (v) => `data-op="ar" data-val="${esc(v)}"` })}<p class="nota">Escolha a matéria e, se quiser, um ou mais assuntos específicos. Dá para marcar mais de uma.</p>`;
      }
      if (dim === "ord") return `<h3>Ordenar por</h3><div class="chips">${[["", "Sugerida para você"], ["rec", "Mais recentes"]].map(([v, txt]) => `<button type="button" class="chip" data-op="ord" data-val="${v}" aria-pressed="${f.ord === v}">${txt}</button>`).join("")}</div><p class="nota">Sugerida: combina relevância, novidade, o seu radar e as matérias que você mais lê, alternando os tipos de novidade.</p>`;
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
        <div class="chips" id="fd-rel-l" style="margin-top:10px">${f.rel ? opcao("rel", "", "Todos", "", false) : ""}${lista.map(([nome, n]) => opcao("rel", nome, nome, n, listaV(f.rel).some((r) => norm(r) === norm(nome)))).join("")}</div>`;
    }
    const pop = $("#fd-pop"), veu = $("#fd-veu");
    let popDim = "", popAberta = "";
    function abrirPop(dim, botao) {
      // Mesmo painel já aberto: redesenha no lugar, mantendo rolagem e texto digitado.
      const mesmo = popDim === dim && !pop.hidden;
      const rol = mesmo ? [pop, ...$$(".mt2-areas, .mt2-subs", pop)].map((el) => el.scrollTop) : [];
      const qAnt = mesmo ? ($("#fd-rel-q", pop)?.value || "") : "";
      if (popDim !== dim) popAberta = dim === "ar" ? (f.ar[0] || "").split("/")[0] : "";
      popDim = dim;
      pop.innerHTML = `<div class="fd-pop-cab"><span class="alca"></span><button type="button" class="btn-ico" data-fechar-pop aria-label="Fechar">${ico("x")}</button></div>${conteudoPop(dim)}`;
      const folha = matchMedia("(max-width: 860px)").matches;
      if (mesmo) {
        [pop, ...$$(".mt2-areas, .mt2-subs", pop)].forEach((el, k) => { if (rol[k] != null) el.scrollTop = rol[k]; });
        const q0 = $("#fd-rel-q", pop);
        if (q0) { q0.value = qAnt; const t = norm(qAnt); $$("#fd-rel-l [data-op]", pop).forEach((b) => { b.hidden = !!t && !!b.dataset.val && !norm(b.dataset.val).includes(t); }); q0.addEventListener("input", () => { const t2 = norm(q0.value); $$("#fd-rel-l [data-op]", pop).forEach((b) => { b.hidden = !!t2 && !!b.dataset.val && !norm(b.dataset.val).includes(t2); }); }); }
        return;
      }
      pop.classList.toggle("folha", folha);
      pop.classList.toggle("largo", dim === "ar");
      if (!folha) {
        const r = botao.getBoundingClientRect();
        pop.style.left = `${Math.max(12, Math.min(r.left, innerWidth - (dim === "ar" ? 676 : 400)))}px`; pop.style.top = `${r.bottom + 8}px`;
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
      const ab = e.target.closest("[data-mt-abrir]");
      if (ab) { popAberta = ab.dataset.mtAbrir; const ar0 = $(".mt2-areas", pop)?.scrollTop || 0; abrirPop("ar", $('[data-fp="ar"]')); const ar1 = $(".mt2-areas", pop); if (ar1) ar1.scrollTop = ar0; const sb = $(".mt2-subs", pop); if (sb) sb.scrollTop = 0; return; }
      const b = e.target.closest("[data-op]"); if (!b) return;
      const { op, val } = b.dataset;
      if (op === "ar" && !val) f.ar = [];
      else if (op === "ar") {
        // Geral e específica não se acumulam: marcar uma desmarca a outra.
        const mae = val.split("/")[0];
        f.ar = f.ar.includes(val) ? f.ar.filter((x) => x !== val) : [...f.ar.filter((x) => (val.includes("/") ? x !== mae : !x.startsWith(val + "/"))), val];
      }
      else if (op === "tp" || op === "org") { f[op] = f[op].includes(val) ? f[op].filter((x) => x !== val) : [...f[op], val]; }
      if (op === "ord") f.ord = val;
      if (op === "per") f.per = +val;
      if (op === "tese") f.tese = val;
      if (op === "rel") { const cur = listaV(f.rel); f.rel = !val ? "" : (cur.some((r) => norm(r) === norm(val)) ? cur.filter((r) => norm(r) !== norm(val)) : [...cur, val]).join("|"); }
      aplicar();
      if (op === "per" || op === "tese" || op === "ord" || (op === "ar" && !val) || (op === "rel" && !val)) fecharPop(); else abrirPop(op, $(`[data-fp="${op}"]`));
    });
    veu.addEventListener("click", fecharPop);
    const foraPop = (e) => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest("[data-fp]")) fecharPop(); };
    document.addEventListener("pointerdown", foraPop);
    $("#fd-filtros").addEventListener("click", (e) => {
      if (e.target.closest("#fd-limpar")) { Object.assign(f, FILTRO_VAZIO(), { ord: f.ord }); fecharPop(); return aplicar(); }
      if (e.target.closest("#fd-novos")) { soNovos = !soNovos; P.feedSoNovos = soNovos; fecharPop(); return aplicar(); }
      const b = e.target.closest("[data-fp]"); if (!b) return;
      if (popDim === b.dataset.fp) return fecharPop();
      abrirPop(b.dataset.fp, b);
    });
    // -------------------------------------------------------------- fila
    const fimHTML = () => {
      const top = Object.entries(sessao.areas).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([a, n]) => `${esc(AREAS[a] || a)} ${n}`).join(" · ");
      if (vis.length && soNovos && !nFiltros(f)) registrarFilaZerada();
      const H = hab(), feitoH = H.dias[hojeISO()] || 0, sqH = sequencia();
      const prox = CONQUISTAS.map((c) => { const v = c.valor(), n = nivelDe(c, v), alvo = c.niveis[n]; return alvo ? { c, falta: alvo - v, fr: v / alvo, alvo } : null; }).filter(Boolean).sort((a, b) => b.fr - a.fr)[0];
      const blocoHab = `<button type="button" class="hab-resumo" data-hab-abrir>${anelHab(44)}<span><b>${feitoH >= H.meta ? "Meta de hoje cumprida" : `${feitoH} de ${H.meta} hoje`}</b>${sqH ? ` · ${sqH > 1 ? `${sqH} dias úteis seguidos` : "1 dia útil"}` : ""}${prox ? `<small>Perto da próxima conquista: ${esc(prox.c.rot)} (faltam ${fmtInt(prox.falta)})</small>` : ""}</span></button>`;
      return `<article class="reel reel-fim" data-i="${vis.length}"><div class="reel-in">
        <div class="vazio-ico" style="margin:0 0 14px">${ico("destaques")}</div>
        <p class="reel-kicker">Fim da fila</p>
        <div class="reel-texto"><p>${vis.length ? "Você está em dia com estas novidades." : "Nada novo nos filtros escolhidos."}</p></div>
        ${blocoHab}
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
      $("#fd-sem-filtro")?.addEventListener("click", () => { Object.assign(f, FILTRO_VAZIO(), { ord: f.ord }); aplicar(); });
    }
    function montar() {
      sairCartao();
      vis = todos.filter((x) => passaFeed(x, f) && (!soNovos || !lidos()[x.k]));
      if (f.ord === "rec") { const hj = hojeISO(); vis.sort((a, b) => (b.tipo === "pauta" ? hj : b.d).localeCompare(a.tipo === "pauta" ? hj : a.d)); }
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
        if (marcarLido(it.k)) { registrarLeitura(it); const c = $("#fd-hab"); if (c) c.innerHTML = chipHab(); }
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
      const k = it.inf ? `i:${it.inf.id}` : it.t ? `t:${it.t.tp}-${it.t.n}` : `a:${it.r.id}`;
      if (forcar && P.salvos[k]) return false;
      if (it.inf) alternarSalvo(k, { k: "i", id: it.inf.id }, botao);
      else if (it.t) alternarSalvo(k, { k: "t", tp: it.t.tp, n: it.t.n }, botao);
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
      const textoIt = it.inf ? citInfo(it.inf) : it.t ? `${it.t.tp} ${it.t.n}/STJ — ${it.t.tese ? "Tese: " + it.t.tese : it.t.q}` : `${it.r.tese || it.r.tj ? (it.r.tese ? "Tese jurídica: " : "Tese de julgamento: ") + (it.r.tese || it.r.tj) + "\n" : ""}${citacao(it.r)}`;
      if (fn === "mais") { $(".reel-texto", el).classList.add("aberto"); b.hidden = true; }
      if (fn === "area") { f.ar = [b.dataset.ar]; aplicar(); toast(`Lendo só ${rotMat(b.dataset.ar)}.`); }
      if (fn === "tema") abrirTema(it.t.tp, it.t.n);
      if (fn === "acordao") abrirAcordao(it.r);
      if (fn === "info") abrirInformativo(it.inf);
      if (fn === "copiar") copiar(textoIt, "Tese e citação copiadas.");
      if (fn === "citacao") copiar(it.inf ? refInfo(it.inf) : citacao(it.r), "Citação copiada.");
      if (fn === "menos") {
        ajustarPeso(it.ar, -3);
        toast(it.ar.length ? `Certo. ${AREAS[it.ar[0]] || "Esta matéria"} vai aparecer menos.` : "Certo, vamos mostrar menos disso.");
        ir(1);
      }
      if (fn === "compartilhar") {
        const url = it.inf ? URL_INFO(it.inf.ed) : it.t ? URLS.tema(it.t.tp, it.t.n) : URLS.inteiroTeor(it.r.reg, it.r.dj);
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
      if ((e.key === "o" || e.key === "Enter") && ativoEl?.dataset.k) $('[data-f="acordao"], [data-f="tema"], [data-f="info"]', ativoEl)?.click();
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

  // ============================================================ COMPOSIÇÃO
  const composicao = () => carregar("composicao", (c) => {
    c.idx = new Map(c.ministros.map((m) => [m.id, m]));
    c.org = new Map(c.orgaos.map((o) => [o.id, o]));
    for (const m of c.ministros) m._n = norm(`${m.nome} ${m.curto}`);
    return c;
  });
  const iniciais = (nome) => String(nome || "").split(/\s+/).filter((w) => w.length > 2 && !/^(de|da|do|dos|das)$/i.test(w)).map((w) => w[0]).filter((c, i, a) => i === 0 || i === a.length - 1).join("").toUpperCase();
  const avatarMin = (m, tam = 48) => m.foto
    ? `<img class="av" src="${esc(m.foto.url)}" alt="" width="${tam}" height="${tam}" loading="lazy" style="width:${tam}px;height:${tam}px" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'av av-ini',textContent:'${iniciais(m.nome)}',style:'width:${tam}px;height:${tam}px'}))">`
    : `<span class="av av-ini" style="width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.36)}px">${iniciais(m.nome)}</span>`;
  const ROT_ORG_CURTO = { "corte-especial": "Corte Especial", "primeira-secao": "1ª Seção", "segunda-secao": "2ª Seção", "terceira-secao": "3ª Seção", "primeira-turma": "1ª Turma", "segunda-turma": "2ª Turma", "terceira-turma": "3ª Turma", "quarta-turma": "4ª Turma", "quinta-turma": "5ª Turma", "sexta-turma": "6ª Turma" };
  const tratamento = (m) => (m.tipo === "convocado" ? (m.genero === "f" ? "Desembargadora convocada" : "Desembargador convocado") : m.genero === "f" ? "Ministra" : "Ministro");
  const linkEmail = (s) => esc(s).replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>');
  const linkTel = (s) => esc(s).replace(/\((\d{2})\)\s*(\d{4})-(\d{4})/g, (m0, dd, a, b) => `<a href="tel:+55${dd}${a}${b}">(${dd}) ${a}-${b}</a>`);

  function membroBtn(x, c, opts = {}) {
    const m = x.mid && c.idx.get(x.mid);
    const cargo = x.cargo ? `<span class="selo ${x.cargo === "Presidente" ? "pri" : ""}">${esc(x.cargo)}</span>` : "";
    const extra = [x.papeis?.join(" e "), x.mandato && !x.cargo ? `mandato ${x.mandato}` : "", x.grupo, opts.ingresso && x.ingresso ? `desde ${fmtData(x.ingresso)}` : "", m?.tipo === "convocado" ? tratamento(m) : x.obs].filter(Boolean).join(" · ");
    if (!m) return `<li class="cp-m cp-vago"><span class="av av-ini" style="width:30px;height:30px;font-size:11px">–</span><span><b>${esc(x.nome)}</b>${extra ? `<small>${esc(extra)}</small>` : ""}</span></li>`;
    return `<li class="cp-m"><button type="button" data-min="${esc(m.id)}">${avatarMin(m, 30)}<span><b>${esc(m.curto)}</b>${cargo}${extra ? `<small>${esc(extra)}</small>` : ""}</span></button></li>`;
  }
  function cardOrgao(o, c, opts = {}) {
    if (!o) return "";
    const pres = o.membros.find((x) => x.cargo === "Presidente");
    const lista = opts.presPrimeiro && pres ? [pres, ...o.membros.filter((x) => x !== pres)] : o.membros;
    return `<section class="card cp-org${opts.cls ? " " + opts.cls : ""}" id="org-${o.id}"${opts.ordem ? ` style="--o:${opts.ordem}"` : ""}>
      <header><h3>${esc(o.nome)}</h3>${o.area ? `<span class="selo">${esc(o.area)}</span>` : ""}<span class="meta">${o.membros.filter((x) => x.mid).length} integrantes</span></header>
      ${pres?.mandato ? `<p class="nota">Presidência: ${esc(pres.mandato)}</p>` : ""}
      <ol class="cp-membros">${lista.map((x) => membroBtn(x, c, { ingresso: /turma/.test(o.id) })).join("")}</ol>
      ${o.sessoes ? `<p class="nota cp-sess">${esc(o.sessoes.join(" ").replace(/^.*?Sessões:\s*/i, "Sessões: "))}</p>` : ""}
      ${(o.notas || []).filter((n) => /^(Coord|Secret)/.test(n)).map((n) => `<p class="nota">${esc(n)}</p>`).join("")}
    </section>`;
  }
  async function vComposicao(main, p) {
    const c = await composicao();
    const aba = ["ministros", "conselhos"].includes(p.get("aba")) ? p.get("aba") : "orgaos";
    main.innerHTML = `
      <div class="card card-pad cp-topo">
        <div>
          <p class="sobretitulo">Composição em ${fmtData(c.data)}</p>
          <h2 class="cp-tit">Ministros, Seções e Turmas do STJ</h2>
          <p class="nota">Conforme a <a href="${esc(c.fontes.composicao)}" target="_blank" rel="noopener">composição oficial publicada pelo STJ ${ico("externo")}</a>. O site confere o documento duas vezes ao dia e atualiza esta página quando o Tribunal publica nova versão. Toque em um nome para ver o perfil e os contatos do gabinete.</p>
        </div>
        <form class="cp-busca" id="cp-f" role="search"><input id="cp-q" type="search" placeholder="Buscar ministro" aria-label="Buscar ministro" autocomplete="off"></form>
      </div>
      <div class="barra-filtros" style="margin-top:18px">
        <div class="segmentos" role="tablist">
          <button type="button" role="tab" data-cp-aba="orgaos" aria-selected="${aba === "orgaos"}">Órgãos julgadores</button>
          <button type="button" role="tab" data-cp-aba="ministros" aria-selected="${aba === "ministros"}">Ministros</button>
          <button type="button" role="tab" data-cp-aba="conselhos" aria-selected="${aba === "conselhos"}">Conselhos e comissões</button>
        </div>
      </div>
      <div id="cp-corpo" style="margin-top:14px"></div>`;
    const corpo = $("#cp-corpo", main);
    const desenhar = (q = "") => {
      const nq = norm(q.trim());
      if (nq) {
        const achados = c.ministros.filter((m) => m._n.includes(nq));
        corpo.innerHTML = achados.length ? `<div class="cp-grade-min">${achados.map((m) => cartaoMin(m)).join("")}</div>` : vazio("composicao", "Nenhum ministro com esse nome", "Confira a grafia ou busque pelo sobrenome.");
        return;
      }
      if (aba === "orgaos") {
        // Grade única, linha a linha (Seções, depois as Turmas), para os cartões ficarem alinhados;
        // no celular, a ordem passa a ser Seção seguida das suas duas Turmas.
        const sec = (id, o) => cardOrgao(c.org.get(id), c, { cls: "cp-secao", ordem: o });
        const tur = (id, o) => cardOrgao(c.org.get(id), c, { presPrimeiro: true, ordem: o });
        corpo.innerHTML = `
          <p class="nota" style="margin:0 0 12px">Cada Seção reúne os integrantes de duas Turmas e julga os recursos repetitivos e os conflitos da respectiva matéria. A Corte Especial reúne os quinze ministros mais antigos.</p>
          <div class="cp-grade3">${sec("primeira-secao", 1)}${sec("segunda-secao", 4)}${sec("terceira-secao", 7)}${tur("primeira-turma", 2)}${tur("terceira-turma", 5)}${tur("quinta-turma", 8)}${tur("segunda-turma", 3)}${tur("quarta-turma", 6)}${tur("sexta-turma", 9)}</div>
          ${cardOrgao(c.org.get("corte-especial"), c, { cls: "cp-ce" })}`;
      } else if (aba === "ministros") {
        const efet = c.ministros.filter((m) => m.tipo === "ministro"), conv = c.ministros.filter((m) => m.tipo !== "ministro");
        corpo.innerHTML = `<p class="nota" style="margin:0 0 12px">Por ordem de antiguidade (data da posse). ${c.ministros.filter((m) => m.foto).length ? "Fotos do acervo livre do Wikimedia Commons, quando disponíveis." : ""}</p>
          <div class="cp-grade-min">${efet.map((m) => cartaoMin(m)).join("")}</div>
          ${conv.length ? `<h2 class="jt-divisor" style="margin-top:22px">Desembargadores convocados</h2><div class="cp-grade-min">${conv.map((m) => cartaoMin(m)).join("")}</div>` : ""}`;
      } else {
        const externos = ["conselho-administracao", "cjf", "enfam", "tse", "cejusc"].map((k) => c.org.get(k)).filter(Boolean);
        corpo.innerHTML = `<div class="cp-grade-org">${externos.map((o) => cardOrgao(o, c)).join("")}</div>
          <h2 class="jt-divisor" style="margin-top:22px">Comissões permanentes</h2>
          <div class="cp-grade-org">${c.comissoes.map((cm) => `<section class="card cp-org"><header><h3>${esc(cm.nome)}</h3></header>${cm.obs ? `<p class="nota">${esc(cm.obs)}</p>` : ""}
            ${cm.membros.length ? `<ol class="cp-membros">${cm.membros.map((x) => membroBtn(x, c)).join("")}</ol>` : `<p class="nota">Sem integrantes indicados na versão atual do documento.</p>`}</section>`).join("")}</div>
          ${c.nota_comissoes ? `<p class="nota" style="margin-top:12px">${esc(c.nota_comissoes)}</p>` : ""}`;
      }
    };
    const cartaoMin = (m) => {
      const jul = (m.orgaos || []).filter((o) => ROT_ORG_CURTO[o.id]);
      const papel = (m.funcoes || [])[0] || (m.obs || "");
      return `<button type="button" class="card cp-cartao" data-min="${esc(m.id)}">${avatarMin(m, 52)}
        <span class="cp-cartao-tx"><b>${esc(m.curto)}</b>
          <small>${m.antiguidade ? `${m.antiguidade}º em antiguidade · ` : ""}${m.posse ? `posse em ${fmtData(m.posse)}` : tratamento(m)}${m.uf ? ` · ${esc(m.uf)}` : ""}</small>
          ${jul.length ? `<small class="cp-orgs">${jul.map((o) => `${ROT_ORG_CURTO[o.id]}${o.cargo === "Presidente" ? " (pres.)" : ""}`).join(" · ")}</small>` : ""}
          ${papel ? `<span class="selo ${/Presidente do STJ|Vice-Presidente do STJ/.test(papel) ? "pri" : ""}">${esc(papel.replace(/ \(.*\)$/, ""))}</span>` : ""}</span></button>`;
    };
    desenhar();
    $$("[data-cp-aba]", main).forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.cpAba === "orgaos" ? "#composicao" : `#composicao?aba=${b.dataset.cpAba}`; }));
    $("#cp-q", main).addEventListener("input", debounce((e) => desenhar(e.target.value), 150));
    $("#cp-f", main).addEventListener("submit", (e) => e.preventDefault());
    if (p.get("m")) abrirMinistro(p.get("m"));
  }
  async function abrirMinistro(id) {
    const c = await composicao();
    const m = c.idx.get(id); if (!m) return;
    const pf = m.perfil || {}, g = m.gabinete;
    const lista = (arr, mais) => `<ul class="lista-ajuda">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${mais ? `<p class="nota">E mais ${mais} item(ns) no currículo oficial.</p>` : ""}`;
    const orgs = (m.orgaos || []).map((o) => `<li><b>${esc(o.nome)}</b>${o.cargo ? ` · ${esc(o.cargo)}` : ""}${o.mandato ? ` (${esc(o.mandato)})` : ""}${o.grupo ? ` · ${esc(o.grupo.replace(/^Membros /, "membro ").toLowerCase())}` : ""}${o.ingresso ? ` · desde ${fmtData(o.ingresso)}` : ""}</li>`).join("");
    const rel = m.curto.replace(/\s*\(.*\)/, "");
    abrirGaveta(m.tipo === "convocado" ? tratamento(m) : `${tratamento(m)} do STJ`, m.curto, `
      <div class="cp-perfil-cab">
        ${m.foto ? `<figure class="cp-foto"><img src="${esc(m.foto.url)}" alt="${esc(m.nome)}" width="132" height="132" onerror="this.closest('figure').remove()"><figcaption><a href="${esc(m.foto.pagina)}" target="_blank" rel="noopener">Foto: ${esc(m.foto.credito)}</a></figcaption></figure>` : avatarMin(m, 96)}
        <div>
          <p class="cp-nome">${esc(m.nome)}</p>
          ${(m.funcoes || []).map((f) => `<span class="selo pri" style="margin:0 6px 6px 0">${esc(f)}</span>`).join("")}${m.obs ? `<span class="selo">${esc(m.obs)}</span>` : ""}
          <p class="meta" style="margin-top:6px">${m.antiguidade ? `<span>${m.antiguidade}º em antiguidade</span>` : ""}${m.posse ? `<span>Posse em ${fmtData(m.posse)}</span>` : ""}${m.uf ? `<span>Origem: ${esc(m.uf)}</span>` : ""}</p>
          ${pf.nascimento ? `<p class="nota">Nascimento: ${esc(pf.nascimento)}</p>` : ""}
        </div>
      </div>
      ${orgs ? `<h3>Onde atua</h3><ul class="lista-ajuda">${orgs}</ul>` : ""}
      ${g ? `<h3>Contato do gabinete</h3><div class="cp-contato">
        ${g.unidade ? `<p><b>${esc(g.unidade)}</b></p>` : ""}
        ${g.chefe ? `<p>Chefia de gabinete: ${esc(g.chefe)}</p>` : ""}
        ${g.telefones ? `<p>Telefone: ${linkTel(g.telefones)}</p>` : ""}
        ${(g.emails || []).map((e) => `<p>${linkEmail(e)}</p>`).join("")}
      </div>` : ""}
      <h3>No acervo</h3>
      <p><a class="link-acao" href="#pesquisa?rl=${encodeURIComponent(rel.toUpperCase())}&p=u12" data-fechar-gav>Acórdãos relatados nos últimos 12 meses ${ico("seta")}</a></p>
      ${pf.funcoes ? `<h3>Funções atuais</h3>${lista(pf.funcoes, pf.funcoes_mais)}` : ""}
      ${pf.formacao ? `<h3>Formação acadêmica</h3>${lista(pf.formacao, pf.formacao_mais)}` : ""}
      ${pf.atividades ? `<details class="cp-det"><summary>Principais atividades exercidas</summary>${lista(pf.atividades, pf.atividades_mais)}</details>` : ""}
      ${pf.outras ? `<details class="cp-det"><summary>Outras atividades</summary>${lista(pf.outras, pf.outras_mais)}</details>` : ""}
      ${pf.docencia ? `<details class="cp-det"><summary>Atividade docente</summary>${lista(pf.docencia, pf.docencia_mais)}</details>` : ""}
      ${pf.condecoracoes ? `<details class="cp-det"><summary>Condecorações</summary>${lista(pf.condecoracoes, pf.condecoracoes_mais)}</details>` : ""}
      ${m.curriculo ? `<p style="margin-top:16px"><a class="link-acao" href="${esc(m.curriculo)}" target="_blank" rel="noopener">Currículo completo no site do STJ ${ico("externo")}</a></p>` : ""}
      <p class="nota" style="margin-top:14px">Dados da composição oficial, da página de ministros e da lista de contatos das unidades, publicadas pelo STJ.</p>`);
    $$("[data-fechar-gav]", $("#gaveta-corpo")).forEach((a) => a.addEventListener("click", fecharGaveta));
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-min]"); if (b && !b.closest("#gaveta")) abrirMinistro(b.dataset.min); });

  // ============================================================== roteador
  const VIEWS = [
    { id: "painel", tit: "Visão geral", sobre: "Painel diário", ico: "painel", fn: vPainel },
    { id: "atualize", tit: "Atualize-se", sobre: "Leitura do dia", ico: "raio", fn: vAtualize, cont2: true },
    { id: "semana", tit: "Resumo da semana", sobre: "O que mudou em 7 dias", ico: "semana", fn: vSemana },
    { id: "radar", tit: "Meu radar", sobre: "Seus interesses", ico: "radar", fn: vRadar, cont: true },
    { id: "salvos", tit: "Salvos", sobre: "Pastas, avaliações e anotações", ico: "salvar", fn: vSalvos, cont3: true },
    { id: "destaques", tit: "Destaques", sobre: "Acórdãos relevantes", ico: "destaques", fn: vDestaques },
    { id: "pesquisa", tit: "Pesquisa de acórdãos", sobre: "Acervo de acórdãos", ico: "pesquisa", fn: vPesquisa },
    { id: "repetitivos", tit: "Precedentes qualificados", sobre: "Repetitivos, IAC e controvérsias", ico: "repetitivos", fn: vRepetitivos },
    { id: "sumulas", tit: "Súmulas e teses", sobre: "Súmulas e Jurisprudência em Teses", ico: "sumulas", fn: vSumulas },
    { id: "pautas", tit: "Pautas e publicações", sobre: "O que vai ser julgado", ico: "pautas", fn: vPautas },
    { id: "composicao", tit: "Composição", sobre: "Ministros, Seções e Turmas", ico: "composicao", fn: vComposicao },
    { id: "verificar", tit: "Verificar petição", sobre: "Conferência de citações", ico: "verificar", fn: vVerificar },
    { id: "sobre", tit: "Sobre o Radar STJ", sobre: "Fontes e método", ico: "sobre", fn: vSobre },
  ];
  function montarNav() {
    $("#menu").innerHTML = VIEWS.map((v, i) => `${v.id === "verificar" ? '<div class="sep"></div>' : ""}<a href="#${v.id}" data-v="${v.id}">${ico(v.ico)}<span>${v.tit === "Precedentes qualificados" ? "Repetitivos" : v.tit === "Pesquisa de acórdãos" ? "Pesquisa" : v.tit === "Pautas e publicações" ? "Pautas" : v.tit === "Visão geral" ? "Visão geral" : v.tit === "Sobre o Radar STJ" ? "Sobre" : v.tit}</span>${v.cont ? '<span class="cont cont-radar" hidden></span>' : ""}${v.cont2 ? '<span class="cont cont-feed" hidden></span>' : ""}${v.cont3 ? '<span class="cont-n cont-salvos" hidden></span>' : ""}</a>`).join("");
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
    fecharGaveta(); fecharPopF();
    if (D.saiFeed) { D.saiFeed(); D.saiFeed = null; }
    const { v, p } = lerHash();
    if (v !== "pesquisa") AC.token++; // interrompe uma busca longa em andamento ao sair da Pesquisa
    const def = VIEWS.find((x) => x.id === v);
    $$("[data-v]").forEach((a) => a.classList.toggle("ativa", a.dataset.v === v));
    $("#topo-titulo").innerHTML = `${esc(def.tit)}${AJUDA_VIEW[def.id] ? ` <button type="button" class="topo-ajuda" data-topo-ajuda="${def.id}" title="Como funciona esta página" aria-label="Como funciona esta página">?</button>` : ""}`;
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
    if (!mesma) main.onclick = main.onsubmit = main.oninput = main.onchange = null;
    try { await def.fn(main, p, mesma); }
    catch (e) {
      console.error(e);
      if (viewAtual !== v) return; // erro de uma tela que o usuário já deixou
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

    const abas = [
      ["rep", "Repetitivos", ev30.length], ["pau", "Pautas", plTema.length + plRel.length ? unicos([...plTema, ...plRel], (p) => `${p.p}|${p.d}|${p.pet || ""}`).length : 0],
      ["des", "Destaques", dsMes.length], ["rad", "Meu radar", configurado ? novosRadar.length : 0],
    ];
    const abaIni = abas.some((a) => a[0] === P.painelAba) ? P.painelAba : "rep";
    main.innerHTML = `
      <section class="hero">
        <p class="sobretitulo">${fmtDiaL(hoje)}</p>
        <h2>O que mudou no STJ?</h2>
        <a class="btn-feed" href="#atualize">${ico("raio")}<span><b>${naoLidos ? `${fmtInt(naoLidos)} novidade${naoLidos > 1 ? "s" : ""} para ler` : "Você está em dia"}</b><small>${naoLidos ? "Leitura rápida, uma tese por vez" : "Rever as últimas teses e julgados"}</small></span>${ico("seta")}</a>
        <form class="hero-busca" id="hero-f" role="search">
          <input id="hero-q" type="search" placeholder="Assunto, “tema 1234” ou número do processo" aria-label="Pesquisar">
          <button class="btn btn-pri" type="submit" aria-label="Pesquisar">${ico("pesquisa")}<span class="so-largo">Pesquisar</span></button>
        </form>
      </section>
      <div class="stats">
        <button type="button" class="stat" data-pn="rep">
          <span class="stat-ico ico-verde">${ico("repetitivos")}</span><span><b>${fmtInt(ev7.length)}</b><span>movimentações em repetitivos (7 dias)</span></span></button>
        <button type="button" class="stat" data-pn="pau">
          <span class="stat-ico ico-verm">${ico("pautas")}</span><span><b>${fmtInt(plRel.length)}</b><span>processos relevantes em pauta (14 dias)</span></span></button>
        <button type="button" class="stat" data-pn="des">
          <span class="stat-ico ico-azul">${ico("destaques")}</span><span><b>${fmtInt(dsMes.length)}</b><span>destaques de ${mesUlt ? fmtMes(mesUlt) : "—"}</span></span></button>
        <button type="button" class="stat" data-pn="rad">
          <span class="stat-ico ico-lar">${ico("radar")}</span><span><b>${configurado ? fmtInt(novosRadar.length) : "—"}</b><span>${configurado ? "novidades no seu radar" : "configure o seu radar"}</span></span></button>
      </div>
      <section class="secao painel-abas">
        <div class="secao-cab"><div class="segmentos" role="tablist" id="pn-abas">${abas.map(([k, l, n]) => `<button type="button" role="tab" data-pn="${k}" aria-selected="${k === abaIni}">${l}${k === "rad" && n ? ` <span class="n">${n > 99 ? "99+" : n}</span>` : ""}</button>`).join("")}</div>
          <a class="link-acao" id="pn-ver" href="#repetitivos?s=mov">Ver todos ${ico("seta")}</a></div>
        <div id="pn-corpo"></div>
      </section>`;
    const lista = (html) => `<div class="card card-pad"><ol class="eventos">${html}</ol></div>`;
    const PAINEL = {
      rep: { href: "#repetitivos?s=mov", html: () => ev30.length ? lista(ev30.slice(0, 6).map((e) => `
            <li class="evento" data-tema="${esc(e.t.tp)}|${e.t.n}"><span class="quando">${fmtData(e.d)}</span><span class="marco"><i class="${e.k}"></i></span>
              <div><div class="evento-tit"><button type="button" data-abrir-tema>${esc(e.t.tp)} ${e.t.n} · ${esc(e.txt)}</button></div>
              <div class="evento-txt">${esc(e.t.tese ? "Tese: " + e.t.tese : e.t.q || "")}</div></div></li>`).join("")) : `<div class="card card-pad"><p class="nota">Nenhuma movimentação nos últimos 30 dias.</p></div>` },
      pau: { href: "#pautas?rel=1", html: () => { const l = unicos([...plTema, ...plRel.filter((p) => !p.temas?.length)], (p) => `${p.p}|${p.d}|${p.pet || ""}`).slice(0, 6);
        return l.length ? lista(l.map((p) => `
            <li class="evento"><span class="quando">${fmtData(p.d)}</span><span class="marco"><i class="pauta"></i></span>
              <div><div class="evento-tit">${esc(p.p)}${p.pet ? ` (${esc(p.pet)})` : ""} · ${esc(D.orgaos[p.o] || "")}</div>
              <div class="evento-txt">${p.temas?.length ? `Vinculado a ${p.temas.map(([tp, n]) => `${tp} ${n}`).join(", ")}` : `Rel. ${esc(p.rel || "")}`}</div></div></li>`).join("")) : `<div class="card card-pad"><p class="nota">Nenhuma sessão relevante nos próximos dias.</p></div>`; } },
      des: { href: "#destaques", html: () => `<ol class="lista" id="painel-dest">${dsMes.slice().sort((a, b) => b.s - a.s).slice(0, 3).map((r) => cardAcordao(r)).join("")}</ol>` },
      rad: { href: "#radar", html: () => configurado ? (radar.length ? lista(radar.slice(0, 6).map(itemRadarCompacto).join("")) : `<div class="card card-pad"><p class="nota">Nada encontrado ainda para os seus assuntos.</p></div>`)
        : `<div class="card card-pad"><p class="texto-serif" style="margin-bottom:12px">Cadastre os assuntos que você acompanha, os números dos seus processos ou a sua OAB. O site avisa quando houver novidade.</p><a class="btn btn-pri" href="#radar">${ico("mais1")} Configurar meu radar</a></div>` },
    };
    const mostrar = (k) => {
      P.painelAba = k; salvarP();
      $$("#pn-abas [data-pn]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.pn === k)));
      $("#pn-corpo").innerHTML = PAINEL[k].html();
      $("#pn-ver").href = PAINEL[k].href;
      const ul = $("#painel-dest"); if (ul) ligarCards(ul);
    };
    $$("[data-pn]", main).forEach((b) => b.addEventListener("click", () => { mostrar(b.dataset.pn); if (b.classList.contains("stat")) $(".painel-abas").scrollIntoView({ behavior: "smooth", block: "start" }); }));
    mostrar(abaIni);
    $("#hero-f").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = $("#hero-q").value.trim(); if (!q) return;
      const tm = /^tema\s*:?\s*(\d+)$/i.exec(q);
      if (tm) location.hash = `#repetitivos?q=${tm[1]}&tipo=Tema`;
      else if (/^[\d.\s/-]{5,}$/.test(q)) location.hash = `#pesquisa?n=${digitos(q)}&p=u12`;
      else location.hash = `#pesquisa?q=${encodeURIComponent(q)}&p=u3`;
    });
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
      <div class="evento-txt">${esc(txt)}</div><div class="meta" style="margin-top:2px"><span>por “${esc(it.termo.replace(/"/g, ""))}”</span></div></div></li>`;
  }

  // ============================================================ MEU RADAR
  const TIPO_RADAR = { tema: "Repetitivo", acordao: "Acórdão", informativo: "Informativo", pauta: "Em pauta", djen: "Publicação no DJEN" };
  function areasItem(it) { return it.obj?.ar || (it.tipo === "pauta" && it.temaObj?.ar) || []; }
  function subsItem(it) { return it.obj?.sa || (it.tipo === "pauta" && it.temaObj?.sa) || []; }
  // Publicação do DJEN salva: quando o acórdão chega ao acervo, o salvo passa a ser o acórdão completo.
  async function promoverSalvosDjen() {
    const ds = Object.entries(P.salvos).filter(([k]) => k.startsWith("d:"));
    if (!ds.length) return 0;
    const ix = await carregar("numeros").catch(() => null); if (!ix) return 0;
    const porReg = new Map(); for (const x of ix.l) if (!porReg.has(x[1])) porReg.set(x[1], []); 
    for (const x of ix.l) porReg.get(x[1]).push(x);
    let n = 0;
    for (const [k, o] of ds) {
      const hits = (porReg.get(o.reg) || []).filter((x) => ix.m[x[2]] >= o.d.slice(0, 7));
      if (!hits.length) continue;
      const lst = await carregarShards([...new Set(hits.map((x) => `${ix.m[x[2]]}|${ix.o[x[3]]}`))].map((z) => z.split("|")));
      const ids = new Set(hits.map((x) => String(x[4])));
      const cand = lst.filter((r) => ids.has(String(r.id))).sort((a, b) => Math.abs(new Date(a.dj) - new Date(o.d)) - Math.abs(new Date(b.dj) - new Date(o.d)))[0];
      if (!cand) continue;
      P.salvos[`a:${cand.id}`] = { ...minimoAcordao(cand), salvoEm: o.salvoEm };
      delete P.salvos[k]; n++;
    }
    if (n) { salvarP(); toast(n === 1 ? "Um acórdão salvo ganhou a ementa completa." : `${n} acórdãos salvos ganharam a ementa completa.`); }
    return n;
  }
  // Botão de salvar genérico (temas, notas, pautas e publicações do DJEN).
  const SALVAVEIS = new Map();
  function botaoSalvar(k, obj) {
    SALVAVEIS.set(k, obj);
    const s = !!P.salvos[k];
    return `<button type="button" class="btn-ico btn-salvar" data-salvar="${esc(k)}" aria-pressed="${s}" title="${s ? "Remover dos salvos" : "Salvar para acompanhar"}" aria-label="Salvar">${ico("salvar")}</button>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-salvar]"); if (!b) return;
    const k = b.dataset.salvar, obj = SALVAVEIS.get(k) || P.salvos[k]; if (!obj) return;
    alternarSalvo(k, obj, b); b.title = P.salvos[k] ? "Remover dos salvos" : "Salvar para acompanhar";
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-acomp-proc]"); if (!b) return;
    const v = b.dataset.acompProc; if (!P.procs.some((x) => digitos(x) === digitos(v))) { P.procs.push(v); salvarP(); atualizarContadorRadar?.(); }
    toast("Processo incluído no Meu radar: avisa quando entrar em pauta ou tiver acórdão."); b.remove();
  });
  const RES_DJEN = { Negando: "negou provimento", "Não Conhecendo": "não conheceu", Concedendo: "deu provimento ou concedeu", "Admitindo Embargo": "acolheu os embargos" };
  const chaveDjen = (o) => `d:${o.reg}|${o.d}|${o.r || ""}`;
  // Acórdão publicado no DJEN cuja ementa ainda não está no arquivo mensal do STJ.
  function cardDjen(o, { por = "", novo = "", nivel = "", nota = "" } = {}) {
    const tit = o.r ? `${o.r} no ${o.p}` : o.p;
    const res = RES_DJEN[o.t] ? `O STJ ${RES_DJEN[o.t]}` : "";
    return `<li class="card item item-radar item-djen">
      <div class="item-cab">${nivel}<span class="item-tit">${esc(tit)}</span><span class="selo acomp">Acórdão publicado</span>${novo}
        <span class="meta"><span>DJEN ${fmtData(o.d)}</span>${D.orgaos[o.tr] ? `<span>${esc(D.orgaos[o.tr])}</span>` : ""}${o.rel ? `<span>Rel. ${esc(titulo(o.rel))}</span>` : ""}</span></div>
      <p class="texto-serif djen-res">${res ? `${esc(res)}. ` : ""}${nota || "A ementa entra no site quando o STJ divulgar o arquivo mensal de acórdãos, em regra nos primeiros dias do mês seguinte à publicação."}</p>
      <div class="acoes"><a class="link-acao" href="${URLS.inteiroTeor(o.reg, o.d)}" target="_blank" rel="noopener">Inteiro teor oficial ${ico("externo")}</a>
        <a class="link-acao" href="${URLS.processo(o.reg)}" target="_blank" rel="noopener">Consulta processual ${ico("externo")}</a>${por || (P.procs.some((x) => digitos(x) === digitos(o.p)) ? "" : `<button type="button" class="link-acao" data-acomp-proc="${esc(o.p)}">${ico("radar")} Acompanhar o processo</button>`)}
        <span class="dir">${botaoSalvar(chaveDjen(o), { k: "d", p: o.p, r: o.r, t: o.t, rel: o.rel, reg: o.reg, d: o.d, tr: o.tr })}</span></div></li>`;
  }
  function cardPauta(o, { por = "", novo = "", nivel = "" } = {}) {
    return `<li class="card item item-radar">
        <div class="item-cab">${nivel}<span class="item-tit">${esc(o.p)}${o.pet ? ` (${esc(o.pet)})` : ""}</span><span class="selo alta">Em pauta</span>${novo}
          <span class="meta"><span>${fmtDiaL(o.d)}${o.d.slice(0, 4) !== hojeISO().slice(0, 4) ? ` de ${o.d.slice(0, 4)}` : ""}</span><span>${esc(D.orgaos[o.o] || "")}</span>${o.rel ? `<span>Rel. ${esc(o.rel)}</span>` : ""}</span></div>
        ${o.temas?.length ? `<p class="texto-serif">Vinculado a ${o.temas.map(([tp, n]) => `${esc(tp)} ${n}`).join(", ")}.</p>` : ""}
        <div class="acoes"><a class="link-acao" href="${URLS.processo(o.reg)}" target="_blank" rel="noopener">Consulta processual ${ico("externo")}</a>${por}
          <span class="dir">${botaoSalvar(`p:${o.reg}|${o.d}`, { k: "p", p: o.p, pet: o.pet, d: o.d, o: o.o, rel: o.rel, reg: o.reg, temas: o.temas })}</span></div></li>`;
  }
  function itemRadarLinha(it, termos) {
    const o = it.obj;
    const novo = it.novo ? '<span class="selo novo">Novo</span>' : "";
    const nivel = `<span class="ponto ${it.nivel}" title="${NIVEL_TX[it.nivel] || ""}"></span>`;
    const areas = seloMat(areasItem(it), subsItem(it));
    const por = `<span class="meta"><span>por “${esc(it.termo.replace(/"/g, ""))}”</span></span>`;
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
          <a class="link-acao" href="${URLS.inteiroTeor(o.reg, o.dj)}" target="_blank" rel="noopener">Inteiro teor oficial ${ico("externo")}</a>${por}
          <span class="dir"><button type="button" class="btn-ico btn-salvar" data-a="salvar" aria-pressed="${!!P.salvos[`a:${o.id}`]}" title="Salvar para acompanhar" aria-label="Salvar">${ico("salvar")}</button></span></div></li>`;
    }
    if (it.tipo === "tema") {
      return `<li class="card item item-radar" data-tema="${esc(o.tp)}|${o.n}">
        <div class="item-cab">${nivel}<button type="button" class="item-tit item-abrir" data-abrir-tema>${esc(o.tp)} ${o.n}</button>${seloSit(o.sit)}${it.pauta ? `<span class="selo alta">Em pauta ${fmtData(it.pauta.d)}</span>` : ""}${novo}
          <span class="meta"><span>${esc(o.org || "")}</span>${o._mov ? `<span>Últ. mov. ${fmtData(o._mov)}</span>` : ""}</span></div>
        ${areas ? `<div class="item-sel">${areas}</div>` : ""}
        ${o.tese ? `<div class="tese compacta"><b>Tese firmada</b><p>${destacar(esc(o.tese), termos)}</p></div>` : `<p class="texto-serif">${destacar(esc(o.q || ""), termos)}</p>`}
        <div class="acoes"><button type="button" class="link-acao" data-abrir-tema>Detalhes e linha do tempo ${ico("seta")}</button>
          <a class="link-acao" href="${URLS.tema(o.tp, o.n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>${por}
          <span class="dir">${botaoSalvar(`t:${o.tp}-${o.n}`, { k: "t", tp: o.tp, n: o.n })}</span></div></li>`;
    }
    if (it.tipo === "informativo") {
      return `<li class="card item item-radar info" data-info="${esc(o.id)}">
        <div class="item-cab">${nivel}<button type="button" class="item-tit item-abrir" data-a-info="abrir">${o.p?.[0] ? `${esc(o.p[0].cl)} ${fmtNumProc(o.p[0].n)}` : "Nota do Informativo"}</button>${novo}
          <span class="meta"><span>${esc(o.org || o.sec || "")}</span><span>Informativo ${o.ed}</span></span></div>
        <div class="item-sel"><span class="selo info">Informativo</span>${areas}</div>
        <p class="info-tema">${destacar(esc(o.tema), termos)}</p>
        <div class="tese compacta"><b>Destaque</b><p>${destacar(esc(o.t.replace(/\n/g, " ")), termos)}</p></div>
        <div class="acoes"><button type="button" class="link-acao" data-a-info="abrir">Ler a nota completa ${ico("seta")}</button>${por}
          <span class="dir">${botaoSalvar(`i:${o.id}`, { k: "i", id: o.id })}</span></div></li>`;
    }
    if (it.tipo === "pauta") return cardPauta(o, { por, novo, nivel });
    return cardDjen(o, { por, novo, nivel });
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
    if (p.get("aba") === "salvos") { location.replace("#salvos"); return; } // endereço antigo: os salvos têm aba própria
    const aba = ["novidades", "assunto"].includes(p.get("aba")) ? p.get("aba") : (P.termos.length ? "assunto" : "novidades");
    const F = { nivel: "", tipo: "", area: "", termo: "", s: "pri" };
    const vazioRadar = !P.termos.length && !P.procs.length && !P.oabs.length;
    main.innerHTML = `
      <div class="card card-pad radar-topo">
        <div class="radar-cab">
          <div class="radar-acomp"><h3>Você acompanha</h3><div class="tags" id="rd-todos"></div></div>
          <button type="button" class="btn btn-claro btn-peq" id="rd-gerir" aria-expanded="${vazioRadar}">${ico("mais1")} Adicionar</button>
        </div>
        <div class="painel-filtros${vazioRadar ? "" : " fechado"}" id="rd-edit"><div>
          <div class="radar-forms">
            <div class="radar-bloco t-termos"><h3>Assunto</h3>
              <form class="adicionar" data-lista="termos"><input placeholder='Ex.: "prescrição intercorrente"' aria-label="Novo assunto"><button class="btn btn-pri" type="submit" aria-label="Adicionar">${ico("mais1")}</button></form>
              <p class="nota">Aceita "frase", e, ou, não, prescri$ e tema 1234.</p></div>
            <div class="radar-bloco t-procs"><h3>Processo</h3>
              <form class="adicionar" data-lista="procs"><input placeholder="Ex.: REsp 2222623" aria-label="Novo processo"><button class="btn btn-pri" type="submit" aria-label="Adicionar">${ico("mais1")}</button></form>
              <p class="nota">Avisa quando entrar em pauta ou tiver acórdão.</p></div>
            <div class="radar-bloco t-oabs"><h3>OAB</h3>
              <form class="adicionar" data-lista="oabs"><input placeholder="Ex.: RS 12345" aria-label="Nova OAB"><button class="btn btn-pri" type="submit" aria-label="Adicionar">${ico("mais1")}</button></form>
              <p class="nota">Mostra seus processos nas próximas pautas.</p></div>
          </div>
          <div class="sugestoes" id="rd-sug"></div>
          <button type="button" class="btn btn-fant btn-peq" id="rd-link" style="margin-top:10px">${ico("link")} Copiar link para usar em outro aparelho</button>
        </div></div>
      </div>
      <div class="barra-filtros" style="justify-content:space-between;margin-top:20px">
        <div class="segmentos" role="tablist">
          <button type="button" role="tab" data-aba="assunto" aria-selected="${aba === "assunto"}">Panorama por assunto</button>
          <button type="button" role="tab" data-aba="novidades" aria-selected="${aba === "novidades"}">Novidades</button>
        </div>
        <button type="button" class="btn btn-fant btn-peq" id="rd-visto" hidden>Marcar tudo como visto</button>
      </div>
      <div class="fd-filtros filtros-lista" id="rd-pil" hidden></div>
      <div id="rd-corpo" style="margin-top:6px"></div>`;
    const SUGESTOES = ['"prescrição intercorrente"', '"plano de saúde"', '"dano moral" e "in re ipsa"', '"honorários advocatícios"', '"recuperação judicial"', '"alimentos"', '"bem de família"', '"execução fiscal"'];
    const ROT_K = { termos: "Assunto", procs: "Processo", oabs: "OAB" };
    const redesenharTags = () => {
      const tags = ["termos", "procs", "oabs"].flatMap((k) => P[k].map((v, i) => `<span class="tag t-${k}" title="${ROT_K[k]}">${esc(v)}<button type="button" data-rm="${k}|${i}" aria-label="Remover ${esc(v)}">${ico("x")}</button></span>`));
      $("#rd-todos", main).innerHTML = tags.join("") || `<span class="nota">Nada ainda. Adicione um assunto, um processo ou a sua OAB.</span>`;
      const sug = SUGESTOES.filter((s) => !P.termos.includes(s)).slice(0, 5);
      $("#rd-sug", main).innerHTML = sug.length && P.termos.length < 3 ? `<p class="nota" style="margin-top:14px">Sugestões:</p><div class="chips" style="margin-top:6px">${sug.map((s) => `<button type="button" class="chip" aria-pressed="false" data-sug='${esc(s)}'>${ico("mais1")} ${esc(s.replace(/"/g, ""))}</button>`).join("")}</div>` : "";
    };
    redesenharTags();
    $$("form.adicionar", main).forEach((f) => f.addEventListener("submit", (e) => {
      e.preventDefault();
      const k = f.dataset.lista, inp = $("input", f); let v = inp.value.trim(); if (!v) return;
      if (k === "oabs") { const o = normOAB(v); if (!o) return toast("Informe UF e número, por exemplo RS 12345."); v = o; }
      if (k === "procs" && !digitos(v)) return toast("Informe o número do processo.");
      if (!P[k].includes(v)) P[k].push(v);
      salvarP(); inp.value = "";
      if (k === "termos" && aba !== "assunto" && !p.get("aba")) { D.radarPan = v; gravarHash("radar", { aba: "assunto" }); atualizarContadorRadar(); return vRadar(main, new URLSearchParams("aba=assunto")); }
      if (k === "termos") D.radarPan = v;
      redesenharTags(); render(); atualizarContadorRadar();
    }));
    $("#rd-gerir", main).addEventListener("click", (e) => { const pf = $("#rd-edit", main); pf.classList.toggle("fechado"); e.currentTarget.setAttribute("aria-expanded", String(!pf.classList.contains("fechado"))); });
    $(".radar-topo", main).addEventListener("click", (e) => {
      const s = e.target.closest("[data-sug]");
      if (s) { P.termos.push(s.dataset.sug); salvarP(); redesenharTags(); render(); atualizarContadorRadar(); return; }
      const b = e.target.closest("[data-rm]"); if (!b) return;
      const [k, i] = b.dataset.rm.split("|"); P[k].splice(+i, 1); salvarP(); redesenharTags(); render(); atualizarContadorRadar();
    });
    $("#rd-link").addEventListener("click", () => {
      const cod = btoa(unescape(encodeURIComponent(JSON.stringify({ termos: P.termos, procs: P.procs, oabs: P.oabs }))));
      copiar(`${location.origin}${location.pathname}#radar?importar=${encodeURIComponent(cod)}`, "Link do radar copiado.");
    });
    $$("[data-aba]", main).forEach((b) => b.addEventListener("click", () => { gravarHash("radar", { aba: b.dataset.aba }); vRadar(main, new URLSearchParams(`aba=${b.dataset.aba}`)); }));
    let contNv = {}, contTp = {}, contAr = {};
    const pil = pilulas($("#rd-pil", main), [
      { rot: "Prioridade", tipo: "um", get: () => F.nivel, set: (v) => (F.nivel = v), opcoes: () => [{ v: "", t: "Todas", n: contNv[""] }, { v: "novo", t: "Só novos", n: contNv.novo },
        { v: "alta", t: "Alta", n: contNv.alta, ponto: "alta" }, { v: "rel", t: "Relevante", n: contNv.rel, ponto: "rel" }, { v: "acomp", t: "Acompanhar", n: contNv.acomp, ponto: "acomp" }],
        nota: "Alta: tema em pauta ou movimentado há menos de 30 dias, processo seu em pauta ou acórdão de alta relevância. Relevante: tema em andamento, acórdão relevante ou publicado no seu processo." },
      { rot: "Tipo", tipo: "varios", get: () => F.tipo, set: (v) => (F.tipo = v), opcoes: () => [{ v: "", t: "Tudo" }, ...[["tema", "Repetitivos"], ["acordao", "Acórdãos"], ["informativo", "Informativo"], ["pauta", "Pautas"], ["djen", "Publicações no DJEN"]].filter(([k]) => contTp[k]).map(([k, t]) => ({ v: k, t, n: contTp[k] }))] },
      { rot: "Assunto", tipo: "varios", get: () => F.termo, set: (v) => (F.termo = v), opcoes: () => [{ v: "", t: "Todos" }, ...[...new Set(lista.map((x) => x.termo))].map((x) => ({ v: x, t: x }))] },
      { rot: "Matéria", tipo: "materia", get: () => F.area, set: (v) => (F.area = v), cont: () => contAr },
      defOrdem(() => F.s, (v) => (F.s = v), [{ v: "pri", t: "Prioridade" }, { v: "rec", t: "Mais recentes" }, { v: "termo", t: "Assunto acompanhado" }],
        "Prioridade: primeiro o que é novo desde a sua última visita, depois por nível (alta, relevante, acompanhar) e data."),
    ], () => { pgRd.pag = 1; desenhar(); });
    $("#rd-visto", main).addEventListener("click", () => { P.vistoEm = hojeISO(); salvarP(); atualizarContadorRadar(); render(); toast("Tudo marcado como visto."); });

    let lista = [];
    const pgRd = paginador("rd", () => desenhar(), "#rd-corpo");
    async function render() {
      const corpo = $("#rd-corpo", main);
      if (aba === "assunto") { $("#rd-pil", main).hidden = true; $("#rd-visto", main).hidden = true; return renderPanorama(corpo); }
      if (!P.termos.length && !P.procs.length && !P.oabs.length) {
        $("#rd-pil", main).hidden = true; $("#rd-visto", main).hidden = true;
        corpo.innerHTML = vazio("radar", "Seu radar está vazio", "Adicione acima os assuntos que você acompanha, ou toque em uma das sugestões. O site mostra o que surgiu, por prioridade, e marca o que é novo desde a sua última visita.");
        return;
      }
      corpo.innerHTML = esqueleto();
      const [t, pl] = await Promise.all([temas(), pautas()]);
      lista = await calcularRadar();
      for (const it of lista) if (it.tipo === "pauta" && it.obj.temas?.length) { const [tp, n] = it.obj.temas[0]; it.temaObj = t.idx.get(`${tp}-${n}`); }
      void pl;
      $("#rd-pil", main).hidden = false; $("#rd-visto", main).hidden = false;
      pgRd.pag = 1; desenhar();
    }
    function desenhar() {
      contTp = {}; lista.filter((x) => temV(F.termo, x.termo)).forEach((x) => (contTp[x.tipo] = (contTp[x.tipo] || 0) + 1));
      const base = lista.filter((x) => temV(F.tipo, x.tipo) && temV(F.termo, x.termo));
      contNv = { "": base.length, novo: 0, alta: 0, rel: 0, acomp: 0 }; base.forEach((x) => { contNv[x.nivel]++; if (x.novo) contNv.novo++; });
      const b2 = base.filter((x) => !F.nivel || (F.nivel === "novo" ? x.novo : x.nivel === F.nivel));
      contAr = contarMat(b2, areasItem, subsItem);
      pil.desenhar();
      const vis = b2.filter((x) => casaMat(F.area, areasItem(x), subsItem(x)));
      if (F.s === "rec") vis.sort((a, b) => String(b.dNovo || b.d).localeCompare(String(a.dNovo || a.d)));
      if (F.s === "termo") vis.sort((a, b) => a.termo.localeCompare(b.termo, "pt-BR") || (ordNivel(a.nivel) - ordNivel(b.nivel)));
      const termos = [...new Set(vis.map((x) => x.termo))].flatMap((q) => (/^tema\s*:?\s*\d+$/i.test(q.trim()) ? [] : Busca.compilar(q).termos));
      const corpo = $("#rd-corpo", main);
      corpo.innerHTML = `
        <div class="barra-res"><p><b>${fmtInt(vis.length)}</b> resultado(s) · novidades contadas desde ${fmtData(P.vistoEm)}</p></div>
        ${vis.length ? `<ol class="lista" id="rd-lista">${pgRd.fatia(vis).map((x) => itemRadarLinha(x, termos)).join("")}</ol>${pgRd.html(vis.length)}` : vazio("radar", "Nada neste filtro", "Troque os filtros acima para ver os demais resultados.")}`;
      const ul = $("#rd-lista", main); if (ul) ligarCards(ul);
    }
    // Panorama: o estado da jurisprudência do STJ sobre cada assunto acompanhado.
    async function renderPanorama(corpo) {
      if (!P.termos.length) {
        corpo.innerHTML = vazio("radar", "Nenhum assunto acompanhado", `O panorama reúne, para cada assunto, as teses repetitivas, os temas pendentes, as súmulas, a Jurisprudência em Teses, as notas do Informativo e os acórdãos recentes. Adicione um assunto acima${P.procs.length || P.oabs.length ? "; processos e OABs aparecem em “Novidades”" : ""}.`);
        return;
      }
      const sel = P.termos.includes(D.radarPan) ? D.radarPan : P.termos[0];
      corpo.innerHTML = esqueleto();
      const [t, ix, pl, inf, sm, jt] = await Promise.all([temas(), indice(), pautas(), informativos().catch(() => []), sumulas().catch(() => []), tesesJT().catch(() => [])]);
      const tm = /^tema\s*:?\s*(\d+)$/i.exec(sel.trim());
      const cons = tm ? null : Busca.compilar(sel);
      const casa = (txt) => cons.testa(txt);
      const emPauta = temasEmPauta(pl);
      const temasA = t.filter((x) => (x.tp === "Tema" || x.tp === "IAC") && (tm ? x.tp === "Tema" && x.n === +tm[1] : casa(x._n)));
      const firmadas = temasA.filter((x) => x.tese && x._g !== "cancelado").sort((a, b) => String(b.julg || b._mov).localeCompare(String(a.julg || a._mov)));
      const pendentes = temasA.filter((x) => !x.tese && x._g === "andamento").sort((a, b) => (!!emPauta.get(`${b.tp}-${b.n}`) - !!emPauta.get(`${a.tp}-${a.n}`)) || String(b._mov).localeCompare(String(a._mov)));
      const sums = tm ? [] : sm.filter((x) => casa(x._n)).sort((a, b) => ((a.sit === "cancelada") - (b.sit === "cancelada")) || b.n - a.n);
      const jts = tm ? [] : jt.filter((x) => casa(x._n)).sort((a, b) => b.ed - a.ed || a.n - b.n);
      const infs = inf.filter((x) => (tm ? x.tr === +tm[1] : casa(x._n))).sort((a, b) => String(b.d).localeCompare(String(a.d)));
      const rT = tm ? reTema(tm[1]) : null;
      const acs = ix.filter((r) => (tm ? rT.test(r._n) : casa(r._n)));
      const acsTese = acs.filter((r) => r.tese || r.tj);
      const porOrg = {}; acs.forEach((r) => (porOrg[r.o] = (porOrg[r.o] || 0) + 1));
      const termos = tm ? [] : cons.termos;
      const q = encodeURIComponent(sel);
      // Com aspas, a expressão exata pode deixar de fora enunciados redigidos de outro modo (ex.: "prescrição quinquenal intercorrente").
      let ampliar = 0;
      if (!tm && /"/.test(sel)) {
        const cl = Busca.compilar(sel.replace(/"/g, ""));
        if (!cl.vazio) ampliar = sm.filter((x) => cl.testa(x._n)).length - sums.length + jt.filter((x) => cl.testa(x._n)).length - jts.length
          + t.filter((x) => (x.tp === "Tema" || x.tp === "IAC") && cl.testa(x._n)).length - temasA.length;
      }
      const meses = [...new Set(ix.map((r) => r.m))].sort();
      const perIx = meses.length ? `${fmtMesL(meses[0])} a ${fmtMesL(meses[meses.length - 1])}` : "últimos meses";
      const bloco = (id, tit, n, sub, conteudo, link) => `<section class="pan-bloco" id="pan-${id}">
          <header><h3>${tit}</h3><span class="pan-n">${fmtInt(n)}</span>${sub ? `<span class="nota">${sub}</span>` : ""}${link && n ? `<a class="link-acao dir" href="${link}">Ver todos ${ico("seta")}</a>` : ""}</header>
          ${n ? conteudo : `<p class="nota pan-nada">Nada encontrado nesta fonte.</p>`}</section>`;
      const stat = (id, n, rot) => `<a class="pan-stat${n ? "" : " zero"}" href="#pan-${id}" data-pan-ir="${id}"><b>${fmtInt(n)}</b><span>${rot}</span></a>`;
      corpo.innerHTML = `
        ${P.termos.length > 1 ? `<div class="chips pan-termos" role="tablist">${P.termos.map((x) => `<button type="button" class="chip" role="tab" data-pan-t="${esc(x)}" aria-pressed="${x === sel}">${esc(x.replace(/"/g, ""))}</button>`).join("")}</div>` : ""}
        <div class="card card-pad pan-resumo">
          <p class="sobretitulo">Panorama do assunto</p>
          <h2 class="pan-tit">${esc(sel.replace(/"/g, ""))}</h2>
          <p class="nota">${tm ? `Tudo o que se refere ao Tema ${tm[1]} dos recursos repetitivos.` : `O radar procura ${esc(cons.explicacao)} nos textos abaixo, com os sinônimos jurídicos usuais. Para mudar a abrangência, use aspas para expressão exata, “ou” para alternativas e “não” para excluir.`}</p>
          <div class="pan-stats">
            ${stat("rep", firmadas.length, "teses repetitivas firmadas")}${stat("pend", pendentes.length, "temas pendentes de julgamento")}${stat("sum", sums.length, "súmulas")}
            ${stat("jt", jts.length, "teses da Jurisprudência em Teses")}${stat("inf", infs.length, "notas do Informativo")}${stat("ac", acs.length, `acórdãos (${perIx})`)}
          </div>
          ${ampliar > 0 ? `<p class="pan-ampliar">Sem as aspas (palavras em qualquer ordem), o panorama traria mais ${ampliar} súmula(s), tese(s) ou tema(s). <button type="button" class="link-acao" data-pan-ampliar>Acompanhar sem aspas</button></p>` : ""}
          <p class="nota" style="margin-top:12px">Os acórdãos do panorama são os dos últimos meses, conferidos no cabeçalho da ementa e na tese. <a class="link-acao" href="#pesquisa?q=${q}&p=todo">Pesquisar o inteiro teor das ementas em todo o acervo ${ico("seta")}</a></p>
        </div>
        ${bloco("rep", "Teses firmadas em repetitivos e IAC", firmadas.length, "Vinculam os demais órgãos do Judiciário (art. 927, III, do CPC).", `<ol class="lista">${firmadas.slice(0, 5).map((x) => linhaTema(x, emPauta.get(`${x.tp}-${x.n}`) ? `<span class="selo alta">Em pauta</span>` : "", termos)).join("")}</ol>`, `#repetitivos?q=${q}&tipo=todos`)}
        ${bloco("pend", "Temas afetados, ainda sem tese", pendentes.length, "Questões que o STJ vai uniformizar; confira se há suspensão de processos.", `<ol class="lista">${pendentes.slice(0, 5).map((x) => { const pt = emPauta.get(`${x.tp}-${x.n}`); return linhaTema(x, pt ? `<span class="selo alta">Em pauta ${fmtData(pt[0].d)}</span>` : "", termos); }).join("")}</ol>`, `#repetitivos?q=${q}&tipo=todos`)}
        ${bloco("sum", "Súmulas", sums.length, sums.some((x) => x.sit === "cancelada") ? "As canceladas aparecem por último." : "", `<ol class="lista">${sums.slice(0, 5).map((x) => cardSumula(x, termos)).join("")}</ol>`, `#sumulas?q=${q}&sit=`)}
        ${bloco("jt", "Jurisprudência em Teses", jts.length, "Entendimentos reiterados, selecionados pelo próprio Tribunal.", `<div class="card"><ol class="jt-teses plano">${jts.slice(0, 5).map((x) => linhaTeseJT(x, termos, true)).join("")}</ol></div>`, `#sumulas?aba=teses&q=${q}`)}
        ${bloco("inf", "Notas do Informativo", infs.length, "Mais recentes primeiro.", `<ol class="lista-notas">${infs.slice(0, 4).map((x) => cardInformativo(x, termos)).join("")}</ol>`, `#destaques?q=${q}`)}
        ${bloco("ac", "Acórdãos recentes", acs.length, `${fmtInt(acsTese.length)} com tese destacada. ${Object.entries(porOrg).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([o, n]) => `${esc(D.orgaos[o] || o)}: ${n}`).join(" · ")}`,
          `<ol class="lista" id="pan-ac">${[...acsTese, ...acs.filter((r) => !(r.tese || r.tj))].slice(0, 5).map((r) => cardAcordao(r, { termos })).join("")}</ol>`, `#pesquisa?q=${q}&p=u3`)}`;
      $$("[data-pan-t]", corpo).forEach((b) => b.addEventListener("click", () => { D.radarPan = b.dataset.panT; renderPanorama(corpo); }));
      $$("[data-pan-ir]", corpo).forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); $(`#pan-${a.dataset.panIr}`, corpo)?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
      $("[data-pan-ampliar]", corpo)?.addEventListener("click", () => {
        const novo = sel.replace(/"/g, "").trim(), i = P.termos.indexOf(sel);
        if (i >= 0 && !P.termos.includes(novo)) P.termos[i] = novo; D.radarPan = novo; salvarP(); redesenharTags(); renderPanorama(corpo); atualizarContadorRadar();
      });
      const ul = $("#pan-ac", corpo); if (ul) ligarCards(ul);
    }
    render();
  }

  // ================================================================== SALVOS
  // Biblioteca pessoal: pastas à esquerda (por tema, cliente ou processo) e, à direita, os itens
  // da pasta com filtros por tipo, matéria e avaliação, busca nas anotações e cópia das citações.
  const TIPOS_S = [["a", "Acórdãos"], ["d", "Aguardando ementa"], ["t", "Repetitivos e IAC"], ["j", "Jurisprudência em Teses"], ["i", "Informativo"], ["p", "Pautas"]];
  const SV = { pasta: "", tp: "", aval: "", ar: "", q: "", ord: "rec" };
  const tipoSalvo = (x, k) => x.k || k[0];
  const dataSalvo = (x) => x.dj || x.dd || x.d || x.disp || x.salvoEm || "";
  function atualizarContadorSalvos() {
    const n = Object.keys(P.salvos).length;
    $$(".cont-salvos").forEach((el) => { el.textContent = n > 999 ? "999+" : n; el.hidden = !n; });
  }
  async function vSalvos(main, p) {
    if (p.has("pasta")) SV.pasta = p.get("pasta");
    main.innerHTML = esqueleto();
    await promoverSalvosDjen();
    const temJ = Object.keys(P.salvos).some((k) => k.startsWith("j:"));
    const [t, inf, jt] = await Promise.all([temas().catch(() => ({ idx: new Map() })), informativos().catch(() => ({ idx: new Map() })), temJ ? tesesJT().catch(() => ({ idx: new Map() })) : { idx: new Map() }]);
    if (viewAtual !== "salvos") return;
    const pg = paginador("sv", () => desenharLista(), "#sv-lista");
    main.innerHTML = `<div class="sv${P.svCompacto ? " sv-compacto" : ""}">
      <aside class="sv-lado card" id="sv-lado" aria-label="Pastas"></aside>
      <section class="sv-principal"><div id="sv-cab"></div><div id="sv-filtros"></div><div id="sv-lista"></div><div id="sv-pag"></div></section></div>`;
    const lado = $("#sv-lado", main), cab = $("#sv-cab", main), filtros = $("#sv-filtros", main), lista = $("#sv-lista", main);

    // Dados de cada salvo: cartão, matérias e texto para a busca.
    let itens = [];
    const montar = () => {
      itens = Object.entries(P.salvos).map(([k, x]) => {
        const tp = tipoSalvo(x, k);
        let li = "", ar = x.ar || [], ref = "", extra = "";
        if (tp === "t") { const o = t.idx.get(`${x.tp}-${x.n}`); li = o ? linhaTema(o) : ""; ar = o?.ar || []; extra = `${o?.tese || ""} ${o?.q || ""}`; ref = `${o?.tese ? `“${o.tese.trim().replace(/\.$/, "")}” ` : ""}(STJ, ${x.tp === "Tema" ? "Tema repetitivo" : x.tp} n. ${fmtNumProc(x.n)}.)`; }
        else if (tp === "i") { const o = inf.idx.get(x.id); li = o ? cardInformativo(o) : ""; ar = o?.ar || []; extra = `${o?.tema || ""} ${o?.t || ""}`; ref = o ? citInfo(o) : ""; }
        else if (tp === "d") { li = cardDjen(x); ref = `${x.p || ""}`; }
        else if (tp === "j") { const o = jt.idx.get(x.id); li = o ? `<li class="card jt-salva"><ol class="jt-teses plano">${linhaTeseJT(o, [], true)}</ol></li>` : ""; ar = o?.ar || []; extra = o?.t || ""; ref = o ? `“${o.t.trim().replace(/\.$/, "")}” (STJ, Jurisprudência em Teses, edição n. ${o.ed}, tese n. ${o.n}.)` : ""; }
        else if (tp === "p") { li = cardPauta(x); ref = `${x.p || ""}`; }
        else { li = cardAcordao({ ...x, em: "", h: x.h }); extra = `${x.h || ""} ${x.tese || ""} ${x.tj || ""}`; ref = citavel(x) ? citacao(x) : `${x.cl} ${fmtNumProc(x.n)}`; }
        return { k, x, tp, li, ar, ref, txt: norm(`${tituloSalvo(x, k)} ${extra} ${x.nota || ""} ${(x.pastas || []).join(" ")}`) };
      }).filter((i) => i.li);
    };
    const naPasta = (i) => !SV.pasta || (SV.pasta === "_sem" ? !(i.x.pastas || []).length : (i.x.pastas || []).includes(SV.pasta));
    const passa = (i, ignora = "") => naPasta(i)
      && (ignora === "tp" || !SV.tp || i.tp === SV.tp)
      && (ignora === "aval" || !SV.aval || (i.x.aval || "_") === SV.aval)
      && (ignora === "ar" || !SV.ar || i.ar.includes(SV.ar))
      && (!SV.q || norm(SV.q).split(/\s+/).every((w) => i.txt.includes(w)));
    const visiveis = () => itens.filter((i) => passa(i)).sort(SV.ord === "data" ? (a, b) => dataSalvo(b.x).localeCompare(dataSalvo(a.x)) : (a, b) => (b.x.salvoEm || "").localeCompare(a.x.salvoEm || ""));
    const nomePasta = () => (SV.pasta === "_sem" ? "Sem pasta" : SV.pasta || "Todos os salvos");

    function desenharLado() {
      const cont = (f) => itens.filter(f).length;
      const btn = (attr, val, icone, rot, n, atual) => `<button type="button" class="sv-it" ${attr}="${esc(val)}"${atual ? ' aria-current="true"' : ""}>${ico(icone)}<span class="sv-rot">${esc(rot)}</span><span class="n">${fmtInt(n)}</span></button>`;
      const ps = [...pastas()].sort((a, b) => a.localeCompare(b, "pt-BR"));
      lado.innerHTML = `<nav class="sv-nav">
          ${btn("data-sv-pasta", "", "salvar", "Todos os salvos", itens.length, !SV.pasta)}
          ${btn("data-sv-pasta", "_sem", "arquivo", "Sem pasta", cont((i) => !(i.x.pastas || []).length), SV.pasta === "_sem")}
          <div class="sv-grupo"><span>Pastas</span><button type="button" class="btn-ico" data-sv-nova title="Nova pasta" aria-label="Nova pasta">${ico("mais1")}</button></div>
          <form class="sv-nova" id="sv-nova" hidden><input placeholder="Nome da pasta" aria-label="Nome da nova pasta" maxlength="60"><button class="btn btn-pri btn-peq" type="submit">Criar</button></form>
          ${ps.map((pn) => btn("data-sv-pasta", pn, "pasta", pn, cont((i) => (i.x.pastas || []).includes(pn)), SV.pasta === pn)).join("") || `<p class="nota sv-dica">Crie pastas por tese, cliente ou processo. Um precedente pode ficar em mais de uma.</p>`}
          <div class="sv-grupo"><span>Avaliação</span></div>
          ${btn("data-sv-aval", "fav", "polegar", "Favoráveis", cont((i) => naPasta(i) && i.x.aval === "fav"), SV.aval === "fav")}
          ${btn("data-sv-aval", "desf", "polegar-b", "Desfavoráveis", cont((i) => naPasta(i) && i.x.aval === "desf"), SV.aval === "desf")}
          ${btn("data-sv-aval", "_", "circulo", "Não avaliados", cont((i) => naPasta(i) && !i.x.aval), SV.aval === "_")}
        </nav>
        <div class="sv-rodape"><button type="button" class="link-acao" data-sv-backup>${ico("arquivo")} Cópia de segurança</button></div>`;
    }
    function desenharCab() {
      const vis = visiveis();
      const ehPasta = SV.pasta && SV.pasta !== "_sem";
      cab.innerHTML = `<div class="sv-cab">
          <div><h2>${esc(nomePasta())}</h2><p class="nota">${fmtInt(vis.length)} ${vis.length === 1 ? "item" : "itens"}${SV.tp || SV.aval || SV.ar || SV.q ? " no filtro" : ""}</p></div>
          <div class="acoes">
            ${vis.length ? `<button type="button" class="btn btn-fant btn-peq" data-sv-compacto aria-pressed="${!!P.svCompacto}" title="Alterna entre a lista resumida e os cartões completos">${P.svCompacto ? "Ver completo" : "Ver resumido"}</button>` : ""}
            ${vis.length > 1 ? `<label class="sv-ord" title="Ordenar">${ico("ordem")}<select id="sv-ord" aria-label="Ordenar"><option value="rec"${SV.ord === "rec" ? " selected" : ""}>Salvos por último</option><option value="data"${SV.ord === "data" ? " selected" : ""}>Data da decisão</option></select></label>` : ""}
            ${vis.some((i) => i.ref) ? `<button type="button" class="btn btn-claro btn-peq" data-sv-citar title="Copia as citações dos itens exibidos, uma por parágrafo">${ico("citar")} Copiar citações</button>` : ""}
            ${ehPasta ? `<button type="button" class="btn btn-fant btn-peq" data-sv-renomear>Renomear</button><button type="button" class="btn btn-fant btn-peq" data-sv-excluir>Excluir pasta</button>` : `<button type="button" class="btn btn-fant btn-peq sv-so-movel" data-sv-backup>Cópia de segurança</button>`}
          </div></div>`;
    }
    function desenharFiltros() {
      const base = itens.filter((i) => passa(i, "tp"));
      const contT = {}; base.forEach((i) => (contT[i.tp] = (contT[i.tp] || 0) + 1));
      const baseA = itens.filter((i) => passa(i, "ar"));
      const contA = {}; baseA.forEach((i) => i.ar.forEach((a) => (contA[a] = (contA[a] || 0) + 1)));
      const tipos = TIPOS_S.filter(([k]) => contT[k] || SV.tp === k);
      const areas = Object.keys(AREAS).filter((a) => contA[a] || SV.ar === a);
      filtros.innerHTML = `<div class="sv-filtros">
          <div class="campo-busca sv-busca">${ico("pesquisa")}<input type="search" id="sv-q" placeholder="Buscar nos salvos e nas suas anotações" value="${esc(SV.q)}" aria-label="Buscar nos salvos"></div>
          ${tipos.length > 1 || SV.tp ? `<div class="chips">${`<button type="button" class="chip" data-sv-tp="" aria-pressed="${!SV.tp}">Todos</button>`}${tipos.map(([k, r]) => `<button type="button" class="chip" data-sv-tp="${k}" aria-pressed="${SV.tp === k}">${r} <span class="n">${fmtInt(contT[k] || 0)}</span></button>`).join("")}</div>` : ""}
          ${areas.length > 1 || SV.ar ? `<div class="chips sv-areas">${areas.map((a) => `<button type="button" class="chip area" style="--h:${AREA_COR[a] ?? 222}" data-sv-ar="${a}" aria-pressed="${SV.ar === a}"><i></i>${esc(AREAS[a] || a)} <span class="n">${fmtInt(contA[a] || 0)}</span></button>`).join("")}</div>` : ""}
        </div>`;
    }
    function barra(i) {
      const x = i.x, penal = ehPenal(i.ar);
      return `<div class="salvo-org" data-sv-k="${esc(i.k)}">
          <div class="sv-org-l">
            ${(x.pastas || []).map((pn) => `<button type="button" class="tag-pasta" data-sv-pasta="${esc(pn)}" title="Abrir a pasta">${ico("pasta")}${esc(pn)}</button>`).join("")}
            <button type="button" class="tag-pasta tag-add" data-organizar="${esc(i.k)}">${ico("mais1")}${(x.pastas || []).length ? "Pasta" : "Colocar em pasta"}</button>
          </div>
          <div class="sv-aval" role="group" aria-label="Avaliação">
            <button type="button" data-sv-av="fav" aria-pressed="${x.aval === "fav"}" title="${penal ? "Favorável à defesa" : "Favorável à tese que você sustenta"}">${ico("polegar")}${rotAval("fav", penal)}</button>
            <button type="button" data-sv-av="desf" aria-pressed="${x.aval === "desf"}" title="${penal ? "Desfavorável à defesa" : "Desfavorável à tese que você sustenta"}">${ico("polegar-b")}${rotAval("desf", penal)}</button>
          </div>
          ${x.nota ? `<button type="button" class="salvo-nota" data-organizar="${esc(i.k)}" title="Editar anotação">${esc(x.nota)}</button>` : `<button type="button" class="link-acao sv-anotar" data-organizar="${esc(i.k)}">Anotar</button>`}
        </div>`;
    }
    function desenharLista() {
      const vis = visiveis();
      if (!itens.length) {
        lista.innerHTML = vazio("salvar", "Nenhum item salvo", "Use o marcador nos acórdãos, temas, notas do Informativo, teses, pautas e publicações do DJEN. Os itens aparecem aqui, onde você pode separá-los em pastas, avaliá-los e anotá-los.");
        $("#sv-pag", main).innerHTML = ""; return;
      }
      if (!vis.length) {
        const pastaVazia = SV.pasta && SV.pasta !== "_sem" && !itens.some(naPasta);
        lista.innerHTML = vazio(pastaVazia ? "pasta" : "filtro", pastaVazia ? "Pasta vazia" : "Nada neste filtro", pastaVazia ? "Em “Todos os salvos”, use “Colocar em pasta” no item desejado." : "Limpe a busca ou troque os filtros.", `<button type="button" class="btn btn-claro btn-peq" data-sv-limpar>${pastaVazia ? "Ver todos os salvos" : "Limpar filtros"}</button>`);
        $("#sv-pag", main).innerHTML = ""; return;
      }
      const dj = vis.some((i) => i.tp === "d") ? `<p class="nota" style="margin:0 0 8px">Os acórdãos salvos a partir do DJEN passam a exibir a ementa assim que o STJ divulgar o arquivo mensal.</p>` : "";
      lista.innerHTML = `${dj}<ol class="lista" id="sv-ol">${pg.fatia(vis).map((i) => i.li.replace(/<\/li>\s*$/, `${barra(i)}</li>`)).join("")}</ol>`;
      $("#sv-pag", main).innerHTML = pg.html(vis.length);
      ligarCards($("#sv-ol", lista));
    }
    const tudo = (reset = true) => { montar(); if (reset) pg.pag = 1; desenharLado(); desenharCab(); desenharFiltros(); desenharLista(); gravarHash("salvos", { pasta: SV.pasta }); };
    const parcial = () => { pg.pag = 1; desenharCab(); desenharLista(); desenharLado(); };

    main.onclick = async (e) => {
      const el = (sel) => e.target.closest(sel);
      let b;
      if ((b = el("[data-sv-pasta]"))) { SV.pasta = b.dataset.svPasta; SV.tp = ""; SV.ar = ""; tudo(); scrollTo({ top: 0, behavior: "smooth" }); return; }
      if ((b = el("[data-sv-aval]"))) { SV.aval = SV.aval === b.dataset.svAval ? "" : b.dataset.svAval; tudo(); return; }
      if ((b = el("[data-sv-tp]"))) { SV.tp = b.dataset.svTp; desenharFiltros(); parcial(); return; }
      if ((b = el("[data-sv-ar]"))) { SV.ar = SV.ar === b.dataset.svAr ? "" : b.dataset.svAr; desenharFiltros(); parcial(); return; }
      if (el("[data-sv-limpar]")) { if (SV.pasta && !itens.some(naPasta)) SV.pasta = ""; Object.assign(SV, { tp: "", aval: "", ar: "", q: "" }); tudo(); return; }
      if ((b = el("[data-sv-av]"))) {
        const k = b.closest("[data-sv-k]").dataset.svK, x = P.salvos[k]; if (!x) return;
        x.aval = x.aval === b.dataset.svAv ? undefined : b.dataset.svAv; salvarP();
        $$("[data-sv-av]", b.parentElement).forEach((o) => o.setAttribute("aria-pressed", String(o.dataset.svAv === x.aval)));
        montar(); desenharLado(); desenharCab(); return;
      }
      if ((b = el("[data-organizar]"))) { organizarSalvo(b.dataset.organizar); return; }
      if (el("[data-sv-compacto]")) { P.svCompacto = !P.svCompacto || undefined; salvarP(); main.querySelector(".sv").classList.toggle("sv-compacto", !!P.svCompacto); desenharCab(); return; }
      if (el("[data-sv-nova]")) { const f = $("#sv-nova", lado); f.hidden = !f.hidden; if (!f.hidden) $("input", f).focus(); return; }
      if (el("[data-sv-backup]")) { gerenciarPastas(); return; }
      if (el("[data-sv-citar]")) {
        const refs = visiveis().map((i) => i.ref).filter(Boolean);
        copiar(refs.join("\n\n"), `${refs.length} citaç${refs.length === 1 ? "ão copiada" : "ões copiadas"}.`); return;
      }
      if (el("[data-sv-renomear]")) {
        const h2 = $("h2", cab);
        h2.outerHTML = `<form class="sv-ren" id="sv-ren"><input value="${esc(SV.pasta)}" maxlength="60" aria-label="Novo nome da pasta"><button class="btn btn-pri btn-peq" type="submit">Salvar</button><button class="btn btn-fant btn-peq" type="button" data-sv-ren-cancelar>Cancelar</button></form>`;
        const inp = $("#sv-ren input", cab); inp.focus(); inp.select(); return;
      }
      if (el("[data-sv-ren-cancelar]")) { desenharCab(); return; }
      if (el("[data-sv-excluir]")) {
        const nome = SV.pasta, antes = { pastas: [...pastas()], salvos: Object.fromEntries(Object.entries(P.salvos).map(([k, x]) => [k, [...(x.pastas || [])]])) };
        P.pastas = pastas().filter((x) => x !== nome);
        for (const x of Object.values(P.salvos)) if (x.pastas) x.pastas = x.pastas.filter((y) => y !== nome);
        SV.pasta = ""; salvarP(); tudo();
        toast(`Pasta “${nome}” excluída. Os itens continuam salvos.`, { rot: "Desfazer", fn: () => { P.pastas = antes.pastas; for (const [k, l] of Object.entries(antes.salvos)) if (P.salvos[k]) P.salvos[k].pastas = l; SV.pasta = nome; salvarP(); avisarSalvos(); } });
      }
    };
    main.onsubmit = (e) => {
      if (e.target.id === "sv-ren") {
        e.preventDefault();
        const velho = SV.pasta, novo = $("input", e.target).value.trim().replace(/\s+/g, " ");
        if (!novo || novo === velho) { desenharCab(); return; }
        if (pastas().some((x) => x !== velho && norm(x) === norm(novo))) { toast("Já existe uma pasta com esse nome."); return; }
        P.pastas = pastas().map((x) => (x === velho ? novo : x));
        for (const x of Object.values(P.salvos)) if (x.pastas) x.pastas = x.pastas.map((y) => (y === velho ? novo : y));
        SV.pasta = novo; salvarP(); tudo(); return;
      }
      if (e.target.id !== "sv-nova") return;
      e.preventDefault();
      const nome = $("input", e.target).value.trim().replace(/\s+/g, " "); if (!nome) return;
      const existente = pastas().find((x) => norm(x) === norm(nome));
      if (!existente) pastas().push(nome);
      SV.pasta = existente || nome; salvarP(); tudo();
      toast(`Pasta “${SV.pasta}” pronta. Use “Colocar em pasta” nos itens para incluí-los.`);
    };
    main.oninput = (e) => {
      if (e.target.id !== "sv-q") return;
      SV.q = e.target.value; clearTimeout(vSalvos.t);
      vSalvos.t = setTimeout(() => { desenharCab(); desenharLista(); }, 180);
    };
    main.onchange = (e) => { if (e.target.id === "sv-ord") { SV.ord = e.target.value; pg.pag = 1; desenharLista(); } };
    const aoMudar = () => { if (viewAtual !== "salvos" || !document.contains(lado)) { document.removeEventListener("salvos-mudou", aoMudar); return; } if (SV.pasta && SV.pasta !== "_sem" && !pastas().includes(SV.pasta)) SV.pasta = ""; tudo(false); };
    document.addEventListener("salvos-mudou", aoMudar);
    tudo(false);
  }

  // ================================================= paginação
  // Páginas numeradas ("1 2 3 4 5 … 37") e escolha de itens por página (10, 25, 50), iguais em todas as listas.
  const POR_PAG = [10, 25, 50];
  const porPag = () => (POR_PAG.includes(P.porPag) ? P.porPag : 10);
  const PAGINADORES = new Map();
  function paginador(id, desenhar, alvo) {
    const pg = {
      pag: 1,
      ir(n) { pg.pag = n; desenhar(); const el = alvo && document.querySelector(alvo); if (el) { const y = el.getBoundingClientRect().top + scrollY - 90; if (y < scrollY) scrollTo({ top: y, behavior: "smooth" }); } },
      fatia(l) { const pp = porPag(), n = Math.max(1, Math.ceil(l.length / pp)); if (pg.pag > n) pg.pag = n; if (pg.pag < 1) pg.pag = 1; return l.slice((pg.pag - 1) * pp, pg.pag * pp); },
      html(total) { return htmlPaginas(id, total, pg.pag); },
    };
    PAGINADORES.set(id, pg);
    return pg;
  }
  function htmlPaginas(id, total, pag) {
    const pp = porPag(), n = Math.max(1, Math.ceil(total / pp));
    if (total <= POR_PAG[0]) return "";
    const nums = [];
    const faixa = (a, b) => { for (let i = a; i <= b; i++) nums.push(i); };
    if (n <= 7) faixa(1, n);
    else if (pag <= 4) { faixa(1, 5); nums.push("…", n); }
    else if (pag >= n - 3) { nums.push(1, "…"); faixa(n - 4, n); }
    else { nums.push(1, "…"); faixa(pag - 1, pag + 1); nums.push("…", n); }
    const ini = (pag - 1) * pp + 1, fim = Math.min(total, pag * pp);
    return `<nav class="paginas" data-pag="${id}" aria-label="Páginas">
      <span class="pag-info">${fmtInt(ini)}–${fmtInt(fim)} de ${fmtInt(total)}</span>
      ${n > 1 ? `<div class="pag-nums"><button type="button" class="pag-seta" data-ir="${pag - 1}" ${pag <= 1 ? "disabled" : ""} aria-label="Página anterior">${ico("seta", "gira")}</button>
        ${nums.map((x) => (x === "…" ? `<span class="pag-reti">…</span>` : `<button type="button" data-ir="${x}" ${x === pag ? 'aria-current="page"' : ""} aria-label="Página ${x}">${x}</button>`)).join("")}
        <button type="button" class="pag-seta" data-ir="${pag + 1}" ${pag >= n ? "disabled" : ""} aria-label="Próxima página">${ico("seta")}</button></div>` : ""}
      <div class="pag-por" role="group" aria-label="Itens por página"><span>Por página</span>${POR_PAG.map((v) => `<button type="button" data-por="${v}" aria-pressed="${v === pp}">${v}</button>`).join("")}</div>
    </nav>`;
  }
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-pag]"); if (!nav) return;
    const pg = PAGINADORES.get(nav.dataset.pag); const b = e.target.closest("[data-ir],[data-por]"); if (!pg || !b || b.disabled) return;
    if (b.dataset.por) { P.porPag = +b.dataset.por; salvarP(); pg.ir(1); } else pg.ir(+b.dataset.ir);
  });

  // ================================================= filtros em pílulas
  // Um botão por filtro; as opções abrem num popover (computador) ou numa
  // folha inferior (celular). Mantém a tela limpa e igual em todas as abas.
  const POPF = { el: null, veu: null, raiz: null, i: -1 };
  function garantirPopF() {
    if (POPF.el) return;
    POPF.veu = document.createElement("div"); POPF.veu.className = "fd-veu"; POPF.veu.hidden = true;
    POPF.el = document.createElement("div"); POPF.el.className = "fd-pop"; POPF.el.hidden = true; POPF.el.setAttribute("role", "dialog");
    document.body.append(POPF.veu, POPF.el);
    POPF.veu.addEventListener("click", fecharPopF);
    document.addEventListener("pointerdown", (e) => { if (!POPF.el.hidden && !POPF.el.contains(e.target) && !e.target.closest("[data-pil]")) fecharPopF(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharPopF(); });
  }
  // Enquanto um filtro está aberto, a página não encolhe: assim ela não "sobe" quando a lista fica menor.
  const travarAltura = () => { const h = document.documentElement.scrollHeight; if (!POPF.trava) document.body.style.minHeight = `${h}px`; POPF.trava = true; };
  const soltarAltura = () => { if (POPF.trava) { POPF.trava = false; document.body.style.minHeight = ""; } };
  function fecharPopF() {
    soltarAltura();
    if (!POPF.el || POPF.el.hidden) return;
    POPF.el.classList.remove("vis"); POPF.veu.classList.remove("vis"); POPF.raiz = null; POPF.i = -1; POPF.aberta = "";
    setTimeout(() => { if (!POPF.el.classList.contains("vis")) { POPF.el.hidden = true; POPF.veu.hidden = true; } }, 200);
  }
  // Filtros de escolha múltipla guardados como texto: "a|b|c".
  const listaV = (v) => String(v ?? "").split("|").filter(Boolean);
  const temV = (v, x) => !v || listaV(v).includes(String(x ?? ""));
  function pilulas(raiz, defs, aoMudar) {
    garantirPopF();
    const vazioDe = (d) => (d.tipo === "multi" ? [] : d.tipo === "toggle" ? false : d.tipo === "varios" ? "" : (d.padrao ?? ""));
    const ativo = (d) => (d.tipo === "multi" ? d.get().length > 0 : d.tipo === "toggle" ? !!d.get() : String(d.get() ?? "") !== String(d.padrao ?? ""));
    const rot = (d) => {
      if (d.tipo === "toggle" || !ativo(d)) return d.rotAtual ? d.rotAtual() : d.rot;
      if (d.tipo === "multi") { const v = d.get(); const o = d.opcoes().find((x) => x.v === v[0]); return v.length === 1 ? (o?.t || d.rot) : `${d.rot} · ${v.length}`; }
      if (d.tipo === "texto") return `${d.rot}: ${d.get()}`;
      if (d.tipo === "varios") { const l = listaV(d.get()); if (!l.length) return d.rotTodos || d.rot; const o = d.opcoes().find((x) => String(x.v) === l[0]); return l.length === 1 ? (o?.curto || o?.t || l[0]) : `${d.rot} · ${l.length}`; }
      if (d.tipo === "materia") { const l = listaMat(d.get()); return l.length > 1 ? `Matéria · ${l.length}` : rotMat(d.get()); }
      const o = d.opcoes().find((x) => String(x.v) === String(d.get())); return o ? (o.curto || o.t) : d.rotValor ? d.rotValor(d.get()) : d.rot;
    };
    function desenhar() {
      const n = defs.filter((d) => ativo(d) && !d.semLimpar).length;
      raiz.innerHTML = defs.map((d, i) => `<button type="button" class="fpill${d.tipo === "toggle" ? " toggle" : ""}${d.cls ? " " + d.cls : ""}" data-pil="${i}" aria-pressed="${ativo(d)}"${d.tipo !== "toggle" ? ' aria-haspopup="dialog"' : ""}${d.dica ? ` title="${esc(d.dica)}"` : ""}>${d.ico ? ico(d.ico) : ""}${esc(rot(d))}${d.tipo !== "toggle" ? ico("seta") : ""}</button>`).join("")
        + (n ? `<button type="button" class="fpill limpar" data-pil-limpar>${ico("x")} Limpar</button>` : "");
    }
    function conteudo(d) {
      const ops = d.opcoes ? d.opcoes() : [];
      const v = d.get();
      const chip = (o) => {
        const m = d.tipo === "multi" ? v.includes(o.v) : d.tipo === "varios" ? (o.v === "" ? !listaV(v).length : listaV(v).includes(String(o.v))) : String(v ?? "") === String(o.v);
        return `<button type="button" class="chip${o.h != null ? " area" : ""}" data-op="${esc(String(o.v))}" aria-pressed="${m}"${o.h != null ? ` style="--h:${o.h}"` : ""}>${o.h != null ? "<i></i>" : o.ponto ? `<span class="ponto ${o.ponto}"></span>` : ""}${esc(o.t)}${o.n != null ? ` <span class="n">${fmtInt(o.n)}</span>` : ""}</button>`;
      };
      const corpo = d.tipo === "materia"
        ? htmlMaterias({ cont: d.cont ? d.cont() : null, sel: (x) => listaMat(v).includes(x), aberta: POPF.aberta, todas: d.todas || "Todas as matérias" })
        : d.tipo === "texto"
        ? `<form class="adicionar" data-pil-form><input type="search" value="${esc(v || "")}" placeholder="${esc(d.ph || "")}"${d.lista ? ` list="${d.lista}"` : ""} autocomplete="off"><button class="btn btn-pri" type="submit">Aplicar</button></form>${ops.length ? `<div class="chips" style="margin-top:12px">${ops.slice(0, 24).map(chip).join("")}</div>` : ""}`
        : d.grupos
        ? d.grupos.map(([g, rotG]) => { const os = ops.filter((o) => (o.g || "") === g); return os.length ? `${rotG ? `<p class="pop-grupo">${esc(rotG)}</p>` : ""}<div class="chips${d.vertical ? " vertical" : ""}">${os.map(chip).join("")}</div>` : ""; }).join("")
        : `<div class="chips${d.vertical ? " vertical" : ""}">${ops.map(chip).join("")}</div>`;
      // Campo de data: um dia (ir para a semana) ou um intervalo (de/até).
      const vd = String(v || "");
      const datas = d.datas === "uma"
        ? `<form class="pop-datas" data-pil-datas><label>${esc(d.rotData || "Escolher uma data")}<input type="date" name="a" value="${/^\d{4}-\d{2}-\d{2}$/.test(vd) ? vd : ""}" min="${d.min || ""}" max="${d.max || ""}" required></label><button class="btn btn-pri btn-peq" type="submit">Ir</button></form>`
        : d.datas === "intervalo"
        ? `<form class="pop-datas" data-pil-datas><label>De<input type="date" name="de" value="${vd.startsWith("d:") ? vd.split(":")[1] : ""}" min="${d.min || ""}" max="${d.max || ""}"></label><label>Até<input type="date" name="ate" value="${vd.startsWith("d:") ? vd.split(":")[2] : ""}" min="${d.min || ""}" max="${d.max || ""}"></label>${d.edicao ? `<label class="curto">ou edição nº<input type="number" name="ed" inputmode="numeric" min="${d.edicao.min}" max="${d.edicao.max}" placeholder="${d.edicao.max}" value="${vd.startsWith("e:") ? vd.slice(2) : ""}"></label>` : ""}<button class="btn btn-pri btn-peq" type="submit">Aplicar</button></form>` : "";
      const busca = d.busca ? `<input type="search" class="pop-busca" data-pop-busca placeholder="${esc(d.busca === true ? "Filtrar a lista" : d.busca)}" autocomplete="off">` : "";
      const rodape = d.tipo === "varios" ? `<div class="pop-rodape"><p class="nota">Dá para marcar mais de uma opção.</p><button type="button" class="btn btn-pri btn-peq" data-fechar-pop>Concluir</button></div>` : "";
      return `<div class="fd-pop-cab"><span class="alca"></span><button type="button" class="btn-ico" data-fechar-pop aria-label="Fechar">${ico("x")}</button></div><h3>${esc(d.titulo || d.rot)}</h3>${busca}${datas}${datas && ops.length ? `<p class="pop-grupo">${esc(d.rotAtalhos || "Atalhos")}</p>` : ""}${corpo}${d.nota ? `<p class="nota">${d.nota}</p>` : ""}${d.tipo === "materia" ? `<div class="pop-rodape"><p class="nota">Marque quantas matérias e assuntos quiser; a lista reúne todos os marcados.</p><button type="button" class="btn btn-pri btn-peq" data-fechar-pop>Concluir</button></div>` : ""}${rodape}`;
    }
    // Redesenha o painel aberto sem fechá-lo nem mudá-lo de lugar, mantendo a rolagem e o texto da busca.
    function redesenharPop(d) {
      const rol = [POPF.el, ...$$(".mt2-areas, .mt2-subs", POPF.el)].map((el) => el.scrollTop);
      const q = $("[data-pop-busca]", POPF.el)?.value || "";
      POPF.el.innerHTML = conteudo(d);
      [POPF.el, ...$$(".mt2-areas, .mt2-subs", POPF.el)].forEach((el, k) => { if (rol[k] != null) el.scrollTop = rol[k]; });
      const bi = $("[data-pop-busca]", POPF.el); if (bi && q) { bi.value = q; filtrarPop(q); }
    }
    function filtrarPop(q) {
      const n = norm(q.trim());
      $$("[data-op]", POPF.el).forEach((c) => { c.hidden = !!n && c.dataset.op !== "" && !norm(c.textContent).includes(n); });
    }
    function abrir(i, botao) {
      const d = defs[i];
      if (POPF.raiz !== raiz || POPF.i !== i) POPF.aberta = d.tipo === "materia" ? (listaMat(d.get())[0] || "").split("/")[0] : "";
      POPF.raiz = raiz; POPF.i = i;
      POPF.el.innerHTML = conteudo(d);
      const folha = matchMedia("(max-width: 860px)").matches;
      POPF.el.classList.toggle("folha", folha);
      POPF.el.classList.toggle("largo", d.tipo === "materia");
      if (!folha && botao) { const r = botao.getBoundingClientRect(), w = d.tipo === "materia" ? 676 : 416; POPF.el.style.left = `${Math.max(12, Math.min(r.left, innerWidth - w))}px`; POPF.el.style.top = `${r.bottom + 8}px`; }
      else { POPF.el.style.left = ""; POPF.el.style.top = ""; }
      POPF.el.hidden = false; POPF.veu.hidden = !folha;
      requestAnimationFrame(() => { POPF.el.classList.add("vis"); POPF.veu.classList.add("vis"); });
      POPF.el.onclick = (e) => {
        if (e.target.closest("[data-fechar-pop]")) return fecharPopF();
        const ab = e.target.closest("[data-mt-abrir]");
        if (ab) { POPF.aberta = ab.dataset.mtAbrir; const top = $(".mt2-areas", POPF.el)?.scrollTop || 0; POPF.el.innerHTML = conteudo(d); const ar = $(".mt2-areas", POPF.el); if (ar) ar.scrollTop = top; const sb = $(".mt2-subs", POPF.el); if (sb) sb.scrollTop = 0; return; }
        const b = e.target.closest("[data-op]"); if (!b) return;
        const o = (d.opcoes?.() || []).find((x) => String(x.v) === b.dataset.op); const val = o ? o.v : b.dataset.op;
        if (d.tipo === "multi") { const cur = d.get(); d.set(val === "" ? [] : cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]); }
        else if (d.tipo === "materia") { const cur = listaMat(d.get()); d.set(val === "" ? "" : (cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]).join(",")); }
        else if (d.tipo === "varios") { const cur = listaV(d.get()), sv = String(val); d.set(sv === "" ? "" : (cur.includes(sv) ? cur.filter((x) => x !== sv) : [...cur, sv]).join("|")); }
        else d.set(String(d.get() ?? "") === String(val) && !d.obrigatorio ? vazioDe(d) : val);
        const multiplo = d.tipo === "multi" || d.tipo === "materia" || d.tipo === "varios";
        if (multiplo) travarAltura();
        desenhar(); aoMudar();
        // Filtros de escolha múltipla: o painel fica aberto, no mesmo lugar, para marcar outras opções.
        if (multiplo && val !== "") redesenharPop(d); else fecharPopF();
      };
      POPF.el.oninput = (e) => { if (e.target.matches?.("[data-pop-busca]")) filtrarPop(e.target.value); };
      if (!folha) $("[data-pop-busca]", POPF.el)?.focus();
      const fd = $("[data-pil-datas]", POPF.el);
      if (fd) fd.onsubmit = (e) => {
        e.preventDefault();
        if (d.datas === "uma") { if (!fd.a.value) return; d.set(fd.a.value); }
        else if (fd.ed && fd.ed.value) { d.set(`e:${+fd.ed.value}`); }
        else { const de = fd.de.value || d.min || "", ate = fd.ate.value || d.max || ""; if (!de && !ate) return; d.set(`d:${de <= ate || !ate ? de : ate}:${de <= ate || !ate ? ate : de}`); }
        desenhar(); aoMudar(); fecharPopF();
      };
      const fm = $("[data-pil-form]", POPF.el);
      if (fm) { const inp = $("input", fm); if (!folha) inp.focus(); fm.onsubmit = (e) => { e.preventDefault(); d.set(inp.value.trim()); desenhar(); aoMudar(); fecharPopF(); }; }
    }
    raiz.addEventListener("click", (e) => {
      if (e.target.closest("[data-pil-limpar]")) { defs.forEach((d) => { if (!d.semLimpar) d.set(vazioDe(d)); }); fecharPopF(); desenhar(); return aoMudar(); }
      const b = e.target.closest("[data-pil]"); if (!b) return;
      const i = +b.dataset.pil, d = defs[i];
      if (d.tipo === "toggle") { d.set(!d.get()); fecharPopF(); desenhar(); return aoMudar(); }
      if (POPF.raiz === raiz && POPF.i === i && !POPF.el.hidden) return fecharPopF();
      abrir(i, b);
    });
    desenhar();
    return { desenhar };
  }
  // "Ordenar por": mesma aparência em todas as listas; a primeira opção é o padrão.
  function defOrdem(get, set, opcoes, nota) {
    const padrao = opcoes[0].v;
    return { rot: "Ordenar por", titulo: "Ordenar por", tipo: "um", cls: "ordem", ico: "ordem", padrao, obrigatorio: true, semLimpar: true, get, set, nota,
      dica: "Ordenar por", rotAtual: () => `Ordenar: ${opcoes[0].t.toLowerCase()}`, opcoes: () => opcoes.map((o) => ({ ...o, curto: `Ordenar: ${o.t.toLowerCase()}` })) };
  }
  // Opções de matéria com contagem e cor.
  const opcoesAreas = (cont, todas = "Todas as matérias") => [{ v: "", t: todas }, ...Object.keys(AREAS).filter((a) => cont[a]).sort((a, b) => cont[b] - cont[a]).map((a) => ({ v: a, t: AREAS[a], n: cont[a], h: AREA_COR[a] }))];

  // ============================================================ DESTAQUES
  function campoBusca(id, ph, valor = "") {
    return `<div class="campo-busca">${ico("pesquisa")}<input id="${id}" type="search" placeholder='${esc(ph)}' value="${esc(valor)}" autocomplete="off" spellcheck="false"></div>`;
  }
  const abasDestaques = (aba) => `<div class="segmentos" role="tablist" style="margin-bottom:14px">
      <button type="button" role="tab" data-ds-aba="" aria-selected="${aba !== "auto"}">Informativo do STJ</button>
      <button type="button" role="tab" data-ds-aba="auto" aria-selected="${aba === "auto"}">Seleção automática</button></div>`;
  function ligarAbasDestaques(main) {
    $$("[data-ds-aba]", main).forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.dsAba ? "#destaques?aba=auto" : "#destaques"; }));
  }
  // Nota do Informativo: tema, destaque (a tese) e dados do julgado.
  // Nota do Informativo: matéria, tema em destaque, a tese e os dados do julgado.
  const TIPO_INFO = (x) => (/repetitiv/i.test(x.sec) ? `Repetitivo${x.tr ? ` · Tema ${fmtNumProc(x.tr)}` : ""}` : /assun/i.test(x.sec) ? "IAC" : /s[uú]mula/i.test(x.sec) ? "Súmula" : "");
  function cardInformativo(x, termos = []) {
    const salvo = !!P.salvos[`i:${x.id}`];
    const proc = x.p?.[0] ? `${x.p[0].cl} ${fmtNumProc(x.p[0].n)}${x.p.length > 1 ? ` e mais ${x.p.length - 1}` : ""}` : /^s[úu]mula/i.test(x.tema || "") ? "Enunciado de súmula" : x.an ? "Nota sem número de processo" : "Processo em segredo de justiça";
    const tipo = TIPO_INFO(x);
    const longa = x.t.length > 700;
    const dj = /DJEN?\s*(?:de\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(x.proc || "");
    const datas = [x.julg ? `<span><b>Julgado</b> ${fmtData(x.julg)}</span>` : "", dj && (!x.julg || `${dj[3]}-${dj[2].padStart(2, "0")}-${dj[1].padStart(2, "0")}` >= x.julg) ? `<span><b>DJEN</b> ${String(dj[1]).padStart(2, "0")}/${String(dj[2]).padStart(2, "0")}/${dj[3]}</span>` : "", x.d ? `<span><b>Informativo ${x.ed}</b> ${fmtData(x.d)}</span>` : ""].filter(Boolean).join("");
    return `<li class="ncard" data-info="${esc(x.id)}" style="--h:${AREA_COR[(x.ar || [])[0]] ?? 222}">
      <div class="nota-cab">${seloMat(x.ar, x.sa)}${tipo ? `<span class="selo ok">${esc(tipo)}</span>` : ""}<span class="nota-org">${esc(x.org || x.sec || "")}</span></div>
      ${datas ? `<div class="nota-datas">${datas}</div>` : ""}
      <h3 class="nota-tema"><button type="button" data-a-info="abrir">${destacar(esc(x.tema.replace(/\s*Tema\s+\d[\d.]*\.?\s*$/i, "")), termos)}</button></h3>
      <div class="nota-tese${longa ? " longa" : ""}">${x.t.split("\n").map((l) => `<p>${destacar(esc(l), termos)}</p>`).join("")}</div>
      ${longa ? `<button type="button" class="nota-mais" data-a-info="mais">Continuar lendo</button>` : ""}
      <div class="nota-rodape"><span class="nota-proc">${esc(proc)}${x.rel ? ` · Rel. Min. ${esc(x.rel)}` : ""}</span>
        <span class="dir"><button type="button" class="link-acao" data-a-info="abrir">Nota completa</button>
          <a class="btn-ico" href="${URL_INFO(x.ed)}" target="_blank" rel="noopener" title="Informativo oficial" aria-label="Informativo oficial">${ico("externo")}</a>
          <button type="button" class="btn-ico" data-a-info="ref" title="Copiar só a citação" aria-label="Copiar só a citação">${ico("citar")}</button>
          <button type="button" class="btn-ico" data-a-info="copiar" title="Copiar destaque e citação" aria-label="Copiar destaque e citação">${ico("copiar")}</button>
          <button type="button" class="btn-ico btn-salvar" data-a-info="salvar" aria-pressed="${salvo}" title="${salvo ? "Remover dos salvos" : "Salvar"}" aria-label="Salvar">${ico("salvar")}</button></span></div></li>`;
  }
  const refInfo = (x) => `(STJ, ${x.proc ? x.proc.split(/\.\s*\(/)[0].replace(/\.$/, "") : x.org}. Informativo de Jurisprudência n. ${x.ed}.)`;
  const citInfo = (x) => `${x.t.replace(/\n/g, " ")}\n${refInfo(x)}`;
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-a-info]"); if (!b) return;
    const id = b.closest("[data-info]")?.dataset.info; const l = await informativos(); const x = l.idx.get(id); if (!x) return;
    const a = b.dataset.aInfo;
    if (a === "abrir") abrirInformativo(x);
    if (a === "mais") { const t = b.closest(".ncard").querySelector(".nota-tese"); t.classList.toggle("aberta"); b.textContent = t.classList.contains("aberta") ? "Recolher" : "Continuar lendo"; }
    if (a === "copiar") copiar(citInfo(x), "Destaque e citação copiados.");
    if (a === "ref") copiar(refInfo(x), "Citação copiada.");
    if (a === "salvar") alternarSalvo(`i:${x.id}`, { k: "i", id: x.id }, b);
  });
  async function abrirInformativo(x) {
    const teor = (await teorInfo(x).catch(() => ({})))[x.id] || [];
    const ix = x.p?.length ? await carregar("numeros").catch(() => null) : null;
    const noAcervo = ix ? ix.l.find((y) => x.p.some((p) => p.n === y[0])) : null;
    abrirGaveta(`Informativo de Jurisprudência n. ${x.ed}${x.d ? " · " + fmtData(x.d) : ""}`, x.p?.[0] ? `${x.p[0].cl} ${fmtNumProc(x.p[0].n)}` : "Nota do Informativo", `
      <div class="item-sel">${seloMat(x.ar, x.sa, 3)}<span class="selo">${esc(x.sec || "")}</span></div>
      <p class="info-tema">${esc(x.tema)}</p>
      <div class="tese"><b>${x.an ? "Resumo do julgado" : "Destaque"}</b>${(x.lg && teor[0] && x.an ? teor[0] : x.t).split("\n").map((l) => `<p>${esc(l)}</p>`).join("")}</div>
      <div class="acoes" style="margin:14px 0">
        ${noAcervo ? `<button type="button" class="btn btn-pri btn-peq" id="gi-ementa">Ementa do acórdão</button>` : ""}
        ${x.tr ? `<button type="button" class="btn btn-claro btn-peq" data-ref="t:${x.tr}">Tema ${fmtNumProc(x.tr)}</button>` : ""}
        <button type="button" class="btn btn-claro btn-peq" id="gi-copiar">${ico("copiar")} Copiar destaque e citação</button>
        <button type="button" class="btn btn-claro btn-peq" id="gi-ref">${ico("citar")} Copiar só a citação</button>
        <a class="btn btn-claro btn-peq" href="${URL_INFO(x.ed)}" target="_blank" rel="noopener">Informativo oficial ${ico("externo")}</a>
      </div>
      ${teor[0] && !x.an ? `<h3>Informações do inteiro teor</h3><div class="texto-serif">${teor[0].split("\n").map((l) => `<p>${esc(l)}</p>`).join("")}</div>` : ""}
      <h3>Processo</h3><p class="texto-serif">${esc(x.proc || (/^s[úu]mula/i.test(x.tema || "") ? "Enunciado de súmula aprovado pelo STJ." : x.an ? "A nota não indica o número do processo." : "Processo em segredo de justiça."))}</p>
      ${teor[1] ? `<h3>Informações adicionais</h3><div class="texto-serif">${teor[1].split("\n").map((l) => `<p>${esc(l)}</p>`).join("")}</div>` : ""}`);
    $("#gi-copiar").addEventListener("click", () => copiar(citInfo(x), "Destaque e citação copiados."));
    $("#gi-ref").addEventListener("click", () => copiar(refInfo(x), "Citação copiada."));
    $("#gi-ementa")?.addEventListener("click", () => abrirAcordao({ id: noAcervo[4], m: ix.m[noAcervo[2]], o: ix.o[noAcervo[3]], cl: x.p[0].cl, n: noAcervo[0] }));
  }
  // Explicação curta no topo da tela; some quando o usuário clica em "Entendi".
  function caixaExplica(chave, titulo, texto) {
    P.dicas = P.dicas || {};
    if (P.dicas[chave]) return `<button type="button" class="explica-reabrir" data-explica-abrir="${chave}">${ico("sobre")} Sobre o ${esc(titulo)}</button>`;
    return `<div class="explica-box" data-explica="${chave}"><div>${ico("sobre")}</div><div><b>${esc(titulo)}</b><p>${texto}</p></div><button type="button" class="btn btn-claro btn-peq" data-explica-fechar="${chave}">Entendi</button></div>`;
  }
  document.addEventListener("click", (e) => {
    const f = e.target.closest("[data-explica-fechar]"), a = e.target.closest("[data-explica-abrir]");
    if (!f && !a) return;
    P.dicas = P.dicas || {};
    if (f) { P.dicas[f.dataset.explicaFechar] = 1; salvarP(); f.closest(".explica-box").outerHTML = caixaExplica(f.dataset.explicaFechar, f.closest(".explica-box").querySelector("b").textContent, ""); }
    if (a) { const k = a.dataset.explicaAbrir; delete P.dicas[k]; salvarP(); a.outerHTML = caixaExplica(k, EXPLICA[k][0], EXPLICA[k][1]); }
  });
  const EXPLICA = {
    info: ["Informativo do STJ", "O Informativo de Jurisprudência é a publicação periódica, em regra semanal, em que o próprio STJ seleciona os julgados mais importantes pela novidade da tese e pela repercussão. Cada nota traz o tema, o <b>destaque</b> (a tese decidida), o processo, o relator e as datas. É a curadoria oficial do Tribunal; a aba “Seleção automática” é a triagem feita pelo site sobre todos os acórdãos."],
    teses: ["Jurisprudência em Teses", "Publicação do STJ que organiza, por assunto, as teses consolidadas do Tribunal. Cada edição trata de um tema (por exemplo, “Bem de família” ou “Direito à educação”) e lista as teses com os precedentes que as sustentam. Útil para fundamentar peças: mostra o entendimento reiterado e os julgados que o confirmam."],
    semana: ["Resumo da semana", "Tudo o que mudou no STJ em uma semana, numa página só: teses firmadas em repetitivos, notas do Informativo, temas afetados, julgados com tese, súmulas aprovadas e repetitivos que vão a julgamento na semana seguinte. Serve para se atualizar em poucos minutos e para enviar à equipe ou ao cliente, por texto, PDF ou link."],
  };
  const ORGAOS_INFO = ["Corte Especial", "Primeira Seção", "Segunda Seção", "Terceira Seção", "Primeira Turma", "Segunda Turma", "Terceira Turma", "Quarta Turma", "Quinta Turma", "Sexta Turma"];
  const GRUPO_ORG = { rep: ["Repetitivos e IAC", (x) => /repetitiv|assun/i.test(x.sec)], secoes: ["Corte Especial e Seções", (x) => /corte especial|se[çc][ãa]o/i.test(x.org || "")], pub: ["Direito público (1ª e 2ª Turmas)", (x) => /^(primeira|segunda) turma/i.test(x.org || "")], priv: ["Direito privado (3ª e 4ª Turmas)", (x) => /^(terceira|quarta) turma/i.test(x.org || "")], pen: ["Direito penal (5ª e 6ª Turmas)", (x) => /^(quinta|sexta) turma/i.test(x.org || "")] };
  const fmtDiaMes = (iso) => fmtData(iso).slice(0, 5);
  async function vInformativos(main, p) {
    const recentes = await informativos();
    let l = [...recentes];
    const ix = await infoIndice().catch(() => null);
    const eds = ix ? ix.eds.map((e) => e[0]) : [...new Set(l.map((x) => x.ed))].sort((a, b) => b - a);
    const dataEd = new Map(ix ? ix.eds.map((e) => [e[0], e[1]]) : l.map((x) => [x.ed, x.d]));
    const anoEd = new Map(ix ? ix.eds.map((e) => [e[0], e[2]]) : []);
    const datasTodas = [...dataEd.values()].filter(Boolean);
    const dmin = datasTodas.reduce((m, d) => (d < m ? d : m), "9999"), dmax = datasTodas.reduce((m, d) => (d > m ? d : m), "");
    const corte = ix ? ix.corte : 0, antigos = ix ? ix.antigos : [];
    const carregados = new Set();
    let tokenInf = 0;
    // Anos antigos que o filtro de período exige.
    const precisa = () => {
      if (f.e === "todas") return antigos;
      if (f.e.startsWith("e:")) { const e = +f.e.slice(2); return e <= corte && anoEd.get(e) ? [anoEd.get(e)] : []; }
      if (f.e.startsWith("d:")) { const [, de, ate] = f.e.split(":"); return antigos.filter((a) => (!de || a >= de.slice(0, 4)) && (!ate || a <= ate.slice(0, 4))); }
      return [];
    };
    const f = { q: p.get("q") || "", a: p.get("a") || "", e: p.get("e") || "todas", o: p.get("o") || "", rl: p.get("rl") || "", s: p.get("s") || "rec" };
    main.innerHTML = `${abasDestaques("")}
      <div id="if-f" class="bloco-filtros">
        ${campoBusca("if-q", 'Tema ou tese. Ex.: "adjudicação compulsória" ou prescri$', f.q)}
        <div class="fd-filtros filtros-lista" id="if-pil"></div>
        <datalist id="if-rels">${[...new Set(l.map((x) => x.rel).filter(Boolean))].sort().map((r) => `<option value="${esc(r)}">`).join("")}</datalist>
      </div>
      <div class="barra-res"><p id="if-info" aria-live="polite"></p><span class="nota" title="O Informativo de Jurisprudência é publicado pelo STJ e reúne as teses selecionadas pela novidade e pela repercussão no meio jurídico.">Curadoria oficial do STJ</span></div>
      <div id="if-lista" class="notas"></div>
      <div id="if-pag"></div>`;
    ligarAbasDestaques(main);
    let lista = [], termos = [], ca = {}, co = {}, cr = {}, grupoDe = null, porEdicao = false, edsLista = [], abertasIf = new Set();
    const pgIf = paginador("if", () => render(), "#if-lista");
    // Edição recolhível, como na Jurisprudência em Teses: fechada mostra data, contagem e matérias; aberta, as notas.
    const linhaEdInfo = (ed) => {
      const notas = lista.filter((x) => x.ed === ed), aberta = abertasIf.has(ed), d = dataEd.get(ed) || notas[0]?.d || "";
      const cont = {}; notas.forEach((x) => (x.ar || []).slice(0, 1).forEach((a) => (cont[a] = (cont[a] || 0) + 1)));
      const mats = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a);
      const temas = notas.slice(0, 2).map((x) => (x.tema || "").replace(/\.$/, "")).filter(Boolean);
      return `<section class="jt-ed${aberta ? " aberta" : ""}" data-if-ed="${ed}" style="--h:${AREA_COR[mats[0]] ?? 222}">
        <button type="button" class="jt-ed-cab" data-if-abrir="${ed}" aria-expanded="${aberta}">
          <span class="jt-ed-num" title="Informativo n. ${ed}"><small>Inf.</small>${ed}</span>
          <span class="jt-ed-tit"><b>${d ? `${fmtDiaL(d).replace(/^\S+, /, "")} de ${d.slice(0, 4)}` : `Edição ${ed}`}</b>
            <span class="jt-ed-meta">${seloMat(mats, [], 3)}<span>${notas.length} nota${notas.length > 1 ? "s" : ""}</span></span>
            ${!aberta && temas.length ? `<span class="jt-ed-prev">${temas.map((t) => destacar(esc(frase(t)), termos)).join(" · ")}${notas.length > 2 ? " …" : ""}</span>` : ""}</span>
          ${ico("seta")}
        </button>
        ${aberta ? `<div class="jt-ed-corpo"><div class="jt-ed-info"><span>${notas.length} nota${notas.length > 1 ? "s" : ""}${f.q.trim() ? " correspondentes à busca" : ""}</span><a class="link-acao" href="${URL_INFO(ed)}" target="_blank" rel="noopener">Edição oficial ${ico("externo")}</a></div>
          <ol class="lista-notas">${notas.map((x) => cardInformativo(x, termos)).join("")}</ol></div>` : ""}
      </section>`;
    };
    const noPeriodo = (x) => {
      if (f.e === "todas") return true;
      if (/^u\d+$/.test(f.e)) return x.ed >= eds[Math.min(eds.length, +f.e.slice(1)) - 1];
      if (/^m\d+$/.test(f.e)) return x.d >= somaDias(hojeISO(), -30 * +f.e.slice(1));
      if (f.e.startsWith("e:")) return x.ed === +f.e.slice(2);
      if (f.e.startsWith("d:")) { const [, de, ate] = f.e.split(":"); return (!de || x.d >= de) && (!ate || x.d <= ate); }
      return true;
    };
    const render = () => {
      const box = $("#if-lista");
      if (!lista.length) { $("#if-pag").innerHTML = ""; box.innerHTML = vazio("destaques", "Nenhuma nota encontrada", "Amplie o período, troque a matéria ou revise os termos da busca."); return; }
      if (porEdicao) {
        const vis = pgIf.fatia(edsLista);
        $("#if-pag").innerHTML = pgIf.html(edsLista.length);
        let html = "", anoAnt = "";
        for (const ed of vis) { const a = (dataEd.get(ed) || "").slice(0, 4); if (a && a !== anoAnt) { html += `<h2 class="jt-divisor">${a}</h2>`; anoAnt = a; } html += linhaEdInfo(ed); }
        box.innerHTML = html;
        return;
      }
      const vis = pgIf.fatia(lista);
      $("#if-pag").innerHTML = pgIf.html(lista.length);
      const grupos = [];
      for (const x of vis) { const g = grupoDe ? grupoDe(x) : null; const k = g ? g.k : "_"; if (!grupos.length || grupos[grupos.length - 1].k !== k) grupos.push({ ...(g || { k }), itens: [] }); grupos[grupos.length - 1].itens.push(x); }
      box.innerHTML = grupos.map((g) => `<section class="grupo-notas">${g.tit ? `<header class="grupo-cab"${g.h != null ? ` style="--h:${g.h}"` : ""}><h2>${g.tit}</h2><span>${g.sub || ""}</span>${g.link ? `<a class="link-acao" href="${g.link}" target="_blank" rel="noopener">Edição oficial ${ico("externo")}</a>` : ""}</header>` : ""}
        <ol class="lista-notas">${g.itens.map((x) => cardInformativo(x, termos)).join("")}</ol></section>`).join("");
    };
    const aplicar = async () => {
      f.q = $("#if-q").value;
      gravarHash("destaques", { ...f, e: f.e === "todas" ? "" : f.e, s: f.s === "rec" ? "" : f.s });
      const tk = ++tokenInf;
      const faltam = precisa().filter((a) => !carregados.has(a));
      if (faltam.length) {
        let k = 0;
        for (const a of faltam) {
          const el = $("#if-info"); if (!el) return; // o usuário saiu da tela
          el.innerHTML = `Carregando edições antigas do Informativo (${a})… ${Math.round((k++ / faltam.length) * 100)}%`;
          try { const la = await infoAno(a); if (!carregados.has(a)) { carregados.add(a); l.push(...la); } } catch { carregados.add(a); }
          if (tk !== tokenInf) return;
        }
        if (!$("#if-info")) return;
      }
      const c = Busca.compilar(f.q); termos = c.termos;
      const relSel = listaV(f.rl).map(norm);
      const b1 = l.filter((x) => noPeriodo(x) && c.testa(x._n));
      cr = {}; for (const x of b1) if (x.rel) cr[x.rel] = (cr[x.rel] || 0) + 1;
      const b0 = b1.filter((x) => !relSel.length || relSel.some((r) => norm(x.rel) === r || norm(x.rel).includes(r)));
      co = { "": b0.length }; for (const x of b0) { for (const [k, [, fn]] of Object.entries(GRUPO_ORG)) if (fn(x)) co[k] = (co[k] || 0) + 1; if (x.org) co[x.org] = (co[x.org] || 0) + 1; }
      const base = b0.filter((x) => !f.o || listaV(f.o).some((o) => (GRUPO_ORG[o] ? GRUPO_ORG[o][1](x) : x.org === o)));
      ca = contarMat(base, (x) => x.ar, (x) => x.sa);
      lista = base.filter((x) => casaMat(f.a, x.ar, x.sa));
      const porId = (a, b) => b.ed - a.ed || a.id.localeCompare(b.id, "pt-BR", { numeric: true });
      const ordem = c.vazio && f.s === "rel" ? "rec" : f.s;
      if (ordem === "rec") { lista.sort(porId); grupoDe = (x) => ({ k: x.ed, tit: `Informativo nº ${x.ed}`, sub: `${x.d ? fmtDiaL(x.d).replace(/^\S+, /, "") + (x.d.slice(0, 4) !== hojeISO().slice(0, 4) ? ` de ${x.d.slice(0, 4)}` : "") : ""} · ${lista.filter((y) => y.ed === x.ed).length} nota(s)`, link: URL_INFO(x.ed) }); }
      if (ordem === "julg") { lista.sort((a, b) => (b.julg || "").localeCompare(a.julg || "") || porId(a, b)); grupoDe = (x) => ({ k: (x.julg || "").slice(0, 7), tit: x.julg ? `Julgados em ${fmtMesL(x.julg.slice(0, 7))}` : "Sem data de julgamento" }); }
      if (ordem === "mat") { const ordA = Object.keys(AREAS); const pos = (x) => { const i = ordA.indexOf((x.ar || [])[0]); return i < 0 ? 99 : i; }; lista.sort((a, b) => pos(a) - pos(b) || porId(a, b)); grupoDe = (x) => { const a = (x.ar || [])[0]; return { k: a || "-", tit: AREAS[a] || "Outras matérias", h: AREA_COR[a], sub: `${lista.filter((y) => (y.ar || [])[0] === a).length} nota(s)` }; }; }
      if (ordem === "rel") { lista.sort((a, b) => c.pontua(b._n, norm(b.tema)) - c.pontua(a._n, norm(a.tema)) || porId(a, b)); grupoDe = null; }
      const nEd = new Set(lista.map((x) => x.ed)).size;
      porEdicao = ordem === "rec";
      edsLista = [...new Set(lista.map((x) => x.ed))];
      abertasIf = new Set(edsLista.length === 1 ? edsLista : !c.vazio ? edsLista.slice(0, 3) : []);
      $("#if-info").innerHTML = `<b>${fmtInt(lista.length)}</b> nota(s) em ${nEd} edição(ões) ${explicacaoHTML(c)}${!c.vazio && f.e !== "todas" && antigos.length ? ` <button type="button" class="link-acao" id="if-todas">Buscar em todas as edições, desde ${antigos[0]}</button>` : ""}`;
      $("#if-todas")?.addEventListener("click", () => { f.e = "todas"; pilInf.desenhar(); aplicar(); });
      pgIf.pag = 1; render();
    };
    const rotPer = (v) => (v.startsWith("e:") ? `Informativo ${v.slice(2)}` : v.startsWith("d:") ? (() => { const [, de, ate] = v.split(":"); return `${de ? fmtData(de) : "início"} a ${ate ? fmtData(ate) : "hoje"}`; })() : "Período");
    const pilInf = pilulas($("#if-pil"), [
      { rot: "Matéria", tipo: "materia", get: () => f.a, set: (v) => (f.a = v), cont: () => ca },
      { rot: "Período", titulo: "Período ou edição", edicao: { min: eds[eds.length - 1], max: eds[0] }, tipo: "um", padrao: "todas", obrigatorio: true, semLimpar: true, rotAtual: () => "Todas as edições", rotValor: rotPer, get: () => f.e, set: (v) => (f.e = v),
        datas: "intervalo", min: dmin, max: dmax, rotAtalhos: "Atalhos", vertical: true, grupos: [["", ""], ["e", "Edição específica"]],
        opcoes: () => [{ v: "todas", t: `Todas as edições (desde a nº ${eds[eds.length - 1]}${dmin !== "9999" ? `, de ${dmin.slice(0, 4)}` : ""})`, curto: "Todas as edições" }, { v: "u1", t: `Última edição (nº ${eds[0]}, ${fmtDiaMes(dataEd.get(eds[0]))})`, curto: `Informativo ${eds[0]}` }, { v: "u4", t: "Últimas 4 edições" }, { v: "m3", t: "Últimos 3 meses" }, { v: "m12", t: "Últimos 12 meses" },
          ...eds.slice(0, 12).map((e) => ({ g: "e", v: `e:${e}`, t: `Informativo ${e} · ${fmtData(dataEd.get(e))}`, curto: `Informativo ${e}` }))],
        nota: "Informe as datas de publicação, digite o número de qualquer edição ou escolha uma das mais recentes. Edições antigas são carregadas na hora e podem levar alguns segundos." },
      { rot: "Órgão", tipo: "varios", vertical: true, grupos: [["", ""], ["o", "Órgão julgador"]], get: () => f.o, set: (v) => (f.o = v),
        opcoes: () => [{ v: "", t: "Todos os órgãos", n: co[""] }, ...Object.entries(GRUPO_ORG).map(([k, [t]]) => ({ v: k, t, n: co[k] || 0 })), ...ORGAOS_INFO.filter((o) => co[o]).map((o) => ({ g: "o", v: o, t: o, n: co[o] }))] },
      { rot: "Relator(a)", tipo: "varios", vertical: true, busca: "Buscar ministro(a)", get: () => f.rl, set: (v) => (f.rl = v),
        opcoes: () => [{ v: "", t: "Todos os relatores" }, ...Object.keys(cr).concat(listaV(f.rl).filter((r) => !cr[r])).sort((a, b) => norm(a).replace(/^ministr[oa]\s+/, "").localeCompare(norm(b).replace(/^ministr[oa]\s+/, ""))).map((r) => ({ v: r, t: r, n: cr[r] || 0 }))] },
      defOrdem(() => f.s, (v) => (f.s = v), [{ v: "rec", t: "Edição mais recente" }, { v: "julg", t: "Julgamento mais recente" }, { v: "mat", t: "Matéria" }, { v: "rel", t: "Mais aderentes à busca" }],
        "Por edição e por julgamento, as notas aparecem agrupadas; por matéria, reunidas sob cada ramo do direito."),
    ], aplicar);
    $("#if-q").addEventListener("input", debounce(aplicar, 200));
    $("#if-lista").addEventListener("click", (e) => {
      const ab = e.target.closest("[data-if-abrir]"); if (!ab) return;
      const ed = +ab.dataset.ifAbrir; abertasIf.has(ed) ? abertasIf.delete(ed) : abertasIf.add(ed);
      ab.closest(".jt-ed").outerHTML = linhaEdInfo(ed);
    });
    ligarAjuda($("#if-f"), $("#if-q"), aplicar);
    aplicar();
  }
  async function vDestaques(main, p) {
    if (p.get("aba") !== "auto") return vInformativos(main, p);
    const ds = await destaques();
    const meses = [...new Set(ds.map((r) => r.dj.slice(0, 7)))].sort().reverse();
    const f = { a: p.get("a") || "", m: p.get("m") || "todos", o: p.get("o") || "", n: p.get("n") || "", q: p.get("q") || "", t: p.get("t") === "1", s: p.get("s") || "rel" };
    main.innerHTML = `${abasDestaques("auto")}
      <div id="ds-f">
        ${campoBusca("ds-q", 'Filtrar por termos. Ex.: "bem de família" ou impenhorab$', f.q)}
        <div class="fd-filtros filtros-lista" id="ds-pil"></div>
      </div>
      <div class="barra-res"><p id="ds-info"></p><a class="link-acao" href="#sobre">Como selecionamos ${ico("seta")}</a></div>
      <ol class="lista" id="ds-lista"></ol>
      <div id="ds-pag"></div>`;
    const ul = $("#ds-lista"); ligarCards(ul);
    let lista = [], termos = [], contA = {};
    const pgDs = paginador("ds", () => render(false), "#ds-lista");
    const render = (reset) => {
      if (reset) pgDs.pag = 1;
      ul.innerHTML = pgDs.fatia(lista).map((r) => cardAcordao(r, { termos })).join("");
      if (!lista.length) ul.innerHTML = vazio("destaques", "Nenhum destaque com esses filtros", "Tente outra matéria, amplie o período ou revise os termos.");
      $("#ds-pag").innerHTML = pgDs.html(lista.length);
    };
    const aplicar = () => {
      f.q = $("#ds-q").value;
      gravarHash("destaques", { aba: "auto", ...f, m: f.m === "todos" ? "" : f.m, s: f.s === "rel" ? "" : f.s });
      const nq = /^[\d.\-\/\s]+$/.test(f.q.trim()) && digitos(f.q).length >= 5 ? digitos(f.q) : "";
      const c = Busca.compilar(nq ? "" : f.q); termos = c.termos;
      const base = ds.filter((r) => (nq ? (digitos(r.n) === nq || r.reg === nq) : true) && (nq || f.m === "todos" || r.dj.startsWith(f.m)) && (!f.o || (f.o === "sup" ? !r.o.endsWith("turma") : r.o.endsWith("turma"))) && (!f.n || r.s >= 10)
        && (!f.t || r.tese || r.tj) && (c.vazio || c.testa(r._n || (r._n = norm([r.em, r.tese, r.tj, r.tema, r.notas].join("\n"))))));
      contA = contarMat(base, (r) => r.ar, (r) => r.sa);
      const ord = { rel: (a, b) => (b.s - a.s) || b.dj.localeCompare(a.dj), data: (a, b) => b.dj.localeCompare(a.dj) || (b.s - a.s), julg: (a, b) => (b.dd || "").localeCompare(a.dd || "") || (b.s - a.s) }[f.s] || ((a, b) => b.s - a.s);
      lista = agrupar(base.filter((r) => casaMat(f.a, r.ar, r.sa)).sort(ord));
      $("#ds-info").innerHTML = `<b>${fmtInt(lista.length)}</b> destaque(s)${f.m && f.m !== "todos" ? ` em ${fmtMesL(f.m)}` : " nos últimos 3 meses"} ${explicacaoHTML(c)}`;
      render(true);
    };
    pilulas($("#ds-pil"), [
      { rot: "Matéria", tipo: "materia", get: () => f.a, set: (v) => (f.a = v), cont: () => contA },
      { rot: "Período", tipo: "um", obrigatorio: true, semLimpar: true, padrao: "todos", rotAtual: () => "Todo o período", get: () => f.m, set: (v) => (f.m = v),
        opcoes: () => [{ v: "todos", t: "Todo o período (últimos 3 meses)", curto: "Todo o período" }, ...meses.map((m) => ({ v: m, t: fmtMesL(m) }))],
        nota: "A seleção automática cobre os três meses mais recentes do acervo. Para períodos anteriores, use a Pesquisa." },
      { rot: "Órgão", tipo: "um", get: () => f.o, set: (v) => (f.o = v), opcoes: () => [{ v: "", t: "Todos os órgãos" }, { v: "sup", t: "Corte Especial e Seções" }, { v: "turmas", t: "Turmas" }],
        nota: "A Corte Especial e as Seções uniformizam a jurisprudência do Tribunal; as Turmas julgam a maior parte dos recursos." },
      { rot: "Relevância", tipo: "um", get: () => f.n, set: (v) => (f.n = v), opcoes: () => [{ v: "", t: "Relevantes e alta", ponto: "rel" }, { v: "alta", t: "Só alta relevância", curto: "Alta relevância", ponto: "alta" }],
        nota: "Alta relevância: 10 pontos ou mais na classificação automática (veja Sobre)." },
      { rot: "Só com tese", tipo: "toggle", get: () => f.t, set: (v) => (f.t = v), dica: "Mostra apenas acórdãos com tese jurídica ou tese de julgamento destacada na ementa." },
      defOrdem(() => f.s, (v) => (f.s = v), [{ v: "rel", t: "Mais relevantes" }, { v: "data", t: "Publicação mais recente" }, { v: "julg", t: "Julgamento mais recente" }]),
    ], aplicar);
    ligarAbasDestaques(main);
    $("#ds-q").addEventListener("input", debounce(aplicar, 250));
    ligarAjuda($("#ds-f"), $("#ds-q"), aplicar);
    aplicar();
  }

  // ============================================================= PESQUISA
  async function vPesquisa(main, p, mesma) {
    const F = AC.f = {
      p: p.get("p") || "todo", o: p.get("o") || "", a: p.get("a") || "", c: p.get("c") || "", rl: p.get("rl") || "", n: p.get("n") || "",
      s: p.get("s") || "auto", r: p.get("r") !== "0", x: p.get("x") === "1", t: p.get("t") === "1",
    };
    if (!mesma || !$("#ac-q")) {
      const meses = D.man.meses;
      main.innerHTML = `
        <div id="ac-f">
          ${campoBusca("ac-q", 'Termos ou número do processo. Ex.: "prova oral" e nulidade · REsp 2.231.419')}
          <div class="fd-filtros filtros-lista" id="ac-pil"></div>
        </div>
        <div class="barra-res"><p id="ac-info" aria-live="polite"></p><div class="progresso" id="ac-prog" hidden><i></i></div>
          <button type="button" class="btn btn-fant btn-peq" id="ac-link">${ico("link")} Copiar link</button></div>
        <div id="ac-extra"></div>
        <ol class="lista" id="ac-lista"></ol>
        <div id="ac-pag"></div>`;
      const anosAc = [...new Set(meses.map((m) => m.m.slice(0, 4)))];
      const primeiro = meses.length ? meses[meses.length - 1].m : "";
      const periodos = [{ v: "todo", t: `Todo o acervo (desde ${primeiro ? fmtMesL(primeiro) : "—"})`, curto: "Todo o acervo" },
        { v: "u1", t: `Último mês (${meses[0] ? fmtMes(meses[0].m) : "—"})`, curto: "Último mês" }, { v: "u3", t: "Últimos 3 meses" }, { v: "u6", t: "Últimos 6 meses" }, { v: "u12", t: "Últimos 12 meses" }, { v: "u24", t: "Últimos 2 anos" },
        ...anosAc.slice(1).map((a) => ({ g: "desde", v: `desde:${a}`, t: `Desde ${a}`, curto: `Desde ${a}` }))];
      const rotPerAc = (v) => { if (/^d:/.test(v)) { const [, de, ate] = v.split(":"); return `${de ? fmtData(de) : "início"} a ${ate ? fmtData(ate) : "hoje"}`; } return "Período"; };
      AC.pil = pilulas($("#ac-pil"), [
        { rot: "Período", titulo: "Período de publicação", tipo: "um", padrao: "todo", obrigatorio: true, semLimpar: true, rotAtual: () => "Todo o acervo", rotValor: rotPerAc, get: () => AC.f.p, set: (v) => (AC.f.p = v), opcoes: () => periodos,
          datas: "intervalo", min: primeiro ? `${primeiro}-01` : "", max: hojeISO(), rotAtalhos: "Atalhos",
          grupos: [["", ""], ["desde", "Desde o ano"]],
          nota: `O acervo vai de ${primeiro ? fmtMesL(primeiro) : "—"} a ${meses.length ? fmtMesL(meses[0].m) : "—"}. Em períodos longos, a busca percorre os arquivos mês a mês e mostra os resultados à medida que avança; pode levar alguns minutos e é possível parar a qualquer momento. A busca por número de processo sempre percorre todo o acervo.` },
        { rot: "Matéria", tipo: "materia", get: () => AC.f.a, set: (v) => (AC.f.a = v) },
        { rot: "Órgão", tipo: "varios", vertical: true, get: () => AC.f.o, set: (v) => (AC.f.o = v), opcoes: () => [{ v: "", t: "Todos os órgãos" }, ...Object.entries(D.orgaos).map(([k, v]) => ({ v: k, t: v }))] },
        { rot: "Classe", titulo: "Classe processual", tipo: "varios", busca: "Buscar classe. Ex.: REsp, AgInt, HC", get: () => AC.f.c, set: (v) => (AC.f.c = v),
          opcoes: () => [{ v: "", t: "Todas as classes" }, ...[...AC.cls].sort((a, b) => b[1] - a[1]).slice(0, 120).map(([c, n]) => ({ v: c, t: c, n })), ...listaV(AC.f.c).filter((c) => !AC.cls.has(c)).map((c) => ({ v: c, t: c }))],
          nota: "As classes listadas são as encontradas nas buscas já feitas, das mais frequentes às menos. REsp: recurso especial; AgInt: agravo interno; EREsp: embargos de divergência; HC: habeas corpus." },
        { rot: "Relator", titulo: "Relator(a)", tipo: "varios", vertical: true, busca: "Buscar ministro(a)", get: () => AC.f.rl, set: (v) => (AC.f.rl = v),
          opcoes: () => [{ v: "", t: "Todos os relatores" }, ...[...AC.rels.keys(), ...listaV(AC.f.rl).filter((r) => ![...AC.rels.keys()].some((k) => norm(k) === norm(r)))].sort((a, b) => norm(a).localeCompare(norm(b))).map((r) => ({ v: r, t: relatorFmt(r), n: AC.rels.get(r) }))],
          nota: "Relatores dos acórdãos encontrados nas buscas feitas; ao ampliar o período, a lista cresce." },
        { rot: "Processo", tipo: "texto", ph: "Número. Ex.: 2222623", get: () => AC.f.n, set: (v) => (AC.f.n = digitos(v)) },
        { rot: "Exibir", titulo: "Quais acórdãos exibir", tipo: "um", padrao: "", obrigatorio: true, rotAtual: () => "Exibir: sem rotina",
          get: () => (AC.f.t ? "tese" : AC.f.x ? "dest" : AC.f.r ? "" : "tudo"),
          set: (v) => { AC.f.t = v === "tese"; AC.f.x = v === "dest"; AC.f.r = v !== "tudo"; },
          opcoes: () => [{ v: "", t: "Sem decisões de rotina (padrão)", curto: "Exibir: sem rotina" }, { v: "tudo", t: "Todas as decisões, inclusive de rotina", curto: "Exibir: tudo" },
            { v: "tese", t: "Só acórdãos com tese", curto: "Exibir: só com tese" }, { v: "dest", t: "Só destaques (relevantes)", curto: "Exibir: só destaques" }],
          nota: "<b>Decisões de rotina</b> são acórdãos que apenas aplicam óbices já conhecidos, sem examinar o mérito: Súmula 7/STJ (reexame de provas), Súmulas 282 a 284/STF, falta de impugnação específica, embargos de declaração rejeitados. Ficam ocultas por padrão para não encobrir os julgados úteis. <b>Destaques</b> são os acórdãos classificados como relevantes (veja Sobre)." },
        defOrdem(() => AC.f.s, (v) => (AC.f.s = v), [{ v: "auto", t: "Automática" }, { v: "rel", t: "Mais relevantes" }, { v: "data", t: "Publicação mais recente" }, { v: "julg", t: "Julgamento mais recente" }],
          "Automática: com termos de busca, os mais aderentes primeiro; sem termos, os publicados mais recentemente."),
      ], () => buscar());
      $("#ac-q").addEventListener("input", debounce(() => buscar(), 300));
      $("#ac-link").addEventListener("click", () => copiar(location.href, "Link copiado."));
      ligarCards($("#ac-lista"));
      ligarAjuda($("#ac-f"), $("#ac-q"), () => buscar());
    } else AC.pil?.desenhar();
    $("#ac-q").value = p.get("q") || "";
    if (p.get("foco")) setTimeout(() => $("#ac-q").focus(), 50);
    await buscar();
  }
  const AC = { lista: [], mostrados: 0, termos: [], token: 0, dl: false, f: null, pil: null, cls: new Map(), rels: new Map() };
  // Meses (mais recente primeiro) de um valor do filtro Período.
  function mesesDoPeriodo(p, todos) {
    if (/^\d{4}-\d{2}$/.test(p)) return [p];
    if (/^a:\d{4}$/.test(p)) return todos.filter((m) => m.startsWith(p.slice(2)));
    if (/^desde:\d{4}$/.test(p)) return todos.filter((m) => m >= `${p.slice(6)}-01`);
    if (p === "todo") return todos.slice();
    if (/^d:/.test(p)) { const [, de, ate] = p.split(":"); return todos.filter((m) => (!de || m >= de.slice(0, 7)) && (!ate || m <= ate.slice(0, 7))); }
    return todos.slice(0, +(/^u(\d+)$/.exec(p)?.[1] || 1));
  }
  // Índice da pesquisa: palavra → arquivos mensais (mês e órgão) em que aparece. Serve só para
  // descartar arquivos que certamente não contêm o termo; a conferência final é sempre no texto.
  const IB = new Map();
  const parteIB = (p) => { if (!IB.has(p)) IB.set(p, getJSON(`data/busca/${p}.json`).catch(() => null)); return IB.get(p); };
  function postIB(v) { const s = new Set(); let a = 0; for (const x of v.split(".")) { a += parseInt(x, 36); s.add(a); } return s; }
  const interIB = (a, b) => { if (!a) return b; if (!b) return a; const o = new Set(); for (const x of a) if (b.has(x)) o.add(x); return o; };
  async function idsPalavraIB(w, ex, meta) {
    const pref = w.endsWith("$"), base = pref ? w.slice(0, -1) : w;
    if (base.length < (pref ? 2 : 3) || /[^a-z]/.test(base)) return null; // números e palavras curtas não reduzem a busca
    const re = pref ? null : new RegExp(`^${ex ? base : flexW(base)}$`);
    const casa = (k) => (pref ? k.startsWith(base) : re.test(k));
    // Início fixo de toda palavra que casa com o termo (o plural pode trocar até duas letras finais).
    const b = singular(base);
    const lit = pref || ex ? base : /(ao|al|el|ol)$/.test(b) ? b.slice(0, -2) : /m$/.test(b) ? b.slice(0, -1) : b;
    if (lit.length < 2) return null;
    const partes = meta.partes.filter((p) => { const q = p.replace(/_$/, ""); return q.startsWith(lit) || lit.startsWith(q); });
    const out = new Set();
    for (const p of partes) {
      const d = await parteIB(p);
      if (!d) return null;
      for (const k in d) if (casa(k)) { if (d[k] === "*") return null; for (const x of postIB(d[k])) out.add(x); }
    }
    return out;
  }
  async function idsNoIB(no, meta) {
    if (!no) return null;
    switch (no.t) {
      case "termo": case "frase": {
        if (no.num) return null;
        let acc = null;
        for (const w of no.t === "termo" ? [no.v] : no.v) acc = interIB(acc, await idsPalavraIB(w, no.ex, meta));
        return acc;
      }
      case "e": case "adj": case "prox": { let acc = null; for (const x of no.a) acc = interIB(acc, await idsNoIB(x, meta)); return acc; }
      case "ou": { const u = new Set(); for (const x of no.a) { const s = await idsNoIB(x, meta); if (!s) return null; s.forEach((v) => u.add(v)); } return u; }
      default: return null; // negação, tema e súmula: sem redução
    }
  }
  // Devolve só os pares (mês, órgão) que podem conter o termo; sem índice, devolve todos.
  async function filtrarPorIndice(cons, pares) {
    const meta = D.man.busca;
    if (cons.vazio || !meta?.partes?.length || meta.v !== 2) return pares;
    let ids;
    try { ids = await idsNoIB(cons.ast, meta); } catch { return pares; }
    if (!ids) return pares;
    const oi = new Map(meta.orgs.map((o, i) => [o, i]));
    return pares.filter(([m, o]) => {
      if (m < meta.de || m > meta.ate || !oi.has(o)) return true; // mês ainda fora do índice
      const id = ((+m.slice(0, 4) - meta.base) * 12 + (+m.slice(5, 7) - 1)) * meta.orgs.length + oi.get(o);
      return ids.has(id);
    });
  }
  const rotPeriodo = (p, meses) => (p === "todo" ? "todo o acervo" : /^desde:/.test(p) ? `desde ${p.slice(6)}` : /^a:\d{4}$/.test(p) ? `ano de ${p.slice(2)}` : meses.length === 1 ? fmtMesL(meses[0]) : meses.length ? `${fmtMes(meses[meses.length - 1])} a ${fmtMes(meses[0])}` : "período sem acórdãos");
  async function buscar() {
    const tk = ++AC.token;
    const f = { ...AC.f, q: $("#ac-q").value, c: (AC.f.c || "").trim(), rl: (AC.f.rl || "").trim(), n: digitos(AC.f.n) };
    gravarHash("pesquisa", { ...f, p: f.p === "todo" ? "" : f.p, s: f.s === "auto" ? "" : f.s, r: f.r ? "" : "0", x: f.x, t: f.t });
    const todos = D.man.meses.map((m) => m.m);
    // Número de processo digitado na busca, com ou sem classe e pontos ("REsp 2.231.419/SP",
    // "AgInt no AREsp 123456", "2231419"): procura em todo o acervo e nas publicações recentes do DJEN.
    const mNum = /^\s*((?:[A-Za-z]{2,12}\.?\s+(?:no|na|nos|nas|em)\s+)*[A-Za-z]{2,12}\.?)?\s*(\d[\d.\-\s]*\d|\d)\s*(?:\/\s*[A-Za-z]{2})?\s*$/.exec(f.q);
    const clNum = mNum?.[1] || "";
    const soNum = mNum && !/^(tema|s[uú]mula|sumula|art|arts|lei|decreto|lc|cpc|cc|cf|resolu)/i.test(clNum) && digitos(mNum[2]).length >= (clNum ? 3 : 5) ? digitos(mNum[2]) : "";
    if (soNum) { f.n = soNum; f.q = ""; }
    let meses = mesesDoPeriodo(f.p, todos);
    const orgs = f.o ? listaV(f.o) : Object.keys(D.orgaos);
    let pares = [], ids = null;
    if (f.n) {
      const ix = await carregar("numeros").catch(() => null);
      if (ix) {
        const hit = ix.l.filter((x) => x[0] === f.n || x[1] === f.n || (f.n.length >= 6 && x[0].includes(f.n)));
        ids = new Set(hit.map((x) => String(x[4])));
        const vistos = new Set();
        for (const x of hit) { const k = `${ix.m[x[2]]}|${ix.o[x[3]]}`; if (!vistos.has(k) && temV(f.o, ix.o[x[3]])) { vistos.add(k); pares.push([ix.m[x[2]], ix.o[x[3]]]); } }
        meses = [...new Set(pares.map((x) => x[0]))].sort().reverse();
      } else meses = todos;
    }
    if (!ids) for (const m of meses) { const info = D.man.meses.find((x) => x.m === m); for (const o of orgs) if (info?.orgaos[o]) pares.push([m, o]); }
    const cons = Busca.compilar(f.q);
    const paresTodos = pares.length;
    if (!ids && !cons.vazio && pares.length > 12) {
      $("#ac-info").textContent = "Consultando o índice…";
      pares = await filtrarPorIndice(cons, pares);
      if (tk !== AC.token) return;
    }
    const clsSel = listaV(f.c).map(norm), relSel = listaV(f.rl).map(norm);
    const temTexto = !cons.vazio;
    const ordem = f.s === "auto" ? (temTexto ? "rel" : "data") : f.s;
    const ord = {
      data: (a, b) => (b.dj || "").localeCompare(a.dj || "") || (b.s ?? 0) - (a.s ?? 0),
      julg: (a, b) => (b.dd || "").localeCompare(a.dd || ""),
      rel: (a, b) => (b._sc || 0) - (a._sc || 0) || (b.dj || "").localeCompare(a.dj || ""),
    }[ordem];
    const passa = (r) => {
      const sc0 = r.s ?? 0;
      if (ids ? !ids.has(String(r.id)) : f.n && !(String(r.n).includes(f.n) || String(r.reg).includes(f.n))) return false;
      if (f.r && !f.n && sc0 <= (temTexto ? -3 : -2)) return false;
      if (f.x && sc0 < 6) return false;
      if (f.t && !r.tese && !r.tj) return false;
      if (f.a && !casaMat(f.a, r.ar, r.sa)) return false;
      if (clsSel.length && !clsSel.includes(norm(r.cl))) return false;
      if (relSel.length) { const nr = norm(r.rel); if (!relSel.some((x) => nr === x || nr.includes(x))) return false; }
      if (temTexto) {
        if (r._n === undefined) r._n = norm([r.em, r.tese, r.tj, r.tema, r.notas, r.info, (r.leg || []).join(" ")].join("\n"));
        if (!cons.testa(r._n)) return false;
        const i = r._n.indexOf("\n");
        r._sc = cons.pontua(r._n, r._n.slice(0, i > 0 ? i : 400)) + Math.max(0, sc0) * 0.6 + (r.tese || r.tj ? 1 : 0);
      } else r._sc = sc0;
      return true;
    };
    // Guarda no máximo MAX_RES resultados (os mais recentes ou os mais aderentes), para não pesar no navegador.
    const MAX_RES = 5000;
    const res = []; let total = 0;
    const consumir = (lista) => {
      for (const r of lista) {
        // Guarda classes e relatores vistos, para oferecê-los como opções nos filtros.
        if (r.cl) AC.cls.set(r.cl, (AC.cls.get(r.cl) || 0) + 1);
        if (r.rel && !AC.rels.has(r.rel)) AC.rels.set(r.rel, 0);
        if (r.rel) AC.rels.set(r.rel, AC.rels.get(r.rel) + 1);
        if (!passa(r)) continue;
        total++;
        res.push(r);
        if (res.length > MAX_RES * 1.5) { res.sort(ord); res.length = MAX_RES; }
      }
    };
    const prog = $("#ac-prog");
    const longo = !ids && pares.length > 240;
    let cortado = false;
    AC.parar = 0;
    if (!longo) {
      const pend = pares.filter(([m, o]) => !D.shards.has(`${m}/${o}`)).length;
      if (pend) { prog.hidden = false; prog.firstElementChild.style.width = "0"; $("#ac-info").textContent = `Carregando ${pares.length} arquivo(s)…`; }
      const dados = await carregarShards(pares, (a, b) => { if (tk === AC.token) prog.firstElementChild.style.width = `${(a / b) * 100}%`; });
      if (tk !== AC.token) return;
      consumir(dados);
    } else {
      // Período longo: percorre os arquivos do mais recente ao mais antigo, sem guardá-los na memória.
      prog.hidden = false; prog.firstElementChild.style.width = "0";
      let i = 0, feitos = 0, mesAt = pares[0]?.[0] || "";
      const mostrar = (fim) => {
        if (tk !== AC.token) return;
        prog.firstElementChild.style.width = `${(feitos / pares.length) * 100}%`;
        if (fim) return;
        $("#ac-info").innerHTML = `Buscando em ${fmtMesL(mesAt)} · <b>${fmtInt(total)}</b> encontrado(s) até agora · ${Math.round((feitos / pares.length) * 100)}% <button type="button" class="btn btn-fant btn-peq" id="ac-parar">Parar</button>`;
        $("#ac-parar")?.addEventListener("click", () => { AC.parar = tk; });
      };
      let ultimoRender = 0;
      const trab = async () => {
        while (i < pares.length && tk === AC.token && AC.parar !== tk) {
          if (ordem !== "rel" && res.length >= MAX_RES) { cortado = true; break; }
          const [m, o] = pares[i++]; mesAt = m;
          let l = [];
          try { l = D.shards.has(`${m}/${o}`) ? await shard(m, o) : await getJSONgz(`data/acordaos/${m}/${o}.json`); } catch { /* arquivo indisponível */ }
          if (tk !== AC.token) return;
          consumir(l); feitos++;
          if (feitos % 10 === 0) mostrar();
          if (feitos - ultimoRender >= 60) { ultimoRender = feitos; res.sort(ord); AC.lista = agrupar(res.slice(0, 500).map((r) => Object.assign(r, { _dup: [] }))); AC.termos = cons.termos; renderLista(true); }
        }
      };
      mostrar();
      await Promise.all(Array.from({ length: Math.min(4, pares.length) }, trab));
      if (tk !== AC.token) return;
    }
    prog.hidden = true;
    res.sort(ord); if (res.length > MAX_RES) res.length = MAX_RES;
    AC.lista = agrupar(res.map((r) => Object.assign(r, { _dup: [] }))); AC.termos = cons.termos;
    // Processo ainda sem ementa no acervo: publicações recentes no DJEN e sessões marcadas.
    const extra = $("#ac-extra"); extra.innerHTML = "";
    if (f.n) {
      const [dj, pl] = await Promise.all([djen().catch(() => []), pautas().catch(() => [])]);
      if (tk !== AC.token) return;
      const casaN = (p, reg) => { const d = digitos(p); return d === f.n || reg === f.n || (f.n.length >= 6 && d.includes(f.n)); };
      const noAcervo = new Set(res.map((r) => `${r.reg}|${r.dj}`));
      const pubs = dj.filter((x) => casaN(x.p, x.reg) && !noAcervo.has(`${x.reg}|${x.d}`)).sort((a, b) => b.d.localeCompare(a.d));
      const sess = pl.filter((x) => x.d >= hojeISO() && casaN(x.p, x.reg)).sort((a, b) => a.d.localeCompare(b.d));
      if (pubs.length || sess.length) {
        extra.innerHTML = `<p class="nota extra-tit">${pubs.length ? `<b>Publicado recentemente no DJEN</b> · ainda sem ementa no arquivo mensal do STJ` : ""}${pubs.length && sess.length ? " · " : ""}${sess.length ? "<b>Em pauta</b>" : ""}</p>
          <ol class="lista">${sess.map((x) => cardPauta(x)).join("")}${pubs.map((x) => cardDjen(x)).join("")}</ol>`;
      }
    }
    const rot = f.n ? `processo ${fmtNumProc(f.n)} em todo o acervo${extra.innerHTML ? " e no DJEN" : ""}` : rotPeriodo(f.p, meses);
    const parcial = AC.parar === tk ? " · busca interrompida" : "";
    const corte = total > res.length && !cortado ? ` · exibindo os ${fmtInt(res.length)} ${ordem === "rel" ? "mais aderentes" : "mais recentes"}` : "";
    const lidosIB = pares.length < paresTodos ? ` · ${fmtInt(pares.length)} de ${fmtInt(paresTodos)} arquivos mensais contêm os termos` : "";
    if (f.n && !AC.lista.length && extra.innerHTML) $("#ac-info").innerHTML = `Processo <b>${fmtNumProc(f.n)}</b>: ainda sem ementa no acervo. Veja abaixo a publicação no DJEN.`;
    else if (cortado) $("#ac-info").innerHTML = `Exibindo os <b>${fmtInt(res.length)}</b> acórdãos ${ordem === "julg" ? "julgados mais recentemente" : "mais recentes"} (limite da consulta; use os filtros para refinar) · ${rot}${lidosIB}${parcial}${f.r ? " · rotina oculta" : ""} ${explicacaoHTML(cons)}`;
    else $("#ac-info").innerHTML = `<b>${fmtInt(total > res.length ? total : AC.lista.length)}</b> resultado(s)${corte} · ${rot}${lidosIB}${parcial}${f.r ? " · rotina oculta" : ""} · ${ordem === "rel" ? "por relevância" : ordem === "julg" ? "por data de julgamento" : "mais recentes primeiro"} ${explicacaoHTML(cons)}`;
    renderLista(true);
  }
  const pgAc = paginador("ac", () => renderLista(false), "#ac-lista");
  function renderLista(reset) {
    const ul = $("#ac-lista");
    if (reset) pgAc.pag = 1;
    ul.innerHTML = pgAc.fatia(AC.lista).map((r) => cardAcordao(r, { termos: AC.termos })).join("");
    $("#ac-pag").innerHTML = pgAc.html(AC.lista.length);
    if (!AC.lista.length && $("#ac-extra")?.innerHTML) ul.innerHTML = "";
    else if (!AC.lista.length) ul.innerHTML = vazio("pesquisa", "Nenhum acórdão encontrado", "Amplie o período, escolha “Exibir: tudo” para incluir as decisões de rotina ou revise os termos. Toque em “?” para ver como combinar palavras.");
  }

  // ======================================================= RESUMO DA SEMANA
  const segundaDe = (iso) => { const d = new Date(iso + "T12:00:00Z"); return somaDias(iso, -((d.getUTCDay() + 6) % 7)); };
  const fmtCurta = (iso) => { const d = new Date(iso + "T12:00:00Z"); return `${d.getUTCDate()} de ${MESES_L[d.getUTCMonth()]}`; };
  const TIPOS_SEM = {
    teses: { rot: "Teses firmadas", selo: "Tese firmada", cls: "ok", longo: "Teses firmadas em repetitivos" },
    info: { rot: "Informativo", selo: "Informativo", cls: "info", longo: "Notas do Informativo do STJ" },
    afet: { rot: "Temas afetados", selo: "Tema afetado", cls: "rel", longo: "Novos temas afetados" },
    julg: { rot: "Julgados com tese", selo: "Julgado", cls: "pri", longo: "Julgados com tese publicados" },
    sum: { rot: "Súmulas", selo: "Súmula", cls: "acomp", longo: "Súmulas aprovadas" },
    prox: { rot: "Em pauta", selo: "Em pauta", cls: "alta", longo: "Repetitivos em pauta na semana seguinte" },
  };
  async function vSemana(main, p) {
    const hoje = hojeISO(), esta = segundaDe(hoje);
    const ini = segundaDe(/^\d{4}-\d{2}-\d{2}$/.test(p.get("s") || "") ? p.get("s") : hoje), fim = somaDias(ini, 6);
    const f = { a: p.get("a") || "", tp: (p.get("tp") || "").split(",").filter((x) => TIPOS_SEM[x]), g: p.get("g") || "tipo" };
    const [t, pl, inf, sm, fj] = await Promise.all([temas(), pautas(), informativos().catch(() => []), sumulas().catch(() => []), feedJulgados().catch(() => [])]);
    // Todas as novidades de uma semana, no mesmo formato.
    function novidades(i0) {
      const i1 = somaDias(i0, 6), na = (d) => d && d >= i0 && d <= i1, out = [];
      for (const x of t) {
        if (x.tp === "Tema" && na(x.julg) && (x.tese || x._teseAguarda)) out.push({ tp: "teses", d: x.julg, ds: [["Julgado", x.julg], ["Acórdão publicado", x.pub], ["Afetado", x.afet]], ar: x.ar, sa: x.sa, k: `${x.tp} ${fmtNumProc(x.n)} · ${x.org || ""}`, t: x.tese ? limparTeseTxt(x.tese) : "Julgado; a tese será divulgada com a publicação do acórdão.", m: `${x.tp} ${fmtNumProc(x.n)} · ${x.org || ""}`, ab: `t:${x.n}`, txt: `${x.tp} ${x.n}/STJ: ${x.tese || "julgado; tese a publicar"}` });
        if (na(x.afet) && x.q) out.push({ tp: "afet", d: x.afet, ds: [["Afetado", x.afet]], ar: x.ar, sa: x.sa, k: `${x.tp} ${fmtNumProc(x.n)} · ${x.org || ""}`, t: x.q, m: `${x.tp} ${fmtNumProc(x.n)} · ${x.org || ""}${/suspens/i.test(x.info || "") ? " · com suspensão de processos" : ""}`, ab: `t:${x.n}`, txt: `${x.tp} ${x.n}/STJ (afetado): ${x.q}` });
      }
      for (const x of inf) if (na(x.d) && !/afeta/i.test(x.sec)) out.push({ tp: "info", d: x.d, ds: [["Julgado", x.julg], ["DJEN", (() => { const m = /DJEN?\s*(?:de\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(x.proc || ""); const iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; return iso && (!x.julg || iso >= x.julg) ? iso : ""; })()], [`Informativo ${x.ed}`, x.d]], ar: x.ar, sa: x.sa, k: x.tema.replace(/\s*Tema\s+\d[\d.]*\.?\s*$/i, "").replace(/\.$/, ""), t: x.t, m: `${x.p?.[0] ? `${x.p[0].cl} ${fmtNumProc(x.p[0].n)} · ` : ""}${x.org || x.sec} · Informativo ${x.ed}`, ab: `i:${x.id}`, txt: `${x.tema} ${x.t.replace(/\n/g, " ")} (${x.p?.[0] ? `${x.p[0].cl} ${fmtNumProc(x.p[0].n)}, ` : ""}${x.org || x.sec}; Informativo ${x.ed})` });
      for (const r of fj) if (na(r.dj) && (r.tese || r.tj)) out.push({ tp: "julg", d: r.dj, ds: [["Julgado", r.dd], ["Publicado", r.dj]], s: r.fs ?? r.s ?? 0, ar: r.ar, sa: r.sa, k: r.as ? frase(r.as).replace(/\.\s+(?=\p{Lu})/gu, " · ") : `${r.cl} ${fmtNumProc(r.n)}`, t: limparTeseTxt(r.tese || r.tj), m: `${r.cl} ${fmtNumProc(r.n)} · ${D.orgaos[r.o] || ""}${r.rel ? ` · ${relatorFmt(r.rel)}` : ""}`, ab: `a:${r.id}`, txt: `${String(r.tese || r.tj).replace(/\n+/g, " ")} (${r.cl} ${fmtNumProc(r.n)}, ${D.orgaos[r.o] || ""})`, esc: true });
      for (const x of sm) if (na(x.julg) || na(x.pub)) out.push({ tp: "sum", d: x.julg || x.pub, ds: [["Aprovada", x.julg], ["Publicada", x.pub]], ar: x.ar, sa: x.sa, k: `Súmula ${x.n} · ${x.org || ""}`, t: x.t, m: `Súmula ${x.n}/STJ · ${x.org || ""}`, ab: `s:${x.n}`, txt: `Súmula ${x.n}/STJ: ${x.t}` });
      const vistos = new Set();
      for (const x of pl) for (const [tp, n] of x.temas || []) {
        if (x.d > i1 && x.d <= somaDias(i1, 7) && !vistos.has(`${tp}${n}`)) { vistos.add(`${tp}${n}`); const tt = t.idx.get(`${tp}-${n}`);
          if (tt) out.push({ tp: "prox", d: x.d, ds: [["Sessão", x.d], ["Afetado", tt.afet]], ar: tt.ar, sa: tt.sa, k: `${tt.tp} ${fmtNumProc(tt.n)} · ${D.orgaos[x.o] || tt.org || ""}`, t: tt.q, m: `${x.p} · ${fmtDiaL(x.d)}`, ab: `t:${tt.n}`, txt: `${tt.tp} ${tt.n}/STJ, em pauta em ${fmtData(x.d)}: ${tt.q}` }); }
      }
      return out;
    }
    const todos = novidades(ini);
    const semanas = Array.from({ length: 16 }, (_, i) => somaDias(esta, -7 * i));
    const contSem = new Map(semanas.map((w) => [w, w === ini ? todos.length : novidades(w).length]));
    const intervalo = (w) => { const e = somaDias(w, 6); return `${+w.slice(8)}${w.slice(5, 7) !== e.slice(5, 7) ? ` de ${MESES_L[+w.slice(5, 7) - 1]}` : ""} a ${fmtCurta(e)}`; };
    main.innerHTML = `<div id="sem">
      <div class="sem-cab">
        <div><p class="sem-sobre">${ini === esta ? "Esta semana" : ini === somaDias(esta, -7) ? "Semana passada" : "Semana"}</p><h2>${intervalo(ini)}${ini.slice(0, 4) !== hoje.slice(0, 4) ? ` de ${ini.slice(0, 4)}` : ""}</h2></div>
        <div class="sem-nav">
          <a class="btn btn-claro btn-peq" href="#semana?s=${somaDias(ini, -7)}" aria-label="Semana anterior">${ico("seta", "gira")}</a>
          <span class="fd-filtros" id="sem-escolher"></span>
          ${ini < esta ? `<a class="btn btn-claro btn-peq" href="#semana?s=${somaDias(ini, 7)}" aria-label="Semana seguinte">${ico("seta")}</a><a class="btn btn-claro btn-peq" href="#semana">Esta semana</a>` : ""}
        </div>
      </div>
      <div class="sem-resumo" id="sem-resumo"></div>
      <div class="sem-ferr"><div class="fd-filtros filtros-lista" id="sem-pil"></div>
        <div class="sem-acoes" id="sem-acoes">
          <button type="button" class="btn btn-pri btn-peq" id="sem-copiar">${ico("copiar")} Copiar resumo</button>
          <button type="button" class="btn btn-claro btn-peq" id="sem-imprimir" title="Imprimir ou salvar em PDF">${ico("arquivo")} PDF</button>
          <button type="button" class="btn btn-claro btn-peq" id="sem-link" title="Copiar link desta semana">${ico("link")}</button></div></div>
      <div id="sem-corpo"></div></div>`;
    let vis = [], cA = {};
    // Seletor de semana: qualquer data do calendário ou uma das semanas recentes.
    pilulas($("#sem-escolher"), [{ rot: "Escolher semana", titulo: "Escolher semana", tipo: "um", ico: "semana", obrigatorio: true, semLimpar: true, padrao: ini, rotAtual: () => "Escolher semana",
      datas: "uma", rotData: "Qualquer dia da semana desejada", max: hoje, rotAtalhos: "Semanas recentes", vertical: true,
      get: () => ini, set: (v) => { location.hash = `#semana?s=${segundaDe(v)}${f.a ? `&a=${f.a}` : ""}${f.tp.length ? `&tp=${f.tp.join(",")}` : ""}${f.g !== "tipo" ? `&g=${f.g}` : ""}`; },
      opcoes: () => semanas.map((w) => ({ v: w, t: `${w === esta ? "Esta semana · " : ""}${intervalo(w)}`, n: contSem.get(w) })) }], () => {});
    const linha = (it) => { const tp = TIPOS_SEM[it.tp], a = (it.ar || [])[0];
      const datas = (it.ds || []).filter(([, d]) => d).map(([r, d]) => `<span><b>${esc(r)}</b> ${fmtData(d)}</span>`).join("");
      return `<li class="ncard ncard-sem" style="--h:${AREA_COR[a] ?? 222}"><div class="nota-cab"><span class="selo ${tp.cls}">${tp.selo}</span>${seloMat(it.ar, it.sa)}</div>
        ${datas ? `<div class="nota-datas">${datas}</div>` : ""}
        <h3 class="nota-tema"><button type="button" data-sem="${esc(it.ab)}">${esc(it.k)}</button></h3>
        <div class="nota-tese${it.t.length > 600 ? " longa" : ""}">${it.t.split("\n").map((z) => `<p>${esc(z)}</p>`).join("")}</div>
        ${it.t.length > 600 ? `<button type="button" class="nota-mais" data-sem-ler>Continuar lendo</button>` : ""}
        <div class="nota-rodape"><span class="nota-proc">${esc(it.m)}</span><span class="dir"><button type="button" class="link-acao" data-sem="${esc(it.ab)}">Abrir ${ico("seta")}</button></span></div></li>`; };
    function desenhar() {
      gravarHash("semana", { s: ini === esta ? "" : ini, a: f.a, tp: f.tp.join(","), g: f.g === "tipo" ? "" : f.g });
      const porMat = todos.filter((x) => casaMat(f.a, x.ar, x.sa));
      cA = contarMat(todos.filter((x) => !f.tp.length || f.tp.includes(x.tp)), (x) => x.ar, (x) => x.sa);
      const contT = {}; porMat.forEach((x) => (contT[x.tp] = (contT[x.tp] || 0) + 1));
      vis = porMat.filter((x) => !f.tp.length || f.tp.includes(x.tp));
      $("#sem-resumo").innerHTML = Object.entries(TIPOS_SEM).filter(([k]) => contT[k]).map(([k, v]) => `<button type="button" class="capa-bloco ${v.cls}" data-sem-tp="${k}" aria-pressed="${f.tp.includes(k)}"><b>${fmtInt(contT[k])}</b><span>${v.longo}</span></button>`).join("");
      pil.desenhar();
      let grupos = [];
      if (f.g === "tipo") grupos = Object.entries(TIPOS_SEM).map(([k, v]) => ({ tit: v.longo, cls: v.cls, itens: vis.filter((x) => x.tp === k).sort((a, b) => (b.s || 0) - (a.s || 0) || b.d.localeCompare(a.d)) }));
      if (f.g === "mat") grupos = [...Object.keys(AREAS), ""].map((a) => ({ tit: AREAS[a] || "Sem matéria identificada", h: AREA_COR[a], itens: vis.filter((x) => ((x.ar || [])[0] || "") === a) }));
      if (f.g === "dia") { const dias = [...new Set(vis.map((x) => x.d))].sort().reverse(); grupos = dias.map((d) => ({ tit: fmtDiaL(d).replace(/^./, (c) => c.toUpperCase()), itens: vis.filter((x) => x.d === d) })); }
      grupos = grupos.filter((g) => g.itens.length);
      $("#sem-corpo").innerHTML = grupos.length ? grupos.map((g, gi) => `<section class="grupo-notas">
          <header class="grupo-cab"${g.h != null ? ` style="--h:${g.h}"` : ""}><h2>${esc(g.tit)}</h2><span>${g.itens.length} ${g.itens.length > 1 ? "itens" : "item"}</span></header>
          <ol class="lista-notas">${g.itens.slice(0, 6).map(linha).join("")}</ol>
          ${g.itens.length > 6 ? `<button type="button" class="btn btn-claro btn-mais" data-sem-mais="${gi}">Mostrar mais (${g.itens.length - 6})</button>` : ""}</section>`).join("")
        : vazio("destaques", todos.length ? "Nada neste filtro" : "Semana sem novidades registradas", todos.length ? "Troque a matéria ou o tipo de novidade." : "Os repetitivos, as pautas e o Informativo mudam toda semana; os julgados chegam em lotes mensais. Escolha outra semana.");
      grupos.forEach((g, gi) => { $(`[data-sem-mais="${gi}"]`)?.addEventListener("click", (e) => { e.currentTarget.previousElementSibling.innerHTML = g.itens.map(linha).join(""); e.currentTarget.remove(); }); });
    }
    const pil = pilulas($("#sem-pil"), [
      { rot: "Matéria", tipo: "materia", get: () => f.a, set: (v) => (f.a = v), cont: () => cA },
      { rot: "Tipo", titulo: "Tipo de novidade", tipo: "multi", get: () => f.tp, set: (v) => (f.tp = v), opcoes: () => Object.entries(TIPOS_SEM).map(([k, v]) => ({ v: k, t: v.rot, n: todos.filter((x) => x.tp === k && casaMat(f.a, x.ar, x.sa)).length })) },
      defOrdem(() => f.g, (v) => (f.g = v), [{ v: "tipo", t: "Tipo de novidade" }, { v: "mat", t: "Matéria" }, { v: "dia", t: "Dia" }], "Escolha como agrupar as novidades da semana."),
    ], desenhar);
    $("#sem-resumo").addEventListener("click", (e) => { const b = e.target.closest("[data-sem-tp]"); if (!b) return; const k = b.dataset.semTp; f.tp = f.tp.includes(k) ? f.tp.filter((x) => x !== k) : [...f.tp, k]; desenhar(); });
    $("#sem-corpo").addEventListener("click", async (e) => {
      const ler = e.target.closest("[data-sem-ler]");
      if (ler) { const tt = ler.closest(".ncard").querySelector(".nota-tese"); tt.classList.toggle("aberta"); ler.textContent = tt.classList.contains("aberta") ? "Recolher" : "Continuar lendo"; return; }
      const b = e.target.closest("[data-sem]"); if (!b) return;
      const [k, v] = [b.dataset.sem.slice(0, 1), b.dataset.sem.slice(2)];
      if (k === "t") abrirTema("Tema", +v);
      if (k === "s") abrirSumula(+v);
      if (k === "i") { const l = await informativos(); abrirInformativo(l.idx.get(v)); }
      if (k === "a") { const r = fj.find((x) => String(x.id) === v); if (r) abrirAcordao(r); }
    });
    $("#sem-copiar").addEventListener("click", () => {
      const tipos = Object.keys(TIPOS_SEM).filter((k) => vis.some((x) => x.tp === k));
      const txt = [`Resumo do STJ — semana de ${intervalo(ini)}${f.a ? ` (${rotMat(f.a)})` : ""}`, ...tipos.map((k) => { const its = vis.filter((x) => x.tp === k); return `\n${TIPOS_SEM[k].longo.toUpperCase()} (${its.length})\n${its.slice(0, 12).map((it) => `• ${it.txt}${(it.ds || []).filter(([, d]) => d).length ? ` [${it.ds.filter(([, d]) => d).map(([r, d]) => `${r.toLowerCase()} em ${fmtData(d)}`).join("; ")}]` : ""}`).join("\n")}${its.length > 12 ? `\n• e mais ${its.length - 12}` : ""}`; }), `\nFonte: Radar STJ — ${location.href}`].join("\n");
      copiar(txt, "Resumo copiado. Cole no e-mail ou no WhatsApp.");
    });
    $("#sem-imprimir").addEventListener("click", () => window.print());
    $("#sem-link").addEventListener("click", () => copiar(location.href, "Link desta semana copiado."));
    desenhar();
  }

  // ================================================ JURISPRUDÊNCIA EM TESES
  const URL_JT = (ed) => `https://scon.stj.jus.br/SCON/jt/doc.jsp?livre=${encodeURIComponent(`'${ed}' INPATH(TIT)`)}`;
  const tesesJT = () => carregar("teses", (eds) => {
    const itens = [];
    for (const e of eds) for (const t of e.teses) itens.push({ id: `${e.ed}-${t.n}`, ed: e.ed, tit: e.tit, ramo: e.ramo || [], ar: t.ar || e.ar || [], sa: t.sa || [], disp: e.disp, ate: e.ate, n: t.n, t: t.t, ac: t.ac || [], nac: t.nac || 0, dm: t.dm || 0, _n: norm(`${e.tit} ${t.t} ${(e.ramo || []).join(" ")}`) });
    itens.eds = eds; itens.idx = new Map(itens.map((x) => [x.id, x]));
    return itens;
  });
  const abasSumulas = (aba) => `<div class="segmentos" role="tablist" style="margin-bottom:14px">
      <button type="button" role="tab" data-sm-aba="" aria-selected="${aba !== "teses"}">Súmulas</button>
      <button type="button" role="tab" data-sm-aba="teses" aria-selected="${aba === "teses"}">Jurisprudência em Teses</button></div>`;
  const ligarAbasSumulas = (main) => $$("[data-sm-aba]", main).forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.smAba ? "#sumulas?aba=teses" : "#sumulas"; }));
  const titJT = (s) => frase(String(s || "").toUpperCase() === s ? s : s).replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii)\b/g, (m) => m.toUpperCase());
  const fmtAc = (a) => a.replace(/Rel\. (Min\.|Ministr[oa]) ([^,]+)/, (m, t, n) => `Rel. ${t} ${titulo(n)}`).replace(/, (PRIMEIRA|SEGUNDA|TERCEIRA|QUARTA|QUINTA|SEXTA) (TURMA|SEÇÃO)/, (m, a, b) => `, ${titulo(a)} ${titulo(b)}`).replace(/CORTE ESPECIAL/, "Corte Especial");
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-tese-copiar]"); if (!b) return;
    const l = await tesesJT(); const x = l.idx.get(b.closest("[data-tese]")?.dataset.tese); if (!x) return;
    const ref = `(STJ, Jurisprudência em Teses, Edição n. ${x.ed} – ${titJT(x.tit)}, tese ${x.n}${x.ac[0] ? `; entre outros: ${fmtAc(x.ac[0]).replace(/[\s,;.]+$/, "")}` : ""}.)`;
    if (b.dataset.teseCopiar === "ref") copiar(ref, "Citação copiada.");
    else copiar(`${x.t} ${ref}`, "Tese e citação copiadas.");
  });
  // Uma tese dentro da edição (lista numerada, compacta).
  function linhaTeseJT(x, termos = [], comEdicao = false) {
    const nPrec = x.nac + x.dm;
    return `<li class="jt-tese" data-tese="${esc(x.id)}">
      <span class="jt-n">${x.n}</span>
      <div class="jt-corpo">
        ${comEdicao ? `<p class="jt-origem">${seloMat(x.ar, x.sa)}<span>Edição ${x.ed} · ${esc(titJT(x.tit))}${x.disp ? ` · ${fmtData(x.disp)}` : ""}</span></p>` : ""}
        <p class="jt-texto">${destacar(esc(x.t), termos)}</p>
        <div class="jt-acoes">
          ${x.ac.length ? `<details class="precedentes"><summary>${nPrec} precedente(s)</summary><ul>${x.ac.map((a) => `<li>${esc(fmtAc(a))}</li>`).join("")}</ul>${x.nac > x.ac.length ? `<p class="nota">E mais ${x.nac - x.ac.length} na edição oficial.</p>` : ""}</details>` : `<span class="nota">Sem precedentes listados</span>`}
          <span class="dir"><button type="button" class="btn-ico" data-tese-copiar="ref" title="Copiar só a citação" aria-label="Copiar só a citação">${ico("citar")}</button><button type="button" class="btn-ico" data-tese-copiar title="Copiar tese e citação" aria-label="Copiar tese e citação">${ico("copiar")}</button>${botaoSalvar(`j:${x.id}`, { k: "j", id: x.id })}</span>
        </div>
      </div></li>`;
  }
  async function vTeses(main, p) {
    const l = await tesesJT();
    const eds = l.eds;
    const porEdT = new Map(); for (const x of l) { if (!porEdT.has(x.ed)) porEdT.set(x.ed, []); porEdT.get(x.ed).push(x); }
    const dmin = eds.reduce((m, e) => (e.disp && e.disp < m ? e.disp : m), "9999"), dmax = eds.reduce((m, e) => (e.disp > m ? e.disp : m), "");
    const f = { q: p.get("q") || "", a: p.get("a") || "", e: p.get("e") || "", s: p.get("s") || "" };
    main.innerHTML = `${abasSumulas("teses")}
      <div id="jt-f" class="bloco-filtros">
        ${campoBusca("jt-q", 'Tese ou assunto. Ex.: "bem de família" ou "dano moral"', f.q)}
        <div class="fd-filtros filtros-lista" id="jt-pil"></div>
      </div>
      <div class="barra-res"><p id="jt-info" aria-live="polite"></p><span class="dir"><button type="button" class="btn btn-fant btn-peq" id="jt-abrir-todas" hidden>Abrir todas</button></span></div>
      <div id="jt-lista"></div>
      <div id="jt-pag"></div>`;
    ligarAbasSumulas(main);
    let linhas = [], plano = false, termos = [], ca = {}, abertas = new Set(), cons = null, ordemAt = "rec";
    const pgJt = paginador("jt", () => render(), "#jt-lista");
    const noPer = (x) => {
      if (!f.e) return true;
      if (f.e.startsWith("e:")) return x.ed === +f.e.slice(2);
      if (/^m\d+$/.test(f.e)) return x.disp >= somaDias(hojeISO(), -30 * +f.e.slice(1));
      if (f.e.startsWith("d:")) { const [, de, ate] = f.e.split(":"); return (!de || x.disp >= de) && (!ate || x.disp <= ate); }
      return true;
    };
    // Linha da edição: fechada mostra o assunto e a contagem; aberta mostra as teses.
    const linhaEd = (g) => {
      const e = g.e, aberta = abertas.has(e.ed), todas = porEdT.get(e.ed) || [];
      const mostrar = aberta ? (g.verTodas || !g.filtrada ? todas : g.teses) : [];
      const ar = e.ar?.length ? e.ar : [...new Set(todas.flatMap((x) => x.ar))].slice(0, 1);
      return `<section class="jt-ed${aberta ? " aberta" : ""}" data-ed="${e.ed}" style="--h:${AREA_COR[ar[0]] ?? 222}">
        <button type="button" class="jt-ed-cab" data-jt-abrir="${e.ed}" aria-expanded="${aberta}">
          <span class="jt-ed-num"><small>Edição</small>${e.ed}</span>
          <span class="jt-ed-tit"><b>${destacar(esc(titJT(e.tit)), termos)}</b>
            <span class="jt-ed-meta">${seloMat(ar, [])}<span>${g.filtrada ? `${g.teses.length} de ${todas.length} teses correspondem` : `${todas.length} teses`}</span>${e.disp ? `<span>disponibilizada em ${fmtData(e.disp)}</span>` : ""}</span></span>
          ${ico("seta")}
        </button>
        ${aberta ? `<div class="jt-ed-corpo">
          <div class="jt-ed-info">${e.ate ? `<span>Julgados publicados até ${fmtData(e.ate)}</span>` : ""}<a class="link-acao" href="${URL_JT(e.ed)}" target="_blank" rel="noopener">Edição oficial ${ico("externo")}</a></div>
          <ol class="jt-teses">${mostrar.map((x) => linhaTeseJT(x, termos)).join("")}</ol>
          ${g.filtrada && !g.verTodas && todas.length > g.teses.length ? `<button type="button" class="btn btn-claro btn-peq" data-jt-todas="${e.ed}">Ver as ${todas.length} teses da edição</button>` : ""}
        </div>` : ""}
      </section>`;
    };
    const render = () => {
      const box = $("#jt-lista"); const tot = plano ? linhas.length : linhas.length;
      if (!tot) { box.innerHTML = vazio("sumulas", "Nenhuma tese encontrada", "Revise os termos, a matéria ou o período."); $("#jt-pag").innerHTML = ""; $("#jt-abrir-todas").hidden = true; return; }
      const vis = pgJt.fatia(linhas);
      if (plano) box.innerHTML = `<ol class="jt-teses plano">${vis.map((x) => linhaTeseJT(x, termos, true)).join("")}</ol>`;
      else {
        let html = "", cabAnt = "";
        for (const g of vis) {
          const cab = ordemAt === "rec" ? (g.e.disp || "").slice(0, 4) : ordemAt === "mat" ? (g.ar0 || "-") : "";
          if (cab && cab !== cabAnt) { html += `<h2 class="jt-divisor"${ordemAt === "mat" ? ` style="--h:${AREA_COR[g.ar0] ?? 222}"` : ""}>${ordemAt === "mat" ? esc(AREAS[g.ar0] || "Outras matérias") : cab}</h2>`; cabAnt = cab; }
          html += linhaEd(g);
        }
        box.innerHTML = html;
      }
      $("#jt-pag").innerHTML = pgJt.html(linhas.length);
      const bt = $("#jt-abrir-todas"); bt.hidden = plano || vis.length < 2; bt.textContent = vis.every((g) => abertas.has(g.e?.ed)) ? "Fechar todas" : "Abrir as visíveis";
    };
    const aplicar = () => {
      f.q = $("#jt-q").value;
      gravarHash("sumulas", { aba: "teses", ...f });
      cons = Busca.compilar(f.q); termos = cons.termos;
      const base = l.filter((x) => noPer(x) && (cons.vazio || cons.testa(x._n)));
      ca = contarMat(base, (x) => x.ar, (x) => x.sa);
      const teses = base.filter((x) => casaMat(f.a, x.ar, x.sa));
      const filtrada = !cons.vazio || !!f.a;
      ordemAt = f.s ? (cons.vazio && f.s === "rel" ? "rec" : f.s) : (cons.vazio ? "rec" : "rel");
      plano = ordemAt === "prec";
      const sc = (x) => (cons.vazio ? 0 : cons.pontua(x._n, norm(x.tit)));
      if (plano) { linhas = teses.slice().sort((a, b) => (b.nac + b.dm) - (a.nac + a.dm) || b.ed - a.ed || a.n - b.n); }
      else {
        const m = new Map();
        for (const x of teses) { if (!m.has(x.ed)) m.set(x.ed, { e: eds.find((e) => e.ed === x.ed), teses: [], filtrada, sc: 0 }); const g = m.get(x.ed); g.teses.push(x); g.sc = Math.max(g.sc, sc(x)); }
        linhas = [...m.values()];
        for (const g of linhas) { g.teses.sort((a, b) => a.n - b.n); g.ar0 = (g.e.ar || [])[0] || (g.teses[0].ar || [])[0]; }
        const ordA = Object.keys(AREAS), pos = (a) => { const i = ordA.indexOf(a); return i < 0 ? 99 : i; };
        if (ordemAt === "rec") linhas.sort((a, b) => b.e.ed - a.e.ed);
        if (ordemAt === "tit") linhas.sort((a, b) => norm(a.e.tit).localeCompare(norm(b.e.tit)));
        if (ordemAt === "mat") linhas.sort((a, b) => pos(a.ar0) - pos(b.ar0) || b.e.ed - a.e.ed);
        if (ordemAt === "rel") linhas.sort((a, b) => b.sc - a.sc || b.teses.length - a.teses.length || b.e.ed - a.e.ed);
      }
      // Com busca, as três edições mais aderentes já abrem; sem busca, tudo fechado (fica fácil percorrer).
      abertas = new Set(!plano && !cons.vazio ? linhas.slice(0, 3).map((g) => g.e.ed) : f.e.startsWith("e:") ? [+f.e.slice(2)] : []);
      const nT = plano ? linhas.length : linhas.reduce((n, g) => n + g.teses.length, 0);
      $("#jt-info").innerHTML = `<b>${fmtInt(plano ? new Set(linhas.map((x) => x.ed)).size : linhas.length)}</b> edição(ões) · ${fmtInt(nT)} tese(s)${filtrada ? " correspondentes" : ""} ${explicacaoHTML(cons)}`;
      pgJt.pag = 1; render(); pilJT?.desenhar();
    };
    const rotPer = (v) => (v.startsWith("e:") ? `Edição ${v.slice(2)}` : v.startsWith("d:") ? (() => { const [, de, ate] = v.split(":"); return `${de ? fmtData(de) : "início"} a ${ate ? fmtData(ate) : "hoje"}`; })() : "Período");
    let pilJT = null;
    pilJT = pilulas($("#jt-pil"), [
      { rot: "Matéria", tipo: "materia", get: () => f.a, set: (v) => (f.a = v), cont: () => ca },
      { rot: "Período", titulo: "Período ou edição", tipo: "um", padrao: "", rotAtual: () => "Todas as edições", rotValor: rotPer, get: () => f.e, set: (v) => (f.e = v),
        datas: "intervalo", min: dmin, max: dmax, edicao: { min: 1, max: eds[0]?.ed || 999 }, rotAtalhos: "Atalhos", vertical: true, grupos: [["", ""], ["e", "Edições mais recentes"]],
        opcoes: () => [{ v: "", t: "Todas as edições" }, { v: "m6", t: "Disponibilizadas nos últimos 6 meses" }, { v: "m12", t: "Nos últimos 12 meses" }, { v: "m36", t: "Nos últimos 3 anos" },
          ...eds.slice(0, 10).map((e) => ({ g: "e", v: `e:${e.ed}`, t: `${e.ed} · ${titJT(e.tit)}`, curto: `Edição ${e.ed}` }))],
        nota: "Cada edição reúne as teses de um assunto e é atualizada pelo STJ; a data é a de disponibilização da edição." },
      defOrdem(() => f.s || ($("#jt-q").value.trim() ? "rel" : "rec"), (v) => (f.s = v), [{ v: "rec", t: "Edição mais recente" }, { v: "tit", t: "Assunto (A–Z)" }, { v: "mat", t: "Matéria" }, { v: "prec", t: "Teses com mais precedentes" }, { v: "rel", t: "Mais aderentes à busca" }]),
    ], aplicar);
    $("#jt-q").addEventListener("input", debounce(aplicar, 220));
    $("#jt-abrir-todas").addEventListener("click", () => {
      const vis = pgJt.fatia(linhas); const fechar = vis.every((g) => abertas.has(g.e.ed));
      vis.forEach((g) => (fechar ? abertas.delete(g.e.ed) : abertas.add(g.e.ed))); render();
    });
    $("#jt-lista").addEventListener("click", (e) => {
      const ab = e.target.closest("[data-jt-abrir]");
      if (ab) {
        const ed = +ab.dataset.jtAbrir; abertas.has(ed) ? abertas.delete(ed) : abertas.add(ed);
        const g = linhas.find((z) => z.e?.ed === ed); const sec = ab.closest(".jt-ed");
        sec.outerHTML = linhaEd(g);
        const bt = $("#jt-abrir-todas"); bt.textContent = pgJt.fatia(linhas).every((z) => abertas.has(z.e?.ed)) ? "Fechar todas" : "Abrir as visíveis";
        return;
      }
      const vt = e.target.closest("[data-jt-todas]");
      if (vt) { const ed = +vt.dataset.jtTodas; const g = linhas.find((z) => z.e?.ed === ed); g.verTodas = true; vt.closest(".jt-ed").outerHTML = linhaEd(g); return; }
    });
    ligarAjuda($("#jt-f"), $("#jt-q"), aplicar);
    aplicar();
  }

  // ============================================================== SÚMULAS
  const URL_SUMULA = (n) => `https://scon.stj.jus.br/SCON/pesquisar.jsp?b=SUMU&livre=%40NUM%3D${n}`;
  const SIT_SUM = { vigente: ["Vigente", "ok"], cancelada: ["Cancelada", "canc"], alterada: ["Redação alterada", "rel"] };
  function cardSumula(x, termos) {
    const [sit, cls] = SIT_SUM[x.sit] || SIT_SUM.vigente;
    return `<li class="card item sumula${x.sit === "cancelada" ? " cancelada" : ""}" data-sum="${x.n}">
      <div class="item-cab"><span class="item-tit">Súmula ${x.n}</span>${x.sit !== "vigente" ? `<span class="selo ${cls}">${sit}</span>` : ""}
        <span class="meta">${x.org ? `<span>${esc(x.org)}</span>` : ""}${x.julg ? `<span>Julg. ${fmtData(x.julg)}</span>` : ""}${x.pub ? `<span>Publ. ${fmtData(x.pub)}</span>` : ""}</span></div>
      <div class="item-sel">${seloMat(x.ar, x.sa)}${x.ass ? `<span class="assunto">${esc(x.ass)}</span>` : ""}</div>
      <p class="enunciado">${destacar(esc(x.t), termos)}</p>
      ${x.nota ? `<details class="nota-sum"><summary>${x.sit === "cancelada" ? "Por que foi cancelada" : "Histórico da redação"}</summary><p>${esc(x.nota)}</p></details>` : ""}
      <div class="acoes">
        <a class="link-acao" href="${URL_SUMULA(x.n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>
        <a class="link-acao" href="#pesquisa?q=sumula:${x.n}&p=u3">Acórdãos recentes que aplicam</a>
        <span class="dir"><button type="button" class="btn-ico" data-copiar-sum title="Copiar enunciado e referência" aria-label="Copiar">${ico("copiar")}</button></span>
      </div></li>`;
  }
  async function vSumulas(main, p) {
    if (p.get("aba") === "teses") return vTeses(main, p);
    const l = await sumulas();
    const anos = l.map((x) => +x._d.slice(0, 4)).filter(Boolean);
    const f = { q: p.get("q") || "", a: p.get("a") || "", sit: p.get("sit") ?? "vig", org: p.get("org") || "", per: p.get("per") || "", s: p.get("s") || "rec" };
    main.innerHTML = `${abasSumulas("")}
      <div id="sm-f">
        ${campoBusca("sm-q", 'Número ou termos do enunciado. Ex.: 7 ou "dano moral"', f.q)}
        <div class="fd-filtros filtros-lista" id="sm-pil"></div>
      </div>
      <div class="barra-res"><p id="sm-info"></p><span class="nota">Fonte: página oficial de súmulas do STJ</span></div>
      <ol class="lista" id="sm-lista"></ol>
      <div id="sm-pag"></div>`;
    let lista = [], termos = [], ca = {}, cs = {};
    const pgSm = paginador("sm", () => render(false), "#sm-lista");
    const PER = [["", "Qualquer data"], ["5", "Últimos 5 anos"], ["10", "Últimos 10 anos"], ["2020", "2020 em diante"], ["2010", "2010 a 2019"], ["2000", "2000 a 2009"], ["1990", "1990 a 1999"]];
    const anoAtual = +hojeISO().slice(0, 4);
    const noPer = (x, v) => { if (!v) return true; const a = +x._d.slice(0, 4); if (!a) return false; return v.length === 1 || v === "10" ? a > anoAtual - +v : v === "2020" ? a >= 2020 : a >= +v && a <= +v + 9; };
    const render = (reset) => {
      const ul = $("#sm-lista");
      if (reset) pgSm.pag = 1;
      ul.innerHTML = pgSm.fatia(lista).map((x) => cardSumula(x, termos)).join("");
      $("#sm-pag").innerHTML = pgSm.html(lista.length);
      if (!lista.length) ul.innerHTML = vazio("sumulas", "Nenhuma súmula encontrada", "Revise os termos ou os filtros. Para ver as canceladas, use o filtro Situação.");
    };
    const aplicar = () => {
      f.q = $("#sm-q").value;
      gravarHash("sumulas", { ...f, sit: f.sit === "vig" ? "" : f.sit, s: f.s === "rec" ? "" : f.s });
      const qT = f.q.trim().replace(/^s[úu]mula\s*(n\.?\s*)?/i, "").replace(/\/stj$/i, "");
      const numero = /^\d{1,3}$/.test(qT) ? +qT : null;
      const c = numero != null ? Busca.compilar("") : Busca.compilar(f.q); termos = c.termos;
      const base = l.filter((x) => (numero != null ? x.n === numero : c.testa(x._n)) && temV(f.org, x.org) && noPer(x, f.per));
      cs = { vig: 0, canc: 0, todas: base.length }; base.forEach((x) => (x.sit === "cancelada" ? cs.canc++ : cs.vig++));
      const b2 = base.filter((x) => numero != null || f.sit === "todas" || (f.sit === "canc" ? x.sit === "cancelada" : x.sit !== "cancelada"));
      ca = contarMat(b2, (x) => x.ar, (x) => x.sa);
      lista = numero != null ? base : b2.filter((x) => casaMat(f.a, x.ar, x.sa));
      const ord = { rec: (a, b) => b.n - a.n, num: (a, b) => a.n - b.n, julg: (a, b) => b._d.localeCompare(a._d) || b.n - a.n, ant: (a, b) => a._d.localeCompare(b._d) || a.n - b.n,
        rel: (a, b) => c.pontua(b._n, b._n) - c.pontua(a._n, a._n) || b.n - a.n }[f.s === "rel" && c.vazio ? "rec" : f.s];
      lista.sort(ord);
      $("#sm-info").innerHTML = `<b>${fmtInt(lista.length)}</b> súmula(s)${f.sit === "vig" && numero == null ? " vigentes" : f.sit === "canc" ? " canceladas" : ""} ${explicacaoHTML(c)}`;
      render(true);
    };
    pilulas($("#sm-pil"), [
      { rot: "Matéria", tipo: "materia", get: () => f.a, set: (v) => (f.a = v), cont: () => ca },
      { rot: "Situação", tipo: "um", padrao: "vig", obrigatorio: true, rotAtual: () => "Vigentes", get: () => f.sit, set: (v) => (f.sit = v),
        opcoes: () => [{ v: "vig", t: "Vigentes", n: cs.vig }, { v: "canc", t: "Canceladas", n: cs.canc, ponto: "canc" }, { v: "todas", t: "Todas", n: cs.todas }],
        nota: "Vigentes incluem as súmulas cuja redação foi alterada ou revisada; o cartão indica a alteração e mostra a redação anterior." },
      { rot: "Órgão", tipo: "varios", vertical: true, get: () => f.org, set: (v) => (f.org = v), titulo: "Órgão que aprovou", opcoes: () => [{ v: "", t: "Todos os órgãos" }, ...["Corte Especial", "Primeira Seção", "Segunda Seção", "Terceira Seção"].map((o) => ({ v: o, t: o }))],
        nota: "Primeira Seção: direito público. Segunda Seção: direito privado. Terceira Seção: direito penal. Corte Especial: questões comuns a todas as Seções." },
      { rot: "Julgamento", tipo: "um", get: () => f.per, set: (v) => (f.per = v), titulo: "Data de aprovação", opcoes: () => PER.map(([v, t]) => ({ v, t })),
        nota: `Data em que o órgão aprovou a súmula${anos.length ? ` (de ${Math.min(...anos)} a ${Math.max(...anos)})` : ""}. Para as mais antigas sem essa informação, vale a data da publicação.` },
      defOrdem(() => f.s, (v) => (f.s = v), [{ v: "rec", t: "Mais recentes" }, { v: "num", t: "Número (menor primeiro)" }, { v: "julg", t: "Aprovação mais recente" }, { v: "ant", t: "Aprovação mais antiga" }, { v: "rel", t: "Mais aderentes à busca" }]),
    ], aplicar);
    $("#sm-q").addEventListener("input", debounce(aplicar, 200));
    $("#sm-lista").addEventListener("click", (e) => {
      const b = e.target.closest("[data-copiar-sum]"); if (!b) return;
      const x = l.find((y) => y.n === +b.closest("[data-sum]").dataset.sum); if (!x) return;
      copiar(`Súmula ${x.n}/STJ: "${x.t}"${x.org ? ` (${x.org}${x.julg ? `, julgado em ${fmtDataCit(x.julg)}` : ""}${x.pub ? `, DJe de ${fmtDataCit(x.pub)}` : ""})` : ""}${x.sit === "cancelada" ? " [cancelada]" : ""}`, "Súmula copiada.");
    });
    ligarAbasSumulas(main);
    ligarAjuda($("#sm-f"), $("#sm-q"), aplicar);
    aplicar();
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
      <div id="rp-f">
        ${campoBusca("rp-q", 'Questão, tese ou assunto. Ex.: "prescrição intercorrente" ou o número do tema', f.q)}
        <div class="fd-filtros filtros-lista" id="rp-pil"></div>
      </div>
      <div class="barra-res"><p id="rp-info"></p><button type="button" class="btn btn-fant btn-peq" id="rp-link">${ico("link")} Copiar link</button></div>
      <ol class="lista" id="rp-lista"></ol>
      <div id="rp-pag"></div>`;
    let lista = [], termos = [], ca = {}, cont = {};
    const pgRp = paginador("rp", () => render(false), "#rp-lista");
    const render = (reset) => {
      const ul = $("#rp-lista");
      if (reset) pgRp.pag = 1;
      $("#rp-pag").innerHTML = pgRp.html(lista.length);
      ul.innerHTML = (pgRp.fatia(lista).map((x) => {
        const pts = emPauta.get(`${x.tp}-${x.n}`);
        const ex = `${pts ? `<span class="selo alta">Em pauta ${fmtData(pts[0].d)}</span>` : ""}${/suspens/i.test(x.info || "") && x._g === "andamento" ? `<span class="selo rel">Suspensão</span>` : ""}`;
        return linhaTema(x, ex, termos);
      }).join(""));
      if (!lista.length) ul.innerHTML = vazio("repetitivos", "Nenhum registro encontrado", "Revise os filtros ou os termos da pesquisa.");
    };
    const aplicar = () => {
      f.q = $("#rp-q").value;
      gravarHash("repetitivos", { ...f, tipo: f.tipo === "Tema" ? "" : f.tipo || "todos", s: f.s === "mov" ? "" : f.s });
      const qT = f.q.trim().replace(/^(tema|controv[eé]rsia|iac)\s*/i, "").replace(/\./g, ""); const numero = /^\d+$/.test(qT) ? +qT : null;
      const c = numero != null ? Busca.compilar("") : Busca.compilar(f.q); termos = c.termos;
      const base = t.filter((x) => temV(f.tipo, x.tp) && temV(f.org, x.org) && (!f.uf || listaV(f.uf).some((u) => ufs.get(`${x.tp}-${x.n}`)?.has(u)))
        && (!f.susp || /suspens/i.test(x.info || "")) && (!f.pauta || emPauta.has(`${x.tp}-${x.n}`))
        && (numero != null ? x.n === numero : c.testa(x._n)));
      ca = contarMat(base, (x) => x.ar, (x) => x.sa);
      const b2 = base.filter((x) => casaMat(f.a, x.ar, x.sa));
      cont = { "": b2.length, andamento: 0, julgado: 0, cancelado: 0 }; b2.forEach((x) => cont[x._g] !== undefined && cont[x._g]++);
      lista = b2.filter((x) => temV(f.sit, x._g));
      const porData = (k) => (a, b) => (b[k] || "").localeCompare(a[k] || "") || b.n - a.n;
      lista.sort({ num: (a, b) => b.n - a.n, numc: (a, b) => a.n - b.n, afet: porData("afet"), julg: porData("julg") }[f.s] || porData("_mov"));
      $("#rp-info").innerHTML = `<b>${fmtInt(lista.length)}</b> registro(s) ${explicacaoHTML(c)}`;
      render(true);
    };
    pilulas($("#rp-pil"), [
      { rot: "Situação", tipo: "varios", vertical: true, get: () => f.sit, set: (v) => (f.sit = v), opcoes: () => [
        { v: "", t: "Todas", n: cont[""] }, { v: "andamento", t: "Em andamento", n: cont.andamento, ponto: "rel" },
        { v: "julgado", t: "Julgados", n: cont.julgado, ponto: "ok" }, { v: "cancelado", t: "Cancelados/revisados", n: cont.cancelado, ponto: "canc" }] },
      { rot: "Matéria", tipo: "materia", get: () => f.a, set: (v) => (f.a = v), cont: () => ca },
      { rot: "Tipo", titulo: "Tipo de precedente", tipo: "varios", vertical: true, padrao: "Tema", semLimpar: true, get: () => f.tipo, set: (v) => (f.tipo = v), rotAtual: () => "Temas repetitivos", rotTodos: "Todos os tipos",
        opcoes: () => [{ v: "", t: "Todos os tipos" }, { v: "Tema", t: "Temas repetitivos" }, { v: "Controvérsia", t: "Controvérsias" }, { v: "IAC", t: "IAC" }, { v: "SIRDR", t: "SIRDR" }, { v: "PUIL", t: "PUIL" }],
        nota: "<b>Tema repetitivo</b>: questão decidida pelo rito dos recursos repetitivos, com tese vinculante. <b>Controvérsia</b>: questão em triagem, ainda não afetada. <b>IAC</b>: incidente de assunção de competência. <b>SIRDR</b>: suspensão nacional em IRDR. <b>PUIL</b>: pedido de uniformização de interpretação de lei." },
      { rot: "Órgão", tipo: "varios", vertical: true, get: () => f.org, set: (v) => (f.org = v), opcoes: () => [{ v: "", t: "Todos os órgãos" }, ...["Corte Especial", "Primeira Seção", "Segunda Seção", "Terceira Seção"].map((o) => ({ v: o, t: o }))] },
      { rot: "Origem", tipo: "varios", busca: "Buscar UF", get: () => f.uf, set: (v) => (f.uf = v), titulo: "UF de origem dos processos", nota: "Estado de onde vieram os processos vinculados ao tema (leading cases e demais recursos).", opcoes: () => [{ v: "", t: "Qualquer origem" }, ...todasUF.map((u) => ({ v: u, t: u }))] },
      { rot: "Em pauta", tipo: "toggle", get: () => f.pauta, set: (v) => (f.pauta = v), dica: "Só temas com processo incluído nas próximas sessões de julgamento." },
      { rot: "Com suspensão", tipo: "toggle", get: () => f.susp, set: (v) => (f.susp = v), dica: "Só temas em que o STJ determinou a suspensão dos processos sobre a questão." },
      defOrdem(() => f.s, (v) => (f.s = v), [{ v: "mov", t: "Última movimentação" }, { v: "afet", t: "Afetação mais recente" }, { v: "julg", t: "Julgamento mais recente" }, { v: "num", t: "Número (maior primeiro)" }, { v: "numc", t: "Número (menor primeiro)" }]),
    ], aplicar);
    $("#rp-q").addEventListener("input", debounce(aplicar, 200));
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
    const f = { q: p.get("q") || "", o: p.get("o") || "", d: p.get("d") || "", rl: p.get("rl") || "", rel: p.get("rel") === "1", s: p.get("s") || "prox" };
    pl.forEach((x, i) => (x._i = i));
    const arq = String(D.man.pautas?.arquivo || "");
    corpo.innerHTML = `
      <div class="campo-busca">${ico("pesquisa")}<input id="pt-q" type="search" placeholder="Processo, OAB (RS 12345) ou nome do advogado" value="${esc(f.q)}"></div>
      <div class="fd-filtros filtros-lista" id="pt-pil"></div>
      <div class="barra-res"><p id="pt-info"></p><span class="nota" title="Por privacidade, o site não exibe os nomes das partes; processos em segredo de justiça aparecem sem advogados.">Pautas de ${fmtData(`${arq.slice(0, 4)}-${arq.slice(4, 6)}-${arq.slice(6, 8)}`)} · sem nomes de partes</span></div>
      <div id="pt-lista"></div>
      <div id="pt-pag"></div>`;
    let lista = [], termoOAB = "", qN = "";
    const pgPt = paginador("pt", () => render(), "#pt-lista");
    const render = () => {
      const vis = pgPt.fatia(lista);
      const porDia = new Map(); vis.forEach((x) => { if (!porDia.has(x.d)) porDia.set(x.d, []); porDia.get(x.d).push(x); });
      $("#pt-lista").innerHTML = vis.length ? [...porDia].map(([d, l]) => `
        <section class="dia"><div class="dia-cab"><h3>${fmtDiaL(d)}</h3><span>${fmtInt(lista.filter((x) => x.d === d).length)} processo(s)</span></div>
          <div class="card tabela-wrap"><table class="tabela"><thead><tr><th>Processo</th><th>Órgão</th><th>Relator(a)</th><th>Observações</th><th></th></tr></thead><tbody>
          ${l.map((x) => {
            const advM = termoOAB || qN ? (x.adv || []).filter((a) => a[0] === termoOAB || (qN && norm(a[1]).includes(qN))) : [];
            return `<tr><td class="num">${esc(x.p)}${x.pet ? `<div class="sub">${esc(x.pet)}</div>` : ""}</td><td>${esc(D.orgaos[x.o] || "")}</td><td>${esc(x.rel || "")}</td>
              <td>${x.temas?.length ? x.temas.map(([tp, n]) => `<button type="button" class="selo alta selo-btn" data-abrir-precedente="${esc(tp)}|${n}" title="Ver o precedente sem sair das pautas">${esc(tp)} ${n}</button>`).join(" ") : ""}${/^(EREsp|EAREsp)/.test(x.cl) ? ' <span class="selo pri">Divergência</span>' : ""}${x.seg ? ' <span class="selo canc">Segredo de justiça</span>' : ""}${advM.length ? `<div class="sub">${advM.map((a) => `${esc(titulo(a[1]))} (${esc(a[0])})`).join("; ")}</div>` : ""}</td>
              <td class="links"><a href="${URLS.processo(x.reg)}" target="_blank" rel="noopener">Processo</a></td></tr>`;
          }).join("")}</tbody></table></div></section>`).join("") : vazio("pautas", "Nenhum processo encontrado", "Revise os filtros. Para localizar seus processos, pesquise pela OAB ou pelo número.");
      $("#pt-pag").innerHTML = pgPt.html(lista.length);
    };
    const aplicar = () => {
      f.q = $("#pt-q").value.trim();
      gravarHash("pautas", { ...f, s: f.s === "prox" ? "" : f.s });
      termoOAB = /^[A-Za-z]{2}\s*[-/ ]?\s*\d{1,6}[A-Za-z]?$/.test(f.q) ? normOAB(f.q) : "";
      const nd = digitos(f.q); qN = !termoOAB && !/^\d+$/.test(f.q.replace(/[\s.-]/g, "")) ? norm(f.q) : "";
      const relSel = listaV(f.rl).map(norm);
      const base = pl.filter((x) => temV(f.o, x.o) && (!relSel.length || relSel.includes(norm(x.rel))) && (!f.rel || f.q || x.s >= 3)
        && (!f.q || (termoOAB ? (x.adv || []).some((a) => a[0] === termoOAB) : /^\d+$/.test(f.q.replace(/[\s./-]/g, "")) ? (x.reg === nd || digitos(x.p) === nd || digitos(x.p).includes(nd)) : x._b.includes(qN))));
      const cont = {}; base.forEach((x) => (cont[x.d] = (cont[x.d] || 0) + 1));
      contD = cont; totalD = base.length;
      lista = base.filter((x) => temV(f.d, x.d));
      const seg = { rel: (a, b) => (b.s || 0) - (a.s || 0), org: (a, b) => (D.orgaos[a.o] || "").localeCompare(D.orgaos[b.o] || "", "pt-BR"), rela: (a, b) => norm(a.rel).localeCompare(norm(b.rel)) }[f.s];
      lista.sort((a, b) => a.d.localeCompare(b.d) || (seg ? seg(a, b) : 0) || a._i - b._i);
      $("#pt-info").innerHTML = `<b>${fmtInt(lista.length)}</b> processo(s) em pauta${f.rel && !f.q ? " · só relevantes" : f.q ? " · busca em todas as pautas" : ""}`;
      pgPt.pag = 1; render();
    };
    let contD = {}, totalD = 0;
    pilulas($("#pt-pil"), [
      { rot: "Só relevantes", tipo: "toggle", get: () => f.rel, set: (v) => (f.rel = v), dica: "Processos vinculados a precedentes qualificados, embargos de divergência e julgamentos das Seções e da Corte Especial." },
      { rot: "Data", tipo: "varios", vertical: true, get: () => f.d, set: (v) => (f.d = v), titulo: "Data da sessão", opcoes: () => [{ v: "", t: "Todas as datas", n: totalD }, ...dias.filter((d) => contD[d]).map((d) => ({ v: d, t: fmtDiaL(d), curto: fmtData(d).slice(0, 5), n: contD[d] }))] },
      { rot: "Órgão", tipo: "varios", vertical: true, get: () => f.o, set: (v) => (f.o = v), opcoes: () => [{ v: "", t: "Todos os órgãos" }, ...Object.entries(D.orgaos).map(([k, v]) => ({ v: k, t: v }))] },
      { rot: "Relator", titulo: "Relator(a)", tipo: "varios", vertical: true, busca: "Buscar ministro(a)", get: () => f.rl, set: (v) => (f.rl = v),
        opcoes: () => [{ v: "", t: "Todos os relatores" }, ...[...new Set(pl.map((x) => x.rel).filter(Boolean))].sort((a, b) => norm(a).localeCompare(norm(b))).map((r) => ({ v: r, t: relatorFmt(r), n: pl.filter((x) => x.rel === r).length }))] },
      defOrdem(() => f.s, (v) => (f.s = v), [{ v: "prox", t: "Sessão mais próxima" }, { v: "rel", t: "Mais relevantes primeiro" }, { v: "org", t: "Órgão julgador" }, { v: "rela", t: "Relator(a)" }],
        "As pautas ficam sempre agrupadas por dia de sessão; a ordem escolhida vale dentro de cada dia."),
    ], aplicar);
    $("#pt-q").addEventListener("input", debounce(aplicar, 250));
    aplicar();
  }
  async function vDjen(corpo, p) {
    const rad = await djen();
    const dias = [...new Set(rad.map((x) => x.d))].sort().reverse();
    corpo.innerHTML = `
      <div class="card card-pad"><div class="campo-busca">${ico("pesquisa")}<input id="dj-q" type="search" placeholder="Classe ou número do processo"></div>
        <div class="fd-filtros filtros-lista" id="dj-pil" style="margin-top:10px"></div></div>
      <p class="aviso" style="margin-top:12px">${ico("alerta")}<span>Acórdãos publicados no Diário da Justiça nos últimos dias disponíveis na base diária do STJ, que chega com cerca de duas semanas de atraso. A base não traz ementa nem órgão julgador; a Turma é estimada pelo relator.</span></p>
      <div class="barra-res"><p id="dj-info"></p></div>
      <div class="card tabela-wrap"><table class="tabela"><thead><tr><th>Publicação</th><th>Processo</th><th>Recurso</th><th>Relator(a)</th><th>Resultado</th><th></th></tr></thead><tbody id="dj-tb"></tbody></table></div>
      <div id="dj-pag"></div>`;
    let lista = [];
    const pgDj = paginador("dj", () => render(), "#dj-tb");
    const render = () => {
      $("#dj-tb").innerHTML = pgDj.fatia(lista).map((x) => `<tr><td>${fmtData(x.d)}</td><td class="num">${esc(x.p)}</td><td>${esc(x.r || "—")}</td><td>${esc(relatorFmt(x.rel))}${x.tr ? `<div class="sub">${esc(D.orgaos[x.tr])} (aprox.)</div>` : ""}</td><td>${esc(x.t || "—")}</td><td class="links"><a href="${URLS.inteiroTeor(x.reg, x.d)}" target="_blank" rel="noopener">Inteiro teor</a></td></tr>`).join("") || `<tr><td colspan="6" class="sub">Nenhum resultado.</td></tr>`;
      $("#dj-pag").innerHTML = pgDj.html(lista.length);
    };
    const F = { d: "", t: "", r: "" };
    const aplicar = () => {
      const q = norm($("#dj-q").value).split(/\s+/).filter(Boolean), rs = listaV(F.r).map(norm);
      lista = rad.filter((x) => temV(F.d, x.d) && temV(F.t, x.tr) && (!rs.length || rs.includes(norm(x.rel))) && q.every((w) => x._p.includes(w)));
      $("#dj-info").innerHTML = `<b>${fmtInt(lista.length)}</b> acórdão(s)`; pgDj.pag = 1; render();
    };
    const turmas = Object.entries(D.orgaos).filter(([k]) => k.endsWith("turma"));
    pilulas($("#dj-pil"), [
      { rot: "Data", titulo: "Data de publicação", tipo: "varios", vertical: true, get: () => F.d, set: (v) => (F.d = v), opcoes: () => [{ v: "", t: "Todas as datas" }, ...dias.map((d) => ({ v: d, t: fmtData(d), n: rad.filter((x) => x.d === d).length }))] },
      { rot: "Turma", titulo: "Turma (aproximada)", tipo: "varios", vertical: true, get: () => F.t, set: (v) => (F.t = v), opcoes: () => [{ v: "", t: "Qualquer Turma" }, ...turmas.map(([k, v]) => ({ v: k, t: v }))],
        nota: "A Turma é deduzida do relator, pois a base diária do DJEN não informa o órgão julgador." },
      { rot: "Relator", titulo: "Relator(a)", tipo: "varios", vertical: true, busca: "Buscar ministro(a)", get: () => F.r, set: (v) => (F.r = v),
        opcoes: () => [{ v: "", t: "Todos os relatores" }, ...[...new Set(rad.map((x) => x.rel).filter(Boolean))].sort((a, b) => norm(a).localeCompare(norm(b))).map((r) => ({ v: r, t: relatorFmt(r), n: rad.filter((x) => x.rel === r).length }))] },
    ], aplicar);
    $("#dj-q").addEventListener("input", debounce(aplicar, 200));
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
    const [t, pt, pl, ix, dj, nums] = await Promise.all([temas(), procTemas(), pautas(), indice(), djen(), carregar("numeros").catch(() => null)]);
    // Índice de números: todos os acórdãos do acervo, por número do processo.
    const porNumero = new Map();
    if (nums) for (const x of nums.l) { if (!porNumero.has(x[0])) porNumero.set(x[0], []); porNumero.get(x[0]).push(x); }
    // Temas citados
    const citTemas = new Map();
    const reT = /\b(tema|temas|controv[ée]rsia|iac)\s+(?:repetitivo\s+|n[º°o.]*\s*|de\s+n[º°o.]*\s*)*(\d{1,3}(?:\.\d{3})+|\d+)(?![\d])(?:\s*(?:\/|do|da)\s*(stj|stf|superior tribunal de justi[çc]a|supremo))?/gi;
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
    const reS = /\bs[úu]mulas?\s+(?:vinculante\s+)?(?:n[º°o.]*\s*)?(\d+)(?![\d])(?:\s*(?:\/|do|da)\s*(stj|stf))?/gi;
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
      const noAcervo = (porNumero.get(c.n) || []).map((x) => ({ m: nums.m[x[2]], o: nums.o[x[3]], id: x[4] })).sort((a, b) => b.m.localeCompare(a.m));
      const notas = [];
      for (const v of vinc) { const x = t.idx.get(`${v.tp}-${v.n}`); notas.push(`${v.lc ? "Leading case" : "Processo vinculado"} ${v.tp === "Controvérsia" ? "à" : "ao"} <button type="button" class="link-acao" data-tema-direto="${esc(v.tp)}|${v.n}">${esc(v.tp)} ${v.n}</button>${x ? ` (${esc(x.sit)})` : ""}`); }
      for (const p of pauta) notas.push(`<b>Em pauta</b> em ${fmtData(p.d)} · ${esc(D.orgaos[p.o] || "")}${p.pet ? " (" + esc(p.pet) + ")" : ""}`);
      if (noAcervo.length) notas.push(`<b>${noAcervo.length} acórdão(s) no acervo</b> neste processo: ${noAcervo.slice(0, 4).map((a) => `<button type="button" class="link-acao" data-vf-ac="${esc(a.id)}|${a.m}|${a.o}|${esc(c.cl)}|${c.n}">${esc(D.orgaos[a.o] || a.o)}, ${fmtMes(a.m)}</button>`).join(" · ")}${noAcervo.length > 4 ? ` · <a class="link-acao" href="#pesquisa?q=${c.n}">ver todos</a>` : ""}. A citação pode se referir a um recurso interno (agravo, embargos) julgado em outra data.`);
      else if (ac) notas.push(`Acórdão publicado em ${fmtData(ac.dj)} · ${esc(D.orgaos[ac.o] || "")}`);
      if (pub && !ac && !noAcervo.length) notas.push(`Acórdão publicado no DJEN em ${fmtData(pub.d)}, ainda sem ementa no acervo`);
      return `<div class="cit"><span class="cit-tit">${esc(c.cl)} ${fmtNumProc(c.n)}${c.uf ? "/" + esc(c.uf) : ""}</span>${notas.length ? '<span class="selo pri">Localizado</span>' : '<span class="selo">Não localizado no site</span>'}<div class="cit-txt">${notas.join("<br>") || "Não consta do acervo do site (acórdãos desde 2000), das pautas nem dos precedentes qualificados. O acervo reúne os espelhos de acórdãos que o STJ divulga em dados abertos, que não abrangem decisões monocráticas nem todos os acórdãos. Isso não indica erro na citação; confira no site do STJ."}</div></div>`;
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
        <li><b>Acórdãos (espelhos):</b> ementa, tese, relator, datas e referências legislativas da Corte Especial, das Seções e das Turmas. O STJ divulga um arquivo por mês e órgão, poucos dias após o fim do mês. O acervo reúne ${fmtInt(total)} acórdãos, desde ${m.meses.length ? fmtMesL(m.meses.map((x) => x.m).sort()[0]) : "—"}, e é ampliado aos poucos. Os anos anteriores a maio de 2022 vêm do arquivo histórico que o STJ publica com todos os espelhos até aquela data. Na Pesquisa, o filtro Período permite escolher de um mês a todo o acervo (um ano, desde um ano ou um intervalo de datas); os períodos longos são percorridos em sequência, com o progresso na tela.</li>
        <li><b>Composição do Tribunal:</b> documento oficial de composição do STJ (Plenário, Corte Especial, Seções, Turmas, conselhos e comissões), página de ministros e lista de contatos das unidades. As fotos, quando disponíveis, são do Wikimedia Commons (com o crédito de cada autor) e ficam hospedadas no próprio site.</li>
        <li><b>Precedentes qualificados:</b> temas repetitivos, controvérsias, IAC, SIRDR e PUIL, com os processos vinculados. A atualização é diária.</li>
        <li><b>Pautas futuras:</b> processos incluídos nas próximas sessões. A atualização é diária. Por privacidade, o site não exibe os nomes das partes.</li>
        <li><b>Publicações no DJEN:</b> metadados diários dos acórdãos publicados, com cerca de duas semanas de defasagem.</li>
      </ul>
      <h3 style="font-family:var(--ui)">Como a relevância é calculada</h3>
      <p>Cada acórdão recebe uma pontuação automática. Somam pontos o julgamento pela Corte Especial (+5) ou por Seção (+4), a tese jurídica registrada (+6), a afetação ao rito repetitivo (+6), os embargos de divergência (+4), o tema repetitivo (+3) e as menções a superação ou mudança de entendimento e a questão nova (+4), a modulação e a distinção (+3) e a divergência (+2). Perdem pontos os agravos internos e os embargos de declaração (−1) e os fundamentos de rotina, como Súmula 7, Súmulas 283/284 do STF, embargos rejeitados e reexame de provas (até −4).</p>
      <p>No Atualize-se entram apenas julgados com uma tese legível: a tese jurídica ou os itens da tese de julgamento com conteúdo próprio. Ficam de fora os embargos de declaração, os agravos em recurso extraordinário, os recursos não conhecidos ou desprovidos sem tese e os julgados de repetitivo cuja tese já aparece como “tese firmada”. Esses acórdãos continuam nos Destaques e na Pesquisa. A tese de julgamento de cada acórdão é lida item por item. Saem da fila os julgados em que todos os itens apenas aplicam óbices ou entendimentos consolidados (Súmulas 5, 7, 83, 182, 211, 282 e 284, prequestionamento, embargos de declaração, prisão preventiva por fundamentação usual, dosimetria), e perdem posição os que repetem em série a mesma tese. Quando só parte dos itens tem conteúdo próprio, o cartão mostra apenas esses itens; a tese completa continua na ementa.</p>
      <p>Com 10 pontos ou mais, o acórdão é de <b>alta relevância</b>; de 6 a 9, <b>relevante</b>; de 2 a 5, marcado para <b>acompanhar</b>. A área do direito é identificada pelas palavras da verbetação. É uma triagem para orientar a leitura, e não uma avaliação jurídica.</p>
      <h3 style="font-family:var(--ui)">Como ler as cores</h3>
      <p>As cores têm sempre o mesmo significado em todas as telas.</p>
      <div class="legenda-cores">
        <p><span class="selo ok">Verde</span> tese firmada e tema julgado</p>
        <p><span class="selo rel">Âmbar</span> tema afetado ou em andamento e relevância média</p>
        <p><span class="selo alta">Vermelho</span> o que pede atenção agora: em pauta, alta relevância</p>
        <p><span class="selo acomp">Azul-claro</span> acórdão de repetitivo publicado e itens para acompanhar</p>
        <p><span class="selo pri">Azul</span> julgados das Turmas e Seções e marcas de relevância</p>
        <p>Cada matéria tem a sua própria cor: ${Object.keys(AREAS).map((k) => seloArea(k)).join(" ")}</p>
      </div>
      <h3 style="font-family:var(--ui)">Matérias e assuntos específicos</h3>
      <p>Cada julgado, tema, súmula, nota e tese recebe uma matéria geral (Civil, Processo Civil, Penal, Tributário etc.) e, quando possível, até três assuntos específicos. Os assuntos seguem a organização da lei de regência: no Civil, a do Código Civil (parte geral, obrigações, contratos, responsabilidade civil e direito das coisas); em Família e Sucessões, os livros IV e V do Código; no Processo Civil, as partes do CPC (parte geral, conhecimento, execução e recursos). No filtro Matéria, escolha a matéria à esquerda e o assunto à direita; no celular, toque na matéria e use “Matérias” para voltar. A classificação é automática, feita pelos termos da ementa, e pode conter imprecisões.</p>
      <h3 style="font-family:var(--ui)">Busca por número de processo</h3>
      <p>Na Pesquisa, o número pode ser digitado no próprio campo de busca, com ou sem a classe e os pontos (“REsp 2.231.419/SP”, “resp 2231419” ou “2231419”). O site procura em todo o acervo e, se o acórdão ainda não estiver no arquivo mensal do STJ, mostra a publicação no DJEN e a sessão em pauta, quando houver.</p>
      <h3 style="font-family:var(--ui)">Salvos</h3>
      <p>Acórdãos, publicações do DJEN, temas, notas do Informativo, teses e pautas podem ser salvos pelo marcador e ficam na aba Salvos, no menu à esquerda. Lá é possível separá-los em pastas (por tese, cliente ou processo; um item pode estar em várias), marcá-los como favoráveis ou desfavoráveis (no penal, à defesa), anotá-los, filtrá-los por tipo e matéria, buscar nas anotações e copiar as citações de uma pasta de uma só vez. Um acórdão salvo a partir do DJEN passa a exibir a ementa completa assim que o STJ divulgar o arquivo mensal. Os salvos ficam guardados neste navegador.</p>
      <h3 style="font-family:var(--ui)">Informativo do STJ</h3>
      <p>A aba Destaques abre com o Informativo de Jurisprudência, publicado pelo próprio STJ com as teses selecionadas pela novidade e pela repercussão. Cada nota traz o tema, o destaque (a tese) e o processo; as mais recentes também entram no Atualize-se e no Meu radar. A “Seleção automática” continua disponível na segunda aba. O acervo vai desde as primeiras edições: as últimas edições abrem de imediato e, ao buscar em todas as edições ou escolher uma data ou edição antiga, o site carrega as demais por ano. Nas edições antigas, anteriores ao formato atual, o texto é a nota narrativa original e a matéria é deduzida pelos termos da nota. As edições novas são lidas automaticamente do PDF oficial de cada edição, publicado pelo STJ.</p>
      <h3 style="font-family:var(--ui)">Resumo da semana</h3>
      <p>Reúne, em uma página, as teses firmadas em repetitivos, as notas do Informativo, os temas afetados, os julgados com tese, as súmulas aprovadas e os repetitivos pautados para a semana seguinte. Pode ser copiado como texto, impresso ou salvo em PDF.</p>
      <h3 style="font-family:var(--ui)">Súmulas e temas citados</h3>
      <p>Quando a ementa aplica uma súmula do STJ ou um tema repetitivo, o cartão mostra o atalho (“Cita Súmula 7 · Tema 1.137”), que abre o enunciado ou a tese sem sair da tela.</p>
      <h3 style="font-family:var(--ui)">Jurisprudência em Teses</h3>
      <p>Na aba Súmulas e teses, a Jurisprudência em Teses reúne todas as edições publicadas pelo STJ, cada uma dedicada a um assunto, com as teses consolidadas e os precedentes que as sustentam (até oito acórdãos por tese, com a indicação do total na edição oficial). O STJ não publica arquivo aberto das edições; por isso as edições novas e as atualizadas são coletadas pelo navegador uma vez por semana, às segundas-feiras, e a data da última coleta aparece em “Situação da base”. É possível buscar por palavras, filtrar por matéria, período de disponibilização ou número da edição e ordenar por edição, assunto, matéria ou número de precedentes.</p>
      <h3 style="font-family:var(--ui)">Súmulas</h3>
      <p>A aba Súmulas reúne todos os enunciados do STJ, conferidos diariamente no arquivo oficial de verbetes do Tribunal, com a situação (vigente, cancelada ou com redação alterada), o órgão que aprovou, as datas de julgamento e de publicação e a matéria.</p>
      <h3 style="font-family:var(--ui)">Privacidade</h3>
      <p>O seu radar (assuntos, processos e OAB) e os itens salvos ficam apenas no seu navegador. A verificação de petição roda no seu computador, e o texto não é enviado a nenhum servidor.</p>
      <h3 style="font-family:var(--ui)" id="sobre-fontes">Situação da base</h3>
      <p>Última execução da rotina: ${new Date(m.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. A rotina roda duas vezes por dia; cada fonte tem o próprio ritmo de publicação no STJ.</p>
      ${tabelaFontes(m)}
      <p> ${fmtInt(total)} acórdãos de ${m.meses.length ? fmtMes(m.meses[m.meses.length - 1].m) : "—"} a ${m.meses.length ? fmtMes(m.meses[0].m) : "—"}; ${fmtInt(m.temas?.n)} precedentes qualificados; ${fmtInt(m.pautas?.n)} processos em pauta; ${fmtInt(m.destaques?.n)} destaques nos últimos 3 meses.</p>
      ${m.erros?.length ? `<p class="aviso">${ico("alerta")}<span>Na última execução, parte das fontes não respondeu (${esc(m.erros.join("; "))}). Os dados anteriores foram mantidos.</span></p>` : ""}
      <h3 style="font-family:var(--ui)">Cautelas</h3>
      <p>O texto das ementas é o oficial; apenas a verbetação, que o STJ publica em caixa alta, é exibida em letras minúsculas para facilitar a leitura, e o botão de copiar traz o texto original. Antes de citar qualquer julgado, confira o inteiro teor no site do STJ. Os processos em segredo de justiça não constam da base aberta. Este é um projeto independente, sem vínculo com o STJ.</p>
    </div>`;
    if (lerHash().p.get("s") === "fontes") requestAnimationFrame(() => $("#sobre-fontes")?.scrollIntoView({ block: "start" }));
  }

  // Situação de cada fonte: data do dado mais recente e da última verificação bem-sucedida.
  // "Defasada" quando a verificação automática falha há alguns dias ou o dado envelheceu além do normal.
  function situacaoFontes(m) {
    const dias = (iso) => (iso ? (Date.now() - new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso)) / 864e5 : Infinity);
    const ymd = (s) => (/^\d{8}$/.test(s || "") ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s || "");
    const esp = Object.values(m.ultimoArquivoEspelhos || {}).filter((x) => /^\d{8}$/.test(x)).sort().pop();
    const L = [
      { nome: "Acórdãos (espelhos)", dado: ymd(esp), rot: "arquivo mensal de", verif: m.espelhosEm || m.atualizadoEm, lim: 50, auto: true },
      { nome: "Publicações no DJEN", dado: m.radar?.dias?.[m.radar.dias.length - 1], rot: "até", verif: m.radar?.em, lim: 21, auto: true },
      { nome: "Pautas de julgamento", dado: ymd(m.pautas?.arquivo), rot: "arquivo de", verif: m.pautas?.em, lim: 10, auto: true },
      { nome: "Precedentes qualificados", dado: "", verif: m.temas?.em, auto: true },
      { nome: "Informativo de Jurisprudência", dado: m.informativos?.ultimaData, rot: m.informativos?.ultima ? `edição ${m.informativos.ultima}, de` : "", verif: m.informativos?.verificadoEm, lim: 30, auto: true },
      { nome: "Súmulas", dado: "", rot: "", extra: m.sumulas?.ultima ? `até a Súmula ${m.sumulas.ultima}` : "", verif: m.sumulas?.verificadoEm, auto: true },
      { nome: "Jurisprudência em Teses", dado: m.teses?.ultimaData, rot: m.teses?.ultima ? `edição ${m.teses.ultima}, de` : "", verif: m.teses?.coletadoEm, lim: 14, auto: false },
      { nome: "Composição do Tribunal", dado: "", verif: m.composicao?.em, auto: true },
    ];
    for (const x of L) {
      // A verificação é diária; três dias sem sucesso indicam que a fonte oficial não está respondendo.
      x.defasada = x.auto ? dias(x.verif) > 3 || (x.lim && dias(x.dado) > x.lim) : dias(x.verif) > (x.lim || 60);
    }
    return L;
  }
  function tabelaFontes(m) {
    const fd = (iso) => (iso ? fmtData(iso.slice(0, 10)) : "—");
    return `<div class="tabela-rolagem"><table class="tab-fontes"><thead><tr><th>Fonte</th><th>Dado mais recente</th><th>Última verificação</th><th></th></tr></thead><tbody>
      ${situacaoFontes(m).map((x) => `<tr${x.defasada ? ' class="defasada"' : ""}><td>${esc(x.nome)}</td><td>${x.dado ? `${esc(x.rot || "")} ${fd(x.dado)}` : esc(x.extra || "—")}</td><td>${x.verif ? fd(x.verif) : "—"}${x.auto ? "" : " <small>(coleta manual)</small>"}</td><td>${x.defasada ? `<span class="selo alta">defasada</span>` : `<span class="selo ok">em dia</span>`}</td></tr>`).join("")}
    </tbody></table></div>`;
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
    const defas = situacaoFontes(D.man).filter((x) => x.defasada);
    $("#lat-atualizado").innerHTML = `Verificado em ${esc(q)}${defas.length ? `<a class="lat-defas" href="#sobre?s=fontes" title="${esc(defas.map((x) => x.nome).join(", "))}">${defas.length} fonte${defas.length > 1 ? "s" : ""} com atraso</a>` : `<a class="lat-fontes" href="#sobre?s=fontes">ver cada fonte</a>`}`;
    window.addEventListener("hashchange", rotear);
    await rotear();
    atualizarContadorRadar();
    atualizarContadorFeed();
    atualizarContadorSalvos();
  }
  function irParaBusca() {
    const campo = $("#view input[type=search]");
    if (campo) { campo.focus(); campo.select?.(); }
    else location.hash = "#pesquisa?foco=1";
  }
  init();
})();
