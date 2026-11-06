import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk } from "@/core/http";
import { createResetLink } from "@/core/auth/auth-service";
import { logActivity } from "@/core/audit";

/** Gera um link de redefinição (válido por 1 h) para o administrador entregar ao usuário. */
export const POST = apiRoute<{ id: string }>({ permission: "users.manage" }, async ({ user, params }) => {
  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) throw new HttpError(404, "Usuário não encontrado.");
  const link = await createResetLink(target.id);
  await logActivity(user.id, "user.reset_link", { type: "user", id: target.id });
  return jsonOk({ link });
});
