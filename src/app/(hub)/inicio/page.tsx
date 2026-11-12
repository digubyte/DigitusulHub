/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, ImageOff, Layers, Presentation, Sparkles } from "lucide-react";
import { requirePageUser } from "@/core/auth/session";
import { getNavForUser } from "@/core/modules/service";
import { db } from "@/core/db";
import { cn, relativeTime } from "@/core/util";
import { CallClaudeButton } from "@/modules/flyer-studio/components/call-claude";
import { MascotStage } from "@/components/mascots/mascot-stage";

export const metadata = { title: "Início" };

const DAY = 86_400_000;

/** Início do Hub: painel do gerador de flyers (números do mês, lotes recentes e o que precisa de ação). */
export default async function HubHome() {
  const user = await requirePageUser();
  const canFlyers = user.permissions.has("flyers.access") && (await getNavForUser(user)).some((m) => m.key === "flyers" && m.status === "active");
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const header = (
    <section>
      <p className="eyebrow first-letter:uppercase">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
      <h1 className="mt-1 text-[28px] font-semibold tracking-tight">{greet}, {user.name.split(" ")[0]}</h1>
    </section>
  );
  if (!canFlyers) return <div className="space-y-6">{header}<p className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">Nenhuma solução liberada para o seu usuário ainda.</p></div>;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since = new Date(Math.min(monthStart.getTime(), now.getTime() - 13 * DAY));
  const rows = await db.flyerProject.findMany({
    where: { ownerId: user.id, deletedAt: null, isTemplate: false, mode: "chatgpt", createdAt: { gte: since } },
    select: { id: true, name: true, batchId: true, resultFileId: true, reviewStatus: true, reviewedAt: true, createdAt: true, chatUrl: true },
    orderBy: { createdAt: "desc" },
  });
  const month = rows.filter((r) => r.createdAt >= monthStart);
  const approved = month.filter((r) => r.reviewStatus === "approved").length;
  const toApprove = rows.filter((r) => r.resultFileId && r.reviewStatus === "pending").length;
  const noArt = rows.filter((r) => !r.resultFileId).length;
  const redo = rows.filter((r) => r.reviewStatus === "redo" || r.reviewStatus === "changes").length;
  const chats = rows.filter((r) => r.reviewStatus === "approved" && r.chatUrl).length;

  // aprovados por dia, últimos 14 dias
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i);
    const n = rows.filter((r) => r.reviewStatus === "approved" && r.reviewedAt && r.reviewedAt >= d && r.reviewedAt.getTime() < d.getTime() + DAY).length;
    return { d, n };
  });
  const maxDay = Math.max(1, ...days.map((x) => x.n));

  // lotes recentes
  const batches = new Map<string, typeof rows>();
  for (const r of rows) if (r.batchId) batches.set(r.batchId, [...(batches.get(r.batchId) ?? []), r]);
  const recent = [...batches.entries()].slice(0, 5).map(([id, fs]) => {
    const sorted = [...fs].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
    return {
      id, title: sorted[0].name.replace(/ · \d+\/\d+.*$/, ""), flyers: sorted, createdAt: sorted[0].createdAt,
      semArte: fs.filter((f) => !f.resultFileId).length,
      paraAprovar: fs.filter((f) => f.resultFileId && f.reviewStatus === "pending").length,
      aprovados: fs.filter((f) => f.reviewStatus === "approved").length,
      pedidos: fs.filter((f) => f.reviewStatus === "redo" || f.reviewStatus === "changes").length,
    };
  });
  const nextAction = recent.find((b) => b.paraAprovar) ?? recent.find((b) => b.semArte || b.pedidos);

  const stats = [
    { label: "Flyers no mês", value: month.length, icon: <Layers className="h-4 w-4" />, tone: "text-brand-700 bg-brand-50" },
    { label: "Aprovados no mês", value: approved, icon: <CheckCircle2 className="h-4 w-4" />, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Para aprovar", value: toApprove, icon: <Presentation className="h-4 w-4" />, tone: "text-sky-700 bg-sky-50" },
    { label: "Aguardando arte", value: noArt + redo, icon: <Clock className="h-4 w-4" />, tone: "text-amber-700 bg-amber-50" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {header}
        <Link href="/lote" className="btn-accent h-11 px-5"><Sparkles className="h-4 w-4" />Montar lote do dia</Link>
      </div>

      {nextAction && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-800">Próximo passo</p>
            <p className="text-sm text-zinc-600">
              {nextAction.paraAprovar ? `${nextAction.paraAprovar} flyer(s) de “${nextAction.title}” esperando sua aprovação.`
                : nextAction.semArte ? `“${nextAction.title}” ainda tem ${nextAction.semArte} flyer(s) sem arte.`
                : `“${nextAction.title}” tem ${nextAction.pedidos} pedido(s) para refazer.`}
            </p>
          </div>
          {nextAction.paraAprovar ? <Link href={`/estudio/lote/${nextAction.id}/aprovar`} className="btn-primary"><Presentation className="h-4 w-4" />Aprovar agora</Link>
            : <CallClaudeButton prompt={`/gerar-flyers lote ${nextAction.id}`} label={nextAction.semArte ? "Chamar o Claude" : "Refazer com o Claude"} />}
        </section>
      )}

      <MascotStage>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", s.tone)}>{s.icon}</span>
            <p className="mt-3 text-[28px] font-semibold leading-none tabular-nums">{s.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{s.label}</p>
          </div>
        ))}
      </section>
      </MascotStage>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lotes recentes</h2>
            <Link href="/estudio" className="text-[13px] text-zinc-500 hover:text-ink">Ver histórico →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-zinc-500">
              <ImageOff className="h-6 w-6 text-zinc-300" />Nenhum lote ainda. Monte o primeiro em “Montar lote do dia”.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recent.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-4 py-3">
                  <Link href={`/estudio/lote/${b.id}`} className="flex -space-x-3">
                    {b.flyers.slice(0, 6).map((f) => (
                      <span key={f.id} className="flex h-14 w-10 overflow-hidden rounded-md bg-zinc-100 ring-2 ring-surface">
                        {f.resultFileId ? <img src={`/api/files/${f.resultFileId}`} alt="" className="h-full w-full object-cover" /> : <span className="m-auto h-1.5 w-1.5 rounded-full bg-zinc-300" />}
                      </span>
                    ))}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/estudio/lote/${b.id}`} className="block truncate text-sm font-medium hover:underline">{b.title}</Link>
                    <p className="text-xs text-zinc-500">{b.flyers.length} flyers · {relativeTime(b.createdAt.toISOString())}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {b.aprovados > 0 && <span className="badge bg-emerald-50 text-emerald-700">{b.aprovados} aprovados</span>}
                    {b.paraAprovar > 0 && <Link href={`/estudio/lote/${b.id}/aprovar`} className="badge bg-sky-50 text-sky-700 hover:bg-sky-100">{b.paraAprovar} para aprovar →</Link>}
                    {b.semArte > 0 && <span className="badge bg-amber-50 text-amber-700">{b.semArte} sem arte</span>}
                    {b.pedidos > 0 && <span className="badge bg-amber-50 text-amber-700">{b.pedidos} para refazer</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold">Aprovados por dia</h2>
            <p className="text-xs text-zinc-500">Últimos 14 dias</p>
            <div className="mt-4 flex h-28 items-end gap-1.5" role="img" aria-label={`Aprovados por dia: ${days.map((x) => x.n).join(", ")}`}>
              {days.map((x, i) => (
                <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                  <div className={cn("w-full rounded-t", x.n ? "bg-brand-600" : "bg-zinc-100")} style={{ height: `${Math.max(6, (x.n / maxDay) * 100)}%` }} />
                  <span className="pointer-events-none absolute -top-6 hidden rounded bg-ink px-1.5 py-0.5 text-[10px] text-surface group-hover:block">{x.n}</span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-zinc-400">
              <span>{days[0].d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span><span>hoje</span>
            </div>
          </div>
          <div className="card space-y-2 p-5 text-sm">
            <h2 className="font-semibold">Atalhos</h2>
            <Link href="/lote" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-zinc-50">Lote do dia<ArrowRight className="h-4 w-4 text-zinc-400" /></Link>
            <Link href="/criar" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-zinc-50">Flyer avulso<ArrowRight className="h-4 w-4 text-zinc-400" /></Link>
            <Link href="/estudio" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-zinc-50">Histórico<ArrowRight className="h-4 w-4 text-zinc-400" /></Link>
            <Link href="/extensao" className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-zinc-50">Extensão do Chrome{chats > 0 && <span className="badge ml-auto mr-2 bg-amber-50 text-amber-700">{chats} conversa(s) a apagar</span>}<ArrowRight className="h-4 w-4 text-zinc-400" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
