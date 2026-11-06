import { PrismaClient } from "@prisma/client";

// Prisma Postgres fornece só DATABASE_URL; Neon fornece também a conexão direta.
process.env.DATABASE_URL_UNPOOLED ||= process.env.DATABASE_URL;

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") g.prisma = db;
