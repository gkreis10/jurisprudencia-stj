// Protege todos os arquivos do Pages, inclusive os dados carregados pelo navegador.
// A senha fica em um Secret do Cloudflare Pages, nunca no repositório.
const USER = "escritorio";
const encoder = new TextEncoder();

function resposta(status, mensagem, desafio = false) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
  if (desafio) headers["WWW-Authenticate"] = 'Basic realm="Radar STJ", charset="UTF-8"';
  return new Response(mensagem, { status, headers });
}

async function mesmaSenha(recebida, esperada) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(recebida)),
    crypto.subtle.digest("SHA-256", encoder.encode(esperada)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diferente = 0;
  for (let i = 0; i < x.length; i++) diferente |= x[i] ^ y[i];
  return diferente === 0;
}

export async function onRequest(context) {
  const senha = context.env.SITE_ACCESS_PASSWORD;
  if (typeof senha !== "string" || senha.length < 20) {
    return resposta(503, "Acesso ainda não configurado.");
  }

  const cabecalho = context.request.headers.get("Authorization") || "";
  if (!cabecalho.startsWith("Basic ") || cabecalho.length > 1024) {
    return resposta(401, "Informe o usuário e a senha para entrar.", true);
  }

  try {
    const credenciais = atob(cabecalho.slice(6));
    const separador = credenciais.indexOf(":");
    if (separador > 0 && credenciais.slice(0, separador) === USER &&
        await mesmaSenha(credenciais.slice(separador + 1), senha)) {
      return context.next();
    }
  } catch {
    // Cabeçalho inválido: responde como uma tentativa de acesso sem permissão.
  }
  return resposta(401, "Usuário ou senha incorretos.", true);
}
