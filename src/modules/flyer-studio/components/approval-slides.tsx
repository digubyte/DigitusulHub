"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, MessageSquareText, RotateCcw, ImageOff } from "lucide-react";
import { api, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/core/util";
import { formatPrice } from "../domain/product-format";
import type { ReviewStatus } from "../domain/schemas";
import type { Product } from "../domain/types";

export interface ApprovalFlyer {
  id: string;
  name: string;
  products: Product[];
  resultFileId: string | null;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  canEdit: boolean;
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovado",
  redo: "Refazer",
  changes: "Alterações pedidas",
};
export const REVIEW_BADGE: Record<ReviewStatus, string> = {
  pending: "bg-zinc-100 text-zinc-600",
  approved: "bg-emerald-50 text-emerald-700",
  redo: "bg-amber-50 text-amber-700",
  changes: "bg-sky-50 text-sky-700",
};

/** Aprovação do lote em formato de slides: um flyer por vez, com Aprovar / Refazer / Alterações. */
export function ApprovalSlides({ batchId, title, flyers: initial }: { batchId: string; title: string; flyers: ApprovalFlyer[] }) {
  const toast = useToast();
  const [flyers, setFlyers] = useState(initial);
  const firstPending = Math.max(0, initial.findIndex((f) => f.resultFileId && f.reviewStatus === "pending"));
  const [i, setI] = useState(firstPending);
  const [busy, setBusy] = useState<ReviewStatus | null>(null);
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState("");
  const f = flyers[i];
  const total = flyers.length;
  const approved = flyers.filter((x) => x.reviewStatus === "approved").length;
  const open = flyers.filter((x) => x.reviewStatus === "redo" || x.reviewStatus === "changes").length;

  const go = useCallback((n: number) => { setI((n + total) % total); setWriting(false); setNote(""); }, [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  async function review(status: ReviewStatus, text?: string) {
    setBusy(status);
    try {
      await api(`/api/flyers/${f.id}/review`, { method: "POST", json: { status, note: text ?? null } });
      const next = flyers.map((x) => (x.id === f.id ? { ...x, reviewStatus: status, reviewNote: status === "approved" ? null : text ?? null } : x));
      setFlyers(next);
      toast.success(status === "approved" ? "Flyer aprovado." : status === "redo" ? "Marcado para refazer." : "Alterações registradas.");
      // vai para o próximo que ainda espera aprovação
      const after = next.findIndex((x, k) => k > i && x.resultFileId && x.reviewStatus === "pending");
      const anyPending = next.findIndex((x) => x.resultFileId && x.reviewStatus === "pending");
      setWriting(false); setNote("");
      if (after >= 0) setI(after); else if (anyPending >= 0) setI(anyPending);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const done = approved + open === total;

  return (
    <div className="mx-auto flex max-w-6xl flex-col px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href={`/estudio/lote/${batchId}`} className="btn-icon btn-ghost -ml-2" aria-label="Voltar ao lote"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Aprovação do lote</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <p className="text-sm text-zinc-500"><strong className="text-ink">{approved}</strong> aprovados · <strong className="text-ink">{open}</strong> para refazer/alterar · {total} no total</p>
      </div>

      {done && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Revisão concluída. {open ? `${open} flyer(s) voltam para o ChatGPT com os seus pedidos.` : "Todos aprovados — pode baixar os flyers no lote."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* slide */}
        <div className="relative flex items-center justify-center rounded-2xl bg-zinc-900/95 p-4 sm:p-8" style={{ minHeight: "min(78vh, 900px)" }}>
          <button className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => go(i - 1)} aria-label="Flyer anterior"><ChevronLeft className="h-6 w-6" /></button>
          {f.resultFileId
            ? <img key={f.resultFileId} src={`/api/files/${f.resultFileId}`} alt={`Arte de ${f.name}`} className="max-h-[74vh] w-auto max-w-full rounded-lg object-contain shadow-2xl" />
            : <div className="flex flex-col items-center gap-2 text-zinc-400"><ImageOff className="h-8 w-8" /><p className="text-sm">Arte ainda não gerada</p></div>}
          <button className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => go(i + 1)} aria-label="Próximo flyer"><ChevronRight className="h-6 w-6" /></button>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">{i + 1} / {total}</span>
        </div>

        {/* painel */}
        <aside className="card flex flex-col gap-4 p-5">
          <div>
            <span className={cn("badge mb-2", REVIEW_BADGE[f.reviewStatus])}>{REVIEW_LABEL[f.reviewStatus]}</span>
            <h2 className="text-lg font-semibold leading-snug">{f.name}</h2>
          </div>

          <ul className="space-y-1.5 text-[13px]">
            {f.products.map((p) => (
              <li key={p.id} className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1">{p.name} <span className="text-zinc-400">· {p.code}</span></span>
                <span className="font-medium tabular-nums">{formatPrice(p.priceCents ?? 0)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-zinc-500">Confira na arte se nome, código e preço estão iguais à lista.</p>

          {f.reviewNote && f.reviewStatus !== "approved" && (
            <div className="rounded-lg bg-sky-50 p-3 text-[13px] text-sky-900"><strong className="font-medium">Pedido:</strong> {f.reviewNote}</div>
          )}

          {f.canEdit && f.resultFileId ? (
            writing ? (
              <div className="space-y-2">
                <textarea autoFocus className="input min-h-[130px] text-sm" placeholder="Ex.: aumentar o preço do mouse, trocar o fundo para azul, tirar o selo de Black Friday…" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-accent flex-1" disabled={!note.trim() || !!busy} onClick={() => review("changes", note.trim())}>{busy === "changes" ? <Spinner /> : <MessageSquareText className="h-4 w-4" />}Enviar alterações</button>
                  <button className="btn-ghost" onClick={() => { setWriting(false); setNote(""); }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="mt-auto grid gap-2">
                <button className="btn bg-emerald-600 py-3 text-white hover:bg-emerald-700" disabled={!!busy} onClick={() => review("approved")}>{busy === "approved" ? <Spinner /> : <Check className="h-4 w-4" />}Aprovar</button>
                <button className="btn-secondary py-3" disabled={!!busy} onClick={() => review("redo")}>{busy === "redo" ? <Spinner /> : <RotateCcw className="h-4 w-4" />}Refazer</button>
                <button className="btn-secondary py-3" disabled={!!busy} onClick={() => { setWriting(true); setNote(f.reviewStatus === "changes" ? f.reviewNote ?? "" : ""); }}><MessageSquareText className="h-4 w-4" />Escrever alterações</button>
              </div>
            )
          ) : !f.resultFileId ? (
            <p className="mt-auto text-[13px] text-zinc-500">Este flyer ainda está sendo gerado.</p>
          ) : null}
        </aside>
      </div>

      {/* miniaturas */}
      <div className="thin-scroll mt-5 flex gap-3 overflow-x-auto pb-2">
        {flyers.map((x, k) => (
          <button key={x.id} onClick={() => go(k)} className={cn("relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-zinc-100", k === i ? "border-zinc-900" : "border-transparent opacity-80 hover:opacity-100")} aria-label={`Ver ${x.name}`}>
            {x.resultFileId ? <img src={`/api/files/${x.resultFileId}`} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] text-zinc-400">sem arte</span>}
            <span className={cn("absolute inset-x-1 bottom-1 truncate rounded px-1 text-[9px] font-medium", REVIEW_BADGE[x.reviewStatus])}>{REVIEW_LABEL[x.reviewStatus]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
