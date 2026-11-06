import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk } from "@/core/http";
import { logActivity } from "@/core/audit";

export const DELETE = apiRoute<{ id: string }>({ permission: "brandkit.manage" }, async ({ user, params }) => {
  const a = await db.brandAsset.findUnique({ where: { id: params.id } });
  if (!a) throw new HttpError(404, "Elemento não encontrado.");
  // O arquivo é mantido: flyers já criados continuam exibindo o elemento.
  await db.brandAsset.delete({ where: { id: a.id } });
  await logActivity(user.id, "brandasset.delete", { type: "brandAsset", id: a.id });
  return jsonOk({ ok: true });
});
