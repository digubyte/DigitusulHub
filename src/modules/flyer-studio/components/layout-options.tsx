"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Sparkles, Info } from "lucide-react";
import { api, Field, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/core/util";
import { CATEGORIES } from "../domain/brand";
import { FORMATS } from "../domain/formats";
import type { CategoryKey, LayoutOptions } from "../domain/types";
import { applySuggestion, type CompositionSuggestion } from "../ai/suggestion";
import type { StudioContext } from "./studio-types";

export function defaultLayout(category: CategoryKey = "promocional"): LayoutOptions {
  return { category, headline: CATEGORIES.find((c) => c.key === category)!.defaultHeadline, subheadline: "", footerText: "", showMascot: false, mascotFileId: null, logoPosition: "footer", backgroundColor: null, style: "default", emphasis: "price", bodyText: "" };
}

/** Miniaturas que comunicam a proposta visual de cada categoria. */
const CATEGORY_SWATCH: Record<CategoryKey, string> = {
  novidade: "bg-white ring-1 ring-zinc-200 [background-image:radial-gradient(circle_at_85%_10%,rgba(35,65,193,.18)_0_38%,transparent_39%)]",
  promocional: "bg-brand-600 [background-image:linear-gradient(170deg,transparent_55%,rgba(255,255,255,.12)_55%)]",
  reposicao: "bg-zinc-100 [background-image:linear-gradient(#2341C1_0_30%,transparent_30%)]",
  queima: "bg-white [background-image:linear-gradient(#E61F27_0_34%,transparent_34%)]",
  blackfriday: "bg-[#0A0D14] [background-image:radial-gradient(circle_at_0_0,rgba(230,31,39,.45)_0_35%,transparent_36%)]",
  institucional: "bg-white [background-image:linear-gradient(#2341C1_0_26%,transparent_26%_86%,#2341C1_86%)]",
};

export function CategoryPicker({ value, onChange }: { value: CategoryKey; onChange: (c: CategoryKey) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3" role="radiogroup" aria-label="Tipo de flyer">
      {CATEGORIES.map((c) => (
        <button key={c.key} role="radio" aria-checked={value === c.key} onClick={() => onChange(c.key)}
          className={cn("rounded-xl border p-3 text-left transition", value === c.key ? "border-brand-600 ring-2 ring-brand-600/20" : "border-zinc-200 hover:border-brand-300")}>
          <div className={cn("mb-2 h-16 rounded-lg", CATEGORY_SWATCH[c.key])} />
          <p className="text-sm font-bold">{c.label}</p>
          <p className="text-xs text-ink-muted">{c.description}</p>
        </button>
      ))}
    </div>
  );
}

export function FormatPicker({ formatKey, width, height, onChange }: { formatKey: string; width: number; height: number; onChange: (f: { formatKey: string; width: number; height: number }) => void }) {
  const current = FORMATS.find((f) => f.key === formatKey)!;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Formato">
        {FORMATS.map((f) => {
          const r = f.width / f.height;
          const box = r >= 1 ? { w: 44, h: 44 / r } : { w: 44 * r, h: 44 };
          return (
            <button key={f.key} role="radio" aria-checked={formatKey === f.key} onClick={() => onChange({ formatKey: f.key, width: f.width, height: f.height })}
              className={cn("flex items-center gap-3 rounded-xl border p-3 text-left", formatKey === f.key ? "border-brand-600 ring-2 ring-brand-600/20" : "border-zinc-200 hover:border-brand-300")}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center"><div className="rounded-sm bg-brand-100 ring-1 ring-brand-300" style={{ width: box.w, height: Math.max(8, box.h) }} /></div>
              <div className="min-w-0"><p className="text-sm font-semibold leading-tight">{f.label}</p><p className="text-[11px] text-ink-muted">{f.hint}</p></div>
            </button>
          );
        })}
      </div>
      {current.customizable && (
        <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
          <Field label="Largura (px)"><input type="number" min={200} max={6000} className="input" value={width} onChange={(e) => onChange({ formatKey, width: Number(e.target.value), height })} /></Field>
          <Field label="Altura (px)"><input type="number" min={200} max={6000} className="input" value={height} onChange={(e) => onChange({ formatKey, width, height: Number(e.target.value) })} /></Field>
        </div>
      )}
    </div>
  );
}

/** "Criar com IA": interpreta o pedido e aplica somente parâmetros visuais. */
export function AiComposer({ ctx, layout, productNames, onApply }: { ctx: StudioContext; layout: LayoutOptions; productNames: string[]; onApply: (l: LayoutOptions, s: CompositionSuggestion) => void }) {
  const toast = useToast();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ s: CompositionSuggestion; fallback: string | null } | null>(null);
  if (!ctx.perms.ai) return null;
  async function run() {
    setBusy(true);
    try {
      const r = await api<{ suggestion: CompositionSuggestion; fallbackReason: string | null }>("/api/flyers/ai/compose", { method: "POST", json: { prompt, productNames } });
      setResult({ s: r.suggestion, fallback: r.fallbackReason });
      onApply(applySuggestion(layout, r.suggestion), r.suggestion);
      toast.success("Sugestão aplicada. Produtos e preços não foram alterados.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-600" /><p className="font-semibold">Criar com IA</p>
        <span className={cn("badge ml-auto", ctx.aiEnabled ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500")}>{ctx.aiEnabled ? "IA ativa" : "Modo regras (IA não configurada)"}</span>
      </div>
      <textarea className="input min-h-[76px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex.: Flyer promocional minimalista, fundo azul, preços destacados e logotipo no rodapé." />
      <div className="mt-2 flex items-start gap-2">
        <p className="flex flex-1 gap-1 text-[11px] text-ink-muted"><Info className="mt-0.5 h-3 w-3 shrink-0" />A IA escolhe categoria, formato, chamadas, fundo e hierarquia. Ela nunca cria ou altera códigos, nomes ou preços.</p>
        <button className="btn-primary btn-sm" onClick={run} disabled={busy || prompt.trim().length < 3}>{busy ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}Aplicar</button>
      </div>
      {result && (
        <ul className="mt-3 space-y-1 border-t border-brand-100 pt-2 text-xs text-ink-soft">
          {result.fallback && <li className="text-amber-700">{result.fallback}</li>}
          {result.s.notes.map((n, i) => <li key={i}>• {n}</li>)}
          {result.s.formatKey && <li>• Formato sugerido: {FORMATS.find((f) => f.key === result.s.formatKey)?.label}</li>}
        </ul>
      )}
    </div>
  );
}

export function LayoutOptionsForm({ ctx, layout, onChange }: { ctx: StudioContext; layout: LayoutOptions; onChange: (l: LayoutOptions) => void }) {
  const set = (p: Partial<LayoutOptions>) => onChange({ ...layout, ...p });
  const phrases = ctx.brandKit.approvedPhrases.filter((p) => p.category === "geral" || p.category === layout.category);
  const mascots = ctx.brandKit.mascots;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Título / chamada principal" className="sm:col-span-2"><input className="input" maxLength={80} value={layout.headline} onChange={(e) => set({ headline: e.target.value })} /></Field>
      <Field label="Subtítulo (opcional)" className="sm:col-span-2"><input className="input" maxLength={160} value={layout.subheadline ?? ""} onChange={(e) => set({ subheadline: e.target.value })} /></Field>
      {layout.category === "institucional" && (
        <Field label="Texto do comunicado" className="sm:col-span-2"><textarea className="input min-h-[90px]" maxLength={1200} value={layout.bodyText ?? ""} onChange={(e) => set({ bodyText: e.target.value })} /></Field>
      )}
      <Field label="Frase do rodapé" className="sm:col-span-2" hint={phrases.length ? "Escolha uma frase aprovada ou escreva a sua." : "Cadastre frases aprovadas no Brand Kit para sugeri-las aqui."}>
        <input className="input" list="approved-phrases" maxLength={120} value={layout.footerText ?? ""} onChange={(e) => set({ footerText: e.target.value })} />
        <datalist id="approved-phrases">{phrases.map((p, i) => <option key={i} value={p.text} />)}</datalist>
      </Field>
      <Field label="Logotipo">
        <select className="input" value={layout.logoPosition} onChange={(e) => set({ logoPosition: e.target.value as LayoutOptions["logoPosition"] })}>
          <option value="footer">No rodapé</option><option value="header">No topo</option>
        </select>
      </Field>
      <Field label="Destaque">
        <select className="input" value={layout.emphasis} onChange={(e) => set({ emphasis: e.target.value as LayoutOptions["emphasis"] })}>
          <option value="price">Preço em destaque</option><option value="product">Produto em destaque</option>
        </select>
      </Field>
      <Field label="Estilo">
        <select className="input" value={layout.style} onChange={(e) => set({ style: e.target.value as LayoutOptions["style"] })}>
          <option value="default">Completo (com grafismos)</option><option value="minimal">Minimalista</option>
        </select>
      </Field>
      <Field label="Cor de fundo">
        <div className="flex gap-2">
          <select className="input" value={layout.backgroundColor ?? ""} onChange={(e) => set({ backgroundColor: e.target.value || null })}>
            <option value="">Padrão da categoria</option>
            {ctx.brandKit.colors.map((c) => <option key={c.key} value={c.hex}>{c.name}</option>)}
          </select>
          {layout.backgroundColor && <span className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-zinc-200" style={{ background: layout.backgroundColor }} />}
        </div>
      </Field>
      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={layout.showMascot} disabled={!mascots.length} onChange={(e) => set({ showMascot: e.target.checked, mascotFileId: layout.mascotFileId ?? mascots[0]?.fileId ?? null })} />
          Incluir o mascote Digu {!mascots.length && <span className="text-xs font-normal text-ink-muted">(nenhum arquivo oficial cadastrado no Brand Kit)</span>}
        </label>
        {layout.showMascot && mascots.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {mascots.map((m) => (
              <button key={m.fileId} onClick={() => set({ mascotFileId: m.fileId })} className={cn("h-16 w-16 rounded-lg border bg-white p-1", layout.mascotFileId === m.fileId ? "border-brand-600 ring-2 ring-brand-600/20" : "border-zinc-200")} title={m.name}>
                <img src={m.url} alt={m.name} className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
