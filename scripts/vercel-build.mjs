/**
 * Build de produção (Vercel): migrações do banco → perfis/módulos (seed) → Next.js.
 * Funciona com Prisma Postgres (só DATABASE_URL) ou Neon (DATABASE_URL + DATABASE_URL_UNPOOLED).
 */
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.error("\n✖ DATABASE_URL não definida. Conecte um banco Postgres ao projeto na Vercel (aba Storage).\n");
  process.exit(1);
}
process.env.DATABASE_URL_UNPOOLED ||= process.env.DATABASE_URL;

for (const cmd of ["prisma generate", "prisma migrate deploy", "tsx prisma/seed.ts", "next build"]) {
  console.log(`\n▶ ${cmd}`);
  execSync(`npx ${cmd}`, { stdio: "inherit", env: process.env });
}
