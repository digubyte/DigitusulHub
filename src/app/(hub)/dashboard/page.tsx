/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, FileImage, FolderOpen, Download, Users as UsersIcon, Plus, Palette, ShieldCheck } from "lucide-react";
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
    <div className="space-y-12">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow first-letter:uppercase">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-ink">Olá, {user.name.split(" ")[0]}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.permissions.has("brandkit.manage") && <Link href="/admin/brand-kit" className="btn-secondary"><Palette className="h-4 w-4" />Brand Kit</Link>}
          {user.permissions.has("users.manage") && <Link href="/admin/usuarios" className="btn-secondary"><ShieldCheck className="h-4 w-4" />Usuários</Link>}
          {user.permissions.has("flyers.create") && <Link href="/estudio/novo" className="btn-accent"><Plus className="h-4 w-4" />Novo flyer</Link>}
        </div>
      </section>

      <section aria-label="Indicadores" className="grid grid-cols-2 divide-zinc-200/80 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white lg:grid-cols-4 lg:divide-x">
        {kpis.map((k) => (
          <div key={k.label} className="p-5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-500"><k.icon className="h-3.5 w-3.5" aria-hidden />{k.label}</p>
            <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-ink">{k.value.toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="mods">
        <h2 id="mods" className="mb-4 text-sm font-medium text-zinc-500">Módulos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quick.map((m) => {
            const dev = m.status === "development";
            return (
              <Link key={m.key} href={m.route} className={`group flex items-start gap-3.5 rounded-2xl border border-zinc-200/80 bg-white p-4 transition ${dev ? "opacity-70 hover:opacity-100" : "hover:border-zinc-300 hover:shadow-card"}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${dev ? "bg-zinc-100 text-zinc-400" : "bg-brand-50 text-brand-600"}`}>
                  <ModuleIcon name={m.icon} className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">{m.name}{dev && <span className="text-[11px] font-normal text-zinc-400">em breve</span>}</p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-500">{m.description}</p>
                </div>
                {!dev && <ArrowRight className="mt-2 h-4 w-4 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-ink" />}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.7fr_1fr]">
        <section aria-labelledby="recent">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="recent" className="text-sm font-medium text-zinc-500">Flyers recentes</h2>
            {user.permissions.has("flyers.access") && <Link href="/estudio" className="text-[13px] font-medium text-zinc-500 hover:text-ink">Ver todos →</Link>}
          </div>
          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-10 text-center text-sm text-zinc-500">Nenhum flyer ainda. {user.permissions.has("flyers.create") && <Link href="/estudio/novo" className="font-medium text-ink underline underline-offset-4">Criar o primeiro</Link>}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {recent.map((f) => (
                <Link key={f.id} href={`/estudio/${f.id}`} className="group">
                  <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100/70 transition group-hover:border-zinc-300">
                    {f.thumbnailId ? <img src={`/api/files/${f.thumbnailId}`} alt="" className="h-full w-full object-contain p-2" /> : <FileImage className="h-6 w-6 text-zinc-300" />}
                  </div>
                  <p className="mt-2 truncate text-[13px] font-medium text-ink">{f.name}</p>
                  <p className="truncate text-xs text-zinc-500">{categoryLabel(f.category)} · {relativeTime(f.updatedAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="acts">
          <h2 id="acts" className="mb-4 text-sm font-medium text-zinc-500">Atividade</h2>
          <ol className="relative space-y-4 border-l border-zinc-200 pl-5">
            {activities.length === 0 && <li className="text-sm text-zinc-500">Sem atividades registradas.</li>}
            {activities.map((a) => (
              <li key={a.id} className="relative text-[13px]">
                <span aria-hidden className="absolute -left-[23.5px] top-1.5 h-2 w-2 rounded-full bg-zinc-300 ring-4 ring-[#fafafa]" />
                <p className="text-ink"><span className="font-medium">{a.user?.name ?? "Sistema"}</span> <span className="text-zinc-500">{(ACTION_LABELS[a.action] ?? a.action).toLowerCase()}</span></p>
                <p className="text-xs text-zinc-400">{relativeTime(a.createdAt)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
