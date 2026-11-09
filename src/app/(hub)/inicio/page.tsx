/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, Clock, FileImage } from "lucide-react";
import { requirePageUser } from "@/core/auth/session";
import { getNavForUser } from "@/core/modules/service";
import { db } from "@/core/db";
import { relativeTime } from "@/core/util";
import { ModuleIcon } from "@/components/layout/icons";
import { listFlyers } from "@/modules/flyer-studio/services/flyer-service";

export const metadata = { title: "Início" };

/** Início do Hub: as soluções da Digitusul em um só lugar. */
export default async function HubHome() {
  const user = await requirePageUser();
  const mods = (await getNavForUser(user)).filter((m) => m.section === "main" && m.key !== "inicio");
  const active = mods.filter((m) => m.status === "active");
  const soon = mods.filter((m) => m.status === "development");
  const canFlyers = user.permissions.has("flyers.access") && active.some((m) => m.key === "flyers");
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [recent, flyersMonth] = canFlyers
    ? await Promise.all([
        listFlyers(user, { scope: "mine" }).then((r) => r.slice(0, 4)),
        db.flyerProject.count({ where: { ownerId: user.id, deletedAt: null, isTemplate: false, createdAt: { gte: monthStart } } }),
      ])
    : [[], 0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-12">
      <section>
        <p className="eyebrow first-letter:uppercase">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight">{greet}, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-zinc-500">Bem-vindo ao Digitusul Hub, a central de soluções da Digitusul.</p>
      </section>

      <section aria-labelledby="sol">
        <h2 id="sol" className="mb-4 text-sm font-medium text-zinc-500">Soluções</h2>
        {active.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">Nenhuma solução liberada para o seu usuário ainda.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((m) => (
              <Link key={m.key} href={m.route} className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-surface p-6 transition hover:border-brand-300 hover:shadow-pop">
                <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-100/60 blur-2xl transition group-hover:bg-brand-200/60" />
                <div className="relative flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-card">
                    <ModuleIcon name={m.icon} className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold tracking-tight">{m.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">{m.description}</p>
                    {m.key === "flyers" && <p className="mt-3 text-xs text-zinc-500">{flyersMonth} {flyersMonth === 1 ? "flyer criado" : "flyers criados"} por você este mês</p>}
                  </div>
                </div>
                <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">Abrir<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {soon.length > 0 && (
        <section aria-labelledby="soon">
          <h2 id="soon" className="mb-4 flex items-center gap-1.5 text-sm font-medium text-zinc-500"><Clock className="h-3.5 w-3.5" />Em breve</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {soon.map((m) => (
              <Link key={m.key} href={m.route} className="rounded-2xl border border-dashed border-zinc-200 p-4 opacity-80 transition hover:opacity-100">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400"><ModuleIcon name={m.icon} className="h-[18px] w-[18px]" /></div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{m.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {canFlyers && recent.length > 0 && (
        <section aria-labelledby="rec">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="rec" className="text-sm font-medium text-zinc-500">Seus flyers recentes</h2>
            <Link href="/estudio" className="text-[13px] font-medium text-zinc-500 hover:text-ink">Ver histórico →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recent.map((f) => (
              <Link key={f.id} href={`/estudio/${f.id}`} className="group">
                <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100/70 transition group-hover:border-zinc-300">
                  {f.thumbnailId ? <img src={`/api/files/${f.thumbnailId}`} alt="" className="h-full w-full object-contain p-2" /> : <FileImage className="h-6 w-6 text-zinc-300" />}
                </div>
                <p className="mt-2 truncate text-[13px] font-medium">{f.name}</p>
                <p className="truncate text-xs text-zinc-500">{f.resultFileId ? "Arte pronta" : "Aguardando arte"} · {relativeTime(f.updatedAt)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
