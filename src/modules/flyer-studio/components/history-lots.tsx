"use client";
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Presentation } from "lucide-react";
import { cn } from "@/core/util";
import { CallClaudeButton } from "./call-claude";

export interface LotItem {
  id: string; name: string; batchId: string | null; resultFileId: string | null; thumbnailId: string | null;
  reviewStatus?: string; createdAt?: string; updatedAt: string; mode: string;
}

/** Tema do lote: o nome dos flyers começa com ele (ex.: "gamer · 11/11 · 2/6"). */
export function lotTheme(name: string) {
  const t = name.split(" · ")[0]?.trim() || "Sem tema";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function dayLabel(d: Date) {
  const today = new Date(); const y = new Date(today); y.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return "Hoje";
  if (dayKey(d) === dayKey(y)) return "Ontem";
  const s = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Lot { key: string; batchId: string | null; theme: string; created: Date; flyers: LotItem[] }

/** Histórico agrupado: dia → lotes (com o tema em destaque), com filtro por tema. */
export function HistoryLots({ items }: { items: LotItem[] }) {
  const [theme, setTheme] = useState("");

  const lots = useMemo(() => {
    const map = new Map<string, Lot>();
    for (const it of items) {
      const key = it.batchId ?? `avulso-${it.id}`;
      const created = new Date(it.createdAt ?? it.updatedAt);
      const lot = map.get(key) ?? { key, batchId: it.batchId, theme: lotTheme(it.name), created, flyers: [] };
      lot.flyers.push(it);
      if (created < lot.created) lot.created = created;
      map.set(key, lot);
    }
    const all = [...map.values()];
    all.forEach((l) => l.flyers.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })));
    return all.sort((a, b) => b.created.getTime() - a.created.getTime());
  }, [items]);

  const themes = useMemo(() => {
    const count = new Map<string, number>();
    lots.forEach((l) => count.set(l.theme, (count.get(l.theme) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [lots]);

  const shown = theme ? lots.filter((l) => l.theme === theme) : lots;
  const days: { label: string; lots: Lot[] }[] = [];
  for (const l of shown) {
    const label = dayLabel(l.created);
    const last = days[days.length - 1];
    if (last?.label === label) last.lots.push(l); else days.push({ label, lots: [l] });
  }

  return (
    <div className="space-y-8">
      {themes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-zinc-500">Tema:</span>
          <button onClick={() => setTheme("")} className={cn("rounded-full border px-2.5 py-0.5 text-[12px]", !theme ? "border-brand-300 bg-brand-50 text-brand-700" : "border-zinc-200 text-zinc-500 hover:text-ink")}>Todos</button>
          {themes.map(([t, n]) => (
            <button key={t} onClick={() => setTheme(t === theme ? "" : t)} className={cn("rounded-full border px-2.5 py-0.5 text-[12px]", theme === t ? "border-brand-300 bg-brand-50 text-brand-700" : "border-zinc-200 text-zinc-500 hover:text-ink")}>
              {t} <span className="text-zinc-400">{n}</span>
            </button>
          ))}
        </div>
      )}

      {days.map((d) => (
        <section key={d.label}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-600">
            {d.label}<span className="h-px flex-1 bg-zinc-200" /><span className="text-xs font-normal text-zinc-400">{d.lots.length} lote(s)</span>
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {d.lots.map((l) => <LotCard key={l.key} lot={l} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function LotCard({ lot }: { lot: Lot }) {
  const semArte = lot.flyers.filter((f) => !f.resultFileId).length;
  const paraAprovar = lot.flyers.filter((f) => f.resultFileId && (f.reviewStatus ?? "pending") === "pending").length;
  const aprovados = lot.flyers.filter((f) => f.reviewStatus === "approved").length;
  const pedidos = lot.flyers.filter((f) => f.reviewStatus === "redo" || f.reviewStatus === "changes").length;
  const href = lot.batchId ? `/estudio/lote/${lot.batchId}` : `/estudio/${lot.flyers[0].id}`;
  const time = lot.created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-base font-semibold tracking-tight hover:underline">{lot.theme}</Link>
          <p className="text-xs text-zinc-500">{lot.batchId ? `Lote de ${lot.flyers.length} flyers` : "Flyer avulso"} · {time}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1 text-[11px]">
          {aprovados === lot.flyers.length ? <span className="badge bg-emerald-50 text-emerald-700">Tudo aprovado</span> : (
            <>
              {aprovados > 0 && <span className="badge bg-emerald-50 text-emerald-700">{aprovados} aprovados</span>}
              {paraAprovar > 0 && <span className="badge bg-sky-50 text-sky-700">{paraAprovar} para aprovar</span>}
              {semArte > 0 && <span className="badge bg-amber-50 text-amber-700">{semArte} sem arte</span>}
              {pedidos > 0 && <span className="badge bg-amber-50 text-amber-700">{pedidos} para refazer</span>}
            </>
          )}
        </div>
      </div>

      <Link href={href} className="flex gap-1.5 overflow-hidden">
        {lot.flyers.map((f) => {
          const img = f.resultFileId ?? f.thumbnailId;
          return (
            <span key={f.id} className="relative flex aspect-[2/3] w-[15%] min-w-[44px] max-w-[72px] shrink-0 overflow-hidden rounded-md bg-zinc-100">
              {img ? <img src={`/api/files/${img}`} alt="" className="h-full w-full object-cover" /> : <span className="m-auto text-[9px] text-zinc-400">sem arte</span>}
              {f.reviewStatus === "approved" && <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />}
            </span>
          );
        })}
      </Link>

      {lot.batchId && (paraAprovar > 0 || semArte > 0 || pedidos > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {paraAprovar > 0 && <Link href={`/estudio/lote/${lot.batchId}/aprovar`} className="btn-primary btn-sm"><Presentation className="h-3.5 w-3.5" />Aprovar ({paraAprovar})</Link>}
          {(semArte > 0 || pedidos > 0) && <CallClaudeButton prompt={`/gerar-flyers lote ${lot.batchId}`} label={semArte ? "Chamar o Claude" : "Refazer com o Claude"} />}
        </div>
      )}
    </article>
  );
}
