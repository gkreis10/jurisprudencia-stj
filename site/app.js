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
    // Falha ao gravar (armazenamento cheio ou bloqueado): avisa de forma persistente, em vez de perder o dado em silêncio.
    gravar(o) {
      try { localStorage.setItem(CHAVE, JSON.stringify(o)); Store.falhou = false; $("#aviso-armaz")?.remove(); return true; }
      catch (e) { Store.falhou = true; avisoArmazenamento(e); return false; }
    },
    uso() { try { return (localStorage.getItem(CHAVE) || "").length * 2; } catch { return 0; } },
    falhou: false,
  };
  function avisoArmazenamento(e) {
    if (document.getElementById("aviso-armaz") || !document.body) return;
    const cheio = /quota|exceed/i.test(`${e?.name} ${e?.message}`);
    const d = document.createElement("div"); d.id = "aviso-armaz"; d.className = "aviso-armaz"; d.setAttribute("role", "alert");
    d.innerHTML = `<span><b>Não foi possível guardar as suas alterações neste navegador.</b> ${cheio ? "O espaço reservado ao site está cheio." : "O navegador está bloqueando o armazenamento (janela anônima ou dados do site desativados)."} Exporte uma cópia de segurança para não perder salvos, anotações e o Meu radar.</span><button type="button" class="btn btn-claro btn-peq" data-aviso-copia>Cópia de segurança</button><button type="button" class="btn-ico" data-aviso-fechar aria-label="Fechar aviso">×</button>`;
    d.addEventListener("click", (ev) => { if (ev.target.closest("[data-aviso-copia]")) gerenciarPastas(true); if (ev.target.closest("[data-aviso-fechar]")) d.remove(); });
    document.body.appendChild(d);
  }
  const P = Object.assign({ termos: [], procs: [], oabs: [], salvos: {}, vistoEm: null }, Store.ler());
  if (!P.vistoEm) { P.vistoEm = somaDias(hojeISO(), -7); Store.gravar(P); }
  const salvarP = () => Store.gravar(P);
  // Tribunal exibido (escolhido no alto do menu e guardado neste navegador): só o STJ (padrão), só o STF ou os dois.
  const TRIBS = {
    stj: { rot: "Radar STJ", nome: "Superior Tribunal de Justiça", desc: "Repetitivos, acórdãos, pautas, súmulas e composição do STJ" },
    stf: { rot: "Radar STF", nome: "Supremo Tribunal Federal", desc: "Repercussão geral, súmulas e composição do STF" },
    ambos: { rot: "Radar STJ · STF", nome: "Os dois tribunais", desc: "Tudo do STJ, com a repercussão geral, as súmulas e a composição do STF" },
  };
  // Enquanto os dados do STF não chegam ao site (primeira coleta), só o STJ fica disponível.
  const stfPronto = () => !D.man || !!D.man.stf?.temas;
  const trib = () => { const t = TRIBS[P.trib] ? P.trib : "stj"; return t !== "stj" && !stfPronto() ? "stj" : t; };
  const comSTJ = () => trib() !== "stf";
  const comSTF = () => trib() !== "stj";
  const ambos = () => trib() === "ambos";
  // Com os dois tribunais na tela, cada cartão indica de qual deles é.
  const seloTrib = (t) => (ambos() ? `<span class="selo trib trib-${t}" title="${t === "stf" ? "Supremo Tribunal Federal" : "Superior Tribunal de Justiça"}">${t.toUpperCase()}</span>` : "");
  // Mostra o aviso de armazenamento assim que a página estiver montada, se a primeira gravação já falhou.
  document.addEventListener("DOMContentLoaded", () => { if (Store.falhou) avisoArmazenamento(); });

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
    // Documento da decisão monocrática no DJe (PDF oficial), pelo número do documento.
    mono: (x) => (x.seq ? `https://processo.stj.jus.br/processo/dj/documento/mediado/?tipo_documento=documento&componente=MON&sequencial=${encodeURIComponent(x.seq)}&num_registro=${encodeURIComponent(x.reg)}&data=${String(x.d).replace(/-/g, "")}&formato=PDF` : `https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaNumeroRegistro&termo=${encodeURIComponent(x.reg)}`),
    tema: (tp, n) => {
      if (tp === "RG") return URL_STF.tema(n);
      const cod = { "Tema": "T", "Controvérsia": "C", "IAC": "I", "SIRDR": "S", "PUIL": "P" }[tp] || "T";
      return `https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=${cod}&cod_tema_inicial=${n}&cod_tema_final=${n}`;
    },
  };

  const URL_STF = {
    tema: (n) => `https://portal.stf.jus.br/jurisprudenciaRepercussao/tema.asp?num=${n}`,
    processo: (inc) => `https://portal.stf.jus.br/processos/detalhe.asp?incidente=${encodeURIComponent(inc)}`,
    sumula: (x) => `https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=${x.v ? 26 : 30}&sumula=${encodeURIComponent(x.id)}`,
    pesquisa: "https://jurisprudencia.stf.jus.br/pages/search",
    pauta: "https://portal.stf.jus.br/pauta/pesquisarCalendario.asp",
    temas: "https://portal.stf.jus.br/jurisprudenciaRepercussao/todostemas.asp",
    sumulas: "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=30",
    vinculantes: "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=26",
  };
  // Rótulo de um precedente: os temas de repercussão geral (tipo "RG") aparecem como "Tema N".
  const rotTema = (x) => (x.tp === "RG" ? `Tema ${x.n}` : `${x.tp} ${x.n}`);

  // ============================================================ rótulos
  const AREAS = {
    "proc-civil": "Processo Civil", civil: "Civil", consumidor: "Consumidor", familia: "Família e Sucessões",
    empresarial: "Empresarial", bancario: "Bancário", tributario: "Tributário", administrativo: "Administrativo",
    previdenciario: "Previdenciário", ambiental: "Ambiental", penal: "Penal", "proc-penal": "Processo Penal", trabalho: "Trabalho",
  };
  // Cada matéria tem um matiz fixo, usado em todo o site (selos, filtros, cartões).
  const AREA_COR = { "proc-civil": 226, civil: 208, consumidor: 24, familia: 315, empresarial: 262, bancario: 190, tributario: 150, administrativo: 42, previdenciario: 172, ambiental: 105, penal: 0, "proc-penal": 340, trabalho: 290 };
  // Submatérias: só aparecem depois de escolher a matéria geral.
  // Assuntos de cada matéria (gerados de scripts/assuntos.py: matéria → grupo → assunto).
  const SUBAREAS = {
    "civil": {"pessoas": "Capacidade, pessoa jurídica e domicílio", "personalidade": "Direitos da personalidade: imagem, honra e nome", "internet": "Internet, redes sociais e proteção de dados", "negocio-juridico": "Negócio jurídico, vícios e nulidades", "prescricao-civ": "Prescrição e decadência", "bens": "Bens, frutos e benfeitorias", "inadimplemento": "Inadimplemento, mora e perdas e danos", "juros-correcao": "Juros de mora e correção monetária", "obrigacoes": "Pagamento, cessão de crédito e extinção das obrigações", "enriquecimento": "Enriquecimento sem causa e pagamento indevido", "contratos": "Teoria geral, revisão e extinção dos contratos", "compra-venda": "Compra e venda, promessa e doação", "locacao": "Locação", "prestacao-servicos": "Prestação de serviços, empreitada e construção", "mandato-corretagem": "Mandato, corretagem e honorários contratuais", "transporte": "Transporte", "fianca": "Fiança e garantias pessoais", "comodato-deposito": "Comodato, depósito e mútuo civil", "seguro-vida": "Seguro de vida e acidentes pessoais", "dpvat": "DPVAT", "seguros": "Seguros de dano e regras gerais", "dano-moral": "Dano moral e seu valor", "danos-materiais": "Danos materiais, estéticos, lucros cessantes e pensão", "resp-civil": "Responsabilidade civil em geral", "acidentes": "Acidentes de trânsito", "resp-profissional": "Erro médico, hospitais e profissionais liberais", "posse": "Posse e ações possessórias", "usucapiao": "Usucapião", "propriedade": "Propriedade, reivindicação e vizinhança", "condominio": "Condomínio", "direitos-reais": "Direitos reais sobre coisa alheia e garantias reais", "registros": "Registros públicos e atividade notarial", "autoral": "Direitos autorais"},
    "familia": {"casamento": "Casamento e regime de bens", "uniao-estavel": "União estável", "divorcio": "Divórcio, dissolução e partilha", "alimentos": "Fixação, revisão e exoneração de alimentos", "execucao-alimentos": "Execução de alimentos e prisão civil", "filiacao": "Filiação, paternidade e socioafetividade", "guarda": "Guarda, convivência e poder familiar", "adocao": "Adoção", "infancia": "Estatuto da Criança e do Adolescente", "curatela": "Curatela, tutela e interdição", "sucessao-legitima": "Herdeiros, cônjuge e companheiro na sucessão", "testamento": "Testamentos e legados", "inventario": "Inventário e arrolamento"},
    "consumidor": {"saude-cobertura": "Cobertura e negativa de tratamento", "saude-reajuste": "Reajuste e mensalidade", "saude-contrato": "Rescisão, manutenção e portabilidade do plano", "planos-saude": "Planos de saúde: outros temas", "bancos-cons": "Bancos e crédito ao consumidor", "imoveis-cons": "Imóveis, incorporação e consórcios", "educacao-cons": "Ensino e mensalidades", "veiculos": "Veículos", "aereo": "Transporte de passageiros, aéreo e turismo", "saude-servicos": "Hospitais, clínicas e serviços médicos", "essenciais": "Energia, água, telefonia e internet", "fornecedor": "Vício e fato do produto ou serviço", "cadastros": "Cadastros, negativação e protesto", "praticas": "Práticas e cláusulas abusivas", "publicidade": "Oferta, publicidade e comércio eletrônico", "superendividamento": "Superendividamento", "defesa-cons": "Relação de consumo, inversão do ônus e ações coletivas"},
    "bancario": {"juros": "Juros, capitalização e comissão de permanência", "tarifas": "Tarifas bancárias e seguros acessórios", "contratos-banc": "Contratos bancários, cédulas e prestação de contas", "credito-rural": "Crédito rural", "superendividamento": "Superendividamento", "consignado": "Crédito consignado", "cartao": "Cartão de crédito", "fiduciaria": "Alienação fiduciária e busca e apreensão", "garantias-banc": "Aval e outras garantias bancárias", "sfh": "Crédito imobiliário e SFH", "fraudes": "Fraudes, golpes, segurança e sigilo"},
    "empresarial": {"sociedades": "Sociedades, sócios e administradores", "dissolucao": "Dissolução e apuração de haveres", "cooperativas": "Cooperativas", "desconsideracao": "Desconsideração da personalidade jurídica", "recuperacao": "Recuperação judicial e extrajudicial", "falencia": "Falência", "creditos-concursais": "Créditos, juízo universal e atos constritivos", "titulos": "Cheque, duplicata, nota promissória e outros títulos", "contratos-emp": "Franquia, representação comercial e distribuição", "leasing": "Arrendamento mercantil (leasing) e factoring", "marcas": "Marcas, concorrência desleal e nome empresarial", "patentes": "Patentes e desenho industrial", "arbitragem": "Arbitragem", "mercado": "Mercado de capitais e concorrência"},
    "proc-civil": {"partes": "Legitimidade e interesse de agir", "intervencao": "Litisconsórcio e intervenção de terceiros", "competencia": "Competência", "honorarios": "Honorários advocatícios", "gratuidade": "Gratuidade da justiça, custas e depósitos", "atos-proc": "Citação, intimação, prazos e nulidades", "tutela": "Tutelas provisórias e efeito suspensivo", "provas-pc": "Provas e ônus da prova", "fundamentacao": "Fundamentação e julgamento extra, ultra ou citra petita", "coisa-julgada": "Coisa julgada, preclusão e ação rescisória", "especiais": "Procedimentos especiais", "ms": "Mandado de segurança", "coletivo": "Processo coletivo e ação civil pública", "arbitragem-pc": "Convenção de arbitragem e sentença arbitral", "cumprimento": "Cumprimento de sentença e liquidação", "execucao-tit": "Execução de título extrajudicial e embargos", "penhora": "Penhora, bloqueio e expropriação", "bem-familia": "Bem de família e impenhorabilidade", "fraude-execucao": "Fraude à execução", "medidas-atipicas": "Medidas executivas atípicas", "prescricao-int": "Prescrição intercorrente", "prequestionamento": "Prequestionamento", "reexame": "Reexame de fatos, provas e cláusulas (Súmulas 5 e 7)", "fundamentacao-recursal": "Deficiência das razões (Súmulas 283 e 284/STF)", "dissidio": "Dissídio jurisprudencial e Súmula 83", "materia-inadequada": "Matéria constitucional, lei local e atos infralegais", "negativa-prestacao": "Negativa de prestação jurisdicional (arts. 489 e 1.022)", "embargos-declaracao": "Embargos de declaração: cabimento e multa", "aresp": "Agravo em recurso especial e impugnação específica", "agravo-interno": "Agravo interno e multa", "agravo-instrumento": "Agravo de instrumento e taxatividade", "apelacao": "Apelação e julgamento ampliado", "preparo": "Preparo, tempestividade e representação processual", "precedentes-pc": "Precedentes, repetitivos e IRDR", "eresp": "Embargos de divergência", "reclamacao": "Reclamação"},
    "tributario": {"ir": "Imposto de renda e CSLL", "pis-cofins": "PIS e Cofins", "contrib-prev": "Contribuições previdenciárias e de terceiros", "ipi-iof": "IPI e IOF", "aduaneiro": "Comércio exterior e tributos aduaneiros", "simples": "Simples Nacional", "icms": "ICMS", "ipva-itcmd": "IPVA e ITCMD", "iss": "ISS", "iptu-itbi": "IPTU e ITBI", "taxas": "Taxas e contribuições especiais", "imunidade": "Imunidades e isenções", "credito-trib": "Lançamento, decadência e prescrição", "parcelamento": "Parcelamento, transação e denúncia espontânea", "responsabilidade-trib": "Responsabilidade tributária e redirecionamento", "compensacao": "Compensação e repetição de indébito", "multas-trib": "Multas tributárias e Selic", "exec-fiscal": "Execução fiscal, exceção de pré-executividade e penhora", "processo-trib": "Processo administrativo fiscal e certidões"},
    "administrativo": {"remuneracao": "Remuneração, vantagens e reajustes", "cargos": "Cargo, carreira, acumulação e licenças", "aposentadoria-serv": "Aposentadoria e pensão de servidores", "concursos": "Concursos públicos", "militares": "Militares", "pad": "Processo administrativo disciplinar", "servidores": "Servidores públicos: outros temas", "improbidade": "Improbidade administrativa", "controle": "Atos administrativos, poder de polícia e sanções", "tribunal-contas": "Tribunais de contas", "licitacoes": "Licitações", "contratos-adm": "Contratos administrativos e equilíbrio econômico", "concessoes": "Concessões, permissões e PPP", "desapropriacao": "Desapropriação e indenização", "bens-publicos": "Bens públicos, terrenos de marinha e tombamento", "urbanismo-adm": "Urbanismo e ordenação urbana", "resp-estado": "Responsabilidade civil do Estado", "prescricao-adm": "Prescrição contra a Fazenda e no processo administrativo", "fazenda-juizo": "Precatórios, juros e correção contra a Fazenda", "regulacao": "Agências reguladoras e serviços públicos", "transito": "Trânsito, habilitação e multas", "conselhos": "Conselhos profissionais", "saude-pub": "Saúde pública e medicamentos", "ensino-pub": "Ensino público e financiamento estudantil", "fgts": "FGTS"},
    "previdenciario": {"tempo-especial": "Tempo especial e agentes nocivos", "aposentadorias": "Aposentadorias: requisitos e regras de transição", "incapacidade": "Benefícios por incapacidade", "pensao-morte": "Pensão por morte e qualidade de segurado", "assistencial": "Benefício assistencial (BPC/LOAS)", "outros-benef": "Salário-maternidade, auxílio-reclusão e auxílio-acidente", "rural": "Trabalhador rural e segurado especial", "acidentaria": "Acidente de trabalho e ação regressiva do INSS", "revisao": "Revisão e cálculo de benefícios", "devolucao": "Devolução de valores e descontos", "privada": "Previdência privada"},
    "ambiental": {"dano-amb": "Dano ambiental e reparação", "areas-prot": "APP, reserva legal e Código Florestal", "unidades-conservacao": "Unidades de conservação", "recursos-nat": "Recursos hídricos, mineração e resíduos", "fauna": "Fauna, flora e pesca", "sancoes-amb": "Licenciamento, infrações e multas ambientais", "urbanistico": "Urbanismo, ocupação do solo e poluição visual"},
    "penal": {"dosimetria": "Dosimetria: pena-base, agravantes e causas de aumento", "regime": "Regime inicial e substituição da pena", "prescricao-penal": "Prescrição penal", "insignificancia": "Insignificância, atipicidade e crime impossível", "punibilidade": "Outras causas de extinção da punibilidade", "progressao": "Progressão, livramento e faltas", "remicao-indulto": "Remição, indulto e unificação de penas", "exec-penal": "Execução penal: outros temas", "pessoa": "Crimes contra a vida e lesões corporais", "violencia-dom": "Violência doméstica e familiar", "sexuais": "Crimes sexuais", "honra": "Crimes contra a honra", "liberdade": "Ameaça, perseguição e crimes contra a liberdade", "furto": "Furto", "roubo": "Roubo, extorsão e latrocínio", "estelionato": "Estelionato, receptação e apropriação indébita", "drogas": "Tráfico e associação para o tráfico", "trafico-privilegiado": "Tráfico privilegiado", "porte-uso": "Porte para uso e distinção entre usuário e traficante", "armas": "Armas e munições", "transito-penal": "Crimes de trânsito", "ambientais-penal": "Crimes ambientais", "orcrim": "Organização e associação criminosa", "administracao": "Crimes contra a administração pública", "economicos": "Crimes tributários, financeiros e lavagem"},
    "proc-penal": {"acao-penal": "Inquérito, denúncia, justa causa e trancamento", "acordos": "ANPP, transação e colaboração premiada", "competencia-pp": "Competência", "preventiva": "Prisão preventiva: fundamentos", "excesso-prazo": "Excesso de prazo", "domiciliar": "Prisão domiciliar e cautelares alternativas", "flagrante": "Flagrante, audiência de custódia e fiança", "busca": "Busca pessoal, veicular e domiciliar", "interceptacao": "Interceptação, quebra de sigilo e dados digitais", "cadeia-custodia": "Cadeia de custódia, perícia e laudos", "reconhecimento": "Reconhecimento de pessoas", "provas-pp": "Provas em geral e prova ilícita", "defesa": "Defesa técnica, interrogatório e contraditório", "correlacao": "Correlação entre acusação e sentença", "sentenca-pp": "Absolvição, in dubio pro reo e desclassificação", "nulidades-pp": "Nulidades: outros temas", "pronuncia": "Pronúncia e impronúncia", "juri": "Júri: plenário, quesitos e soberania dos veredictos", "hc": "Habeas corpus: cabimento", "recursos-pp": "Recursos criminais e revisão criminal", "admissibilidade-pp": "Admissibilidade do recurso especial e do agravo", "embargos-pp": "Embargos de declaração"},
  };
  // Grupo de cada assunto, na ordem da lei de regência; o grupo também é selecionável no filtro.
  const SUBGRUPO = {
    "civil": {"pessoas": "Parte geral", "personalidade": "Parte geral", "internet": "Parte geral", "negocio-juridico": "Parte geral", "prescricao-civ": "Parte geral", "bens": "Parte geral", "inadimplemento": "Obrigações", "juros-correcao": "Obrigações", "obrigacoes": "Obrigações", "enriquecimento": "Obrigações", "contratos": "Contratos", "compra-venda": "Contratos", "locacao": "Contratos", "prestacao-servicos": "Contratos", "mandato-corretagem": "Contratos", "transporte": "Contratos", "fianca": "Contratos", "comodato-deposito": "Contratos", "seguro-vida": "Seguros", "dpvat": "Seguros", "seguros": "Seguros", "dano-moral": "Responsabilidade civil", "danos-materiais": "Responsabilidade civil", "resp-civil": "Responsabilidade civil", "acidentes": "Responsabilidade civil", "resp-profissional": "Responsabilidade civil", "posse": "Direito das coisas", "usucapiao": "Direito das coisas", "propriedade": "Direito das coisas", "condominio": "Direito das coisas", "direitos-reais": "Direito das coisas", "registros": "Registros e propriedade intelectual", "autoral": "Registros e propriedade intelectual"},
    "familia": {"casamento": "Casamento e união estável", "uniao-estavel": "Casamento e união estável", "divorcio": "Casamento e união estável", "alimentos": "Alimentos", "execucao-alimentos": "Alimentos", "filiacao": "Filhos", "guarda": "Filhos", "adocao": "Filhos", "infancia": "Filhos", "curatela": "Filhos", "sucessao-legitima": "Sucessões", "testamento": "Sucessões", "inventario": "Sucessões"},
    "consumidor": {"saude-cobertura": "Planos de saúde", "saude-reajuste": "Planos de saúde", "saude-contrato": "Planos de saúde", "planos-saude": "Planos de saúde", "bancos-cons": "Contratos de consumo", "imoveis-cons": "Contratos de consumo", "educacao-cons": "Contratos de consumo", "veiculos": "Contratos de consumo", "aereo": "Serviços", "saude-servicos": "Serviços", "essenciais": "Serviços", "fornecedor": "Responsabilidade do fornecedor", "cadastros": "Responsabilidade do fornecedor", "praticas": "Práticas comerciais", "publicidade": "Práticas comerciais", "superendividamento": "Práticas comerciais", "defesa-cons": "Defesa em juízo"},
    "bancario": {"juros": "Contratos e encargos", "tarifas": "Contratos e encargos", "contratos-banc": "Contratos e encargos", "credito-rural": "Contratos e encargos", "superendividamento": "Contratos e encargos", "consignado": "Contratos e encargos", "cartao": "Contratos e encargos", "fiduciaria": "Garantias", "garantias-banc": "Garantias", "sfh": "Crédito imobiliário", "fraudes": "Responsabilidade do banco"},
    "empresarial": {"sociedades": "Sociedades", "dissolucao": "Sociedades", "cooperativas": "Sociedades", "desconsideracao": "Sociedades", "recuperacao": "Recuperação e falência", "falencia": "Recuperação e falência", "creditos-concursais": "Recuperação e falência", "titulos": "Títulos de crédito", "contratos-emp": "Contratos empresariais", "leasing": "Contratos empresariais", "marcas": "Propriedade industrial", "patentes": "Propriedade industrial", "arbitragem": "Arbitragem e mercado", "mercado": "Arbitragem e mercado"},
    "proc-civil": {"partes": "Sujeitos do processo", "intervencao": "Sujeitos do processo", "competencia": "Sujeitos do processo", "honorarios": "Sujeitos do processo", "gratuidade": "Sujeitos do processo", "atos-proc": "Atos processuais e tutelas", "tutela": "Atos processuais e tutelas", "provas-pc": "Conhecimento e sentença", "fundamentacao": "Conhecimento e sentença", "coisa-julgada": "Conhecimento e sentença", "especiais": "Conhecimento e sentença", "ms": "Conhecimento e sentença", "coletivo": "Conhecimento e sentença", "arbitragem-pc": "Conhecimento e sentença", "cumprimento": "Execução", "execucao-tit": "Execução", "penhora": "Execução", "bem-familia": "Execução", "fraude-execucao": "Execução", "medidas-atipicas": "Execução", "prescricao-int": "Execução", "prequestionamento": "Recurso especial: admissibilidade", "reexame": "Recurso especial: admissibilidade", "fundamentacao-recursal": "Recurso especial: admissibilidade", "dissidio": "Recurso especial: admissibilidade", "materia-inadequada": "Recurso especial: admissibilidade", "negativa-prestacao": "Agravos e embargos de declaração", "embargos-declaracao": "Agravos e embargos de declaração", "aresp": "Agravos e embargos de declaração", "agravo-interno": "Agravos e embargos de declaração", "agravo-instrumento": "Agravos e embargos de declaração", "apelacao": "Recursos e precedentes", "preparo": "Recursos e precedentes", "precedentes-pc": "Recursos e precedentes", "eresp": "Recursos e precedentes", "reclamacao": "Recursos e precedentes"},
    "tributario": {"ir": "Tributos federais", "pis-cofins": "Tributos federais", "contrib-prev": "Tributos federais", "ipi-iof": "Tributos federais", "aduaneiro": "Tributos federais", "simples": "Tributos federais", "icms": "Tributos estaduais", "ipva-itcmd": "Tributos estaduais", "iss": "Tributos municipais", "iptu-itbi": "Tributos municipais", "taxas": "Tributos municipais", "imunidade": "Normas gerais", "credito-trib": "Normas gerais", "parcelamento": "Normas gerais", "responsabilidade-trib": "Normas gerais", "compensacao": "Normas gerais", "multas-trib": "Normas gerais", "exec-fiscal": "Processo tributário", "processo-trib": "Processo tributário"},
    "administrativo": {"remuneracao": "Agentes públicos", "cargos": "Agentes públicos", "aposentadoria-serv": "Agentes públicos", "concursos": "Agentes públicos", "militares": "Agentes públicos", "pad": "Agentes públicos", "servidores": "Agentes públicos", "improbidade": "Controle da administração", "controle": "Controle da administração", "tribunal-contas": "Controle da administração", "licitacoes": "Contratações públicas", "contratos-adm": "Contratações públicas", "concessoes": "Contratações públicas", "desapropriacao": "Bens públicos e intervenção", "bens-publicos": "Bens públicos e intervenção", "urbanismo-adm": "Bens públicos e intervenção", "resp-estado": "Fazenda Pública", "prescricao-adm": "Fazenda Pública", "fazenda-juizo": "Fazenda Pública", "regulacao": "Regulação e serviços públicos", "transito": "Regulação e serviços públicos", "conselhos": "Regulação e serviços públicos", "saude-pub": "Direitos sociais", "ensino-pub": "Direitos sociais", "fgts": "Direitos sociais"},
    "previdenciario": {"tempo-especial": "Aposentadorias", "aposentadorias": "Aposentadorias", "incapacidade": "Outros benefícios", "pensao-morte": "Outros benefícios", "assistencial": "Outros benefícios", "outros-benef": "Outros benefícios", "rural": "Segurados", "acidentaria": "Segurados", "revisao": "Cálculo, revisão e devolução", "devolucao": "Cálculo, revisão e devolução", "privada": "Previdência complementar"},
    "ambiental": {"dano-amb": "Responsabilidade ambiental", "areas-prot": "Espaços protegidos", "unidades-conservacao": "Espaços protegidos", "recursos-nat": "Recursos naturais", "fauna": "Recursos naturais", "sancoes-amb": "Licenciamento e infrações", "urbanistico": "Licenciamento e infrações"},
    "penal": {"dosimetria": "Aplicação da pena", "regime": "Aplicação da pena", "prescricao-penal": "Punibilidade e tipicidade", "insignificancia": "Punibilidade e tipicidade", "punibilidade": "Punibilidade e tipicidade", "progressao": "Execução penal", "remicao-indulto": "Execução penal", "exec-penal": "Execução penal", "pessoa": "Crimes contra a pessoa", "violencia-dom": "Crimes contra a pessoa", "sexuais": "Crimes contra a pessoa", "honra": "Crimes contra a pessoa", "liberdade": "Crimes contra a pessoa", "furto": "Crimes contra o patrimônio", "roubo": "Crimes contra o patrimônio", "estelionato": "Crimes contra o patrimônio", "drogas": "Drogas", "trafico-privilegiado": "Drogas", "porte-uso": "Drogas", "armas": "Legislação especial", "transito-penal": "Legislação especial", "ambientais-penal": "Legislação especial", "orcrim": "Legislação especial", "administracao": "Administração pública e crimes econômicos", "economicos": "Administração pública e crimes econômicos"},
    "proc-penal": {"acao-penal": "Investigação e ação penal", "acordos": "Investigação e ação penal", "competencia-pp": "Investigação e ação penal", "preventiva": "Prisão e medidas cautelares", "excesso-prazo": "Prisão e medidas cautelares", "domiciliar": "Prisão e medidas cautelares", "flagrante": "Prisão e medidas cautelares", "busca": "Provas", "interceptacao": "Provas", "cadeia-custodia": "Provas", "reconhecimento": "Provas", "provas-pp": "Provas", "defesa": "Procedimento e nulidades", "correlacao": "Procedimento e nulidades", "sentenca-pp": "Procedimento e nulidades", "nulidades-pp": "Procedimento e nulidades", "pronuncia": "Tribunal do Júri", "juri": "Tribunal do Júri", "hc": "Habeas corpus e recursos", "recursos-pp": "Habeas corpus e recursos", "admissibilidade-pp": "Habeas corpus e recursos", "embargos-pp": "Habeas corpus e recursos"},
  };

  // Grupo de assuntos (segundo nível do filtro): "g|matéria|grupo" vale todos os assuntos do grupo.
  const subsDoGrupo = (a, g) => Object.keys(SUBAREAS[a] || {}).filter((k) => (SUBGRUPO[a]?.[k] || "") === g).map((k) => `${a}/${k}`);
  // Alterna um grupo na seleção de matérias. est: { tudo, nenhum, areas } (areas = matérias listadas).
  function alternarGrupoMat(cur, val, est) {
    const [, a, g] = val.split("|"), gs = subsDoGrupo(a, g), outros = Object.keys(SUBAREAS[a] || {}).map((k) => `${a}/${k}`).filter((x) => !gs.includes(x));
    if (est.nenhum) { est.nenhum = false; return gs; }
    if (est.tudo) return [...est.areas.filter((x) => x !== a), ...outros];
    if (cur.includes(a)) return [...cur.filter((x) => x !== a), ...outros];
    if (gs.every((x) => cur.includes(x))) { const l = cur.filter((x) => !gs.includes(x)); if (!l.length) est.nenhum = true; return l; }
    return [...new Set([...cur, ...gs])];
  }
  // Seleção igual a um grupo inteiro: "Civil · Seguros".
  function rotGrupoMat(sel) {
    const a = (sel[0] || "").split("/")[0];
    if (!a || !sel.every((x) => x.startsWith(a + "/"))) return "";
    const g = SUBGRUPO[a]?.[sel[0].split("/")[1]] || "";
    const gs = g ? subsDoGrupo(a, g) : [];
    return gs.length > 1 && gs.length === sel.length && gs.every((x) => sel.includes(x)) ? `${AREAS[a]} · ${g}` : "";
  }
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
  const seloMat = (ar = [], sa = [], max = 1) => (ar || []).slice(0, max).map((a) => { const s = (sa || []).find((x) => x.startsWith(a + "/") && SUBAREAS[a]?.[x.split("/")[1]]); return `<span class="selo area" style="--h:${AREA_COR[a] ?? 222}">${esc(AREAS[a] || a)}${s ? `<span class="sub"> · ${esc(rotMat(s, true))}</span>` : ""}</span>`; }).join("");
  // Seletor de matérias em dois painéis: à esquerda as matérias; à direita os assuntos
  // da matéria aberta, agrupados como na lei de regência. No celular, um painel por vez.
  function htmlMaterias({ cont, sel, aberta, todas = "Todas as matérias", op = (v) => `data-op="${esc(v)}"`, todasOn, selReal = sel }) {
    const temSel = (a) => sel(a) || Object.keys(SUBAREAS[a] || {}).some((s) => sel(`${a}/${s}`));
    const temReal = (a) => selReal(a) || Object.keys(SUBAREAS[a] || {}).some((s) => selReal(`${a}/${s}`));
    // Sem contagem, a matéria só aparece se estiver marcada de fato (e não apenas por "todas marcadas").
    const areas = Object.keys(AREAS).filter((a) => !cont || cont[a] || temReal(a));
    if (cont) areas.sort((a, b) => (cont[b] || 0) - (cont[a] || 0));
    const n = (v) => (cont ? `<span class="n">${fmtInt(cont[v] || 0)}</span>` : "");
    const algum = areas.some(temSel);
    const subsDe = (a) => Object.entries(SUBAREAS[a] || {}).filter(([k]) => !cont || cont[`${a}/${k}`] || selReal(`${a}/${k}`));
    const larga = !matchMedia("(max-width: 860px)").matches;
    // No computador, o painel da direita nunca fica vazio: abre a matéria marcada ou a primeira da lista.
    if (larga && (aberta === undefined || aberta === "" || !areas.includes(aberta))) aberta = areas.find((a) => temSel(a) && subsDe(a).length) || areas.find((a) => subsDe(a).length) || "";
    const esquerda = `<div class="mt2-areas" role="list"><button type="button" class="mt2-todas" ${op("")} aria-pressed="${todasOn ?? !algum}">${esc(todasOn === undefined ? todas : todasOn ? "Desmarcar todas" : "Marcar todas")}</button>${areas.map((a) => {
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
        ${grupos.map((gr) => `${gr.g && grupos.length > 1 ? `<button type="button" class="mt2-grupo" ${op(`g|${aberta}|${gr.g}`)} aria-pressed="${sel(aberta) || gr.itens.every(([k]) => sel(`${aberta}/${k}`))}" title="Marca ou desmarca todos os assuntos de “${esc(gr.g)}”">${esc(gr.g)}</button>` : ""}${gr.itens.map(([k, t]) => `<button type="button" class="mt2-sub" ${op(`${aberta}/${k}`)} aria-pressed="${sel(`${aberta}/${k}`)}"><span>${esc(t)}</span>${n(`${aberta}/${k}`)}</button>`).join("")}`).join("")}
      </div>`;
    }
    return `<div class="mt2${aberta ? " com-aberta" : ""}">${esquerda}${direita}</div>`;
  }
  const MOTIVOS = {
    ce: "Corte Especial", secao: "Seção", afetacao: "Afetação ao rito repetitivo", eresp: "Embargos de divergência",
    iac: "IAC / PUIL", tese: "Tese firmada", repetitivo: "Menção a recurso repetitivo", mudanca: "Sinal de mudança de entendimento",
    inedito: "Questão nova", modulacao: "Modulação de efeitos", distincao: "Distinção (distinguishing)", divergencia: "Divergência",
  };
  // O que cada marca significa (texto do cursor e da ajuda).
  const MOTIVOS_DICA = {
    afetacao: "O STJ decidiu (ou propôs) julgar a questão pelo rito dos recursos repetitivos: a tese que vier a ser firmada valerá para todos os casos iguais, e os processos sobre o tema podem ficar suspensos.",
    repetitivo: "A ementa menciona o rito dos recursos repetitivos ou um tema repetitivo. O processo não consta da lista oficial de processos do tema: o julgado cita ou aplica a tese, sem tê-la firmado.",
    mudanca: "A ementa fala em superação ou mudança de entendimento (overruling): o julgado pode ter alterado a jurisprudência anterior.",
    inedito: "A ementa diz tratar de questão nova, ainda sem precedentes no STJ.",
    modulacao: "A ementa trata de modulação de efeitos: o tribunal definiu a partir de quando o entendimento vale.",
    distincao: "A ementa fala em distinção (distinguishing): o julgado explica por que um precedente não se aplica ao caso, por serem os fatos diferentes.",
    divergencia: "A ementa fala em divergência jurisprudencial (dissídio ou embargos de divergência). Muitas vezes é só para dizer que a divergência não foi demonstrada.",
  };
  // No cartão, só as marcas objetivas que não repetem o título; as que vêm das palavras da ementa
  // ficam na página do julgado, com a explicação.
  const MOTIVOS_CARTAO = ["afetacao"], MOTIVOS_TEXTO = ["mudanca", "inedito", "modulacao", "distincao", "divergencia"];
  // Relação do acórdão com os precedentes qualificados, pela lista oficial de processos de cada
  // tema: "firmou a tese" (acórdão do próprio julgamento do tema), "processo vinculado" (o processo
  // está na lista, mas o acórdão é outro, como embargos) ou nenhuma (a ementa só cita o tema, o que
  // aparece na linha "Cita Tema …").
  const REF_REP = { p: null, pt: null, t: null };
  function prepararRefRep() {
    if (!REF_REP.p) REF_REP.p = Promise.all([procTemas(), temas()]).then(([pt, t]) => { REF_REP.pt = pt; REF_REP.t = t; }).catch(() => {});
    return REF_REP.p;
  }
  function relRepetitivo(r) {
    if (!REF_REP.pt || !r.reg) return null;
    const vs = REF_REP.pt.porReg.get(r.reg); if (!vs?.length) return null;
    const firmou = vs.find((v) => { const x = REF_REP.t.idx.get(`${v.tp}-${v.n}`); return v.tp !== "Controvérsia" && x?.julg && r.dd === x.julg && !/^(EDcl|AgInt|AgRg)\b/.test(r.cl || ""); });
    const v = firmou || vs.find((y) => y.tp === "Tema") || vs[0];
    return { k: firmou ? "firmou" : "vinculado", tp: v.tp, n: v.n, mais: vs.length - 1 };
  }
  function seloRep(r) {
    const x = relRepetitivo(r); if (!x) return "";
    const nome = `${x.tp} ${fmtNumProc(x.n)}`;
    return x.k === "firmou"
      ? `<button type="button" class="selo ok selo-link" data-abrir-precedente="${esc(x.tp)}|${x.n}" title="Acórdão do julgamento que firmou a tese do ${esc(nome)}. Toque para ver a tese.">Firmou a tese · ${esc(nome)}</button>`
      : `<button type="button" class="selo pri selo-link" data-abrir-precedente="${esc(x.tp)}|${x.n}" title="O processo consta da lista oficial de processos vinculados ao ${esc(nome)}${x.mais ? ` (e a mais ${x.mais} precedente${x.mais > 1 ? "s" : ""})` : ""}. Toque para abrir.">Processo vinculado · ${esc(nome)}</button>`;
  }
  const seloMotivo = (k) => `<span class="selo pri" title="${esc(MOTIVOS_DICA[k] || "")}">${esc(MOTIVOS[k])}</span>`;
  const nivelAc = (s) => (s >= 10 ? "alta" : s >= 6 ? "rel" : s >= 2 ? "acomp" : "");
  const NIVEL_TX = { alta: "Sinal forte de relevância", rel: "Relevante", acomp: "Acompanhar" };
  // Selo da classificação automática; o título explica a pontuação (não é a força vinculante do precedente).
  // Só o nível mais alto aparece como selo; "relevante" e "acompanhar" continuam valendo para ordenar e filtrar.
  const seloNivel = (n, r) => (n === "alta" ? `<span class="selo ${n}"${r ? ` title="${esc(`Classificação automática do Radar: ${r.s ?? 0} pontos${(r.rz || []).filter((k) => MOTIVOS[k]).length ? ` (${(r.rz || []).filter((k) => MOTIVOS[k]).map((k) => MOTIVOS[k].toLowerCase()).join(", ")})` : ""}. Indica prioridade de leitura, não a força vinculante do precedente.`)}"` : ""}><span class="ponto ${n}"></span>${NIVEL_TX[n]}</span>` : "");

  function grupoSituacao(sit) {
    const s = norm(sit);
    if (/acordao publicado|transito|merito julgado|^julgado|tese fixada/.test(s)) return "julgado";
    if (/afetad|em julgamento|pendente|admitido|sobrestad|em definicao|em analise/.test(s)) return "andamento";
    if (/sem repercussao/.test(s)) return "semrg";
    if (/cancelad|revisad|prejudicad|indeferid|finalizada/.test(s)) return "cancelado";
    return "outro";
  }
  const seloSit = (sit) => {
    const cls = { andamento: "rel", julgado: "ok", cancelado: "canc", semrg: "canc" }[grupoSituacao(sit)] || "";
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
  // A palavra digitada sempre casa consigo mesma ("icms" não vira só "icm"/"icns").
  function flexW(w) {
    if (w.length < 3 || /\d/.test(w)) return w;
    const r = flexW0(w);
    return new RegExp(`^${r}$`).test(w) ? r : `(?:${w}|${r})`;
  }
  function flexW0(w) {
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
          const palavras = norm(s.replace(/"/g, "")).split(/[^a-z0-9$*]+/).filter(Boolean).map((p) => p.replace(/\*/g, "$"));
          if (palavras.length) out.push(ex ? { t: "frase", v: palavras, ex } : { t: "frase", v: palavras });
          continue;
        }
        // "tema 1365" e "súmula 7" (como se costuma escrever) valem como tema:1365 e sumula:7.
        const ant = out[out.length - 1];
        if (/^\d{1,3}(?:\.\d{3})*$|^\d{1,5}$/.test(s) && ant?.t === "termo" && !ant.ex && (ant.v === "tema" || ant.v === "sumula")) {
          out.pop(); out.push({ t: ant.v === "tema" ? "tema" : "sum", v: +s.replace(/\D/g, "") }); continue;
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
          case "frase": return `a expressão exata “${x.v.map((w) => w.replace(/\$$/, "*")).join(" ")}”`;
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
      <p class="ab-intro"><b>Comece simples.</b> Escreva as palavras como falaria: <code>prescrição intercorrente</code>. Vêm os julgados que têm as duas palavras, em qualquer ordem, também no plural e com os sinônimos jurídicos mais comuns (<code>dano moral</code> também encontra “dano extrapatrimonial”). Acentos e maiúsculas não fazem diferença. Se vier resultado demais, use os recursos abaixo.</p>
      <ol class="ab-passos">
        <li><b>Expressão exata.</b> Coloque entre aspas: <code>"bem de família"</code> traz só as palavras juntas, nessa ordem.</li>
        <li><b>Uma coisa ou outra.</b> Use <code>ou</code>: <code>guarda ou visitas</code>.</li>
        <li><b>Excluir um assunto.</b> Use <code>não</code>, ou um hífen colado na palavra: <code>alimentos não gravídicos</code> ou <code>alimentos -gravídicos</code>.</li>
        <li><b>Todas as formas de uma palavra.</b> Escreva o começo e um asterisco: <code>prescri*</code> encontra prescrição, prescricional, prescritível, prescrito. O cifrão, usado na pesquisa do próprio STJ, funciona igual (<code>prescri$</code>).</li>
        <li><b>Combinar.</b> Parênteses agrupam as alternativas: <code>(usucapião ou posse) e rural</code>.</li>
        <li><b>Palavras próximas.</b> <code>adj</code> quer dizer “logo depois”: <code>dano adj moral</code> exige “moral” logo após “dano” (<code>adj2</code> admite uma palavra no meio). <code>prox</code> quer dizer “perto, em qualquer ordem”: <code>juros prox5 mora</code> aceita até cinco palavras entre elas.</li>
        <li><b>Sem plural nem sinônimos.</b> Ponha o sinal de igual antes: <code>=dano</code> ou <code>="plano de saúde"</code>.</li>
        <li><b>Tema, súmula ou processo.</b> <code>tema 1365</code> e <code>súmula 7</code> trazem os julgados que os citam. Para um processo, digite o número, com ou sem pontos e classe: <code>REsp 2.219.808</code>.</li>
      </ol>
      <p class="nota">Abaixo do campo aparece “Buscando…”, com a pesquisa como o site a entendeu. Toque num exemplo para experimentar:</p>
      <div class="chips">
        <button type="button" class="chip" aria-pressed="false" data-ex='"prova oral"'>"prova oral"</button>
        <button type="button" class="chip" aria-pressed="false" data-ex='"plano de saúde" e (rol ou cobertura)'>"plano de saúde" e (rol ou cobertura)</button>
        <button type="button" class="chip" aria-pressed="false" data-ex="prescri* e intercorrente">prescri* e intercorrente</button>
        <button type="button" class="chip" aria-pressed="false" data-ex="tema 1365">tema 1365</button>
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
  // Arquivos guardados já compactados (.json.gz), descompactados no navegador.
  function carregarGz(nome) {
    if (!D.cache[nome]) D.cache[nome] = getJSONgz(`data/${nome}.json`).catch((e) => { delete D.cache[nome]; throw e; });
    return D.cache[nome];
  }
  function carregar(nome, prep) {
    if (!D.cache[nome]) D.cache[nome] = getJSON(`data/${nome}.json`).then((x) => (prep ? prep(x) : x)).catch((e) => { delete D.cache[nome]; throw e; });
    return D.cache[nome];
  }
  // Classe do recurso principal: "AgInt nos EDcl no AREsp" -> "AREsp" (REsp e AREsp têm numerações próprias).
  const classeBase = (cl) => (String(cl || "").trim().split(/\s+(?:no|na|nos|nas|em)\s+/i).pop().split(/\s+/)[0] || "").replace(/\.$/, "");
  // Decisões monocráticas (metadados do STJ, desde 2021): número, recurso interno, ministro,
  // data de publicação e desfecho, sem o texto. Fragmentadas pelos dois últimos dígitos do número.
  async function monocraticasDe(nums = [], regs = []) {
    if (!D.man.monocraticas?.v) return [];
    const frag = (n) => n.slice(-2).padStart(2, "0");
    const sn = new Set(nums.map(digitos).filter(Boolean)), sr = new Set(regs.map(digitos).filter(Boolean));
    if (sr.size) {
      const rs = await Promise.all([...new Set([...sr].map(frag))].map((k) => carregarGz(`monocraticas/r${k}`).catch(() => ({ l: [] }))));
      for (const r of rs) for (const [reg, n] of r.l) if (sr.has(reg)) sn.add(n);
    }
    if (!sn.size) return [];
    const fs = await Promise.all([...new Set([...sn].map(frag))].map((k) => carregarGz(`monocraticas/m${k}`).catch(() => null)));
    const out = [];
    for (const f of fs) if (f) for (const x of f.l) {
      if (!sn.has(x[0]) || (sr.size && !sr.has(x[1]) && !nums.map(digitos).includes(x[0]))) continue;
      out.push({ n: x[0], reg: x[1], cl: x[2], rec: x[3], d: x[4] ? `${x[4].slice(0, 4)}-${x[4].slice(4, 6)}-${x[4].slice(6, 8)}` : "", min: f.min[x[5]] || "", teor: f.teor[x[6]] || "", desc: f.desc[x[7]] || "", seq: x[8] });
    }
    return out.sort((a, b) => b.d.localeCompare(a.d));
  }
  const RES_MONO = { Negando: "Negou provimento", Denegando: "Denegou", "Não Conhecendo": "Não conheceu", Concedendo: "Concedeu ou deu provimento", "Admitindo Embargo": "Admitiu os embargos", Outros: "Outro desfecho" };
  const tituloMono = (x) => (x.rec && x.rec !== "DESIS" ? `${x.rec} no ${x.cl} ${fmtNumProc(x.n)}` : `${x.cl} ${fmtNumProc(x.n)}`);
  const desfechoMono = (x) => (x.desc ? x.desc.charAt(0).toUpperCase() + x.desc.slice(1) : RES_MONO[x.teor] || x.teor || "") + (x.rec === "DESIS" ? " (pedido de desistência)" : "");
  function cardMono(x) {
    return `<li class="card item item-mono">
      <div class="item-cab"><a class="item-tit" href="${URLS.mono(x)}" target="_blank" rel="noopener" title="Abrir a decisão oficial (PDF do STJ)">${esc(tituloMono(x))}</a><span class="selo">Decisão monocrática</span>
        <span class="meta">${x.min ? `<span>${esc(relatorFmt(x.min))}</span>` : ""}<span>Publ. ${fmtData(x.d)}</span></span></div>
      <p class="texto-serif mono-desfecho">${esc(desfechoMono(x))}.</p>
      <div class="acoes"><a class="link-acao" href="${URLS.mono(x)}" target="_blank" rel="noopener">Decisão oficial (PDF) ${ico("externo")}</a>
        <a class="link-acao" href="${URLS.processo(x.reg)}" target="_blank" rel="noopener">Consulta processual ${ico("externo")}</a></div></li>`;
  }
  // Índice de números de processo. Na versão fragmentada (manifest.numeros.v = 2), baixa só os
  // fragmentos dos números pedidos (dois últimos dígitos), em vez do índice inteiro.
  // Devolve { m, o, l } com as linhas [número, registro, mês, órgão, id] dos números ou registros pedidos.
  async function numerosDe(nums = [], regs = []) {
    nums = [...new Set(nums.map(digitos).filter(Boolean))]; regs = [...new Set(regs.map(digitos).filter(Boolean))];
    if (!nums.length && !regs.length) return { m: [], o: [], l: [] };
    if ((D.man.numeros?.v || 0) < 2) {
      const ix = await carregar("numeros");
      const sn = new Set(nums), sr = new Set(regs);
      return { m: ix.m, o: ix.o, l: ix.l.filter((x) => sn.has(x[0]) || sr.has(x[1])) };
    }
    const frag = (n) => n.slice(-2).padStart(2, "0");
    const sn = new Set(nums), sr = new Set(regs);
    if (regs.length) {
      const rs = await Promise.all([...new Set(regs.map(frag))].map((k) => carregar(`numeros/r${k}`)));
      for (const r of rs) for (const [reg, n] of r.l) if (sr.has(reg)) sn.add(n);
    }
    const fs = await Promise.all([...new Set([...sn].map(frag))].map((k) => carregar(`numeros/n${k}`)));
    const l = [];
    for (const f of fs) for (const x of f.l) if (sn.has(x[0]) && (!sr.size || sr.has(x[1]) || nums.includes(x[0]))) l.push(f.r ? [...x.slice(0, 6), f.r[x[6]] || "", x[7] || "", x[8] || ""] : x);
    return { m: fs[0]?.m || [], o: fs[0]?.o || [], l };
  }
  // Pontuação colada à palavra seguinte, sinal de quebra de linha perdida na origem. Não mexe em números
  // ("1.234", "10:30"), siglas ("S.A.") nem abreviações seguidas de minúscula.
  const espacarColados = (t) => String(t)
    .replace(/([\p{Ll}\d)])([;:])(?=[\p{L}(])/gu, "$1$2 ")
    .replace(/([\p{L}\d)])\.(?=\p{Lu}\p{Ll})/gu, "$1. ")
    .replace(/\)(?=\p{L})/gu, ") ")
    .replace(/(\s(?:e|ou))\((?=[a-z]\))/g, "$1 (");
  const temas = () => carregar("temas", async (t) => {
    const hist = await getJSON("data/historico_temas.json").catch(() => []);
    for (const x of t) {
      // A base do STJ perde algumas quebras de linha ("desde que:(a)", "Seção).Vide"): devolve o espaço.
      for (const k of ["q", "tese", "anot", "info", "delim", "ant", "leg"]) if (x[k]) x[k] = espacarColados(x[k]);
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
  // Temas de repercussão geral do STF (tipo "RG"). A situação exibida resume a do STF: sem repercussão
  // geral, mérito pendente, tese firmada ou cancelado; a situação processual fica em "sitOrig".
  function situacaoRG(x) {
    const s = norm(x.sit || "");
    if (/cancelad/.test(s)) return ["Cancelado", "cancelado"];
    if (x.rgs === "nao") return ["Sem repercussão geral", "semrg"];
    if (x.tese) return ["Tese fixada", "julgado"];
    if (x.dtese) return ["Julgado · tese a publicar", "julgado"];
    if (!x.rgs) return [/preliminar/.test(s) ? "Preliminar em análise" : "Em definição", "andamento"];
    return [/em julgamento/.test(s) ? "Em julgamento" : "Mérito pendente", "andamento"];
  }
  const temasRG = () => carregar("stf-temas", async (l) => {
    const hist = await getJSON("data/stf-historico.json").catch(() => []);
    for (const x of l) {
      x.trib = "stf"; x.org = "Repercussão geral";
      x.sitOrig = x.sit || ""; [x.sit, x._g] = situacaoRG(x);
      x._n = norm(["tema", x.n, "repercussao geral stf", x.q, x.desc, x.tese, x.ass, x.lc, x.rel].join(" "));
      x._mov = [x.rgd, x.dtese, x.sitd].filter(Boolean).sort().pop() || "";
    }
    const idx = new Map(l.map((x) => [`RG-${x.n}`, x]));
    for (const ev of hist) { const x = idx.get(`RG-${ev.n}`); if (x && ev.d > x._mov) x._mov = ev.d; }
    l.hist = hist; l.idx = idx;
    return l;
  });
  // Precedentes do tribunal escolhido: repetitivos e afins do STJ, repercussão geral do STF ou os dois.
  function precedentes() {
    if (trib() === "stj") return temas();
    if (trib() === "stf") return temasRG();
    // Sem os dados do STF (fonte fora do ar), os precedentes do STJ continuam a aparecer.
    if (!D.cache._precAmbos) D.cache._precAmbos = Promise.all([temas(), temasRG().catch(() => Object.assign([], { idx: new Map(), hist: [] }))]).then(([a, b]) => {
      const l = [...a, ...b]; l.idx = new Map([...a.idx, ...b.idx]); l.hist = [...a.hist, ...b.hist]; return l;
    }).catch((e) => { delete D.cache._precAmbos; throw e; });
    return D.cache._precAmbos;
  }
  // Súmulas do STF (comuns e vinculantes). Canceladas, revogadas e superadas contam como "fora de vigor".
  const sumulasSTF = () => carregar("stf-sumulas", (l) => {
    for (const x of l) {
      x.trib = "stf"; x.org = "Plenário do STF"; x._k = `STF-${x.v ? "SV" : "S"}${x.n}`;
      x._rot = `${x.v ? "Súmula Vinculante" : "Súmula"} ${x.n}`;
      x._canc = /cancelad|revogad|superad/.test(x.sit || "");
      x._d = x.data || "";
      x._n = norm(`${x._rot} ${x.t} ${(x.obs || []).join(" ")} ${x.teseRg || ""}`);
    }
    l.idx = new Map(l.map((x) => [x._k, x]));
    return l;
  });
  const composicaoSTF = () => carregar("stf-composicao", (c) => {
    c.idx = new Map(c.ministros.map((m) => [m.id, m]));
    c.org = new Map(c.orgaos.map((o) => [o.id, o]));
    for (const m of c.ministros) { m._n = norm(`${m.nome} ${m.curto}`); m.trib = "stf"; }
    return c;
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
  // Ementas extraídas do texto integral dos acórdãos do mês (só parte deles vem com texto).
  const ementasMes = () => carregar("radar-ementas").catch(() => ({}));
  const djen = () => carregar("radar", (l) => { for (const x of l) x._p = norm(`${x.p} ${x.r || ""}`); return l; });

  // Arquivos mensais de acórdãos: publicados compactados (.json.gz) para caber o acervo longo;
  // o navegador descompacta. Sem suporte a descompactação, usa o .json (mantido para os meses recentes).
  async function getJSONgz(url, signal) {
    if (typeof DecompressionStream !== "undefined") {
      try {
        // Meses antigos quase não mudam: aproveita o cache do navegador; os recentes são sempre conferidos.
        const mesArq = /acordaos\/(\d{4}-\d{2})\//.exec(url)?.[1] || "";
        const antigo = mesArq && D.man?.meses?.[3] && mesArq < D.man.meses[3].m;
        const r = await fetch(`${url}.gz`, { cache: antigo ? "default" : "no-cache", signal });
        if (r.ok) {
          const buf = new Uint8Array(await r.arrayBuffer());
          const txt = buf[0] === 0x1f && buf[1] === 0x8b ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(buf);
          return JSON.parse(txt);
        }
      } catch (e) { if (signal?.aborted) throw e; /* tenta o .json */ }
    }
    return getJSON(url);
  }
  // Arquivos mensais mantidos na memória: limite pelo tamanho (menor em aparelhos com pouca memória);
  // os usados há mais tempo saem primeiro.
  const LIM_SHARDS_KB = ((navigator.deviceMemory || 8) <= 4 ? 60 : 160) * 1024;
  let KB_SHARD = null;
  const kbShard = (k) => {
    if (!KB_SHARD) { KB_SHARD = new Map(); for (const x of D.man.meses) for (const [o, v] of Object.entries(x.orgaos)) KB_SHARD.set(`${x.m}/${o}`, v.kb || 0); }
    return KB_SHARD.get(k) || 300;
  };
  function shard(mes, slug) {
    const k = `${mes}/${slug}`;
    if (D.shards.has(k)) { const v = D.shards.get(k); D.shards.delete(k); D.shards.set(k, v); return v; }
    D.shards.set(k, getJSONgz(`data/acordaos/${mes}/${slug}.json`).catch((e) => { D.shards.delete(k); throw e; }));
    let kb = 0; for (const x of D.shards.keys()) kb += kbShard(x);
    while (kb > LIM_SHARDS_KB && D.shards.size > 1) { const x = D.shards.keys().next().value; kb -= kbShard(x); D.shards.delete(x); }
    return D.shards.get(k);
  }
  // Baixa os arquivos mensais; os que falharem ficam em res.falhas (a busca avisa, em vez de parecer completa).
  async function carregarShards(pares, onProg) {
    const res = []; res.falhas = []; let feitos = 0; let i = 0;
    const trab = async () => { while (i < pares.length) { const [m, o] = pares[i++]; try { res.push(...(await shard(m, o))); } catch { res.falhas.push([m, o]); } onProg?.(++feitos, pares.length); } };
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
    // Decisões monocráticas nos processos acompanhados (desde 2021).
    const mns = P.procs.length ? await monocraticasDe(P.procs.map(digitos), P.procs.map(digitos).filter((x) => x.length >= 10)).catch(() => []) : [];
    for (const proc of P.procs) {
      const nd = digitos(proc); if (!nd) continue;
      const bate = (reg, p) => reg === nd || digitos(p) === nd;
      const clp = classeBase(String(proc).replace(/\s*\d[\s\S]*$/, "")).toLowerCase();
      for (const x of mns) if (bate(x.reg, x.n) && (!clp || x.reg === nd || x.cl.toLowerCase() === clp)) add(`m|${x.seq || `${x.reg}|${x.d}|${x.rec}`}`, { tipo: "mono", nivel: "rel", d: x.d, dNovo: x.d, termo: proc, obj: x });
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
    const niv = nivelAc(r.s ?? 0) === "alta" ? "alta" : "";
    const salvo = !!P.salvos[`a:${r.id}`];
    const motivos = (r.rz || []).filter((k) => MOTIVOS_CARTAO.includes(k)).slice(0, 1).map(seloMotivo).join("") || seloRep(r);
    const areas = seloMat(r.ar, r.sa);
    const temCorpo = corpo.length > 0;
    const dups = r._dup?.length ? `<p class="duplic" title="${esc(r._dup.map((d) => `${d.cl} ${fmtNumProc(d.n)}`).join(", "))}">+ ${r._dup.length} processo(s) com a mesma ementa</p>` : "";
    return `<li class="card item" data-id="${esc(r.id)}">
      <div class="item-cab"><button type="button" class="item-tit item-abrir" data-a="abrir" title="Abrir o julgado completo">${esc(r.cl)} ${fmtNumProc(r.n)}</button>
        <span class="meta"><span>${esc(D.orgaos[r.o] || "")}</span>${r.rel ? `<span>Rel. ${esc(relatorFmt(r.rel))}</span>` : ""}${r.dd ? `<span>Julg. ${fmtData(r.dd)}</span>` : ""}<span>Publ. ${fmtData(r.dj)}</span></span></div>
      ${niv || motivos || areas ? `<div class="item-sel">${seloNivel(niv, r)}${motivos}${areas}</div>` : ""}
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
    await prepararRefRep();
    const motivos = (r.rz || []).filter((k) => MOTIVOS_CARTAO.includes(k)).map(seloMotivo).join("") + seloRep(r);
    const mencoes = (r.rz || []).filter((k) => MOTIVOS_TEXTO.includes(k) || (k === "repetitivo" && !relRepetitivo(r)));
    const areas = seloMat(r.ar, r.sa, 3);
    const extra = [["Relator(a)", r.rel ? relatorFmt(r.rel) : ""], ["Julgamento", fmtData(r.dd)], ["Publicação", `${(r.djt || "").split(/\s/)[0] || "DJ"} ${fmtData(r.dj)}`], ["Tema", r.tema], ["Notas", r.notas], ["Informações complementares", r.info], ["Referências legislativas", (r.leg || []).join("\n")]]
      .filter(([, v]) => v).map(([l, v]) => `<dt>${l}</dt><dd>${esc(v).replace(/\n/g, "<br>")}</dd>`).join("");
    abrirGaveta(`${D.orgaos[r.o] || ""}${r.dd ? " · julgado em " + fmtData(r.dd) : ""}`, `${r.cl} ${fmtNumProc(r.n)}`, `
      <div class="item-sel">${seloNivel(nivelAc(r.s ?? 0), r)}${motivos}${areas}</div>
      <div class="acoes" style="margin:4px 0 14px">
        <a class="btn btn-pri btn-peq" href="${URLS.inteiroTeor(r.reg, r.dj)}" target="_blank" rel="noopener">Inteiro teor oficial ${ico("externo")}</a>
        <a class="btn btn-claro btn-peq" href="${URLS.processo(r.reg)}" target="_blank" rel="noopener" title="Consulta processual do STJ; as decisões, inclusive monocráticas anteriores a 2021, ficam na aba “Decisões”">Processo e decisões no STJ ${ico("externo")}</a>
        <button type="button" class="btn btn-claro btn-peq" id="ga-cit">${ico("copiar")} Copiar ementa e citação</button>
        <button type="button" class="btn btn-claro btn-peq" id="ga-socit">${ico("citar")} Copiar só a citação</button>
        <button type="button" class="btn btn-claro btn-peq btn-salvar" id="ga-salvar" data-salvo-chave="a:${esc(r.id)}" aria-pressed="${salvo}">${ico("salvar")} ${salvo ? "Salvo" : "Salvar"}</button>
        <button type="button" class="btn btn-claro btn-peq" id="ga-org">${ico("arquivo")} Pasta e avaliação</button>
      </div>
      ${blocoTese(r, [])}
      <h3>Ementa</h3>
      <p class="verb">${esc(frase(cab))}</p>
      <div class="texto-serif" style="margin-top:10px">${corpo.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      ${linhaRefs(r.em)}
      ${mencoes.length ? `<div class="mencoes"><b>A ementa menciona</b>${mencoes.map((k) => `<p><span>${esc(MOTIVOS[k])}.</span> ${esc(MOTIVOS_DICA[k])}</p>`).join("")}<p class="nota">Marcas automáticas, pelas palavras da ementa; confira no texto.</p></div>` : ""}
      ${extra ? `<h3>Dados do julgado</h3><dl class="dl">${extra}</dl>` : ""}`);
    // Decisões monocráticas do mesmo processo (a que originou o agravo interno, por exemplo).
    monocraticasDe([digitos(r.n)]).then((l) => {
      const cb = classeBase(r.cl).toLowerCase(); l = l.filter((x) => x.cl.toLowerCase() === cb);
      if (!l.length || $("#gaveta").hidden || $("#gaveta-tit").textContent !== `${r.cl} ${fmtNumProc(r.n)}`) return;
      $("#gaveta-corpo").insertAdjacentHTML("beforeend", `<h3>Decisões monocráticas neste processo</h3><p class="nota">Sem o texto; o número abre a decisão oficial no STJ.</p><ol class="lista">${l.slice(0, 20).map(cardMono).join("")}</ol>`);
    }).catch(() => {});
    $("#ga-cit").addEventListener("click", () => copiar(`${r.em}\n${citacao(r)}`, "Ementa e citação copiadas."));
    $("#ga-socit").addEventListener("click", () => copiar(citacao(r), "Citação copiada."));
    $("#ga-org").addEventListener("click", () => organizarSalvo(`a:${r.id}`, minimoAcordao(r)));
    $("#ga-salvar").addEventListener("click", (e) => { alternarSalvo(`a:${r.id}`, minimoAcordao(r), e.currentTarget); e.currentTarget.lastChild.textContent = P.salvos[`a:${r.id}`] ? " Salvo" : " Salvar"; });
  }
  function alternarSalvo(chave, obj, botao) {
    if (P.salvos[chave]) {
      const antes = P.salvos[chave]; delete P.salvos[chave];
      toast("Removido dos salvos.", { rot: "Desfazer", fn: () => { P.salvos[chave] = antes; salvarP(); if (botao) botao.setAttribute("aria-pressed", "true"); avisarSalvos(); } });
    } else {
      P.salvos[chave] = { ...obj, salvoEm: hojeISO() };
    }
    const ok = salvarP(); avisarSalvos();
    if (P.salvos[chave] && ok) toast(pastas().length ? "Salvo. Quer colocá-lo numa pasta?" : "Salvo na aba Salvos.", { rot: pastas().length ? "Escolher pasta" : "Criar pasta", fn: () => organizarSalvo(chave) });
    else if (P.salvos[chave]) toast("Não foi possível salvar neste navegador. Veja o aviso no alto da página.");
    if (botao) { botao.setAttribute("aria-pressed", String(!!P.salvos[chave])); }
  }

  // ======================================================= organização dos salvos
  // Pastas (por tema, cliente ou processo), avaliação do precedente e anotação livre.
  const pastas = () => (P.pastas = P.pastas || []);
  const avisarSalvos = () => { document.dispatchEvent(new Event("salvos-mudou")); atualizarContadorSalvos(); };
  const ehPenal = (ar) => (ar || []).some((a) => a === "penal" || a === "proc-penal");
  const rotAval = (v, penal) => (v === "fav" ? "Favorável" : v === "desf" ? "Desfavorável" : "") + (v && penal ? " à defesa" : "");
  // Temas e súmulas salvos: guarda a situação vista e marca o item quando ela muda (afetado → julgado,
  // súmula cancelada etc.), até o usuário dar ciência.
  async function conferirMudancasSalvos() {
    const ks = Object.entries(P.salvos).filter(([k]) => k.startsWith("t:") || k.startsWith("s:"));
    if (!ks.length) return { todas: [], novas: [] };
    const ehSTF = ([k, x]) => (k[0] === "t" ? x.tp === "RG" : x.trib === "stf");
    const [t, sm, rg, sf] = await Promise.all([ks.some((e) => e[0][0] === "t" && !ehSTF(e)) ? temas().catch(() => null) : null, ks.some((e) => e[0][0] === "s" && !ehSTF(e)) ? sumulas().catch(() => null) : null,
      ks.some((e) => e[0][0] === "t" && ehSTF(e)) ? temasRG().catch(() => null) : null, ks.some((e) => e[0][0] === "s" && ehSTF(e)) ? sumulasSTF().catch(() => null) : null]);
    const novas = []; let gravar = false;
    for (const [k, x] of ks) {
      const atual = k[0] === "t" ? (x.tp === "RG" ? rg : t)?.idx.get(`${x.tp}-${x.n}`)?.sit
        : x.trib === "stf" ? (SIT_SUM_STF[sf?.idx.get(k.slice(2))?.sit] || [])[0] : (SIT_SUM[sm?.find((y) => y.n === x.n)?.sit] || [])[0];
      if (!atual) continue;
      if (x.sitVista === undefined) { x.sitVista = atual; gravar = true; continue; }
      if (atual === x.sitVista) { if (x.mudou) { delete x.mudou; gravar = true; } continue; }
      if (!x.mudou || x.mudou.para !== atual) { x.mudou = { de: x.sitVista, para: atual, em: hojeISO() }; novas.push(k); gravar = true; }
    }
    if (gravar) salvarP();
    return { todas: Object.keys(P.salvos).filter((k) => P.salvos[k].mudou), novas };
  }
  function tituloSalvo(x, k) {
    const t = x.k || k[0];
    if (t === "a") return `${x.cl} ${fmtNumProc(x.n)}`;
    if (t === "t") return x.tp === "RG" ? `Tema ${x.n}/STF` : `${x.tp} ${x.n}`;
    if (t === "s") return x.trib === "stf" ? `${x.v ? "Súmula Vinculante" : "Súmula"} ${x.n}/STF` : `Súmula ${x.n}/STJ`;
    if (t === "j") return `Jurisprudência em Teses · ${String(x.id).replace("-", ", tese ")}`;
    if (t === "i") return x.trib === "stf" ? `Informativo STF ${x.n}${x.p ? ` · ${x.p}` : ""}` : "Nota do Informativo";
    return x.p ? String(x.p) : "Item salvo";
  }
  async function areasDoSalvo(x, k) {
    if (x.ar) return x.ar;
    const t = x.k || k[0];
    try {
      if (t === "t") return (await (x.tp === "RG" ? temasRG() : temas())).idx.get(`${x.tp}-${x.n}`)?.ar || [];
      if (t === "s" && x.trib === "stf") return (await sumulasSTF()).idx.get(`STF-${x.v ? "SV" : "S"}${x.n}`)?.ar || [];
      if (t === "i" && x.trib === "stf") return x.ar || [];
      if (t === "i") return (await informativos()).idx.get(x.id)?.ar || [];
      if (t === "j") return (await tesesJT()).idx.get(x.id)?.ar || [];
      if (t === "s") return (await sumulas()).find((y) => y.n === x.n)?.ar || [];
    } catch { /* sem dados */ }
    return [];
  }
  // Sem "novo", organiza um item já salvo. Com "novo", o item ainda não está nos salvos: só passa a
  // estar quando o usuário escolhe pasta, avaliação ou anotação, ou clica em Salvar. Voltar ou fechar
  // sem nada disso não salva.
  async function organizarSalvo(chave, novo) {
    let x = P.salvos[chave];
    if (!x) { if (!novo) return; x = { ...novo }; }
    const salvoJa = () => P.salvos[chave] === x;
    const penal = ehPenal(await areasDoSalvo(x, chave));
    abrirGaveta("Pasta e avaliação", tituloSalvo(x, chave), "");
    const corpo = $("#gaveta-corpo");
    const desenhar = () => {
      const sel = new Set(x.pastas || []);
      corpo.innerHTML = `
        <h3>Pastas</h3>
        ${pastas().length ? `<div class="chips">${pastas().map((p) => `<button type="button" class="chip" data-org-pasta="${esc(p)}" aria-pressed="${sel.has(p)}">${esc(p)}</button>`).join("")}</div>` : `<p class="nota">Nenhuma pasta ainda. Crie a primeira abaixo.</p>`}
        <form class="adicionar" id="org-nova" style="margin-top:10px"><input placeholder="Nova pasta. Ex.: Nulidade da busca domiciliar" aria-label="Nova pasta" maxlength="60"><button class="btn btn-pri" type="submit" aria-label="Criar pasta">${ico("mais1")}</button></form>
        <p class="nota">Um mesmo precedente pode ficar em mais de uma pasta.</p>
        <h3>Avaliação</h3>
        <div class="segmentos org-aval" role="radiogroup" aria-label="Avaliação">${[["", "Não avaliado"], ["fav", rotAval("fav", penal)], ["desf", rotAval("desf", penal)]].map(([v, t]) => `<button type="button" role="radio" data-org-aval="${v}" aria-checked="${(x.aval || "") === v}">${t}</button>`).join("")}</div>
        <p class="nota">${penal ? "Indique se o precedente favorece ou prejudica a tese defensiva." : "Indique se o precedente favorece ou prejudica a tese que você sustenta."} A marcação é sua e fica só neste navegador.</p>
        <h3>Anotação</h3>
        <textarea id="org-nota" rows="4" placeholder="Por que este precedente importa, em que caso usar, ressalvas…">${esc(x.nota || "")}</textarea>
        ${salvoJa() ? `<div class="acoes" style="margin-top:14px"><button type="button" class="btn btn-pri" data-org-fim>Concluir</button></div>`
          : `<p class="nota org-aviso">Este item ainda não está nos seus salvos. Ele será salvo quando você escolher uma pasta, uma avaliação ou escrever uma anotação, ou clicar em Salvar.</p>
        <div class="acoes" style="margin-top:14px"><button type="button" class="btn btn-pri" data-org-fim>Salvar</button><button type="button" class="btn btn-claro" data-org-cancelar>Cancelar</button></div>`}`;
    };
    desenhar();
    const gravar = () => { if (!salvoJa()) { if (P.salvos[chave]) return; x.salvoEm = hojeISO(); P.salvos[chave] = x; } salvarP(); avisarSalvos(); };
    const sair = () => (PILHA_G.length ? voltarGaveta() : fecharGaveta());
    corpo.onclick = (e) => {
      const bp = e.target.closest("[data-org-pasta]");
      if (bp) { const p = bp.dataset.orgPasta, l = new Set(x.pastas || []); l.has(p) ? l.delete(p) : l.add(p); x.pastas = [...l]; gravar(); desenhar(); return; }
      const ba = e.target.closest("[data-org-aval]");
      if (ba) { if (!salvoJa() && !ba.dataset.orgAval) return; x.aval = ba.dataset.orgAval || undefined; gravar(); desenhar(); return; }
      if (e.target.closest("[data-org-fim]")) { clearTimeout(organizarSalvo.t); gravar(); sair(); return; }
      if (e.target.closest("[data-org-cancelar]")) { clearTimeout(organizarSalvo.t); sair(); }
    };
    // Anotação apagada (ou só com espaços e quebras de linha) volta a não existir.
    corpo.oninput = (e) => {
      if (e.target.id !== "org-nota") return;
      const v = e.target.value.slice(0, 2000);
      if (v.trim()) x.nota = v; else delete x.nota;
      clearTimeout(organizarSalvo.t); organizarSalvo.t = setTimeout(gravar, 400);
    };
    corpo.onchange = (e) => { if (e.target.id === "org-nota") { clearTimeout(organizarSalvo.t); gravar(); } };
    corpo.onsubmit = (e) => {
      if (e.target.id !== "org-nova") return;
      e.preventDefault();
      const nome = $("input", e.target).value.trim().replace(/\s+/g, " "); if (!nome) return;
      if (!pastas().some((p) => norm(p) === norm(nome))) pastas().push(nome);
      const real = pastas().find((p) => norm(p) === norm(nome));
      x.pastas = [...new Set([...(x.pastas || []), real])]; gravar(); desenhar();
    };
  }
  // Dossiê de uma pasta (ou do filtro exibido em Salvos): documento para imprimir ou salvar em PDF,
  // com índice, ementa completa, tese, avaliação e anotação de cada item, separado por avaliação.
  async function gerarDossie(nome, lista) {
    if (!lista.length) return;
    toast("Montando o dossiê…");
    // Ementa completa dos acórdãos: busca o arquivo do mês/órgão (até 24 arquivos distintos).
    const ems = new Map(), chaves = [...new Set(lista.filter((i) => i.tp === "a" && i.x.m && i.x.o).map((i) => `${i.x.m}|${i.x.o}`))].slice(0, 24);
    await Promise.all(chaves.map(async (c) => {
      const [m, o] = c.split("|");
      try { for (const r of await shard(m, o)) ems.set(String(r.id), r); } catch { /* fica o resumo guardado */ }
    }));
    const ps = (t) => String(t || "").split(/\n+/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");
    const lk = (href, t) => `<a href="${esc(href)}">${esc(t)}</a>`;
    const ficha = (i) => {
      const x = i.x, o = i.o || {}, meta = [], corpo = [];
      let tit = tituloSalvo(x, i.k), tipo = "", link = "";
      if (i.tp === "a") {
        const r = ems.get(String(x.id)) || x; tipo = "Acórdão";
        meta.push(D.orgaos[x.o] || "", x.rel ? `Rel. ${relatorFmt(x.rel)}` : "", x.dd ? `julgado em ${fmtData(x.dd)}` : "", x.dj ? `publicado em ${fmtData(x.dj)}` : "");
        const tese = r.tese || r.tj || x.tese || x.tj;
        if (tese) corpo.push(`<div class="ds-tese"><b>${r.tese || x.tese ? "Tese jurídica" : "Tese de julgamento"}</b>${ps(tese)}</div>`);
        corpo.push(`<h4>Ementa</h4><div class="ds-texto">${ps(r.em || x.h)}</div>`);
        if (!r.em) corpo.push(`<p class="ds-obs">Resumo da ementa; a íntegra está no inteiro teor oficial.</p>`);
        link = lk(URLS.inteiroTeor(x.reg, x.dj), "Inteiro teor oficial no STJ");
      } else if (i.tp === "t") {
        tipo = x.tp === "Tema" ? "Tema repetitivo" : x.tp; meta.push(o.org || "", o.sit || "");
        if (o.q) corpo.push(`<h4>Questão submetida</h4><div class="ds-texto">${ps(o.q)}</div>`);
        if (o.tese) corpo.push(`<div class="ds-tese"><b>Tese firmada</b>${ps(o.tese)}</div>`);
        link = lk(URLS.tema(x.tp, x.n), "Página oficial do tema");
      } else if (i.tp === "s") {
        tipo = "Súmula"; meta.push(o.org || "", o.julg ? `aprovada em ${fmtData(o.julg)}` : "", o.pub ? `publicada em ${fmtData(o.pub)}` : "", o.sit && o.sit !== "vigente" ? (SIT_SUM[o.sit] || [o.sit])[0] : "");
        corpo.push(`<div class="ds-tese"><b>Enunciado</b>${ps(o.t)}</div>`);
      } else if (i.tp === "j") {
        tipo = "Jurisprudência em Teses"; meta.push(o.ed ? `edição ${o.ed}` : "", o.tit ? titJT(o.tit) : "");
        corpo.push(`<div class="ds-tese"><b>Tese</b>${ps(o.t)}</div>`);
      } else if (i.tp === "i") {
        tipo = "Informativo de Jurisprudência"; tit = o.p?.[0] ? `${o.p[0].cl} ${fmtNumProc(o.p[0].n)}` : tit;
        meta.push(o.ed ? `Informativo n. ${o.ed}` : "", o.julg ? `julgado em ${fmtData(o.julg)}` : "");
        if (o.tema) corpo.push(`<h4>Tema</h4><div class="ds-texto">${ps(o.tema)}</div>`);
        if (o.t) corpo.push(`<h4>Destaque</h4><div class="ds-texto">${ps(o.t)}</div>`);
      } else if (i.tp === "d") {
        tipo = "Acórdão publicado no DJEN"; meta.push(x.d ? `DJEN ${fmtData(x.d)}` : "", D.orgaos[x.tr] || "", x.rel ? `Rel. ${titulo(x.rel)}` : "");
        corpo.push(`<p class="ds-obs">A ementa ainda não foi divulgada pelo STJ no arquivo mensal de acórdãos.</p>`);
      } else if (i.tp === "p") {
        tipo = "Processo em pauta"; meta.push(x.d ? `sessão de ${fmtData(x.d)}` : "", D.orgaos[x.o] || "", x.rel ? `Rel. ${x.rel}` : "");
        if (x.reg) link = lk(URLS.processo(x.reg), "Consulta processual no STJ");
      }
      const penal = ehPenal(i.ar);
      const org = [x.aval ? `<p><b>Avaliação:</b> ${esc(rotAval(x.aval, penal))}</p>` : "", (x.pastas || []).length ? `<p><b>Pastas:</b> ${esc(x.pastas.join(", "))}</p>` : "", String(x.nota || "").trim() ? `<div class="ds-nota"><b>Anotação</b>${ps(x.nota)}</div>` : ""].join("");
      return `<article class="ds-item">
        <p class="ds-tipo">${esc(tipo)}</p><h3>${esc(tit)}</h3>
        ${meta.filter(Boolean).length ? `<p class="ds-meta">${esc(meta.filter(Boolean).join(" · "))}</p>` : ""}
        ${corpo.join("")}
        ${i.ref ? `<p class="ds-cit"><b>Citação:</b> ${esc(i.ref)}</p>` : ""}
        ${link ? `<p class="ds-link">${link}</p>` : ""}
        ${org ? `<div class="ds-org">${org}</div>` : ""}</article>`;
    };
    const grupos = [["fav", "Favoráveis"], ["desf", "Desfavoráveis"], ["", "Sem avaliação"]].map(([v, t]) => ({ t, its: lista.filter((i) => (i.x.aval || "") === v) })).filter((g) => g.its.length);
    const soUm = grupos.length === 1 && !grupos[0].its[0].x.aval;
    let n = 0;
    const indice = grupos.flatMap((g) => g.its.map((i) => `<tr><td>${++n}</td><td>${esc(tituloSalvo(i.x, i.k))}</td><td>${esc(i.x.aval ? rotAval(i.x.aval, ehPenal(i.ar)) : "—")}</td></tr>`)).join("");
    const cont = grupos.map((g) => `${g.t.toLowerCase()}: ${g.its.length}`).join("; ");
    let div = $("#dossie");
    if (!div) { div = document.createElement("div"); div.id = "dossie"; div.className = "dossie"; div.setAttribute("aria-hidden", "true"); document.body.appendChild(div); }
    div.innerHTML = `<header class="ds-cab"><p class="ds-sobre">Radar STJ · Dossiê de precedentes</p><h1>${esc(nome)}</h1>
        <p class="ds-meta">Gerado em ${fmtData(hojeISO())} · ${lista.length} ${lista.length === 1 ? "item" : "itens"}${soUm ? "" : ` (${esc(cont)})`}</p></header>
      <h2>Índice</h2><table class="ds-indice"><thead><tr><th>n.</th><th>Item</th><th>Avaliação</th></tr></thead><tbody>${indice}</tbody></table>
      ${grupos.map((g, gi) => `${soUm ? "" : `<h2 class="ds-grupo${gi ? " ds-quebra" : ""}">${esc(g.t)}</h2>`}${g.its.map(ficha).join("")}`).join("")}
      <p class="ds-rodape">Dados das bases públicas do STJ, reunidos pelo Radar STJ. Avaliações e anotações são do usuário. Confira o inteiro teor oficial antes de citar.</p>`;
    const tituloAntes = document.title;
    document.title = `Dossiê - ${nome}`;
    document.documentElement.classList.add("imp-dossie");
    const fim = () => { document.documentElement.classList.remove("imp-dossie"); document.title = tituloAntes; window.removeEventListener("afterprint", fim); };
    window.addEventListener("afterprint", fim);
    toast("Na janela de impressão, escolha “Salvar como PDF” para guardar o dossiê.");
    setTimeout(() => window.print(), 60);
  }
  // Cópia de segurança única: salvos, pastas, anotações, Meu radar e preferências.
  function exportarTudo() {
    const blob = new Blob([JSON.stringify({ tipo: "radar-stj-backup", versao: 2, exportadoEm: new Date().toISOString(), dados: P }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `radar-stj-copia-${hojeISO()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  // Importa somando ao que já existe (nada é apagado). Aceita também o arquivo antigo, só de salvos.
  function importarTudo(o) {
    const d = o?.tipo === "radar-stj-backup" ? o.dados : o?.tipo === "radar-stj-salvos" ? { salvos: o.salvos, pastas: o.pastas } : null;
    if (!d || typeof d.salvos !== "object" || Array.isArray(d.salvos)) throw new Error("inválido");
    if ((o.versao || 1) > 2) throw new Error("versão");
    // Estrutura mínima: listas onde se esperam listas e salvos com a chave no formato do site.
    for (const k of ["pastas", "termos", "procs", "oabs"]) if (d[k] != null && !Array.isArray(d[k])) throw new Error("inválido");
    if (Object.keys(d.salvos).some((k) => !/^[a-z]:/.test(k))) throw new Error("inválido");
    let n = 0;
    for (const [k, v] of Object.entries(d.salvos || {})) { if (!P.salvos[k]) n++; P.salvos[k] = { ...(P.salvos[k] || {}), ...v, pastas: [...new Set([...(P.salvos[k]?.pastas || []), ...(v.pastas || [])])] }; }
    for (const p of d.pastas || []) if (!pastas().includes(p)) pastas().push(p);
    let r = 0;
    for (const k of ["termos", "procs", "oabs"]) {
      const ja = new Set((P[k] || []).map((x) => JSON.stringify(x)));
      for (const x of d[k] || []) if (!ja.has(JSON.stringify(x))) { (P[k] = P[k] || []).push(x); r++; }
    }
    for (const [k, v] of Object.entries(d)) if (!["salvos", "pastas", "termos", "procs", "oabs", "vistoEm"].includes(k) && P[k] === undefined) P[k] = v;
    salvarP(); avisarSalvos(); atualizarContadorRadar();
    return { n, r };
  }
  const usoArmaz = () => { const b = Store.uso(); return b ? ` Ocupam hoje ${b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1).replace(".", ",")} MB`} (o navegador costuma reservar cerca de 5 MB por site).` : ""; };
  const TXT_COPIA = "Tudo o que você guarda no site (salvos, pastas, anotações, termos, processos e OABs do Meu radar e preferências) fica apenas neste navegador: não vai para nenhum servidor e se perde se os dados do navegador forem apagados. Exporte uma cópia para guardar ou levar a outro aparelho; ao importar, o conteúdo é somado ao que já existe.";
  function gerenciarPastas(soCopia = false) {
    abrirGaveta(soCopia ? "Meu radar e salvos" : "Salvos", soCopia ? "Cópia de segurança" : "Pastas e cópia de segurança", "");
    const corpo = $("#gaveta-corpo");
    const uso = (p) => Object.values(P.salvos).filter((x) => (x.pastas || []).includes(p)).length;
    const desenhar = () => {
      corpo.innerHTML = soCopia ? `<p class="nota">${TXT_COPIA}${usoArmaz()}</p>
        <div class="acoes"><button type="button" class="btn btn-claro btn-peq" data-salvos-exportar>${ico("arquivo")} Exportar cópia</button>
          <label class="btn btn-claro btn-peq" style="cursor:pointer">${ico("mais1")} Importar arquivo<input type="file" accept=".json,application/json" data-salvos-importar hidden></label></div>` : `${pastas().length ? `<ul class="lista-pastas">${pastas().map((p, i) => `<li><input value="${esc(p)}" data-pasta-nome="${i}" aria-label="Nome da pasta" maxlength="60"><span class="nota">${uso(p)} item(ns)</span><button type="button" class="btn-ico" data-pasta-apagar="${i}" title="Excluir pasta" aria-label="Excluir pasta">${ico("x")}</button></li>`).join("")}</ul>` : `<p class="nota">Nenhuma pasta criada.</p>`}
        <form class="adicionar" id="pasta-nova" style="margin-top:12px"><input placeholder="Nova pasta" aria-label="Nova pasta" maxlength="60"><button class="btn btn-pri" type="submit" aria-label="Criar pasta">${ico("mais1")}</button></form>
        <p class="nota">Excluir uma pasta não apaga os itens salvos; eles só deixam de estar nela. Para renomear, edite o nome e saia do campo.</p>
        <h3>Cópia de segurança</h3>
        <p class="nota">${TXT_COPIA}${usoArmaz()}</p>
        <div class="acoes"><button type="button" class="btn btn-claro btn-peq" data-salvos-exportar>${ico("arquivo")} Exportar cópia</button>
          <label class="btn btn-claro btn-peq" style="cursor:pointer">${ico("mais1")} Importar arquivo<input type="file" accept=".json,application/json" data-salvos-importar hidden></label></div>`;
    };
    desenhar();
    corpo.onclick = (e) => {
      const ap = e.target.closest("[data-pasta-apagar]");
      if (ap) { const p = pastas()[+ap.dataset.pastaApagar]; P.pastas = pastas().filter((x) => x !== p); for (const x of Object.values(P.salvos)) if (x.pastas) x.pastas = x.pastas.filter((y) => y !== p); salvarP(); avisarSalvos(); desenhar(); return; }
      if (e.target.closest("[data-salvos-exportar]")) exportarTudo();
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
        const arq = e.target.files[0];
        if (arq.size > 5 * 1024 * 1024) { toast("Arquivo grande demais para uma cópia do Radar STJ (mais de 5 MB)."); e.target.value = ""; return; }
        try {
          const { n, r } = importarTudo(JSON.parse(await arq.text()));
          desenhar(); toast(Store.falhou ? "O arquivo foi lido, mas o navegador não permitiu guardar. Veja o aviso no alto da página." : `Importado: ${n} item(ns) salvo(s) novo(s)${r ? ` e ${r} item(ns) do Meu radar` : ""}.`);
        } catch (err) { toast(err.message === "versão" ? "Esta cópia foi feita por uma versão mais nova do site; atualize a página e tente de novo." : "Arquivo inválido: use uma cópia exportada pelo Radar STJ."); }
        e.target.value = "";
      }
    };
  }

  // =============================================================== gaveta
  let focoAnterior = null;
  // Fundo inerte enquanto a gaveta (diálogo) está aberta: o foco do teclado não sai dela.
  const fundoInerte = (sim) => $$(".lateral, .conteudo, .barra-inf").forEach((el) => { el.inert = sim; if (sim) el.setAttribute("aria-hidden", "true"); else el.removeAttribute("aria-hidden"); });
  // Gaveta aberta a partir de outra (pasta e avaliação, ministro, tema citado etc.): a anterior fica
  // guardada, com o conteúdo, a rolagem e os comandos, e a seta "Voltar" a restaura.
  const PILHA_G = [];
  function abrirGaveta(sobre, titulo, html) {
    const gv = $("#gaveta"), cp = $("#gaveta-corpo");
    if (gv.hidden) focoAnterior = document.activeElement;
    if (gv.hidden || !gv.classList.contains("vis")) PILHA_G.length = 0;
    else if ($("#gaveta-sobre").textContent !== sobre || $("#gaveta-tit").textContent !== titulo) {
      const frag = document.createDocumentFragment();
      const topo = cp.scrollTop;
      while (cp.firstChild) frag.appendChild(cp.firstChild);
      PILHA_G.push({ sobre: $("#gaveta-sobre").textContent, titulo: $("#gaveta-tit").textContent, frag, topo, h: { onclick: cp.onclick, oninput: cp.oninput, onsubmit: cp.onsubmit, onchange: cp.onchange } });
      if (PILHA_G.length > 15) PILHA_G.shift();
    }
    $("#gaveta-voltar").hidden = !PILHA_G.length;
    fundoInerte(true);
    $("#gaveta-sobre").textContent = sobre; $("#gaveta-tit").textContent = titulo; $("#gaveta-corpo").innerHTML = html;
    $("#gaveta-corpo").onclick = null; $("#gaveta-corpo").oninput = null; $("#gaveta-corpo").onsubmit = null; $("#gaveta-corpo").onchange = null;
    const g = $("#gaveta"), v = $("#veu");
    g.hidden = false; v.hidden = false;
    requestAnimationFrame(() => { g.classList.add("vis"); v.classList.add("vis"); });
    $("#gaveta-corpo").scrollTop = 0;
    setTimeout(() => $("#gaveta-fechar").focus(), 50);
    document.body.style.overflow = "hidden";
  }
  function voltarGaveta() {
    const e = PILHA_G.pop(); if (!e) return;
    const cp = $("#gaveta-corpo");
    $("#gaveta-sobre").textContent = e.sobre; $("#gaveta-tit").textContent = e.titulo;
    cp.replaceChildren(e.frag);
    Object.assign(cp, e.h);
    cp.scrollTop = e.topo;
    // O item pode ter sido salvo ou removido na gaveta seguinte.
    $$("[data-salvo-chave]", cp).forEach((b) => {
      const s = !!P.salvos[b.dataset.salvoChave]; b.setAttribute("aria-pressed", String(s));
      if (b.lastChild?.nodeType === 3) b.lastChild.textContent = s ? " Salvo" : " Salvar";
    });
    $("#gaveta-voltar").hidden = !PILHA_G.length;
    (PILHA_G.length ? $("#gaveta-voltar") : $("#gaveta-fechar")).focus();
  }
  function fecharGaveta() {
    const g = $("#gaveta"), v = $("#veu");
    if (g.hidden) return;
    PILHA_G.length = 0;
    g.classList.remove("vis"); v.classList.remove("vis");
    setTimeout(() => { g.hidden = true; v.hidden = true; }, 220);
    document.body.style.overflow = "";
    fundoInerte(false);
    focoAnterior?.focus?.({ preventScroll: true });
  }

  // Citação de tema repetitivo ou controvérsia do STJ: órgão, relator do processo paradigma (quando houver) e datas.
  const refTemaSTJ = (x, procs = []) => {
    const lc = procs.find((p) => p.lc && p.rel);
    const rot = x.tp === "Tema" ? `Tema Repetitivo ${x.n}` : `${x.tp} n. ${x.n}`;
    return `(STJ, ${rot}${x.org ? `, ${x.org}` : ""}${lc ? `, rel. Min. ${nomeMin(titulo(lc.rel))}` : ""}${x.julg ? `, julgado em ${fmtDataCit(x.julg)}` : ""}${x.pub ? `, DJe de ${fmtDataCit(x.pub)}` : ""}.)`;
  };
  async function abrirTema(tp, n) {
    if (tp === "RG") return abrirTemaRG(n);
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
      .filter(([, v]) => v).map(([l, v]) => `<dt>${l}</dt><dd>${l === "Repercussão geral no STF" && comSTF() ? `<button type="button" class="link-acao" data-tema-rg="${esc(x.rg)}">${esc(v)}</button>` : esc(v)}</dd>`).join("");
    const html = `
      <div class="item-sel">${seloSit(x.sit)}${/suspens/i.test(x.info || "") && x._g === "andamento" ? `<span class="selo rel">Suspensão determinada</span>` : ""}${emPauta.length ? `<span class="selo alta">Em pauta</span>` : ""}<span class="selo">${esc(x.org || "")}</span></div>
      ${x.q ? `<h3>Questão submetida</h3><p class="texto-serif">${esc(x.q)}</p>` : ""}
      ${x.tese ? `<div class="tese"><b>Tese firmada</b>${esc(x.tese)}</div>` : ""}
      <div class="acoes" style="margin-top:14px">
        <a class="btn btn-claro btn-peq" href="${URLS.tema(tp, n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>
        <a class="btn btn-claro btn-peq" href="#pesquisa?q=tema:${n}&p=u12&r=0" data-fechar>Acórdãos que citam</a>
        <button type="button" class="btn btn-claro btn-peq" id="g-radar">${ico("radar")} Acompanhar</button>
        ${x.tese ? `<button type="button" class="btn btn-claro btn-peq" id="g-cit">${ico("copiar")} Copiar tese e citação</button>` : ""}
        <button type="button" class="btn btn-claro btn-peq" id="g-socit">${ico("citar")} Copiar só a citação</button>
        <button type="button" class="btn btn-claro btn-peq btn-salvar" id="g-salvar" data-salvo-chave="t:${esc(tp)}-${esc(n)}" aria-pressed="${salvo}">${ico("salvar")} ${salvo ? "Salvo" : "Salvar"}</button>
      </div>
      <h3>Linha do tempo</h3>
      ${marcos.length ? `<ol class="tl">${marcos.map((m) => `<li class="${m.cls}"><div class="d">${fmtData(m.d)}${m.d > hojeISO() ? " (futuro)" : ""}</div><div class="t">${esc(m.t)}</div></li>`).join("")}</ol>` : `<p class="nota">Sem datas registradas.</p>`}
      ${procs.length ? `<h3>Processos vinculados (${procs.length})</h3><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Processo</th><th>Origem</th><th>Relator(a)</th></tr></thead><tbody>
        ${procs.slice(0, 40).map((p) => `<tr><td class="num">${esc(p.p)}${p.lc ? ` <span class="selo pri">Leading case</span>` : ""}</td><td>${esc(p.trib || "")}${p.uf ? ` · ${esc(p.uf)}` : ""}</td><td>${esc(titulo(p.rel || ""))}</td></tr>`).join("")}
      </tbody></table></div>` : ""}
      ${det ? `<h3>Mais informações</h3><dl class="dl">${det}</dl>` : ""}`;
    abrirGaveta(`${tp === "Tema" ? "Tema repetitivo" : tp} · ${x.org || "STJ"}`, `${tp} ${n}`, html);
    $("#g-radar").addEventListener("click", () => { adicionarTermo(tp === "Tema" ? `tema ${n}` : String(n)); });
    $("#g-cit")?.addEventListener("click", () => copiar(`${teseParaPeca(x.tese)}\n${refTemaSTJ(x, procs)}`, "Tese e citação copiadas."));
    $("#g-socit").addEventListener("click", () => copiar(refTemaSTJ(x, procs), "Citação copiada."));
    $("[data-tema-rg]", $("#gaveta-corpo"))?.addEventListener("click", (e) => abrirTemaRG(+e.currentTarget.dataset.temaRg));
    $("#g-salvar").addEventListener("click", (e) => { alternarSalvo(`t:${tp}-${n}`, { k: "t", tp, n }, e.currentTarget); e.currentTarget.lastChild.textContent = P.salvos[`t:${tp}-${n}`] ? " Salvo" : " Salvar"; });
    $$("[data-fechar]", $("#gaveta-corpo")).forEach((a) => a.addEventListener("click", fecharGaveta));
  }
  // Citação de tema de repercussão geral: tema, leading case, relator (quando for ministro) e data da tese.
  // Tese com itens numerados ("1) ... 2) ..."): cada item numa linha própria, para colar na peça.
  const teseParaPeca = (t) => { const x = String(t || "").trim(); return /^1[.)]\s*\S/.test(x) ? x.replace(/(?<=[.;:)\]])\s*(?=[2-9][.)]\s*\p{Lu})/gu, "\n") : x; };
  const refTemaRG = (x) => {
    const rel = x.rel && !/^Presid/i.test(x.rel) ? `, rel. Min. ${nomeMin(x.rel)}` : "";
    const quando = x.tese && x.dtese ? `, tese fixada em ${fmtDataCit(x.dtese)}` : "";
    return `(STF, Tema ${x.n} da repercussão geral${x.lc ? `, ${x.lc}` : ""}${rel}${quando}.)`;
  };
  async function abrirTemaRG(n) {
    const l = await temasRG().catch(() => null);
    const x = l?.idx.get(`RG-${n}`); if (!x) return toast(`Tema ${n} de repercussão geral não encontrado.`);
    // Relações com o STJ (temas repetitivos que remetem a este tema) e súmulas do STF que o citam.
    const [stj, sms] = await Promise.all([comSTJ() || D.cache.temas ? temas().catch(() => null) : null, sumulasSTF().catch(() => [])]);
    const noSTJ = stj ? stj.filter((t) => String(t.rg || "") === String(n)) : [];
    const sumRel = sms.filter((s) => (s.rg || []).includes(n));
    const marcos = [];
    if (x.rgd) marcos.push({ d: x.rgd, cls: x.rgs === "nao" ? "" : "julg", t: x.rgs === "nao" ? "Repercussão geral negada" : x.reaf ? "Repercussão geral reconhecida, com reafirmação da jurisprudência" : "Repercussão geral reconhecida" });
    if (x.dtese) marcos.push({ d: x.dtese, cls: "pub", t: "Tese fixada" });
    for (const h of l.hist.filter((h) => h.n === n)) marcos.push({ d: h.d, cls: "mud", t: h.ev === "situacao" ? `Situação no STF: ${h.de} → ${h.para}` : h.ev === "rg" ? `Repercussão geral: ${h.de} → ${h.para}` : h.ev === "novo" ? "Incluído na base" : "Tese registrada/alterada" });
    if (x.sitd && x.sitOrig) marcos.push({ d: x.sitd, cls: "", t: x.sitOrig });
    const pt = D.man?.stf?.pauta ? await pautaSTF() : null;
    for (const s0 of (pt?.temas || []).filter((s0) => s0.tema === n)) marcos.push({ d: s0.ini, cls: s0.ini >= hojeISO() ? "pauta futuro" : "pauta", t: `Em pauta: ${s0.cl} ${s0.num} · ${ORG_STF[s0.o] || s0.o}, sessão ${s0.amb}${s0.fim !== s0.ini ? ` até ${fmtData(s0.fim)}` : ""}` });
    marcos.sort((a, b) => a.d.localeCompare(b.d));
    const chave = `t:RG-${n}`, salvo = !!P.salvos[chave];
    const det = [["Situação no STF", x.sitOrig ? `${x.sitOrig}${x.sitd ? ` (${fmtData(x.sitd)})` : ""}` : ""], ["Repercussão geral", x.rgt], ["Relator(a) da manifestação", x.rel], ["Assuntos", x.ass]]
      .filter(([, v]) => v).map(([r, v]) => `<dt>${r}</dt><dd>${esc(v)}</dd>`).join("");
    abrirGaveta(`Repercussão geral · STF${x.lc ? " · " + x.lc : ""}`, `Tema ${n}`, `
      <div class="item-sel">${seloSit(x.sit)}${x.reaf ? `<span class="selo">Reafirmação de jurisprudência</span>` : ""}${seloMat(x.ar, x.sa)}</div>
      ${x.q ? `<h3>Título</h3><p class="texto-serif">${esc(x.q)}</p>` : ""}
      ${x.tese ? `<div class="tese"><b>Tese fixada</b>${esc(x.tese)}</div>` : x.dtese ? `<p class="nota">Julgado em ${fmtData(x.dtese)}; a tese ainda não aparece na página oficial do STF.</p>` : x.rgs === "sim" ? `<p class="nota">Repercussão geral reconhecida; o mérito ainda não foi julgado.</p>` : ""}
      ${x.desc ? `<h3>Descrição</h3><p class="texto-serif">${esc(x.desc)}</p>` : ""}
      <div class="acoes" style="margin-top:14px">
        <a class="btn btn-claro btn-peq" href="${URL_STF.tema(n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>
        ${x.inc && x.lc ? `<a class="btn btn-claro btn-peq" href="${URL_STF.processo(x.inc)}" target="_blank" rel="noopener">Leading case: ${esc(x.lc)} ${ico("externo")}</a>` : ""}
        ${x.tese ? `<button type="button" class="btn btn-claro btn-peq" id="grg-copiar">${ico("copiar")} Copiar tese e citação</button>` : ""}
        <button type="button" class="btn btn-claro btn-peq" id="grg-socit">${ico("citar")} Copiar só a citação</button>
        <button type="button" class="btn btn-claro btn-peq btn-salvar" id="grg-salvar" data-salvo-chave="${chave}" aria-pressed="${salvo}">${ico("salvar")} ${salvo ? "Salvo" : "Salvar"}</button>
      </div>
      <h3>Linha do tempo</h3>
      ${marcos.length ? `<ol class="tl">${marcos.map((m) => `<li class="${m.cls}"><div class="d">${fmtData(m.d)}</div><div class="t">${esc(m.t)}</div></li>`).join("")}</ol>` : `<p class="nota">Sem datas registradas.</p>`}
      ${noSTJ.length ? `<h3>No STJ</h3><div class="lista-rel">${noSTJ.map((t) => `<p><button type="button" class="link-acao" data-tema-direto="${esc(t.tp)}|${t.n}">${esc(t.tp)} ${t.n}/STJ</button> · ${esc(t.sit)}</p>`).join("")}</div>` : ""}
      ${sumRel.length ? `<h3>Súmulas relacionadas</h3><div class="lista-rel">${sumRel.map((s) => `<p><button type="button" class="link-acao" data-sum-stf="${esc(s._k)}">${esc(s._rot)}/STF</button>${s._canc ? ` · ${esc(s.sit)}` : ""}</p>`).join("")}</div>` : ""}
      ${det ? `<h3>Mais informações</h3><dl class="dl">${det}</dl>` : ""}
      <p class="nota" style="margin-top:14px">Dados da lista oficial de temas de repercussão geral do STF.</p>`);
    $("#grg-copiar")?.addEventListener("click", () => copiar(`${teseParaPeca(x.tese)}\n${refTemaRG(x)}`, "Tese e citação copiadas."));
    $("#grg-socit").addEventListener("click", () => copiar(refTemaRG(x), "Citação copiada."));
    $("#grg-salvar").addEventListener("click", (e) => { alternarSalvo(chave, { k: "t", tp: "RG", n }, e.currentTarget); e.currentTarget.lastChild.textContent = P.salvos[chave] ? " Salvo" : " Salvar"; });
    $$("[data-tema-direto]", $("#gaveta-corpo")).forEach((b) => b.addEventListener("click", () => { const [tp, nn] = b.dataset.temaDireto.split("|"); abrirTema(tp, +nn); }));
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
        <button type="button" class="btn btn-claro btn-peq" id="gs-salvar" data-salvo-chave="s:${x.n}" aria-pressed="${!!P.salvos[`s:${x.n}`]}">${ico("salvar")} ${P.salvos[`s:${x.n}`] ? "Salvo" : "Salvar"}</button>
        <button type="button" class="btn btn-claro btn-peq" id="gs-copiar">${ico("copiar")} Copiar</button>
        <a class="btn btn-claro btn-peq" href="#pesquisa?q=sumula:${x.n}&p=u3" data-fechar>Acórdãos recentes que aplicam</a>
        <a class="btn btn-claro btn-peq" href="${URL_SUMULA(x.n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>
      </div>`);
    $("#gs-copiar").addEventListener("click", () => copiar(`Súmula ${x.n}/STJ: "${x.t}"`, "Súmula copiada."));
    $("#gs-salvar").addEventListener("click", (e) => { alternarSalvo(`s:${x.n}`, { k: "s", n: x.n }, e.currentTarget); e.currentTarget.lastChild.textContent = P.salvos[`s:${x.n}`] ? " Salvo" : " Salvar"; });
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
      <div class="item-cab">${seloTrib(t.trib || "stj")}<button type="button" class="item-tit item-abrir" data-abrir-tema>${esc(rotTema(t))}</button>${seloSit(t.sit)}${extra}
        <span class="meta"><span>${esc(t.tp === "RG" ? `Repercussão geral${t.lc ? " · " + t.lc : ""}` : t.org || "—")}</span>${t._mov ? `<span>Últ. mov. ${fmtData(t._mov)}</span>` : ""}</span></div>
      ${areas ? `<div class="item-sel">${areas}</div>` : ""}
      ${t.tese ? `<div class="tese compacta"><b>${t.tp === "RG" ? "Tese fixada" : "Tese firmada"}</b><p>${destacar(esc(t.tese), termos)}</p></div>` : t._teseAguarda ? `<p class="nota">Julgado; tese aguardando a publicação do acórdão.</p>` : ""}
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
    julgtema: { rot: "Julgado, tese a publicar", selo: "Julgado · tese a publicar", longo: "Tema julgado, tese ainda não publicada", cls: "acomp", peso: 88 },
    afetacao: { rot: "Tema afetado", selo: "Tema afetado", longo: "Novo tema afetado", cls: "rel", peso: 75 },
    pauta: { rot: "Em pauta", selo: "Vai a julgamento", longo: "Repetitivo em pauta", cls: "alta", peso: 70 },
    publicado: { rot: "Acórdão publicado", selo: "Acórdão publicado", longo: "Acórdão de repetitivo publicado", cls: "acomp", peso: 55 },
    informativo: { rot: "Informativo do STJ", selo: "Informativo", longo: "Destaques do Informativo do STJ", cls: "info", peso: 62 },
    julgado: { rot: "Julgados", selo: "Julgado", longo: "Julgados das Turmas e Seções", cls: "pri", peso: 40 },
    // STF
    stftese: { rot: "Tese do STF", selo: "Tese firmada · STF", longo: "Tese fixada pelo STF em repercussão geral", cls: "ok", peso: 100 },
    stfjulg: { rot: "Julgado, tese a publicar", selo: "Julgado · STF", longo: "Tema do STF julgado, tese ainda não publicada", cls: "acomp", peso: 86 },
    stfrg: { rot: "Repercussão geral", selo: "Repercussão geral", longo: "Repercussão geral reconhecida pelo STF", cls: "rel", peso: 74 },
    stfsum: { rot: "Súmula do STF", selo: "Súmula · STF", longo: "Súmula ou súmula vinculante nova ou alterada", cls: "alta", peso: 80 },
    sinfo: { rot: "Informativo do STF", selo: "Informativo STF", longo: "Destaques do Informativo do STF", cls: "info", peso: 62 },
    stfpauta: { rot: "Tema do STF em pauta", selo: "Em pauta · STF", longo: "Tema de repercussão geral pautado para julgamento", cls: "alta", peso: 84 },
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
    const [t, ds, pl, inf] = comSTJ() ? await Promise.all([temas(), feedJulgados(), pautas(), informativos().catch(() => [])]) : [Object.assign([], { idx: new Map() }), [], [], []];
    const hoje = hojeISO(), desde = somaDias(hoje, -45);
    const itens = [];
    const idade = (d) => Math.abs((new Date(hoje) - new Date(d)) / 864e5);
    const deTema = (x, extra) => ({ t: x, ar: x.ar || [], sa: x.sa || [], org: x.org || "", tese: !!x.tese, _n: norm(`${x.q || ""} ${x.tese || ""} ${x.ass || ""}`), ...extra });
    for (const x of t) {
      // Tema julgado com a tese ainda por publicar não é "tese firmada": fica num tipo próprio.
      if (x.julg >= desde && x.tese) itens.push(deTema(x, { k: `tese:${x.tp}-${x.n}`, tipo: "tese", d: x.julg }));
      else if (x.julg >= desde && x._teseAguarda) itens.push(deTema(x, { k: `tese:${x.tp}-${x.n}`, tipo: "julgtema", d: x.julg }));
      else if (x.pub >= desde && x.tese) itens.push(deTema(x, { k: `pub:${x.tp}-${x.n}`, tipo: "publicado", d: x.pub }));
      if (x.afet >= desde && x.q) itens.push(deTema(x, { k: `afet:${x.tp}-${x.n}`, tipo: "afetacao", d: x.afet, tese: false }));
    }
    const lim = somaDias(hoje, 21);
    const vistosP = new Set();
    for (const p of pl) {
      if (!p.temas?.length || p.d > lim || p.d < hoje) continue;
      // Processo ligado a um tema e a uma controvérsia: basta o cartão do tema.
      const alvos = p.temas.some(([tp]) => tp === "Tema") ? p.temas.filter(([tp]) => tp === "Tema") : p.temas;
      for (const [tp, n] of alvos) {
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
    if (comSTF()) {
      const [rgs, sfs, infs, pt] = await Promise.all([temasRG().catch(() => []), sumulasSTF().catch(() => []), informativosSTF().catch(() => []), D.man?.stf?.pauta ? pautaSTF() : null]);
      // Temas sem tese pautados (sessão em curso ou futura): o aviso aparece desde a coleta que achou a pauta.
      for (const p0 of (pt?.temas || []).filter((p0) => p0.fim >= hoje)) {
        const x = rgs.idx?.get(`RG-${p0.tema}`); if (!x) continue;
        itens.push({ rg: x, pt: p0, k: `stfpauta:${p0.tema}:${p0.ini}`, tipo: "stfpauta", d: p0.ini < hoje ? p0.ini : (pt.conferido || hoje), ar: x.ar || [], sa: x.sa || [], org: ORG_STF[p0.o] || "Plenário", rel: x.rel || "", tese: false, _n: x._n });
      }
      for (const x of rgs) {
        const base = { rg: x, ar: x.ar || [], sa: x.sa || [], org: "Repercussão geral", rel: x.rel || "", _n: x._n };
        if (x.dtese >= desde && x.tese) itens.push({ ...base, k: `stftese:${x.n}`, tipo: "stftese", d: x.dtese, tese: true });
        else if (x.dtese >= desde) itens.push({ ...base, k: `stfjulg:${x.n}`, tipo: "stfjulg", d: x.dtese, tese: false });
        else if (x.rgd >= desde && x.rgs !== "nao" && x.q) itens.push({ ...base, k: `stfrg:${x.n}`, tipo: "stfrg", d: x.rgd, tese: false });
      }
      for (const x of sfs) {
        if (x._canc || !x.data || x.data < desde) continue;
        itens.push({ sm: x, k: `stfsum:${x._k}`, tipo: "stfsum", d: x.data, ar: x.ar || [], sa: x.sa || [], org: "Plenário do STF", rel: "", tese: true, _n: x._n });
      }
      for (const x of infs) {
        if (!x.d || x.d < somaDias(hoje, -70)) continue;
        itens.push({ si: x, k: `sinfo:${x.id}`, tipo: "sinfo", d: x.d, ar: x.ar || [], sa: x.sa || [], org: x.o || "", rel: x.rel ? nomeMin(x.rel) : "", tese: !!(x.ts || []).length, _n: x._n });
      }
    }
    // Termos do "Meu radar" viram prioridade na fila.
    const radar = (P.termos || []).map((termo) => ({ termo, tm: /^tema\s*:?\s*(\d+)$/i.exec(termo.trim()), c: /^tema\s*:?\s*\d+$/i.test(termo.trim()) ? null : Busca.compilar(termo) })).filter((x) => x.tm || (x.c && !x.c.vazio && !x.c.erro));
    const pw = pesos();
    for (const it of itens) {
      const hit = radar.find((q) => (q.tm ? (it.t || it.rg) && (it.t || it.rg).n === +q.tm[1] : q.c.testa(it._n)));
      if (hit) it.radar = hit.termo;
      const gosto = it.ar.length ? Math.max(...it.ar.map((a) => pw[a] || 0)) : 0;
      it.gosto = gosto;
      it.p0 = FEED_TIPOS[it.tipo].peso + (it.inf && /repetitiv|corte especial|se[çc][ãa]o/i.test(it.org) ? 8 : 0) + (it.r ? Math.min(it.r.fs ?? it.r.s ?? 0, 20) + (it.tese ? 4 : 0) : 0)
        + (it.tipo === "pauta" ? 20 - idade(it.d) : -idade(it.d) * 0.9) + gosto * 3 + (hit ? 18 : 0);
    }
    itens.sort((a, b) => b.p0 - a.p0);
    // Intercala tipos para o ritmo da leitura não ficar monótono.
    const filas = {}; itens.forEach((i) => (filas[i.tipo] = filas[i.tipo] || []).push(i));
    const ordem = ["tese", "stftese", "stfpauta", "informativo", "sinfo", "julgado", "stfsum", "julgtema", "stfjulg", "afetacao", "stfrg", "informativo", "sinfo", "julgado", "pauta", "informativo", "sinfo", "julgado", "publicado", "informativo", "sinfo", "julgado"];
    const out = []; let vazias = 0, j = 0, ultArea = "";
    const tirar = (f, tipo) => {
      // Entre julgados, evita duas matérias iguais seguidas quando há alternativa próxima.
      if (tipo !== "julgado" && tipo !== "informativo" && tipo !== "sinfo") return f.shift();
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
    { id: "rep", rot: "Repetitivos em dia", ico: "repetitivos", niveis: [10, 40, 100, 250, 500], valor: () => ["tese", "julgtema", "afetacao", "publicado", "pauta"].reduce((a, k) => a + (hab().tipos[k] || 0), 0), desc: (n) => `${fmtInt(n)} teses firmadas, temas afetados e pautas de repetitivos` },
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
    if (it.si) {
      const x = it.si, cor = (x._res || "").length > 760 ? `${x._res.slice(0, 757).replace(/\s+\S*$/, "")}…` : x._res;
      kicker = `<span class="reel-assunto">${esc(x.t)}</span>`;
      rotTexto = (x.ts || []).length ? "O STF fixou a tese" : "O STF decidiu";
      principal = (x.ts || []).length ? x.ts.map((z) => esc(z)).join("<br>") : esc(cor);
      marcar = true;
      meta = `${x.p ? `${esc(x.p.length > 80 ? `${x.p.slice(0, 77)}…` : x.p)} · ` : ""}${esc(x.o)}${x.rel ? ` · Min. ${esc(nomeMin(x.rel))}` : ""} · Informativo ${x.n}`;
      acoes = `<button type="button" class="btn btn-claro btn-peq" data-f="infostf">${ico("arquivo")} Ler o resumo</button>
        <a class="btn btn-claro btn-peq so-largo" href="${URL_INFO_STF(x.n)}" target="_blank" rel="noopener">Informativo oficial ${ico("externo")}</a>`;
    } else if (it.rg) {
      const x = it.rg;
      kicker = `Tema ${x.n} · Repercussão geral${x.lc ? ` · ${esc(x.lc)}` : ""}`;
      if (it.tipo === "stftese") { rotTexto = "O STF fixou"; principal = limparTese(x.tese); marcar = true; apoio = x.q ? `<b>Questão:</b> ${esc(x.q)}` : ""; meta = `Tese fixada em ${fmtData(x.dtese)}${x.rel ? ` · ${esc(x.rel)}` : ""}`; }
      else if (it.tipo === "stfpauta") { const p0 = it.pt; rotTexto = p0.ini <= hojeISO() ? "Em julgamento no STF" : "Vai a julgamento no STF"; principal = esc(x.q); apoio = `<b>${esc(ORG_STF[p0.o] || p0.o)}, sessão ${esc(p0.amb)}:</b> ${periodoSTF(p0.ini, p0.fim)}. Paradigma: ${esc(p0.cl)} ${esc(p0.num)}.`; meta = `Pauta conferida em ${fmtData(D.man?.stf?.pauta?.em || "")}${x.rel ? ` · ${esc(x.rel)}` : ""}`; }
      else if (it.tipo === "stfjulg") { rotTexto = "Tema julgado"; principal = `Julgado em ${fmtData(x.dtese)}. A tese será divulgada com a publicação do acórdão.`; apoio = x.q ? `<b>Questão:</b> ${esc(x.q)}` : ""; meta = x.rel ? esc(x.rel) : ""; }
      else { rotTexto = "O STF vai decidir"; principal = esc(x.q); apoio = /suspens/i.test(x.info || "") ? `<b>Atenção:</b> há determinação de suspensão de processos sobre a matéria.` : ""; meta = `Repercussão geral reconhecida em ${fmtData(x.rgd)}${x.rel ? ` · ${esc(x.rel)}` : ""}`; }
      acoes = `<button type="button" class="btn btn-claro btn-peq" data-f="temarg">${ico("repetitivos")} Ver o tema</button>
        <a class="btn btn-claro btn-peq so-largo" href="${URL_STF.tema(x.n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>`;
    } else if (it.sm) {
      const x = it.sm;
      kicker = `${esc(x._rot)} · STF`;
      rotTexto = x.v ? "O STF aprovou, com efeito vinculante" : "O STF editou";
      principal = esc(x.t);
      marcar = true;
      meta = `${x.datat ? esc(x.datat.charAt(0).toUpperCase() + x.datat.slice(1)) : "Data"} em ${fmtData(x.data)}`;
      acoes = `<button type="button" class="btn btn-claro btn-peq" data-f="sumstf">${ico("sumulas")} Ver o enunciado</button>
        <a class="btn btn-claro btn-peq so-largo" href="${URL_STF.sumula(x)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>`;
    } else if (it.inf) {
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
      if (it.tipo === "tese" || it.tipo === "publicado" || it.tipo === "julgtema") {
        rotTexto = x.tese ? "O STJ fixou" : "Tema julgado";
        principal = x.tese ? esc(x.tese) : `Julgado em ${fmtData(x.julg)}. A tese será divulgada com a publicação do acórdão.`;
        marcar = !!x.tese;
        apoio = x.q ? `<b>Questão:</b> ${esc(x.q)}` : "";
        meta = it.tipo === "publicado" ? `Acórdão publicado em ${fmtData(x.pub)}` : `Julgado em ${fmtData(x.julg)}`;
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
    const salvoK = it.si ? chaveInfoSTF(it.si) : it.rg ? `t:RG-${it.rg.n}` : it.sm ? `s:${it.sm._k}` : it.inf ? `i:${it.inf.id}` : it.t ? `t:${it.t.tp}-${it.t.n}` : `a:${it.r.id}`;
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
            ${it.si || it.rg || it.sm || it.inf || it.t || citavel(it.r) ? `<button type="button" class="btn-ico so-largo" data-f="citacao" title="Copiar só a citação" aria-label="Copiar só a citação">${ico("citar")}</button>` : ""}
            <button type="button" class="btn-ico so-largo" data-f="copiar" title="Copiar tese e citação" aria-label="Copiar tese e citação">${ico("copiar")}</button>
            <button type="button" class="btn-ico" data-f="compartilhar" title="Compartilhar" aria-label="Compartilhar">${ico("link")}</button>
            ${`<button type="button" class="btn-ico btn-salvar" data-f="salvar" aria-pressed="${salvo}" title="Salvar (ou toque duas vezes no cartão)" aria-label="Salvar">${ico("salvar")}</button>`}
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
      [["tese", "publicado"], "teses firmadas", "ok"], [["julgtema"], "temas julgados, tese a publicar", "acomp"], [["afetacao"], "temas afetados", "rel"],
      [["pauta"], "repetitivos em pauta", "alta"], [["informativo"], "destaques do Informativo", "info"], [["julgado"], "julgados relevantes", "pri"],
      [["stftese"], "teses do STF", "ok"], [["stfjulg"], "temas do STF julgados, tese a publicar", "acomp"], [["stfrg"], "repercussões gerais reconhecidas", "rel"],
      [["stfpauta"], "temas do STF em pauta", "alta"], [["stfsum"], "súmulas do STF", "alta"], [["sinfo"], "destaques do Informativo do STF", "info"],
    ].map(([tps, rot, cls]) => ({ tps, rot, cls, n: por(tps) })).filter((b) => b.n);
    const contA = {}; vis.forEach((x) => { if (!lidos()[x.k]) x.ar.forEach((a) => (contA[a] = (contA[a] || 0) + 1)); });
    const top = Object.entries(contA).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const at = D.man?.atualizadoEm ? new Date(D.man.atualizadoEm) : null;
    return `<article class="reel reel-capa" data-i="-1"><div class="reel-in">
      <p class="reel-kicker">${esc(fmtDiaL(hojeISO()))}${at ? ` · base atualizada às ${at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
      <h2 class="capa-tit">${saudacao()}. ${!naoLidos ? "Você está em dia." : (() => { const jul = por(["julgado", "informativo", "sinfo"]), rep = naoLidos - jul;
        const partes = [rep ? `<b>${fmtInt(rep)}</b> movimento${rep > 1 ? "s" : ""} em ${comSTJ() && comSTF() ? "precedentes e súmulas" : comSTF() ? "repercussão geral e súmulas" : "repetitivos"}` : "", jul ? `<b>${fmtInt(jul)}</b> ${comSTF() && !comSTJ() ? "julgado" : "tese"}${jul > 1 ? "s" : ""} ${comSTF() && !comSTJ() ? "de destaque" : "de julgados"} para ler` : ""].filter(Boolean);
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
  // Termos do Supremo explicados em poucas linhas, para as telas do STF.
  const COBERTURA_INFO_STF = "A cobertura vai da edição nº 1 (agosto de 1995) à mais recente. A partir de 2021 o Informativo traz os campos estruturados (ramo do direito, tese fixada, relator); nas edições anteriores os resumos são narrativos e mais curtos, e a identificação do processo e do relator foi extraída do próprio texto, de forma automática. Confira sempre na edição oficial.";
  const TERMOS_STF = {
    rg: ["Repercussão geral", "Requisito para o Supremo julgar um recurso extraordinário: a questão constitucional precisa ser relevante do ponto de vista econômico, político, social ou jurídico e ir além do interesse das partes (CF, art. 102, § 3º; CPC, arts. 1.035 a 1.041). Quando o Plenário a reconhece e julga o mérito, a decisão vale para todos os casos iguais."],
    tema: ["Tema", "Número de ordem que o STF dá a cada questão de repercussão geral (“Tema 69”, por exemplo). É por esse número que a questão é citada nos processos."],
    lc: ["Leading case", "O processo escolhido para julgar a questão que se repete, também chamado de paradigma. O que for decidido nele orienta os demais casos."],
    tese: ["Tese", "O enunciado que resume o que o Plenário decidiu em um tema. É a parte que os juízes e tribunais devem aplicar aos casos semelhantes."],
    susp: ["Suspensão nacional", "Ao reconhecer a repercussão geral, o relator pode determinar a suspensão dos processos que tratam da mesma questão no país, até o STF decidir (CPC, art. 1.035, § 5º)."],
    sumula: ["Súmula", "Enunciado curto que resume o entendimento que o Tribunal firmou, de forma reiterada, sobre determinada matéria. As súmulas do STF em matéria constitucional devem ser observadas por juízes e tribunais (CPC, art. 927, IV), mas o seu descumprimento, por si só, não autoriza reclamação."],
    sv: ["Súmula vinculante", "Súmula aprovada por dois terços dos ministros (oito dos onze) depois de decisões reiteradas em matéria constitucional (CF, art. 103-A). Tem efeito vinculante: obriga todos os órgãos do Judiciário e a administração pública direta e indireta, em todas as esferas. Se for descumprida, cabe reclamação ao STF."],
    rcl: ["Reclamação", "Ação dirigida ao STF contra decisão ou ato que descumpre súmula vinculante ou decisão do próprio Tribunal, ou que usurpa a sua competência (CF, art. 102, I, l)."],
    plen: ["Plenário e Turmas", "O STF tem onze ministros. O Plenário reúne todos eles. As duas Turmas têm cinco ministros cada, e o Presidente do Tribunal não integra nenhuma. As ações de controle de constitucionalidade são, em regra, julgadas pelo Plenário."],
    virt: ["Plenário Virtual", "Sessão de julgamento feita em ambiente eletrônico, em que os ministros depositam seus votos ao longo de alguns dias, sem reunião presencial."],
    rel: ["Relator e redator", "Relator é o ministro responsável pelo processo e que apresenta o voto inicial. Se a maioria seguir outro voto, o ministro que o redige é o redator do acórdão."],
    siglas: ["Siglas comuns", "ADI: ação direta de inconstitucionalidade. ADC: ação declaratória de constitucionalidade. ADPF: arguição de descumprimento de preceito fundamental. RE: recurso extraordinário. ARE: agravo em recurso extraordinário. HC: habeas corpus. Rcl: reclamação. AgR: agravo regimental. ED: embargos de declaração. MC: medida cautelar."],
    cc: ["Controle concentrado", "Julgamento, pelo STF, da validade de uma lei ou ato normativo em abstrato, sem um caso concreto específico (ADI, ADC e ADPF). A decisão, em regra, vale para todos."],
  };
  const glossarioSTF = (...ks) => `<h3>Entenda os termos</h3><ul class="lista-ajuda">${ks.map((k) => `<li><b>${TERMOS_STF[k][0]}.</b> ${TERMOS_STF[k][1]}</li>`).join("")}</ul>`;
  const AJUDA_VIEW = {
    painel: () => trib() === "stf" ? ajuda("O que é a Visão geral do STF", `
      <p class="texto-serif">Resumo do STF: as movimentações recentes dos temas de repercussão geral, os temas com mérito pendente e as súmulas vinculantes.</p>
      <ul class="lista-ajuda"><li>O campo de busca aceita assunto ou “tema 69” e leva à Repercussão geral.</li><li>Para trocar de tribunal, toque no nome do site, no alto do menu.</li><li>Cada bloco leva à página correspondente: Repercussão geral, Súmulas, Informativo e Composição.</li></ul>${glossarioSTF("rg", "tema", "tese", "sv")}`) : ajuda("O que é a Visão geral", `
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
        <p>Para o Informativo oficial, que é a curadoria do próprio Tribunal, use a outra aba. Para períodos anteriores, use a Pesquisa.</p>
        <h3>O que significam as marcas dos julgados</h3>
      <ul class="lista-ajuda">
        <li><span class="selo alta">Sinal forte de relevância</span> O site pontua cada acórdão (órgão julgador, tese registrada, afetação, menção a mudança de entendimento etc.). Com 10 pontos ou mais, o julgado recebe este selo. É uma sugestão de leitura, não a força vinculante do precedente; o cursor sobre o selo mostra os pontos.</li>
        <li><span class="selo pri">Afetação ao rito repetitivo</span> O STJ vai firmar uma tese para todos os casos iguais; os processos sobre o tema podem ficar suspensos.</li>
        <li><span class="selo ok">Firmou a tese · Tema N</span> Acórdão do próprio julgamento do tema repetitivo: é o precedente que fixou a tese (art. 927, III, do CPC).</li>
        <li><span class="selo pri">Processo vinculado · Tema N</span> O processo consta da lista oficial do tema, mas o acórdão é outro (por exemplo, embargos de declaração ou julgamento anterior à afetação).</li>
        <li><span class="nota">Cita Tema N</span> Na linha abaixo da ementa: o julgado apenas menciona o tema, sem integrá-lo.</li>
        <li>Na página do julgado, “A ementa menciona” indica, pelas palavras da ementa, <b>distinção</b> (distinguishing: o precedente não se aplica porque os fatos são diferentes), <b>divergência</b> (dissídio entre tribunais ou órgãos, muitas vezes só para dizer que não foi demonstrado), <b>mudança de entendimento</b> (overruling), <b>questão nova</b> e <b>modulação de efeitos</b>.</li>
      </ul>${COMO_BUSCAR()}`)
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
      </ul>
      <h3>O que significam as marcas dos julgados</h3>
      <ul class="lista-ajuda">
        <li><span class="selo alta">Sinal forte de relevância</span> O site pontua cada acórdão (órgão julgador, tese registrada, afetação, menção a mudança de entendimento etc.). Com 10 pontos ou mais, o julgado recebe este selo. É uma sugestão de leitura, não a força vinculante do precedente; o cursor sobre o selo mostra os pontos.</li>
        <li><span class="selo pri">Afetação ao rito repetitivo</span> O STJ vai firmar uma tese para todos os casos iguais; os processos sobre o tema podem ficar suspensos.</li>
        <li><span class="selo ok">Firmou a tese · Tema N</span> Acórdão do próprio julgamento do tema repetitivo: é o precedente que fixou a tese (art. 927, III, do CPC).</li>
        <li><span class="selo pri">Processo vinculado · Tema N</span> O processo consta da lista oficial do tema, mas o acórdão é outro (por exemplo, embargos de declaração ou julgamento anterior à afetação).</li>
        <li><span class="nota">Cita Tema N</span> Na linha abaixo da ementa: o julgado apenas menciona o tema, sem integrá-lo.</li>
        <li>Na página do julgado, “A ementa menciona” indica, pelas palavras da ementa, <b>distinção</b> (distinguishing: o precedente não se aplica porque os fatos são diferentes), <b>divergência</b> (dissídio entre tribunais ou órgãos, muitas vezes só para dizer que não foi demonstrado), <b>mudança de entendimento</b> (overruling), <b>questão nova</b> e <b>modulação de efeitos</b>.</li>
      </ul>${COMO_BUSCAR()}`),
    pautastf: () => ajuda("Sobre a Pauta do STF", `
      <p class="texto-serif">A pauta mostra o que o Supremo vai julgar: as sessões presenciais do Plenário e das Turmas, com os processos, relatores, pedidos de vista e destaques, e o calendário das sessões virtuais.</p>
      <ul class="lista-ajuda">
        <li><b>Temas de repercussão geral em pauta</b>: temas ainda sem tese cujo processo paradigma foi pautado. É o aviso mais útil para quem tem processos sobrestados aguardando o tema.</li>
        <li><b>Sessão virtual</b>: os ministros votam no sistema eletrônico durante o período indicado, sem sessão presencial. Um <b>destaque</b> leva o processo para julgamento presencial; um <b>pedido de vista</b> suspende o julgamento.</li>
        <li><b>Sessão presencial</b>: julgamento no Plenário ou na Turma, na data e no horário indicados.</li>
        <li>A pauta é conferida duas vezes por semana e muda com frequência; confirme na pauta oficial do STF antes de agir.</li>
      </ul>${glossarioSTF("plen", "virt", "susp", "rel")}`),
    infostf: () => ajuda("O que é o Informativo do STF", `
      <p class="texto-serif">O Informativo STF é a publicação oficial, semanal, em que o Supremo resume os julgamentos que considera de destaque. Aqui cada edição é um cartão: toque nele para ver os julgados, cada um com o resumo, a tese (quando fixada), o processo, o relator e a data.</p>
      <ul class="lista-ajuda"><li>A busca aceita número de processo (“ADI 7903”), relator, tema ou assunto. Ao buscar, só aparecem os julgados que correspondem, agrupados por edição.</li><li>O resumo completo abre ao tocar no título; ali há a citação pronta para copiar.</li><li>Filtros: matéria, período (ou ano), órgão, relator e “só com tese”. Os anos antigos são carregados na hora.</li><li>O resumo não substitui o acórdão: use “Processo no STF” para conferir as peças.</li><li>${COBERTURA_INFO_STF}</li></ul>${glossarioSTF("cc", "siglas", "plen", "virt", "rel")}`),
    repetitivos: () => trib() === "stf" ? ajuda("O que é a Repercussão geral", `
      <p class="texto-serif">Todos os temas de repercussão geral do STF, com o título, a descrição, o leading case, o relator, a decisão sobre a repercussão geral e a tese fixada.</p>
      <ul class="lista-ajuda">
        <li>Verde: tese fixada. Âmbar: repercussão geral reconhecida, com o mérito pendente. Cinza: sem repercussão geral (em geral, questão infraconstitucional) ou tema cancelado.</li>
        <li>Digite o número para ir direto ao tema. Em cada tema há a linha do tempo, os temas do STJ que remetem a ele e o link para a página oficial.</li>
      </ul>${glossarioSTF("rg", "tema", "lc", "tese", "susp")}${COMO_BUSCAR()}`) : ajuda("O que são os Precedentes qualificados", `
      <p class="texto-serif">Temas repetitivos, controvérsias, incidentes de assunção de competência (IAC), SIRDR e PUIL do STJ, com a questão submetida, a tese firmada, a situação e os processos vinculados.${ambos() ? " Com os dois tribunais, entram também os temas de repercussão geral do STF (selo STF)." : ""}</p>
      <ul class="lista-ajuda">
        <li>A cor da situação indica: verde, tese firmada ou tema julgado; âmbar, afetado ou em andamento; cinza, cancelado.</li>
        <li>Os filtros mostram os temas com suspensão de processos e os que estão em pauta; em cada tema há a linha do tempo e o link para a página oficial.</li>
      </ul>${COMO_BUSCAR()}`),
    sumulas: (p) => p?.get("aba") === "teses"
      ? ajuda("O que é a Jurisprudência em Teses", `<p class="texto-serif">${EXPLICA.teses[1]}</p>
        <p>As edições aparecem em ordem; toque na edição para ver as teses e os precedentes. Cada tese pode ser copiada com a referência completa ou salva.</p>${COMO_BUSCAR()}`)
      : ajuda("Como usar as Súmulas", `
        <p class="texto-serif">${trib() === "stf" ? "Todas as súmulas e súmulas vinculantes do STF, com a situação indicada pelo Tribunal, a data de aprovação ou publicação e as observações." : `Todos os enunciados do STJ, com o órgão que os aprovou, as datas de julgamento e publicação e a situação atual.${ambos() ? " Com os dois tribunais, entram também as súmulas e as súmulas vinculantes do STF (selo STF); o filtro Espécie separa as vinculantes." : ""}`}</p>
        <ul class="lista-ajuda">
          <li>Por padrão aparecem as vigentes, inclusive as de redação alterada ou revisada; o filtro Situação mostra as canceladas.</li>
          <li>Digite o número para ir direto ao enunciado. O botão de cópia traz o texto com a referência.</li>
        </ul>${comSTF() ? glossarioSTF("sumula", "sv", "rcl") : ""}${COMO_BUSCAR()}`),
    pautas: () => ajuda("O que são as Pautas e publicações", `
      <p class="texto-serif">Processos incluídos nas próximas sessões de julgamento do STJ e, na outra aba, os acórdãos publicados no DJEN que ainda não chegaram ao arquivo mensal de ementas.</p>
      <ul class="lista-ajuda">
        <li>As pautas são atualizadas diariamente e indicam os processos vinculados a temas repetitivos.</li>
        <li>Para ser avisado quando um processo seu entrar em pauta, adicione o número ou a sua OAB no Meu radar.</li>
        <li>Por privacidade, o site não exibe os nomes das partes.</li>
      </ul>`),
    composicao: () => trib() === "stf" ? ajuda("Sobre a Composição do STF", `
      <p class="texto-serif">Os ministros do Supremo, o Plenário e a composição das duas Turmas, conforme as páginas oficiais do Tribunal.</p>
      <ul class="lista-ajuda">
        <li>Toque em um nome para ver o perfil: cargo, Plenário e Turma de que participa, contato do gabinete (telefone e e-mails para audiência e memoriais), vaga que ocupou, datas de indicação, nomeação e posse, formação, trajetória e os temas e julgados de sua relatoria no acervo.</li>
        <li>Os ministros são nomeados pelo Presidente da República, depois de aprovados pela maioria absoluta do Senado Federal (CF, art. 101).</li>
        <li>As fotos, quando disponíveis, vêm do acervo livre do Wikimedia Commons, com o crédito indicado.</li>
      </ul>${glossarioSTF("plen", "rel")}`) : ajuda("Sobre a Composição", `
      <p class="texto-serif">Composição atual do STJ por órgão: Plenário, Corte Especial, Seções, Turmas, conselhos e comissões, conforme o documento oficial publicado pelo Tribunal.${ambos() ? " Com os dois tribunais, aparecem também os ministros do STF." : ""}</p>
      <ul class="lista-ajuda">
        <li>A rotina do site confere o documento todos os dias, às 7h, e atualiza a página quando o STJ publica nova versão.</li>
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
      <p class="texto-serif">O Meu radar acompanha, por você, os assuntos, processos e advogados que interessam ao seu trabalho. Ele relê os dados do STJ a cada atualização do site (todos os dias, às 7h) e aponta o que surgiu desde a sua última visita.</p>
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
        <li>Para todas as formas de uma palavra, use o asterisco: <b>prescri*</b> (prescrição, prescricional, prescrito). Para um tema específico: <b>tema 1234</b>.</li>
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
      <p class="texto-serif">O Atualize-se é a leitura rápida do dia: uma novidade por cartão, com a tese em poucas linhas, para você se manter em dia em alguns minutos.</p>
      <h3>O que entra</h3>
      <ul class="lista-ajuda">
        <li><b>Do STJ</b>: teses firmadas em recursos repetitivos e acórdãos de repetitivos publicados; temas afetados e repetitivos em pauta; notas do Informativo; julgados das Turmas e Seções com tese legível (ficam de fora as decisões de rotina, como Súmula 7 e embargos rejeitados).</li>
        <li><b>Do STF</b>: teses fixadas em repercussão geral; temas já julgados cuja tese ainda será publicada; repercussões gerais recém-reconhecidas; súmulas e súmulas vinculantes novas; e os destaques do Informativo do STF das últimas semanas.</li>
        <li>Os cartões do STF aparecem quando o tribunal escolhido no topo inclui o STF. Em “Tipo”, o filtro mostra apenas o que existe no momento.</li>
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
  // Abas (role="tab"): lista com role="tablist", só a aba ativa na ordem do Tab, setas para trocar.
  function corrigirAbas() {
    const listas = new Set($$('[role="tab"]').map((t) => t.parentElement).filter(Boolean));
    for (const l of listas) {
      if (l.getAttribute("role") !== "tablist") l.setAttribute("role", "tablist");
      const abas = $$(':scope > [role="tab"]', l);
      const sel = abas.find((t) => t.getAttribute("aria-selected") === "true") || abas[0];
      for (const t of abas) t.tabIndex = t === sel ? 0 : -1;
    }
  }
  let abasPend = false;
  new MutationObserver(() => { if (!abasPend) { abasPend = true; requestAnimationFrame(() => { abasPend = false; corrigirAbas(); }); } })
    .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
  document.addEventListener("keydown", (e) => {
    const t = e.target.closest?.('[role="tab"]'); if (!t || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    const abas = $$(':scope > [role="tab"]', t.parentElement), i = abas.indexOf(t);
    const j = e.key === "Home" ? 0 : e.key === "End" ? abas.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + abas.length) % abas.length;
    e.preventDefault(); abas[j].focus(); abas[j].click();
  });
  // Imagens que falham (sem manipuladores inline, por causa da política de segurança de conteúdo).
  document.addEventListener("error", (e) => {
    const im = e.target; if (!(im instanceof HTMLImageElement)) return;
    if (im.dataset.erroIni !== undefined) { const sp = document.createElement("span"); sp.className = "av av-ini"; sp.textContent = im.dataset.erroIni; sp.style.cssText = `width:${im.dataset.tam}px;height:${im.dataset.tam}px`; im.replaceWith(sp); }
    else if (im.dataset.erroRemover) im.closest(im.dataset.erroRemover)?.remove();
  }, true);
  document.addEventListener("click", (e) => { if (e.target.closest("[data-recarregar]")) location.reload(); });
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
    // Listas completas de cada filtro, gravadas ao desenhar o painel (para "todos menos um").
    const tiposFd = Object.keys(FEED_TIPOS).filter((k) => todos.some((x) => x.tipo === k));
    const ultTodos = { ar: [], tp: tiposFd, org: [], rel: [] }, nenhumFd = { ar: {}, tp: {}, org: {}, rel: {} };
    const tudoFd = (dim) => !(dim === "rel" ? listaV(f.rel) : f[dim]).length && !nenhumFd[dim].nenhum;
    const rotulo = {
      ar: () => (f.ar.length === 1 ? rotMat(f.ar[0]) || "Matéria" : f.ar.length ? rotExcetoMat(f.ar, ultTodos.ar) || rotGrupoMat(f.ar) || `Matéria · ${f.ar.length}` : "Matéria"),
      tp: () => (f.tp.length === 1 ? FEED_TIPOS[f.tp[0]].rot : f.tp.length ? rotExceto("Tipo", f.tp, ultTodos.tp, (k) => FEED_TIPOS[k]?.rot || k) || `Tipo · ${f.tp.length}` : "Tipo"),
      per: () => (f.per ? PERIODOS.find((p) => p[0] === f.per)[1] : "Período"),
      tese: () => (f.tese === "com" ? "Com tese" : f.tese === "sem" ? "Sem tese" : "Tese"),
      org: () => (f.org.length === 1 ? f.org[0] : f.org.length ? rotExceto("Órgão", f.org, ultTodos.org, (x) => x) || `Órgão · ${f.org.length}` : "Órgão"),
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
        ultTodos.ar = Object.keys(AREAS).filter((a) => c[a]);
        return `<h3>Matéria</h3>${htmlMaterias({ cont: c, sel: (v) => tudoFd("ar") || f.ar.includes(v), selReal: (v) => f.ar.includes(v), aberta: popAberta, todas: "Todas as matérias", op: (v) => `data-op="ar" data-val="${esc(v)}"`, todasOn: tudoFd("ar") })}<p class="nota">Escolha a matéria e, se quiser, um ou mais assuntos específicos. Dá para marcar mais de uma.</p>`;
      }
      if (dim === "ord") return `<h3>Ordenar por</h3><div class="chips">${[["", "Sugerida para você"], ["rec", "Mais recentes"]].map(([v, txt]) => `<button type="button" class="chip" data-op="ord" data-val="${v}" aria-pressed="${f.ord === v}">${txt}</button>`).join("")}</div><p class="nota">Sugerida: combina relevância, novidade, o seu radar e as matérias que você mais lê, alternando os tipos de novidade.</p>`;
      if (dim === "tp") return `<h3>Tipo de novidade</h3>${botaoTodos(tudoFd("tp"), f.tp.length, ultTodos.tp.length, 'data-op="tp" data-val=""')}<div class="chips">${Object.entries(FEED_TIPOS).filter(([k]) => tiposFd.includes(k)).map(([k, v]) => opcao("tp", k, v.longo, conta("tp", (x) => x.tipo === k), tudoFd("tp") || f.tp.includes(k))).join("")}</div>`;
      if (dim === "per") return `<h3>Período</h3><div class="chips">${PERIODOS.map(([d, txt]) => opcao("per", d, txt, conta("per", (x) => !d || Math.abs((new Date(hojeISO()) - new Date(x.d)) / 864e5) <= d), f.per === d)).join("")}</div><p class="nota">Pautas contam pela proximidade da sessão.</p>`;
      if (dim === "tese") return `<h3>Tese</h3><div class="chips">${[["", "Todas"], ["com", "Com tese firmada ou de julgamento"], ["sem", "Sem tese"]].map(([v, txt]) => opcao("tese", v, txt, conta("tese", (x) => !v || (v === "com") === x.tese), f.tese === v)).join("")}</div>`;
      if (dim === "org") {
        const c = {}; todos.filter((x) => passaFeed(x, f, "org") && (!soNovos || !lidos()[x.k]) && x.org).forEach((x) => (c[x.org] = (c[x.org] || 0) + 1));
        const ordemOrg = Object.values(D.orgaos);
        const nomes = [...new Set([...ordemOrg, ...Object.keys(c), ...f.org])].filter((o) => c[o] || f.org.includes(o)).sort((a, b) => (ordemOrg.includes(a) ? ordemOrg.indexOf(a) : 999) - (ordemOrg.includes(b) ? ordemOrg.indexOf(b) : 999) || a.localeCompare(b, "pt"));
        ultTodos.org = nomes;
        return `<h3>Órgão julgador</h3>${botaoTodos(tudoFd("org"), f.org.length, nomes.length, 'data-op="org" data-val=""')}<div class="chips">${nomes.map((o) => opcao("org", o, o, c[o] || 0, tudoFd("org") || f.org.includes(o))).join("")}</div>`;
      }
      const c = {}; todos.filter((x) => passaFeed(x, f, "rel") && (!soNovos || !lidos()[x.k]) && x.rel).forEach((x) => { const k = titulo(x.rel); c[k] = (c[k] || 0) + 1; });
      const lista = Object.entries(c).sort((a, b) => b[1] - a[1]);
      ultTodos.rel = lista.map(([nome]) => nome);
      return `<h3>Relator(a)</h3><input type="search" class="campo" id="fd-rel-q" placeholder="Digite o nome" autocomplete="off">
        <div style="margin-top:10px">${botaoTodos(tudoFd("rel"), listaV(f.rel).length, lista.length, 'data-op="rel" data-val=""')}</div>
        <div class="chips" id="fd-rel-l">${lista.map(([nome, n]) => opcao("rel", nome, nome, n, tudoFd("rel") || listaV(f.rel).some((r) => norm(r) === norm(nome)))).join("")}</div>`;
    }
    const pop = $("#fd-pop"), veu = $("#fd-veu");
    let popDim = "", popAberta = "";
    function abrirPop(dim, botao) {
      // Mesmo painel já aberto: redesenha no lugar, mantendo rolagem e texto digitado.
      const mesmo = popDim === dim && !pop.hidden;
      const rol = mesmo ? [pop, ...$$(".mt2-areas, .mt2-subs", pop)].map((el) => el.scrollTop) : [];
      const qAnt = mesmo ? ($("#fd-rel-q", pop)?.value || "") : "";
      if (popDim !== dim) { popAberta = dim === "ar" ? (f.ar[0] || "").split("/")[0] : ""; if (nenhumFd[dim]) nenhumFd[dim].nenhum = false; }
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
      const antes = JSON.stringify(f);
      if (op === "ar") {
        const est = nenhumFd.ar;
        if (!val) { const eraTudo = tudoFd("ar"); f.ar = []; est.nenhum = eraTudo; }
        else if (val.startsWith("g|")) { const e2 = { tudo: tudoFd("ar"), nenhum: est.nenhum, areas: ultTodos.ar }; f.ar = alternarGrupoMat(f.ar, val, e2); est.nenhum = e2.nenhum; }
        else if (est.nenhum) { est.nenhum = false; f.ar = [val]; }
        else if (tudoFd("ar")) {
          // Tudo marcado: a matéria (ou o assunto) tocada sai; no assunto, ficam os demais assuntos da matéria.
          const [a, sub] = val.split("/");
          f.ar = ultTodos.ar.filter((x) => x !== a);
          if (sub) f.ar.push(...Object.keys(SUBAREAS[a] || {}).filter((k) => k !== sub).map((k) => `${a}/${k}`));
        } else {
          // Geral e específica não se acumulam: marcar uma desmarca a outra.
          const mae = val.split("/")[0];
          f.ar = f.ar.includes(val) ? f.ar.filter((x) => x !== val) : [...f.ar.filter((x) => (val.includes("/") ? x !== mae : !x.startsWith(val + "/"))), val];
          if (!f.ar.length) est.nenhum = true;
        }
      }
      else if (op === "tp" || op === "org") { f[op] = alternarTodos(f[op], ultTodos[op], val, nenhumFd[op]); }
      if (op === "ord") f.ord = val;
      if (op === "per") f.per = +val;
      if (op === "tese") f.tese = val;
      if (op === "rel") f.rel = alternarTodos(listaV(f.rel), ultTodos.rel, val, nenhumFd.rel).join("|");
      if (JSON.stringify(f) !== antes) aplicar(); else desenharFiltros();
      if (op === "per" || op === "tese" || op === "ord") fecharPop(); else abrirPop(op, $(`[data-fp="${op}"]`));
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
      const k = it.si ? chaveInfoSTF(it.si) : it.rg ? `t:RG-${it.rg.n}` : it.sm ? `s:${it.sm._k}` : it.inf ? `i:${it.inf.id}` : it.t ? `t:${it.t.tp}-${it.t.n}` : `a:${it.r.id}`;
      if (forcar && P.salvos[k]) return false;
      if (it.si) alternarSalvo(k, minimoInfoSTF(it.si), botao);
      else if (it.rg) alternarSalvo(k, { k: "t", tp: "RG", n: it.rg.n }, botao);
      else if (it.sm) alternarSalvo(k, { k: "s", trib: "stf", v: it.sm.v, n: it.sm.n }, botao);
      else if (it.inf) alternarSalvo(k, { k: "i", id: it.inf.id }, botao);
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
      const textoIt = it.si ? citInfoSTF(it.si) : it.rg ? `Tema ${it.rg.n}/STF — ${it.rg.tese ? "Tese: " + teseParaPeca(it.rg.tese) : it.rg.q}\n${refTemaRG(it.rg)}` : it.sm ? `${it.sm._rot}/STF: “${it.sm.t.trim().replace(/\.$/, "")}”.` : it.inf ? citInfo(it.inf) : it.t ? `${it.t.tp} ${it.t.n}/STJ — ${it.t.tese ? "Tese: " + teseParaPeca(it.t.tese) : it.t.q}\n${refTemaSTJ(it.t)}` : `${it.r.tese || it.r.tj ? (it.r.tese ? "Tese jurídica: " : "Tese de julgamento: ") + (it.r.tese || it.r.tj) + "\n" : ""}${citacao(it.r)}`;
      if (fn === "mais") { $(".reel-texto", el).classList.add("aberto"); b.hidden = true; }
      if (fn === "area") { f.ar = [b.dataset.ar]; aplicar(); toast(`Lendo só ${rotMat(b.dataset.ar)}.`); }
      if (fn === "tema") abrirTema(it.t.tp, it.t.n);
      if (fn === "temarg") abrirTemaRG(it.rg.n);
      if (fn === "sumstf") abrirSumulaSTF(it.sm._k);
      if (fn === "infostf") abrirInfoSTF(it.si.id);
      if (fn === "acordao") abrirAcordao(it.r);
      if (fn === "info") abrirInformativo(it.inf);
      if (fn === "copiar") copiar(textoIt, "Tese e citação copiadas.");
      if (fn === "citacao") copiar(it.si ? refInfoSTF(it.si) : it.rg ? refTemaRG(it.rg) : it.sm ? `(STF, ${it.sm._rot}.)` : it.inf ? refInfo(it.inf) : it.t ? refTemaSTJ(it.t) : citacao(it.r), "Citação copiada.");
      if (fn === "menos") {
        ajustarPeso(it.ar, -3);
        toast(it.ar.length ? `Certo. ${AREAS[it.ar[0]] || "Esta matéria"} vai aparecer menos.` : "Certo, vamos mostrar menos disso.");
        ir(1);
      }
      if (fn === "compartilhar") {
        const url = it.si ? URL_INFO_STF(it.si.n) : it.rg ? URL_STF.tema(it.rg.n) : it.sm ? URL_STF.sumula(it.sm) : it.inf ? URL_INFO(it.inf.ed) : it.t ? URLS.tema(it.t.tp, it.t.n) : URLS.inteiroTeor(it.r.reg, it.r.dj);
        if (navigator.share) { try { await navigator.share({ title: comSTJ() && !comSTF() ? "Radar STJ" : comSTF() && !comSTJ() ? "Radar STF" : "Radar STJ · STF", text: textoIt, url }); } catch { /* cancelado */ } }
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
      if ((e.key === "o" || e.key === "Enter") && ativoEl?.dataset.k) $('[data-f="acordao"], [data-f="tema"], [data-f="info"], [data-f="infostf"], [data-f="temarg"], [data-f="sumstf"]', ativoEl)?.click();
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
  // No STF, as iniciais vêm do nome pelo qual o ministro é conhecido ("Flávio Dino" → FD).
  const nomeIni = (m) => (m.trib === "stf" ? m.curto : m.nome);
  const avatarMin = (m, tam = 48) => m.foto
    ? `<img class="av" src="${esc(m.foto.url)}" alt="" width="${tam}" height="${tam}" loading="lazy" style="width:${tam}px;height:${tam}px" data-erro-ini="${esc(iniciais(nomeIni(m)))}" data-tam="${tam}">`
    : `<span class="av av-ini" style="width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.36)}px">${iniciais(nomeIni(m))}</span>`;
  const ROT_ORG_CURTO = { "corte-especial": "Corte Especial", "primeira-secao": "1ª Seção", "segunda-secao": "2ª Seção", "terceira-secao": "3ª Seção", "primeira-turma": "1ª Turma", "segunda-turma": "2ª Turma", "terceira-turma": "3ª Turma", "quarta-turma": "4ª Turma", "quinta-turma": "5ª Turma", "sexta-turma": "6ª Turma" };
  const tratamento = (m) => (m.tipo === "convocado" ? (m.genero === "f" ? "Desembargadora convocada" : "Desembargador convocado") : m.genero === "f" ? "Ministra" : "Ministro");
  // Um e-mail com mais de uma finalidade aparece uma vez só, com as finalidades juntas.
  const unirEmails = (l) => { const m = new Map(); for (const e of l || []) { const x = m.get(e.e) || { e: e.e, r: [] }; if (e.rot && !x.r.includes(e.rot)) x.r.push(e.rot); m.set(e.e, x); } return [...m.values()].map((x) => ({ e: x.e, rot: x.r.join("; ") })); };
  const linkEmail = (s) => esc(s).replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>');
  // "(61)3319-6454 6623" = dois ramais do mesmo tronco: (61) 3319-6454 e (61) 3319-6623.
  function telefones(s) {
    const out = []; let dd = "", pre = "";
    for (const m of String(s || "").matchAll(/\((\d{2})\)\s*(\d{4,5})-?(\d{4})|\b(\d{4})\b/g)) {
      if (m[1]) { dd = m[1]; pre = m[2]; out.push([dd, pre, m[3]]); }
      else if (dd) out.push([dd, pre, m[4]]);
    }
    return out;
  }
  const linkTel = (s) => {
    const l = telefones(s);
    if (!l.length) return esc(s);
    return l.map(([dd, a, b]) => `<a href="tel:+55${dd}${a}${b}">(${dd}) ${a}-${b}</a>`).join(`<span class="sep-tel">·</span>`);
  };

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
  // Com os dois tribunais, a Composição mostra um de cada vez (STJ ou STF), escolhido no alto.
  const abasTribComp = (t) => (ambos() ? `<div class="segmentos cp-trib" role="tablist" aria-label="Tribunal">
      <button type="button" role="tab" data-cp-trib="stj" aria-selected="${t === "stj"}">STJ</button>
      <button type="button" role="tab" data-cp-trib="stf" aria-selected="${t === "stf"}">STF</button></div>` : "");
  const ligarAbasTribComp = (main) => $$("[data-cp-trib]", main).forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.cpTrib === "stf" ? "#composicao?t=stf" : "#composicao"; }));
  async function vComposicao(main, p) {
    if (trib() === "stf" || (ambos() && p.get("t") === "stf")) return vComposicaoSTF(main, p);
    const c = await composicao();
    const aba = ["ministros", "conselhos"].includes(p.get("aba")) ? p.get("aba") : "orgaos";
    main.innerHTML = `${abasTribComp("stj")}
      <div class="card card-pad cp-topo">
        <div>
          <p class="sobretitulo">Composição em ${fmtData(c.data)}</p>
          <h2 class="cp-tit">Ministros, Seções e Turmas do STJ</h2>
          <p class="nota">Conforme a <a href="${esc(c.fontes.composicao)}" target="_blank" rel="noopener">composição oficial publicada pelo STJ ${ico("externo")}</a>. O site confere o documento todos os dias, às 7h, e atualiza esta página quando o Tribunal publica nova versão. Toque em um nome para ver o perfil e os contatos do gabinete.</p>
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
    ligarAbasTribComp(main);
    $$("[data-cp-aba]", main).forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.cpAba === "orgaos" ? "#composicao" : `#composicao?aba=${b.dataset.cpAba}`; }));
    $("#cp-q", main).addEventListener("input", debounce((e) => desenhar(e.target.value), 150));
    $("#cp-f", main).addEventListener("submit", (e) => e.preventDefault());
    if (p.get("m")) abrirMinistro(p.get("m"));
  }
  // Composição do STF: Plenário (Presidente, Vice-Presidente e demais por antiguidade) e as duas Turmas.
  async function vComposicaoSTF(main, p) {
    const c = await composicaoSTF();
    const aba = ["ministros", "contatos"].includes(p.get("aba")) ? p.get("aba") : "orgaos";
    const hashDe = (a) => `#composicao?${ambos() ? "t=stf&" : ""}${a !== "orgaos" ? `aba=${a}` : ""}`.replace(/[?&]$/, "");
    main.innerHTML = `${abasTribComp("stf")}
      <div class="card card-pad cp-topo">
        <div>
          <p class="sobretitulo">Composição em ${fmtData(c.data)}</p>
          <h2 class="cp-tit">Ministros, Plenário e Turmas do STF</h2>
          <p class="nota">Conforme as páginas oficiais do STF (<a href="${esc(c.fontes.composicao)}" target="_blank" rel="noopener">composição atual ${ico("externo")}</a> e <a href="${esc(c.fontes.turmas)}" target="_blank" rel="noopener">Turmas ${ico("externo")}</a>), conferidas duas vezes por semana. Toque em um nome para ver o perfil.</p>
        </div>
        <form class="cp-busca" id="cp-f" role="search"><input id="cp-q" type="search" placeholder="Buscar ministro" aria-label="Buscar ministro" autocomplete="off"></form>
      </div>
      <div class="barra-filtros" style="margin-top:18px">
        <div class="segmentos" role="tablist">
          <button type="button" role="tab" data-cp-aba="orgaos" aria-selected="${aba === "orgaos"}">Plenário e Turmas</button>
          <button type="button" role="tab" data-cp-aba="ministros" aria-selected="${aba === "ministros"}">Ministros</button>
          ${c.ministros.some((m) => m.gabinete) ? `<button type="button" role="tab" data-cp-aba="contatos" aria-selected="${aba === "contatos"}">Contatos</button>` : ""}
        </div>
      </div>
      <div id="cp-corpo" style="margin-top:14px"></div>`;
    const corpo = $("#cp-corpo", main);
    const ct = c.contatos || {};
    const blocoContato = (tit, sub, tel, emails, url, extra = "") => `<div class="card card-pad cp-gab">
        <p class="cp-gab-tit"><b>${tit}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</p>
        ${tel ? `<p class="cp-tel">${telefones(tel).length > 1 ? "Telefones" : "Telefone"}: ${linkTel(tel)}</p>` : ""}
        ${unirEmails(emails).map((e) => `<p>${e.rot ? `${esc(e.rot)}: ` : ""}${linkEmail(e.e)}</p>`).join("")}
        ${extra}${url ? `<p class="nota"><a href="${esc(url)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a></p>` : ""}</div>`;
    const contatosHTML = () => `
      <p class="nota" style="margin:0 0 12px">Telefones e e-mails publicados pelo STF para audiências, memoriais e convites. Cada gabinete tem regras próprias para pedir audiência; confira a página oficial antes de enviar.</p>
      <div class="cp-grade-gab">
        ${ct.presidencia ? blocoContato("Gabinete da Presidência", ct.presidencia.nome ? `${ct.presidencia.cargo || "Chefia"}: ${ct.presidencia.nome}` : "", ct.presidencia.telefone, ct.presidencia.emails, c.urlContatos) : ""}
        ${["primeira-turma", "segunda-turma"].filter((k) => ct[k]).map((k) => blocoContato(`Secretaria da ${k === "primeira-turma" ? "Primeira" : "Segunda"} Turma`, ct[k].nome ? `${ct[k].cargo || "Secretaria"}: ${ct[k].nome}` : "", ct[k].telefone, ct[k].emails, c.urlContatos)).join("")}
        ${c.ministros.filter((m) => m.gabinete).map((m) => blocoContato(`<button type="button" class="link-acao" data-min="${esc(m.id)}">${esc(m.curto)}</button>`, m.gabinete.chefe ? `Chefia de gabinete: ${m.gabinete.chefe}` : "", m.gabinete.telefones, m.gabinete.emails, m.gabinete.url, m.gabinete.atualizado ? `<p class="nota">Página atualizada pelo Tribunal em ${fmtData(m.gabinete.atualizado)}.</p>` : "")).join("")}
      </div>`;
    const cartao = (m) => {
      const cargo = (m.orgaos || []).find((o) => o.id === "plenario")?.cargo;
      const tur = (m.orgaos || []).filter((o) => /turma/.test(o.id));
      return `<button type="button" class="card cp-cartao" data-min="${esc(m.id)}">${avatarMin(m, 52)}
        <span class="cp-cartao-tx"><b>${esc(m.curto)}</b>
          <small>${m.antiguidade}º em antiguidade${m.posse ? ` · posse em ${fmtData(m.posse)}` : ""}</small>
          ${tur.length ? `<small class="cp-orgs">${tur.map((o) => `${ROT_ORG_CURTO[o.id]}${o.cargo === "Presidente" ? " (pres.)" : ""}`).join(" · ")}</small>` : ""}
          ${cargo ? `<span class="selo ${cargo === "Decano" ? "" : "pri"}">${esc(cargo === "Decano" ? (m.genero === "f" ? "Decana" : "Decano") : `${cargo} do STF`)}</span>` : ""}</span></button>`;
    };
    const desenhar = (q = "") => {
      const nq = norm(q.trim());
      if (nq) {
        const achados = c.ministros.filter((m) => m._n.includes(nq));
        corpo.innerHTML = achados.length ? `<div class="cp-grade-min">${achados.map(cartao).join("")}</div>` : vazio("composicao", "Nenhum ministro com esse nome", "Confira a grafia ou busque pelo sobrenome.");
        return;
      }
      if (aba === "orgaos") {
        const plen = c.org.get("plenario");
        corpo.innerHTML = `
          <p class="nota" style="margin:0 0 12px">O Plenário reúne os onze ministros e julga, entre outros, as ações de controle de constitucionalidade e o mérito dos temas de repercussão geral. As duas Turmas, de cinco ministros cada, julgam os demais recursos e ações; o Presidente do Tribunal não integra Turma.${c.vagas ? ` <b>${c.vagas === 1 ? "Há uma cadeira vaga" : `Há ${c.vagas} cadeiras vagas`}</b> no Tribunal.` : ""}</p>
          <div class="cp-grade-org cp-stf-turmas">${cardOrgao(c.org.get("primeira-turma"), c, { presPrimeiro: true })}${cardOrgao(c.org.get("segunda-turma"), c, { presPrimeiro: true })}</div>
          ${cardOrgao(plen, c, { cls: "cp-ce" })}
          ${ct["primeira-turma"] || ct["segunda-turma"] ? `<p class="nota" style="margin-top:10px">Secretarias: ${["primeira-turma", "segunda-turma"].filter((k) => ct[k]).map((k) => `${k === "primeira-turma" ? "1ª" : "2ª"} Turma, ${esc(ct[k].nome || "")}${ct[k].telefone ? ` (${linkTel(ct[k].telefone)})` : ""}`).join("; ")}. <a href="${hashDe("contatos")}">Todos os contatos</a>.</p>` : c.secretarioTurmas ? `<p class="nota" style="margin-top:10px">Secretaria das Turmas: ${esc(c.secretarioTurmas)}.</p>` : ""}`;
      } else if (aba === "contatos") {
        corpo.innerHTML = contatosHTML();
        $$("[data-min]", corpo).forEach((b) => b.addEventListener("click", () => abrirMinistro(b.dataset.min)));
      } else {
        corpo.innerHTML = `<p class="nota" style="margin:0 0 12px">Por ordem de antiguidade (data da posse no STF). Fotos do acervo livre do Wikimedia Commons, quando disponíveis.</p>
          <div class="cp-grade-min">${c.ministros.map(cartao).join("")}</div>`;
      }
    };
    desenhar();
    ligarAbasTribComp(main);
    $$("[data-cp-aba]", main).forEach((b) => b.addEventListener("click", () => { location.hash = hashDe(b.dataset.cpAba); }));
    $("#cp-q", main).addEventListener("input", debounce((e) => desenhar(e.target.value), 150));
    $("#cp-f", main).addEventListener("submit", (e) => e.preventDefault());
    if (p.get("m")) abrirMinistro(p.get("m"));
  }
  async function abrirMinistroSTF(id) {
    const c = await composicaoSTF();
    const m = c.idx.get(id); if (!m) return;
    const pf = m.perfil || {}, g = m.gabinete;
    const cargo = (m.orgaos || []).find((o) => o.id === "plenario")?.cargo;
    const rotCargo = cargo === "Decano" ? (m.genero === "f" ? "Decana" : "Decano") : cargo ? `${cargo} do STF` : "";
    const orgs = (m.orgaos || []).map((o) => `<li><b>${esc(o.nome)}</b>${o.cargo && o.id !== "plenario" ? ` · ${esc(o.cargo)}` : o.cargo ? ` · ${esc(rotCargo)}` : ""}</li>`).join("");
    const [temas, ix] = await Promise.all([comSTF() ? temasRG().catch(() => []) : [], infoSTFIndice()]);
    const meus = temas.filter((x) => norm(x.rel || "") === norm(m.curto));
    const comTese = meus.filter((x) => x.tese).length;
    const relInf = ix?.rels ? Object.keys(ix.rels).find((r) => norm(r).endsWith(norm(m.curto))) : "";
    const inf = relInf ? ix.rels[relInf] : null;
    const lista = (arr) => `<ul class="lista-ajuda">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    const vaga = pf.vaga ? `Na vaga decorrente ${pf.vaga.motivo === "falecimento" ? "do falecimento" : "da aposentadoria"} ${/^Ministra/.test(pf.vaga.antecessor) ? "da" : "do"} ${esc(pf.vaga.antecessor)}.` : "";
    const datas = (pf.datas || []).map(([r, d]) => `<li><b>${fmtData(d)}</b> · ${esc(r)}</li>`).join("");
    abrirGaveta(`${m.genero === "f" ? "Ministra" : "Ministro"} do STF`, m.curto, `
      <div class="cp-perfil-cab">
        ${m.foto ? `<figure class="cp-foto"><img src="${esc(m.foto.url)}" alt="${esc(m.nome)}" width="132" height="132" data-erro-remover="figure"><figcaption><a href="${esc(m.foto.pagina)}" target="_blank" rel="noopener">Foto: ${esc(m.foto.credito)}</a></figcaption></figure>` : avatarMin(m, 96)}
        <div>
          <p class="cp-nome">${esc(m.nome)}</p>
          ${rotCargo ? `<span class="selo ${cargo === "Decano" ? "" : "pri"}" style="margin:0 6px 6px 0">${esc(rotCargo)}</span>` : ""}
          <p class="meta" style="margin-top:6px"><span>${m.antiguidade}º em antiguidade</span>${m.posse ? `<span>Posse no STF em ${fmtData(m.posse)}</span>` : ""}</p>
          ${pf.nascimento ? `<p class="nota">Nascimento: ${esc(pf.nascimento)}${pf.natural ? `, em ${esc(pf.natural)}` : ""}</p>` : ""}
        </div>
      </div>
      ${orgs ? `<h3>Onde atua</h3><ul class="lista-ajuda">${orgs}</ul>` : ""}
      ${g ? `<h3>Contato do gabinete</h3><div class="cp-contato">
        ${g.unidade ? `<p><b>${esc(g.unidade)}</b></p>` : ""}
        ${g.chefe ? `<p>Chefia de gabinete: ${esc(g.chefe)}</p>` : ""}
        ${g.telefones ? `<p class="cp-tel">${telefones(g.telefones).length > 1 ? "Telefones" : "Telefone"}: ${linkTel(g.telefones)}</p>` : ""}
        ${(g.emails || []).map((e) => `<p>${e.rot ? `${esc(e.rot)}: ` : ""}${linkEmail(e.e)}</p>`).join("")}
        <p class="nota" style="margin-top:6px"><a href="${esc(g.url)}" target="_blank" rel="noopener">Página do gabinete no STF ${ico("externo")}</a>${g.atualizado ? ` · atualizada pelo Tribunal em ${fmtData(g.atualizado)}` : ""}. Regras de audiência e de envio de memoriais variam por gabinete; confira na página.</p>
      </div>` : ""}
      ${cargo === "Presidente" && c.contatos?.presidencia ? `<h3>Gabinete da Presidência</h3><div class="cp-contato">
        ${c.contatos.presidencia.nome ? `<p>${esc(c.contatos.presidencia.cargo || "Chefia de gabinete")}: ${esc(c.contatos.presidencia.nome)}</p>` : ""}
        ${c.contatos.presidencia.telefone ? `<p class="cp-tel">Telefone: ${linkTel(c.contatos.presidencia.telefone)}</p>` : ""}
        ${unirEmails(c.contatos.presidencia.emails).map((e) => `<p>${e.rot ? `${esc(e.rot)}: ` : ""}${linkEmail(e.e)}</p>`).join("")}
      </div>` : ""}
      <h3>No acervo do Radar</h3>
      <ul class="lista-ajuda">
        ${meus.length ? `<li><a class="link-acao" href="#repetitivos?rel=${encodeURIComponent(m.curto)}&s=afet" data-fechar-gav>${fmtInt(meus.length)} tema(s) de repercussão geral de sua relatoria${comTese ? `, ${fmtInt(comTese)} com tese` : ""} ${ico("seta")}</a></li>` : ""}
        ${inf ? `<li><a class="link-acao" href="#infostf?rl=${encodeURIComponent(relInf)}" data-fechar-gav>${fmtInt(inf[0])} julgado(s) no Informativo do STF, de ${inf[1]} a ${inf[2]} ${ico("seta")}</a>${inf[3].length ? `<br><small class="nota">Matérias mais frequentes: ${inf[3].map((k) => esc(rotMat(k))).join(", ")}.</small>` : ""}</li>` : ""}
        ${!meus.length && !inf ? `<li>Sem julgados de sua relatoria no acervo.</li>` : ""}
      </ul>
      ${datas || vaga ? `<h3>No STF</h3>${vaga ? `<p>${vaga}</p>` : ""}${datas ? `<ul class="lista-ajuda">${datas}</ul>` : ""}` : ""}
      ${pf.formacao ? `<h3>Formação acadêmica</h3>${lista(pf.formacao)}` : ""}
      ${pf.atuacao ? `<details class="cp-det" open><summary>Trajetória antes do STF</summary>${lista(pf.atuacao)}</details>` : ""}
      ${pf.fonteCv ? `<p class="nota">Resumo conforme: ${esc(pf.fonteCv)}.</p>` : ""}
      <p style="margin-top:14px">${pf.curriculo ? `<a class="link-acao" href="${esc(pf.curriculo)}" target="_blank" rel="noopener">Currículo oficial (PDF) ${ico("externo")}</a> ` : ""}<a class="link-acao" href="${esc(pf.pasta || c.fontes.composicao)}" target="_blank" rel="noopener">Página do ministro no STF ${ico("externo")}</a></p>
      <p class="nota" style="margin-top:14px">Composição, Turmas, datas, vaga e contatos conforme as páginas oficiais do STF; formação e trajetória resumidas do currículo indicado; fotos do Wikimedia Commons.</p>`);
    $$("[data-fechar-gav]", $("#gaveta-corpo")).forEach((a) => a.addEventListener("click", fecharGaveta));
  }
  async function abrirMinistro(id) {
    if (D.cache["stf-composicao"] && (await composicaoSTF().catch(() => null))?.idx.has(id)) return abrirMinistroSTF(id);
    const c = await composicao();
    const m = c.idx.get(id); if (!m) return;
    const pf = m.perfil || {}, g = m.gabinete;
    const lista = (arr, mais) => `<ul class="lista-ajuda">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${mais ? `<p class="nota">E mais ${mais} item(ns) no currículo oficial.</p>` : ""}`;
    const orgs = (m.orgaos || []).map((o) => `<li><b>${esc(o.nome)}</b>${o.cargo ? ` · ${esc(o.cargo)}` : ""}${o.mandato ? ` (${esc(o.mandato)})` : ""}${o.grupo ? ` · ${esc(o.grupo.replace(/^Membros /, "membro ").toLowerCase())}` : ""}${o.ingresso ? ` · desde ${fmtData(o.ingresso)}` : ""}</li>`).join("");
    const rel = m.curto.replace(/\s*\(.*\)/, "");
    abrirGaveta(m.tipo === "convocado" ? tratamento(m) : `${tratamento(m)} do STJ`, m.curto, `
      <div class="cp-perfil-cab">
        ${m.foto ? `<figure class="cp-foto"><img src="${esc(m.foto.url)}" alt="${esc(m.nome)}" width="132" height="132" data-erro-remover="figure"><figcaption><a href="${esc(m.foto.pagina)}" target="_blank" rel="noopener">Foto: ${esc(m.foto.credito)}</a></figcaption></figure>` : avatarMin(m, 96)}
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
        ${g.telefones ? `<p class="cp-tel">${telefones(g.telefones).length > 1 ? "Telefones" : "Telefone"}: ${linkTel(g.telefones)}</p>` : ""}
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
  // Seções agrupadas no menu: Acompanhar, Pesquisar, Ferramentas e Informações.
  // "trib": seção só do STJ (some no modo STF). "stf"/"ambos": rótulos próprios de cada modo.
  const VIEWS = [
    { id: "painel", tit: "Visão geral", sobre: "Painel diário", ico: "painel", fn: vPainel, stf: { sobre: "Painel do STF" } },
    { id: "atualize", g: "Acompanhar", tit: "Atualize-se", sobre: "Leitura do dia", ico: "raio", fn: vAtualize, cont2: true, stf: { sobre: "Leitura do dia no STF" }, ambos: { sobre: "Leitura do dia no STJ e no STF" } },
    { id: "semana", g: "Acompanhar", tit: "Resumo da semana", sobre: "O que mudou em 7 dias", ico: "semana", fn: vSemana, trib: "stj" },
    { id: "destaques", g: "Acompanhar", tit: "Destaques", sobre: "Informativo do STJ e seleção automática", ico: "destaques", fn: vDestaques, trib: "stj" },
    { id: "infostf", g: "Acompanhar", tit: "Informativo do STF", sobre: "Julgamentos de destaque do Supremo", ico: "destaques", fn: vInfoSTF, trib: "stf", dados: () => !D.man || !!D.man.stf?.informativos },
    { id: "radar", g: "Acompanhar", tit: "Meu radar", sobre: "Seus interesses", ico: "radar", fn: vRadar, cont: true, trib: "stj" },
    { id: "salvos", g: "Acompanhar", tit: "Salvos", sobre: "Pastas, avaliações e anotações", ico: "salvar", fn: vSalvos, cont3: true },
    { id: "pesquisa", g: "Pesquisar", tit: "Pesquisa de acórdãos", menu: "Acórdãos", sobre: "Acervo de acórdãos", ico: "pesquisa", fn: vPesquisa, trib: "stj", ambos: { menu: "Acórdãos do STJ" } },
    { id: "repetitivos", g: "Pesquisar", tit: "Precedentes qualificados", menu: "Repetitivos", sobre: "Repetitivos, IAC e controvérsias", ico: "repetitivos", fn: vRepetitivos,
      stf: { tit: "Repercussão geral", menu: "Repercussão geral", sobre: "Temas do STF" }, ambos: { menu: "Precedentes", sobre: "Repetitivos do STJ e repercussão geral do STF" } },
    { id: "sumulas", g: "Pesquisar", tit: "Súmulas e teses", sobre: "Súmulas e Jurisprudência em Teses", ico: "sumulas", fn: vSumulas,
      stf: { tit: "Súmulas", sobre: "Súmulas e súmulas vinculantes do STF" }, ambos: { sobre: "Súmulas do STJ e do STF e Jurisprudência em Teses" } },
    { id: "pautastf", g: "Pesquisar", tit: "Pauta do STF", menu: "Pauta do STF", sobre: "Plenário, Turmas e sessões virtuais", ico: "pautas", fn: vPautaSTF, trib: "stf", dados: () => !D.man || !!D.man.stf?.pauta },
    { id: "pautas", g: "Pesquisar", tit: "Pautas e publicações", menu: "Pautas", sobre: "O que vai ser julgado", ico: "pautas", fn: vPautas, trib: "stj" },
    { id: "verificar", g: "Ferramentas", tit: "Verificar petição", sobre: "Conferência de citações", ico: "verificar", fn: vVerificar },
    { id: "composicao", g: "Informações", tit: "Composição", sobre: "Ministros, Seções e Turmas", ico: "composicao", fn: vComposicao,
      stf: { sobre: "Ministros, Plenário e Turmas" }, ambos: { sobre: "Ministros do STJ e do STF" } },
    { id: "sobre", g: "Informações", tit: "Sobre o Radar STJ", menu: "Sobre e novidades", sobre: "Fontes, método e novidades", ico: "sobre", fn: vSobre, stf: { tit: "Sobre o Radar" }, ambos: { tit: "Sobre o Radar" } },
  ];
  // Atalho externo no modo STF: a pesquisa de acórdãos do STF fica no site do próprio Tribunal.
  const LINKS_EXT = [{ g: "Pesquisar", depois: "repetitivos", href: URL_STF.pesquisa, menu: "Acórdãos no site do STF", ico: "pesquisa", quando: () => trib() === "stf" },
    { g: "Pesquisar", depois: "sumulas", href: URL_STF.pauta, menu: "Pauta no site do STF", ico: "pautas", quando: () => comSTF() && D.man && !D.man.stf?.pauta }];
  const disponivel = (v) => (!v.trib || (v.trib === "stj" ? comSTJ() : comSTF())) && (!v.dados || v.dados());
  const vdef = (v) => ({ ...v, ...(v[trib()] || {}) });
  let navLigado = false, maisNav = () => {};
  function montarNav() {
    // Grupos recolhíveis (abertos por padrão); a escolha fica guardada neste navegador.
    const link = (v0) => { const v = vdef(v0); return `<a href="#${v.id}" data-v="${v.id}">${ico(v.ico)}<span>${v.menu || v.tit}</span>${v.cont ? '<span class="cont cont-radar" hidden></span>' : ""}${v.cont2 ? '<span class="cont cont-feed" hidden></span>' : ""}${v.cont3 ? '<span class="cont-n cont-salvos" hidden></span>' : ""}</a>`; };
    const ext = (x) => `<a href="${esc(x.href)}" target="_blank" rel="noopener" class="menu-ext">${ico(x.ico)}<span>${esc(x.menu)}</span>${ico("externo", "ext")}</a>`;
    const vis = VIEWS.filter(disponivel);
    const itensGrupo = (g) => vis.filter((v) => v.g === g).map((v) => link(v) + LINKS_EXT.filter((x) => x.g === g && x.depois === v.id && x.quando()).map(ext).join("")).join("");
    const fechados = new Set(P.menuFechado || []);
    const grupos = [...new Set(vis.map((v) => v.g).filter(Boolean))];
    $("#menu").innerHTML = vis.filter((v) => !v.g).map(link).join("") + grupos.map((g, i) => `
      <div class="menu-bloco${fechados.has(g) ? " fechado" : ""}" data-grupo="${g}">
        <button type="button" class="menu-grupo" aria-expanded="${!fechados.has(g)}" aria-controls="mg-${i}"><span>${g}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="menu-itens" id="mg-${i}"${fechados.has(g) ? " hidden" : ""}>${itensGrupo(g)}</div>
      </div>`).join("");
    if (!navLigado) {
      navLigado = true;
      $("#menu").addEventListener("click", (e) => {
        const b = e.target.closest(".menu-grupo"); if (!b) return;
        abrirGrupoMenu(b.closest(".menu-bloco").dataset.grupo, b.getAttribute("aria-expanded") !== "true");
      });
      $("#barra-inf").addEventListener("click", (e) => { if (e.target.closest("#inf-mais")) maisNav(); });
    }
    const inf = trib() === "stf" ? [["painel", "Início"], ["atualize", "Atualize-se"], ["repetitivos", "Temas"], ["sumulas", "Súmulas"]]
      : [["painel", "Início"], ["atualize", "Atualize-se"], ["radar", "Radar"], ["pesquisa", "Pesquisa"]];
    $("#barra-inf").innerHTML = inf.map(([id, l]) => `<a href="#${id}" data-v="${id}">${ico(VIEWS.find((v) => v.id === id).ico)}<span>${l}</span>${id === "radar" ? '<span class="cont cont-radar" hidden></span>' : ""}${id === "atualize" ? '<span class="cont cont-feed" hidden></span>' : ""}</a>`).join("")
      + `<button type="button" id="inf-mais" aria-haspopup="dialog">${ico("mais")}<span>Mais</span></button>`;
    maisNav = () => {
      const ids = inf.map(([id]) => id);
      const resto = VIEWS.filter((v) => disponivel(v) && !ids.includes(v.id)).map(vdef);
      const grupos = [...new Set(resto.map((v) => v.g))];
      abrirGaveta("Navegação", "Mais seções", `<nav class="mais-nav">
        <h3 class="mais-grupo">Tribunal</h3><div class="trib-opcoes">${opcoesTrib()}</div>
        ${grupos.map((g) => `<h3 class="mais-grupo">${g}</h3><div class="lista">${resto.filter((v) => v.g === g).map((v) =>
        `<a class="card item" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit" href="#${v.id}" data-fechar>${ico(v.ico)}<span><b>${v.tit}</b><br><span class="meta">${v.sobre}</span></span></a>`).join("")}${LINKS_EXT.filter((x) => x.g === g && x.quando()).map((x) =>
        `<a class="card item" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit" href="${esc(x.href)}" target="_blank" rel="noopener">${ico(x.ico)}<span><b>${esc(x.menu)}</b><br><span class="meta">Abre o site do STF</span></span></a>`).join("")}</div>`).join("")}</nav>`);
      $$("[data-fechar]", $("#gaveta-corpo")).forEach((a) => a.addEventListener("click", fecharGaveta));
    };
  }
  // ======================================================= seletor de tribunal
  const opcoesTrib = () => Object.entries(TRIBS).map(([k, t]) => { const off = k !== "stj" && !stfPronto(); return `<button type="button" class="trib-op" role="menuitemradio" aria-checked="${k === trib()}" data-trib="${k}"${off ? ' disabled aria-disabled="true"' : ""}>
      <span class="trib-op-marca" aria-hidden="true"></span><span><b>${esc(t.rot)}</b><small>${esc(off ? "Em preparação: os dados do STF chegam na próxima atualização." : t.desc)}</small></span></button>`; }).join("");
  function abrirMenuTrib(botao) {
    let m = $("#trib-menu");
    if (m && !m.hidden) return fecharMenuTrib();
    if (!m) {
      m = document.createElement("div"); m.id = "trib-menu"; m.className = "trib-menu"; m.setAttribute("role", "menu"); m.setAttribute("aria-label", "Tribunal exibido");
      document.body.appendChild(m);
    }
    m.innerHTML = `<p class="trib-menu-tit">Exibir no Radar</p>${opcoesTrib()}<p class="trib-menu-nota">A escolha fica guardada neste navegador e pode ser trocada a qualquer momento.</p>`;
    const r = botao.getBoundingClientRect();
    m.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 328))}px`; m.style.top = `${r.bottom + 6}px`;
    m.hidden = false; botao.setAttribute("aria-expanded", "true"); m._botao = botao;
    ($('[aria-checked="true"]', m) || $(".trib-op", m)).focus();
  }
  function fecharMenuTrib(foco) {
    const m = $("#trib-menu"); if (!m || m.hidden) return;
    m.hidden = true; m._botao?.setAttribute("aria-expanded", "false"); if (foco) m._botao?.focus();
  }
  function aplicarTrib() {
    const t = TRIBS[trib()];
    document.documentElement.dataset.tribunal = trib();
    $("#marca-nome").textContent = t.rot;
    $("#trib-movel-nome").textContent = t.rot;
    $("#marca").setAttribute("aria-label", `${t.rot}. Trocar o tribunal exibido`);
    $("#rod-fonte").textContent = trib() === "stf" ? "Fonte: páginas oficiais do Supremo Tribunal Federal (repercussão geral, súmulas e composição). Projeto independente, sem vínculo com o STF."
      : ambos() ? "Fontes: Portal de Dados Abertos do STJ e páginas oficiais do STF. Projeto independente, sem vínculo com os tribunais. A relevância é calculada automaticamente; confira sempre o inteiro teor oficial."
      : "Fonte: Portal de Dados Abertos do Superior Tribunal de Justiça. Projeto independente, sem vínculo com o STJ. A relevância é calculada automaticamente; confira sempre o inteiro teor oficial.";
  }
  function trocarTrib(t) {
    fecharMenuTrib(true); fecharGaveta();
    if (!TRIBS[t] || t === trib()) return;
    P.trib = t; salvarP();
    aplicarTrib(); montarNav();
    // A seção aberta continua, se existir no novo modo, sem os filtros do modo anterior.
    const { v } = lerHash();
    viewAtual = null;
    history.replaceState(null, "", `#${v}`);
    rotear();
    toast(`Exibindo: ${TRIBS[t].rot}.`);
  }
  document.addEventListener("click", (e) => {
    const op = e.target.closest(".trib-op[data-trib]"); if (op) { trocarTrib(op.dataset.trib); return; }
    const b = e.target.closest("#marca, #trib-movel"); if (b) { e.preventDefault(); abrirMenuTrib(b); return; }
    if (!e.target.closest("#trib-menu")) fecharMenuTrib();
  });
  document.addEventListener("keydown", (e) => {
    const m = $("#trib-menu"); if (!m || m.hidden) return;
    if (e.key === "Escape") { e.stopPropagation(); fecharMenuTrib(true); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const ops = $$(".trib-op", m), i = ops.indexOf(document.activeElement);
      ops[(i + (e.key === "ArrowDown" ? 1 : ops.length - 1)) % ops.length].focus();
    }
  }, true);
  window.addEventListener("resize", () => fecharMenuTrib());
  window.addEventListener("scroll", () => fecharMenuTrib(), { passive: true });
  function abrirGrupoMenu(g, abrir) {
    const bl = $(`.menu-bloco[data-grupo="${g}"]`); if (!bl) return;
    bl.classList.toggle("fechado", !abrir);
    $(".menu-grupo", bl).setAttribute("aria-expanded", String(abrir));
    $(".menu-itens", bl).hidden = !abrir;
    const f = new Set(P.menuFechado || []); if (abrir) f.delete(g); else f.add(g);
    P.menuFechado = [...f]; salvarP();
  }
  function lerHash() {
    const h = location.hash.replace(/^#/, "");
    const [v, qs] = h.split("?");
    return { v: VIEWS.some((x) => x.id === v && disponivel(x)) ? v : "painel", p: new URLSearchParams(qs || "") };
  }
  function gravarHash(v, params) {
    const qs = new URLSearchParams();
    for (const [k, val] of Object.entries(params)) if (val !== "" && val != null && val !== false) qs.set(k, val === true ? "1" : val);
    const s = qs.toString();
    history.replaceState(null, "", `#${v}${s ? "?" + s : ""}`);
  }
  let viewAtual = null;
  let jaRoteou = false;
  async function rotear() {
    const ativo = document.activeElement;
    const veioDoMenu = !ativo || ativo === document.body || !!ativo.closest?.(".lateral, .barra-inf, #gaveta, .rodape");
    fecharGaveta(); fecharPopF();
    if (D.saiFeed) { D.saiFeed(); D.saiFeed = null; }
    const { v, p } = lerHash();
    if (v !== "pesquisa") AC.token++; // interrompe uma busca longa em andamento ao sair da Pesquisa
    const def = vdef(VIEWS.find((x) => x.id === v));
    // A seção aberta fica sempre visível no menu, mesmo que o grupo estivesse recolhido.
    if (def.g && (P.menuFechado || []).includes(def.g)) abrirGrupoMenu(def.g, true);
    $$("[data-v]").forEach((a) => { a.classList.toggle("ativa", a.dataset.v === v); if (a.dataset.v === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("#topo-titulo").innerHTML = `${esc(def.tit)}${AJUDA_VIEW[def.id] ? ` <button type="button" class="topo-ajuda" data-topo-ajuda="${def.id}" title="Como funciona esta página" aria-label="Como funciona esta página">?</button>` : ""}`;
    $("#topo-sobre").textContent = def.sobre;
    document.title = `${def.tit} · ${TRIBS[trib()].rot}`;
    const main = $("#view");
    const mesma = viewAtual === v;
    viewAtual = v;
    // Ao trocar de seção pelo menu, o foco vai para o título da nova seção (leitores de tela e teclado).
    if (!mesma && jaRoteou && veioDoMenu) $("#topo-titulo").focus({ preventScroll: true });
    jaRoteou = true;
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
      main.innerHTML = `<div class="card vazio" role="alert"><div class="vazio-ico">${ico("alerta")}</div><h3>Não foi possível carregar os dados</h3><p>${esc(e.message)}</p><button class="btn btn-claro" data-recarregar>Tentar de novo</button></div>`;
    }
  }
  const esqueleto = () => `<div class="lista">${Array.from({ length: 3 }, () => `<div class="card item"><div class="esq" style="height:14px;width:40%"></div><div class="esq" style="height:12px;width:90%;margin-top:14px"></div><div class="esq" style="height:12px;width:75%;margin-top:8px"></div></div>`).join("")}</div>`;
  const vazio = (icone, tit, txt, acao = "") => `<div class="card vazio"><div class="vazio-ico">${ico(icone)}</div><h3>${tit}</h3><p>${txt}</p>${acao}</div>`;

  // ================================================================ PAINEL
  // Movimentações dos temas de repercussão geral: reconhecimento (ou não) da repercussão geral,
  // fixação da tese e mudanças registradas pela rotina diária.
  function eventosRG(l, desde) {
    const evs = [];
    for (const x of l) {
      if (x.rgd >= desde) evs.push({ d: x.rgd, k: x.rgs === "nao" ? "mud" : "afet", t: x, txt: x.rgs === "nao" ? "Repercussão geral negada" : "Repercussão geral reconhecida" });
      if (x.dtese >= desde) evs.push({ d: x.dtese, k: "julg", t: x, txt: x.tese ? "Tese fixada" : "Julgado · tese a publicar" });
    }
    for (const h of l.hist) {
      if (h.d < desde || h.ev === "tese") continue;
      const x = l.idx.get(`RG-${h.n}`); if (!x) continue;
      evs.push({ d: h.d, k: "mud", t: x, txt: h.ev === "situacao" ? `Situação no STF: ${h.para}` : h.ev === "rg" ? `Repercussão geral: ${h.para}` : h.ev === "novo" ? "Novo tema" : "Tese alterada" });
    }
    return evs.sort((a, b) => (b.d > a.d ? 1 : b.d < a.d ? -1 : b.t.n - a.t.n));
  }
  const listaEventos = (evs, vazioTxt) => evs.length ? `<div class="card card-pad"><ol class="eventos">${evs.map((e) => `
      <li class="evento" data-tema="${esc(e.t.tp)}|${e.t.n}"><span class="quando">${fmtData(e.d)}</span><span class="marco"><i class="${e.k}"></i></span>
        <div><div class="evento-tit">${seloTrib(e.t.trib || "stj")}<button type="button" data-abrir-tema>${esc(rotTema(e.t))} · ${esc(e.txt)}</button></div>
        <div class="evento-txt">${esc(e.t.tese ? "Tese: " + e.t.tese : e.t.q || "")}</div></div></li>`).join("")}</ol></div>` : `<div class="card card-pad"><p class="nota">${vazioTxt}</p></div>`;
  async function vPainelSTF(main) {
    const hoje = hojeISO();
    const [l, sm, cp, pt, nots, fs] = await Promise.all([temasRG(), sumulasSTF().catch(() => []), composicaoSTF().catch(() => null), D.man?.stf?.pauta ? pautaSTF() : null, noticiasSTF(), fundosCar()]);
    const sSTF = slidesSTF(l, pt, cp);
    const slides = aplicarFundos(intercalar(slidesNoticias(nots), sSTF.teses, sSTF.pauta).slice(0, 8), fs);
    const emPauta = (pt?.temas || []).filter((x) => x.fim >= hoje).sort((a, b) => a.ini.localeCompare(b.ini));
    const ev90 = eventosRG(l, somaDias(hoje, -90));
    const pend = l.filter((x) => x._g === "andamento").sort((a, b) => (b.rgd || "").localeCompare(a.rgd || "") || b.n - a.n);
    const teses12 = l.filter((x) => x.dtese >= somaDias(hoje, -365));
    const sv = sm.filter((x) => x.v && !x._canc);
    const pres = cp?.ministros.find((m) => (m.orgaos || []).some((o) => o.id === "plenario" && o.cargo === "Presidente"));
    const abas = [["mov", "Movimentações", ev90.length], ...(emPauta.length ? [["pauta", "Em pauta", emPauta.length]] : []), ["pend", "Mérito pendente", pend.length], ["sv", "Súmulas vinculantes", sv.length]];
    const abaIni = abas.some((a) => a[0] === P.painelAbaSTF) ? P.painelAbaSTF : "mov";
    main.innerHTML = `
      <section class="hero">
        <p class="sobretitulo">${fmtDiaL(hoje)}</p>
        <h2>O que mudou no STF?</h2>
        <a class="btn-feed" href="#atualize" id="pn-feed">${ico("raio")}<span><b>Novidades para ler</b><small>Leitura rápida, uma tese por vez</small></span>${ico("seta")}</a>
        <form class="hero-busca" id="hero-f" role="search">
          <input id="hero-q" type="search" placeholder="Assunto ou “tema 69”" aria-label="Pesquisar temas de repercussão geral por assunto ou número do tema">
          <button class="btn btn-pri" type="submit" aria-label="Pesquisar">${ico("pesquisa")}<span class="so-largo">Pesquisar</span></button>
        </form>
      </section>
      ${avisoColetaSTF()}
      ${carrosselHTML(slides)}
      <div class="stats">
        <button type="button" class="stat" data-pn="mov"><span class="stat-ico ico-verde">${ico("repetitivos")}</span><span><b>${fmtInt(ev90.filter((e) => e.d >= somaDias(hoje, -30)).length)}</b><span>movimentações em repercussão geral (30 dias)</span></span></button>
        <button type="button" class="stat" data-pn="pend"><span class="stat-ico ico-lar">${ico("pautas")}</span><span><b>${fmtInt(pend.length)}</b><span>temas com mérito pendente</span></span></button>
        <a class="stat" href="#repetitivos?sit=julgado&s=julg"><span class="stat-ico ico-azul">${ico("destaques")}</span><span><b>${fmtInt(teses12.length)}</b><span>teses fixadas em 12 meses</span></span></a>
        <a class="stat" href="#composicao"><span class="stat-ico ico-verm">${ico("composicao")}</span><span><b>${cp ? fmtInt(cp.ministros.length) : "—"}</b><span>${cp ? `ministros${pres ? ` · Presidência: ${esc(pres.curto)}` : ""}` : "composição indisponível"}</span></span></a>
      </div>
      <section class="secao painel-abas">
        <div class="secao-cab"><div class="segmentos" role="tablist" id="pn-abas">${abas.map(([k, r]) => `<button type="button" role="tab" data-pn="${k}" aria-selected="${k === abaIni}">${r}</button>`).join("")}</div>
          <a class="link-acao" id="pn-ver" href="#repetitivos?s=mov">Ver todos ${ico("seta")}</a></div>
        <div id="pn-corpo"></div>
      </section>
      <p class="nota" style="margin-top:14px">Fontes: lista oficial de temas de repercussão geral, “Aplicação das Súmulas no STF” e composição publicada pelo Supremo, conferidas duas vezes por semana. A pesquisa de acórdãos do STF fica no <a href="${URL_STF.pesquisa}" target="_blank" rel="noopener">site do Tribunal ${ico("externo")}</a>.</p>`;
    const PAINEL = {
      mov: { href: "#repetitivos?s=mov", html: () => listaEventos(ev90.slice(0, 8), "Nenhuma movimentação nos últimos 90 dias.") },
      pend: { href: "#repetitivos?sit=andamento&s=afet", html: () => `<ol class="lista">${pend.slice(0, 6).map((x) => linhaTema(x)).join("")}</ol>` },
      pauta: { href: "#pautastf", html: () => `<ol class="lista">${emPauta.slice(0, 6).map((p0) => { const t = l.idx.get(`RG-${p0.tema}`); return t ? linhaTema(t, `<span class="selo ${p0.ini <= hoje ? "alta" : "pri"}" title="${esc(ORG_STF[p0.o] || p0.o)}, sessão ${esc(p0.amb)}">${p0.ini <= hoje ? "Em julgamento" : "Pautado"} · ${p0.ini === p0.fim ? fmtData(p0.ini) : `${fmtData(p0.ini).slice(0, 5)} a ${fmtData(p0.fim).slice(0, 5)}`}</span>`) : ""; }).join("")}</ol>` },
      sv: { href: "#sumulas?esp=sv", html: () => `<ol class="lista">${sv.slice().sort((a, b) => b.n - a.n).slice(0, 5).map((x) => cardSumulaSTF(x, [])).join("")}</ol>` },
    };
    const mostrar = (k) => {
      P.painelAbaSTF = k; salvarP();
      $$("#pn-abas [data-pn]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.pn === k)));
      $("#pn-corpo").innerHTML = PAINEL[k].html(); $("#pn-ver").href = PAINEL[k].href;
    };
    $$("[data-pn]", main).forEach((b) => b.addEventListener("click", () => { mostrar(b.dataset.pn); if (b.classList.contains("stat")) $(".painel-abas").scrollIntoView({ behavior: "smooth", block: "start" }); }));
    mostrar(abaIni);
    ligarCarrossel(main);
    { const hq = $("#hero-q"); if (hq && matchMedia("(min-width: 700px)").matches) hq.placeholder = trib() === "stf" ? "Assunto ou “tema 69” da repercussão geral" : "Assunto, “tema 1234” ou número do processo"; }
    $("#hero-f").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = $("#hero-q").value.trim(); if (!q) return;
      const tm = /^tema\s*:?\s*(\d+)/i.exec(q);
      location.hash = `#repetitivos?q=${encodeURIComponent(tm ? tm[1] : q)}`;
    });
  }
  async function vPainel(main) {
    if (trib() === "stf") return vPainelSTF(main);
    const hoje = hojeISO(), fundosP = fundosCar();
    // Resumo leve (painel.json, gerado na atualização): a página abre sem baixar as bases completas.
    const leve = D.man.painel ? await getJSON("data/painel.json").catch(() => null) : null;
    let evs, pl, dsTop, dsN, mesUlt;
    if (leve) {
      evs = leve.ev.map((e) => ({ d: e.d, k: e.k, txt: e.txt, t: { tp: e.tp, n: e.n, tese: e.tese, q: e.q } }));
      pl = leve.pautas.filter((p) => p.d >= hoje); mesUlt = leve.dest.mes; dsN = leve.dest.n; dsTop = leve.dest.top;
    } else {
      const [t, pl0, ds] = await Promise.all([temas(), pautas(), destaques()]);
      evs = eventosTemas(t, somaDias(hoje, -31)); pl = pl0;
      mesUlt = ds[0]?.dj?.slice(0, 7);
      const dsMes = agrupar(ds.filter((r) => r.dj?.startsWith(mesUlt)));
      dsN = dsMes.length; dsTop = dsMes.slice().sort((a, b) => b.s - a.s).slice(0, 3);
    }
    const ev7 = evs.filter((e) => e.d >= somaDias(hoje, -7));
    const ev30 = evs.filter((e) => e.d >= somaDias(hoje, -30));
    const lim14 = somaDias(hoje, 14);
    const plRel = pl.filter((p) => p.d <= lim14 && (p.temas?.length || /secao|especial/.test(p.o)));
    const plTema = pl.filter((p) => p.temas?.length);
    // O que depende de você (radar e leituras) é calculado depois de a página aparecer.
    let radar = null, novosRadar = [], naoLidos = null;
    const configurado = P.termos.length + P.procs.length + P.oabs.length > 0;

    const abas = [
      ["rep", "Repetitivos", ev30.length], ["pau", "Pautas", plTema.length + plRel.length ? unicos([...plTema, ...plRel], (p) => `${p.p}|${p.d}|${p.pet || ""}`).length : 0],
      ["des", "Destaques", dsN], ["rad", "Meu radar", 0],
    ];
    // Com os dois tribunais: aba própria para a repercussão geral do STF.
    let evRG = null;
    if (ambos()) abas.splice(1, 0, ["rg", "Repercussão geral", 0]);
    const abaIni = abas.some((a) => a[0] === P.painelAba) ? P.painelAba : "rep";
    const sJ = slidesSTJ(evs, pl, dsTop);
    let slidesJ = intercalar(sJ.teses, sJ.dest, sJ.pauta);
    if (ambos()) { const nots = await noticiasSTF(); slidesJ = intercalar(slidesNoticias(nots).slice(0, 3), slidesJ); }
    slidesJ = aplicarFundos(slidesJ.slice(0, 8), await fundosP);
    main.innerHTML = `
      <section class="hero">
        <p class="sobretitulo">${fmtDiaL(hoje)}</p>
        <h2>O que mudou no STJ?</h2>
        <a class="btn-feed" href="#atualize" id="pn-feed">${ico("raio")}<span><b>Novidades para ler</b><small>Leitura rápida, uma tese por vez</small></span>${ico("seta")}</a>
        <form class="hero-busca" id="hero-f" role="search">
          <input id="hero-q" type="search" placeholder="Assunto ou “tema 1234”" aria-label="Pesquisar por assunto, número de tema ou número do processo">
          <button class="btn btn-pri" type="submit" aria-label="Pesquisar">${ico("pesquisa")}<span class="so-largo">Pesquisar</span></button>
        </form>
      </section>
      ${avisoColetaSTF()}
      ${carrosselHTML(slidesJ)}
      <div class="stats">
        <button type="button" class="stat" data-pn="rep">
          <span class="stat-ico ico-verde">${ico("repetitivos")}</span><span><b>${fmtInt(ev7.length)}</b><span>movimentações em repetitivos (7 dias)</span></span></button>
        <button type="button" class="stat" data-pn="pau">
          <span class="stat-ico ico-verm">${ico("pautas")}</span><span><b>${fmtInt(plRel.length)}</b><span>processos relevantes em pauta (14 dias)</span></span></button>
        <button type="button" class="stat" data-pn="des">
          <span class="stat-ico ico-azul">${ico("destaques")}</span><span><b>${fmtInt(dsN)}</b><span>destaques de ${mesUlt ? fmtMes(mesUlt) : "—"}</span></span></button>
        <button type="button" class="stat" data-pn="rad">
          <span class="stat-ico ico-lar">${ico("radar")}</span><span><b id="pn-rad-n">${configurado ? "…" : "—"}</b><span>${configurado ? "novidades no seu radar" : "configure o seu radar"}</span></span></button>
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
      des: { href: "#destaques", html: () => `<ol class="lista" id="painel-dest">${dsTop.map((r) => cardAcordao(r)).join("")}</ol>` },
      rg: { href: "#repetitivos?tipo=RG&s=mov", html: () => (evRG ? listaEventos(evRG.slice(0, 6), "Nenhuma movimentação em repercussão geral nos últimos 60 dias.") : esqueleto()) },
      rad: { href: "#radar", html: () => configurado ? (!radar ? esqueleto() : radar.length ? lista(radar.slice(0, 6).map(itemRadarCompacto).join("")) : `<div class="card card-pad"><p class="nota">Nada encontrado ainda para os seus assuntos.</p></div>`)
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
    if (ambos()) temasRG().then((l) => { evRG = eventosRG(l, somaDias(hoje, -60)); if (viewAtual === "painel" && P.painelAba === "rg") mostrar("rg"); }).catch(() => { evRG = []; });
    // Parte pessoal, em segundo plano.
    (async () => {
      const [r, n] = await Promise.all([configurado ? calcularRadar().catch(() => []) : [], contarNaoLidos()]);
      if (viewAtual !== "painel" || !main.contains($("#pn-feed"))) return;
      radar = r; novosRadar = r.filter((x) => x.novo); naoLidos = n;
      $("#pn-feed b").textContent = naoLidos ? `${fmtInt(naoLidos)} novidade${naoLidos > 1 ? "s" : ""} para ler` : "Você está em dia";
      $("#pn-feed small").textContent = naoLidos ? "Leitura rápida, uma tese por vez" : "Rever as últimas teses e julgados";
      if (configurado) {
        $("#pn-rad-n").textContent = fmtInt(novosRadar.length);
        const ab = $('#pn-abas [data-pn="rad"]'); if (ab && novosRadar.length) ab.insertAdjacentHTML("beforeend", ` <span class="n">${novosRadar.length > 99 ? "99+" : novosRadar.length}</span>`);
        if (P.painelAba === "rad") mostrar("rad");
      }
    })();
    ligarCarrossel(main); fotosCarSTJ(main, slidesJ);
    { const hq = $("#hero-q"); if (hq && matchMedia("(min-width: 700px)").matches) hq.placeholder = trib() === "stf" ? "Assunto ou “tema 69” da repercussão geral" : "Assunto, “tema 1234” ou número do processo"; }
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
    if (it.tipo === "mono") { tit = `${tituloMono(o)} · decisão monocrática`; txt = `${desfechoMono(o)} · ${relatorFmt(o.min)}`; }
    const tema = it.tipo === "tema" ? ` data-tema="${esc(o.tp)}|${o.n}"` : "";
    return `<li class="evento"${tema}><span class="quando">${fmtData(it.d)}</span><span class="marco"><span class="ponto ${it.nivel}" style="margin-top:0"></span></span>
      <div><div class="evento-tit">${tema ? `<button type="button" data-abrir-tema>${esc(tit)}</button>` : esc(tit)} ${it.novo ? '<span class="selo novo">Novo</span>' : ""}</div>
      <div class="evento-txt">${esc(txt)}</div><div class="meta" style="margin-top:2px"><span>por “${esc(it.termo.replace(/"/g, ""))}”</span></div></div></li>`;
  }

  // ============================================================ MEU RADAR
  const TIPO_RADAR = { tema: "Repetitivo", acordao: "Acórdão", informativo: "Informativo", pauta: "Em pauta", djen: "Publicação no DJEN", mono: "Decisão monocrática" };
  function areasItem(it) { return it.obj?.ar || (it.tipo === "pauta" && it.temaObj?.ar) || []; }
  function subsItem(it) { return it.obj?.sa || (it.tipo === "pauta" && it.temaObj?.sa) || []; }
  // Publicação do DJEN salva: quando o acórdão chega ao acervo, o salvo passa a ser o acórdão completo.
  async function promoverSalvosDjen() {
    const ds = Object.entries(P.salvos).filter(([k]) => k.startsWith("d:"));
    if (!ds.length) return 0;
    const ix = await numerosDe([], ds.map(([, o]) => o.reg || "")).catch(() => null); if (!ix) return 0;
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
    toast("Processo incluído no Meu radar: avisa quando entrar em pauta, tiver acórdão ou decisão monocrática."); b.remove();
  });
  const RES_DJEN = { Negando: "negou provimento", "Não Conhecendo": "não conheceu", Concedendo: "deu provimento ou concedeu", "Admitindo Embargo": "acolheu os embargos" };
  const chaveDjen = (o) => `d:${o.reg}|${o.d}|${o.r || ""}`;
  // Acórdão publicado no DJEN cuja ementa ainda não está no arquivo mensal do STJ.
  function cardDjen(o, { por = "", novo = "", nivel = "", nota = "", em = "", mes = false } = {}) {
    const tit = o.r ? `${o.r} no ${o.p}` : o.p;
    const res = RES_DJEN[o.t] ? `O STJ ${RES_DJEN[o.t]}` : "";
    const mm = +String(o.d || "").slice(5, 7);
    const seloPub = mes && mm ? `<span class="selo acomp" title="Publicado no DJEN; o STJ divulga a ementa no arquivo mensal, em regra no início do mês seguinte">Publicado em ${MESES_L[mm - 1]} · ${em ? "ementa do texto integral" : `ementa em ${MESES_L[mm % 12]}`}</span>` : `<span class="selo acomp">Acórdão publicado</span>`;
    if (em) {
      const [cab, ...resto] = em.split("\n");
      nota = `${res ? `${esc(res)}. ` : ""}Ementa tirada do texto integral publicado pelo STJ; a versão do arquivo mensal entra no início do mês seguinte.`;
      return `<li class="card item item-radar item-djen com-ementa">
      <div class="item-cab">${nivel}<span class="item-tit">${esc(tit)}</span>${seloPub}${novo}
        <span class="meta"><span>DJEN ${fmtData(o.d)}</span>${D.orgaos[o.tr] ? `<span>${esc(D.orgaos[o.tr])}</span>` : ""}${o.rel ? `<span>Rel. ${esc(titulo(o.rel))}</span>` : ""}</span></div>
      <p class="verb">${esc(frase(cab))}</p>
      ${resto.length ? `<div class="expansivel"><div><div class="texto-serif">${resto.map((x) => `<p>${esc(x)}</p>`).join("")}</div></div></div>` : ""}
      <p class="nota djen-res">${nota}</p>
      <div class="acoes">${resto.length ? `<button type="button" class="link-acao" data-djen-em>Ver ementa completa</button>` : ""}<a class="link-acao" href="${URLS.inteiroTeor(o.reg, o.d)}" target="_blank" rel="noopener">Inteiro teor oficial ${ico("externo")}</a>
        <a class="link-acao" href="${URLS.processo(o.reg)}" target="_blank" rel="noopener">Consulta processual ${ico("externo")}</a>
        <span class="dir">${botaoSalvar(chaveDjen(o), { k: "d", p: o.p, r: o.r, t: o.t, rel: o.rel, reg: o.reg, d: o.d, tr: o.tr })}</span></div></li>`;
    }
    if (mes) nota = `A ementa entra quando o STJ divulgar o arquivo mensal, em regra no início de ${MESES_L[mm % 12]}.`;
    return `<li class="card item item-radar item-djen">
      <div class="item-cab">${nivel}<span class="item-tit">${esc(tit)}</span>${seloPub}${novo}
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
    if (it.tipo === "mono") return cardMono(o).replace('<div class="item-cab">', `<div class="item-cab">${nivel}`).replace('<span class="selo">Decisão monocrática</span>', `<span class="selo">Decisão monocrática</span>${novo}`).replace('</div></li>', `${por}</div></li>`);
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
              <p class="nota">Aceita "expressão exata", e, ou, não, prescri* (todas as formas da palavra) e tema 1234.</p></div>
            <div class="radar-bloco t-procs"><h3>Processo</h3>
              <form class="adicionar" data-lista="procs"><input placeholder="Ex.: REsp 2222623" aria-label="Novo processo"><button class="btn btn-pri" type="submit" aria-label="Adicionar">${ico("mais1")}</button></form>
              <p class="nota">Avisa quando entrar em pauta, tiver acórdão ou decisão monocrática.</p></div>
            <div class="radar-bloco t-oabs"><h3>OAB</h3>
              <form class="adicionar" data-lista="oabs"><input placeholder="Ex.: RS 12345" aria-label="Nova OAB"><button class="btn btn-pri" type="submit" aria-label="Adicionar">${ico("mais1")}</button></form>
              <p class="nota">Mostra seus processos nas próximas pautas.</p></div>
          </div>
          <div class="sugestoes" id="rd-sug"></div>
          <div class="acoes" style="margin-top:10px"><button type="button" class="btn btn-fant btn-peq" id="rd-link" title="Quem receber o link verá os termos, processos e OABs que você acompanha.">${ico("link")} Copiar link para usar em outro aparelho</button>
            <button type="button" class="btn btn-fant btn-peq" id="rd-copia">${ico("arquivo")} Cópia de segurança</button></div>
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
    $("#rd-copia").addEventListener("click", () => gerenciarPastas(true));
    $("#rd-link").addEventListener("click", () => {
      const cod = btoa(unescape(encodeURIComponent(JSON.stringify({ termos: P.termos, procs: P.procs, oabs: P.oabs }))));
      copiar(`${location.origin}${location.pathname}#radar?importar=${encodeURIComponent(cod)}`, "Link copiado. Quem o receber verá o que você acompanha.");
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
  const TIPOS_S = [["a", "Acórdãos"], ["d", "Aguardando ementa"], ["t", "Precedentes qualificados"], ["s", "Súmulas"], ["j", "Jurisprudência em Teses"], ["i", "Informativo"], ["p", "Pautas"]];
  const SV = { pasta: "", tp: "", aval: "", ar: "", q: "", ord: "rec", mud: false };
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
    const temJ = Object.keys(P.salvos).some((k) => k.startsWith("j:")), temS = Object.keys(P.salvos).some((k) => k.startsWith("s:") && !k.startsWith("s:STF-"));
    const temRG = Object.keys(P.salvos).some((k) => k.startsWith("t:RG-")), temSF = Object.keys(P.salvos).some((k) => k.startsWith("s:STF-"));
    // Notas do Informativo do STF: as recentes e, se preciso, os anos antigos das notas salvas.
    const infSTFsalvos = Object.entries(P.salvos).filter(([k]) => k.startsWith("i:STF-")).map(([, x]) => x);
    let infSTF = null;
    if (infSTFsalvos.length) {
      infSTF = await informativosSTF().catch(() => null);
      const ix = infSTF ? await infoSTFIndice() : null;
      const anos = [...new Set(infSTFsalvos.filter((x) => !infSTF?.idx.has(x.id)).map((x) => (x.d || "").slice(0, 4)))].filter((a) => ix?.antigos?.includes(a));
      await Promise.all(anos.map((a) => infoSTFAno(a).catch(() => null)));
    }
    const [t0, inf, jt, sms, rg, sf] = await Promise.all([temas().catch(() => ({ idx: new Map() })), informativos().catch(() => ({ idx: new Map() })), temJ ? tesesJT().catch(() => ({ idx: new Map() })) : { idx: new Map() }, temS ? sumulas().catch(() => []) : [],
      temRG ? temasRG().catch(() => null) : null, temSF ? sumulasSTF().catch(() => null) : null]);
    // Temas do STJ e do STF salvos: um só índice.
    const t = rg ? { idx: new Map([...t0.idx, ...rg.idx]) } : t0;
    await conferirMudancasSalvos().catch(() => null);
    if (viewAtual !== "salvos") return;
    const pg = paginador("sv", () => desenharLista(), "#sv-lista");
    main.innerHTML = `<div class="sv${P.svCompacto ? " sv-compacto" : ""}">
      <aside class="sv-lado card" id="sv-lado" aria-label="Pastas"></aside>
      <section class="sv-principal"><div id="sv-cab"></div><div id="sv-filtros"></div><div id="sv-lista"></div><div id="sv-pag"></div></section></div>`;
    const lado = $("#sv-lado", main), cab = $("#sv-cab", main), filtros = $("#sv-filtros", main), lista = $("#sv-lista", main);

    // Dados de cada salvo: cartão, matérias e texto para a busca.
    let itens = [];
    const montar = () => {
      for (const x of Object.values(P.salvos)) if (x.nota != null && !String(x.nota).trim()) delete x.nota;
      itens = Object.entries(P.salvos).map(([k, x]) => {
        const tp = tipoSalvo(x, k);
        let li = "", ar = x.ar || [], ref = "", extra = "", o = null;
        if (tp === "t") { o = t.idx.get(`${x.tp}-${x.n}`); li = o ? linhaTema(o) : ""; ar = o?.ar || []; extra = `${o?.tese || ""} ${o?.q || ""}`; ref = `${o?.tese ? `“${o.tese.trim().replace(/\.$/, "")}” ` : ""}${x.tp === "RG" ? `(STF, Tema ${x.n} da repercussão geral${o?.lc ? `, ${o.lc}` : ""}.)` : `(STJ, ${x.tp === "Tema" ? "Tema repetitivo" : x.tp} n. ${fmtNumProc(x.n)}.)`}`; }
        else if (tp === "i" && x.trib === "stf") { o = infSTF?.idx.get(x.id); li = o ? cardInfoSTF(o) : ""; ar = o?.ar || x.ar || []; extra = `${o?.t || x.t || ""} ${(o?.ts || []).join(" ")} ${o?.rel || ""}`; ref = o ? refInfoSTF(o) : ""; }
        else if (tp === "i") { o = inf.idx.get(x.id); li = o ? cardInformativo(o) : ""; ar = o?.ar || []; extra = `${o?.tema || ""} ${o?.t || ""}`; ref = o ? citInfo(o) : ""; }
        else if (tp === "d") { li = cardDjen(x); ref = `${x.p || ""}`; }
        else if (tp === "j") { o = jt.idx.get(x.id); li = o ? `<li class="card jt-salva"><ol class="jt-teses plano">${linhaTeseJT(o, [], true)}</ol></li>` : ""; ar = o?.ar || []; extra = o?.t || ""; ref = o ? `“${o.t.trim().replace(/\.$/, "")}” (STJ, Jurisprudência em Teses, edição n. ${o.ed}, tese n. ${o.n}.)` : ""; }
        else if (tp === "p") { li = cardPauta(x); ref = `${x.p || ""}`; }
        else if (tp === "s" && x.trib === "stf") { o = sf?.idx.get(k.slice(2)); li = o ? cardSumulaSTF(o, []) : ""; ar = o?.ar || []; extra = o?.t || ""; ref = o ? `${o._rot}/STF: “${o.t.trim().replace(/\.$/, "")}”.` : ""; }
        else if (tp === "s") { o = sms.find((y) => y.n === x.n); li = o ? cardSumula(o, []) : ""; ar = o?.ar || []; extra = o?.t || ""; ref = o ? `Súmula ${o.n}/STJ: “${o.t.trim().replace(/\.$/, "")}”.` : ""; }
        else { li = cardAcordao({ ...x, em: "", h: x.h }); extra = `${x.h || ""} ${x.tese || ""} ${x.tj || ""}`; ref = citavel(x) ? citacao(x) : `${x.cl} ${fmtNumProc(x.n)}`; }
        return { k, x, tp, o, li, ar, ref, txt: norm(`${tituloSalvo(x, k)} ${extra} ${x.nota || ""} ${(x.pastas || []).join(" ")}`) };
      }).filter((i) => i.li);
    };
    const naPasta = (i) => !SV.pasta || (SV.pasta === "_sem" ? !(i.x.pastas || []).length : (i.x.pastas || []).includes(SV.pasta));
    const passa = (i, ignora = "") => naPasta(i)
      && (ignora === "tp" || !SV.tp || i.tp === SV.tp)
      && (ignora === "aval" || !SV.aval || (i.x.aval || "_") === SV.aval)
      && (ignora === "ar" || !SV.ar || i.ar.includes(SV.ar))
      && (!SV.mud || i.x.mudou)
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
          ${cont((i) => i.x.mudou) ? btn("data-sv-mud", "1", "alerta", "Mudaram de situação", cont((i) => i.x.mudou), SV.mud) : ""}
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
            ${vis.length ? `<button type="button" class="btn btn-claro btn-peq" data-sv-dossie title="Monta um documento com os itens exibidos, suas avaliações e anotações, para imprimir ou salvar em PDF">${ico("arquivo")} Dossiê em PDF</button>` : ""}
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
      return `${x.mudou ? `<div class="sv-mudou" role="status">${ico("alerta")}<span>Situação mudou${x.mudou.em ? ` (notado em ${fmtData(x.mudou.em)})` : ""}: de “${esc(x.mudou.de)}” para <b>“${esc(x.mudou.para)}”</b>.</span><button type="button" class="btn btn-claro btn-peq" data-sv-ciente="${esc(i.k)}">Ciente</button></div>` : ""}<div class="salvo-org" data-sv-k="${esc(i.k)}">
          <div class="sv-org-l">
            ${(x.pastas || []).map((pn) => `<button type="button" class="tag-pasta" data-sv-pasta="${esc(pn)}" title="Abrir a pasta">${ico("pasta")}${esc(pn)}</button>`).join("")}
            <button type="button" class="tag-pasta tag-add" data-organizar="${esc(i.k)}">${ico("mais1")}${(x.pastas || []).length ? "Pasta" : "Colocar em pasta"}</button>
          </div>
          <div class="sv-aval" role="group" aria-label="Avaliação">
            <button type="button" data-sv-av="fav" aria-pressed="${x.aval === "fav"}" title="${penal ? "Favorável à defesa" : "Favorável à tese que você sustenta"}">${ico("polegar")}${rotAval("fav", penal)}</button>
            <button type="button" data-sv-av="desf" aria-pressed="${x.aval === "desf"}" title="${penal ? "Desfavorável à defesa" : "Desfavorável à tese que você sustenta"}">${ico("polegar-b")}${rotAval("desf", penal)}</button>
          </div>
          ${String(x.nota || "").trim() ? `<button type="button" class="salvo-nota" data-organizar="${esc(i.k)}" title="Editar anotação">${esc(x.nota)}</button>` : `<button type="button" class="link-acao sv-anotar" data-organizar="${esc(i.k)}">Anotar</button>`}
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
      if (el("[data-sv-mud]")) { SV.mud = !SV.mud; tudo(); return; }
      if ((b = el("[data-sv-ciente]"))) { const x = P.salvos[b.dataset.svCiente]; if (x?.mudou) { x.sitVista = x.mudou.para; delete x.mudou; salvarP(); } if (SV.mud && !Object.values(P.salvos).some((y) => y.mudou)) SV.mud = false; tudo(false); return; }
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
      if ((b = el("[data-sv-dossie]"))) { b.disabled = true; try { await gerarDossie(nomePasta(), visiveis()); } finally { b.disabled = false; } return; }
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
    const at = document.activeElement;
    if (POPF.foco?.isConnected && (!at || at === document.body || POPF.el.contains(at))) POPF.foco.focus({ preventScroll: true });
    POPF.foco = null;
    setTimeout(() => { if (!POPF.el.classList.contains("vis")) { POPF.el.hidden = true; POPF.veu.hidden = true; } }, 200);
  }
  // Filtros de escolha múltipla guardados como texto: "a|b|c".
  const listaV = (v) => String(v ?? "").split("|").filter(Boolean);
  const temV = (v, x) => !v || listaV(v).includes(String(x ?? ""));
  // Escolha múltipla com "todas marcadas" por padrão: tocar num item com tudo marcado o deixa de fora;
  // desmarcar o último volta ao estado "nenhum" (sem filtro, para escolher um a um). estado.nenhum é
  // só visual. Devolve a nova seleção ([] = todos).
  function alternarTodos(cur, todos, val, estado) {
    if (val === "") { const eraTudo = !cur.length && !estado.nenhum; estado.nenhum = eraTudo; return []; }
    if (estado.nenhum) { estado.nenhum = false; return [val]; }
    if (!cur.length) return todos.filter((x) => x !== val);
    const nova = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
    if (!nova.length) { estado.nenhum = true; return []; }
    if (todos.length && todos.every((x) => nova.includes(x))) return [];
    return nova;
  }
  const botaoTodos = (tudo, n, total, attr = "data-op-todos") => `<div class="pop-todos"><button type="button" class="btn btn-claro btn-peq" ${attr} aria-pressed="${tudo}">${tudo ? "Desmarcar todos" : "Marcar todos"}</button><span class="nota">${tudo ? "Todos marcados: toque num item para deixá-lo de fora." : n ? `${fmtInt(n)} de ${fmtInt(total)} marcados.` : "Toque nos itens que quer ver."}</span></div>`;
  // Matéria com quase tudo marcado: o que ficou de fora (matérias inteiras ou assuntos de uma matéria).
  function rotExcetoMat(sel, areas) {
    const fora = [];
    for (const a of areas) {
      if (sel.includes(a)) continue;
      const subs = sel.filter((x) => x.startsWith(a + "/"));
      if (!subs.length) fora.push(AREAS[a] || a);
      else {
        // Assuntos de fora; um grupo inteiro de fora aparece pelo nome do grupo.
        const out = Object.keys(SUBAREAS[a] || {}).filter((k) => !sel.includes(`${a}/${k}`));
        const grupos = [...new Set(out.map((k) => SUBGRUPO[a]?.[k] || ""))];
        for (const g of grupos) {
          const doG = out.filter((k) => (SUBGRUPO[a]?.[k] || "") === g);
          if (g && subsDoGrupo(a, g).length === doG.length) fora.push(g); else fora.push(...doG.map((k) => SUBAREAS[a][k]));
        }
      }
    }
    if (sel.length < 2 || !fora.length || fora.length > 2 || sel.length <= fora.length) return "";
    const t = `Matéria: exceto ${fora.join(", ")}`;
    return t.length > 40 ? `Matéria · todas menos ${fora.length}` : t;
  }
  // Rótulo do filtro quando quase tudo está marcado: "Órgão: exceto Quinta Turma".
  function rotExceto(rot, sel, todos, nome) {
    const fora = todos.filter((x) => !sel.includes(x));
    if (sel.length < 2 || !fora.length || fora.length > 2 || sel.length <= fora.length) return "";
    const t = `${rot}: exceto ${fora.map(nome).join(", ")}`;
    return t.length > 40 ? `${rot} · todos menos ${fora.length}` : t;
  }
  function pilulas(raiz, defs, aoMudar) {
    garantirPopF();
    const vazioDe = (d) => (d.tipo === "multi" ? [] : d.tipo === "toggle" ? false : d.tipo === "varios" ? "" : (d.padrao ?? ""));
    const ativo = (d) => (d.tipo === "multi" ? d.get().length > 0 : d.tipo === "toggle" ? !!d.get() : String(d.get() ?? "") !== String(d.padrao ?? ""));
    // Escolha múltipla ("varios", "multi" e "materia"): sem filtro, todas as opções aparecem marcadas,
    // e tocar numa delas a deixa de fora (as demais continuam marcadas). "Desmarcar todas" limpa a
    // seleção visualmente (sem filtrar) para escolher uma a uma; "Marcar todas" volta ao início.
    const multi = (d) => d.tipo === "varios" || d.tipo === "multi" || d.tipo === "materia";
    const selDe = (d) => (d.tipo === "multi" ? [...d.get()] : d.tipo === "materia" ? listaMat(d.get()) : listaV(d.get()));
    const porSel = (d, l) => d.set(d.tipo === "multi" ? l : d.tipo === "materia" ? l.join(",") : l.join("|"));
    const opsReais = (d) => (d.opcoes ? d.opcoes() : []).filter((o) => String(o.v) !== "").map((o) => String(o.v));
    const tudo = (d) => !selDe(d).length && !d._nenhum;
    const matAreas = (d) => { const c = d.cont ? d.cont() : null; return Object.keys(AREAS).filter((a) => !c || c[a]); };
    const rotulo = (d, v) => { const o = (d.opcoes ? d.opcoes() : []).find((x) => String(x.v) === String(v)); return o?.curto || o?.t || v; };
    const rot = (d) => {
      if (multi(d) && ativo(d)) {
        // Quase todas marcadas: mostra o que ficou de fora.
        const l = selDe(d);
        const t = d.tipo === "materia" ? rotExcetoMat(l, matAreas(d)) : rotExceto(d.rot, l, opsReais(d), (x) => rotulo(d, x));
        if (t) return t;
      }
      if (d.tipo === "toggle" || !ativo(d)) return d.rotAtual ? d.rotAtual() : d.rot;
      if (d.tipo === "multi") { const v = d.get(); const o = d.opcoes().find((x) => x.v === v[0]); return v.length === 1 ? (o?.t || d.rot) : `${d.rot} · ${v.length}`; }
      if (d.tipo === "texto") return `${d.rot}: ${d.get()}`;
      if (d.tipo === "varios") { const l = listaV(d.get()); if (!l.length) return d.rotTodos || d.rot; const o = d.opcoes().find((x) => String(x.v) === l[0]); return l.length === 1 ? (o?.curto || o?.t || l[0]) : `${d.rot} · ${l.length}`; }
      if (d.tipo === "materia") { const l = listaMat(d.get()); return l.length > 1 ? rotGrupoMat(l) || `Matéria · ${l.length}` : rotMat(d.get()); }
      const o = d.opcoes().find((x) => String(x.v) === String(d.get())); return o ? (o.curto || o.t) : d.rotValor ? d.rotValor(d.get()) : d.rot;
    };
    function desenhar() {
      const n = defs.filter((d) => ativo(d) && !d.semLimpar).length;
      raiz.innerHTML = defs.map((d, i) => `<button type="button" class="fpill${d.tipo === "toggle" ? " toggle" : ""}${d.cls ? " " + d.cls : ""}" data-pil="${i}" aria-pressed="${ativo(d)}"${d.tipo !== "toggle" ? ' aria-haspopup="dialog"' : ""}${d.dica ? ` title="${esc(d.dica)}"` : ""}>${d.ico ? ico(d.ico) : ""}${esc(rot(d))}${d.tipo !== "toggle" ? ico("seta") : ""}</button>`).join("")
        + (n ? `<button type="button" class="fpill limpar" data-pil-limpar>${ico("x")} Limpar</button>` : "");
    }
    function conteudo(d) {
      const ops = (d.opcoes ? d.opcoes() : []).filter((o) => !(multi(d) && d.tipo !== "materia" && String(o.v) === "" && opsReais(d).length > 1));
      const v = d.get();
      const chip = (o) => {
        const m = multi(d) ? (tudo(d) || selDe(d).includes(String(o.v))) : String(v ?? "") === String(o.v);
        return `<button type="button" class="chip${o.h != null ? " area" : ""}" data-op="${esc(String(o.v))}" aria-pressed="${m}"${o.h != null ? ` style="--h:${o.h}"` : ""}>${o.h != null ? "<i></i>" : o.ponto ? `<span class="ponto ${o.ponto}"></span>` : ""}${esc(o.t)}${o.n != null ? ` <span class="n">${fmtInt(o.n)}</span>` : ""}</button>`;
      };
      const corpo = d.tipo === "materia"
        ? htmlMaterias({ cont: d.cont ? d.cont() : null, sel: (x) => tudo(d) || listaMat(v).includes(x), selReal: (x) => listaMat(v).includes(x), aberta: POPF.aberta, todas: d.todas || "Todas as matérias", todasOn: tudo(d) })
        : d.tipo === "texto"
        ? `<form class="adicionar" data-pil-form><input type="search" value="${esc(v || "")}" placeholder="${esc(d.ph || "")}"${d.lista ? ` list="${d.lista}"` : ""} autocomplete="off"><button class="btn btn-pri" type="submit">Aplicar</button></form>${ops.length ? `<div class="chips" style="margin-top:12px">${ops.slice(0, 24).map(chip).join("")}</div>` : ""}`
        : d.grupos
        ? d.grupos.map(([g, rotG]) => { const os = ops.filter((o) => (o.g || "") === g); return os.length ? `${rotG ? `<p class="pop-grupo">${esc(rotG)}</p>` : ""}<div class="chips${d.vertical ? " vertical" : ""}">${os.map(chip).join("")}</div>` : ""; }).join("")
        : `<div class="chips${d.vertical ? " vertical" : ""}">${ops.map(chip).join("")}</div>`;
      // Botão único de marcar/desmarcar todas, no lugar da antiga opção "Todos".
      const todosBtn = multi(d) && d.tipo !== "materia" && opsReais(d).length > 1
        ? botaoTodos(tudo(d), selDe(d).length, opsReais(d).length) : "";
      // Campo de data: um dia (ir para a semana) ou um intervalo (de/até).
      const vd = String(v || "");
      const datas = d.datas === "uma"
        ? `<form class="pop-datas" data-pil-datas><label>${esc(d.rotData || "Escolher uma data")}<input type="date" name="a" value="${/^\d{4}-\d{2}-\d{2}$/.test(vd) ? vd : ""}" min="${d.min || ""}" max="${d.max || ""}" required></label><button class="btn btn-pri btn-peq" type="submit">Ir</button></form>`
        : d.datas === "intervalo"
        ? `<form class="pop-datas" data-pil-datas><label>De<input type="date" name="de" value="${vd.startsWith("d:") ? vd.split(":")[1] : ""}" min="${d.min || ""}" max="${d.max || ""}"></label><label>Até<input type="date" name="ate" value="${vd.startsWith("d:") ? vd.split(":")[2] : ""}" min="${d.min || ""}" max="${d.max || ""}"></label>${d.edicao ? `<label class="curto">ou edição nº<input type="number" name="ed" inputmode="numeric" min="${d.edicao.min}" max="${d.edicao.max}" placeholder="${d.edicao.max}" value="${vd.startsWith("e:") ? vd.slice(2) : ""}"></label>` : ""}<button class="btn btn-pri btn-peq" type="submit">Aplicar</button></form>` : "";
      const busca = d.busca ? `<input type="search" class="pop-busca" data-pop-busca placeholder="${esc(d.busca === true ? "Filtrar a lista" : d.busca)}" autocomplete="off">` : "";
      const rodape = d.tipo === "varios" ? `<div class="pop-rodape"><p class="nota">Dá para marcar mais de uma opção.</p><button type="button" class="btn btn-pri btn-peq" data-fechar-pop>Concluir</button></div>` : "";
      return `<div class="fd-pop-cab"><span class="alca"></span><button type="button" class="btn-ico" data-fechar-pop aria-label="Fechar">${ico("x")}</button></div><h3>${esc(d.titulo || d.rot)}</h3>${busca}${todosBtn}${datas}${datas && ops.length ? `<p class="pop-grupo">${esc(d.rotAtalhos || "Atalhos")}</p>` : ""}${corpo}${d.nota ? `<p class="nota">${d.nota}</p>` : ""}${d.tipo === "materia" ? `<div class="pop-rodape"><p class="nota">Marque quantas matérias e assuntos quiser; a lista reúne todos os marcados.</p><button type="button" class="btn btn-pri btn-peq" data-fechar-pop>Concluir</button></div>` : ""}${rodape}`;
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
      const d = defs[i]; d._nenhum = false;
      if (POPF.raiz !== raiz || POPF.i !== i) POPF.aberta = d.tipo === "materia" ? (listaMat(d.get())[0] || "").split("/")[0] : "";
      POPF.raiz = raiz; POPF.i = i;
      POPF.el.innerHTML = conteudo(d);
      const folha = matchMedia("(max-width: 860px)").matches;
      POPF.el.classList.toggle("folha", folha);
      POPF.el.classList.toggle("largo", d.tipo === "materia");
      if (!folha && botao) { const r = botao.getBoundingClientRect(), w = d.tipo === "materia" ? 676 : 416; POPF.el.style.left = `${Math.max(12, Math.min(r.left, innerWidth - w))}px`; POPF.el.style.top = `${r.bottom + 8}px`; }
      else { POPF.el.style.left = ""; POPF.el.style.top = ""; }
      if (botao && POPF.el.hidden) POPF.foco = botao; // o foco volta ao botão do filtro quando o painel fecha
      POPF.el.setAttribute("aria-label", d.titulo || d.rot || "Filtro");
      POPF.el.hidden = false; POPF.veu.hidden = !folha;
      requestAnimationFrame(() => { POPF.el.classList.add("vis"); POPF.veu.classList.add("vis"); });
      POPF.el.onclick = (e) => {
        if (e.target.closest("[data-fechar-pop]")) return fecharPopF();
        const ab = e.target.closest("[data-mt-abrir]");
        if (ab) { POPF.aberta = ab.dataset.mtAbrir; const top = $(".mt2-areas", POPF.el)?.scrollTop || 0; POPF.el.innerHTML = conteudo(d); const ar = $(".mt2-areas", POPF.el); if (ar) ar.scrollTop = top; const sb = $(".mt2-subs", POPF.el); if (sb) sb.scrollTop = 0; return; }
        const bt = e.target.closest("[data-op-todos]");
        const b = bt || e.target.closest("[data-op]"); if (!b) return;
        const o = bt ? null : (d.opcoes?.() || []).find((x) => String(x.v) === b.dataset.op); const val = bt ? "" : o ? o.v : b.dataset.op;
        const antes = JSON.stringify(d.get());
        if (multi(d)) {
          const sv = String(val);
          if (sv === "") { const eraTudo = tudo(d); porSel(d, []); d._nenhum = eraTudo; }
          else if (d._nenhum && !sv.startsWith("g|")) { d._nenhum = false; porSel(d, [sv]); }
          else if (d._nenhum) { d._nenhum = false; porSel(d, subsDoGrupo(...sv.split("|").slice(1))); }
          else if (d.tipo === "materia" && sv.startsWith("g|")) {
            const est = { tudo: tudo(d), nenhum: false, areas: matAreas(d) };
            porSel(d, alternarGrupoMat(selDe(d), sv, est)); if (est.nenhum) d._nenhum = true;
          }
          else if (tudo(d)) {
            // Todas marcadas: tocar numa a deixa de fora. Na matéria, um assunto sai e ficam os demais assuntos dela.
            if (d.tipo === "materia") { const areas = matAreas(d), c = d.cont ? d.cont() : null; const [a, sub] = sv.split("/"); const l = areas.filter((x) => x !== a); if (sub) l.push(...Object.keys(SUBAREAS[a] || {}).filter((k) => k !== sub && (!c || c[`${a}/${k}`])).map((k) => `${a}/${k}`)); porSel(d, l); }
            else porSel(d, opsReais(d).filter((x) => x !== sv));
          } else {
            const cur = selDe(d), nova = cur.includes(sv) ? cur.filter((x) => x !== sv) : [...cur, sv];
            const todos = d.tipo === "materia" ? matAreas(d) : opsReais(d);
            if (!nova.length) { d._nenhum = true; porSel(d, []); }
            else if (d.tipo !== "materia" && todos.every((x) => nova.includes(x))) porSel(d, []);
            else porSel(d, nova);
          }
        }
        else d.set(String(d.get() ?? "") === String(val) && !d.obrigatorio ? vazioDe(d) : val);
        const multiplo = multi(d);
        if (multiplo) travarAltura();
        desenhar(); if (!multiplo || JSON.stringify(d.get()) !== antes) aoMudar();
        // Filtros de escolha múltipla: o painel fica aberto, no mesmo lugar, para marcar outras opções.
        if (multiplo) redesenharPop(d); else fecharPopF();
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
      if (e.target.closest("[data-pil-limpar]")) { defs.forEach((d) => { if (!d.semLimpar) { d.set(vazioDe(d)); d._nenhum = false; } }); fecharPopF(); desenhar(); return aoMudar(); }
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
    // No celular o texto de ajuda não cabe no campo: fica só a parte principal (o texto completo vai no rótulo).
    const curto = matchMedia("(max-width: 700px)").matches ? ph.split(/\s+(?:Ex\.:|·)/)[0].replace(/\.$/, "").replace("número do processo", "nº do processo") : ph;
    return `<div class="campo-busca">${ico("pesquisa")}<input id="${id}" type="search" placeholder='${esc(curto)}'${curto !== ph ? ` aria-label='${esc(ph)}'` : ""} value="${esc(valor)}" autocomplete="off" spellcheck="false"></div>`;
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
    const ix = x.p?.length ? await numerosDe(x.p.map((p) => p.n)).catch(() => null) : null;
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
        ${campoBusca("if-q", 'Tema ou tese. Ex.: "adjudicação compulsória" ou prescri*', f.q)}
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
    const [ds] = await Promise.all([destaques(), prepararRefRep()]);
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
      { rot: "Relevância", tipo: "um", get: () => f.n, set: (v) => (f.n = v), opcoes: () => [{ v: "", t: "Relevantes e alta", ponto: "rel" }, { v: "alta", t: "Só sinal forte de relevância", curto: "Sinal forte", ponto: "alta" }],
        nota: "Sinal forte de relevância: 10 pontos ou mais na classificação automática (veja Sobre). A pontuação indica prioridade de leitura, não a força vinculante do precedente." },
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
    // Lista completa de relatores e classes (com os totais do acervo), carregada em segundo plano.
    if (D.man.busca?.facetas && !D.facR) { facetaIB("r").then((d) => { if (d) D.facR = d; }); facetaIB("c").then((d) => { if (d) D.facC = d; }); }
    const F = AC.f = {
      p: p.get("p") || "todo", o: p.get("o") || "", a: p.get("a") || "", c: p.get("c") || "", rl: p.get("rl") || "", n: p.get("n") || "",
      s: p.get("s") || "auto", r: p.get("r") !== "0", x: p.get("x") === "1", t: p.get("t") === "1", se: p.get("se") === "1",
    };
    if (!mesma || !$("#ac-q")) {
      const meses = D.man.meses;
      main.innerHTML = `
        <div id="ac-f">
          <div class="busca-linha">${campoBusca("ac-q", 'Termos ou número do processo. Ex.: "prova oral" e nulidade · REsp 2.231.419')}<button type="button" class="btn btn-pri" id="ac-ir">${ico("pesquisa")}<span>Pesquisar</span></button></div>
          <div class="fd-filtros filtros-lista" id="ac-pil"></div>
        </div>
        <div class="barra-res"><p id="ac-info" aria-live="polite"></p><div class="progresso" id="ac-prog" hidden><i></i></div>
          <button type="button" class="btn btn-fant btn-peq" id="ac-link">${ico("link")} Copiar link</button></div>
        <p class="cobertura" id="ac-cob">${coberturaHTML()}</p>
        <div id="ac-mono-stj"></div>
        <div id="ac-extra"></div>
        <ol class="lista" id="ac-lista"></ol>
        <div id="ac-pag"></div>`;
      const anosAc = [...new Set(meses.map((m) => m.m.slice(0, 4)))];
      const primeiro = meses.length ? meses[meses.length - 1].m : "";
      const periodos = [{ v: "todo", t: `Todo o acervo (desde ${primeiro ? fmtMesL(primeiro) : "—"})`, curto: "Todo o acervo" },
        { v: "u1", t: `Último mês (${meses[0] ? fmtMes(meses[0].m) : "—"})`, curto: "Último mês" }, { v: "u3", t: "Últimos 3 meses" }, { v: "u6", t: "Últimos 6 meses" }, { v: "u12", t: "Últimos 12 meses" }, { v: "u24", t: "Últimos 2 anos" },
        ...anosAc.slice(1).map((a) => ({ g: "desde", v: `desde:${a}`, t: `Desde ${a}`, curto: `Desde ${a}` }))];
      if (D.man.radar?.mesN) periodos.splice(1, 0, { v: "mes", t: `Publicados em ${rotMesCorrente()}, ainda sem o arquivo mensal (${fmtInt(D.man.radar.mesN)})`, curto: `Publicados em ${rotMesCorrente()}` });
      const rotPerAc = (v) => { if (/^d:/.test(v)) { const [, de, ate] = v.split(":"); return `${de ? fmtData(de) : "início"} a ${ate ? fmtData(ate) : "hoje"}`; } return "Período"; };
      AC.pil = pilulas($("#ac-pil"), [
        { rot: "Período", titulo: "Período de publicação", tipo: "um", padrao: "todo", obrigatorio: true, semLimpar: true, rotAtual: () => "Todo o acervo", rotValor: rotPerAc, get: () => AC.f.p, set: (v) => (AC.f.p = v), opcoes: () => periodos,
          datas: "intervalo", min: primeiro ? `${primeiro}-01` : "", max: hojeISO(), rotAtalhos: "Atalhos",
          grupos: [["", ""], ["desde", "Desde o ano"]],
          nota: `O acervo vai de ${primeiro ? fmtMesL(primeiro) : "—"} a ${meses.length ? fmtMesL(meses[0].m) : "—"}. Em períodos longos, a busca percorre os arquivos mês a mês e mostra os resultados à medida que avança; pode levar alguns minutos e é possível parar a qualquer momento. A busca por número de processo sempre percorre todo o acervo.` },
        { rot: "Matéria", tipo: "materia", get: () => AC.f.a, set: (v) => (AC.f.a = v) },
        { rot: "Órgão", tipo: "varios", vertical: true, get: () => AC.f.o, set: (v) => (AC.f.o = v), opcoes: () => [{ v: "", t: "Todos os órgãos" }, ...Object.entries(D.orgaos).map(([k, v]) => ({ v: k, t: v }))] },
        { rot: "Classe", titulo: "Classe processual", tipo: "varios", busca: "Buscar classe. Ex.: REsp, AgInt, HC", get: () => AC.f.c, set: (v) => (AC.f.c = v),
          opcoes: () => { const tot = D.facC ? new Map(Object.values(D.facC).map(([c, n]) => [c, n])) : AC.cls; return [{ v: "", t: "Todas as classes" }, ...[...tot].sort((a, b) => b[1] - a[1]).slice(0, 150).map(([c, n]) => ({ v: c, t: c, n })), ...listaV(AC.f.c).filter((c) => !tot.has(c)).map((c) => ({ v: c, t: c }))]; },
          nota: "Classes do acervo, das mais frequentes às menos, com o total de acórdãos. REsp: recurso especial; AgInt: agravo interno; EREsp: embargos de divergência; HC: habeas corpus." },
        { rot: "Relator", titulo: "Relator(a)", tipo: "varios", vertical: true, busca: "Buscar ministro(a)", get: () => AC.f.rl, set: (v) => (AC.f.rl = v),
          opcoes: () => { const tot = D.facR ? new Map(Object.values(D.facR).map(([r, n]) => [r, n])) : AC.rels; return [{ v: "", t: "Todos os relatores" }, ...[...tot.keys(), ...listaV(AC.f.rl).filter((r) => ![...tot.keys()].some((k) => norm(k) === norm(r)))].sort((a, b) => norm(a).localeCompare(norm(b))).map((r) => ({ v: r, t: relatorFmt(r), n: tot.get(r) }))]; },
          nota: "Todos os relatores do acervo, inclusive ministros aposentados e desembargadores convocados, com o total de acórdãos de cada um." },
        { rot: "Processo", tipo: "texto", ph: "Número. Ex.: 2222623", get: () => AC.f.n, set: (v) => (AC.f.n = digitos(v)) },
        { rot: "Exibir", titulo: "Quais acórdãos exibir", tipo: "um", padrao: "", obrigatorio: true, rotAtual: () => "Exibir: sem rotina",
          get: () => (AC.f.t ? "tese" : AC.f.x ? "dest" : AC.f.r ? "" : "tudo"),
          set: (v) => { AC.f.t = v === "tese"; AC.f.x = v === "dest"; AC.f.r = v !== "tudo"; },
          opcoes: () => [{ v: "", t: "Sem decisões de rotina (padrão)", curto: "Exibir: sem rotina" }, { v: "tudo", t: "Todas as decisões, inclusive de rotina", curto: "Exibir: tudo" },
            { v: "tese", t: "Só acórdãos com tese", curto: "Exibir: só com tese" }, { v: "dest", t: "Só destaques (relevantes)", curto: "Exibir: só destaques" }],
          nota: "<b>Decisões de rotina</b> são acórdãos que apenas aplicam óbices já conhecidos, sem examinar o mérito: Súmula 7/STJ (reexame de provas), Súmulas 282 a 284/STF, falta de impugnação específica, embargos de declaração rejeitados. Ficam ocultas por padrão para não encobrir os julgados úteis. <b>Destaques</b> são os acórdãos classificados como relevantes (veja Sobre)." },
        ...(D.man.radar?.mesN ? [{ rot: "Incluir sem ementa", tipo: "toggle", get: () => AC.f.se, set: (v) => (AC.f.se = v),
          dica: `Inclui os acórdãos publicados em ${rotMesCorrente()} que ainda não têm ementa (o STJ a divulga no arquivo mensal, no início do mês seguinte)` }] : []),
        defOrdem(() => AC.f.s, (v) => (AC.f.s = v), [{ v: "auto", t: "Automática" }, { v: "rel", t: "Mais relevantes" }, { v: "data", t: "Publicação mais recente" }, { v: "julg", t: "Julgamento mais recente" }],
          "Automática: com termos de busca, os mais aderentes primeiro; sem termos, os publicados mais recentemente."),
      ], () => buscar());
      // A consulta começa só com Enter ou o botão "Pesquisar" (ou ao limpar o campo), não a cada letra.
      $("#ac-q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } });
      $("#ac-q").addEventListener("search", (e) => { if (!e.target.value) buscar(); });
      $("#ac-ir").addEventListener("click", () => buscar());
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
    if (p === "mes") return [];
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
  // Filtros de relator, classe e matéria: arquivos mensais em que cada valor aparece.
  const facetaIB = (t) => { const k = `_${t}`; if (!IB.has(k)) IB.set(k, getJSON(`data/busca/_${t}.json`).catch(() => null)); return IB.get(k); };
  async function idsFacetasIB(f, meta) {
    if (!meta.facetas) return null;
    let acc = null;
    const unir = (d, casa, pega) => { const u = new Set(); for (const k in d) if (casa(k)) for (const x of postIB(pega(d[k]))) u.add(x); return u; };
    const rel = listaV(f.rl).map(norm), cls = listaV(f.c).map(norm), mat = listaMat(f.a);
    if (rel.length) { const d = await facetaIB("r"); if (d) acc = interIB(acc, unir(d, (k) => rel.some((x) => k === x || k.includes(x)), (v) => v[2])); }
    if (cls.length) { const d = await facetaIB("c"); if (d) acc = interIB(acc, unir(d, (k) => cls.includes(k), (v) => v[2])); }
    if (mat.length) { const d = await facetaIB("m"); if (d) acc = interIB(acc, unir(d, (k) => mat.includes(k), (v) => v)); }
    return acc;
  }
  async function filtrarPorIndice(cons, pares, f = {}) {
    const meta = D.man.busca;
    if (!meta?.partes?.length || meta.v !== 2) return pares;
    let ids = null;
    try {
      if (!cons.vazio) ids = await idsNoIB(cons.ast, meta);
      ids = interIB(ids, await idsFacetasIB(f, meta));
    } catch { return pares; }
    if (!ids) return pares;
    const oi = new Map(meta.orgs.map((o, i) => [o, i]));
    return pares.filter(([m, o]) => {
      if (m < meta.de || m > meta.ate || !oi.has(o)) return true; // mês ainda fora do índice
      const id = ((+m.slice(0, 4) - meta.base) * 12 + (+m.slice(5, 7) - 1)) * meta.orgs.length + oi.get(o);
      return ids.has(id);
    });
  }
  const rotPeriodo = (p, meses) => (p === "mes" ? "os publicados no mês corrente" : p === "todo" ? "todo o acervo" : /^desde:/.test(p) ? `desde ${p.slice(6)}` : /^a:\d{4}$/.test(p) ? `ano de ${p.slice(2)}` : meses.length === 1 ? fmtMesL(meses[0]) : meses.length ? `${fmtMes(meses[meses.length - 1])} a ${fmtMes(meses[0])}` : "período sem acórdãos");
  async function buscar() {
    const tk = ++AC.token;
    const refRep = prepararRefRep();
    AC.mostrouParcial = false;
    $("#ac-lista")?.setAttribute("aria-busy", "true");
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
      const ix = await numerosDe([f.n], f.n.length >= 10 ? [f.n] : []).catch(() => null);
      if (ix) {
        // Com a classe digitada ("AREsp 123456"), fica só com os processos dessa classe (se houver).
        let hit = ix.l;
        if (clNum) { const cb = classeBase(clNum).toLowerCase(); const so = hit.filter((x) => x[5] === undefined || x[5].toLowerCase() === cb); if (so.length) hit = so; }
        ids = new Set(hit.map((x) => String(x[4])));
        const vistos = new Set();
        for (const x of hit) { const k = `${ix.m[x[2]]}|${ix.o[x[3]]}`; if (!vistos.has(k) && temV(f.o, ix.o[x[3]])) { vistos.add(k); pares.push([ix.m[x[2]], ix.o[x[3]]]); } }
        meses = [...new Set(pares.map((x) => x[0]))].sort().reverse();
      } else meses = todos;
    }
    if (!ids) for (const m of meses) { const info = D.man.meses.find((x) => x.m === m); for (const o of orgs) if (info?.orgaos[o]) pares.push([m, o]); }
    const cons = Busca.compilar(f.q);
    AC.ctrl?.abort(); const ctrl = AC.ctrl = new AbortController();
    const prog0 = $("#ac-prog"); prog0.hidden = true; $("#ac-extra").innerHTML = "";
    // Poucas letras: espera o usuário completar o termo.
    if (!cons.vazio && !f.n && f.q.replace(/[^\p{L}\p{N}]/gu, "").length < 3) {
      $("#ac-info").textContent = "Digite ao menos três letras para pesquisar.";
      $("#ac-lista").removeAttribute("aria-busy");
      return;
    }
    // Período "mês corrente": só os acórdãos publicados e ainda fora do arquivo mensal.
    if (f.p === "mes") {
      const lista = await itensMes(f, cons, listaV(f.c).map(norm), listaV(f.rl).map(norm), true);
      if (tk !== AC.token) return;
      const porRel = !cons.vazio && f.s === "auto";
      AC.lista = lista.sort(porRel ? (a, b) => b._sc - a._sc || b.dj.localeCompare(a.dj) : (a, b) => b.dj.localeCompare(a.dj)); AC.termos = cons.termos;
      $("#ac-info").innerHTML = `<b>${fmtInt(lista.length)}</b> acórdão(s) publicado(s) desde ${fmtData(D.man.radar?.mesDe || "")}, ainda sem o arquivo mensal do STJ${f.o ? " nos órgãos escolhidos" : ""}${f.se ? "" : ", só os que já têm ementa"} · ${porRel ? "por relevância" : "mais recentes primeiro"}.${f.se ? "" : ` Para ver também os ${fmtInt((D.man.radar?.mesN || 0) - (D.man.radar?.mesEm || 0))} ainda sem ementa, ative “Incluir sem ementa”.`}${cons.vazio ? "" : " A busca por palavras só alcança os que já têm a ementa pelo texto integral."}${f.a || f.x || f.t ? " Os filtros de matéria, relevância e tese não se aplicam a eles." : ""} O órgão é estimado pelo relator até a chegada do arquivo mensal. ${explicacaoHTML(cons)}`;
      renderLista(true);
      return;
    }
    // Sem termo nem filtro: mostra os acórdãos mais recentes de cada órgão (arquivo pequeno), sem
    // baixar os arquivos mensais. A consulta ao acervo começa quando houver termo ou filtro.
    const inicial = cons.vazio && !f.n && !f.a && !f.c && !f.rl && !f.x && !f.t && f.r && (f.s === "auto" || f.s === "data") && (f.p === "todo" || /^u\d+$/.test(f.p));
    if (inicial) {
      const [rec, rm] = await Promise.all([carregar("recentes").catch(() => null), D.man.radar?.mesN ? carregar("radar-recentes").catch(() => []) : []]);
      if (tk !== AC.token) return;
      if (rec) {
        const lista = rec.filter((r) => temV(f.o, r.o)).sort((a, b) => (b.dj || "").localeCompare(a.dj || "") || (b.s ?? 0) - (a.s ?? 0));
        const m10 = (rm || []).filter((x) => doMes(x) && temV(f.o, x.tr) && (f.se || x.em)).slice(0, 10).map((x) => pseudoMes(x, x.em));
        AC.lista = [...m10, ...agrupar(lista.map((r) => Object.assign(r, { _dup: [] })))]; AC.termos = [];
        $("#ac-info").innerHTML = `Acórdãos publicados mais recentemente${f.o ? " nos órgãos escolhidos" : ""}. Digite termos ou use os filtros para pesquisar em ${esc(rotPeriodo(f.p, meses))}.${m10.length ? ` Os ${m10.length} primeiros saíram em ${rotMesCorrente()} e ainda não têm o arquivo mensal do STJ${f.se ? "" : "; a ementa vem do texto integral publicado pelo Tribunal"}.` : ""} <button type="button" class="link-acao" id="ac-ver-mes">Ver os publicados em ${rotMesCorrente()}</button>`;
        $("#ac-ver-mes")?.addEventListener("click", () => { AC.f.p = "mes"; AC.pil?.desenhar(); buscar(); });
        renderLista(true);
        return;
      }
    }
    const paresTodos = pares.length;
    // A partir daqui a consulta percorre o acervo: a lista anterior sai da tela, para que só
    // apareçam resultados já confirmados para esta pesquisa.
    AC.lista = []; $("#ac-pag").innerHTML = "";
    $("#ac-lista").setAttribute("aria-busy", "true");
    $("#ac-lista").innerHTML = `<li class="busca-aguarda"><span class="spinner" aria-hidden="true"></span>Procurando no acervo. Os resultados aparecem aqui assim que forem confirmados.</li>`;
    if (!ids && pares.length > 12 && (!cons.vazio || f.rl || f.c || f.a)) {
      $("#ac-info").textContent = "Consultando o índice…";
      pares = await filtrarPorIndice(cons, pares, f);
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
    let cortado = false, falhas = 0, examinados = pares.length;
    AC.parar = 0;
    if (!longo) {
      const pend = pares.filter(([m, o]) => !D.shards.has(`${m}/${o}`)).length;
      if (pend) { prog.hidden = false; prog.firstElementChild.style.width = "0"; $("#ac-info").textContent = `Carregando ${pares.length} arquivo(s)…`; }
      const dados = await carregarShards(pares, (a, b) => { if (tk === AC.token) prog.firstElementChild.style.width = `${(a / b) * 100}%`; });
      if (tk !== AC.token) return;
      falhas = dados.falhas.length;
      consumir(dados);
    } else {
      // Período longo: percorre os arquivos do mais recente ao mais antigo, sem guardá-los na memória.
      prog.hidden = false; prog.firstElementChild.style.width = "0";
      let i = 0, feitos = 0, mesAt = pares[0]?.[0] || "";
      let tInfo = 0;
      const mostrar = (fim) => {
        if (tk !== AC.token) return;
        tInfo = Date.now();
        prog.firstElementChild.style.width = `${(feitos / pares.length) * 100}%`;
        if (fim) return;
        const novos = desenhados ? res.length - desenhados : 0;
        $("#ac-info").innerHTML = `<b>Busca em andamento</b> · ${fmtInt(total)} resultado(s) confirmado(s) · ${fmtInt(feitos)} de ${fmtInt(pares.length)} arquivos mensais ${pares.length < paresTodos ? "com os termos " : ""}examinados (${Math.round((feitos / pares.length) * 100)}%, agora em ${fmtMesL(mesAt)}) ${novos > 0 ? `<button type="button" class="btn btn-claro btn-peq" id="ac-novos">Mostrar ${fmtInt(novos)} novo(s)</button> ` : ""}<button type="button" class="btn btn-fant btn-peq" id="ac-parar">Parar</button>`;
        $("#ac-parar")?.addEventListener("click", () => { AC.parar = tk; });
        $("#ac-novos")?.addEventListener("click", () => { desenharParcial(); mostrar(); });
      };
      // Lista parcial: só com resultados confirmados. Os primeiros aparecem assim que chegam; depois,
      // a lista fica parada (para não mudar o que o usuário está lendo) e os novos entram pelo botão
      // "Mostrar N novo(s)" ou ao fim da busca.
      let desenhados = 0;
      const desenharParcial = () => {
        if (tk !== AC.token) return;
        desenhados = res.length; AC.mostrouParcial = true;
        res.sort(ord); AC.lista = agrupar(res.slice(0, 500).map((r) => Object.assign(r, { _dup: [] }))); AC.termos = cons.termos; renderLista(true);
        $("#ac-lista").setAttribute("aria-busy", "true");
      };
      const parcialLista = () => { if (!desenhados && res.length) { desenharParcial(); mostrar(); } };
      const trab = async () => {
        while (i < pares.length && tk === AC.token && AC.parar !== tk) {
          if (ordem !== "rel" && res.length >= MAX_RES) { cortado = true; break; }
          const [m, o] = pares[i++]; mesAt = m;
          let l = [];
          try { l = D.shards.has(`${m}/${o}`) ? await shard(m, o) : await getJSONgz(`data/acordaos/${m}/${o}.json`, ctrl.signal); } catch { if (!ctrl.signal.aborted && tk === AC.token) falhas++; }
          if (tk !== AC.token) return;
          consumir(l); feitos++;
          if (feitos % 10 === 0 || Date.now() - tInfo > 1000) mostrar();
          parcialLista();
        }
      };
      mostrar();
      await Promise.all(Array.from({ length: Math.min(6, pares.length) }, trab));
      if (tk !== AC.token) return;
      examinados = feitos;
    }
    prog.hidden = true;
    res.sort(ord); if (res.length > MAX_RES) res.length = MAX_RES;
    AC.lista = agrupar(res.map((r) => Object.assign(r, { _dup: [] }))); AC.termos = cons.termos;
    const baseN = total > res.length ? total : AC.lista.length;
    const nAgr = AC.lista.length;
    let nMes = 0;
    if (!f.n && mesInclui(f.p)) {
      const mes = await itensMes(f, cons, clsSel, relSel);
      if (tk !== AC.token) return;
      if (mes.length) { nMes = mes.length; AC.lista = [...AC.lista, ...mes].sort(ord); }
    }
    // Processo ainda sem ementa no acervo: publicações recentes no DJEN e sessões marcadas.
    const extra = $("#ac-extra"); extra.innerHTML = "";
    const monoSTJ = $("#ac-mono-stj"); if (monoSTJ) monoSTJ.innerHTML = "";
    let monos = [];
    if (f.n) {
      const [dj, pl, mn] = await Promise.all([djen().catch(() => []), pautas().catch(() => []), monocraticasDe([f.n], f.n.length >= 10 ? [f.n] : []).catch(() => [])]);
      // Com a classe digitada, só as monocráticas dessa classe (se houver).
      monos = mn; if (clNum) { const cb = classeBase(clNum).toLowerCase(); const so = mn.filter((x) => x.cl.toLowerCase() === cb); if (so.length) monos = so; }
      if (tk !== AC.token) return;
      const casaN = (p, reg) => { const d = digitos(p); return d === f.n || reg === f.n || (f.n.length >= 6 && d.includes(f.n)); };
      const noAcervo = new Set(res.map((r) => `${r.reg}|${r.dj}`));
      const pubs = dj.filter((x) => casaN(x.p, x.reg) && !noAcervo.has(`${x.reg}|${x.d}`)).sort((a, b) => b.d.localeCompare(a.d));
      const sess = pl.filter((x) => x.d >= hojeISO() && casaN(x.p, x.reg)).sort((a, b) => a.d.localeCompare(b.d));
      const emsN = pubs.some((x) => x.q) ? await ementasMes() : {};
      if (tk !== AC.token) return;
      if (pubs.length || sess.length) {
        extra.innerHTML = `<p class="nota extra-tit">${pubs.length ? `<b>Publicado recentemente no DJEN</b> · ainda sem ementa no arquivo mensal do STJ` : ""}${pubs.length && sess.length ? " · " : ""}${sess.length ? "<b>Em pauta</b>" : ""}</p>
          <ol class="lista">${sess.map((x) => cardPauta(x)).join("")}${pubs.map((x) => cardDjen(x, { em: emsN[x.q] || "" })).join("")}</ol>`;
      }
      // A aba "Decisões" da consulta processual lista todas as decisões do processo, inclusive as
      // monocráticas anteriores a 2021 (a base aberta do STJ começa em 2021). Fica no alto do resultado.
      const procs = new Map();
      for (const r of res) if (r.reg && !procs.has(r.reg)) procs.set(r.reg, `${classeBase(r.cl)} ${fmtNumProc(digitos(r.n))}`);
      for (const x of monos) if (x.reg && !procs.has(x.reg)) procs.set(x.reg, `${x.cl} ${fmtNumProc(x.n)}`);
      if (!procs.size && f.n.length >= 10) procs.set(f.n, fmtNumProc(f.n));
      const lp = [...procs].slice(0, 3);
      if (lp.length && monoSTJ) {
        const antigo = lp.some(([reg]) => reg.slice(0, 4) < "2021");
        monoSTJ.innerHTML = `<div class="mono-stj">${ico("arquivo")}<span>Todas as decisões ${lp.length > 1 ? "destes processos" : "deste processo"} no STJ${antigo ? ", inclusive as monocráticas anteriores a 2021" : ", inclusive as monocráticas não terminativas"}:</span>
          ${lp.map(([reg, rot]) => `<a class="btn btn-claro btn-peq" href="${URLS.processo(reg)}" target="_blank" rel="noopener" title="Abre a consulta processual do STJ; as decisões ficam na aba “Decisões”">${lp.length > 1 ? `${esc(rot)} · ` : ""}Decisões do processo ${ico("externo")}</a>`).join("")}</div>`;
      }
      if (monos.length) extra.insertAdjacentHTML("beforeend", `<p class="nota extra-tit"><b>Decisões monocráticas neste processo</b> · ${fmtInt(monos.length)} · desde 2021, sem o texto: o número abre a decisão oficial no STJ</p>
          <ol class="lista">${monos.slice(0, 60).map(cardMono).join("")}</ol>`);
    }
    const rot = f.n ? `processo ${fmtNumProc(f.n)} em todo o acervo${extra.querySelector(".item-djen, .item-radar:not(.item-mono)") ? " e no DJEN" : ""}${monos.length ? ` · ${fmtInt(monos.length)} decisão(ões) monocrática(s) abaixo` : ""}` : rotPeriodo(f.p, meses);
    const interrompida = AC.parar === tk;
    const parcial = interrompida ? ` · <b>busca interrompida</b>: ${fmtInt(examinados)} de ${fmtInt(pares.length)} arquivos mensais examinados, os resultados estão incompletos` : "";
    const situacao = interrompida || f.n ? "" : longo ? "<b>Busca completa</b> · " : "";
    const corte = total > res.length && !cortado ? ` · exibindo os ${fmtInt(res.length)} ${ordem === "rel" ? "mais aderentes" : "mais recentes"}` : "";
    // Com o índice, só são lidos os arquivos mensais que contêm os termos: a busca continua completa.
    const lidosIB = pares.length < paresTodos ? ` · ${fmtInt(paresTodos)} arquivos mensais verificados pelo índice, ${fmtInt(pares.length)} lidos por conterem os termos` : "";
    const agrupados = total > nAgr && total <= res.length ? ` · ${fmtInt(total - nAgr)} publicação(ões) repetida(s) agrupada(s)` : "";
    // Arquivos que não puderam ser baixados: a lista está incompleta, e o usuário precisa saber.
    const avisoFalha = falhas ? `<span class="aviso-falha" role="alert">${ico("alerta")} ${falhas === 1 ? "1 arquivo mensal não pôde ser consultado" : `${fmtInt(falhas)} arquivos mensais não puderam ser consultados`}; os resultados podem estar incompletos. <button type="button" class="btn btn-claro btn-peq" id="ac-denovo">Tentar novamente</button></span>` : "";
    if (f.n && !AC.lista.length && extra.innerHTML) $("#ac-info").innerHTML = `Processo <b>${fmtNumProc(f.n)}</b>: sem acórdão no acervo. Veja abaixo ${monos.length ? "as decisões monocráticas" : "a publicação no DJEN"}${monos.length && extra.querySelector(".item-djen, .item-radar") ? " e as demais publicações" : ""}.`;
    else if (cortado) $("#ac-info").innerHTML = `Exibindo os <b>${fmtInt(res.length)}</b> acórdãos ${ordem === "julg" ? "julgados mais recentemente" : "mais recentes"} (limite da consulta; use os filtros para refinar) · ${rot}${lidosIB}${parcial}${f.r ? " · rotina oculta" : ""} ${explicacaoHTML(cons)}`;
    else $("#ac-info").innerHTML = `${situacao}<b>${fmtInt(baseN + nMes)}</b> resultado(s)${corte}${agrupados} · ${rot}${lidosIB}${parcial}${f.r ? " · rotina oculta" : ""} · ${ordem === "rel" ? "por relevância" : ordem === "julg" ? "por data de julgamento" : "mais recentes primeiro"} ${explicacaoHTML(cons)}`;
    if (nMes) $("#ac-info").insertAdjacentHTML("beforeend", ` <span class="nota-mes">Inclui ${fmtInt(nMes)} publicado(s) em ${rotMesCorrente()}, ainda sem o arquivo mensal do STJ${f.se && cons.vazio ? "" : ", com a ementa tirada do texto integral"}.</span>`);
    if (avisoFalha) { $("#ac-info").insertAdjacentHTML("beforeend", avisoFalha); $("#ac-denovo").addEventListener("click", () => buscar()); }
    await refRep; if (tk !== AC.token) return;
    // Se o usuário já está lendo a lista parcial, ela não é trocada de repente: um botão aplica a
    // ordem final.
    const ulF = $("#ac-lista");
    const lendo = AC.mostrouParcial && window.scrollY > ulF.getBoundingClientRect().top + window.scrollY - 160;
    if (lendo) {
      $("#ac-info").insertAdjacentHTML("beforeend", ` <button type="button" class="btn btn-claro btn-peq" id="ac-final">Ver a lista completa na ordem final</button>`);
      ulF.removeAttribute("aria-busy");
      $("#ac-final").addEventListener("click", () => { renderLista(true); ulF.scrollIntoView({ block: "start" }); });
    } else renderLista(true);
  }
  // Acórdãos do mês corrente: publicados no DJEN e ainda fora do arquivo mensal do STJ (que traz a
  // ementa). Entram na mesma lista da Pesquisa, com etiqueta própria; os que já têm o texto integral
  // trazem a ementa e respondem à busca por palavras.
  const ultMesAc = () => (D.man.meses?.[0]?.m || "").replace("-", "");
  const doMes = (x) => String(x.d || "").replace(/-/g, "").slice(0, 6) > ultMesAc();
  function mesInclui(p) {
    const de = D.man.radar?.mesDe || "";
    if (!de) return false;
    if (p === "todo" || p === "mes" || /^u\d+$/.test(p) || /^desde:/.test(p)) return true;
    if (/^a:\d{4}$/.test(p)) return p.slice(2) === de.slice(0, 4);
    if (/^d:/.test(p)) { const ate = p.split(":")[2]; return !ate || ate >= de; }
    return false;
  }
  const PREP = new Set(["no", "na", "nos", "nas", "em"]);
  const palCl = (c) => norm(c).split(/\s+/).filter((w) => w && !PREP.has(w));
  const pseudoMes = (x, em) => ({ _mes: x, _em: em || "", dj: x.d, id: `m|${x.reg}|${x.d}|${x.r || ""}`, _sc: 0 });
  async function itensMes(f, cons, clsSel, relSel, ignorarMat = false) {
    if (!ignorarMat && (f.a || f.x || f.t)) return [];
    const [dj, ems] = await Promise.all([djen().catch(() => []), ementasMes()]);
    const temTexto = !cons.vazio, clsP = clsSel.map(palCl);
    const out = [];
    for (const x of dj) {
      if (!doMes(x) || !temV(f.o, x.tr)) continue;
      if (clsP.length) { const pc = palCl(`${x.r || ""} ${String(x.p || "").replace(/\s*\d.*$/, "")}`); if (!clsP.some((c) => c.join(" ") === pc.join(" "))) continue; }
      if (relSel.length) { const nr = norm(x.rel || ""); if (!relSel.some((r) => nr === r || nr.includes(r))) continue; }
      const em = x.q ? ems[x.q] || "" : "";
      if (!em && !f.se) continue;
      const it = pseudoMes(x, em);
      if (temTexto) {
        if (!em) continue;
        const doc = norm(em); if (!cons.testa(doc)) continue;
        const i = doc.indexOf("\n"); it._sc = cons.pontua(doc, doc.slice(0, i > 0 ? i : 400));
      }
      out.push(it);
    }
    return out;
  }
  const rotMesCorrente = () => { const de = D.man.radar?.mesDe || ""; return de ? MESES_L[+de.slice(5, 7) - 1] : "este mês"; };
  const pgAc = paginador("ac", () => renderLista(false), "#ac-lista");
  function renderLista(reset) {
    const ul = $("#ac-lista");
    ul.removeAttribute("aria-busy");
    if (reset) pgAc.pag = 1;
    ul.innerHTML = pgAc.fatia(AC.lista).map((r) => (r._mes ? cardDjen(r._mes, { em: r._em, mes: true }) : cardAcordao(r, { termos: AC.termos }))).join("");
    $("#ac-pag").innerHTML = pgAc.html(AC.lista.length);
    if (!AC.lista.length && $("#ac-extra")?.innerHTML) ul.innerHTML = "";
    else if (!AC.lista.length) ul.innerHTML = vazio("pesquisa", "Nenhum acórdão encontrado", "Amplie o período, escolha “Exibir: tudo” para incluir as decisões de rotina ou revise os termos. Toque em “?” para ver como combinar palavras.");
  }

  // ======================================================= RESUMO DA SEMANA
  const segundaDe = (iso) => { const d = new Date(iso + "T12:00:00Z"); return somaDias(iso, -((d.getUTCDay() + 6) % 7)); };
  const fmtCurta = (iso) => { const d = new Date(iso + "T12:00:00Z"); return `${d.getUTCDate()} de ${MESES_L[d.getUTCMonth()]}`; };
  const TIPOS_SEM = {
    teses: { rot: "Teses firmadas", selo: "Tese firmada", cls: "ok", longo: "Teses firmadas em repetitivos" },
    julgtema: { rot: "Julgados, tese a publicar", selo: "Julgado · tese a publicar", cls: "acomp", longo: "Temas julgados, com a tese ainda por publicar" },
    info: { rot: "Informativo", selo: "Informativo", cls: "info", longo: "Notas do Informativo do STJ" },
    afet: { rot: "Temas afetados", selo: "Tema afetado", cls: "rel", longo: "Novos temas afetados" },
    julg: { rot: "Julgados com tese", selo: "Julgado", cls: "pri", longo: "Julgados com tese publicados" },
    sum: { rot: "Súmulas", selo: "Súmula", cls: "acomp", longo: "Súmulas aprovadas" },
    prox: { rot: "Temas em pauta", selo: "Em pauta", cls: "alta", longo: "Temas repetitivos em pauta na semana seguinte" },
    proxc: { rot: "Controvérsias em pauta", selo: "Em pauta", cls: "alta", longo: "Controvérsias e outros precedentes em pauta na semana seguinte" },
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
        if (x.tp === "Tema" && na(x.julg) && (x.tese || x._teseAguarda)) out.push({ tp: x.tese ? "teses" : "julgtema", d: x.julg, ds: [["Julgado", x.julg], ["Acórdão publicado", x.pub], ["Afetado", x.afet]], ar: x.ar, sa: x.sa, k: `${x.tp} ${fmtNumProc(x.n)} · ${x.org || ""}`, t: x.tese ? limparTeseTxt(x.tese) : "Julgado; a tese será divulgada com a publicação do acórdão.", m: `${x.tp} ${fmtNumProc(x.n)} · ${x.org || ""}`, ab: `t:${x.n}`, txt: `${x.tp} ${x.n}/STJ: ${x.tese || "julgado; tese a publicar"}` });
        if (na(x.afet) && x.q) out.push({ tp: "afet", d: x.afet, ds: [["Afetado", x.afet]], ar: x.ar, sa: x.sa, k: `${x.tp} ${fmtNumProc(x.n)} · ${x.org || ""}`, t: x.q, m: `${x.tp} ${fmtNumProc(x.n)} · ${x.org || ""}${/suspens/i.test(x.info || "") ? " · com suspensão de processos" : ""}`, ab: `t:${x.tp}|${x.n}`, txt: `${x.tp} ${x.n}/STJ (afetado): ${x.q}` });
      }
      for (const x of inf) if (na(x.d) && !/afeta/i.test(x.sec)) out.push({ tp: "info", d: x.d, ds: [["Julgado", x.julg], ["DJEN", (() => { const m = /DJEN?\s*(?:de\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(x.proc || ""); const iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; return iso && (!x.julg || iso >= x.julg) ? iso : ""; })()], [`Informativo ${x.ed}`, x.d]], ar: x.ar, sa: x.sa, k: x.tema.replace(/\s*Tema\s+\d[\d.]*\.?\s*$/i, "").replace(/\.$/, ""), t: x.t, m: `${x.p?.[0] ? `${x.p[0].cl} ${fmtNumProc(x.p[0].n)} · ` : ""}${x.org || x.sec} · Informativo ${x.ed}`, ab: `i:${x.id}`, txt: `${x.tema} ${x.t.replace(/\n/g, " ")} (${x.p?.[0] ? `${x.p[0].cl} ${fmtNumProc(x.p[0].n)}, ` : ""}${x.org || x.sec}; Informativo ${x.ed})` });
      for (const r of fj) if (na(r.dj) && (r.tese || r.tj)) out.push({ tp: "julg", d: r.dj, ds: [["Julgado", r.dd], ["Publicado", r.dj]], s: r.fs ?? r.s ?? 0, ar: r.ar, sa: r.sa, k: r.as ? frase(r.as).replace(/\.\s+(?=\p{Lu})/gu, " · ") : `${r.cl} ${fmtNumProc(r.n)}`, t: limparTeseTxt(r.tese || r.tj), m: `${r.cl} ${fmtNumProc(r.n)} · ${D.orgaos[r.o] || ""}${r.rel ? ` · ${relatorFmt(r.rel)}` : ""}`, ab: `a:${r.id}`, txt: `${String(r.tese || r.tj).replace(/\n+/g, " ")} (${r.cl} ${fmtNumProc(r.n)}, ${D.orgaos[r.o] || ""})`, esc: true });
      for (const x of sm) if (na(x.julg) || na(x.pub)) out.push({ tp: "sum", d: x.julg || x.pub, ds: [["Aprovada", x.julg], ["Publicada", x.pub]], ar: x.ar, sa: x.sa, k: `Súmula ${x.n} · ${x.org || ""}`, t: x.t, m: `Súmula ${x.n}/STJ · ${x.org || ""}`, ab: `s:${x.n}`, txt: `Súmula ${x.n}/STJ: ${x.t}` });
      // Em pauta na semana seguinte: um cartão por grupo de processos que compartilham precedentes
      // (o mesmo processo pode estar ligado a um tema e a uma controvérsia; vários recursos de um
      // mesmo tema costumam ir juntos à sessão). Temas repetitivos e demais precedentes ficam em
      // seções separadas.
      const semanaPl = pl.filter((x) => x.d > i1 && x.d <= somaDias(i1, 7) && (x.temas || []).some(([tp, n]) => t.idx.has(`${tp}-${n}`)));
      const grupos = [];
      for (const x of semanaPl) {
        const ks = x.temas.filter(([tp, n]) => t.idx.has(`${tp}-${n}`)).map(([tp, n]) => `${tp}-${n}`);
        const juntos = grupos.filter((g) => ks.some((k) => g.ks.has(k)));
        const g = juntos[0] || { ks: new Set(), procs: new Map(), d: x.d, o: x.o };
        if (!juntos.length) grupos.push(g);
        for (const o of juntos.slice(1)) { o.ks.forEach((k) => g.ks.add(k)); o.procs.forEach((v, k) => g.procs.set(k, v)); grupos.splice(grupos.indexOf(o), 1); }
        ks.forEach((k) => g.ks.add(k)); g.procs.set(x.reg || x.p, x.p); if (x.d < g.d) { g.d = x.d; g.o = x.o; }
      }
      for (const g of grupos) {
        const prec = [...g.ks].map((k) => t.idx.get(k)).sort((a, b) => (a.tp !== "Tema") - (b.tp !== "Tema") || b.n - a.n);
        const tt = prec[0], outros = prec.slice(1), procs = [...g.procs.values()].map((x) => String(x).replace(/\d{4,}/, (n) => fmtNumProc(n)));
        out.push({ tp: tt.tp === "Tema" ? "prox" : "proxc", d: g.d, ds: [["Sessão", g.d], ["Afetado", tt.afet]], ar: tt.ar, sa: tt.sa, k: `${tt.tp} ${fmtNumProc(tt.n)} · ${D.orgaos[g.o] || tt.org || ""}`, t: tt.q || "", m: `${procs.join(", ")} · ${fmtDiaL(g.d)}`, ab: `t:${tt.tp}|${tt.n}`,
          vinc: outros.map((o) => ({ ab: `t:${o.tp}|${o.n}`, rot: `${o.tp} ${fmtNumProc(o.n)}` })),
          txt: `${tt.tp} ${tt.n}/STJ${outros.length ? ` (também ${outros.map((o) => `${o.tp} ${o.n}`).join(", ")})` : ""}, em pauta em ${fmtData(g.d)} (${procs.join(", ")}): ${tt.q || ""}` });
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
        ${it.vinc?.length ? `<p class="nota-vinc">Os mesmos processos também estão ligados a ${it.vinc.map((v) => `<button type="button" class="link-acao" data-sem="${esc(v.ab)}">${esc(v.rot)}</button>`).join(", ")}</p>` : ""}
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
      if (k === "t") { const [tp, n] = v.includes("|") ? v.split("|") : ["Tema", v]; abrirTema(tp, +n); }
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
      <div class="item-cab">${seloTrib("stj")}<span class="item-tit">Súmula ${x.n}</span>${x.sit !== "vigente" ? `<span class="selo ${cls}">${sit}</span>` : ""}
        <span class="meta">${x.org ? `<span>${esc(x.org)}</span>` : ""}${x.julg ? `<span>Julg. ${fmtData(x.julg)}</span>` : ""}${x.pub ? `<span>Publ. ${fmtData(x.pub)}</span>` : ""}</span></div>
      <div class="item-sel">${seloMat(x.ar, x.sa)}${x.ass ? `<span class="assunto">${esc(x.ass)}</span>` : ""}</div>
      <p class="enunciado">${destacar(esc(x.t), termos)}</p>
      ${x.nota ? `<details class="nota-sum"><summary>${x.sit === "cancelada" ? "Por que foi cancelada" : "Histórico da redação"}</summary><p>${esc(x.nota)}</p></details>` : ""}
      <div class="acoes">
        <a class="link-acao" href="${URL_SUMULA(x.n)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>
        <a class="link-acao" href="#pesquisa?q=sumula:${x.n}&p=u3">Acórdãos recentes que aplicam</a>
        <span class="dir">${botaoSalvar(`s:${x.n}`, { k: "s", n: x.n })}<button type="button" class="btn-ico" data-copiar-sum title="Copiar enunciado e referência" aria-label="Copiar">${ico("copiar")}</button></span>
      </div></li>`;
  }
  // Súmulas do STF: "Súmula Vinculante 9", "Súmula 1".
  const SIT_SUM_STF = { vigente: ["Vigente", "ok"], cancelada: ["Cancelada", "canc"], revogada: ["Revogada", "canc"], superada: ["Superada", "canc"], alterada: ["Redação alterada", "rel"] };
  const citSumSTF = (x) => `${x._rot}/STF: "${x.t}"${x.data ? ` (${x.datat === "publicação" ? "DJe de" : "aprovada em"} ${fmtDataCit(x.data)})` : ""}${x._canc ? ` [${x.sit}]` : ""}`;
  function cardSumulaSTF(x, termos) {
    const [sit, cls] = SIT_SUM_STF[x.sit] || SIT_SUM_STF.vigente;
    return `<li class="card item sumula${x._canc ? " cancelada" : ""}" data-sumk="${esc(x._k)}">
      <div class="item-cab">${seloTrib("stf")}<button type="button" class="item-tit item-abrir" data-sum-stf="${esc(x._k)}">${esc(x._rot)}</button>${x.v ? `<span class="selo pri">Vinculante</span>` : ""}${x.sit !== "vigente" ? `<span class="selo ${cls}">${sit}</span>` : ""}
        <span class="meta"><span>Plenário do STF</span>${x.data ? `<span>${x.datat === "publicação" ? "Publ." : "Aprov."} ${fmtData(x.data)}</span>` : ""}</span></div>
      ${(x.ar || []).length ? `<div class="item-sel">${seloMat(x.ar, x.sa)}</div>` : ""}
      <p class="enunciado">${destacar(esc(x.t), termos)}</p>
      <div class="acoes">
        <button type="button" class="link-acao" data-sum-stf="${esc(x._k)}">Detalhes ${ico("seta")}</button>
        <a class="link-acao" href="${URL_STF.sumula(x)}" target="_blank" rel="noopener">Página oficial ${ico("externo")}</a>
        <span class="dir">${botaoSalvar(`s:${x._k}`, { k: "s", trib: "stf", v: x.v, n: x.n })}<button type="button" class="btn-ico" data-copiar-sum title="Copiar enunciado e referência" aria-label="Copiar">${ico("copiar")}</button></span>
      </div></li>`;
  }
  async function abrirSumulaSTF(k) {
    const l = await sumulasSTF().catch(() => null);
    const x = l?.idx.get(k); if (!x) return toast("Súmula do STF não encontrada.");
    const [sit, cls] = SIT_SUM_STF[x.sit] || SIT_SUM_STF.vigente;
    const temas = (x.rg || []);
    const chave = `s:${x._k}`;
    abrirGaveta(`${x.v ? "Súmula vinculante" : "Súmula"} · STF${x.data ? ` · ${x.datat === "publicação" ? "publicada em" : "aprovada em"} ${fmtData(x.data)}` : ""}`, `${x._rot}/STF`, `
      <div class="item-sel"><span class="selo ${cls}">${sit}</span>${x.v ? `<span class="selo pri">Vinculante</span>` : ""}${seloMat(x.ar, x.sa)}</div>
      <p class="enunciado-g${x._canc ? " cancelada" : ""}">${esc(x.t)}</p>
      ${x.teseRg ? `<div class="tese"><b>Tese de repercussão geral</b>${esc(x.teseRg)}</div>` : ""}
      ${x.prec ? `<h3>Precedente representativo</h3><p class="texto-serif">${esc(x.prec)}</p>` : ""}
      ${(x.obs || []).length ? `<h3>Observações do STF</h3><ul class="lista-ajuda">${x.obs.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
      ${temas.length ? `<p>${temas.map((n) => `<button type="button" class="link-acao" data-tema-rg="${n}">Tema ${n} da repercussão geral ${ico("seta")}</button>`).join(" ")}</p>` : ""}
      <div class="acoes" style="margin-top:14px">
        <button type="button" class="btn btn-claro btn-peq" id="gsf-salvar" data-salvo-chave="${esc(chave)}" aria-pressed="${!!P.salvos[chave]}">${ico("salvar")} ${P.salvos[chave] ? "Salvo" : "Salvar"}</button>
        <button type="button" class="btn btn-claro btn-peq" id="gsf-copiar">${ico("copiar")} Copiar</button>
        <a class="btn btn-claro btn-peq" href="${URL_STF.sumula(x)}" target="_blank" rel="noopener">Página oficial e jurisprudência ${ico("externo")}</a>
      </div>
      <p class="nota" style="margin-top:14px">Dados da página “Aplicação das Súmulas no STF”, publicada pelo Supremo.</p>`);
    $("#gsf-copiar").addEventListener("click", () => copiar(citSumSTF(x), "Súmula copiada."));
    $("#gsf-salvar").addEventListener("click", (e) => { alternarSalvo(chave, { k: "s", trib: "stf", v: x.v, n: x.n }, e.currentTarget); e.currentTarget.lastChild.textContent = P.salvos[chave] ? " Salvo" : " Salvar"; });
    $$("[data-tema-rg]", $("#gaveta-corpo")).forEach((b) => b.addEventListener("click", () => abrirTemaRG(+b.dataset.temaRg)));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sum-stf]"); if (!b) return;
    e.preventDefault(); abrirSumulaSTF(b.dataset.sumStf);
  });
  async function vSumulas(main, p) {
    if (p.get("aba") === "teses" && comSTJ()) return vTeses(main, p);
    const [lj, lf] = await Promise.all([comSTJ() ? sumulas() : [], trib() === "stf" ? sumulasSTF() : ambos() ? sumulasSTF().catch(() => []) : []]);
    for (const x of lj) x.trib = "stj";
    const l = [...lj, ...lf];
    const canc = (x) => (x.trib === "stf" ? x._canc : x.sit === "cancelada");
    const anos = l.map((x) => +x._d.slice(0, 4)).filter(Boolean);
    const f = { q: p.get("q") || "", a: p.get("a") || "", sit: p.get("sit") ?? "vig", org: p.get("org") || "", per: p.get("per") || "", esp: p.get("esp") || "", s: p.get("s") || "rec" };
    const fonte = trib() === "stf" ? "Fonte: “Aplicação das Súmulas no STF”, página oficial do Supremo" : ambos() ? "Fontes: páginas oficiais de súmulas do STJ e do STF" : "Fonte: página oficial de súmulas do STJ";
    main.innerHTML = `${comSTJ() ? abasSumulas("") : ""}
      <div id="sm-f">
        ${campoBusca("sm-q", trib() === "stf" ? 'Número ou termos do enunciado. Ex.: "vinculante 13" ou "nepotismo"' : 'Número ou termos do enunciado. Ex.: 7 ou "dano moral"', f.q)}
        <div class="fd-filtros filtros-lista" id="sm-pil"></div>
      </div>
      <div class="barra-res"><p id="sm-info"></p><span class="nota">${fonte}</span></div>
      <ol class="lista" id="sm-lista"></ol>
      <div id="sm-pag"></div>`;
    let lista = [], termos = [], ca = {}, cs = {}, ce = {};
    const pgSm = paginador("sm", () => render(false), "#sm-lista");
    const PER = [["", "Qualquer data"], ["5", "Últimos 5 anos"], ["10", "Últimos 10 anos"], ["2020", "2020 em diante"], ["2010", "2010 a 2019"], ["2000", "2000 a 2009"], ["1990", "1990 a 1999"], ...(comSTF() ? [["antes", "Antes de 1990"]] : [])];
    const anoAtual = +hojeISO().slice(0, 4);
    const noPer = (x, v) => { if (!v) return true; const a = +x._d.slice(0, 4); if (!a) return false; return v === "antes" ? a < 1990 : v.length === 1 || v === "10" ? a > anoAtual - +v : v === "2020" ? a >= 2020 : a >= +v && a <= +v + 9; };
    const card = (x) => (x.trib === "stf" ? cardSumulaSTF(x, termos) : cardSumula(x, termos));
    const render = (reset) => {
      const ul = $("#sm-lista");
      if (reset) pgSm.pag = 1;
      ul.innerHTML = pgSm.fatia(lista).map(card).join("");
      $("#sm-pag").innerHTML = pgSm.html(lista.length);
      if (!lista.length) ul.innerHTML = vazio("sumulas", "Nenhuma súmula encontrada", "Revise os termos ou os filtros. Para ver as canceladas, use o filtro Situação.");
    };
    const aplicar = () => {
      f.q = $("#sm-q").value;
      gravarHash("sumulas", { ...f, sit: f.sit === "vig" ? "" : f.sit, s: f.s === "rec" ? "" : f.s });
      // "Súmula 7", "7/STJ", "SV 13", "Súmula Vinculante 13": busca pelo número.
      const qT = f.q.trim().replace(/^s[úu]mulas?\s*/i, "").replace(/\/(stj|stf)$/i, "").replace(/\s*(n\.?|nº)\s*/i, " ").trim();
      const mv = /^(?:sv|vinculante)\s*(\d{1,3})$/i.exec(qT);
      const numero = mv ? +mv[1] : /^\d{1,3}$/.test(qT) ? +qT : null;
      const c = numero != null ? Busca.compilar("") : Busca.compilar(f.q); termos = c.termos;
      const base0 = l.filter((x) => (numero != null ? x.n === numero && (!mv || x.v) : c.testa(x._n)) && temV(f.org, x.org) && noPer(x, f.per));
      ce = { "": base0.length, sv: 0, sc: 0 }; base0.forEach((x) => { if (x.trib === "stf") ce[x.v ? "sv" : "sc"]++; });
      const base = base0.filter((x) => !f.esp || (x.trib === "stf" && (f.esp === "sv" ? x.v : !x.v)));
      cs = { vig: 0, canc: 0, todas: base.length }; base.forEach((x) => (canc(x) ? cs.canc++ : cs.vig++));
      const b2 = base.filter((x) => numero != null || f.sit === "todas" || (f.sit === "canc" ? canc(x) : !canc(x)));
      ca = contarMat(b2, (x) => x.ar, (x) => x.sa);
      lista = numero != null ? base : b2.filter((x) => casaMat(f.a, x.ar, x.sa));
      const porData = (a, b) => (b._d || "").localeCompare(a._d || "") || b.v - a.v || b.n - a.n;
      const ord = { rec: trib() === "stj" ? (a, b) => b.n - a.n : porData, num: (a, b) => a.n - b.n || (a.trib === "stf") - (b.trib === "stf"), julg: porData, ant: (a, b) => (a._d || "9").localeCompare(b._d || "9") || a.n - b.n,
        rel: (a, b) => c.pontua(b._n, b._n) - c.pontua(a._n, a._n) || b.n - a.n }[f.s === "rel" && c.vazio ? "rec" : f.s];
      lista.sort(ord);
      $("#sm-info").innerHTML = `<b>${fmtInt(lista.length)}</b> súmula(s)${f.sit === "vig" && numero == null ? " vigentes" : f.sit === "canc" ? " fora de vigor" : ""} ${explicacaoHTML(c)}`;
      render(true);
    };
    const orgaos = [...(comSTJ() ? ["Corte Especial", "Primeira Seção", "Segunda Seção", "Terceira Seção"] : []), ...(ambos() ? ["Plenário do STF"] : [])];
    pilulas($("#sm-pil"), [
      ...(comSTF() ? [{ rot: "Espécie", tipo: "um", get: () => f.esp, set: (v) => (f.esp = v), rotAtual: () => "Todas as súmulas", titulo: "Espécie de súmula",
        opcoes: () => [{ v: "", t: "Todas", n: ce[""] }, { v: "sv", t: "Súmulas vinculantes (STF)", n: ce.sv }, { v: "sc", t: "Súmulas do STF não vinculantes", n: ce.sc }],
        nota: "A súmula vinculante (art. 103-A da Constituição) obriga os demais órgãos do Judiciário e a administração pública; o descumprimento permite reclamação ao STF. As demais súmulas orientam, sem esse efeito." }] : []),
      { rot: "Matéria", tipo: "materia", get: () => f.a, set: (v) => (f.a = v), cont: () => ca },
      { rot: "Situação", tipo: "um", padrao: "vig", obrigatorio: true, rotAtual: () => "Vigentes", get: () => f.sit, set: (v) => (f.sit = v),
        opcoes: () => [{ v: "vig", t: "Vigentes", n: cs.vig }, { v: "canc", t: comSTF() ? "Canceladas, revogadas ou superadas" : "Canceladas", n: cs.canc, ponto: "canc" }, { v: "todas", t: "Todas", n: cs.todas }],
        nota: comSTF() ? "Vigentes incluem as súmulas com redação alterada. No STF, “superada” e “revogada” seguem a indicação da página oficial do Tribunal." : "Vigentes incluem as súmulas cuja redação foi alterada ou revisada; o cartão indica a alteração e mostra a redação anterior." },
      ...(orgaos.length > 1 ? [{ rot: "Órgão", tipo: "varios", vertical: true, get: () => f.org, set: (v) => (f.org = v), titulo: "Órgão que aprovou", opcoes: () => [{ v: "", t: "Todos os órgãos" }, ...orgaos.map((o) => ({ v: o, t: o }))],
        nota: "Primeira Seção: direito público. Segunda Seção: direito privado. Terceira Seção: direito penal. Corte Especial: questões comuns a todas as Seções." }] : []),
      { rot: "Data", tipo: "um", get: () => f.per, set: (v) => (f.per = v), titulo: "Data de aprovação", opcoes: () => PER.map(([v, t]) => ({ v, t })),
        nota: `Data em que o órgão aprovou a súmula${anos.length ? ` (de ${Math.min(...anos)} a ${Math.max(...anos)})` : ""}. Na falta dela, vale a data da publicação.` },
      defOrdem(() => f.s, (v) => (f.s = v), [{ v: "rec", t: trib() === "stj" ? "Mais recentes" : "Mais recentes (data)" }, { v: "num", t: "Número (menor primeiro)" }, { v: "julg", t: "Aprovação mais recente" }, { v: "ant", t: "Aprovação mais antiga" }, { v: "rel", t: "Mais aderentes à busca" }]),
    ], aplicar);
    $("#sm-q").addEventListener("input", debounce(aplicar, 200));
    $("#sm-lista").addEventListener("click", (e) => {
      const b = e.target.closest("[data-copiar-sum]"); if (!b) return;
      const li = b.closest("[data-sum], [data-sumk]");
      if (li.dataset.sumk) { const x = lf.idx?.get(li.dataset.sumk); if (x) copiar(citSumSTF(x), "Súmula copiada."); return; }
      const x = lj.find((y) => y.n === +li.dataset.sum); if (!x) return;
      copiar(`Súmula ${x.n}/STJ: "${x.t}"${x.org ? ` (${x.org}${x.julg ? `, julgado em ${fmtDataCit(x.julg)}` : ""}${x.pub ? `, DJe de ${fmtDataCit(x.pub)}` : ""})` : ""}${x.sit === "cancelada" ? " [cancelada]" : ""}`, "Súmula copiada.");
    });
    if (comSTJ()) ligarAbasSumulas(main);
    ligarAjuda($("#sm-f"), $("#sm-q"), aplicar);
    aplicar();
  }

  // ========================================================== INFORMATIVO DO STF
  // Publicação oficial e aberta do Supremo: resumos dos julgamentos de destaque, por edição.
  const prepInfoSTF = (l) => {
    for (const x of l) {
      x.trib = "stf"; x._d = x.d || ""; x.ra = x.ra || []; x.ds = x.ds || [];
      x._res = (x.ts || [])[0] || (x.r || []).find((t) => !/^resumo:?$/i.test(t)) || "";
      x._n = norm(`${x.t} ${x.p} ${(x.p || "").replace(/\./g, "")} ${x.ra.join(" ")} ${x.ds.join(" ")} ${(x.ts || []).join(" ")} ${(x.r || []).join(" ")} ${x.rel || ""} ${x.tema ? `tema ${x.tema}` : ""} informativo ${x.n}`);
    }
    return l;
  };
  const informativosSTF = () => carregar("stf-informativos", (l) => { prepInfoSTF(l); l.idx = new Map(l.map((x) => [x.id, x])); return l; });
  const infoSTFIndice = () => carregar("stf-informativos-indice").catch(() => null);
  // Anos antigos (fora dos dois mais recentes), um arquivo por ano, lidos sob demanda.
  const infoSTFAno = (ano) => carregar(`stf-informativos/${ano}`, prepInfoSTF).then(async (l) => { const r = await informativosSTF(); for (const x of l) r.idx.set(x.id, x); return l; });
  const URL_INFO_STF = (n) => `https://www.stf.jus.br/arquivo/informativo/documento/informativo${n}.htm`;
  const URL_PROC_STF = (inc) => `https://portal.stf.jus.br/processos/detalhe.asp?incidente=${inc}`;
  const nomeMin = (r) => (r || "").replace(/^Minist[ra]o?\s+/i, "").replace(/^Ministra\s+/i, "");
  const refInfoSTF = (x) => `(STF, ${x.p || "Informativo"}${x.rel ? `, rel. Min. ${nomeMin(x.rel)}` : ""}${x.jd ? `, julgado em ${fmtDataCit(x.jd)}` : ""}. Informativo STF n. ${x.n}.)`;
  const citInfoSTF = (x) => `${x.t}\n${(x.ts || []).length ? `Tese: ${x.ts.join(" ")}\n` : ""}${refInfoSTF(x)}`;
  const chaveInfoSTF = (x) => `i:STF-${x.id}`;
  const minimoInfoSTF = (x) => ({ k: "i", trib: "stf", id: x.id, n: x.n, d: x.d, t: x.t, p: x.p || "", ...(x.rel ? { rel: x.rel } : {}), ...((x.ar || []).length ? { ar: x.ar } : {}) });
  function cardInfoSTF(x, termos = [], dentroDaEdicao = false) {
    return `<li class="card item info-stf" data-infok="${esc(x.id)}">
      <div class="item-cab">${dentroDaEdicao ? "" : seloTrib("stf")}<button type="button" class="item-tit item-abrir" data-info-stf="${esc(x.id)}">${destacar(esc(x.t), termos)}</button>
        <span class="meta">${dentroDaEdicao ? "" : `<span>Informativo ${x.n}</span><span>${fmtData(x.d)}</span>`}<span>${esc(x.o)}</span></span></div>
      <div class="item-sel">${(x.ar || []).length ? seloMat(x.ar, x.sa) : x.ra.slice(0, 2).map((r) => `<span class="selo">${esc(r)}</span>`).join("")}${x.tema ? `<span class="selo pri">Tema ${fmtNumProc(x.tema)} RG</span>` : ""}${(x.ts || []).length ? `<span class="selo ok">Tese fixada</span>` : ""}</div>
      <p class="enunciado">${destacar(esc(x._res.length > 420 ? `${x._res.slice(0, 417).replace(/\s+\S*$/, "")}…` : x._res), termos)}</p>
      <p class="nota" style="margin:6px 0 0">${x.p ? `${esc(x.p.length > 110 ? `${x.p.slice(0, 107)}…` : x.p)}` : ""}${x.rel ? `${x.p ? " · " : ""}rel. Min. ${esc(nomeMin(x.rel))}` : ""}</p>
      <div class="acoes">
        <button type="button" class="link-acao" data-info-stf="${esc(x.id)}">Resumo completo ${ico("seta")}</button>
        ${x.inc ? `<a class="link-acao" href="${URL_PROC_STF(x.inc)}" target="_blank" rel="noopener">Processo no STF ${ico("externo")}</a>` : ""}
        <span class="dir"><button type="button" class="btn-ico" data-copiar-info-stf="${esc(x.id)}" title="Copiar destaque e citação" aria-label="Copiar">${ico("copiar")}</button>${botaoSalvar(chaveInfoSTF(x), minimoInfoSTF(x))}</span>
      </div></li>`;
  }
  async function abrirInfoSTF(id) {
    const l = await informativosSTF().catch(() => null);
    const x = l?.idx.get(id); if (!x) return toast("Nota do Informativo do STF não encontrada.");
    const par = (a) => a.map((t) => `<p>${esc(t)}</p>`).join("");
    abrirGaveta(`Informativo STF n. ${x.n} · ${fmtData(x.d)}`, x.p || "Informativo do STF", `
      <div class="item-sel">${(x.ar || []).length ? seloMat(x.ar, x.sa) : x.ra.map((r) => `<span class="selo">${esc(r)}</span>`).join("")}<span class="selo">${esc(x.o)}</span>${x.tema ? `<span class="selo pri">Tema ${fmtNumProc(x.tema)} RG</span>` : ""}</div>
      <p class="info-tema">${esc(x.t)}</p>
      ${x.ds.length ? `<p class="nota">${esc(x.ds.join(" · "))}</p>` : ""}
      ${(x.ts || []).length ? `<div class="tese"><b>Tese fixada</b>${par(x.ts)}</div>` : ""}
      <div class="tese"><b>Resumo do julgado</b>${par(x.r || [])}</div>
      <div class="acoes" style="margin:14px 0">
        <button type="button" class="btn btn-claro btn-peq" id="gis-copiar">${ico("copiar")} Copiar destaque e citação</button>
        <button type="button" class="btn btn-claro btn-peq" id="gis-ref">${ico("citar")} Copiar só a citação</button>
        <button type="button" class="btn btn-claro btn-peq" id="gis-salvar" aria-pressed="${!!P.salvos[chaveInfoSTF(x)]}">${ico("salvar")} ${P.salvos[chaveInfoSTF(x)] ? "Salvo" : "Salvar"}</button>
        ${x.tema ? `<button type="button" class="btn btn-claro btn-peq" data-tema-rg="${x.tema}">Tema ${fmtNumProc(x.tema)} da repercussão geral</button>` : ""}
        ${x.inc ? `<a class="btn btn-claro btn-peq" href="${URL_PROC_STF(x.inc)}" target="_blank" rel="noopener">Processo no STF ${ico("externo")}</a>` : ""}
        <a class="btn btn-claro btn-peq" href="${URL_INFO_STF(x.n)}" target="_blank" rel="noopener">Informativo oficial ${ico("externo")}</a>
      </div>
      ${x.fe ? `<h3>Julgamento</h3><p class="texto-serif">${esc(x.fe)}</p>` : ""}
      ${(x.nt || []).length ? `<h3>Notas do Informativo</h3><ul class="lista-ajuda">${x.nt.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      <p class="nota" style="margin-top:14px">Texto do Informativo STF, publicação oficial do Supremo Tribunal Federal. O resumo não substitui o acórdão.</p>`);
    $("#gis-copiar").addEventListener("click", () => copiar(citInfoSTF(x), "Destaque e citação copiados."));
    $("#gis-ref").addEventListener("click", () => copiar(refInfoSTF(x), "Citação copiada."));
    $("#gis-salvar").addEventListener("click", (e) => { alternarSalvo(chaveInfoSTF(x), minimoInfoSTF(x), e.currentTarget); e.currentTarget.lastChild.textContent = P.salvos[chaveInfoSTF(x)] ? " Salvo" : " Salvar"; });
    $$("[data-tema-rg]", $("#gaveta-corpo")).forEach((b) => b.addEventListener("click", () => abrirTemaRG(+b.dataset.temaRg)));
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-info-stf]"); if (b) { e.preventDefault(); return abrirInfoSTF(b.dataset.infoStf); }
    const c = e.target.closest("[data-copiar-info-stf]"); if (!c) return;
    const x = (await informativosSTF().catch(() => null))?.idx.get(c.dataset.copiarInfoStf); if (x) copiar(citInfoSTF(x), "Destaque e citação copiados.");
  });
  // ================================================================== CARROSSEL DA VISÃO GERAL
  // Destaques em cartões grandes, com troca automática (pausa ao passar o mouse, ao tocar ou com o
  // foco do teclado; sem movimento automático para quem pediu menos animação no sistema).
  const noticiasSTF = () => (D.man?.stf?.noticias ? carregar("stf-noticias", (l) => l).catch(() => []) : Promise.resolve([]));
  // Fotos institucionais (Flickr oficial do STF e do STJ) para os destaques sem foto própria; variam a cada dia.
  const fundosCar = () => (D.man?.stf?.noticias?.fundos ? carregar("carrossel-fundos", (l) => l).catch(() => []) : Promise.resolve([]));
  function aplicarFundos(sls, fs) {
    if (!fs?.length) return sls;
    const dia = Math.floor(Date.now() / 864e5), cont = {};
    for (const sl of sls) {
      if (sl.img && !sl.retrato) continue;
      const g = fs.filter((f) => f.trib === sl.trib); if (!g.length) continue;
      const k = cont[sl.trib] = (cont[sl.trib] || 0) + 1;
      const f = g[(dia * 3 + k) % g.length];
      sl.bg = f.f; sl.bgG = f.g; sl.bgAlt = f.alt; sl.bgCred = f.cred;
    }
    return sls;
  }
  const CORES_CAR = [["#12325e", "#1f5aa6"], ["#3b1f5c", "#6b3fa0"], ["#0f4a43", "#1d8a74"], ["#5a2a12", "#b0582a"], ["#5c1530", "#a43a5c"], ["#1d3b16", "#4f8a2c"]];
  const corCar = (k) => { let h = 0; for (const c of String(k || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES_CAR[h % CORES_CAR.length]; };
  const cortar = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t; };
  function slideCar(sl, i, n) {
    const [c1, c2] = corCar(sl.ar || sl.kick);
    const foto = sl.img && !sl.retrato, fundo = !foto && sl.bg, src = foto ? sl.img : fundo ? sl.bg : "";
    const cred = sl.cred || (fundo ? `Imagem ilustrativa · ${sl.bgCred}` : "");
    const acao = sl.ext ? `href="${esc(sl.href)}" target="_blank" rel="noopener"` : sl.href ? `href="${esc(sl.href)}"` : 'href="#"';
    return `<a class="car-sl${src ? " car-foto" : ""}${fundo ? " car-fundo" : ""}${sl.retrato ? " car-retrato" : ""}" ${acao} ${sl.data || ""} role="group" aria-roledescription="destaque" aria-label="${i + 1} de ${n}: ${esc(sl.tit)}" style="--c1:${c1};--c2:${c2}">
        ${src ? `<img class="car-img" src="${esc(src)}"${fundo && sl.bgG ? ` srcset="${esc(sl.bg)} 1024w, ${esc(sl.bgG)} 1600w" sizes="(max-width: 720px) 100vw, 1000px"` : ""} alt="${esc((foto ? sl.alt : sl.bgAlt) || "")}" loading="${i ? "lazy" : "eager"}" decoding="async" data-erro-remover="img">` : ""}
        ${sl.retrato ? `<img class="car-min" src="${esc(sl.img)}" alt="" loading="lazy" data-erro-remover="img">` : ""}
        ${!src && !sl.retrato ? `<span class="car-marca" aria-hidden="true">${ico(sl.ico || "destaques")}</span>` : ""}
        <span class="car-tx">
          <span class="car-kick">${sl.trib ? `<b>${esc(sl.trib)}</b>` : ""}${esc(sl.kick)}</span>
          <span class="car-tit">${esc(sl.tit)}</span>
          ${sl.txt ? `<span class="car-res">${esc(sl.txt)}</span>` : ""}
          <span class="car-pe">${esc(sl.pe || "")}${sl.ext ? ` ${ico("externo")}` : ` ${ico("seta")}`}</span>
        </span>
        ${cred ? `<span class="car-cred">${esc(cred)}</span>` : ""}
        ${n > 1 ? '<span class="car-prog" aria-hidden="true"><i></i></span>' : ""}
      </a>`;
  }
  function carrosselHTML(sls) {
    if (!sls.length) return "";
    return `<section class="car" aria-roledescription="carrossel" aria-label="Destaques" id="car">
      <div class="car-trilho" tabindex="-1">${sls.map((sl, i) => slideCar(sl, i, sls.length)).join("")}</div>
      ${sls.length > 1 ? `<div class="car-ctl">
        <button type="button" class="car-btn car-ant" aria-label="Destaque anterior">${ico("seta")}</button>
        <div class="car-pts" role="tablist">${sls.map((sl, i) => `<button type="button" role="tab" aria-label="Destaque ${i + 1}" aria-selected="${!i}" data-car="${i}"></button>`).join("")}</div>
        <button type="button" class="car-btn car-prox" aria-label="Próximo destaque">${ico("seta")}</button>
      </div>` : ""}
    </section>`;
  }
  // A troca automática segue a barra de tempo de cada destaque (fim da animação = próximo destaque);
  // a troca não para (as setas e os pontos continuam disponíveis para navegar).
  function ligarCarrossel(root) {
    const car = $("#car", root); if (!car) return;
    const tri = $(".car-trilho", car), sls = $$(".car-sl", car), pts = $$("[data-car]", car);
    const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = 0;
    // A foto que sai mantém a aproximação parada até sair da tela (sem salto visível durante a rolagem).
    const destacar = () => {
      sls.forEach((el, k) => { if (el.classList.contains("atual") && k !== i) { el.classList.replace("atual", "saindo"); clearTimeout(el._s); el._s = setTimeout(() => el.classList.remove("saindo"), 900); } });
      const el = sls[i]; if (!el) return;
      el.classList.remove("atual", "saindo"); void el.offsetWidth; el.classList.add("atual");
    };
    destacar();
    $$("[data-tema-rg]", car).forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); abrirTemaRG(+a.dataset.temaRg); }));
    $$("[data-tema-car]", car).forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); const [tp, n] = a.dataset.temaCar.split("|"); abrirTema(tp, +n); }));
    if (sls.length < 2) return;
    const marcar = () => pts.forEach((b, k) => b.setAttribute("aria-selected", String(k === i)));
    const ir = (k, suave = true) => { i = (k + sls.length) % sls.length; tri.scrollTo({ left: sls[i].offsetLeft - tri.offsetLeft, behavior: suave && !reduz ? "smooth" : "auto" }); marcar(); destacar(); };
    car.addEventListener("animationend", (e) => { if (e.animationName === "carProg" && e.target.closest(".car-sl") === sls[i]) ir(i + 1); });
    let fimRolagem;
    tri.addEventListener("scroll", () => { clearTimeout(fimRolagem); fimRolagem = setTimeout(() => { const x = tri.scrollLeft; let m = 0, d = Infinity; sls.forEach((el, k) => { const dd = Math.abs(el.offsetLeft - tri.offsetLeft - x); if (dd < d) { d = dd; m = k; } }); if (m !== i) { i = m; marcar(); destacar(); } }, 80); }, { passive: true });
    $(".car-ant", car).addEventListener("click", () => ir(i - 1));
    $(".car-prox", car).addEventListener("click", () => ir(i + 1));
    pts.forEach((b) => b.addEventListener("click", () => ir(+b.dataset.car)));
    car.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { ir(i + 1); e.preventDefault(); } if (e.key === "ArrowLeft") { ir(i - 1); e.preventDefault(); } });
  }
  // Intercala os grupos (notícia, tese, notícia, pauta...) para variar o que aparece.
  const intercalar = (...gs) => { const out = []; for (let k = 0; gs.some((g) => g[k]); k++) for (const g of gs) if (g[k]) out.push(g[k]); return out; };
  function slidesNoticias(nots) {
    return nots.slice(0, 5).map((x) => ({ trib: "STF", kick: ` · Notícia · ${fmtData(x.d)}`, tit: x.t, txt: cortar(x.r, 190), img: x.img, alt: x.alt, cred: x.cred, href: x.url, ext: true, pe: "Ler no portal do STF", ar: "noticia" }));
  }
  function slidesSTF(l, pt, cp) {
    const hoje = hojeISO();
    const fotoDe = (rel) => cp?.ministros.find((m) => m.foto && norm(rel || "").includes(norm(m.curto)))?.foto?.url;
    const teses = l.filter((x) => x.tese && x.dtese >= somaDias(hoje, -60)).sort((a, b) => b.dtese.localeCompare(a.dtese)).slice(0, 2)
      .map((x) => ({ trib: "STF", kick: ` · Tese fixada · Tema ${fmtNumProc(x.n)} · ${fmtData(x.dtese)}`, tit: cortar(x.q, 150), txt: cortar(x.tese, 230), img: fotoDe(x.rel), retrato: !!fotoDe(x.rel), href: "#", data: `data-tema-rg="${x.n}"`, pe: x.rel ? `Rel. ${x.rel} · ver o tema` : "Ver o tema", ar: (x.ar || [])[0], ico: "repetitivos" }));
    const pauta = (pt?.temas || []).filter((p0) => p0.fim >= hoje).sort((a, b) => a.ini.localeCompare(b.ini)).slice(0, 2).map((p0) => {
      const x = l.idx.get(`RG-${p0.tema}`); if (!x) return null;
      return { trib: "STF", kick: ` · ${p0.ini <= hoje ? "Em julgamento" : "Vai a julgamento"} · ${ORG_STF[p0.o] || p0.o}, sessão ${p0.amb} ${periodoSTF(p0.ini, p0.fim)}`, tit: cortar(x.q, 170), txt: `Tema ${fmtNumProc(x.n)} da repercussão geral, ainda sem tese. Paradigma: ${p0.cl} ${p0.num}.`, img: fotoDe(x.rel), retrato: !!fotoDe(x.rel), href: "#", data: `data-tema-rg="${x.n}"`, pe: "Ver o tema", ar: (x.ar || [])[0], ico: "pautas" };
    }).filter(Boolean);
    return { teses, pauta };
  }
  function slidesSTJ(evs, pl, dsTop) {
    const teses = evs.filter((e) => (e.k === "julg" || e.k === "pub") && e.t.tese).slice(0, 2)
      .map((e) => ({ trib: "STJ", kick: ` · ${e.k === "julg" ? "Repetitivo julgado" : "Tese publicada"} · ${e.t.tp} ${fmtNumProc(e.t.n)} · ${fmtData(e.d)}`, tit: cortar(e.t.q, 150), txt: cortar(e.t.tese, 230), href: "#", data: `data-tema-car="${esc(e.t.tp)}|${e.t.n}"`, pe: "Ver o tema", ar: `${e.t.tp}${e.t.n}`, ico: "repetitivos" }));
    const pauta = unicos(pl.filter((p) => p.temas?.length), (p) => `${p.temas[0][1]}|${p.d}`).slice(0, 2)
      .map((p) => ({ trib: "STJ", kick: ` · Em pauta · ${D.orgaos[p.o] || p.o} · ${fmtData(p.d)}`, tit: `${p.temas[0][0] === "Controvérsia" ? "Controvérsia" : "Tema"} ${fmtNumProc(p.temas[0][1])} vai a julgamento`, txt: `${p.pet ? `${p.pet} no ` : ""}${p.p}${p.rel ? `, rel. Min. ${p.rel}` : ""}.`, href: "#pautas", pe: "Ver as pautas", ar: `p${p.temas[0][1]}`, ico: "pautas", relSTJ: p.rel }));
    const dest = (dsTop || []).slice(0, 2).map((r) => {
      const linhas = String(r.em || "").split("\n");
      const tema = frase(linhas[0] || "").split(/\.\s+/).slice(0, 3).join(" · ");
      const corpo = (r.tese || r.tj || linhas.slice(1).join(" ").replace(/^\s*1\.\s*/, "")).trim();
      return { trib: "STJ", kick: ` · Destaque · ${D.orgaos[r.o] || ""}`, tit: cortar(tema, 140), txt: cortar(corpo, 220), href: `#pesquisa?n=${encodeURIComponent(r.n)}`, pe: `${r.cl} ${fmtNumProc(r.n)} · rel. ${relatorFmt(r.rel)}`, ar: (r.ar || [])[0] || r.o, ico: "destaques", relSTJ: r.rel };
    });
    return { teses, pauta, dest };
  }
  // Fotos dos relatores do STJ: a composição é lida depois de a página aparecer.
  async function fotosCarSTJ(root, sls) {
    if (!sls.some((x) => x.relSTJ)) return;
    const c = await composicao().catch(() => null); if (!c || !$("#car", root)) return;
    const els = $$(".car-sl", root);
    sls.forEach((sl, k) => {
      if (!sl.relSTJ || sl.img) return;
      const m = c.ministros.find((m0) => m0.foto && norm(m0.nome).includes(norm(String(sl.relSTJ).replace(/\s*\(.*\)/, "")).split(" ").slice(-1)[0]) && norm(`${m0.nome} ${m0.curto}`).includes(norm(String(sl.relSTJ).replace(/\s*\(.*\)/, "")).split(" ")[0]));
      if (!m || !els[k]) return;
      els[k].classList.add("car-retrato");
      $(".car-marca", els[k])?.remove();
      els[k].insertAdjacentHTML("afterbegin", `<img class="car-min" src="${esc(m.foto.url)}" alt="" loading="lazy" data-erro-remover="img">`);
    });
  }
  // ================================================================== PAUTA DO STF
  // Sessões presenciais do Plenário e das Turmas, calendário das sessões virtuais e os temas de repercussão
  // geral (ainda sem tese) cujos paradigmas estão pautados, conforme os serviços da página oficial de pauta.
  const pautaSTF = () => carregar("stf-pauta", (d) => d).catch(() => null);
  const DIA_SEM = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const diaSemana = (iso) => DIA_SEM[new Date(`${iso.slice(0, 10)}T12:00:00-03:00`).getDay()];
  const isoBr = (iso) => fmtData(iso);
  const periodoSTF = (a, b) => (a === b ? `${fmtData(a)} (${diaSemana(a)})` : `${fmtData(a)} a ${fmtData(b)}`);
  const ORG_STF = { TP: "Plenário", "1T": "Primeira Turma", "2T": "Segunda Turma" };
  function situacaoPauta(ini, fim) {
    const h = hojeISO();
    if (fim < h) return `<span class="selo">Sessão encerrada</span>`;
    if (ini <= h) return `<span class="selo alta">Em julgamento</span>`;
    return `<span class="selo pri">Pautado</span>`;
  }
  async function vPautaSTF(main) {
    const [d, l] = await Promise.all([pautaSTF(), temasRG().catch(() => null)]);
    if (!d) { main.innerHTML = vazio("pautas", "Pauta do STF ainda sem dados", "A pauta será publicada na próxima coleta do registro do STF."); return; }
    const h = hojeISO();
    const temasP = (d.temas || []).filter((x) => x.fim >= somaDias(h, -7)).sort((a, b) => (a.fim < h) - (b.fim < h) || a.ini.localeCompare(b.ini));
    const virt = (d.virtuais || []).filter((v) => v.fim >= h);
    const pres = (d.presenciais || []).filter((x) => x.d >= somaDias(h, -7));
    const linkDia = (iso) => (d.urls?.dia || "https://portal.stf.jus.br/pauta/pesquisarCalendario.asp?data={}").replace("{}", isoBr(iso));
    const linkVirt = (v) => (d.urls?.virtual || "").replace("{}", isoBr(v.ini)).replace("{}", isoBr(v.fim));
    const cartaoTema = (x) => {
      const t = l?.idx.get(`RG-${x.tema}`);
      return `<li class="card item">
        <div class="item-cab"><button type="button" class="item-tit item-abrir" data-tema-rg="${x.tema}">Tema ${fmtNumProc(x.tema)} · ${esc(t?.q || `${x.cl} ${x.num}`)}</button>
          <span class="meta"><span>${esc(ORG_STF[x.o] || x.o)}</span><span>Sessão ${esc(x.amb)}: ${periodoSTF(x.ini, x.fim)}</span></span></div>
        <div class="item-sel">${situacaoPauta(x.ini, x.fim)}${t ? seloMat(t.ar, t.sa) : ""}</div>
        <p class="nota" style="margin:6px 0 0">Paradigma: ${esc(x.cl)} ${esc(x.num)}${t?.rel ? ` · rel. ${esc(t.rel)}` : ""}</p>
      </li>`;
    };
    const item = (x) => `<li class="pt-it">
        <p class="pt-proc"><b>${esc(x.cl)} ${esc(x.num)}</b>${x.cadeia ? ` <small>${esc(x.cadeia)}</small>` : ""}${x.tema ? ` <button type="button" class="selo pri" data-tema-rg="${x.tema}">Tema ${fmtNumProc(x.tema)} RG</button>` : x.rg ? ` <span class="selo pri">Repercussão geral</span>` : ""}${x.relev ? ` <span class="selo">Matéria relevante</span>` : ""}</p>
        <p class="nota">${x.rel ? `Rel. Min. ${esc(x.rel)}` : ""}${x.vista ? ` · vista: Min. ${esc(x.vista)}` : ""}${x.dest ? ` · destaque: Min. ${esc(x.dest)}` : ""}</p>
        ${x.res ? `<p class="pt-res">${esc(x.res.replace(/^1\.\s*/, ""))}</p>` : ""}
      </li>`;
    main.innerHTML = `
      <div class="card card-pad cp-topo"><div>
        <p class="sobretitulo">Pauta conferida em ${fmtData(d.conferido)}</p>
        <h2 class="cp-tit">Pauta de julgamentos do STF</h2>
        <p class="nota">Conforme a <a href="${URL_STF.pauta}" target="_blank" rel="noopener">pauta oficial do STF ${ico("externo")}</a>, conferida duas vezes por semana. A pauta muda com frequência (inclusões, retiradas, pedidos de vista e destaque); confirme no site do Tribunal antes de agir.</p>
      </div></div>
      <h3 class="sec-tit">Temas de repercussão geral em pauta</h3>
      <p class="nota" style="margin:0 0 10px">Temas ainda sem tese cujo paradigma está pautado, inclusive em sessão virtual.</p>
      ${temasP.length ? `<ul class="lista">${temasP.map(cartaoTema).join("")}</ul>` : `<p class="nota">Nenhum tema pendente pautado no período.</p>`}
      <h3 class="sec-tit">Sessões presenciais</h3>
      ${pres.length ? pres.map((x) => `<div class="card card-pad pt-sessao">
          <p class="pt-cab"><b>${esc(x.nome || ORG_STF[x.o] || x.o)}</b> · ${fmtData(x.d)} (${diaSemana(x.d)})${x.ini.length > 10 ? `, ${esc(x.ini.slice(11, 16))}` : ""}${x.tipo ? ` · sessão ${esc(x.tipo)}` : ""}${x.num ? ` nº ${esc(x.num)}` : ""} ${situacaoPauta(x.d, x.d)}</p>
          ${x.obs ? `<p class="nota">${esc(x.obs)}</p>` : ""}
          <ol class="pt-lista">${x.itens.map(item).join("")}</ol>
          <p class="nota"><a href="${esc(linkDia(x.d))}" target="_blank" rel="noopener">Pauta do dia no site do STF ${ico("externo")}</a></p>
        </div>`).join("") : `<p class="nota">Nenhuma sessão presencial com pauta publicada no período.</p>`}
      <h3 class="sec-tit">Sessões virtuais</h3>
      ${virt.length ? `<div class="card card-pad"><table class="tab-fontes"><thead><tr><th>Período</th><th>Plenário</th><th>1ª Turma</th><th>2ª Turma</th><th></th></tr></thead><tbody>
          ${virt.map((v) => `<tr><td>${periodoSTF(v.ini, v.fim)} ${situacaoPauta(v.ini, v.fim)}</td><td>${fmtInt(v.TP)}</td><td>${fmtInt(v["1T"])}</td><td>${fmtInt(v["2T"])}</td><td>${linkVirt(v) ? `<a href="${esc(linkVirt(v))}" target="_blank" rel="noopener">Lista ${ico("externo")}</a>` : ""}</td></tr>`).join("")}
        </tbody></table><p class="nota">Número de processos em cada sessão virtual. A lista completa fica no site do STF.</p></div>` : `<p class="nota">Nenhuma sessão virtual futura no calendário.</p>`}`;
    $$("[data-tema-rg]", main).forEach((b) => b.addEventListener("click", () => abrirTemaRG(+b.dataset.temaRg)));
  }
  async function vInfoSTF(main, p) {
    const [rec, ix] = await Promise.all([informativosSTF(), infoSTFIndice()]);
    if (!rec.length && !ix) { main.innerHTML = vazio("destaques", "Informativo do STF ainda sem dados", "A coleta das edições do Informativo será publicada na próxima atualização."); return; }
    // Sem o índice (publicação antiga), as edições saem das próprias notas recentes.
    const eds = ix ? ix.eds : [...new Set(rec.map((x) => x.n))].sort((a, b) => b - a).map((n) => { const l = rec.filter((x) => x.n === n); return [n, l[0].d, l.length, [], []]; });
    const antigos = ix ? ix.antigos : [];
    const dataEd = new Map(eds.map((e) => [e[0], e[1]]));
    const idxEd = new Map(eds.map((e) => [e[0], e]));
    const anos = [...new Set(eds.map((e) => (e[1] || "").slice(0, 4)).filter(Boolean))].sort().reverse();
    const todas = [...rec], carregados = new Set();
    let tokenIs = 0;
    const f = { q: p.get("q") || "", a: p.get("a") || "", org: p.get("org") || "", rl: p.get("rl") || "", e: p.get("e") || "", tese: p.get("tese") === "1", s: p.get("s") || "rec" };
    const ultima = eds[0];
    main.innerHTML = `
      <div id="is-f" class="bloco-filtros">
        ${campoBusca("is-q", 'Processo, relator, tema ou assunto. Ex.: "ADI 7903" ou "Zanin"', f.q)}
        <div class="fd-filtros filtros-lista" id="is-pil"></div>
        <datalist id="is-rels"></datalist>
      </div>
      <div class="barra-res"><p id="is-info" aria-live="polite"></p><span class="nota" title="O Informativo do STF é publicado pela Secretaria de Altos Estudos, Pesquisas e Gestão da Informação do Supremo.">Fonte: Informativo STF, publicação oficial · edição mais recente: n. ${ultima[0]}, de ${fmtData(ultima[1])}</span></div>
      <div id="is-lista" class="notas"></div>
      <div id="is-pag"></div>`;
    let lista = [], termos = [], ca = ix?.mat || {}, co = {}, cr = {}, porEdicao = true, edsLista = [], notasDe = new Map(), abertas = new Set(), filtrando = false;
    const pg = paginador("is", () => render(), "#is-lista");
    const noPer = (n, d) => {
      const v = f.e;
      if (!v) return true;
      if (/^u\d+$/.test(v)) return eds.findIndex((e) => e[0] === n) < +v.slice(1);
      if (/^d\d+$/.test(v)) return d >= somaDias(hojeISO(), -+v.slice(1));
      if (v.startsWith("a:")) return (d || "").startsWith(v.slice(2));
      return true;
    };
    const anosPrecisos = () => (!f.e ? antigos : f.e.startsWith("a:") && antigos.includes(f.e.slice(2)) ? [f.e.slice(2)] : []);
    // Edições antigas são carregadas por ano, só quando a consulta exige.
    const carregarAnos = async (lst, tk) => {
      const faltam = lst.filter((a) => !carregados.has(a));
      let k = 0;
      for (const a of faltam) {
        const el = $("#is-info"); if (!el) return false; // o usuário saiu da tela
        el.innerHTML = `Carregando edições antigas do Informativo (${a})… ${Math.round((k++ / faltam.length) * 100)}%`;
        try { const la = await infoSTFAno(a); if (!carregados.has(a)) { carregados.add(a); todas.push(...la); } } catch { carregados.add(a); }
        if (tk !== tokenIs) return false;
      }
      return true;
    };
    const notasEd = (n) => notasDe.get(n) || todas.filter((x) => x.n === n).sort((a, b) => +a.id.split("-")[1] - +b.id.split("-")[1]);
    const linhaEd = (n) => {
      const e = idxEd.get(n) || [n, dataEd.get(n) || "", 0, [], []];
      const aberta = abertas.has(n), notas = filtrando ? notasEd(n) : null, d = e[1];
      const qtd = notas ? notas.length : e[2];
      const mats = notas ? (() => { const c = {}; notas.forEach((x) => (x.ar || []).slice(0, 1).forEach((a) => (c[a] = (c[a] || 0) + 1))); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a); })() : e[3];
      const temas = (notas ? notas.slice(0, 2).map((x) => x.t) : e[4]).map((t) => (t || "").replace(/\.$/, "")).filter(Boolean);
      let corpo = "";
      if (aberta) {
        const ns = notasEd(n);
        corpo = `<div class="jt-ed-corpo"><div class="jt-ed-info"><span>${qtd} julgado${qtd > 1 ? "s" : ""}${filtrando && f.q.trim() ? " correspondentes à busca" : ""}</span><a class="link-acao" href="${URL_INFO_STF(n)}" target="_blank" rel="noopener">Edição oficial ${ico("externo")}</a></div>
          ${ns.length ? `<ol class="lista-notas">${ns.map((x) => cardInfoSTF(x, termos, true)).join("")}</ol>` : `<p class="nota" style="padding:8px 0">Carregando…</p>`}</div>`;
      }
      return `<section class="jt-ed${aberta ? " aberta" : ""}" data-is-ed="${n}" style="--h:${AREA_COR[mats[0]] ?? 222}">
        <button type="button" class="jt-ed-cab" data-is-abrir="${n}" aria-expanded="${aberta}">
          <span class="jt-ed-num" title="Informativo n. ${n}"><small>Inf.</small>${n}</span>
          <span class="jt-ed-tit"><b>${d ? `${fmtDiaL(d).replace(/^\S+, /, "")} de ${d.slice(0, 4)}` : `Edição ${n}`}</b>
            <span class="jt-ed-meta">${seloMat(mats, [], 3)}<span>${qtd} julgado${qtd > 1 ? "s" : ""}</span></span>
            ${!aberta && temas.length ? `<span class="jt-ed-prev">${temas.map((t) => destacar(esc(frase(t)), termos)).join(" · ")}${qtd > 2 ? " …" : ""}</span>` : ""}</span>
          ${ico("seta")}
        </button>${corpo}
      </section>`;
    };
    const render = () => {
      const box = $("#is-lista");
      if (porEdicao ? !edsLista.length : !lista.length) { $("#is-pag").innerHTML = ""; box.innerHTML = vazio("destaques", "Nenhum julgado encontrado", "Revise os termos ou os filtros."); return; }
      if (porEdicao) {
        const vis = pg.fatia(edsLista);
        $("#is-pag").innerHTML = pg.html(edsLista.length);
        let html = "", anoAnt = "";
        for (const n of vis) { const a = (dataEd.get(n) || "").slice(0, 4); if (a && a !== anoAnt) { html += `<h2 class="jt-divisor">${a}</h2>`; anoAnt = a; } html += linhaEd(n); }
        box.innerHTML = html;
        return;
      }
      $("#is-pag").innerHTML = pg.html(lista.length);
      box.innerHTML = `<ol class="lista-notas">${pg.fatia(lista).map((x) => cardInfoSTF(x, termos)).join("")}</ol>`;
    };
    const aplicar = async () => {
      f.q = $("#is-q").value;
      gravarHash("infostf", { ...f, tese: f.tese ? "1" : "", s: f.s === "rec" ? "" : f.s });
      const tk = ++tokenIs;
      const c = Busca.compilar(f.q); termos = c.termos;
      filtrando = !!(f.q.trim() || f.a || f.org || f.rl || f.tese);
      const ordem = f.s === "rel" && c.vazio ? "rec" : f.s;
      porEdicao = ordem !== "rel";
      if (!filtrando) {
        // Navegação: as edições vêm do índice e as notas só são lidas quando a edição é aberta.
        edsLista = eds.filter((e) => noPer(e[0], e[1])).map((e) => e[0]);
        if (ordem === "ant") edsLista.reverse();
        lista = []; co = {}; cr = {}; ca = ix?.mat || {}; abertas = new Set();
        $("#is-info").innerHTML = `<b>${fmtInt(edsLista.length)}</b> edição(ões) do Informativo${f.e ? "" : ` (da nº ${eds[eds.length - 1][0]}, de ${eds[eds.length - 1][1].slice(0, 4)}, à nº ${eds[0][0]})`}`;
        pg.pag = 1; render();
        return;
      }
      if (!(await carregarAnos(anosPrecisos(), tk))) return;
      if (!$("#is-info")) return;
      const b1 = todas.filter((x) => noPer(x.n, x.d) && c.testa(x._n) && (!f.tese || (x.ts || []).length));
      cr = {}; b1.forEach((x) => { if (x.rel) cr[x.rel] = (cr[x.rel] || 0) + 1; });
      const relSel = listaV(f.rl).map(norm);
      const b0 = b1.filter((x) => !relSel.length || relSel.some((r) => norm(x.rel) === r || norm(x.rel).includes(r)));
      co = {}; b0.forEach((x) => { co[x.o] = (co[x.o] || 0) + 1; });
      const base = b0.filter((x) => temV(f.org, x.o));
      ca = contarMat(base, (x) => x.ar, (x) => x.sa);
      lista = base.filter((x) => casaMat(f.a, x.ar, x.sa));
      const porId = (a, b) => b.n - a.n || +a.id.split("-")[1] - +b.id.split("-")[1];
      if (ordem === "rel") lista.sort((a, b) => c.pontua(b._n, b._n) - c.pontua(a._n, a._n) || porId(a, b));
      else lista.sort(ordem === "ant" ? (a, b) => -porId(a, b) : porId);
      notasDe = new Map(); lista.forEach((x) => { if (!notasDe.has(x.n)) notasDe.set(x.n, []); notasDe.get(x.n).push(x); });
      edsLista = [...notasDe.keys()];
      abertas = new Set(edsLista.length === 1 ? edsLista : !c.vazio ? edsLista.slice(0, 3) : []);
      $("#is-info").innerHTML = `<b>${fmtInt(lista.length)}</b> julgado(s) em ${edsLista.length} edição(ões) ${explicacaoHTML(c)}${!c.vazio && f.e && antigos.length ? ` <button type="button" class="link-acao" id="is-todas">Buscar em todas as edições, desde a nº ${eds[eds.length - 1][0]}</button>` : ""}`;
      $("#is-todas")?.addEventListener("click", () => { f.e = ""; pil.desenhar(); aplicar(); });
      $("#is-rels").innerHTML = Object.keys(cr).sort().map((r) => `<option value="${esc(r)}">`).join("");
      pg.pag = 1; render();
    };
    const orgaos = ["Plenário", "Primeira Turma", "Segunda Turma", "Turmas"];
    const rotPer = (v) => (v.startsWith("a:") ? `Ano ${v.slice(2)}` : "Período");
    const pil = pilulas($("#is-pil"), [
      { rot: "Matéria", tipo: "materia", get: () => f.a, set: (v) => (f.a = v), cont: () => ca },
      { rot: "Período", titulo: "Período ou ano", tipo: "um", get: () => f.e, set: (v) => (f.e = v), rotAtual: () => "Todas as edições", rotValor: rotPer, vertical: true,
        opcoes: () => [{ v: "", t: `Todas as edições (desde a nº ${eds[eds.length - 1][0]}, de ${eds[eds.length - 1][1].slice(0, 4)})`, curto: "Todas as edições" }, { v: "u10", t: "Últimas 10 edições" }, { v: "d90", t: "Últimos 90 dias" }, { v: "d365", t: "Último ano" }, ...anos.map((a) => ({ v: `a:${a}`, t: `Ano de ${a}`, curto: `Ano ${a}` }))],
        nota: "Edições antigas são carregadas por ano, na hora, e podem levar alguns segundos." },
      { rot: "Órgão", tipo: "varios", vertical: true, get: () => f.org, set: (v) => (f.org = v), titulo: "Órgão julgador",
        opcoes: () => [{ v: "", t: "Todos os órgãos" }, ...orgaos.map((o) => ({ v: o, t: o, n: co[o] || 0 }))] },
      { rot: "Relator(a)", tipo: "varios", vertical: true, busca: "Buscar ministro(a)", get: () => f.rl, set: (v) => (f.rl = v),
        opcoes: () => [{ v: "", t: "Todos os relatores" }, ...Object.keys(cr).concat(listaV(f.rl).filter((r) => !cr[r])).sort((a, b) => norm(nomeMin(a)).localeCompare(norm(nomeMin(b)))).map((r) => ({ v: r, t: r, n: cr[r] || 0 }))],
        nota: "O relator aparece na linha de fechamento de cada julgado do Informativo. Em edições antigas, pode faltar." },
      { rot: "Só com tese", tipo: "toggle", get: () => f.tese, set: (v) => (f.tese = v), dica: "Mostra apenas os julgados em que o Informativo registra a tese fixada (edições a partir de 2021)." },
      defOrdem(() => f.s, (v) => (f.s = v), [{ v: "rec", t: "Edição mais recente" }, { v: "ant", t: "Edição mais antiga" }, { v: "rel", t: "Mais aderentes à busca" }]),
    ], aplicar);
    $("#is-q").addEventListener("input", debounce(aplicar, 200));
    $("#is-lista").addEventListener("click", async (e) => {
      const ab = e.target.closest("[data-is-abrir]"); if (!ab) return;
      const n = +ab.dataset.isAbrir, sec = ab.closest(".jt-ed");
      if (abertas.has(n)) abertas.delete(n); else abertas.add(n);
      sec.outerHTML = linhaEd(n);
      const ano = (dataEd.get(n) || "").slice(0, 4);
      if (abertas.has(n) && antigos.includes(ano) && !carregados.has(ano)) {
        await carregarAnos([ano], tokenIs);
        if (abertas.has(n)) { const s2 = $(`[data-is-ed="${n}"]`); if (s2) s2.outerHTML = linhaEd(n); }
      }
    });
    ligarAjuda($("#is-f"), $("#is-q"), aplicar);
    aplicar();
  }

  // ========================================================== REPETITIVOS
  async function vRepetitivos(main, p) {
    const vazioPT = { lista: [] };
    const [t, pt, pl] = await Promise.all([precedentes(), comSTJ() ? procTemas() : vazioPT, comSTJ() ? pautas() : []]);
    const emPauta = temasEmPauta(pl);
    const soSTF = trib() === "stf";
    // Tipo padrão: temas repetitivos (STJ), temas de repercussão geral (STF) ou os dois.
    const TIPO0 = soSTF ? "" : ambos() ? "Tema|RG" : "Tema";
    const ufs = new Map();
    for (const x of pt.lista) if (x.uf) { const k = `${x.tp}-${x.n}`; if (!ufs.has(k)) ufs.set(k, new Set()); ufs.get(k).add(x.uf); }
    const todasUF = [...new Set(pt.lista.map((x) => x.uf).filter(Boolean))].sort();
    const f = { q: p.get("q") || "", tipo: soSTF ? "" : p.has("tipo") ? (p.get("tipo") === "todos" ? "" : p.get("tipo")) : TIPO0, sit: p.get("sit") || "", org: p.get("org") || "", uf: p.get("uf") || "", a: p.get("a") || "", susp: p.get("susp") === "1", pauta: p.get("pauta") === "1", rel: p.get("rel") || "", s: p.get("s") || "mov" };
    main.innerHTML = `
      <div id="rp-f">
        ${campoBusca("rp-q", soSTF ? 'Título, tese ou assunto. Ex.: "ICMS" ou o número do tema' : 'Questão, tese ou assunto. Ex.: "prescrição intercorrente" ou o número do tema', f.q)}
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
      gravarHash("repetitivos", { ...f, tipo: soSTF || f.tipo === TIPO0 ? "" : f.tipo || "todos", s: f.s === "mov" ? "" : f.s });
      const qT = f.q.trim().replace(/^(tema|controv[eé]rsia|iac)\s*/i, "").replace(/\s*\/?\s*(stj|stf|rg)$/i, "").replace(/\./g, ""); const numero = /^\d+$/.test(qT) ? +qT : null;
      const c = numero != null ? Busca.compilar("") : Busca.compilar(f.q); termos = c.termos;
      const base = t.filter((x) => temV(f.tipo, x.tp) && temV(f.org, x.org) && (!f.uf || listaV(f.uf).some((u) => ufs.get(`${x.tp}-${x.n}`)?.has(u)))
        && (!f.susp || /suspens/i.test(x.info || "")) && (!f.pauta || emPauta.has(`${x.tp}-${x.n}`)) && (!f.rel || norm(x.rel || "") === norm(f.rel))
        && (numero != null ? x.n === numero : c.testa(x._n)));
      ca = contarMat(base, (x) => x.ar, (x) => x.sa);
      const b2 = base.filter((x) => casaMat(f.a, x.ar, x.sa));
      cont = { "": b2.length, andamento: 0, julgado: 0, cancelado: 0, semrg: 0 }; b2.forEach((x) => cont[x._g] !== undefined && cont[x._g]++);
      lista = b2.filter((x) => temV(f.sit, x._g));
      // Nos temas de repercussão geral, a "afetação" é o reconhecimento da repercussão geral e o julgamento, a fixação da tese.
      const porData = (k, k2) => (a, b) => (b[k] || b[k2] || "").localeCompare(a[k] || a[k2] || "") || b.n - a.n;
      lista.sort({ num: (a, b) => b.n - a.n, numc: (a, b) => a.n - b.n, afet: porData("afet", "rgd"), julg: porData("julg", "dtese") }[f.s] || porData("_mov"));
      $("#rp-info").innerHTML = `<b>${fmtInt(lista.length)}</b> registro(s) ${f.rel ? `com manifestação de ${esc(f.rel)} <button type="button" class="link-acao" id="rp-rel-x">${ico("x")} tirar</button> ` : ""}${explicacaoHTML(c)}`;
      $("#rp-rel-x")?.addEventListener("click", () => { f.rel = ""; aplicar(); });
      render(true);
    };
    pilulas($("#rp-pil"), [
      { rot: "Situação", tipo: "varios", vertical: true, get: () => f.sit, set: (v) => (f.sit = v), opcoes: () => [
        { v: "", t: "Todas", n: cont[""] }, { v: "andamento", t: "Em andamento", n: cont.andamento, ponto: "rel" },
        { v: "julgado", t: soSTF ? "Com tese fixada" : "Julgados", n: cont.julgado, ponto: "ok" }, ...(comSTF() ? [{ v: "semrg", t: "Sem repercussão geral", n: cont.semrg, ponto: "canc" }] : []), { v: "cancelado", t: "Cancelados/revisados", n: cont.cancelado, ponto: "canc" }],
        nota: comSTF() ? "Na repercussão geral, “em andamento” reúne os temas com repercussão geral reconhecida e mérito ainda pendente; “sem repercussão geral”, aqueles em que o STF a negou (em geral, por ser a questão infraconstitucional)." : "" },
      { rot: "Matéria", tipo: "materia", get: () => f.a, set: (v) => (f.a = v), cont: () => ca },
      ...(soSTF ? [] : [{ rot: "Tipo", titulo: "Tipo de precedente", tipo: "varios", vertical: true, padrao: TIPO0, semLimpar: true, get: () => f.tipo, set: (v) => (f.tipo = v), rotAtual: () => (ambos() ? "Repetitivos e repercussão geral" : "Temas repetitivos"), rotTodos: "Todos os tipos",
        opcoes: () => [{ v: "", t: "Todos os tipos" }, { v: "Tema", t: "Temas repetitivos (STJ)" }, ...(ambos() ? [{ v: "RG", t: "Repercussão geral (STF)" }] : []), { v: "Controvérsia", t: "Controvérsias" }, { v: "IAC", t: "IAC" }, { v: "SIRDR", t: "SIRDR" }, { v: "PUIL", t: "PUIL" }],
        nota: `<b>Tema repetitivo</b>: questão decidida pelo rito dos recursos repetitivos, com tese vinculante. ${ambos() ? "<b>Repercussão geral</b>: tema constitucional julgado pelo STF em recurso extraordinário, com tese de observância obrigatória. " : ""}<b>Controvérsia</b>: questão em triagem, ainda não afetada. <b>IAC</b>: incidente de assunção de competência. <b>SIRDR</b>: suspensão nacional em IRDR. <b>PUIL</b>: pedido de uniformização de interpretação de lei.` },
      { rot: "Órgão", tipo: "varios", vertical: true, get: () => f.org, set: (v) => (f.org = v), opcoes: () => [{ v: "", t: "Todos os órgãos" }, ...["Corte Especial", "Primeira Seção", "Segunda Seção", "Terceira Seção"].map((o) => ({ v: o, t: o })), ...(ambos() ? [{ v: "Repercussão geral", t: "Plenário do STF (repercussão geral)" }] : [])] },
      { rot: "Origem", tipo: "varios", busca: "Buscar UF", get: () => f.uf, set: (v) => (f.uf = v), titulo: "UF de origem dos processos", nota: "Estado de onde vieram os processos vinculados ao tema (leading cases e demais recursos). Só para os precedentes do STJ.", opcoes: () => [{ v: "", t: "Qualquer origem" }, ...todasUF.map((u) => ({ v: u, t: u }))] },
      { rot: "Em pauta", tipo: "toggle", get: () => f.pauta, set: (v) => (f.pauta = v), dica: "Só temas com processo incluído nas próximas sessões de julgamento do STJ." },
      { rot: "Com suspensão", tipo: "toggle", get: () => f.susp, set: (v) => (f.susp = v), dica: "Só temas em que o STJ determinou a suspensão dos processos sobre a questão." }]),
      defOrdem(() => f.s, (v) => (f.s = v), [{ v: "mov", t: "Última movimentação" }, { v: "afet", t: soSTF ? "Repercussão geral mais recente" : ambos() ? "Afetação ou repercussão geral mais recente" : "Afetação mais recente" }, { v: "julg", t: soSTF ? "Tese mais recente" : "Julgamento mais recente" }, { v: "num", t: "Número (maior primeiro)" }, { v: "numc", t: "Número (menor primeiro)" }]),
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
    // Palavras do texto na forma original, para explicar cada sugestão.
    const orig = new Map(); for (const w of texto.slice(0, 60000).match(/[\p{L}\p{N}]+/gu) || []) { const k2 = norm(w); if (!orig.has(k2)) orig.set(k2, w.toLowerCase()); }
    return pesos.map((d, i) => {
      let s = 0; const contrib = [];
      for (const [w, p] of q) { const x = d.v.get(w); if (x) { s += x * p; contrib.push([w, x * p]); } }
      contrib.sort((a, b) => b[1] - a[1]);
      return { t: docs[i], s: s / (d.n * qn), comuns: contrib.length, termos: contrib.slice(0, 4).map(([w]) => orig.get(w) || w) };
    })
      // Duas palavras em comum, no mínimo: uma só costuma ser coincidência.
      .filter((x) => x.s > 0.12 && x.comuns >= 2 && x.t._g !== "cancelado").sort((a, b) => b.s - a.s).slice(0, k);
  }
  // Bibliotecas de leitura de PDF e DOCX hospedadas no próprio site (versões fixas, conferidas pelo hash):
  // nenhum código de terceiros é carregado durante a análise do documento.
  const VENDOR = {
    pdf: { src: "vendor/pdf.min.js", sri: "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e" },
    pdfWorker: "vendor/pdf.worker.min.js",
    mammoth: { src: "vendor/mammoth.browser.min.js", sri: "sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz" },
  };
  function carregarScript({ src, sri }) {
    return new Promise((ok, erro) => { const s = document.createElement("script"); s.src = src; if (sri) { s.integrity = sri; s.crossOrigin = "anonymous"; } s.onload = ok; s.onerror = () => erro(new Error("Não foi possível carregar o leitor de arquivos. Cole o texto no campo abaixo.")); document.head.appendChild(s); });
  }
  // Texto lido do PDF, início de cada página (para indicar a página das citações) e páginas sem texto.
  const VF = { txt: "", pags: null, semTexto: [], cancelar: false };
  const LIM_ARQ_MB = 50;
  async function lerArquivo(arq, prog = () => {}) {
    const nome = arq.name.toLowerCase();
    VF.txt = ""; VF.pags = null; VF.semTexto = []; VF.cancelar = false;
    if (arq.size > LIM_ARQ_MB * 1024 * 1024) throw new Error(`O arquivo tem ${Math.round(arq.size / 1048576)} MB; o limite é ${LIM_ARQ_MB} MB. Divida o documento ou cole o texto.`);
    if (/\.(txt|md)$/.test(nome)) return arq.text();
    if (nome.endsWith(".pdf")) {
      if (!window.pdfjsLib) await carregarScript(VENDOR.pdf);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = VENDOR.pdfWorker;
      const pdf = await window.pdfjsLib.getDocument({ data: await arq.arrayBuffer(), isEvalSupported: false }).promise;
      let txt = ""; const pags = [], vazias = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        if (VF.cancelar) throw new Error("Leitura cancelada.");
        prog(i, pdf.numPages);
        const pg = await pdf.getPage(i); const c = await pg.getTextContent();
        const t = c.items.map((x) => x.str).join(" ");
        if (t.replace(/\s/g, "").length < 20) vazias.push(i);
        pags.push(txt.length); txt += t + "\n";
      }
      // Quase sem texto: o PDF é uma imagem digitalizada e precisa de OCR para ser lido.
      if (txt.replace(/\s/g, "").length < 200 || vazias.length / pdf.numPages > 0.8) throw new Error(`Este PDF parece digitalizado (${vazias.length} de ${pdf.numPages} páginas sem texto): o conteúdo é imagem e precisa passar por OCR antes da verificação. Muitos leitores de PDF oferecem a opção “Reconhecer texto”.`);
      VF.txt = txt; VF.pags = pags; VF.semTexto = vazias;
      return txt;
    }
    if (nome.endsWith(".docx")) {
      if (!window.mammoth) await carregarScript(VENDOR.mammoth);
      const r = await window.mammoth.extractRawText({ arrayBuffer: await arq.arrayBuffer() });
      return r.value;
    }
    throw new Error("Formato não suportado. Use PDF, DOCX, TXT ou MD.");
  }
  // ---- Dados que a petição atribui a um precedente (relator, órgão, datas), no trecho logo após a citação.
  const ORG_CIT = [
    [/corte\s+especial/i, "corte-especial"],
    [/(primeira|1[ªºa.]?)\s+se[çc][ãa]o|\bS1\b/i, "primeira-secao"], [/(segunda|2[ªºa.]?)\s+se[çc][ãa]o|\bS2\b/i, "segunda-secao"], [/(terceira|3[ªºa.]?)\s+se[çc][ãa]o|\bS3\b/i, "terceira-secao"],
    [/(primeira|1[ªºa.]?)\s+turma|\bT1\b/i, "primeira-turma"], [/(segunda|2[ªºa.]?)\s+turma|\bT2\b/i, "segunda-turma"], [/(terceira|3[ªºa.]?)\s+turma|\bT3\b/i, "terceira-turma"],
    [/(quarta|4[ªºa.]?)\s+turma|\bT4\b/i, "quarta-turma"], [/(quinta|5[ªºa.]?)\s+turma|\bT5\b/i, "quinta-turma"], [/(sexta|6[ªºa.]?)\s+turma|\bT6\b/i, "sexta-turma"],
  ];
  const dataCit = (d, m, a) => { const ano = a.length === 2 ? `20${a}` : a; return `${ano}${m.padStart(2, "0")}${d.padStart(2, "0")}`; };
  function dadosCitados(trecho) {
    const out = {}; let pos = Infinity;
    const rel = /\brel(?:ator[a]?\b|\.)\s*(?:p\/\s*(?:o\s+)?ac[óo]rd[ãa]o\s*)?[.:]?\s*(?:(?:o|a)\s+)?(?:min(?:istr[oa])?\.?\s+|des(?:embargador[a]?)?\.?\s+(?:convocad[oa]\s+)?)?(\p{L}[\p{L}'’\-]+(?:\s+(?:d[aeo]s?\s+)?\p{L}[\p{L}'’\-]+){0,5})/iu.exec(trecho);
    if (rel) {
      // O nome termina antes de palavras que já não são dele ("Terceira Turma", "julgado em").
      const pal = rel[1].split(/\s+/), fim = pal.findIndex((w) => /^(julgad|dj|primeir|segund|terceir|quart|quint|sext|turma|se[cç][aã]o|corte|em|publicad|p\.)/i.test(w));
      const nome = (fim < 0 ? pal : pal.slice(0, fim)).join(" ").replace(/\s+(d[aeo]s?)$/i, "");
      if (nome.length > 2) out.rel = nome;
    }
    for (const [re, slug] of ORG_CIT) { const m = re.exec(trecho); if (m && (out.o === undefined || m.index < pos)) { out.o = slug; pos = m.index; } }
    const j = /julgad[oa]\s+em\s*:?\s*(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})\b/i.exec(trecho);
    if (j) out.dd = dataCit(j[1], j[2], j[3]);
    const p = /\bDJ[eE]?[nN]?\s*(?:de\s+|:\s*)?(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})\b/.exec(trecho);
    if (p) out.dj = dataCit(p[1], p[2], p[3]);
    return out;
  }
  // Nome citado confere com o do acervo quando as palavras do nome citado estão no nome registrado.
  function mesmoRelator(citado, registrado) {
    const pal = (x) => norm(x).replace(/\([^)]*\)/g, " ").split(/[^a-z]+/).filter((w) => w.length > 2 && !["dos", "das", "des", "min", "ministro", "ministra", "rel", "relator", "relatora"].includes(w));
    const a = pal(citado), b = new Set(pal(registrado));
    if (!a.length) return true;
    const comuns = a.filter((w) => b.has(w)).length;
    return comuns === a.length || comuns >= 2;
  }
  const fmtAMD = (x) => (x && x.length === 8 ? `${x.slice(6, 8)}/${x.slice(4, 6)}/${x.slice(0, 4)}` : "—");
  const URL_PROC_STJ = (cl, n) => `https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaGenerica&termo=${encodeURIComponent(`${String(cl).trim().split(/\s+/).pop()} ${n}`)}`;
  async function vVerificar(main) {
    main.innerHTML = `
      <div class="verif-grade">
        <section class="card card-pad">
          <h2 style="margin:0 0 4px;font:700 19px/1.3 var(--serif)">Cole o texto ou envie o arquivo</h2>
          <p class="nota" style="color:var(--tx-3);font-size:13.5px;margin:0 0 12px">O arquivo é lido no seu navegador e não é enviado a nenhum servidor. Os leitores de PDF e DOCX ficam no próprio site: nenhum código externo é carregado durante a análise.</p>
          <div class="solta" id="vf-solta">${ico("arquivo")}<div style="margin-top:6px">Arraste um PDF, DOCX, TXT ou MD, ou <label style="color:var(--pri);font-weight:600;cursor:pointer">escolha um arquivo<input type="file" id="vf-arq" accept=".pdf,.docx,.txt,.md" hidden></label></div><div id="vf-nome" class="meta" role="status" aria-live="polite" style="justify-content:center;margin-top:6px"></div><div class="meta" style="justify-content:center;margin-top:4px">Até ${LIM_ARQ_MB} MB. PDFs digitalizados (imagem) precisam de OCR.</div></div>
          <textarea id="vf-txt" rows="14" style="margin-top:12px" placeholder="Ou cole aqui o texto da petição, do recurso ou do parecer…"></textarea>
          <div class="acoes"><button class="btn btn-pri" id="vf-ok">${ico("verificar")} Verificar citações</button><button class="btn btn-fant" id="vf-limpar">Limpar</button></div>
        </section>
        <section id="vf-res">${vazio("verificar", "O que esta verificação faz", "Localiza os temas, precedentes e súmulas citados no texto; informa a situação atual de cada tema (tese firmada, em andamento, cancelado ou revisado); indica processos citados que são leading cases de repetitivos ou estão em pauta; e sugere precedentes qualificados com assunto parecido.")}</section>
      </div>`;
    const solta = $("#vf-solta");
    const receber = async (arq) => {
      if (!arq) return;
      const st = $("#vf-nome");
      st.innerHTML = `<span>Lendo ${esc(arq.name)}…</span> <button type="button" class="btn btn-fant btn-peq" id="vf-cancelar">Cancelar</button>`;
      $("#vf-cancelar").addEventListener("click", () => { VF.cancelar = true; });
      try {
        $("#vf-txt").value = await lerArquivo(arq, (i, n) => { const sp = $("span", st); if (sp) sp.textContent = `Lendo ${arq.name}: página ${i} de ${n}…`; });
        st.textContent = `${arq.name} carregado${VF.pags ? ` (${VF.pags.length} página${VF.pags.length > 1 ? "s" : ""})` : ""}.`;
        verificar();
      } catch (e) { st.textContent = e.message; }
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
    res.setAttribute("aria-busy", "true");
    // Páginas do PDF lido (se o texto não foi alterado depois da leitura).
    const pags = VF.txt === txt ? VF.pags : null;
    const pagina = (i) => { if (!pags) return 0; let p = 1; while (p < pags.length && pags[p] <= i) p++; return p; };
    const trechoDe = (i, len) => {
      const ini = Math.max(0, i - 70), fim = Math.min(txt.length, i + len + 70);
      return `${ini > 0 ? "…" : ""}${esc(txt.slice(ini, i))}<mark>${esc(txt.slice(i, i + len))}</mark>${esc(txt.slice(i + len, fim))}${fim < txt.length ? "…" : ""}`.replace(/\s+/g, " ");
    };
    const ocorr = (mapa, k, dados, i, len) => { if (!mapa.has(k)) mapa.set(k, { ...dados, oc: [] }); mapa.get(k).oc.push({ i, len, pg: pagina(i) }); };
    // Onde a citação aparece: primeiro trecho e, havendo mais, as páginas (PDF) ou o número de ocorrências.
    const ondeHTML = (c) => {
      const pgs = [...new Set(c.oc.map((o) => o.pg).filter(Boolean))];
      const onde = pgs.length ? `${pgs.length > 1 ? "Páginas" : "Página"} ${pgs.join(", ")}` : "";
      const vezes = c.oc.length > 1 ? `citado ${c.oc.length} vezes` : "";
      return `<details class="cit-onde"><summary>${[onde, vezes].filter(Boolean).join(" · ") || "Ver trecho"}</summary>${c.oc.slice(0, 6).map((o) => `<p>${o.pg ? `<b>p. ${o.pg}</b> · ` : ""}${trechoDe(o.i, o.len)}</p>`).join("")}${c.oc.length > 6 ? `<p class="nota">e mais ${c.oc.length - 6}.</p>` : ""}</details>`;
    };

    // 1. Citações no texto (todas as ocorrências).
    const citTemas = new Map(), temasOutros = new Map(), citRG = new Map();
    // Modo STF: "Tema 69" e "Súmula 13" sem tribunal indicado são conferidos como do STF.
    const padraoSTF = trib() === "stf";
    const reT = /\b(tema|temas|controv[ée]rsia|iac)\s+(?:repetitivo\s+|n[º°o.]*\s*|de\s+n[º°o.]*\s*)*(\d{1,3}(?:\.\d{3})+|\d+)(?![\d])(?:\s*(?:\/|do|da)\s*(stj|stf|superior tribunal de justi[çc]a|supremo))?/gi;
    let m;
    while ((m = reT.exec(txt))) {
      const tipo = /^controv/i.test(m[1]) ? "Controvérsia" : /^iac/i.test(m[1]) ? "IAC" : "Tema";
      const n = +m[2].replace(/\./g, ""); const corte = norm(m[3] || "");
      const depois = txt.slice(m.index + m[0].length, m.index + m[0].length + 40);
      const doSTF = /stf|supremo/.test(corte) || /^\s*(da repercuss|de repercuss|do stf|do supremo)/i.test(depois) || (padraoSTF && tipo === "Tema" && !corte);
      if (doSTF) { if (comSTF()) ocorr(citRG, n, { n, semTrib: !corte && !/repercuss|stf|supremo/i.test(depois) }, m.index, m[0].length); else ocorr(temasOutros, `STF-${n}`, { rot: `Tema ${n}/STF` }, m.index, m[0].length); continue; }
      ocorr(citTemas, `${tipo}-${n}`, { tipo, n }, m.index, m[0].length);
    }
    const citProc = new Map();
    const reP = /\b((?:(?:AgInt|AgRg|EDcl|EREsp|EAREsp)\s+(?:no|nos|na|em)\s+)*(?:REsp|AREsp|EREsp|EAREsp|RMS|HC|RHC|CC|MS|Rcl|AR|AgInt|AgRg))\s*(?:n[º°o.]*\s*)?(\d{1,3}(?:\.\d{3})+|\d{4,7})(?:\s*\/\s*([A-Z]{2}))?/g;
    while ((m = reP.exec(txt))) { const nd = digitos(m[2]); if (nd.length < 4) continue; ocorr(citProc, `${classeBase(m[1]).toLowerCase()}-${nd}`, { cl: m[1].replace(/\s+/g, " "), n: nd, uf: m[3] || "" }, m.index, m[0].length); }
    // Relator, órgão e datas citados: no trecho entre a citação e a próxima (até 320 caracteres).
    const inicios = [...citProc.values()].flatMap((c) => c.oc.map((o) => o.i)).sort((a, b) => a - b);
    for (const c of citProc.values()) {
      // Cada ocorrência é conferida à parte (a mesma peça pode citar o precedente com dados diferentes).
      c.cits = []; const vistos = new Set();
      for (const o of c.oc) {
        const prox = inicios.find((i) => i > o.i) ?? txt.length;
        const d = dadosCitados(txt.slice(o.i + o.len, Math.min(prox, o.i + o.len + 320)));
        const k = JSON.stringify([d.rel && norm(d.rel), d.o, d.dd, d.dj]);
        if ((d.rel || d.o || d.dd || d.dj) && !vistos.has(k)) { vistos.add(k); c.cits.push({ ...d, pg: o.pg }); }
      }
    }
    const citSum = new Map(), sumOutras = new Map(), citSF = new Map();
    const reS = /\bs[úu]mulas?\s+(vinculante\s+)?(?:n[º°o.]*\s*)?(\d+)(?![\d])(?:\s*(?:\/|do|da)\s*(stj|stf|tst|tse))?/gi;
    while ((m = reS.exec(txt))) {
      const tr = m[1] ? "STF" : (m[3] || "").toUpperCase() || (padraoSTF ? "STF" : "");
      if (tr === "STF" && comSTF()) ocorr(citSF, `STF-${m[1] ? "SV" : "S"}${m[2]}`, { n: +m[2], v: !!m[1], semTrib: !m[1] && !m[3] }, m.index, m[0].length);
      else if (tr && tr !== "STJ") ocorr(sumOutras, `${m[1] ? "SV " : ""}${m[2]}/${tr}`, { rot: `Súmula ${m[1] ? "Vinculante " : ""}${m[2]}/${tr}` }, m.index, m[0].length);
      else ocorr(citSum, m[2], { n: +m[2], semTrib: !tr }, m.index, m[0].length);
    }

    // 2. Bases necessárias (o índice de números só é baixado se houver processo citado).
    const LIM = 120;
    const procs = [...citProc.values()].slice(0, LIM);
    const [rgs, sfs] = await Promise.all([citRG.size ? temasRG().catch(() => null) : null, citSF.size ? sumulasSTF().catch(() => null) : null]);
    const [t, pt, pl, ix, dj, nums, sums, mns] = await Promise.all([temas(), procTemas(), pautas(), indice(), djen(),
      procs.length ? numerosDe(procs.map((c) => c.n)).catch(() => null) : null, citSum.size ? sumulas().catch(() => []) : [],
      procs.length ? monocraticasDe(procs.map((c) => c.n)).catch(() => []) : []]);
    const porMono = new Map(); for (const x of mns) { if (!porMono.has(x.n)) porMono.set(x.n, []); porMono.get(x.n).push(x); }
    const porNumero = new Map();
    if (nums) for (const x of nums.l) { if (!porNumero.has(x[0])) porNumero.set(x[0], []); porNumero.get(x[0]).push(x); }

    const alertas = [];
    const linhasTema = [...citTemas.values()].map((c) => {
      const x = t.idx.get(`${c.tipo}-${c.n}`);
      if (!x) return `<div class="cit"><span class="cit-tit">${c.tipo} ${c.n}</span><span class="selo canc">Não encontrado nesta base</span><div class="cit-txt">Não consta da lista de precedentes qualificados do STJ. Confira se o número está correto ou se o tema é de outro tribunal.</div>${ondeHTML(c)}</div>`;
      let nota = "", selo = seloSit(x.sit);
      if (x._g === "cancelado") { nota = `<b>Atenção:</b> a situação atual é “${esc(x.sit)}”. Revise o uso deste precedente.`; alertas.push(`${c.tipo} ${c.n} está ${x.sit.toLowerCase()}`); }
      else if (x._teseAguarda) nota = `Julgado; ${esc(x._teseAguarda.charAt(0).toLowerCase() + x._teseAguarda.slice(1))}`;
      else if (x._g === "andamento") { nota = `Ainda sem tese firmada.${/suspens/i.test(x.info || "") ? " <b>Há determinação de suspensão</b> de processos." : ""}`; }
      else if (x.tese) nota = `<b>Tese:</b> ${esc(x.tese)}`;
      return `<div class="cit" data-tema="${esc(x.tp)}|${x.n}"><span class="cit-tit"><button type="button" class="link-acao" data-abrir-tema>${esc(x.tp)} ${x.n}</button></span>${selo}<div class="cit-txt">${nota}</div>${ondeHTML(c)}</div>`;
    });
    // Classe de um processo escrito como "REsp 1633613"; vazio se não houver classe no texto.
    const classeDe = (txt) => classeBase(String(txt || "").replace(/\s*\d[\s\S]*$/, "")).toLowerCase();
    const mesmaCl = (txt, c) => { const a = classeDe(txt); return !a || a === classeBase(c.cl).toLowerCase(); };
    const linhasProc = procs.map((c) => {
      const vinc = (pt.porNum.get(c.n) || []).filter((v) => mesmaCl(v.p, c));
      const pauta = pl.filter((p) => digitos(p.p) === c.n && mesmaCl(p.p, c));
      const ac = ix.find((r) => r.n === c.n && classeBase(r.cl).toLowerCase() === classeBase(c.cl).toLowerCase());
      const pub = dj.find((x) => digitos(x.p) === c.n && mesmaCl(x.p, c));
      // Mesmo número, mas só da classe citada (o REsp 1.234 e o AREsp 1.234 são processos diferentes).
      const cb = classeBase(c.cl).toLowerCase();
      const linhasN = porNumero.get(c.n) || [];
      const mesmaClasse = linhasN.filter((x) => x[5] === undefined || x[5].toLowerCase() === cb);
      const outraClasse = [...new Set(linhasN.filter((x) => x[5] !== undefined && x[5].toLowerCase() !== cb).map((x) => x[5]))];
      const noAcervo = mesmaClasse.map((x) => ({ m: nums.m[x[2]], o: nums.o[x[3]], id: x[4] })).sort((a, b) => b.m.localeCompare(a.m));
      const notas = [];
      // Conferência dos dados citados com os acórdãos do processo no acervo.
      const monos = (porMono.get(c.n) || []).filter((x) => x.cl.toLowerCase() === cb);
      // Julgamentos do processo com que os dados citados são conferidos: acórdãos do acervo e monocráticas.
      const cand = [...mesmaClasse.filter((x) => x[6] !== undefined).map((x) => ({ rel: x[6], o: nums.o[x[3]], dd: x[7], dj: x[8] })),
        ...monos.map((x) => ({ rel: x.min, o: "", dd: "", dj: x.d.replace(/-/g, ""), mono: true }))];
      let conf = "";
      if (cand.length && c.cits.length) {
        const difsTot = new Set();
        const uniq = (f) => [...new Set(cand.map(f).filter(Boolean))].join(" / ");
        const linhas = c.cits.slice(0, 4).map((ci) => {
          const partes = [], difs = [];
          const item = (rot, ok, real) => { partes.push(`${rot} ${ok ? '<span class="conf ok">confere</span>' : `<span class="conf dif">no acervo: ${esc(real)}</span>`}`); };
          if (ci.rel) { const ok = cand.some((x) => mesmoRelator(ci.rel, x.rel)); item(`relator ${esc(ci.rel)}`, ok, uniq((x) => relatorFmt(x.rel))); if (!ok) difs.push("relator"); }
          // Órgão e data de julgamento só existem para os acórdãos.
          if (ci.o && cand.some((x) => x.o)) { const ok = cand.some((x) => x.o === ci.o); item(esc(D.orgaos[ci.o] || ci.o), ok, uniq((x) => D.orgaos[x.o] || "")); if (!ok) difs.push("órgão"); }
          if (ci.dd && cand.some((x) => x.dd)) { const ok = cand.some((x) => x.dd === ci.dd); item(`julgado em ${fmtAMD(ci.dd)}`, ok, uniq((x) => (x.dd ? fmtAMD(x.dd) : ""))); if (!ok) difs.push("data do julgamento"); }
          if (ci.dj) { const ok = cand.some((x) => x.dj === ci.dj); item(`DJe ${fmtAMD(ci.dj)}`, ok, uniq((x) => fmtAMD(x.dj))); if (!ok) difs.push("data da publicação"); }
          difs.forEach((d) => difsTot.add(d));
          return partes.length ? `<p class="cit-dados"><b>Dados citados${c.cits.length > 1 && ci.pg ? ` (p. ${ci.pg})` : c.cits.length > 1 ? ` (${c.cits.indexOf(ci) + 1}ª citação)` : ""}:</b> ${partes.join("; ")}.</p>` : "";
        });
        conf = linhas.join("") + (difsTot.size ? `<p class="cit-dados nota">Confira: o dado divergente pode se referir a outro julgamento do mesmo processo (agravo, embargos) ou a uma decisão monocrática anterior a 2021.</p>` : "");
        if (difsTot.size) alertas.push(`${c.cl} ${fmtNumProc(c.n)}: ${[...difsTot].join(", ")} citado${difsTot.size > 1 ? "s" : ""} não confere${difsTot.size > 1 ? "m" : ""} com o acervo`);
      }
      const notaMono = !monos.length ? "" : (`<b>${monos.length === 1 ? "1 decisão monocrática" : `${monos.length} decisões monocráticas`}</b> neste processo: ${monos.slice(0, 3).map((x) => `<a class="link-acao" href="${URLS.mono(x)}" target="_blank" rel="noopener">${esc(x.rec && x.rec !== "DESIS" ? `${x.rec}, ` : "")}${esc(relatorFmt(x.min))}, ${fmtData(x.d)}: ${esc(desfechoMono(x).toLowerCase())}</a>`).join(" · ")}${monos.length > 3 ? ` · <a class="link-acao" href="#pesquisa?q=${c.n}">ver todas</a>` : ""}`);
      for (const v of vinc) { const x = t.idx.get(`${v.tp}-${v.n}`); notas.push(`${v.lc ? "Leading case" : "Processo vinculado"} ${v.tp === "Controvérsia" ? "à" : "ao"} <button type="button" class="link-acao" data-tema-direto="${esc(v.tp)}|${v.n}">${esc(v.tp)} ${v.n}</button>${x ? ` (${esc(x.sit)})` : ""}`); }
      for (const p of pauta) notas.push(`<b>Em pauta</b> em ${fmtData(p.d)} · ${esc(D.orgaos[p.o] || "")}${p.pet ? " (" + esc(p.pet) + ")" : ""}`);
      if (noAcervo.length) notas.push(`<b>${noAcervo.length} acórdão(s) no acervo</b> neste processo: ${noAcervo.slice(0, 4).map((a) => `<button type="button" class="link-acao" data-vf-ac="${esc(a.id)}|${a.m}|${a.o}|${esc(c.cl)}|${c.n}">${esc(D.orgaos[a.o] || a.o)}, ${fmtMes(a.m)}</button>`).join(" · ")}${noAcervo.length > 4 ? ` · <a class="link-acao" href="#pesquisa?q=${c.n}">ver todos</a>` : ""}`);
      else if (ac) notas.push(`Acórdão publicado em ${fmtData(ac.dj)} · ${esc(D.orgaos[ac.o] || "")}`);
      if (pub && !ac && !noAcervo.length) notas.push(`Acórdão publicado no DJEN em ${fmtData(pub.d)}, ainda sem ementa no acervo`);
      if (notaMono) notas.push(notaMono);
      const avisoClasse = !noAcervo.length && outraClasse.length ? ` O acervo tem acórdão de ${outraClasse.map(esc).join(" e ")} com esse número, mas não de ${esc(classeBase(c.cl))}; confira a classe citada.` : "";
      const stj = `<a class="link-acao" href="${URL_PROC_STJ(c.cl, c.n)}" target="_blank" rel="noopener">consultar no site do STJ ${ico("externo")}</a>`;
      // O número do recurso abre o próprio julgado (o acórdão mais recente do processo no acervo); na falta
      // dele, o tema a que o processo está vinculado, a publicação no DJEN ou a pauta; por fim, o site do STJ.
      const rotP = `${esc(c.cl)} ${fmtNumProc(c.n)}${c.uf ? "/" + esc(c.uf) : ""}`;
      const alvo = noAcervo[0] || (ac ? { id: ac.id, m: ac.m, o: ac.o } : null);
      const titP = alvo ? `<button type="button" class="link-acao" data-vf-ac="${esc(alvo.id)}|${alvo.m}|${alvo.o}|${esc(c.cl)}|${c.n}" title="Abrir o acórdão${noAcervo.length > 1 ? " mais recente" : ""} deste processo">${rotP}</button>`
        : vinc.length ? `<button type="button" class="link-acao" data-tema-direto="${esc(vinc[0].tp)}|${vinc[0].n}" title="Abrir ${vinc[0].tp === "Controvérsia" ? "a" : "o"} ${esc(vinc[0].tp)} ${vinc[0].n}, a que o processo está vinculado">${rotP}</button>`
        : monos.length ? `<a class="link-acao" href="${URLS.mono(monos[0])}" target="_blank" rel="noopener" title="Abrir a decisão monocrática oficial (PDF do STJ)">${rotP} ${ico("externo")}</a>`
        : pub || pauta.length ? `<a class="link-acao" href="#pesquisa?q=${c.n}" title="Ver a publicação no DJEN e a pauta deste processo">${rotP}</a>`
        : `<a class="link-acao" href="${URL_PROC_STJ(c.cl, c.n)}" target="_blank" rel="noopener" title="Consultar o processo no site do STJ">${rotP} ${ico("externo")}</a>`;
      return `<div class="cit"><span class="cit-tit">${titP}</span>${notas.length ? '<span class="selo pri">Encontrado</span>' : '<span class="selo">Não encontrado nesta base</span>'}<div class="cit-txt">${notas.join("<br>") || `Não consta do acervo do site, das pautas, dos precedentes qualificados nem das decisões monocráticas publicadas desde 2021. O acervo reúne os acórdãos colegiados dos Dados Abertos do STJ; isso não significa que o processo não exista.${avisoClasse} ${stj}`}</div>${conf}${ondeHTML(c)}</div>`;
    });
    const porSum = new Map((sums || []).map((s) => [s.n, s]));
    const linhasSum = [...citSum.values()].map((c) => {
      const s = porSum.get(c.n);
      const obs = c.semTrib ? `<p class="nota">Tribunal não indicado no texto; conferida como súmula do STJ.</p>` : "";
      if (!s) return `<div class="cit"><span class="cit-tit">Súmula ${c.n}</span><span class="selo canc">Não encontrada nesta base</span><div class="cit-txt">Não há súmula do STJ com esse número.${c.semTrib ? " Pode ser de outro tribunal." : ""}</div>${ondeHTML(c)}</div>`;
      const sit = s.sit === "cancelada" ? '<span class="selo canc">Cancelada</span>' : s.sit === "alterada" ? '<span class="selo rel">Alterada</span>' : '<span class="selo ok">Vigente</span>';
      if (s.sit !== "vigente" && !c.semTrib) alertas.push(`Súmula ${c.n}/STJ ${s.sit === "cancelada" ? "foi cancelada" : "teve a redação alterada"}`);
      else if (s.sit !== "vigente") alertas.push(`Súmula ${c.n} (se do STJ) ${s.sit === "cancelada" ? "foi cancelada" : "teve a redação alterada"}`);
      return `<div class="cit"><span class="cit-tit"><button type="button" class="link-acao" data-vf-sum="${s.n}">Súmula ${s.n}/STJ</button></span>${sit}<div class="cit-txt">${esc(s.t)}${obs}</div>${ondeHTML(c)}</div>`;
    });
    // Temas de repercussão geral e súmulas do STF (quando o STF está entre os tribunais exibidos).
    const linhasRG = [...citRG.values()].map((c) => {
      const x = rgs?.idx.get(`RG-${c.n}`);
      const obs = c.semTrib ? `<p class="nota">Tribunal não indicado no texto; conferido como tema de repercussão geral do STF.</p>` : "";
      if (!x) return `<div class="cit"><span class="cit-tit">Tema ${c.n}/STF</span><span class="selo canc">Não encontrado nesta base</span><div class="cit-txt">Não há tema de repercussão geral com esse número na lista do STF.</div>${ondeHTML(c)}</div>`;
      let nota = "";
      if (x._g === "cancelado") { nota = `<b>Atenção:</b> o tema foi cancelado.`; alertas.push(`Tema ${c.n}/STF foi cancelado`); }
      else if (x._g === "semrg") { nota = `<b>Atenção:</b> o STF negou a repercussão geral${/infraconst/i.test(x.rgt || "") ? " (questão infraconstitucional)" : ""}.${x.tese ? ` <b>Tese:</b> ${esc(x.tese)}` : ""}`; alertas.push(`Tema ${c.n}/STF: sem repercussão geral`); }
      else if (x.tese) nota = `<b>Tese:</b> ${esc(x.tese)}`;
      else if (x.dtese) nota = `Julgado em ${fmtData(x.dtese)}; tese ainda não publicada na página do STF.`;
      else nota = "Repercussão geral reconhecida; mérito ainda pendente.";
      return `<div class="cit" data-tema="RG|${x.n}"><span class="cit-tit"><button type="button" class="link-acao" data-abrir-tema>Tema ${x.n}/STF</button></span>${seloSit(x.sit)}<div class="cit-txt">${esc(x.q)}<br>${nota}${obs}</div>${ondeHTML(c)}</div>`;
    });
    const linhasSF = [...citSF.values()].map((c) => {
      const x = sfs?.idx.get(`STF-${c.v ? "SV" : "S"}${c.n}`);
      const rot = `${c.v ? "Súmula Vinculante" : "Súmula"} ${c.n}/STF`;
      const obs = c.semTrib ? `<p class="nota">Tribunal não indicado no texto; conferida como súmula do STF.</p>` : "";
      if (!x) return `<div class="cit"><span class="cit-tit">${rot}</span><span class="selo canc">Não encontrada nesta base</span><div class="cit-txt">Não há ${c.v ? "súmula vinculante" : "súmula"} do STF com esse número.</div>${ondeHTML(c)}</div>`;
      const [sit, cls] = SIT_SUM_STF[x.sit] || SIT_SUM_STF.vigente;
      if (x._canc) alertas.push(`${rot} está ${x.sit}`);
      return `<div class="cit"><span class="cit-tit"><button type="button" class="link-acao" data-sum-stf="${esc(x._k)}">${rot}</button></span><span class="selo ${cls}">${sit}</span><div class="cit-txt">${esc(x.t)}${obs}</div>${ondeHTML(c)}</div>`;
    });
    const outros = [...temasOutros.values(), ...sumOutras.values()];
    // Sugestões por semelhança só fazem sentido com texto de mérito suficiente: as citações e as
    // palavras genéricas não contam.
    const semCitacoes = txt.replace(/\b(tema|temas|controv[ée]rsia|iac|s[úu]mulas?|resp|aresp|agint|agrg|edcl)\b[^.;\n]{0,40}/gi, " ");
    const poucoTexto = new Set(tokens(semCitacoes)).size < 25;
    const sem = poucoTexto || padraoSTF ? [] : await temasSemelhantes(txt, 6);
    const jaCit = new Set(citTemas.keys());
    const sugest = sem.filter((x) => !jaCit.has(`${x.t.tp}-${x.t.n}`));
    const nada = !citTemas.size && !citProc.size && !citSum.size && !citRG.size && !citSF.size;
    const semAlerta = !nada && !alertas.length;
    res.removeAttribute("aria-busy");
    res.innerHTML = `
      <div class="card card-pad">
        <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr));margin:0">
          <div class="stat" style="cursor:default"><span><b>${citTemas.size + citRG.size}</b><span>tema(s) citado(s)${citRG.size && citTemas.size ? ` (${citRG.size} do STF)` : citRG.size ? " do STF" : ""}</span></span></div>
          <div class="stat" style="cursor:default"><span><b>${citProc.size}</b><span>precedente(s) do STJ citado(s)</span></span></div>
          <div class="stat" style="cursor:default"><span><b>${citSum.size + citSF.size}</b><span>súmula(s) citada(s)${comSTF() ? "" : " do STJ"}</span></span></div>
        </div>
        ${alertas.length ? `<p class="aviso" role="alert" style="margin-top:12px">${ico("alerta")}<span><b>Pontos de atenção:</b> ${alertas.map(esc).join("; ")}.</span></p>` : ""}
        ${semAlerta ? `<p class="aviso ok" style="margin-top:12px">${ico("verificar")}<span><b>Nenhum ponto de atenção encontrado</b> nos temas e súmulas ${comSTF() ? "" : "do STJ "}citados. Os precedentes não encontrados nesta base continuam a merecer conferência no site do tribunal.</span></p>` : ""}
        ${nada ? "" : `<p class="nota ressalva" style="margin-top:10px">A verificação é automática: confere a existência, a situação e os dados dos precedentes nesta base, mas não a fidelidade das transcrições, o contexto do julgado nem a sua aplicabilidade ao caso concreto.</p>`}
        ${pags && VF.semTexto.length ? `<p class="aviso" style="margin-top:12px">${ico("alerta")}<span>${VF.semTexto.length === 1 ? "A página" : "As páginas"} ${VF.semTexto.slice(0, 20).join(", ")}${VF.semTexto.length > 20 ? "…" : ""} não ${VF.semTexto.length === 1 ? "tem" : "têm"} texto (provavelmente digitalizada${VF.semTexto.length === 1 ? "" : "s"}) e não ${VF.semTexto.length === 1 ? "foi verificada" : "foram verificadas"}.</span></p>` : ""}
        ${nada ? `<p class="nota" style="margin-top:12px">Nenhuma citação de tema, processo ou súmula do STJ foi identificada no texto. A verificação reconhece formas como “Tema 1.234”, “REsp 2.231.419/SP” e “Súmula 7/STJ”.</p>` : ""}
        ${citProc.size > LIM ? `<p class="aviso" style="margin-top:12px">${ico("alerta")}<span>O texto cita ${citProc.size} processos; foram conferidos os ${LIM} primeiros.</span></p>` : ""}
      </div>
      ${padraoSTF && !citTemas.size ? "" : `<div class="card card-pad" style="margin-top:12px"><h3 style="margin:0 0 6px">${comSTF() ? "Temas e precedentes do STJ citados" : "Temas citados"}</h3>${linhasTema.join("") || '<p class="nota">Nenhum tema do STJ identificado no texto.</p>'}</div>`}
      ${comSTF() ? `<div class="card card-pad" style="margin-top:12px"><h3 style="margin:0 0 6px">Temas de repercussão geral (STF) citados</h3>${linhasRG.join("") || '<p class="nota">Nenhum tema do STF identificado no texto. A verificação reconhece formas como “Tema 69/STF” e “Tema 69 da repercussão geral”.</p>'}</div>` : ""}
      ${citSF.size ? `<div class="card card-pad" style="margin-top:12px"><h3 style="margin:0 0 6px">Súmulas do STF citadas</h3>${linhasSF.join("")}</div>` : ""}
      <div class="card card-pad" style="margin-top:12px"><h3 style="margin:0 0 6px">Precedentes citados</h3>${linhasProc.join("") || '<p class="nota">Nenhum número de processo identificado.</p>'}</div>
      ${citSum.size ? `<div class="card card-pad" style="margin-top:12px"><h3 style="margin:0 0 6px">Súmulas do STJ citadas</h3>${linhasSum.join("")}</div>` : ""}
      ${outros.length ? `<div class="card card-pad" style="margin-top:12px"><h3 style="margin:0 0 2px">Citações de outros tribunais</h3><p class="nota" style="margin-bottom:8px">Identificadas no texto, mas não conferidas${comSTF() ? "" : ": para conferir os temas e súmulas do STF, escolha “Radar STJ · STF” no alto do menu"}.</p><div class="chips">${outros.map((o) => `<span class="selo">${esc(o.rot)}${o.oc.length > 1 ? ` · ${o.oc.length}×` : ""}</span>`).join("")}</div></div>` : ""}
      <div class="card card-pad" style="margin-top:12px"${padraoSTF ? " hidden" : ""}><h3 style="margin:0 0 2px">Precedentes qualificados do STJ com assunto parecido</h3><p class="nota" style="margin-bottom:6px">Sugestões automáticas por semelhança de palavras, que não foram citadas no texto. Confira a pertinência.</p>
        ${poucoTexto ? '<p class="nota">O texto é curto demais para comparar: as sugestões aparecem quando há ao menos um parágrafo sobre o mérito (as citações não contam).</p>'
          : sugest.length ? sugest.map((x) => `<div class="cit" data-tema="${esc(x.t.tp)}|${x.t.n}"><span class="cit-tit"><button type="button" class="link-acao" data-abrir-tema>${esc(x.t.tp)} ${x.t.n}</button></span>${seloSit(x.t.sit)}<div class="cit-txt">${esc(x.t.tese ? "Tese: " + x.t.tese : x.t.q)}<p class="cit-porque">Em comum com o texto: ${x.termos.map((w) => `<b>${esc(w)}</b>`).join(", ")}</p></div></div>`).join("") : '<p class="nota">Nenhuma sugestão com semelhança suficiente.</p>'}</div>
      <div class="acoes" style="margin-top:12px"><button type="button" class="btn btn-claro btn-peq" id="vf-copiar">${ico("copiar")} Copiar relatório</button></div>`;
    $$("[data-tema-direto]", res).forEach((b) => b.addEventListener("click", () => { const [tp, n] = b.dataset.temaDireto.split("|"); abrirTema(tp, +n); }));
    $$("[data-vf-sum]", res).forEach((b) => b.addEventListener("click", () => abrirSumula(+b.dataset.vfSum)));
    $("#vf-copiar").addEventListener("click", () => copiar(relatorioTexto(res), "Relatório copiado."));
  }
  // Relatório em texto simples (para colar em e-mail ou no processo interno).
  function relatorioTexto(res) {
    const L = [`Verificação de citações · ${TRIBS[trib()].rot} · ${fmtData(hojeISO())}`, ""];
    for (const card of $$(".card", res)) {
      const h = $("h3", card)?.textContent;
      if (h?.startsWith("Precedentes qualificados")) continue;
      if (h) L.push(h.toUpperCase());
      for (const c of $$(".cit", card)) {
        const tit = $(".cit-tit", c)?.textContent.trim(), selo = $(".selo", c)?.textContent.trim(), onde = $(".cit-onde summary", c)?.textContent.trim();
        const txtc = $(".cit-txt", c)?.innerText.replace(/consultar no site do STJ/g, "").replace(/\s+/g, " ").trim();
        const dados = $(".cit-dados", c)?.innerText.replace(/\s+/g, " ").trim();
        L.push(`- ${tit}${selo ? ` [${selo}]` : ""}${onde && onde !== "Ver trecho" ? ` (${onde})` : ""}${txtc ? `: ${txtc}` : ""}${dados ? ` ${dados}` : ""}`);
      }
      if (h) for (const x of $$(".chips .selo", card)) L.push(`- ${x.textContent.trim()}`);
      if (!h) for (const p of $$(".aviso, .stat", card)) L.push(p.innerText.replace(/\s+/g, " ").trim());
      L.push("");
    }
    L.push(`Base: acórdãos colegiados dos Dados Abertos do STJ, decisões monocráticas publicadas desde 2021 (sem o texto), precedentes qualificados e súmulas do STJ${comSTF() ? "; temas de repercussão geral e súmulas do STF (páginas oficiais do Supremo)" : ""}.`);
    return L.join("\n");
  }

  // ================================================================= SOBRE
  // Versão do site e novidades (o que mudou para quem usa, inclusive critérios e cobertura).
  const VERSAO = "2026.10.02";
  const NOVIDADES = [
    ["2026-10-02", [
      "Citação pronta para a peça nos temas: os botões “Copiar tese e citação” e “Copiar só a citação” (repercussão geral do STF e repetitivos do STJ) geram a referência com tribunal, tema, órgão, relator e datas, e os temas salvos também podem ser copiados com a citação.",
      "Aviso na Visão geral quando a coleta dos dados do STF atrasa (mais de cinco dias sem atualização), com a data da última coleta e o caminho para a situação de cada fonte. A rotina diária também passa a falhar, com e-mail do GitHub, se o registro do STF ficar desatualizado.",
      "Carregamento mais leve: a relação entre acórdãos e repetitivos (cerca de 3,5 MB) só é baixada quando o usuário se aproxima das telas que a usam, e imagens e fontes passam a ficar guardadas no navegador entre visitas.",
      "Carrossel da Visão geral maior, com barra de tempo em cada destaque, movimento lento de aproximação nas fotos e, nos destaques sem foto própria (teses, pautas e notícias sem imagem), fotos institucionais oficiais do STF e do STJ, identificadas como imagem ilustrativa e com o crédito do fotógrafo.",
      "Visão geral com destaques em cartões grandes, que passam sozinhos: no STF, as notícias oficiais do Tribunal com as fotos publicadas por ele, as teses fixadas e os temas em pauta, com a foto do relator; no STJ, teses de repetitivos, destaques do mês e temas em pauta.",
    ]],
    ["2026-10-01", [
      "Composição do STF com perfil completo de cada ministro: contato do gabinete (telefone e e-mails para audiência e memoriais), vaga que ocupou, datas de indicação, nomeação e posse, formação, trajetória, currículo oficial e os temas e julgados de sua relatoria no acervo. Nova aba “Contatos”, com todos os gabinetes, a Presidência e as Secretarias das Turmas.",
      "Pauta do STF dentro do site: sessões presenciais do Plenário e das Turmas (processos, relatores, vistas e destaques), calendário das sessões virtuais e, sobretudo, os temas de repercussão geral ainda sem tese que foram pautados. Esses temas também aparecem no Atualize-se, na Visão geral (aba “Em pauta”) e na linha do tempo do tema.",
      "Salvos: julgados do Informativo do STF agora podem ser salvos, organizados em pastas, avaliados e anotados, inclusive pelo Atualize-se.",
      "Informativo do STF: os nomes dos relatores das edições antigas foram uniformizados (por exemplo, “Ministra Ellen Gracie”, antes grafada de várias formas), o que corrige o filtro por relator.",
      "Informativo do STF: o histórico está completo, da edição nº 1 (agosto de 1995) à mais recente, com mais de 16 mil julgamentos de destaque, apresentados em cartões por edição, como no Informativo do STJ.",
      "Atualize-se também no STF: teses fixadas em repercussão geral, temas julgados, repercussões gerais reconhecidas, súmulas novas e destaques do Informativo do STF, no mesmo formato de leitura rápida.",
      "Ajuda (“?”) ampliada: cada tela do STF explica, em poucas linhas, repercussão geral, súmula, súmula vinculante, tese, Plenário e Turmas, entre outros termos. Em “Pauta”, atalho direto para a pauta oficial do STF.",
    ]],
    ["2026-09-30", [
      "Informativo do STF: nova página (modo STF ou STJ + STF) com os julgamentos de destaque das edições do Informativo do Supremo, com resumo, tese fixada, relator e data. Busca por processo, relator, tema ou assunto, filtros por ramo do direito, órgão e data, e atalhos para o processo e a edição oficial.",
      "STF no Radar: o nome do site, no alto do menu, passa a escolher o tribunal exibido: Radar STJ (padrão), Radar STF ou os dois juntos. A escolha fica guardada neste navegador.",
      "Radar STF: temas de repercussão geral (com tese, leading case, relator e linha do tempo), súmulas e súmulas vinculantes, composição do Plenário e das Turmas com fotos, painel próprio e atalho para a pesquisa de acórdãos no site do STF.",
      "Radar STJ · STF: precedentes, súmulas e verificação de petição com os dois tribunais, cada cartão com o selo STJ ou STF; na Composição, abas STJ e STF; no painel, aba Repercussão geral.",
      "Verificar petição: com o STF entre os tribunais exibidos, confere os temas de repercussão geral e as súmulas do STF citados (situação, tese, cancelamento).",
      "Pesquisa: corrigida a busca de siglas terminadas em “s”, como ICMS, que deixavam de encontrar a própria palavra (nos repetitivos, “icms” trazia 1 tema; agora traz 50).",
      "Tema julgado com a tese ainda por publicar deixa de contar como “tese firmada”: no Atualize-se e no Resumo da semana ganha rótulo próprio, “Julgado · tese a publicar”.",
      "Selos dos acórdãos pela lista oficial de processos de cada tema: “Firmou a tese” (o acórdão do julgamento do tema) e “Processo vinculado” (outro acórdão do mesmo processo, como embargos). Quando o julgado só cita um tema, isso aparece na linha “Cita Tema …”. Os selos abrem o precedente.",
      "Resumo da semana: a pauta agrupa os processos que vão juntos a julgamento e separa temas repetitivos de controvérsias; no Atualize-se, processo ligado a tema e controvérsia aparece uma vez só.",
      "Barra lateral e rodapé mostram até quando vai cada fonte principal (acórdãos até o último arquivo mensal do STJ; DJEN até a última publicação lida).",
      "Verificar petição: com texto curto, o site não sugere precedentes por semelhança; nas sugestões, mostra as palavras em comum que as motivaram.",
      "Pesquisa: durante a busca, a lista que você está lendo não muda de lugar; os novos resultados entram pelo botão “Mostrar N novo(s)” ou ao fim da busca.",
      "Repetitivos: corrigidos espaços que faltavam em questões, teses e anotações vindas da base do STJ (por exemplo, “desde que:(a)”).",
    ]],
    ["2026-09-29", [
      "Resumo da semana: controvérsias, IAC e demais precedentes afetados ou em pauta passam a abrir o próprio precedente (antes abriam o tema repetitivo de mesmo número).",
      "Matéria dos repetitivos e controvérsias definida pela questão submetida e pela tese. Os assuntos da tabela processual, que descrevem o caso de origem, só completam a classificação quando a questão nada indica (por exemplo, o Tema 1225 deixa de aparecer em “Dano moral”).",
      "Pesquisa: durante a busca, a lista mostra apenas resultados já confirmados, com a contagem parcial e os arquivos examinados; ao terminar, o site indica “Busca completa” ou, se interrompida, quantos arquivos faltaram.",
      "Atualização automática uma vez por dia, às 7h (horário de Brasília).",
    ]],
    ["2026-09-28", [
      "Sobre e novidades divididos em duas abas.",
      "Assuntos por matéria revistos: 233 assuntos em 69 grupos, na ordem da lei de regência (por exemplo, Planos de saúde com cobertura, reajuste e rescisão; Recurso especial com prequestionamento, Súmula 7, Súmulas 283/284 e dissídio; Prisão com preventiva, excesso de prazo e domiciliar).",
      "No filtro Matéria, o grupo também pode ser marcado: um toque marca (ou deixa de fora) todos os assuntos do grupo.",
      "Pesquisa: os acórdãos do mês ainda sem ementa ficam de fora por padrão; o botão “Incluir sem ementa” os traz de volta.",
      "Filtros com seleção mais leve: o item marcado ganha fundo claro e um sinal de visto, no lugar do bloco escuro.",
      "Pesquisa: os acórdãos do mês corrente, ainda sem o arquivo mensal do STJ, entram na própria lista, com a etiqueta “Publicado em … · ementa em …”. No Período, “Publicados em [mês]” mostra só eles, com os mesmos filtros.",
      "Filtros de várias escolhas: sem filtro, todas as opções aparecem marcadas e tocar numa delas a deixa de fora (por exemplo, todos os órgãos menos um). “Desmarcar todos” limpa para escolher uma a uma.",
      "Cartões mais limpos: fica só o selo “Sinal forte de relevância” e, das marcas, “Afetação ao rito repetitivo” e “Recurso repetitivo”. Na página do julgado, o quadro “A ementa menciona” explica distinção, divergência, mudança de entendimento, questão nova e modulação.",
      "Novo guia “Como pesquisar”, passo a passo e com exemplos. Para todas as formas de uma palavra, use o asterisco (prescri*); “tema 1365” e “súmula 7” passam a funcionar como escritos.",
      "Busca pelo número do processo: no alto do resultado, botão “Decisões do processo”, que abre a consulta processual do STJ com todas as decisões, inclusive as monocráticas anteriores a 2021; na página do julgado, o botão passou a se chamar “Processo e decisões no STJ”.",
      "Dossiê em PDF nos Salvos: reúne os itens da pasta (ou do filtro) com índice, ementa completa, tese, citação, avaliação e anotação, separados por avaliação.",
      "Seta “Voltar” na janela lateral: ao abrir “Pasta e avaliação”, um tema ou um ministro a partir de um julgado, dá para voltar ao julgado sem fechá-lo.",
      "“Pasta e avaliação” não salva mais o julgado automaticamente: ele só entra nos salvos se você escolher pasta, avaliação, anotação ou clicar em Salvar.",
      "Decisões monocráticas desde 2021 (sem o texto): aparecem na busca pelo número do processo, no Verificar petição, na página do acórdão e no Meu radar; o número abre a decisão oficial no STJ.",
    ]],
    ["2026-09-27", [
      "Composição passou para o grupo Informações.",
      "Os grupos do menu podem ser recolhidos pela seta; a escolha fica guardada e a seção aberta continua sempre visível.",
    ]],
    ["2026-09-26", [
      "Menu agrupado em Acompanhar, Pesquisar, Ferramentas e Informações.",
      "A página inicial abre com um resumo leve; o Meu radar e as leituras pendentes são calculados em seguida.",
      "Pesquisa: a consulta começa com Enter ou o botão “Pesquisar”; se algum arquivo mensal não puder ser consultado, o site avisa que os resultados podem estar incompletos e oferece nova tentativa.",
      "Verificar petição: confere relator, órgão julgador e datas citados na peça; o número do recurso abre o próprio julgado; a classe (REsp, AREsp etc.) é considerada; avisa sobre PDF digitalizado e páginas sem texto; mostra o progresso da leitura e permite cancelar.",
      "Salvos: súmulas podem ser salvas; temas e súmulas salvos avisam quando mudam de situação.",
      "Aviso quando o navegador não permite guardar os dados; a cópia de segurança passou a ser validada antes da importação.",
      "Fontes, leitores de PDF e DOCX e fotos servidos pelo próprio site: nenhum recurso de outros endereços é carregado.",
      "Conferência automática do site a cada atualização, antes da publicação.",
      "Pesquisa leve ao abrir, índice de números de processo fragmentado e linha de cobertura da base junto dos resultados.",
      "Selo “Sinal forte de relevância” (antes “Alta relevância”), com os pontos de cada acórdão.",
      "Cópia de segurança única (salvos, pastas, anotações, Meu radar e preferências).",
    ]],
  ];
  async function vSobre(main) {
    const m = D.man;
    const total = m.meses.reduce((s, x) => s + Object.values(x.orgaos).reduce((a, b) => a + b.n, 0), 0);
    const alvoS = lerHash().p.get("s"), abaS = alvoS === "novidades" ? "novidades" : "sobre";
    main.innerHTML = `<div class="barra-filtros" style="max-width:820px">
        <div class="segmentos" role="tablist">
          <button type="button" role="tab" data-sb-aba="sobre" aria-controls="sb-sobre" aria-selected="${abaS === "sobre"}">Sobre</button>
          <button type="button" role="tab" data-sb-aba="novidades" aria-controls="sb-novidades" aria-selected="${abaS === "novidades"}">Novidades</button>
        </div>
      </div>
      <div class="card card-pad texto-serif" id="sb-sobre" role="tabpanel" style="max-width:820px;margin-top:14px"${abaS === "sobre" ? "" : " hidden"}>
      <p>O Radar STJ organiza a jurisprudência do Superior Tribunal de Justiça a partir do <a href="https://dadosabertos.web.stj.jus.br/" target="_blank" rel="noopener">Portal de Dados Abertos do STJ</a>. Uma rotina automática consulta o portal todos os dias, às 7h (horário de Brasília), e publica o que houver de novo.</p>
      <h3 style="font-family:var(--ui)">Fontes</h3>
      <ul>
        <li><b>Acórdãos (espelhos):</b> ementa, tese, relator, datas e referências legislativas da Corte Especial, das Seções e das Turmas. O STJ divulga um arquivo por mês e órgão, poucos dias após o fim do mês. O acervo reúne ${fmtInt(total)} acórdãos, desde ${m.meses.length ? fmtMesL(m.meses.map((x) => x.m).sort()[0]) : "—"}, e é ampliado aos poucos. Os anos anteriores a maio de 2022 vêm do arquivo histórico que o STJ publica com todos os espelhos até aquela data. Na Pesquisa, o filtro Período permite escolher de um mês a todo o acervo (um ano, desde um ano ou um intervalo de datas); os períodos longos são percorridos em sequência, com o progresso na tela.</li>
        <li><b>Composição do Tribunal:</b> documento oficial de composição do STJ (Plenário, Corte Especial, Seções, Turmas, conselhos e comissões), página de ministros e lista de contatos das unidades. As fotos, quando disponíveis, são do Wikimedia Commons (com o crédito de cada autor) e ficam hospedadas no próprio site.</li>
        <li><b>Precedentes qualificados:</b> temas repetitivos, controvérsias, IAC, SIRDR e PUIL, com os processos vinculados. A atualização é diária.</li>
        <li><b>Pautas futuras:</b> processos incluídos nas próximas sessões. A atualização é diária. Por privacidade, o site não exibe os nomes das partes.</li>
        <li><b>Publicações no DJEN:</b> metadados diários dos acórdãos publicados, com cerca de duas semanas de defasagem.</li>
      </ul>
      <h3 style="font-family:var(--ui)">STF: repercussão geral, súmulas e composição</h3>
      <p>No alto do menu (no celular, acima do título da página), o nome do site abre a escolha do tribunal: <b>Radar STJ</b> (padrão), <b>Radar STF</b> ou <b>Radar STJ · STF</b>. A escolha fica guardada neste navegador e muda o conteúdo das seções; pode ser trocada a qualquer momento. Com os dois tribunais, cada cartão traz o selo STJ ou STF.</p>
      <ul>
        <li><b>Temas de repercussão geral:</b> lista oficial de todos os temas do STF, com título, descrição, leading case, relator, reconhecimento (ou não) da repercussão geral, situação e tese fixada. A atualização é diária; as teses novas são baixadas no mesmo dia.</li>
        <li><b>Informativo do STF:</b> edições do Informativo STF (publicação oficial e aberta do Supremo), com o resumo de cada julgamento de destaque, a tese fixada, o relator e a data, desde a edição nº 1 (agosto de 1995). Nas edições anteriores a 2021, o relator e o processo foram extraídos automaticamente do texto. O resumo não substitui o acórdão; o site leva ao processo e à edição oficial.</li>
        <li><b>Súmulas e súmulas vinculantes:</b> página “Aplicação das Súmulas no STF”, com o enunciado, a situação indicada pelo Tribunal (cancelada, revogada, superada), a data de aprovação ou publicação e as observações.</li>
        <li><b>Composição:</b> páginas “Composição atual” e “Turmas” do STF. Data da posse e de nascimento conforme registros públicos; fotos do Wikimedia Commons, quando disponíveis.</li>
      </ul>
      <p>A pesquisa de acórdãos do STF tem proteção contra acesso automatizado e não é reproduzida aqui: no modo STF, o menu leva à pesquisa no site do próprio Tribunal. As seções que dependem dos dados do STJ (Atualize-se, Resumo da semana, Destaques, Meu radar, Pesquisa de acórdãos e Pautas) aparecem só nos modos com o STJ.</p>
      <h3 style="font-family:var(--ui)">Como a relevância é calculada</h3>
      <p>Cada acórdão recebe uma pontuação automática. Somam pontos o julgamento pela Corte Especial (+5) ou por Seção (+4), a tese jurídica registrada (+6), a afetação ao rito repetitivo (+6), os embargos de divergência (+4), o tema repetitivo (+3) e as menções a superação ou mudança de entendimento e a questão nova (+4), a modulação e a distinção (+3) e a divergência (+2). Perdem pontos os agravos internos e os embargos de declaração (−1) e os fundamentos de rotina, como Súmula 7, Súmulas 283/284 do STF, embargos rejeitados e reexame de provas (até −4).</p>
      <p>No Atualize-se entram apenas julgados com uma tese legível: a tese jurídica ou os itens da tese de julgamento com conteúdo próprio. Ficam de fora os embargos de declaração, os agravos em recurso extraordinário, os recursos não conhecidos ou desprovidos sem tese e os julgados de repetitivo cuja tese já aparece como “tese firmada”. Esses acórdãos continuam nos Destaques e na Pesquisa. A tese de julgamento de cada acórdão é lida item por item. Saem da fila os julgados em que todos os itens apenas aplicam óbices ou entendimentos consolidados (Súmulas 5, 7, 83, 182, 211, 282 e 284, prequestionamento, embargos de declaração, prisão preventiva por fundamentação usual, dosimetria), e perdem posição os que repetem em série a mesma tese. Quando só parte dos itens tem conteúdo próprio, o cartão mostra apenas esses itens; a tese completa continua na ementa.</p>
      <p>Com 10 pontos ou mais, o acórdão recebe o selo <b>sinal forte de relevância</b>, o único exibido nos cartões. As faixas de 6 a 9 pontos (relevante) e de 2 a 5 (acompanhar) não aparecem como selo, mas continuam servindo para ordenar a lista e para o filtro de relevância dos Destaques. A pontuação indica prioridade de leitura, e não a força vinculante do precedente; passe o cursor sobre o selo para ver os pontos de cada acórdão. A área do direito é identificada pelas palavras da verbetação. É uma triagem para orientar a leitura, e não uma avaliação jurídica.</p>
      <h3 style="font-family:var(--ui)">O que significam as marcas dos julgados</h3>
      <p>Nos cartões aparecem só duas marcas objetivas: <b>Afetação ao rito repetitivo</b> (o STJ vai firmar uma tese para todos os casos iguais, e os processos sobre o tema podem ficar suspensos); <b>Firmou a tese</b> (acórdão do próprio julgamento de um tema repetitivo, de observância obrigatória pelo art. 927, III, do CPC); e <b>Processo vinculado</b> (o processo consta da lista oficial do tema, mas o acórdão é outro, como embargos de declaração). As duas últimas vêm da lista oficial de processos de cada tema, não das palavras da ementa; quando o julgado só cita um tema, isso aparece na linha “Cita Tema …”. Na página do julgado, o quadro “A ementa menciona” reúne as indicações tiradas das palavras da ementa, que servem de pista e devem ser conferidas no texto:</p>
      <ul>
        <li><b>Distinção (distinguishing):</b> o julgado explica por que um precedente não se aplica ao caso, por serem os fatos diferentes.</li>
        <li><b>Divergência:</b> a ementa trata de dissídio jurisprudencial ou de embargos de divergência. Com frequência, é apenas para dizer que a divergência não foi demonstrada.</li>
        <li><b>Mudança de entendimento (overruling):</b> a ementa fala em superação ou revisão da jurisprudência anterior.</li>
        <li><b>Questão nova:</b> a ementa diz que o tema ainda não tinha precedentes no STJ.</li>
        <li><b>Modulação de efeitos:</b> o tribunal definiu a partir de quando o entendimento passa a valer.</li>
      </ul>
      <h3 style="font-family:var(--ui)">Como ler as cores</h3>
      <p>As cores têm sempre o mesmo significado em todas as telas.</p>
      <div class="legenda-cores">
        <p><span class="selo ok">Verde</span> tese firmada e tema julgado</p>
        <p><span class="selo rel">Âmbar</span> tema afetado ou em andamento</p>
        <p><span class="selo alta">Vermelho</span> o que pede atenção agora: em pauta, sinal forte de relevância</p>
        <p><span class="selo acomp">Azul-claro</span> acórdão de repetitivo publicado e itens para acompanhar</p>
        <p><span class="selo pri">Azul</span> marcas dos julgados (afetação, recurso repetitivo)</p>
        <p>Cada matéria tem a sua própria cor: ${Object.keys(AREAS).map((k) => seloArea(k)).join(" ")}</p>
      </div>
      <h3 style="font-family:var(--ui)">Matérias, grupos e assuntos</h3>
      <p>Cada julgado, tema, súmula, nota e tese recebe uma ou mais matérias gerais (Civil, Processo Civil, Penal, Tributário etc.) e, quando possível, assuntos específicos. Os assuntos ficam reunidos em grupos, na ordem da lei de regência: no Civil, parte geral, obrigações, contratos, seguros, responsabilidade civil e direito das coisas; no Processo Civil, sujeitos do processo, atos e tutelas, conhecimento, execução, admissibilidade do recurso especial, agravos e recursos; no Penal, aplicação da pena, punibilidade, execução penal e os crimes em espécie. No filtro Matéria há três níveis: a matéria, à esquerda; o grupo, que marca todos os seus assuntos de uma vez; e o assunto. Os assuntos de admissibilidade (Súmula 7, prequestionamento, Súmula 182 etc.) servem de filtro, mas no selo do cartão só aparecem quando o julgado não tem assunto de mérito. A classificação é automática, feita pelas palavras da verbetação da ementa, e pode conter imprecisões.</p>
      <h3 style="font-family:var(--ui)">Busca por número de processo</h3>
      <p>Na Pesquisa, o número pode ser digitado no próprio campo de busca, com ou sem a classe e os pontos (“REsp 2.231.419/SP”, “resp 2231419” ou “2231419”). O site procura em todo o acervo e, se o acórdão ainda não estiver no arquivo mensal do STJ, mostra a publicação no DJEN e a sessão em pauta, quando houver. Também aceita o número de registro (12 dígitos). O número deve estar completo.</p>
      <h3 style="font-family:var(--ui)">Decisões monocráticas</h3>
      <p>As decisões monocráticas terminativas publicadas desde janeiro de 2021 vêm do conjunto “Íntegras de Decisões Terminativas e Acórdãos do Diário da Justiça”, dos Dados Abertos do STJ. O site guarda apenas os dados de identificação: processo, recurso interno (agravo, embargos etc.), ministro, data de publicação e desfecho; o número do processo abre a decisão oficial (PDF) no site do STJ. Elas aparecem na busca pelo número do processo, no Verificar petição, na página do acórdão (“Decisões monocráticas neste processo”) e no Meu radar, para os processos acompanhados. Não entram na pesquisa por palavras, porque o texto não é guardado. Processos em segredo de justiça não constam do conjunto.</p>
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
      <h3 style="font-family:var(--ui)">Privacidade e segurança</h3>
      <p>O seu radar (assuntos, processos e OAB), os itens salvos, as pastas e as anotações ficam apenas no seu navegador e se perdem se os dados do navegador forem apagados; use a cópia de segurança (em Salvos ou no Meu radar) para guardá-los ou levá-los a outro aparelho. O link do Meu radar leva os termos, processos e OABs acompanhados: quem o receber poderá vê-los.</p>
      <p>A verificação de petição roda no seu computador, e o texto não é enviado a nenhum servidor. Os leitores de PDF (PDF.js) e de DOCX (Mammoth) ficam hospedados no próprio site, em versões fixas conferidas pelo hash, e a política de segurança da página impede que ela carregue código, fontes ou imagens de outros endereços ou envie dados para eles.</p>
      <h3 style="font-family:var(--ui)" id="sobre-fontes">Situação da base</h3>
      <p>Última execução da rotina: ${new Date(m.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. A rotina roda todos os dias, às 7h; cada fonte tem o próprio ritmo de publicação no STJ.</p>
      ${tabelaFontes(m)}
      <p> ${fmtInt(total)} acórdãos de ${m.meses.length ? fmtMes(m.meses[m.meses.length - 1].m) : "—"} a ${m.meses.length ? fmtMes(m.meses[0].m) : "—"}; ${fmtInt(m.temas?.n)} precedentes qualificados; ${fmtInt(m.pautas?.n)} processos em pauta; ${fmtInt(m.destaques?.n)} destaques nos últimos 3 meses.</p>
      ${m.erros?.length ? `<p class="aviso">${ico("alerta")}<span>Na última execução, parte das fontes não respondeu (${esc(m.erros.join("; "))}). Os dados anteriores foram mantidos.</span></p>` : ""}
      <h3 style="font-family:var(--ui)">Cautelas</h3>
      <p>O texto das ementas é o oficial; apenas a verbetação, que o STJ publica em caixa alta, é exibida em letras minúsculas para facilitar a leitura, e o botão de copiar traz o texto original. Antes de citar qualquer julgado, confira o inteiro teor no site do STJ. Os processos em segredo de justiça não constam da base aberta. Este é um projeto independente, sem vínculo com o STJ.</p>
    </div>
      <div class="card card-pad texto-serif" id="sb-novidades" role="tabpanel" style="max-width:820px;margin-top:14px"${abaS === "novidades" ? "" : " hidden"}>
      <p class="nota">Versão ${VERSAO}. As alterações mais recentes aparecem primeiro.</p>
      ${NOVIDADES.map(([d, l]) => `<h3 style="font-family:var(--ui)">${fmtData(d)}</h3><ul>${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`).join("")}
    </div>`;
    $$("[data-sb-aba]", main).forEach((bt) => bt.addEventListener("click", () => {
      const k = bt.dataset.sbAba;
      $$("[data-sb-aba]", main).forEach((x) => x.setAttribute("aria-selected", String(x === bt)));
      $("#sb-sobre", main).hidden = k !== "sobre"; $("#sb-novidades", main).hidden = k !== "novidades";
      history.replaceState(null, "", k === "novidades" ? "#sobre?s=novidades" : "#sobre");
      window.scrollTo({ top: 0 });
    }));
    if (alvoS === "fontes") requestAnimationFrame(() => $("#sobre-fontes")?.scrollIntoView({ block: "start" }));
  }

  // Situação de cada fonte: data do dado mais recente e da última verificação bem-sucedida.
  // "Defasada" quando a verificação automática falha há alguns dias ou o dado envelheceu além do normal.
  // Cobertura da base, exibida junto dos resultados da Pesquisa.
  function coberturaHTML() {
    const ms = D.man.meses.map((x) => x.m).sort();
    const esp = situacaoFontes(D.man)[0];
    const verif = esp.verif ? fmtData(esp.verif.slice(0, 10)) : "—";
    return `${ico("sobre")}<span>Acórdãos colegiados publicados nos Dados Abertos do STJ, de ${ms.length ? fmtMesL(ms[0]) : "—"} a ${ms.length ? fmtMesL(ms[ms.length - 1]) : "—"}. Decisões monocráticas (desde 2021, sem o texto) aparecem na busca pelo número do processo. Base verificada em ${verif}.${esp.defasada ? ` <a href="#sobre?s=fontes" class="defas">A fonte está com atraso.</a>` : ""}</span>`;
  }
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
      ...(m.stf ? [
        // Quando o portal do STF recusa a rotina automática, vale o registro coletado à parte (segundas e quintas):
        // mais de 5 dias sem coleta indica que uma rodada falhou.
        { nome: "STF · Repercussão geral", dado: "", extra: m.stf.temas?.temas ? `${fmtInt(m.stf.temas.temas)} temas` : "", verif: m.stf.temas?.em, auto: m.stf.temas?.origem !== "registro", lim: 5 },
        { nome: "STF · Súmulas", dado: "", extra: m.stf.sumulas?.sumulas ? `${fmtInt(m.stf.sumulas.sumulas)} súmulas` : "", verif: m.stf.sumulas?.em, auto: m.stf.sumulas?.origem !== "registro", lim: 5 },
        { nome: "STF · Informativo", dado: "", extra: m.stf.informativos?.julgados ? `${fmtInt(m.stf.informativos.julgados)} julgados · edição ${m.stf.informativos.ultima || ""}` : "", verif: m.stf.informativos?.em, auto: m.stf.informativos?.origem !== "registro", lim: 5 },
        ...(m.stf.pauta ? [{ nome: "STF · Pauta", dado: "", extra: m.stf.pauta.processos != null ? `${fmtInt(m.stf.pauta.processos)} processos em sessões presenciais` : "", verif: m.stf.pauta.em, auto: m.stf.pauta.origem !== "registro", lim: 5 }] : []),
        { nome: "STF · Composição", dado: "", extra: m.stf.composicao?.ministros ? `${fmtInt(m.stf.composicao.ministros)} ministros` : "", verif: m.stf.composicao?.em, auto: m.stf.composicao?.origem !== "registro", lim: 5 },
      ] : []),
    ];
    for (const x of L) {
      // A verificação é diária; três dias sem sucesso indicam que a fonte oficial não está respondendo.
      x.defasada = x.auto ? dias(x.verif) > 3 || (x.lim && x.dado && dias(x.dado) > x.lim) : dias(x.verif) > (x.lim || 60);
    }
    return L;
  }
  // Aviso discreto na Visão geral quando a coleta do STF (feita à parte, às segundas e quintas) está atrasada.
  function avisoColetaSTF() {
    if (!D.man?.stf || !comSTF()) return "";
    const at = situacaoFontes(D.man).filter((x) => x.defasada && /^STF/.test(x.nome) && !x.auto);
    if (!at.length) return "";
    const ult = at.map((x) => x.verif).filter(Boolean).sort()[0];
    return `<div class="aviso aviso-coleta" role="status">${ico("alerta")}<div>A coleta dos dados do STF está atrasada${ult ? ` (última em ${fmtData(ult.slice(0, 10))})` : ""}. Julgamentos e teses recentes do Supremo podem ainda não aparecer aqui; confira no <a href="https://portal.stf.jus.br/" target="_blank" rel="noopener">portal do STF</a>. <a href="#sobre?s=fontes">Situação de cada fonte</a></div></div>`;
  }
  function tabelaFontes(m) {
    const fd = (iso) => (iso ? fmtData(iso.slice(0, 10)) : "—");
    return `<div class="tabela-rolagem"><table class="tab-fontes"><thead><tr><th>Fonte</th><th>Dado mais recente</th><th>Última verificação</th><th></th></tr></thead><tbody>
      ${situacaoFontes(m).map((x) => `<tr${x.defasada ? ' class="defasada"' : ""}><td>${esc(x.nome)}</td><td>${x.dado ? `${esc(x.rot || "")} ${fd(x.dado)}` : esc(x.extra || "—")}</td><td>${x.verif ? fd(x.verif) : "—"}${x.auto ? "" : " <small>(coleta manual)</small>"}</td><td>${x.defasada ? `<span class="selo alta">defasada</span>` : `<span class="selo ok">em dia</span>`}</td></tr>`).join("")}
    </tbody></table></div>`;
  }

  // =================================================================== init
  async function init() {
    aplicarTrib();
    montarNav();
    $("#veu").addEventListener("click", fecharGaveta);
    $("#gaveta-fechar").addEventListener("click", fecharGaveta);
    $("#gaveta-voltar").addEventListener("click", voltarGaveta);
    // Ementa do texto integral (acórdãos do mês): abre e recolhe em qualquer lista.
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-djen-em]"); if (!b) return;
      const x = b.closest("li")?.querySelector(".expansivel"); if (!x) return;
      x.classList.toggle("aberto"); b.textContent = x.classList.contains("aberto") ? "Recolher ementa" : "Ver ementa completa";
    });
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
    if (!stfPronto() && TRIBS[P.trib] && P.trib !== "stj") { aplicarTrib(); montarNav(); }
    const q = new Date(D.man.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const defas = situacaoFontes(D.man).filter((x) => x.defasada);
    // Até quando vai cada fonte principal: "verificado hoje" não quer dizer que tudo seja de hoje.
    const ultMesAcervo = [...(D.man.meses || [])].map((x) => x.m).sort().pop();
    const ultDjen = D.man.radar?.dias?.[D.man.radar.dias.length - 1];
    const cobertura = [ultMesAcervo ? `acórdãos até ${fmtMes(ultMesAcervo)}` : "", ultDjen ? `DJEN até ${ultDjen.slice(8, 10)}/${ultDjen.slice(5, 7)}` : ""].filter(Boolean).join(" · ");
    $("#lat-atualizado").innerHTML = `Verificado em ${esc(q)}${cobertura ? `<span class="lat-cob" title="Acórdãos: último arquivo mensal publicado pelo STJ. DJEN: publicações mais recentes lidas. Os mais recentes aparecem também na Pesquisa, sem a ementa completa.">${esc(cobertura[0].toUpperCase() + cobertura.slice(1))}</span>` : ""}${defas.length ? `<a class="lat-defas" href="#sobre?s=fontes" title="${esc(defas.map((x) => x.nome).join(", "))}">${defas.length} fonte${defas.length > 1 ? "s" : ""} com atraso</a>` : `<a class="lat-fontes" href="#sobre?s=fontes">ver cada fonte</a>`}`;
    // No celular a barra lateral não aparece: a situação da base vai também para o rodapé.
    $("#rod-atualizado").innerHTML = `Versão ${VERSAO} (<a href="#sobre?s=novidades">novidades</a>) · Base verificada em ${esc(q)}${cobertura ? ` (${esc(cobertura)})` : ""} · ${defas.length ? `<a class="defas" href="#sobre?s=fontes">${defas.length} fonte${defas.length > 1 ? "s" : ""} com atraso</a>` : `<a href="#sobre?s=fontes">situação de cada fonte</a>`}.`;
    window.addEventListener("hashchange", rotear);
    // Relação dos acórdãos com os repetitivos (3,5 MB de listas): só é baixada quando o usuário se aproxima
    // das telas que a usam; as próprias telas também a pedem, se ainda não estiver pronta.
    const aquecer = (e) => { if (e.target.closest?.('a[href^="#pesquisa"], a[href^="#destaques"], a[href^="#atualize"], #hero-q')) { prepararRefRep(); document.removeEventListener("pointerover", aquecer); document.removeEventListener("focusin", aquecer); } };
    document.addEventListener("pointerover", aquecer, { passive: true }); document.addEventListener("focusin", aquecer);
    await rotear();
    atualizarContadorSalvos();
    // Contadores do menu (radar e leituras) dependem das bases completas: ficam para depois da tela aberta.
    const depois = window.requestIdleCallback || ((f) => setTimeout(f, 600));
    depois(() => {
      atualizarContadorRadar(); atualizarContadorFeed();
      conferirMudancasSalvos().then(({ novas }) => {
        if (!novas.length) return;
        const x = P.salvos[novas[0]];
        toast(novas.length === 1 ? `${tituloSalvo(x, novas[0])} mudou de situação: agora “${x.mudou.para}”.` : `${novas.length} temas ou súmulas salvos mudaram de situação.`, { rot: "Ver", fn: () => { SV.mud = true; location.hash = "#salvos"; } });
      }).catch(() => {});
    }, { timeout: 2500 });
  }
  function irParaBusca() {
    const campo = $("#view input[type=search]");
    if (campo) { campo.focus(); campo.select?.(); }
    else if (trib() === "stf") { location.hash = "#repetitivos"; setTimeout(() => $("#rp-q")?.focus(), 700); }
    else location.hash = "#pesquisa?foco=1";
  }
  init();
})();
