"use client";
/** Utilitários do navegador para o fluxo com o ChatGPT: anexos, cópia do prompt e ajuste de tamanho. */
import { zipSync } from "fflate";
import { logoAttachmentName, mascotAttachmentName, productAttachmentName } from "../domain/chatgpt-prompt";
import type { Product } from "../domain/types";

export const CHATGPT_URL = "https://chatgpt.com/";

async function fetchFile(id: string): Promise<Blob> {
  const res = await fetch(`/api/files/${id}`);
  if (!res.ok) throw new Error("Não foi possível baixar uma das imagens.");
  return res.blob();
}

/** O ChatGPT não aceita SVG como anexo: converte para PNG em alta resolução. */
async function toAttachable(blob: Blob): Promise<Blob> {
  if (blob.type !== "image/svg+xml") return blob;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("SVG inválido")); img.src = url; });
    const w = img.naturalWidth || 1000, h = img.naturalHeight || 1000;
    const s = 1600 / Math.max(w, h);
    const c = document.createElement("canvas");
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("Falha ao converter o logo"))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

export interface AttachmentSet { products: Product[]; logoFileId?: string | null; mascotFileId?: string | null }

/** Monta o ZIP com as fotos (nomes iguais aos citados no prompt), logo e mascote. */
export async function buildAttachmentsZip(sets: { folder?: string; set: AttachmentSet }[]): Promise<Blob | null> {
  const files: Record<string, Uint8Array> = {};
  const shared = new Map<string, Blob>();
  const get = async (id: string) => { if (!shared.has(id)) shared.set(id, await toAttachable(await fetchFile(id))); return shared.get(id)!; };
  for (const { folder, set } of sets) {
    const prefix = folder ? `${folder}/` : "";
    for (const [i, p] of set.products.entries()) {
      if (!p.imageFileId) continue;
      const b = await get(p.imageFileId);
      files[prefix + productAttachmentName(p, i, b.type)] = new Uint8Array(await b.arrayBuffer());
    }
    if (set.logoFileId) { const b = await get(set.logoFileId); files[prefix + logoAttachmentName(b.type)] = new Uint8Array(await b.arrayBuffer()); }
    if (set.mascotFileId) { const b = await get(set.mascotFileId); files[prefix + mascotAttachmentName(b.type)] = new Uint8Array(await b.arrayBuffer()); }
  }
  if (!Object.keys(files).length) return null;
  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}

/** Recorta (centralizado, sem distorcer) a arte para o tamanho exato do formato. */
export async function fitToFormat(fileId: string, width: number, height: number): Promise<Blob> {
  const bmp = await createImageBitmap(await fetchFile(fileId));
  const s = Math.max(width / bmp.width, height / bmp.height);
  const w = bmp.width * s, h = bmp.height * s;
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, (width - w) / 2, (height - h) / 2, w, h);
  return new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("Falha ao gerar o arquivo"))), "image/png"));
}

export async function originalFile(fileId: string) { return fetchFile(fileId); }

export const fileSlug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "flyer";
