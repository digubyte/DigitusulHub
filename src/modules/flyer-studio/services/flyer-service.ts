import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/core/db";
import { HttpError } from "@/core/http";
import type { CurrentUser } from "@/core/auth/session";
import { canDeleteFlyer, canEditFlyer, canViewFlyer } from "@/core/permissions";
import { parseJson, toJson } from "@/core/util";
import { logActivity } from "@/core/audit";
import { storeImage } from "@/core/storage/storage";
import type { ProjectWrite } from "../domain/schemas";
import type { FlyerDocument, LayoutOptions, Product } from "../domain/types";

/**
 * Acesso a dados de flyers. TODA consulta passa por aqui e aplica escopo de
 * permissão no servidor (dono, view.all, edit.any) — a interface apenas reflete.
 */

export function visibilityWhere(user: CurrentUser): Prisma.FlyerProjectWhereInput {
  if (user.permissions.has("flyers.view.all") || user.permissions.has("flyers.edit.any")) return { deletedAt: null };
  return { deletedAt: null, OR: [{ ownerId: user.id }, { isTemplate: true }] };
}

export interface ListFilters { q?: string; category?: string; campaign?: string; scope?: "mine" | "all" | "templates"; batchId?: string }

export async function listFlyers(user: CurrentUser, f: ListFilters = {}) {
  const and: Prisma.FlyerProjectWhereInput[] = [visibilityWhere(user)];
  if (f.scope === "mine") and.push({ ownerId: user.id, isTemplate: false });
  if (f.scope === "templates") and.push({ isTemplate: true });
  if (f.scope === "all" || !f.scope) and.push({ isTemplate: false });
  if (f.category) and.push({ category: f.category });
  if (f.campaign) and.push({ campaign: f.campaign });
  if (f.batchId) and.push({ batchId: f.batchId });
  if (f.q?.trim()) { const q = f.q.trim(); and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { campaign: { contains: q, mode: "insensitive" } }, { products: { contains: q, mode: "insensitive" } }] }); }
  const rows = await db.flyerProject.findMany({
    where: { AND: and },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, name: true, category: true, campaign: true, formatKey: true, width: true, height: true, thumbnailId: true, isTemplate: true, updatedAt: true, createdAt: true, ownerId: true, version: true, mode: true, batchId: true, resultFileId: true, owner: { select: { name: true } }, products: true },
  });
  return rows.map(({ products, ...r }) => ({
    ...r,
    productCount: parseJson<Product[]>(products, []).length,
    ownerName: r.owner.name,
    canEdit: canEditFlyer(user.permissions, user.id, r.ownerId),
    canDelete: canDeleteFlyer(user.permissions, user.id, r.ownerId) && (!r.isTemplate || user.permissions.has("flyers.templates.manage")),
  }));
}

export async function campaigns(user: CurrentUser) {
  const rows = await db.flyerProject.findMany({ where: { AND: [visibilityWhere(user), { campaign: { not: null } }] }, select: { campaign: true }, distinct: ["campaign"] });
  return rows.map((r) => r.campaign!).filter(Boolean).sort();
}

export async function getFlyer(user: CurrentUser, id: string) {
  const row = await db.flyerProject.findFirst({ where: { id, deletedAt: null }, include: { owner: { select: { name: true } } } });
  if (!row || !canViewFlyer(user.permissions, user.id, row.ownerId, row.isTemplate)) throw new HttpError(404, "Projeto não encontrado.");
  return {
    id: row.id, name: row.name, campaign: row.campaign, category: row.category, formatKey: row.formatKey, width: row.width, height: row.height,
    products: parseJson<Product[]>(row.products, []),
    layoutConfig: parseJson<LayoutOptions>(row.layoutConfig, {} as LayoutOptions),
    canvasState: parseJson<FlyerDocument>(row.canvasState, {} as FlyerDocument),
    isTemplate: row.isTemplate, version: row.version, ownerId: row.ownerId, ownerName: row.owner.name,
    mode: row.mode as "editor" | "chatgpt", prompt: row.prompt, resultFileId: row.resultFileId, batchId: row.batchId,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), thumbnailId: row.thumbnailId,
    canEdit: canEditFlyer(user.permissions, user.id, row.ownerId) && (!row.isTemplate || user.permissions.has("flyers.templates.manage")),
  };
}
export type FlyerDetail = Awaited<ReturnType<typeof getFlyer>>;

/** Garante que todos os arquivos referenciados existem (e não são de outra origem). */
async function assertFilesExist(data: ProjectWrite) {
  const ids = new Set<string>();
  data.products.forEach((p) => p.imageFileId && ids.add(p.imageFileId));
  data.canvasState.elements.forEach((e) => e.type === "image" && ids.add(e.fileId));
  if (data.canvasState.background.imageFileId) ids.add(data.canvasState.background.imageFileId);
  if (ids.size === 0) return;
  const found = await db.storedFile.count({ where: { id: { in: [...ids] } } });
  if (found !== ids.size) throw new HttpError(422, "Uma ou mais imagens referenciadas não existem mais. Envie-as novamente.");
}

async function saveThumbnail(user: CurrentUser, dataUrl?: string) {
  if (!dataUrl) return undefined;
  const b64 = dataUrl.split(",")[1] ?? "";
  const f = await storeImage({ ownerId: user.id, data: new Uint8Array(Buffer.from(b64, "base64")), originalName: "miniatura.jpg", purpose: "thumbnail" });
  return f.id;
}

function validateDims(d: ProjectWrite) {
  if (d.canvasState.width !== d.width || d.canvasState.height !== d.height) throw new HttpError(422, "As dimensões do canvas não correspondem ao formato do projeto.");
}

export async function createFlyer(user: CurrentUser, d: ProjectWrite) {
  if (!user.permissions.has("flyers.create")) throw new HttpError(403, "Você não tem permissão para criar flyers.");
  validateDims(d);
  await assertFilesExist(d);
  const thumbnailId = await saveThumbnail(user, d.thumbnailDataUrl);
  const row = await db.flyerProject.create({
    data: {
      name: d.name, campaign: d.campaign || null, ownerId: user.id, category: d.layoutConfig.category, formatKey: d.formatKey, width: d.width, height: d.height,
      products: toJson(d.products), layoutConfig: toJson(d.layoutConfig), canvasState: toJson(d.canvasState), thumbnailId,
      versions: { create: { version: 1, products: toJson(d.products), canvasState: toJson(d.canvasState), createdById: user.id, note: "Criação" } },
    },
  });
  await logActivity(user.id, "flyer.create", { type: "flyer", id: row.id }, { name: d.name, products: d.products.length });
  return row.id;
}

/** Projetos que o usuário não pode ver respondem 404 (não revelam que existem). */
async function findVisible(user: CurrentUser, id: string) {
  const row = await db.flyerProject.findFirst({ where: { id, deletedAt: null } });
  if (!row || !canViewFlyer(user.permissions, user.id, row.ownerId, row.isTemplate)) throw new HttpError(404, "Projeto não encontrado.");
  return row;
}

export async function updateFlyer(user: CurrentUser, id: string, d: ProjectWrite) {
  const row = await findVisible(user, id);
  if (!canEditFlyer(user.permissions, user.id, row.ownerId) || (row.isTemplate && !user.permissions.has("flyers.templates.manage"))) {
    throw new HttpError(403, "Você não tem permissão para editar este projeto.");
  }
  if (d.baseVersion != null && d.baseVersion !== row.version) {
    throw new HttpError(409, "Este projeto foi alterado em outra sessão. Recarregue para ver a versão mais recente.");
  }
  validateDims(d);
  await assertFilesExist(d);
  const thumbnailId = (await saveThumbnail(user, d.thumbnailDataUrl)) ?? row.thumbnailId;
  const version = row.version + 1;
  await db.$transaction([
    db.flyerProject.update({
      where: { id },
      data: {
        name: d.name, campaign: d.campaign || null, category: d.layoutConfig.category, formatKey: d.formatKey, width: d.width, height: d.height,
        products: toJson(d.products), layoutConfig: toJson(d.layoutConfig), canvasState: toJson(d.canvasState), thumbnailId, version,
      },
    }),
    db.flyerVersion.create({ data: { projectId: id, version, products: toJson(d.products), canvasState: toJson(d.canvasState), createdById: user.id, note: d.versionNote ?? null } }),
  ]);
  // Mantém as 30 versões mais recentes
  const old = await db.flyerVersion.findMany({ where: { projectId: id }, orderBy: { version: "desc" }, skip: 30, select: { id: true } });
  if (old.length) await db.flyerVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  await logActivity(user.id, "flyer.update", { type: "flyer", id }, { version });
  return version;
}

export async function duplicateFlyer(user: CurrentUser, id: string, opts: { asTemplate?: boolean } = {}) {
  if (!user.permissions.has("flyers.create")) throw new HttpError(403, "Você não tem permissão para criar flyers.");
  if (opts.asTemplate && !user.permissions.has("flyers.templates.manage")) throw new HttpError(403, "Você não tem permissão para publicar templates.");
  const src = await getFlyer(user, id);
  const row = await db.flyerProject.create({
    data: {
      name: opts.asTemplate ? `${src.name} (template)` : `${src.name} (cópia)`, campaign: src.campaign, ownerId: user.id, category: src.category, formatKey: src.formatKey,
      width: src.width, height: src.height, products: toJson(src.products), layoutConfig: toJson(src.layoutConfig), canvasState: toJson(src.canvasState),
      thumbnailId: src.mode === "chatgpt" ? null : src.thumbnailId, isTemplate: !!opts.asTemplate, mode: src.mode, prompt: src.prompt,
      versions: { create: { version: 1, products: toJson(src.products), canvasState: toJson(src.canvasState), createdById: user.id, note: `Duplicado de ${src.id}` } },
    },
  });
  await logActivity(user.id, opts.asTemplate ? "flyer.template" : "flyer.duplicate", { type: "flyer", id: row.id }, { from: id });
  return row.id;
}

export async function deleteFlyer(user: CurrentUser, id: string) {
  const row = await findVisible(user, id);
  if (!canDeleteFlyer(user.permissions, user.id, row.ownerId) || (row.isTemplate && !user.permissions.has("flyers.templates.manage"))) {
    throw new HttpError(403, "Você não tem permissão para excluir este projeto.");
  }
  // Exclusão lógica: preserva histórico e permite recuperação pelo administrador.
  await db.flyerProject.update({ where: { id }, data: { deletedAt: new Date() } });
  await logActivity(user.id, "flyer.delete", { type: "flyer", id }, { name: row.name });
}

export async function listVersions(user: CurrentUser, id: string) {
  await getFlyer(user, id);
  return db.flyerVersion.findMany({ where: { projectId: id }, orderBy: { version: "desc" }, select: { version: true, note: true, createdAt: true, createdById: true } });
}
