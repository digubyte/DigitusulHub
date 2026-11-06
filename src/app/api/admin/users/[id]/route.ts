import { z } from "zod";
import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { logActivity } from "@/core/audit";

const Patch = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  roleId: z.string().min(1).optional(),
  department: z.string().trim().max(80).nullable().optional(),
  active: z.boolean().optional(),
  unlock: z.boolean().optional(),
});

export const PATCH = apiRoute<{ id: string }>({ permission: "users.manage" }, async ({ req, user, params }) => {
  const d = await parseBody(req, Patch);
  const target = await db.user.findUnique({ where: { id: params.id }, include: { role: true } });
  if (!target) throw new HttpError(404, "Usuário não encontrado.");
  if (target.id === user.id && (d.active === false || (d.roleId && d.roleId !== target.roleId))) {
    throw new HttpError(422, "Você não pode desativar nem alterar o próprio perfil.");
  }
  if (d.roleId && !(await db.role.findUnique({ where: { id: d.roleId } }))) throw new HttpError(422, "Perfil inválido.");
  // Sempre deve restar ao menos um administrador ativo.
  if (target.role.key === "ADMIN" && (d.active === false || (d.roleId && d.roleId !== target.roleId))) {
    const admins = await db.user.count({ where: { active: true, role: { key: "ADMIN" } } });
    if (admins <= 1) throw new HttpError(422, "É necessário manter ao menos um administrador ativo.");
  }
  await db.user.update({
    where: { id: params.id },
    data: { name: d.name, roleId: d.roleId, department: d.department, active: d.active, ...(d.unlock ? { lockedUntil: null, failedLogins: 0 } : {}) },
  });
  if (d.active === false || (d.roleId && d.roleId !== target.roleId)) await db.session.deleteMany({ where: { userId: params.id } });
  await logActivity(user.id, "user.update", { type: "user", id: params.id }, d);
  return jsonOk({ ok: true });
});
