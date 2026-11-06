import { z } from "zod";
import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { hashPassword, validatePasswordStrength } from "@/core/auth/crypto";
import { logActivity } from "@/core/audit";

export const GET = apiRoute({ permission: "users.manage" }, async () => {
  const users = await db.user.findMany({ orderBy: { name: "asc" }, include: { role: true } });
  return jsonOk({
    users: users.map((u) => ({
      id: u.id, name: u.name, email: u.email, department: u.department, active: u.active, roleId: u.roleId, roleName: u.role.name,
      lastLoginAt: u.lastLoginAt, createdAt: u.createdAt, locked: !!(u.lockedUntil && u.lockedUntil > new Date()),
    })),
  });
});

const Create = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(200),
  roleId: z.string().min(1),
  department: z.string().trim().max(80).optional().nullable(),
  password: z.string().max(200),
});

export const POST = apiRoute({ permission: "users.manage" }, async ({ req, user }) => {
  const d = await parseBody(req, Create);
  const weak = validatePasswordStrength(d.password);
  if (weak) throw new HttpError(422, weak);
  if (!(await db.role.findUnique({ where: { id: d.roleId } }))) throw new HttpError(422, "Perfil inválido.");
  if (await db.user.findUnique({ where: { email: d.email } })) throw new HttpError(409, "Já existe um usuário com este e-mail.");
  const created = await db.user.create({
    data: { name: d.name, email: d.email, roleId: d.roleId, department: d.department || null, passwordHash: await hashPassword(d.password) },
  });
  await logActivity(user.id, "user.create", { type: "user", id: created.id }, { email: d.email });
  return jsonOk({ id: created.id }, 201);
});
