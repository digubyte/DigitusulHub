/**
 * Seed idempotente: papéis, permissões, módulos, Brand Kit inicial e o
 * primeiro administrador (credenciais lidas de .env). Não cria produtos,
 * flyers ou qualquer dado comercial de demonstração.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, DEFAULT_ROLES, type RoleKey } from "../src/core/permissions";
import { MODULES } from "../src/core/modules/registry";
import { DEFAULT_BRAND_COLORS, DEFAULT_BRAND_FONTS } from "../src/modules/flyer-studio/domain/brand";

const db = new PrismaClient();

async function main() {
  for (const [key, p] of Object.entries(PERMISSIONS)) {
    await db.permission.upsert({ where: { key }, update: { description: p.description, module: p.module }, create: { key, ...p } });
  }
  const perms = await db.permission.findMany();
  const permId = new Map(perms.map((p) => [p.key, p.id]));

  for (const [key, r] of Object.entries(DEFAULT_ROLES) as [RoleKey, (typeof DEFAULT_ROLES)[RoleKey]][]) {
    const role = await db.role.upsert({
      where: { key },
      update: { name: r.name, description: r.description, system: true },
      create: { key, name: r.name, description: r.description, system: true },
    });
    // Garante as permissões padrão (sem remover concessões extras feitas pelo admin).
    for (const pk of r.permissions) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId.get(pk)! } },
        update: {},
        create: { roleId: role.id, permissionId: permId.get(pk)! },
      });
    }
  }

  for (const m of MODULES) {
    await db.module.upsert({
      where: { key: m.key },
      update: {},
      create: { key: m.key, name: m.name, status: m.defaultStatus, order: m.defaultOrder },
    });
  }
  // Nome antigo do módulo de flyers (só troca se o administrador não tiver renomeado).
  await db.module.updateMany({ where: { key: "flyers", name: "Estúdio de Flyers" }, data: { name: "Gerador de flyers" } });

  await db.brandKit.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      colors: JSON.stringify(DEFAULT_BRAND_COLORS),
      fonts: JSON.stringify(DEFAULT_BRAND_FONTS),
      rules:
        "• Não distorcer, recolorir ou redesenhar o logotipo.\n• Manter área de respiro ao redor do logotipo.\n• Azul institucional como cor principal; vermelho para destaques e preços.\n• Preços, códigos e nomes de produtos sempre legíveis e nunca cobertos por elementos decorativos.",
      approvedPhrases: JSON.stringify([]),
    },
  });

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const exists = await db.user.findUnique({ where: { email } });
    if (!exists) {
      const adminRole = await db.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
      await db.user.create({
        data: { email, name: process.env.SEED_ADMIN_NAME || "Administrador", passwordHash: await bcrypt.hash(password, 12), roleId: adminRole.id },
      });
      console.log(`✔ Administrador criado: ${email} (senha definida em SEED_ADMIN_PASSWORD no .env)`);
    } else {
      console.log(`• Administrador ${email} já existe — senha não alterada.`);
    }
  } else {
    console.warn("! SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD não definidos: nenhum administrador criado.");
  }
  console.log("✔ Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
