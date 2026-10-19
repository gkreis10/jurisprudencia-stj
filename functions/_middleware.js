// Proteção do site: só entrega o programa e os dados a quem entrou com uma conta do Supabase.
//
// A página inicial, o estilo, as fontes e o módulo de entrada (acesso.js) são públicos, para que a tela
// de entrada apareça. Todo o resto (app.js, data/, img/, vendor/ etc.) exige o passe de acesso que o
// acesso.js grava no cookie "radar_at" depois do login. O passe é conferido pela assinatura digital,
// com as chaves públicas do projeto no Supabase; nenhum segredo fica neste arquivo.
//
// Enquanto SUPABASE_URL estiver vazio, o site fica aberto (como antes da criação das contas).
const SUPABASE_URL = "https://zvyiqewdqpnmhueggawl.supabase.co"; // Project URL, por exemplo https://abcd1234.supabase.co
const SUPABASE_CHAVE = "sb_publishable_xuuzZPNKPS0zv8fualiemA__PeWP-q1"; // Publishable key (sb_publishable_...), usada só na conferência alternativa

const PUBLICOS = new Set(["/", "/index.html", "/acesso.js", "/style.css", "/favicon.ico"]);
const ehPublico = (p) => PUBLICOS.has(p) || /^\/vendor\/[\w.-]+\.woff2$/.test(p);

const dec = new TextDecoder();
function b64url(s) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

// Chaves públicas do projeto (JWKS), guardadas por 10 minutos.
let JWKS = null, JWKS_EM = 0;
async function chaves(base, renovar = false) {
  if (!JWKS || renovar || Date.now() - JWKS_EM > 600_000) {
    const r = await fetch(`${base}/auth/v1/.well-known/jwks.json`, { cf: { cacheTtl: 600 } });
    if (r.ok) { JWKS = (await r.json()).keys || []; JWKS_EM = Date.now(); }
  }
  return JWKS || [];
}
const ALG = {
  ES256: { imp: { name: "ECDSA", namedCurve: "P-256" }, ver: { name: "ECDSA", hash: "SHA-256" } },
  RS256: { imp: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, ver: { name: "RSASSA-PKCS1-v1_5" } },
};

// Conferência alternativa (projetos com chave simétrica antiga): pergunta ao próprio Supabase.
const VALIDOS = new Map(); // token -> expiração (ms)
async function perguntarSupabase(base, chave, token, exp) {
  const v = VALIDOS.get(token);
  if (v && v > Date.now()) return true;
  const r = await fetch(`${base}/auth/v1/user`, { headers: { apikey: chave, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  if (VALIDOS.size > 500) VALIDOS.clear();
  VALIDOS.set(token, exp * 1000);
  return true;
}

async function passeValido(token, base, chave) {
  const partes = token.split(".");
  if (partes.length !== 3 || token.length > 4096) return false;
  let cab, dados;
  try { cab = JSON.parse(dec.decode(b64url(partes[0]))); dados = JSON.parse(dec.decode(b64url(partes[1]))); } catch { return false; }
  const agora = Date.now() / 1000;
  const aud = Array.isArray(dados.aud) ? dados.aud : [dados.aud];
  if (!(dados.exp > agora) || dados.role !== "authenticated" || !aud.includes("authenticated") || dados.iss !== `${base}/auth/v1`) return false;
  const alg = ALG[cab.alg];
  if (alg) {
    let k = (await chaves(base)).find((x) => x.kid === cab.kid);
    if (!k) k = (await chaves(base, true)).find((x) => x.kid === cab.kid);
    if (k) {
      const { kid, alg: _a, key_ops: _o, use: _u, ...jwk } = k; // eslint-disable-line no-unused-vars
      const chavePub = await crypto.subtle.importKey("jwk", jwk, alg.imp, false, ["verify"]);
      return crypto.subtle.verify(alg.ver, chavePub, b64url(partes[2]), new TextEncoder().encode(`${partes[0]}.${partes[1]}`));
    }
  }
  return chave ? perguntarSupabase(base, chave, token, dados.exp) : false;
}

function lerCookie(req, nome) {
  for (const parte of (req.headers.get("Cookie") || "").split(/;\s*/)) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i) === nome) return parte.slice(i + 1);
  }
  return "";
}

export async function onRequest(context) {
  const base = (context.env.SUPABASE_URL || SUPABASE_URL).replace(/\/+$/, "");
  const chave = context.env.SUPABASE_CHAVE || SUPABASE_CHAVE;
  if (!base) return context.next();

  const url = new URL(context.request.url);
  if (ehPublico(url.pathname)) {
    const r = await context.next();
    const h = new Headers(r.headers);
    h.set("Cache-Control", "no-cache");
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  }

  const token = lerCookie(context.request, "radar_at");
  let ok = false;
  if (token) { try { ok = await passeValido(token, base, chave); } catch { ok = false; } }
  if (ok) {
    const r = await context.next();
    // Conteúdo restrito: pode ficar no cache do navegador da pessoa, nunca em caches compartilhados.
    const h = new Headers(r.headers);
    h.set("Cache-Control", (h.get("Cache-Control") || "no-cache").replace(/\bpublic\b/, "private"));
    if (!/\bprivate\b/.test(h.get("Cache-Control"))) h.set("Cache-Control", `private, ${h.get("Cache-Control")}`);
    h.set("Vary", "Cookie");
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  }

  // Sem passe válido: páginas voltam à tela de entrada; arquivos respondem 401.
  if ((context.request.headers.get("Accept") || "").includes("text/html")) {
    return Response.redirect(`${url.origin}/`, 302);
  }
  return new Response("Acesso restrito: entre com a sua conta.", {
    status: 401,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}
