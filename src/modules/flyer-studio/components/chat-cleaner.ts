"use client";
/**
 * Ponte com a extensão "Digitusul Hub · limpeza do ChatGPT".
 * O Hub (servidor) não tem acesso à conta do ChatGPT; a extensão, instalada no Chrome do usuário, tem.
 * Fluxo: página → window.postMessage → extensão apaga a conversa → responde → Hub tira da fila.
 */
import { api } from "@/components/ui/primitives";

export const EXTENSION_ZIP = "/extensao/digitusul-hub-limpeza.zip";

type Reply = { ok: boolean; error?: string; jaApagada?: boolean };

let detected: Promise<boolean> | null = null;
/** A extensão está instalada neste Chrome? (responde a um "ping"; resultado guardado). */
export function detectChatCleaner(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  detected ??= send({ type: "ping" }, 1200).then((r) => r.ok);
  return detected;
}

function send(payload: Record<string, unknown>, timeoutMs: number): Promise<Reply> {
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    const done = (r: Reply) => { window.removeEventListener("message", onMsg); clearTimeout(t); resolve(r); };
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== window || ev.data?.source !== "digitusul-ext" || ev.data?.reqId !== reqId) return;
      done({ ok: !!ev.data.ok, error: ev.data.error, jaApagada: ev.data.jaApagada });
    };
    const t = setTimeout(() => done({ ok: false, error: "A extensão não respondeu a tempo." }), timeoutMs);
    window.addEventListener("message", onMsg);
    window.postMessage({ source: "digitusul-hub", reqId, ...payload }, window.location.origin);
  });
}

/** Apaga a conversa de um flyer aprovado e, se der certo, tira da fila do Hub. */
export async function deleteApprovedChat(flyerId: string, chatUrl: string): Promise<Reply> {
  if (!(await detectChatCleaner())) return { ok: false, error: "Extensão não instalada." };
  const r = await send({ type: "apagar-chat", flyerId, chatUrl }, 45000);
  if (r.ok) await api(`/api/flyers/${flyerId}/chat`, { method: "DELETE" }).catch(() => {});
  return r;
}

/** Processa toda a fila de conversas de flyers aprovados (inclusive de aprovações antigas). */
export async function cleanPendingChats(): Promise<{ apagadas: number; falhas: string[] }> {
  if (!(await detectChatCleaner())) return { apagadas: 0, falhas: [] };
  const { chats } = await api<{ chats: { id: string; name: string; chatUrl: string }[] }>("/api/flyers/chats");
  let apagadas = 0; const falhas: string[] = [];
  for (const c of chats) {
    const r = await deleteApprovedChat(c.id, c.chatUrl);
    if (r.ok) apagadas++; else falhas.push(`${c.name}: ${r.error}`);
  }
  return { apagadas, falhas };
}
