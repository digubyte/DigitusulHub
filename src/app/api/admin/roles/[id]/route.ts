import { z } from "zod";
import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { logActivity } from "@/core/audit";

/** Ajuste granular de permissões de um perfil. O perfil Administrador é imutável. */
export const PUT = apiRoute<{ id: string }>({ permission: "users.manage" }, async ({ req, user, params }) => {
  const { permissions } = await parseBody(req, z.object({ permissions: z.array(z.string().max(80)).max(200) }));
  const role = await db.role.findUnique({ where: { id: params.id } });
  if (!role) throw new HttpError(404, "Perfil não encontrado.");
  if (role.key === "ADMIN") throw new HttpError(422, "As permissões do Administrador não podem ser reduzidas.");
  const valid = await db.permission.findMany({ where: { key: { in: permissions } } });
  if (valid.length && !valid.some((p) => p.key === "hub.access")) throw new HttpError(422, "Perfis com permissões precisam incluir: Acessar a plataforma.");
  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId: role.id } }),
    db.rolePermission.createMany({ data: valid.map((p) => ({ roleId: role.id, permissionId: p.id })) }),
  ]);
  await logActivity(user.id, "user.update", { type: "role", id: role.id }, { permissions: valid.map((p) => p.key) });
  return jsonOk({ ok: true });
});
