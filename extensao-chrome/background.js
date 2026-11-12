// Apaga uma conversa do ChatGPT usando a sessão já logada no Chrome do usuário.
// Usa o mesmo pedido que o botão "Excluir" do próprio ChatGPT (esconde a conversa).

const CHAT_RE = /^https:\/\/chatgpt\.com\/(?:g\/[^/]+\/)?c\/([0-9a-f-]{20,})/i;

function waitLoaded(tabId) {
  return new Promise((ok) => {
    const done = (id, info) => { if (id === tabId && info.status === "complete") { chrome.tabs.onUpdated.removeListener(done); ok(); } };
    chrome.tabs.onUpdated.addListener(done);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(done); ok(); }, 20000);
  });
}

// Executada dentro de uma aba do chatgpt.com (mesma origem → usa os cookies da conta).
async function apagarNaPagina(convId) {
  const sess = await fetch("/api/auth/session").then((r) => r.json()).catch(() => null);
  const token = sess?.accessToken;
  if (!token) return { ok: false, error: "Não está logado no ChatGPT neste Chrome." };
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const conv = await fetch(`/backend-api/conversation/${convId}`, { headers: h });
  if (conv.status === 404) return { ok: true, jaApagada: true };
  if (!conv.ok) return { ok: false, error: `ChatGPT respondeu ${conv.status} ao abrir a conversa.` };
  const texto = JSON.stringify(await conv.json());
  // segurança: só apaga conversas de flyer da Digitusul
  if (!/loja Digitusul/.test(texto)) return { ok: false, error: "A conversa não parece ser de um flyer da Digitusul; não apaguei." };
  const del = await fetch(`/backend-api/conversation/${convId}`, { method: "PATCH", headers: h, body: JSON.stringify({ is_visible: false }) });
  return del.ok ? { ok: true } : { ok: false, error: `ChatGPT respondeu ${del.status} ao apagar.` };
}

async function apagar(chatUrl) {
  const m = CHAT_RE.exec(chatUrl || "");
  if (!m) return { ok: false, error: "Link de conversa inválido." };
  let [tab] = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
  let criada = false;
  if (!tab) {
    tab = await chrome.tabs.create({ url: "https://chatgpt.com/", active: false });
    criada = true;
    await waitLoaded(tab.id);
  }
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", func: apagarNaPagina, args: [m[1]] });
    return r?.result || { ok: false, error: "Falha ao executar no ChatGPT." };
  } finally {
    if (criada) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg?.type !== "apagar-chat") return;
  // só aceita pedidos vindos das páginas do Hub
  if (!sender.url?.startsWith("https://digitusul-hub.vercel.app/")) { send({ ok: false, error: "Origem não permitida." }); return; }
  apagar(msg.chatUrl).then(send, (e) => send({ ok: false, error: String(e?.message || e) }));
  return true; // resposta assíncrona
});
