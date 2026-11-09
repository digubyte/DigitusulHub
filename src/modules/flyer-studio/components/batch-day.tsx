"use client";
/* eslint-disable @next/next/no-img-element */
import { useMemo, useRef, useState } from "react";
import { Check, Dices, Layers, RotateCcw, Search, Tag, Wand2, X } from "lucide-react";
import { api, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/core/util";
import { CATEGORIES, SITE_LOGO } from "../domain/brand";
import { FORMATS, getFormat } from "../domain/formats";
import { formatPrice } from "../domain/product-format";
import { describeRule } from "../domain/pricing";
import { buildChatGptPrompt } from "../domain/chatgpt-prompt";
import { similarity } from "../domain/batch-plan";
import type { CategoryKey, LayoutOptions, Product } from "../domain/types";
import { defaultLayout } from "./layout-options";
import { brandFromContext, type StudioContext } from "./studio-types";
import type { ChatGptFlyer } from "./chatgpt-flyer";
import { ChatGptBatchView } from "./chatgpt-views";
import { FlyersHeader } from "./flyers-header";
import { Chips, Section } from "./create-flyers";

interface Spare { code: string; name: string; imageUrl: string | null; finalPriceCents: number }
interface Group { theme: string; products: Product[] }
const MAIN_FORMATS = ["ig-stories", "ig-feed", "ig-square"];

/**
 * Lote do dia: escolhe uma categoria (ou palavra) do site, a plataforma separa os
 * produtos por afinidade nos flyers (ex.: 3 com 6 produtos e 3 com 1) e entrega um
 * prompt pronto por flyer, com o logo e as fotos como imagens de referência.
 */
export function BatchDay({ ctx }: { ctx: StudioContext }) {
  const toast = useToast();
  const [source, setSource] = useState<"categoria" | "palavra">("categoria");
  const [category, setCategory] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [term, setTerm] = useState("");
  const [multiCount, setMultiCount] = useState(3);
  const [multiSize, setMultiSize] = useState(6);
  const [singleCount, setSingleCount] = useState(3);
  const [formatKey, setFormatKey] = useState("ig-stories");
  const [layout, setLayout] = useState<LayoutOptions>(defaultLayout());
  const [extra, setExtra] = useState("");
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [spare, setSpare] = useState<Spare[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ChatGptFlyer[] | null>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const sizes = useMemo(() => [...Array(multiCount).fill(multiSize), ...Array(singleCount).fill(1)] as number[], [multiCount, multiSize, singleCount]);
  const total = sizes.reduce((a, b) => a + b, 0);
  const catLabel = ctx.siteCategories.find((c) => c.slug === category)?.label ?? "";
  const segment = source === "categoria" ? catLabel : term.trim();
  const fold = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const cats = ctx.siteCategories.filter((c) => !catFilter.trim() || fold(c.label).includes(fold(catFilter.trim())));
  const fmt = getFormat(formatKey)!;
  const cat = CATEGORIES.find((c) => c.key === layout.category)!;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  function setStyle(c: CategoryKey) {
    const prev = CATEGORIES.find((x) => x.key === layout.category)?.defaultHeadline;
    setLayout({ ...layout, category: c, headline: !layout.headline || layout.headline === prev ? CATEGORIES.find((x) => x.key === c)!.defaultHeadline : layout.headline });
  }

  const build = () => run("plan", async () => {
    if (source === "categoria" && !category) { toast.error("Escolha uma categoria do site."); return; }
    if (source === "palavra" && term.trim().length < 2) { toast.error("Digite uma palavra-chave."); return; }
    const r = await api<{ flyers: Group[]; spare: Spare[]; found: number; imageErrors: string[] }>("/api/catalog", {
      method: "POST",
      json: { action: "batch-plan", sizes, ...(source === "categoria" ? { category } : { term: term.trim() }) },
    });
    setGroups(r.flyers.map((f) => ({ theme: f.theme, products: f.products })));
    setSpare(r.spare);
    setResult(null);
    const got = r.flyers.reduce((s, f) => s + f.products.length, 0);
    if (got < total) toast.info(`Só ${got} produtos com foto e estoque nessa busca; alguns flyers ficaram menores.`);
    else toast.success(`${r.flyers.length} flyers montados com ${got} produtos (de ${r.found} encontrados).`);
    setTimeout(() => planRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  });

  /** Troca um produto pelo reserva mais parecido com o resto do flyer. */
  const swap = (gi: number, pi: number) => run(`swap-${gi}-${pi}`, async () => {
    if (!groups) return;
    const g = groups[gi];
    const others = g.products.filter((_, i) => i !== pi);
    const ref = others.length ? others : [g.products[pi]];
    const ranked = [...spare].sort((a, b) =>
      ref.reduce((s, p) => s + similarity(b.name, p.name), 0) - ref.reduce((s, p) => s + similarity(a.name, p.name), 0));
    const pick = ranked[0];
    if (!pick) { toast.info("Não há mais produtos reservas nessa busca."); return; }
    const r = await api<{ products: Product[] }>("/api/catalog", { method: "POST", json: { action: "import", codes: [pick.code] } });
    const np = r.products[0];
    if (!np) return;
    setSpare((s) => s.filter((x) => x.code !== pick.code));
    setGroups((gs) => gs!.map((x, i) => (i !== gi ? x : { ...x, products: x.products.map((p, j) => (j === pi ? np : p)) })));
  });

  const remove = (gi: number, pi: number) => setGroups((gs) => gs!.map((x, i) => (i !== gi ? x : { ...x, products: x.products.filter((_, j) => j !== pi) })));

  const generate = () => run("generate", async () => {
    if (!groups) return;
    const valid = groups.filter((g) => g.products.length > 0);
    const brand = brandFromContext(ctx, layout.mascotFileId);
    const hasMascot = layout.showMascot && ctx.brandKit.mascots.length > 0;
    const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date());
    const base = `${segment || cat.label} · ${date}`;
    const drafts = valid.map((g, i) => ({
      name: `${base} · ${i + 1}/${valid.length}${g.products.length === 1 ? " (destaque)" : ""}`,
      products: g.products,
      prompt: buildChatGptPrompt({
        category: layout.category, formatKey, width: fmt.width, height: fmt.height, headline: layout.headline, subheadline: layout.subheadline, footerText: layout.footerText,
        segment: segment || undefined, products: g.products, colors: brand.colors, fonts: brand.fonts, emphasis: layout.emphasis,
        hasLogo: true, logoUrl: ctx.brandKit.logo ? undefined : SITE_LOGO.siteUrl, hasMascot, theme: g.theme,
        extraInstructions: extra, batch: valid.length > 1 ? { index: i, total: valid.length } : undefined,
      }),
    }));
    const r = await api<{ ids: string[] }>("/api/flyers/chatgpt", {
      method: "POST",
      json: { campaign: segment || null, formatKey, width: fmt.width, height: fmt.height, layoutConfig: layout, flyers: drafts },
    });
    setResult(drafts.map((d, i) => ({ id: r.ids[i], name: d.name, products: d.products, prompt: d.prompt, resultFileId: null, width: fmt.width, height: fmt.height, formatKey, canEdit: true, layout })));
    toast.success(`${drafts.length} prompts prontos e salvos no histórico.`);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  });

  function restart() {
    setGroups(null); setSpare([]); setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const num = (v: number, set: (n: number) => void, min: number, max: number, label: string) => (
    <input type="number" min={min} max={max} aria-label={label} className="input w-16 text-center" value={v} onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || min)))} />
  );

  return (
    <div className="space-y-6">
      <div className="-mb-2"><FlyersHeader active="lote" subtitle={`Os flyers do dia de uma vez · ${describeRule(ctx.pricingRule).toLowerCase()} · nunca usa o valor PIX`} /></div>

      <Section n={1} title="O que vai no lote" subtitle="Escolha a categoria do site (ou uma palavra) e quantos flyers de cada tipo.">
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3">
            <div className="flex gap-0.5 self-start rounded-lg bg-zinc-100 p-0.5">
              {([["categoria", "Categoria do site", Tag], ["palavra", "Palavra-chave", Search]] as const).map(([k, l, I]) => (
                <button key={k} onClick={() => setSource(k)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium", source === k ? "bg-surface text-ink shadow-card" : "text-zinc-500 hover:text-ink")}><I className="h-3.5 w-3.5" />{l}</button>
              ))}
            </div>
            {source === "categoria" ? (
              <div className="space-y-2">
                {catLabel ? (
                  <div className="flex items-center gap-2 rounded-xl border border-brand-300 bg-brand-50 px-3 py-2">
                    <Check className="h-4 w-4 shrink-0 text-brand-600" />
                    <p className="flex-1 text-sm"><span className="text-zinc-500">Categoria:</span> <strong className="text-brand-700">{catLabel}</strong></p>
                    <button className="btn-ghost btn-sm" onClick={() => { setCategory(""); setCatFilter(""); }}>Trocar</button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input className="input pl-9" placeholder="Buscar categoria (ex.: mouse, limpeza, papel)" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Buscar categoria do site" />
                    </div>
                    <div className="thin-scroll flex max-h-52 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-zinc-200 p-2" role="listbox" aria-label="Categorias do site">
                      {cats.map((c) => (
                        <button key={c.slug} type="button" role="option" aria-selected={category === c.slug} onClick={() => setCategory(c.slug)}
                          className="rounded-lg border border-zinc-200 bg-surface px-2.5 py-1 text-[13px] text-zinc-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
                          {c.label}
                        </button>
                      ))}
                      {cats.length === 0 && <p className="p-2 text-xs text-zinc-500">Nenhuma categoria com esse nome. Tente a aba “Palavra-chave”.</p>}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <input className="input" placeholder="Ex.: gamer, limpeza, caderno, toner" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && build()} />
                <p className="text-xs text-zinc-500">Busca pelo nome dos produtos no site, na ordem de relevância da busca.</p>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
            <p className="text-sm font-medium">Flyers do dia</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">{num(multiCount, setMultiCount, 0, 6, "Quantidade de flyers com vários produtos")}<span>flyers com</span>{num(multiSize, setMultiSize, 2, 12, "Produtos por flyer")}<span>produtos</span></div>
            <div className="flex flex-wrap items-center gap-2 text-sm">{num(singleCount, setSingleCount, 0, 6, "Quantidade de flyers de destaque")}<span>flyers de destaque (1 produto)</span></div>
            <p className="text-xs text-zinc-500">Total: {sizes.length} flyers · {total} produtos. Os destaques são os produtos de maior valor entre os mais relevantes; os outros são agrupados pelo que têm em comum.</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <Chips label="Formato" value={formatKey} onChange={setFormatKey} options={[...FORMATS.filter((f) => MAIN_FORMATS.includes(f.key)), ...FORMATS.filter((f) => !MAIN_FORMATS.includes(f.key) && !f.customizable)].map((f) => ({ value: f.key, label: f.label.replace("Instagram ", "").replace(/^./, (c) => c.toUpperCase()), hint: f.hint }))} />
          <Chips label="Estilo" value={layout.category} onChange={(v) => setStyle(v as CategoryKey)} options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">Título dos flyers</span><input className="input" maxLength={80} value={layout.headline} onChange={(e) => setLayout({ ...layout, headline: e.target.value })} /></label>
            <label><span className="label">Instruções extras (opcional)</span><input className="input" maxLength={1500} placeholder="Ex.: clima de setup gamer, luzes neon" value={extra} onChange={(e) => setExtra(e.target.value)} /></label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-accent h-11 px-5 text-[15px]" onClick={build} disabled={!!busy || sizes.length === 0}>{busy === "plan" ? <Spinner /> : <Layers className="h-4 w-4" />}{groups ? "Montar de novo" : "Montar lote"}</button>
          {busy === "plan" && <span className="text-xs text-zinc-500">Buscando no site e baixando as fotos… pode levar alguns segundos.</span>}
        </div>
      </Section>

      {groups && (
        <div ref={planRef} className="scroll-mt-20">
          <Section n={2} title="Confira o lote" subtitle="Troque (dado) ou remova o que não fizer sentido. Os preços já estão com a regra aplicada."
            aside={<span className="text-xs text-zinc-500">{spare.length} produtos reservas</span>}>
            <div className="grid gap-3 lg:grid-cols-2">
              {groups.map((g, gi) => (
                <div key={gi} className={cn("rounded-xl border border-zinc-200", g.products.length === 1 && "lg:col-span-1")}>
                  <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-[11px] font-semibold text-brand-700">{gi + 1}</span>
                    <p className="flex-1 text-sm font-medium">{g.products.length === 1 ? "Destaque" : `${g.products.length} produtos`}{g.theme && g.products.length > 1 ? <span className="font-normal text-zinc-500"> · {g.theme}</span> : null}</p>
                  </div>
                  <ul className="divide-y divide-zinc-100">
                    {g.products.map((p, pi) => (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">{p.imageFileId ? <img src={`/api/files/${p.imageFileId}`} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[9px] text-zinc-400">sem foto</span>}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{p.name}</p>
                          <p className="text-xs text-zinc-500">Cód. {p.code}</p>
                        </div>
                        <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-brand-700">{formatPrice(p.priceCents ?? 0)}</span>
                        <button className="btn-icon btn-ghost h-7 w-7" title="Trocar por outro parecido" aria-label="Trocar produto" onClick={() => swap(gi, pi)} disabled={!!busy}>{busy === `swap-${gi}-${pi}` ? <Spinner /> : <Dices className="h-3.5 w-3.5" />}</button>
                        <button className="btn-icon btn-ghost h-7 w-7" title="Remover" aria-label="Remover produto" onClick={() => remove(gi, pi)} disabled={!!busy}><X className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                    {g.products.length === 0 && <li className="px-3 py-4 text-center text-xs text-zinc-500">Flyer vazio: ele será ignorado.</li>}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button className="btn-accent h-11 px-5 text-[15px]" onClick={generate} disabled={!!busy || !groups.some((g) => g.products.length)}>
                {busy === "generate" ? <Spinner /> : <Wand2 className="h-4 w-4" />}Aprovar e gerar {groups.filter((g) => g.products.length).length} prompts
              </button>
              <span className="text-xs text-zinc-500">{fmt.label} {fmt.width}×{fmt.height} · {cat.label} · logo e fotos vão como imagens de referência</span>
            </div>
          </Section>
        </div>
      )}

      {result && (
        <div ref={resultRef} className="scroll-mt-20">
          <Section n={3} title="Prompts prontos" subtitle="Em cada flyer: baixe as imagens (logo + produtos), clique em Copiar e abrir, arraste as imagens no ChatGPT, cole o prompt e envie."
            aside={<button className="btn-ghost btn-sm" onClick={restart}><RotateCcw className="h-3.5 w-3.5" />Novo lote</button>}>
            <ChatGptBatchView ctx={ctx} flyers={result} campaign={null} embedded />
          </Section>
        </div>
      )}
    </div>
  );
}
