import { PrismaClient } from "@prisma/client";

// Prisma Postgres fornece só DATABASE_URL; Neon fornece também a conexão direta.
process.env.DATABASE_URL_UNPOOLED ||= process.env.DATABASE_URL;

/**
 * Na Vercel cada função roda em uma instância separada e o banco gratuito aceita
 * poucas conexões simultâneas ("too many connections"). Cada instância usa então
 * uma única conexão, esperando a vez em vez de abrir outras.
 */
export function withConnectionLimit(url: string | undefined): string | undefined {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
    return u.toString();
  } catch {
    return url;
  }
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ log: ["error"], datasourceUrl: withConnectionLimit(process.env.DATABASE_URL) });
g.prisma = db;
