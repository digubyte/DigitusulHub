import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk } from "@/core/http";
import { driver, publicFileInfo, storeImage } from "@/core/storage/storage";
import { logActivity } from "@/core/audit";

/**
 * Remoção de fundo via remove.bg (somente se REMOVE_BG_API_KEY estiver configurada).
 * A imagem original é preservada; o resultado é salvo como um novo arquivo derivado.
 */
export const POST = apiRoute<{ id: string }>({ permission: "flyers.access" }, async ({ params, user }) => {
  const key = process.env.REMOVE_BG_API_KEY;
  if (!key) throw new HttpError(501, "Serviço de remoção de fundo não configurado.");
  const f = await db.storedFile.findUnique({ where: { id: params.id } });
  if (!f || f.mimeType === "image/svg+xml") throw new HttpError(404, "Imagem não encontrada.");
  const data = await driver.get(f.storageKey);
  const form = new FormData();
  form.append("image_file", new Blob([Buffer.from(data)], { type: f.mimeType }), f.originalName);
  form.append("size", "auto");
  form.append("format", "png");
  const res = await fetch("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": key }, body: form, signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!res) throw new HttpError(502, "Serviço de remoção de fundo indisponível.");
  if (res.status === 402) throw new HttpError(402, "Créditos do serviço de remoção de fundo esgotados.");
  if (!res.ok) throw new HttpError(502, `Falha na remoção de fundo (${res.status}).`);
  const out = await storeImage({ ownerId: user.id, data: new Uint8Array(await res.arrayBuffer()), originalName: `${f.originalName}-sem-fundo.png`, purpose: "product", derivedFromId: f.id });
  await logActivity(user.id, "file.remove_bg", { type: "file", id: out.id }, { from: f.id });
  return jsonOk({ file: publicFileInfo(out) });
});

/** Chamadas a serviços externos podem demorar (limite da função na Vercel). */
export const maxDuration = 60;
