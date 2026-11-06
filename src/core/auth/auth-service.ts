import "server-only";
import { db } from "@/core/db";
import { HttpError } from "@/core/http";
import { logActivity } from "@/core/audit";
import { hashPassword, hashToken, newToken, validatePasswordStrength, verifyPassword } from "./crypto";
import { createSession } from "./session";

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

// Limitador simples por IP (memória do processo). Em múltiplas instâncias, use Redis.
const ipHits = new Map<string, { count: number; until: number }>();
export function throttle(key: string, limit = 20, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const cur = ipHits.get(key);
  if (!cur || cur.until < now) { ipHits.set(key, { count: 1, until: now + windowMs }); return; }
  cur.count++;
  if (cur.count > limit) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
}

// Hash fictício para equalizar o tempo de resposta quando o e-mail não existe.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.2nU1A7u1Vj3uC6wq4m8H1b1xZ1lK";

export async function login(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await verifyPassword(password, DUMMY_HASH).catch(() => false);
    await logActivity(null, "auth.login_failed", null, { email });
    throw new HttpError(401, "E-mail ou senha inválidos.");
  }
  if (!user.active) throw new HttpError(403, "Usuário desativado. Procure o administrador.");
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, "Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente em alguns minutos.");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLogins: failed },
    });
    await logActivity(user.id, "auth.login_failed", null, { attempts: failed });
    throw new HttpError(401, "E-mail ou senha inválidos.");
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  await logActivity(user.id, "auth.login");
}

/** Cria um token de redefinição. Retorna o link (para envio por e-mail ou entrega pelo administrador). */
export async function createResetLink(userId: string) {
  await db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  const token = newToken();
  await db.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

/** Fluxo "esqueci minha senha": resposta idêntica exista ou não o e-mail. */
export async function requestPasswordReset(emailRaw: string) {
  const user = await db.user.findUnique({ where: { email: emailRaw.trim().toLowerCase() } });
  if (!user || !user.active) return;
  const link = await createResetLink(user.id);
  await sendResetEmail(user.email, link);
}

/**
 * Envio de e-mail: integração ainda não configurada. Em desenvolvimento, o
 * link é escrito no console do servidor; em produção, o administrador gera o
 * link em Administração › Usuários. Implemente aqui o provedor (SMTP, SES...).
 */
async function sendResetEmail(to: string, link: string) {
  if (process.env.NODE_ENV !== "production") console.info(`[auth] Link de redefinição para ${to}: ${link}`);
}

export async function resetPassword(token: string, password: string) {
  const weak = validatePasswordStrength(password);
  if (weak) throw new HttpError(422, weak);
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new HttpError(400, "Link inválido ou expirado. Solicite uma nova redefinição.");
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } }),
    db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  await logActivity(row.userId, "auth.password_reset");
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new HttpError(400, "Senha atual incorreta.");
  const weak = validatePasswordStrength(next);
  if (weak) throw new HttpError(422, weak);
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await logActivity(userId, "auth.password_changed");
}
