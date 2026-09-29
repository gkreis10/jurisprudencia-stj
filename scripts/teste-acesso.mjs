import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// O arquivo de Functions usa módulos ES também quando o repositório não tem package.json.
const source = await readFile(new URL("../functions/_middleware.js", import.meta.url));
const { onRequest } = await import("data:text/javascript;base64," + source.toString("base64"));

const senha = "senha-de-teste-com-mais-de-20-caracteres";
const chamada = (authorization, configuredPassword = senha) => {
  let chamadas = 0;
  return {
    context: {
      env: { SITE_ACCESS_PASSWORD: configuredPassword },
      request: new Request("https://exemplo.pages.dev/data/manifest.json", {
        headers: authorization ? { Authorization: authorization } : {},
      }),
      next: () => { chamadas++; return new Response("conteúdo protegido"); },
    },
    chamadas: () => chamadas,
  };
};

for (const [nome, auth, configurada, status, chamadas] of [
  ["sem segredo", null, undefined, 503, 0],
  ["sem senha", null, senha, 401, 0],
  ["senha errada", "Basic " + btoa("escritorio:errada"), senha, 401, 0],
  ["usuário errado", "Basic " + btoa("outro:" + senha), senha, 401, 0],
  ["base64 inválido", "Basic ?", senha, 401, 0],
  ["senha correta", "Basic " + btoa("escritorio:" + senha), senha, 200, 1],
]) {
  const caso = chamada(auth, configurada);
  if (nome === "sem segredo") delete caso.context.env.SITE_ACCESS_PASSWORD;
  const resposta = await onRequest(caso.context);
  assert.equal(resposta.status, status, nome);
  assert.equal(caso.chamadas(), chamadas, nome);
  if (status === 401) assert.ok(resposta.headers.has("WWW-Authenticate"), nome);
}

console.log("Proteção de acesso: testes passaram.");
