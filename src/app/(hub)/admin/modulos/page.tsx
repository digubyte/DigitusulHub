import { requirePageUser } from "@/core/auth/session";
import { getModules } from "@/core/modules/service";
import { CORE_MODULES } from "@/core/modules/registry";
import { ModulesAdmin } from "./modules-client";

export const metadata = { title: "Módulos" };

export default async function Page() {
  await requirePageUser("modules.manage");
  const mods = await getModules();
  return (
    <ModulesAdmin
      initial={mods.map((m) => ({ key: m.key, name: m.name, description: m.description, route: m.route, status: m.status, order: m.order, visible: m.visible, core: CORE_MODULES.has(m.key), implemented: !m.route.startsWith("/modulos/"), permission: m.permission }))}
    />
  );
}
