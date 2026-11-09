import { requirePageUser } from "@/core/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const p = user.permissions;
  return (
    <AppShell
      user={{ name: user.name, email: user.email, roleName: user.roleName }}
      canCreate={p.has("flyers.create")}
      canAdmin={p.has("users.manage") || p.has("brandkit.manage") || p.has("integrations.manage") || p.has("audit.view")}
    >
      {children}
    </AppShell>
  );
}
