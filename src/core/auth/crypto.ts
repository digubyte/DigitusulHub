import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RULES = "Mínimo de 10 caracteres, com letras e números.";

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 10) return "A senha deve ter pelo menos 10 caracteres.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "A senha deve conter letras e números.";
  return null;
}
export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
