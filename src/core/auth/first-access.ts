import "server-only";
import { db } from "@/core/db";
import { HttpError } from "@/core/http";
import { logActivity } from "@/core/audit";
import { hashPassword, validatePasswordStrength } from "./crypto";
import { createSession } from "./session";

/**
 * Primeiro acesso: enquanto não existir nenhum administrador ativo, a pessoa
 * com o e-mail definido em SEED_ADMIN_EMAIL pode criar a própria conta de
 * administrador (escolhendo a senha). Depois disso a tela deixa de existir.
 */
export function setupEmail() {
  return process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || null;
}

export async function needsFirstAccess() {
  if (!setupEmail()) return false;
  const admins = await db.user.count({ where: { active: true, role: { key: "ADMIN" } } });
  return admins === 0;
}

export async function completeFirstAccess(input: { name: string; email: string; password: string }) {
  const expected = setupEmail();
  if (!expected) throw new HttpError(404, "Primeiro acesso não está habilitado.");
  if (input.email.trim().toLowerCase() !== expected) throw new HttpError(403, "Este e-mail não está autorizado a criar o administrador.");
  const weak = validatePasswordStrength(input.password);
  if (weak) throw new HttpError(422, weak);
  const passwordHash = await hashPassword(input.password);

  const user = await db.$transaction(async (tx) => {
    const admins = await tx.user.count({ where: { active: true, role: { key: "ADMIN" } } });
    if (admins > 0) throw new HttpError(409, "O administrador já foi criado. Use a tela de login.");
    const role = await tx.role.findUnique({ where: { key: "ADMIN" } });
    if (!role) throw new HttpError(500, "Perfis ainda não configurados. Refaça o deploy.");
    const existing = await tx.user.findUnique({ where: { email: expected } });
    if (existing) return tx.user.update({ where: { id: existing.id }, data: { name: input.name.trim(), passwordHash, roleId: role.id, active: true, failedLogins: 0, lockedUntil: null } });
    return tx.user.create({ data: { name: input.name.trim(), email: expected, passwordHash, roleId: role.id } });
  });

  await createSession(user.id);
  await logActivity(user.id, "user.create", { type: "user", id: user.id }, { firstAccess: true });
}
