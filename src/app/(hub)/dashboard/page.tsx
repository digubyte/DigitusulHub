/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, FileImage, FolderOpen, Download, Users as UsersIcon, Plus, Palette, ShieldCheck, Activity } from "lucide-react";
import { requirePageUser } from "@/core/auth/session";
import { getModules } from "@/core/modules/service";
import { db } from "@/core/db";
import { ACTION_LABELS } from "@/core/audit";
import { relativeTime } from "@/core/util";
import { ModuleIcon } from "@/components/layout/icons";
import { listFlyers } from "@/modules/flyer-studio/services/flyer-service";
import { categoryLabel } from "@/modules/flyer-studio/domain/brand";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requirePageUser();
  const team = user.permissions.has("metrics.team");
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const scopeUser = team ? {} : { userId: user.id };

  const [modules, recent, myFlyers, monthFlyers, monthExports, activeUsers, activities] = await Promise.all([
    getModules(),
    user.permissions.has("flyers.access") ? listFlyers(user, { scope: team ? "all" : "mine" }).then((r) => r.slice(0, 6)) : Promise.resolve([]),
    db.flyerProject.count({ where: { ownerId: user.id, deletedAt: null, isTemplate: false } }),
    db.flyerProject.count({ where: { deletedAt: null, isTemplate: false, createdAt: { gte: monthStart }, ...(team ? {} : { ownerId: user.id }) } }),
    db.activityLog.count({ where: { action: "flyer.export", createdAt: { gte: monthStart }, ...scopeUser } }),
    team ? db.user.count({ where: { active: true } }) : Promise.resolve(null),
    db.activityLog.findMany({
      where: { action: { notIn: ["auth.login_failed"] }, ...(user.permissions.has("audit.view") ? {} : { userId: user.id }) },
      orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } } },
    }),
  ]);

  const quick = modules.filter((m) => m.showOnDashboard && m.visible && m.status !== "disabled" && user.permissions.has(m.permission));
  const kpis = [
    { label: "Meus flyers", value: myFlyers, icon: FileImage },
    { label: team ? "Flyers da equipe no mês" : "Flyers criados no mês", value: monthFlyers, icon: FolderOpen },
    { label: team ? "Exportações da equipe no mês" : "Exportações no mês", value: monthExports, icon: Download },
    ...(activeUsers != null ? [{ label: "Usuários ativos", value: activeUsers, icon: UsersIcon }] : []),
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Olá, {user.name.split(" ")[0]}.</h1>
          <p className="mt-1 text-sm text-ink-muted">Bem-vindo ao Digitusul Hub. Escolha um módulo ou continue um projeto recente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.permissions.has("flyers.create") && <Link href="/estudio/novo" className="btn-accent"><Plus className="h-4 w-4" />Criar novo flyer</Link>}
          {user.permissions.has("brandkit.manage") && <Link href="/admin/brand-kit" className="btn-secondary"><Palette className="h-4 w-4" />Brand Kit</Link>}
          {user.permissions.has("users.manage") && <Link href="/admin/usuarios" className="btn-secondary"><ShieldCheck className="h-4 w-4" />Usuários</Link>}
        </div>
      </section>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-muted">{k.label}</p>
              <k.icon className="h-4 w-4 text-slate-300" aria-hidden />
            </div>
            <p className="mt-2 font-display text-3xl font-extrabold text-ink">{k.value.toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="mods">
        <h2 id="mods" className="mb-3 font-display text-lg font-bold text-ink">Módulos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quick.map((m) => {
            const dev = m.status === "development";
            return (
              <Link key={m.key} href={m.route} className={`card group flex gap-4 p-5 transition ${dev ? "opacity-80 hover:opacity-100" : "hover:border-brand-200 hover:shadow-pop"}`}>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${dev ? "bg-slate-100 text-slate-400" : "bg-brand-600 text-white"}`}>
                  <ModuleIcon name={m.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{m.name}</p>
                  {dev && <span className="badge mt-1 bg-amber-50 text-amber-700">Em desenvolvimento</span>}
                  <p className="mt-0.5 text-sm text-ink-muted">{m.description}</p>
                </div>
                {!dev && <ArrowRight className="h-4 w-4 self-center text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="recent">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent" className="font-display text-lg font-bold text-ink">Projetos recentes</h2>
            {user.permissions.has("flyers.access") && <Link href="/estudio" className="text-sm font-semibold text-brand-600 hover:underline">Ver todos</Link>}
          </div>
          {recent.length === 0 ? (
            <div className="card p-8 text-center text-sm text-ink-muted">Nenhum projeto ainda. {user.permissions.has("flyers.create") && <Link href="/estudio/novo" className="font-semibold text-brand-600 hover:underline">Crie o primeiro flyer.</Link>}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {recent.map((f) => (
                <Link key={f.id} href={`/estudio/${f.id}`} className="card group overflow-hidden transition hover:shadow-pop">
                  <div className="flex aspect-square items-center justify-center bg-slate-100">
                    {f.thumbnailId ? <img src={`/api/files/${f.thumbnailId}`} alt="" className="h-full w-full object-contain" /> : <FileImage className="h-8 w-8 text-slate-300" />}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-ink">{f.name}</p>
                    <p className="truncate text-xs text-ink-muted">{categoryLabel(f.category)} · {relativeTime(f.updatedAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="acts">
          <h2 id="acts" className="mb-3 font-display text-lg font-bold text-ink">Atividades recentes</h2>
          <div className="card divide-y divide-slate-100">
            {activities.length === 0 && <p className="p-6 text-sm text-ink-muted">Sem atividades registradas.</p>}
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3.5">
                <Activity className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="text-ink"><span className="font-semibold">{a.user?.name ?? "Sistema"}</span> · {ACTION_LABELS[a.action] ?? a.action}</p>
                  <p className="text-xs text-ink-muted">{relativeTime(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
