"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Shuffle, Search, Sparkles } from "lucide-react";
import { api, Modal, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { formatPrice } from "../domain/product-format";
import { describeRule } from "../domain/pricing";
import type { Product } from "../domain/types";
import type { StudioContext } from "./studio-types";
import { cn } from "@/core/util";

interface Preview { code: string; name: string; cardPriceCents: number; finalPriceCents: number; imageUrl: string | null; url: string; stock: number }
type Tab = "random" | "codes" | "ai";

/** Importação de produtos do site (sorteio, códigos ou busca com IA). Preços são recalculados no servidor na importação. */
export function CatalogImportModal({ open, onClose, ctx, existing, room, onImport }: { open: boolean; onClose: () => void; ctx: StudioContext; existing: string[]; room: number; onImport: (p: Product[]) => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("random");
  const [count, setCount] = useState(6);
  const [category, setCategory] = useState("");
  const [codes, setCodes] = useState("");
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<Preview[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function search() {
    setBusy(true); setNote(null);
    try {
      const body =
        tab === "random" ? { action: "random", count: Math.min(count, Math.max(room, 1)), category: category || undefined, exclude: existing }
        : tab === "codes" ? { action: "codes", codes: codes.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean).slice(0, 24) }
        : { action: "ai-search", prompt };
      const r = await api<{ products: Preview[]; notFound?: string[]; note?: string }>("/api/catalog", { method: "POST", json: body });
      setResults(r.products);
      setSelected(new Set(r.products.filter((p) => !existing.includes(p.code)).slice(0, room).map((p) => p.code)));
      const msgs = [];
      if (r.notFound?.length) msgs.push(`Não encontrados: ${r.notFound.join(", ")}.`);
      if (r.note) msgs.push(r.note);
      if (!r.products.length) msgs.push("Nenhum produto com estoque encontrado.");
      setNote(msgs.join(" ") || null);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function doImport() {
    setImporting(true);
    try {
      const r = await api<{ products: Product[]; notFound: string[]; imageErrors: string[] }>("/api/catalog", { method: "POST", json: { action: "import", codes: [...selected] } });
      onImport(r.products);
      if (r.imageErrors.length) toast.info(`Imagens não baixadas para: ${r.imageErrors.join(", ")}. Envie-as manualmente.`);
      toast.success(`${r.products.length} produto(s) importado(s) do site.`);
      setResults([]); setSelected(new Set()); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setImporting(false); }
  }

  const tabs: { key: Tab; label: string; icon: typeof Shuffle; disabled?: boolean }[] = [
    { key: "random", label: "Sortear", icon: Shuffle },
    { key: "codes", label: "Por códigos", icon: Search },
    { key: "ai", label: "Busca com IA", icon: Sparkles, disabled: !ctx.aiEnabled || !ctx.perms.ai },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Importar produtos do site Digitusul" size="xl" footer={
      <>
        <span className="mr-auto self-center text-xs text-ink-muted">{describeRule(ctx.pricingRule)}. O valor PIX nunca é usado.</span>
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={!selected.size || importing} onClick={doImport}>{importing && <Spinner />}Importar {selected.size || ""} selecionado(s)</button>
      </>
    }>
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((t) => (
          <button key={t.key} disabled={t.disabled} title={t.disabled ? "IA generativa não configurada" : undefined} onClick={() => { setTab(t.key); setResults([]); setNote(null); }}
            className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-40", tab === t.key ? "bg-white text-brand-700 shadow-sm" : "text-ink-muted")}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        {tab === "random" && <>
          <label className="sm:w-28"><span className="label">Quantidade</span><input type="number" min={1} max={24} className="input" value={count} onChange={(e) => setCount(Math.max(1, Math.min(24, Number(e.target.value) || 1)))} /></label>
          <label className="flex-1"><span className="label">Categoria do site (opcional)</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todo o catálogo</option>
              {ctx.siteCategories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </label>
        </>}
        {tab === "codes" && <label className="flex-1"><span className="label">Códigos (separados por espaço, vírgula ou linha)</span><textarea className="input min-h-[70px] font-mono" value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="45839 46246" /></label>}
        {tab === "ai" && <label className="flex-1"><span className="label">O que você procura?</span><input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex.: 10 itens para volta às aulas" /></label>}
        <button className="btn-primary" onClick={search} disabled={busy || (tab === "codes" && !codes.trim()) || (tab === "ai" && prompt.trim().length < 3)}>{busy && <Spinner />}{tab === "random" ? "Sortear" : "Buscar"}</button>
      </div>

      {note && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{note}</p>}

      {results.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {results.map((p) => {
            const dup = existing.includes(p.code);
            const on = selected.has(p.code);
            return (
              <li key={p.code}>
                <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-2.5", on ? "border-brand-500 bg-brand-50/50" : "border-slate-200", dup && "opacity-50")}>
                  <input type="checkbox" className="mt-1" disabled={dup} checked={on} onChange={(e) => { const s = new Set(selected); if (e.target.checked) { if (s.size >= room) return toast.error("Limite de produtos atingido."); s.add(p.code); } else s.delete(p.code); setSelected(s); }} />
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white">{p.imageUrl ? <img src={p.imageUrl} alt="" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" /> : <span className="text-[10px] text-ink-muted">sem imagem</span>}</div>
                  <div className="min-w-0 text-sm">
                    <p className="line-clamp-2 font-semibold leading-tight">{p.name}</p>
                    <p className="text-xs text-ink-muted">Cód. {p.code} · estoque {p.stock}{dup ? " · já adicionado" : ""}</p>
                    <p className="text-xs text-ink-muted">Cartão {formatPrice(p.cardPriceCents)} → <strong className="text-brand-700">{formatPrice(p.finalPriceCents)}</strong></p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
