// Roda nas páginas do Digitusul Hub. Faz a ponte entre a página e a extensão.
// Só aceita pedidos para conversas que o próprio Hub lista como "aprovadas e a apagar".
document.documentElement.dataset.digitusulExt = "1";

window.addEventListener("message", async (ev) => {
  if (ev.source !== window || ev.data?.source !== "digitusul-hub") return;
  if (ev.data.type === "ping") return window.postMessage({ source: "digitusul-ext", reqId: ev.data.reqId, ok: true, versao: chrome.runtime.getManifest().version }, location.origin);
  if (ev.data.type !== "apagar-chat") return;
  const { reqId, flyerId, chatUrl } = ev.data;
  const reply = (r) => window.postMessage({ source: "digitusul-ext", reqId, ...r }, location.origin);
  try {
    // confere na fila do Hub (mesma origem, com a sessão do usuário) que este flyer foi aprovado
    const fila = (await fetch("/api/flyers/chats").then((r) => r.json())).chats || [];
    if (!fila.some((c) => c.id === flyerId && c.chatUrl === chatUrl)) return reply({ ok: false, error: "Conversa não está na fila de aprovados." });
    const res = await chrome.runtime.sendMessage({ type: "apagar-chat", chatUrl });
    reply(res || { ok: false, error: "Sem resposta da extensão." });
  } catch (e) {
    reply({ ok: false, error: String(e?.message || e) });
  }
});
