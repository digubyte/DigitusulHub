import { requirePageUser } from "@/core/auth/session";
import { getNavForUser } from "@/core/modules/service";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const p = user.permissions;
  // No topo aparecem só as soluções já ativas; as "Em breve" ficam no Início.
  const solutions = (await getNavForUser(user))
    .filter((m) => m.section === "main" && m.key !== "inicio" && m.status === "active")
    .map((m) => ({ key: m.key, name: m.name, icon: m.icon, route: m.route }));
  return (
    <AppShell
      user={{ name: user.name, email: user.email, roleName: user.roleName }}
      solutions={solutions}
      canAdmin={p.has("users.manage") || p.has("brandkit.manage") || p.has("integrations.manage") || p.has("modules.manage") || p.has("audit.view")}
    >
      {children}
    </AppShell>
  );
}
