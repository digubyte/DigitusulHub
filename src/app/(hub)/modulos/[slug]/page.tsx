import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Construction } from "lucide-react";
import { requirePageUser } from "@/core/auth/session";
import { getModules } from "@/core/modules/service";
import { ModuleIcon } from "@/components/layout/icons";

/**
 * Página única para módulos ainda em desenvolvimento. Quando um módulo ficar
 * pronto, ele ganha sua própria rota e o manifesto aponta para ela.
 */
export default async function FutureModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requirePageUser();
  const mod = (await getModules()).find((m) => m.key === slug && m.route === `/modulos/${slug}`);
  if (!mod || !mod.visible || mod.status === "disabled") notFound();
  if (!user.permissions.has(mod.permission)) redirect("/sem-permissao");
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <ModuleIcon name={mod.icon} className="h-7 w-7" />
      </div>
      <span className="badge bg-amber-50 text-amber-700"><Construction className="h-3 w-3" />Em desenvolvimento</span>
      <h1 className="mt-3 font-display text-2xl font-extrabold text-ink">{mod.name}</h1>
      <p className="mt-2 text-ink-muted">{mod.description}</p>
      <p className="mt-6 text-sm text-ink-muted">
        Este módulo está planejado e já possui ponto de extensão na plataforma (navegação e permissões). Nenhuma funcionalidade dele está disponível ainda.
      </p>
      <Link href="/dashboard" className="btn-secondary mt-8">Voltar ao Dashboard</Link>
    </div>
  );
}
