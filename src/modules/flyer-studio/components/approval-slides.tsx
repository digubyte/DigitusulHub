"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, MessageSquareText, PartyPopper, RotateCcw } from "lucide-react";
import { api, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/core/util";
import { formatPrice } from "../domain/product-format";
import { CallClaudeButton } from "./call-claude";
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

const STACK = 3; // quantos flyers aparecem empilhados (o da frente + 2 atrás)
const EXIT_MS = 380;

/**
 * Aprovação no estilo stories: o flyer da vez aparece inteiro à esquerda, com os próximos
 * empilhados atrás e desfocados. Ao decidir (aprovar, refazer ou alterar), ele sai da fila.
 * Aprovados entram na fila de conversas do ChatGPT a apagar.
 */
export function ApprovalSlides({ batchId, title, flyers: initial }: { batchId: string; title: string; flyers: ApprovalFlyer[] }) {
  const toast = useToast();
  const [flyers, setFlyers] = useState(initial);
  const queue = useMemo(() => flyers.filter((f) => f.resultFileId && f.reviewStatus === "pending"), [flyers]);
  const [pos, setPos] = useState(0);
  const [leaving, setLeaving] = useState<{ id: string; status: ReviewStatus } | null>(null);
  const [busy, setBusy] = useState<ReviewStatus | null>(null);
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState("");

  const i = queue.length ? Math.min(pos, queue.length - 1) : 0;
  const current = queue[i];
  const approved = flyers.filter((x) => x.reviewStatus === "approved").length;
  const asked = flyers.filter((x) => x.reviewStatus === "redo" || x.reviewStatus === "changes");
  const waitingArt = flyers.filter((x) => !x.resultFileId).length;

  const go = useCallback((d: number) => {
    if (!queue.length) return;
    setPos((p) => (Math.min(p, queue.length - 1) + d + queue.length) % queue.length);
    setWriting(false); setNote("");
  }, [queue.length]);

  async function decide(status: ReviewStatus, text?: string) {
    if (!current || busy) return;
    setBusy(status);
    try {
      await api(`/api/flyers/${current.id}/review`, { method: "POST", json: { status, note: text ?? null } });
      setLeaving({ id: current.id, status });
      const id = current.id;
      setTimeout(() => {
        setFlyers((all) => all.map((x) => (x.id === id ? { ...x, reviewStatus: status, reviewNote: status === "approved" ? null : text ?? null } : x)));
        setLeaving(null);
        setWriting(false); setNote("");
      }, EXIT_MS);
      toast.success(status === "approved" ? "Aprovado. A conversa no ChatGPT entra na fila para ser apagada." : status === "redo" ? "Vai ser refeito." : "Alterações registradas.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || !current?.canEdit) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key.toLowerCase() === "a") decide("approved");
      else if (e.key.toLowerCase() === "r") decide("redo");
      else if (e.key.toLowerCase() === "e") { e.preventDefault(); setWriting(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ordem de exibição: o atual na frente, depois os próximos (circular)
  const stack = queue.length ? Array.from({ length: Math.min(STACK, queue.length) }, (_, d) => queue[(i + d) % queue.length]) : [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={`/estudio/lote/${batchId}`} className="btn-icon btn-ghost -ml-2" aria-label="Voltar ao lote"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Aprovar flyers</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="badge bg-zinc-100 px-2 py-1 text-zinc-700">{queue.length} para aprovar</span>
          <span className="badge bg-emerald-50 px-2 py-1 text-emerald-700">{approved} aprovados</span>
          {asked.length > 0 && <span className="badge bg-amber-50 px-2 py-1 text-amber-700">{asked.length} para refazer</span>}
        </div>
      </div>

      {current ? (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* pilha estilo stories */}
          <div className="relative" style={{ height: "var(--stage-h)", ["--stage-h" as string]: "min(80vh, 880px, 140vw)" }}>
            {stack.slice().reverse().map((f) => {
              const d = stack.indexOf(f);
              const out = leaving?.id === f.id;
              return (
                <div key={f.id}
                  className="absolute left-0 top-0 h-full transition-all ease-out"
                  style={{
                    aspectRatio: "2 / 3",
                    transitionDuration: `${EXIT_MS}ms`,
                    zIndex: 10 - d,
                    transform: out
                      ? `translateX(${leaving!.status === "approved" ? "-115%" : "-60%"}) rotate(-5deg)`
                      : `translateX(${d * 16}%) scale(${1 - d * 0.08})`,
                    transformOrigin: "left center",
                    filter: d === 0 ? "none" : `blur(${2 + d * 2}px) brightness(${1 - d * 0.18})`,
                    opacity: out ? 0 : 1 - d * 0.2,
                  }}
                  onClick={() => d > 0 && go(d)}
                  role={d > 0 ? "button" : undefined}
                  aria-label={d > 0 ? `Ver ${f.name}` : undefined}
                >
                  <div className={cn("h-full w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10", d > 0 && "cursor-pointer")} style={{ background: "#0b1020" }}>
                    <img src={`/api/files/${f.resultFileId}`} alt={d === 0 ? `Arte de ${f.name}` : ""} className="h-full w-full object-contain" draggable={false} />
                  </div>
                  {d === 0 && (
                    <div className="absolute inset-x-0 top-0 flex gap-1 p-3">
                      {queue.map((q, k) => <span key={q.id} className={cn("h-1 flex-1 rounded-full", k === i ? "bg-white" : "bg-white/35")} />)}
                    </div>
                  )}
                </div>
              );
            })}
            {queue.length > 1 && (
              <>
                <button className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white backdrop-blur hover:bg-black/60" onClick={() => go(-1)} aria-label="Anterior"><ChevronLeft className="h-5 w-5" /></button>
                <button className="absolute top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white backdrop-blur hover:bg-black/60" style={{ left: "calc(var(--stage-h) * 2 / 3 - 3rem)" }} onClick={() => go(1)} aria-label="Próximo"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
          </div>

          {/* painel */}
          <aside className="card flex flex-col gap-4 p-5 lg:sticky lg:top-20">
            <div>
              <p className="text-xs text-zinc-500">{i + 1} de {queue.length}</p>
              <h2 className="mt-0.5 text-lg font-semibold leading-snug">{current.name}</h2>
            </div>
            <ul className="space-y-1.5 text-[13px]">
              {current.products.map((p) => (
                <li key={p.id} className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1">{p.name} <span className="text-zinc-400">· {p.code}</span></span>
                  <span className="font-medium tabular-nums">{formatPrice(p.priceCents ?? 0)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-zinc-500">Confira se nome, código e preço na arte estão iguais à lista.</p>

            {!current.canEdit ? <p className="text-[13px] text-zinc-500">Só o responsável pelo lote pode aprovar.</p>
              : writing ? (
                <div className="space-y-2">
                  <textarea autoFocus className="input min-h-[130px] text-sm" placeholder="Ex.: aumentar o preço do mouse, trocar o fundo para azul…" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button className="btn-accent flex-1" disabled={!note.trim() || !!busy} onClick={() => decide("changes", note.trim())}>{busy === "changes" ? <Spinner /> : <MessageSquareText className="h-4 w-4" />}Enviar alterações</button>
                    <button className="btn-ghost" onClick={() => { setWriting(false); setNote(""); }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <button className="btn bg-emerald-600 py-3 text-white hover:bg-emerald-700" disabled={!!busy || !!leaving} onClick={() => decide("approved")}>{busy === "approved" ? <Spinner /> : <Check className="h-4 w-4" />}Aprovar <kbd className="ml-auto rounded bg-white/20 px-1.5 text-[11px]">A</kbd></button>
                  <button className="btn-secondary py-3" disabled={!!busy || !!leaving} onClick={() => decide("redo")}>{busy === "redo" ? <Spinner /> : <RotateCcw className="h-4 w-4" />}Refazer <kbd className="ml-auto rounded bg-zinc-100 px-1.5 text-[11px] text-zinc-500">R</kbd></button>
                  <button className="btn-secondary py-3" disabled={!!busy || !!leaving} onClick={() => setWriting(true)}><MessageSquareText className="h-4 w-4" />Escrever alterações <kbd className="ml-auto rounded bg-zinc-100 px-1.5 text-[11px] text-zinc-500">E</kbd></button>
                </div>
              )}
          </aside>
        </div>
      ) : (
        <div className="card mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-6 py-12 text-center">
          <PartyPopper className="h-8 w-8 text-emerald-600" />
          <h2 className="text-xl font-semibold">{waitingArt ? "Nada para aprovar agora" : "Tudo revisado"}</h2>
          <p className="text-sm text-zinc-500">
            {approved} aprovado{approved === 1 ? "" : "s"}
            {asked.length ? ` · ${asked.length} voltam para o ChatGPT com seus pedidos` : ""}
            {waitingArt ? ` · ${waitingArt} ainda sem arte` : ""}.
          </p>
          {asked.length > 0 && (
            <ul className="mt-2 w-full space-y-1.5 text-left text-[13px]">
              {asked.map((f) => (
                <li key={f.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                  <span className={cn("badge mr-2", REVIEW_BADGE[f.reviewStatus])}>{REVIEW_LABEL[f.reviewStatus]}</span>{f.name}
                  {f.reviewNote && <p className="mt-1 text-zinc-500">{f.reviewNote}</p>}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {asked.length > 0 && <CallClaudeButton prompt={`/gerar-flyers lote ${batchId}`} label="Refazer com o Claude" />}
            <Link href={`/estudio/lote/${batchId}`} className="btn-primary">Ver o lote e baixar</Link>
          </div>
          {approved > 0 && <p className="text-[12px] text-zinc-500">As conversas dos aprovados são apagadas do ChatGPT na próxima vez que o Claude rodar.</p>}
        </div>
      )}
    </div>
  );
}
