import { z } from "zod";
import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { logActivity } from "@/core/audit";

/** Cadastra mascote (Digu) ou elemento institucional a partir de um arquivo já enviado pelo administrador. */
export const POST = apiRoute({ permission: "brandkit.manage" }, async ({ req, user }) => {
  const d = await parseBody(req, z.object({ kind: z.enum(["mascot", "element"]), name: z.string().trim().min(1).max(60), fileId: z.string().min(1) }));
  if (!(await db.storedFile.findFirst({ where: { id: d.fileId, purpose: "brand" } }))) throw new HttpError(422, "Arquivo inválido.");
  const a = await db.brandAsset.create({ data: d });
  await logActivity(user.id, "brandasset.create", { type: "brandAsset", id: a.id }, { kind: d.kind });
  return jsonOk({ id: a.id }, 201);
});
