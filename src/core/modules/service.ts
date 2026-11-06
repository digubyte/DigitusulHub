import "server-only";
import { db } from "@/core/db";
import type { CurrentUser } from "@/core/auth/session";
import { MODULES, type ModuleManifest, type ModuleStatus } from "./registry";

export interface NavModule extends ModuleManifest {
  status: ModuleStatus;
  order: number;
  visible: boolean;
}

/** Junta o manifesto (código) com a configuração do administrador (banco). */
export async function getModules(): Promise<NavModule[]> {
  const rows = await db.module.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return MODULES.map((m) => {
    const r = byKey.get(m.key);
    return {
      ...m,
      name: r?.name ?? m.name,
      status: (r?.status as ModuleStatus) ?? m.defaultStatus,
      order: r?.order ?? m.defaultOrder,
      visible: r?.visible ?? true,
    };
  }).sort((a, b) => a.order - b.order);
}

/** Módulos que o usuário pode ver no menu (permissão aplicada no servidor). */
export async function getNavForUser(user: CurrentUser): Promise<NavModule[]> {
  const mods = await getModules();
  return mods.filter((m) => m.visible && m.status !== "disabled" && user.permissions.has(m.permission));
}

export async function isModuleActive(key: string) {
  const mods = await getModules();
  return mods.find((m) => m.key === key)?.status === "active";
}
