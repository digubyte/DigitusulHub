import { redirect } from "next/navigation";
import { requirePageUser } from "@/core/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { AdminTabs } from "./tabs";

const TABS = [
  { href: "/admin/usuarios", label: "Usuários e perfis", perm: "users.manage" },
  { href: "/admin/modulos", label: "Módulos", perm: "modules.manage" },
  { href: "/admin/brand-kit", label: "Brand Kit", perm: "brandkit.manage" },
  { href: "/admin/integracoes", label: "Integrações e regras", perm: "integrations.manage" },
  { href: "/admin/auditoria", label: "Auditoria", perm: "audit.view" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const tabs = TABS.filter((t) => user.permissions.has(t.perm)).map(({ href, label }) => ({ href, label }));
  if (tabs.length === 0) redirect("/sem-permissao");
  return (
    <div>
      <PageHeader title="Administração" subtitle="Controle da plataforma, identidade visual e integrações." />
      <AdminTabs tabs={tabs} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
