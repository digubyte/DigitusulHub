import { requirePageUser } from "@/core/auth/session";
import { getNavForUser } from "@/core/modules/service";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const nav = await getNavForUser(user);
  return (
    <AppShell
      user={{ name: user.name, email: user.email, roleName: user.roleName }}
      nav={nav.map((n) => ({ key: n.key, name: n.name, icon: n.icon, route: n.route, status: n.status, section: n.section }))}
    >
      {children}
    </AppShell>
  );
}
