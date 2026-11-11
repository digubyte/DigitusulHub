import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/core/db";
import { HttpError } from "@/core/http";
import type { CurrentUser } from "@/core/auth/session";
import { canEditFlyer, canViewFlyer } from "@/core/permissions";
import { toJson } from "@/core/util";
import { logActivity } from "@/core/audit";
import { formatPrice } from "../domain/product-format";
import { promptBlockers } from "../domain/chatgpt-prompt";
import type { ChatGptBatch, ReviewStatus } from "../domain/schemas";
import type { FlyerDocument, Product } from "../domain/types";

/**
 * Flyers cuja arte é gerada no ChatGPT. O servidor garante que o prompt
 * aprovado contém o nome, o código e o preço exatos de cada produto — mesmo
 * que o usuário tenha editado o texto antes de aprovar.
 */
export function assertPromptHasProducts(prompt: string, products: Product[], label: string) {
  const missing: string[] = [];
  for (const p of products) {
    const price = formatPrice(p.priceCents ?? 0);
    if (!prompt.includes(price)) missing.push(`preço ${price} (${p.name})`);
    if (!prompt.includes(p.code.trim())) missing.push(`código ${p.code}`);
    if (!prompt.includes(p.name.trim())) missing.push(`nome "${p.name}"`);
  }
  if (missing.length) throw new HttpError(422, `O prompt de "${label}" não contém: ${missing.slice(0, 4).join("; ")}. Não remova os dados dos produtos do prompt.`);
}

const emptyDoc = (width: number, height: number): FlyerDocument => ({ version: 1, width, height, background: { color: "#FFFFFF" }, elements: [] });

export async function createChatGptBatch(user: CurrentUser, d: ChatGptBatch) {
  if (!user.permissions.has("flyers.create")) throw new HttpError(403, "Você não tem permissão para criar flyers.");
  d.flyers.forEach((f) => {
    const blockers = promptBlockers(f.products, d.layoutConfig.category as never);
    if (blockers.length) throw new HttpError(422, `${f.name}: ${blockers[0]}`);
    assertPromptHasProducts(f.prompt, f.products, f.name);
  });
  const imageIds = [...new Set(d.flyers.flatMap((f) => f.products.map((p) => p.imageFileId).filter(Boolean) as string[]))];
  if (imageIds.length && (await db.storedFile.count({ where: { id: { in: imageIds } } })) !== imageIds.length) {
    throw new HttpError(422, "Uma ou mais imagens de produto não existem mais. Envie-as novamente.");
  }
  const batchId = d.flyers.length > 1 ? randomUUID() : null;
  const doc = toJson(emptyDoc(d.width, d.height));
  const rows = await db.$transaction(d.flyers.map((f) => db.flyerProject.create({
    data: {
      name: f.name, campaign: d.campaign || null, ownerId: user.id, category: d.layoutConfig.category, formatKey: d.formatKey, width: d.width, height: d.height,
      products: toJson(f.products), layoutConfig: toJson(d.layoutConfig), canvasState: doc, mode: "chatgpt", prompt: f.prompt, batchId,
      versions: { create: { version: 1, products: toJson(f.products), canvasState: doc, createdById: user.id, note: "Prompt aprovado (ChatGPT)" } },
    },
    select: { id: true },
  })));
  await logActivity(user.id, "flyer.create", { type: "flyer", id: rows[0].id }, { mode: "chatgpt", flyers: rows.length, batchId });
  return { ids: rows.map((r) => r.id), batchId };
}

async function editable(user: CurrentUser, id: string) {
  const row = await db.flyerProject.findFirst({ where: { id, deletedAt: null } });
  if (!row || !canViewFlyer(user.permissions, user.id, row.ownerId, row.isTemplate)) throw new HttpError(404, "Projeto não encontrado.");
  if (!canEditFlyer(user.permissions, user.id, row.ownerId)) throw new HttpError(403, "Você não tem permissão para editar este projeto.");
  if (row.mode !== "chatgpt") throw new HttpError(400, "Este projeto é montado no editor.");
  return row;
}

/** Salva (ou remove) a arte gerada no ChatGPT, depois da conferência dos dados. */
export async function setChatGptResult(user: CurrentUser, id: string, fileId: string | null, checked: boolean, chatUrl?: string | null) {
  const row = await editable(user, id);
  if (fileId) {
    if (!checked) throw new HttpError(422, "Confira nome, código e preço de cada produto na arte antes de salvar.");
    const f = await db.storedFile.findUnique({ where: { id: fileId } });
    if (!f || f.ownerId !== user.id) throw new HttpError(422, "Arquivo da arte não encontrado. Envie novamente.");
  }
  // arte nova volta para a fila de aprovação; ao remover a arte, o pedido (refazer/alterações) é mantido
  const review = fileId ? { reviewStatus: "pending", reviewNote: null, reviewedAt: null } : {};
  await db.flyerProject.update({
    where: { id },
    data: { resultFileId: fileId, thumbnailId: fileId, version: row.version + 1, ...review, ...(chatUrl !== undefined ? { chatUrl } : {}) },
  });
  await logActivity(user.id, "flyer.result", { type: "flyer", id }, { fileId, checked });
}

/** Atualiza o prompt antes de gerar novamente. */
export async function updateChatGptPrompt(user: CurrentUser, id: string, prompt: string) {
  const row = await editable(user, id);
  const products = JSON.parse(row.products) as Product[];
  assertPromptHasProducts(prompt, products, row.name);
  await db.flyerProject.update({ where: { id }, data: { prompt } });
  await logActivity(user.id, "flyer.update", { type: "flyer", id }, { prompt: true });
}

/** Aprovação do flyer: aprovar, pedir para refazer ou pedir alterações (com texto). */
export async function setReview(user: CurrentUser, id: string, status: ReviewStatus, note?: string | null) {
  const row = await editable(user, id);
  if (status !== "pending" && !row.resultFileId) throw new HttpError(422, "Este flyer ainda não tem arte para aprovar.");
  const reviewNote = status === "changes" || status === "redo" ? (note?.trim() || null) : null;
  await db.flyerProject.update({ where: { id }, data: { reviewStatus: status, reviewNote, reviewedAt: status === "pending" ? null : new Date() } });
  await logActivity(user.id, "flyer.review", { type: "flyer", id }, { status, note: reviewNote });
}
