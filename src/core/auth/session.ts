import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/core/db";
import { hashToken, newToken } from "./crypto";
import type { PermissionKey } from "@/core/permissions";

export const SESSION_COOKIE = "dh_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h
const SESSION_REFRESH_MS = 1000 * 60 * 30; // renova se usada após 30 min

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  department: string | null;
  permissions: Set<string>;
}

export async function createSession(userId: string) {
  const token = newToken();
  const h = await headers();
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Lê e valida a sessão (uma vez por requisição). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) {
    if (session) await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > SESSION_REFRESH_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
  }
  const u = session.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    roleKey: u.role.key,
    roleName: u.role.name,
    department: u.department,
    permissions: new Set(u.role.permissions.map((rp) => rp.permission.key)),
  };
});

/** Para páginas (Server Components): redireciona se não autenticado/autorizado. */
export async function requirePageUser(permission?: PermissionKey): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.has("hub.access")) redirect("/login?erro=acesso");
  if (permission && !user.permissions.has(permission)) redirect("/sem-permissao");
  return user;
}

export function serializeUser(u: CurrentUser) {
  return { id: u.id, name: u.name, email: u.email, roleKey: u.roleKey, roleName: u.roleName, permissions: [...u.permissions] };
}
export type ClientUser = ReturnType<typeof serializeUser>;
