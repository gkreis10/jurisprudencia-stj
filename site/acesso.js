// Acesso ao site com usuário individual (Supabase) e sincronização dos dados salvos entre aparelhos.
//
// Como funciona:
//  1. Sem sessão, mostra a tela de entrada (e-mail e senha), com a opção de a própria pessoa criar a conta.
//  2. Com a sessão, grava o passe de acesso num cookie do próprio site; a função da Cloudflare
//     (functions/_middleware.js) confere esse passe antes de entregar o programa e os dados.
//  3. Busca os dados salvos da pessoa (Meu radar, salvos, pastas, anotações e preferências), coloca-os
//     no armazenamento do navegador e só então carrega o site (app.js). A cada alteração, o site avisa
//     este módulo, que envia a nova versão ao Supabase em poucos segundos.
//
// A chave publicável do Supabase é pública por natureza: a proteção dos dados vem das regras da tabela
// (cada pessoa só lê e grava a própria linha). Com o autocadastro ligado, qualquer pessoa com o endereço
// do site pode criar uma conta; para restringir, basta desligar "Allow new users to sign up" no Supabase.
(() => {
  "use strict";
  const CFG = {
    url: "https://zvyiqewdqpnmhueggawl.supabase.co", // Project URL, por exemplo https://abcd1234.supabase.co
    chave: "sb_publishable_xuuzZPNKPS0zv8fualiemA__PeWP-q1", // Publishable key (sb_publishable_...)
  };
  const DADOS = "radar-stj.v1";          // mesma chave usada pelo app.js
  const SESSAO = "radar-stj.sessao";     // sessão do Supabase (tokens)
  const DONO = "radar-stj.dono";         // de quem são os dados guardados neste navegador
  const PEND = "radar-stj.pendente";     // há alteração ainda não enviada (data/hora)
  const SINC = "radar-stj.sincronizado"; // versão (atualizado) da última sincronização
  const COOKIE = "radar_at";

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* sem armazenamento */ } },
    json(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  };
  const agora = () => Math.floor(Date.now() / 1000);

  function carregarApp() {
    if (document.querySelector("script[data-app]")) return;
    const s = document.createElement("script");
    s.src = "app.js"; s.dataset.app = "1";
    s.onerror = () => {
      // O programa só é entregue com o passe válido; se falhar, a sessão expirou no meio do caminho.
      if (CFG.url) { limparSessao(); telaEntrada("Sua sessão expirou. Entre novamente."); }
    };
    document.body.appendChild(s);
  }

  // Ambiente de testes (computador local) ou site ainda sem o projeto configurado: sem tela de entrada.
  // (Nos testes do próprio login, a marca "radar-stj.testar-login" liga a tela também no computador local.)
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !ls.get("radar-stj.testar-login");
  if (!CFG.url || !CFG.chave || local) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", carregarApp); else carregarApp();
    return;
  }

  // ------------------------------------------------------------- Supabase (chamadas diretas)
  const AUTH = `${CFG.url}/auth/v1`;
  const REST = `${CFG.url}/rest/v1`;
  let S = ls.json(SESSAO); // { access_token, refresh_token, expires_at, user: { id, email } }

  async function chamar(url, { metodo = "GET", corpo, token, cab = {} } = {}) {
    const headers = { apikey: CFG.chave, ...cab };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (corpo !== undefined) headers["Content-Type"] = "application/json";
    const r = await fetch(url, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo), cache: "no-store" });
    let j = null;
    try { j = await r.json(); } catch { /* resposta sem corpo */ }
    return { ok: r.ok, status: r.status, j };
  }

  function guardarSessao(j) {
    S = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || agora() + (j.expires_in || 3600),
      user: { id: j.user?.id || S?.user?.id, email: j.user?.email || S?.user?.email },
    };
    ls.set(SESSAO, JSON.stringify(S));
    gravarCookie();
    agendarRenovacao();
  }
  function gravarCookie() {
    if (!S) return;
    const vida = Math.max(0, S.expires_at - agora());
    document.cookie = `${COOKIE}=${S.access_token}; Path=/; Max-Age=${vida}; Secure; SameSite=Strict`;
  }
  function limparSessao() {
    S = null;
    ls.del(SESSAO);
    document.cookie = `${COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Strict`;
    clearTimeout(timerRenov);
  }

  let timerRenov = 0;
  function agendarRenovacao() {
    clearTimeout(timerRenov);
    if (!S) return;
    const em = Math.max(5, S.expires_at - agora() - 120);
    timerRenov = setTimeout(() => renovar(true), em * 1000);
  }

  // Garante um passe válido; renova com o refresh token quando faltam menos de 2 minutos (ou se forçado).
  let renovando = null;
  function renovar(forcar = false) {
    if (!S?.refresh_token) return Promise.resolve(false);
    if (!forcar && S.expires_at - agora() > 120) { gravarCookie(); return Promise.resolve(true); }
    if (!renovando) {
      renovando = (async () => {
        try {
          const r = await chamar(`${AUTH}/token?grant_type=refresh_token`, { metodo: "POST", corpo: { refresh_token: S.refresh_token } });
          if (r.ok && r.j?.access_token) { guardarSessao(r.j); return true; }
          if (r.status >= 400 && r.status < 500) { limparSessao(); telaEntrada("Sua sessão terminou. Entre novamente."); }
          return false;
        } catch {
          return false; // sem conexão: tenta de novo mais tarde
        } finally { renovando = null; }
      })();
    }
    return renovando;
  }

  // -------------------------------------------------------------------- dados salvos
  const vazio = (o) => !o || Object.keys(o).every((k) => k === "vistoEm" || (Array.isArray(o[k]) ? !o[k].length : o[k] && typeof o[k] === "object" ? !Object.keys(o[k]).length : !o[k]));
  // União dos dados deste navegador com os da conta (só na primeira entrada neste navegador):
  // listas somam itens sem repetir; nos demais campos prevalece o que já estava na conta.
  function unir(conta, local) {
    if (Array.isArray(conta) && Array.isArray(local)) {
      const vistos = new Set(conta.map((x) => JSON.stringify(x)));
      return conta.concat(local.filter((x) => !vistos.has(JSON.stringify(x))));
    }
    if (conta && local && typeof conta === "object" && typeof local === "object" && !Array.isArray(conta) && !Array.isArray(local)) {
      const out = { ...local };
      for (const [k, v] of Object.entries(conta)) out[k] = k in local ? unir(v, local[k]) : v;
      return out;
    }
    return conta === undefined || conta === null ? local : conta;
  }

  async function lerConta() {
    const r = await chamar(`${REST}/preferencias?select=dados,atualizado&user_id=eq.${encodeURIComponent(S.user.id)}`, { token: S.access_token });
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    return Array.isArray(r.j) && r.j[0] ? r.j[0] : null;
  }
  async function gravarConta(dados) {
    const atualizado = new Date().toISOString();
    const r = await chamar(`${REST}/preferencias?on_conflict=user_id`, {
      metodo: "POST", token: S.access_token,
      cab: { Prefer: "resolution=merge-duplicates,return=minimal" },
      corpo: { user_id: S.user.id, dados, atualizado },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    ls.set(SINC, atualizado);
    return atualizado;
  }

  // Prepara os dados deste navegador antes de abrir o site.
  async function sincronizarEntrada() {
    const uid = S.user.id;
    const dono = ls.get(DONO);
    const local = ls.json(DADOS);
    const conta = await lerConta();
    let final;
    if (dono === uid && ls.get(PEND)) {
      final = local || {};                         // alteração feita aqui ainda não enviada: vale a daqui
    } else if (!dono && !vazio(local)) {
      final = conta ? unir(conta.dados, local) : local; // primeira entrada neste navegador: leva o que já havia
    } else {
      final = conta ? conta.dados : (dono === uid ? local || {} : {});
    }
    ls.set(DADOS, JSON.stringify(final || {}));
    ls.set(DONO, uid);
    if (!conta || final !== conta.dados) {
      try { await gravarConta(final || {}); ls.del(PEND); } catch { ls.set(PEND, new Date().toISOString()); }
    } else {
      ls.set(SINC, conta.atualizado); ls.del(PEND);
    }
  }

  // Envio das alterações: o app.js chama RadarConta.alterou() a cada gravação; o envio sai após 2 s sem novas alterações.
  let timerEnvio = 0, enviando = null, ultimo = null;
  function alterou(o) {
    ultimo = o;
    ls.set(PEND, new Date().toISOString());
    clearTimeout(timerEnvio);
    timerEnvio = setTimeout(enviar, 2000);
  }
  async function enviar() {
    clearTimeout(timerEnvio);
    if (!S || !ls.get(PEND)) return true;
    if (enviando) return enviando;
    enviando = (async () => {
      try {
        if (!(await renovar())) return false;
        const dados = ultimo || ls.json(DADOS) || {};
        await gravarConta(dados);
        if (dados === ultimo || !ultimo) ls.del(PEND);
        estadoSinc("ok");
        return true;
      } catch {
        estadoSinc("erro");
        clearTimeout(timerEnvio);
        timerEnvio = setTimeout(enviar, 30000); // sem conexão: tenta de novo
        return false;
      } finally { enviando = null; }
    })();
    return enviando;
  }

  // Alterações feitas em outro aparelho enquanto esta aba estava aberta: oferece recarregar.
  let avisouOutro = false;
  async function conferirOutroAparelho() {
    if (!S || ls.get(PEND) || avisouOutro) return;
    try {
      if (!(await renovar())) return;
      const c = await lerConta();
      if (c && ls.get(SINC) && c.atualizado > ls.get(SINC)) {
        avisouOutro = true;
        avisoTopo("Há alterações feitas em outro aparelho.", "Atualizar", () => {
          ls.set(DADOS, JSON.stringify(c.dados)); ls.set(SINC, c.atualizado); location.reload();
        });
      }
    } catch { /* sem conexão */ }
  }

  // --------------------------------------------------------------------------- telas
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M6.5 7h11M6.5 7 3.5 13h6zM17.5 7l-3 6h6z"/></svg>';

  // Tela de entrada com dois modos: "Entrar" (conta existente) e "Criar conta" (autocadastro com e-mail e senha).
  function telaEntrada(msg = "") {
    document.documentElement.classList.add("acesso-bloqueado");
    let el = document.getElementById("acesso");
    if (!el) {
      el = document.createElement("div");
      el.id = "acesso"; el.className = "acesso";
      el.innerHTML = `
        <form class="acesso-caixa" novalidate>
          <div class="acesso-marca"><span class="marca-ico">${ICO}</span><span><b>Radar STJ · STF</b><small>Jurisprudência em movimento</small></span></div>
          <h1 data-modo-tit>Entrar</h1>
          <p class="acesso-sub" data-modo-sub>Use o seu e-mail e a sua senha. Na primeira vez, crie a sua conta.</p>
          <label>E-mail<input type="email" name="email" autocomplete="username" required autofocus></label>
          <label data-senha>Senha<input type="password" name="senha" autocomplete="current-password" required></label>
          <label data-so-criar hidden>Repita a senha<input type="password" name="rep" autocomplete="new-password"></label>
          <p class="acesso-msg" role="alert"></p>
          <button type="submit" class="btn btn-pri" data-modo-bt>Entrar</button>
          <p class="acesso-troca"><span data-modo-per>Ainda não tem conta?</span> <button type="button" class="acesso-link" data-trocar>Criar conta</button></p>
          <p class="acesso-troca" data-so-entrar><button type="button" class="acesso-link" data-esqueci>Esqueci minha senha</button></p>
        </form>`;
      const f = el.querySelector("form");
      f.addEventListener("submit", (ev) => (f.dataset.modo === "criar" ? criarConta(ev) : f.dataset.modo === "recuperar" ? pedirNovaSenha(ev) : entrar(ev)));
      el.querySelector("[data-trocar]").addEventListener("click", () => modoEntrada(f, f.dataset.modo && f.dataset.modo !== "entrar" ? "entrar" : "criar"));
      el.querySelector("[data-esqueci]").addEventListener("click", () => modoEntrada(f, "recuperar"));
      document.body.appendChild(el);
    }
    el.querySelector(".acesso-msg").textContent = msg;
    el.querySelector('input[name="email"]').focus();
  }
  const MODOS = {
    entrar: { tit: "Entrar", sub: "Use o seu e-mail e a sua senha. Na primeira vez, crie a sua conta.", bt: "Entrar", per: "Ainda não tem conta?", troca: "Criar conta" },
    criar: { tit: "Criar conta", sub: "Informe o seu e-mail e escolha uma senha de ao menos 8 caracteres. O Meu radar e os salvos ficarão guardados nesta conta.", bt: "Criar conta", per: "Já tem conta?", troca: "Entrar" },
    recuperar: { tit: "Esqueci minha senha", sub: "Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.", bt: "Enviar link", per: "Lembrou a senha?", troca: "Entrar" },
  };
  function modoEntrada(f, modo) {
    const m = MODOS[modo] || MODOS.entrar;
    f.dataset.modo = modo;
    f.querySelector("[data-modo-tit]").textContent = m.tit;
    f.querySelector("[data-modo-sub]").textContent = m.sub;
    f.querySelector("[data-modo-bt]").textContent = m.bt;
    f.querySelector("[data-modo-per]").textContent = m.per;
    f.querySelector("[data-trocar]").textContent = m.troca;
    f.querySelector("[data-so-criar]").hidden = modo !== "criar";
    f.querySelector("[data-senha]").hidden = modo === "recuperar";
    f.querySelector("[data-so-entrar]").hidden = modo !== "entrar";
    f.senha.autocomplete = modo === "criar" ? "new-password" : "current-password";
    f.querySelector(".acesso-msg").textContent = "";
    f.querySelector(".acesso-msg").classList.remove("ok");
    f.email.focus();
  }
  const rotuloBt = (f) => (MODOS[f.dataset.modo] || MODOS.entrar).bt;

  // "Esqueci minha senha": o Supabase envia um link ao e-mail; ao clicar, a pessoa volta ao site já
  // identificada e define a nova senha (ver lerRetornoDoEmail). A resposta é a mesma exista ou não a conta.
  async function pedirNovaSenha(ev) {
    ev.preventDefault();
    const f = ev.currentTarget, bt = f.querySelector("[data-modo-bt]"), msg = f.querySelector(".acesso-msg");
    const email = f.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Informe um e-mail válido."; return; }
    bt.disabled = true; bt.textContent = "Enviando…"; msg.textContent = ""; msg.classList.remove("ok");
    try {
      const r = await chamar(`${AUTH}/recover?redirect_to=${encodeURIComponent(location.origin + "/")}`, { metodo: "POST", corpo: { email } });
      if (r.ok) { msg.classList.add("ok"); msg.textContent = "Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o spam."; }
      else msg.textContent = r.status === 429 ? "Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente de novo." : "Não foi possível enviar o link agora. Tente de novo em instantes.";
    } catch {
      msg.textContent = "Sem conexão com o servidor de acesso. Confira a internet e tente de novo.";
    } finally { bt.disabled = false; bt.textContent = rotuloBt(f); }
  }

  // Volta do link enviado por e-mail (#access_token=...&type=recovery, ou #error=... se expirou).
  async function lerRetornoDoEmail() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    const limparEndereco = () => history.replaceState(null, "", location.pathname + location.search);
    if (h.get("error") || h.get("error_code")) {
      limparEndereco();
      return { erro: /expired/i.test(h.get("error_code") || h.get("error_description") || "") ? "O link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”." : "Não foi possível usar o link recebido. Peça um novo em “Esqueci minha senha”." };
    }
    if (!h.get("access_token") || !h.get("refresh_token")) return null;
    const tipo = h.get("type") || "";
    limparEndereco();
    const token = h.get("access_token");
    const u = await chamar(`${AUTH}/user`, { token });
    if (!u.ok || !u.j?.id) return { erro: "O link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”." };
    guardarSessao({ access_token: token, refresh_token: h.get("refresh_token"), expires_at: Number(h.get("expires_at")) || undefined, expires_in: Number(h.get("expires_in")) || 3600, user: u.j });
    return { tipo };
  }
  function telaNovaSenha() {
    document.documentElement.classList.add("acesso-bloqueado");
    const el = document.createElement("div");
    el.id = "acesso"; el.className = "acesso";
    el.innerHTML = `
      <form class="acesso-caixa" novalidate>
        <div class="acesso-marca"><span class="marca-ico">${ICO}</span><span><b>Radar STJ · STF</b><small>Jurisprudência em movimento</small></span></div>
        <h1>Nova senha</h1>
        <p class="acesso-sub">Conta: ${esc(S?.user?.email)}. Escolha uma nova senha de ao menos 8 caracteres.</p>
        <label>Nova senha<input type="password" name="nova" autocomplete="new-password" required autofocus></label>
        <label>Repita a nova senha<input type="password" name="rep" autocomplete="new-password" required></label>
        <p class="acesso-msg" role="alert"></p>
        <button type="submit" class="btn btn-pri">Salvar e entrar</button>
      </form>`;
    el.querySelector("form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.currentTarget, msg = f.querySelector(".acesso-msg"), bt = f.querySelector("button");
      if (f.nova.value.length < 8) { msg.textContent = "Use ao menos 8 caracteres."; return; }
      if (f.nova.value !== f.rep.value) { msg.textContent = "As duas senhas não conferem."; return; }
      bt.disabled = true; msg.textContent = "";
      try {
        if (!(await renovar())) { msg.textContent = "O link expirou. Peça um novo em “Esqueci minha senha”."; return; }
        const r = await chamar(`${AUTH}/user`, { metodo: "PUT", token: S.access_token, corpo: { password: f.nova.value } });
        if (!r.ok) { msg.textContent = /same|different/i.test(r.j?.msg || r.j?.message || r.j?.error_code || "") ? "A nova senha deve ser diferente da anterior." : "Não foi possível salvar a nova senha. Tente de novo."; return; }
        el.remove();
        await abrir();
        avisoTopo("Senha alterada.");
      } catch { msg.textContent = "Sem conexão. Tente de novo."; } finally { bt.disabled = false; }
    });
    document.body.appendChild(el);
    el.querySelector('input[name="nova"]').focus();
  }

  async function entrar(ev) {
    ev.preventDefault();
    const f = ev.currentTarget, bt = f.querySelector("[data-modo-bt]"), msg = f.querySelector(".acesso-msg");
    const email = f.email.value.trim(), senha = f.senha.value;
    if (!email || !senha) { msg.textContent = "Informe o e-mail e a senha."; return; }
    bt.disabled = true; bt.textContent = "Entrando…"; msg.textContent = "";
    try {
      const r = await chamar(`${AUTH}/token?grant_type=password`, { metodo: "POST", corpo: { email, password: senha } });
      if (!r.ok || !r.j?.access_token) {
        msg.textContent = r.status === 400 || r.status === 401 ? "E-mail ou senha incorretos. Se ainda não tem conta, clique em “Criar conta”." : r.status === 429 ? "Muitas tentativas. Aguarde alguns minutos e tente de novo." : "Não foi possível entrar agora. Tente de novo em instantes.";
        return;
      }
      guardarSessao(r.j);
      f.senha.value = "";
      await abrir();
    } catch {
      msg.textContent = "Sem conexão com o servidor de acesso. Confira a internet e tente de novo.";
    } finally { bt.disabled = false; bt.textContent = rotuloBt(f); }
  }

  async function criarConta(ev) {
    ev.preventDefault();
    const f = ev.currentTarget, bt = f.querySelector("[data-modo-bt]"), msg = f.querySelector(".acesso-msg");
    const email = f.email.value.trim(), senha = f.senha.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Informe um e-mail válido."; return; }
    if (senha.length < 8) { msg.textContent = "A senha deve ter ao menos 8 caracteres."; return; }
    if (senha !== f.rep.value) { msg.textContent = "As duas senhas não conferem."; return; }
    bt.disabled = true; bt.textContent = "Criando…"; msg.textContent = "";
    try {
      const r = await chamar(`${AUTH}/signup`, { metodo: "POST", corpo: { email, password: senha } });
      const erro = `${r.j?.code || ""} ${r.j?.error_code || ""} ${r.j?.msg || r.j?.message || ""}`;
      if (r.ok && r.j?.access_token) {
        guardarSessao(r.j);
        f.senha.value = ""; f.rep.value = "";
        await abrir();
        return;
      }
      if (r.ok) { msg.textContent = "Conta criada, mas o acesso ainda depende de confirmação. Fale com o administrador do site."; return; }
      msg.textContent = /already|exists|registered/i.test(erro) ? "Já existe uma conta com este e-mail. Clique em “Entrar”."
        : /weak|password/i.test(erro) ? "Senha fraca. Use ao menos 8 caracteres, misturando letras e números."
        : /signup.*disabled|not allowed/i.test(erro) ? "A criação de contas está desativada. Fale com o administrador do site."
        : r.status === 429 ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
        : "Não foi possível criar a conta agora. Tente de novo em instantes.";
    } catch {
      msg.textContent = "Sem conexão com o servidor de acesso. Confira a internet e tente de novo.";
    } finally { bt.disabled = false; bt.textContent = rotuloBt(f); }
  }

  async function abrir() {
    try {
      await sincronizarEntrada();
    } catch {
      // Sem acesso aos dados da conta: abre com o que houver neste navegador, se for desta pessoa.
      if (ls.get(DONO) !== S.user.id) { ls.set(DADOS, "{}"); ls.set(DONO, S.user.id); }
    }
    document.getElementById("acesso")?.remove();
    document.documentElement.classList.remove("acesso-bloqueado");
    carregarApp();
    montarConta();
  }

  async function sair() {
    await enviar();
    try { await chamar(`${AUTH}/logout?scope=local`, { metodo: "POST", token: S?.access_token }); } catch { /* sai mesmo assim */ }
    limparSessao();
    // Os dados salvos ficam na conta; neste navegador são apagados, para a próxima pessoa não os ver.
    for (const k of [DADOS, DONO, PEND, SINC]) ls.del(k);
    location.reload();
  }

  async function trocarSenha() {
    const fundo = document.createElement("div");
    fundo.className = "acesso acesso-modal";
    fundo.innerHTML = `
      <form class="acesso-caixa" novalidate>
        <h1>Trocar senha</h1>
        <p class="acesso-sub">Conta: ${esc(S?.user?.email)}</p>
        <label>Nova senha<input type="password" name="nova" autocomplete="new-password" minlength="8" required></label>
        <label>Repita a nova senha<input type="password" name="rep" autocomplete="new-password" minlength="8" required></label>
        <p class="acesso-msg" role="alert"></p>
        <div class="acesso-acoes"><button type="button" class="btn btn-claro" data-cancelar>Cancelar</button><button type="submit" class="btn btn-pri">Salvar</button></div>
      </form>`;
    const fechar = () => fundo.remove();
    fundo.addEventListener("click", (e) => { if (e.target === fundo || e.target.closest("[data-cancelar]")) fechar(); });
    fundo.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
    fundo.querySelector("form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.currentTarget, msg = f.querySelector(".acesso-msg"), bt = f.querySelector('button[type="submit"]');
      if (f.nova.value.length < 8) { msg.textContent = "Use ao menos 8 caracteres."; return; }
      if (f.nova.value !== f.rep.value) { msg.textContent = "As duas senhas não conferem."; return; }
      bt.disabled = true; msg.textContent = "";
      try {
        if (!(await renovar())) { msg.textContent = "Sessão expirada. Entre novamente."; return; }
        const r = await chamar(`${AUTH}/user`, { metodo: "PUT", token: S.access_token, corpo: { password: f.nova.value } });
        if (r.ok) { fechar(); avisoTopo("Senha alterada."); }
        else msg.textContent = r.j?.msg || r.j?.message || "Não foi possível trocar a senha.";
      } catch { msg.textContent = "Sem conexão. Tente de novo."; } finally { bt.disabled = false; }
    });
    document.body.appendChild(fundo);
    fundo.querySelector('input[name="nova"]').focus();
  }

  // Botão da conta no alto da página (computador e celular): e-mail, situação da sincronização, trocar senha e sair.
  function montarConta() {
    const alvo = () => document.querySelector("#topo .topo-in");
    const pronto = () => {
      const topo = alvo();
      if (!topo || document.getElementById("conta-bt")) return;
      const email = S?.user?.email || "";
      const wrap = document.createElement("div");
      wrap.className = "conta";
      wrap.innerHTML = `
        <button type="button" class="conta-bt" id="conta-bt" aria-haspopup="menu" aria-expanded="false" title="${esc(email)}">${esc((email[0] || "?").toUpperCase())}</button>
        <div class="conta-menu" role="menu" hidden>
          <p class="conta-email">${esc(email)}</p>
          <p class="conta-sinc" id="conta-sinc">Dados salvos na sua conta</p>
          <button type="button" role="menuitem" data-conta="senha">Trocar senha</button>
          <button type="button" role="menuitem" data-conta="sair">Sair</button>
        </div>`;
      const bt = wrap.querySelector(".conta-bt"), menu = wrap.querySelector(".conta-menu");
      const abrirMenu = (sim) => { menu.hidden = !sim; bt.setAttribute("aria-expanded", String(sim)); };
      bt.addEventListener("click", (e) => { e.stopPropagation(); abrirMenu(menu.hidden); });
      document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) abrirMenu(false); });
      wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") { abrirMenu(false); bt.focus(); } });
      menu.addEventListener("click", (e) => {
        const a = e.target.closest("[data-conta]")?.dataset.conta;
        if (!a) return;
        abrirMenu(false);
        if (a === "sair") sair(); else trocarSenha();
      });
      topo.appendChild(wrap);
      estadoSinc(ls.get(PEND) ? "pend" : "ok");
    };
    if (alvo()) pronto(); else document.addEventListener("DOMContentLoaded", pronto);
  }
  function estadoSinc(e) {
    const el = document.getElementById("conta-sinc");
    if (!el) return;
    el.textContent = e === "erro" ? "Sem conexão: as alterações serão enviadas assim que possível" : e === "pend" ? "Enviando alterações…" : "Dados salvos na sua conta";
    el.dataset.estado = e;
  }
  function avisoTopo(texto, rot, fn) {
    const box = document.getElementById("toasts");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = texto;
    if (rot) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "toast-acao"; b.textContent = rot;
      b.addEventListener("click", () => { el.remove(); fn(); });
      el.appendChild(b);
    } else setTimeout(() => el.remove(), 4000);
    box.appendChild(el);
  }

  // ------------------------------------------------------------------------ interface
  window.RadarConta = {
    alterou,
    renovar: () => renovar(true),
    get email() { return S?.user?.email || ""; },
    sair,
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { renovar().then((ok) => ok && conferirOutroAparelho()); }
    else enviar();
  });
  window.addEventListener("pagehide", () => { enviar(); });

  // -------------------------------------------------------------------------- início
  async function iniciar() {
    let volta = null;
    try { volta = await lerRetornoDoEmail(); } catch { volta = { erro: "Sem conexão com o servidor de acesso. Confira a internet e tente de novo." }; }
    if (volta?.erro) { limparSessao(); telaEntrada(volta.erro); return; }
    if (volta?.tipo === "recovery") { telaNovaSenha(); return; }
    if (!S?.refresh_token || !S?.user?.id) { limparSessao(); telaEntrada(); return; }
    document.documentElement.classList.add("acesso-bloqueado");
    if (await renovar()) { await abrir(); return; }
    if (S) {
      // Sem conexão com o Supabase, mas a sessão ainda é válida: abre normalmente.
      if (S.expires_at - agora() > 0) { gravarCookie(); agendarRenovacao(); document.documentElement.classList.remove("acesso-bloqueado"); carregarApp(); montarConta(); }
      else telaEntrada("Não foi possível confirmar o acesso. Confira a internet e entre novamente.");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
