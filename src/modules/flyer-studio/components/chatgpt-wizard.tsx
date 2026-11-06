"use client";
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Layers, Square, Wrench } from "lucide-react";
import { api, Field, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/core/util";
import { CATEGORIES } from "../domain/brand";
import { getFormat } from "../domain/formats";
import { formatPrice } from "../domain/product-format";
import { buildChatGptPrompt, promptBlockers, splitIntoFlyers } from "../domain/chatgpt-prompt";
import type { CategoryKey, LayoutOptions, Product } from "../domain/types";
import { CategoryPicker, defaultLayout, FormatPicker } from "./layout-options";
import { ProductsEditor } from "./products-editor";
import { brandFromContext, type StudioContext } from "./studio-types";

const STEPS = ["Configuração", "Produtos", "Estilo", "Aprovação"];
const SEGMENTS = ["Gamer", "Limpeza", "Material de escritório", "Informática", "Utilidades", "Papelaria"];

interface Draft { name: string; products: Product[]; prompt: string; edited: boolean }

export function ChatGptWizard({ ctx }: { ctx: StudioContext }) {
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [batch, setBatch] = useState(true);
  const [count, setCount] = useState(6);
  const [segment, setSegment] = useState("");
  const [name, setName] = useState("");
  const [campaign, setCampaign] = useState("");
  const [fmt, setFmt] = useState({ formatKey: "ig-feed", width: 1080, height: 1350 });
  const [layout, setLayout] = useState<LayoutOptions>(defaultLayout());
  const [extra, setExtra] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const flyerCount = batch ? count : 1;
  const groups = useMemo(() => splitIntoFlyers(products, flyerCount), [products, flyerCount]);
  const blockers = promptBlockers(products, layout.category);
  const brand = brandFromContext(ctx, layout.mascotFileId);
  const hasMascot = layout.showMascot && ctx.brandKit.mascots.length > 0;
  const cat = CATEGORIES.find((c) => c.key === layout.category)!;
  const baseName = name.trim() || [cat.label, segment.trim()].filter(Boolean).join(" · ");

  function setCategory(c: CategoryKey) {
    const prevDefault = CATEGORIES.find((x) => x.key === layout.category)?.defaultHeadline;
    setLayout({ ...layout, category: c, headline: !layout.headline || layout.headline === prevDefault ? CATEGORIES.find((x) => x.key === c)!.defaultHeadline : layout.headline });
  }

  function buildDrafts(): Draft[] {
    return groups.map((g, i) => ({
      name: groups.length > 1 ? `${baseName} · ${i + 1}/${groups.length}` : baseName,
      products: g,
      edited: false,
      prompt: buildChatGptPrompt({
        category: layout.category, formatKey: fmt.formatKey, width: fmt.width, height: fmt.height,
        headline: layout.headline, subheadline: layout.subheadline, footerText: layout.footerText, segment: segment.trim() || undefined,
        products: g, colors: brand.colors, fonts: brand.fonts, hasLogo: !!ctx.brandKit.logo, hasMascot, emphasis: layout.emphasis,
        extraInstructions: extra, batch: groups.length > 1 ? { index: i, total: groups.length } : undefined,
      }),
    }));
  }

  function next() {
    if (step === 2) {
      try { setDrafts(buildDrafts()); setOpen(null); } catch (e) { return toast.error((e as Error).message); }
    }
    setStep((s) => s + 1);
  }

  /** O prompt editado precisa manter nome, código e preço exatos (o servidor também confere). */
  const draftIssues = drafts.map((d) => d.products.flatMap((p) => {
    const miss = [];
    if (!d.prompt.includes(formatPrice(p.priceCents ?? 0))) miss.push(`preço de ${p.name}`);
    if (!d.prompt.includes(p.code.trim())) miss.push(`código ${p.code}`);
    if (!d.prompt.includes(p.name.trim())) miss.push(`nome de ${p.name}`);
    return miss;
  }));

  async function approve() {
    setSaving(true);
    try {
      const r = await api<{ ids: string[]; batchId: string | null }>("/api/flyers/chatgpt", {
        method: "POST",
        json: { campaign: campaign.trim() || null, formatKey: fmt.formatKey, width: fmt.width, height: fmt.height, layoutConfig: layout, flyers: drafts.map((d) => ({ name: d.name, products: d.products, prompt: d.prompt })) },
      });
      toast.success(r.ids.length > 1 ? `${r.ids.length} flyers criados. Agora é só gerar no ChatGPT.` : "Flyer criado. Agora é só gerar no ChatGPT.");
      router.push(r.batchId ? `/estudio/lote/${r.batchId}` : `/estudio/${r.ids[0]}`);
    } catch (e) { toast.error((e as Error).message); setSaving(false); }
  }

  const dimsOk = fmt.width >= 200 && fmt.width <= 6000 && fmt.height >= 200 && fmt.height <= 6000;
  const canNext = [dimsOk && !!baseName, blockers.length === 0, !!layout.headline.trim(), true][step];
  const totalProducts = products.length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/estudio" className="btn-icon btn-ghost -ml-2" aria-label="Voltar ao Estúdio"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <p className="eyebrow">Estúdio de Flyers · gerado com ChatGPT</p>
          <h1 className="text-2xl font-semibold tracking-tight">{batch ? `Novo lote de ${count} flyers` : "Novo flyer"}</h1>
        </div>
        <Link href="/estudio/novo?modo=manual" className="btn-ghost btn-sm hidden sm:inline-flex" title="Montar no editor, com preço garantido ao centavo"><Wrench className="h-3.5 w-3.5" />Montar manualmente</Link>
      </div>

      <ol className="mb-8 flex items-center gap-2" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <button disabled={i > step} onClick={() => setStep(i)} className={cn("flex items-center gap-2 text-[13px] font-medium", i === step ? "text-ink" : i < step ? "text-zinc-500 hover:text-ink" : "text-zinc-300")}>
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]", i < step ? "bg-zinc-900 text-white" : i === step ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-400")}>{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-zinc-200" />}
          </li>
        ))}
      </ol>

      <div className="card p-5 sm:p-8">
        {step === 0 && (
          <div className="space-y-8">
            <div>
              <p className="label">O que você quer criar?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[{ v: true, icon: Layers, t: "Lote de flyers", d: "Vários flyers do mesmo segmento de uma vez, com prompts prontos para cada um." }, { v: false, icon: Square, t: "Um flyer", d: "Um único flyer com um ou mais produtos." }].map((o) => (
                  <button key={o.t} onClick={() => setBatch(o.v)} className={cn("flex gap-3 rounded-xl border p-4 text-left transition", batch === o.v ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200 hover:border-zinc-300")}>
                    <o.icon className={cn("mt-0.5 h-5 w-5 shrink-0", batch === o.v ? "text-brand-600" : "text-zinc-400")} />
                    <span><span className="block text-sm font-medium">{o.t}</span><span className="block text-[13px] text-zinc-500">{o.d}</span></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {batch && (
                <Field label="Quantidade de flyers">
                  <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                    {[2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} flyers</option>)}
                  </select>
                </Field>
              )}
              <Field label="Segmento" hint="Ex.: Gamer, Limpeza, Material de escritório" className={batch ? "" : "sm:col-span-2"}>
                <input className="input" list="segments" maxLength={60} value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Gamer" />
                <datalist id="segments">{SEGMENTS.map((s) => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="Campanha (opcional)"><input className="input" maxLength={80} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Semana 45" /></Field>
              <Field label="Nome" hint={`Padrão: ${[cat.label, segment.trim()].filter(Boolean).join(" · ")}`} className="sm:col-span-3"><input className="input" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder={[cat.label, segment.trim()].filter(Boolean).join(" · ")} /></Field>
            </div>
            <div><p className="label">Tipo de flyer</p><CategoryPicker value={layout.category} onChange={setCategory} /></div>
            <div><p className="label">Formato</p><FormatPicker {...fmt} onChange={setFmt} /></div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="max-w-xl text-sm text-zinc-500">
                {batch ? <>Adicione todos os produtos do lote. Eles são divididos em ordem entre os {count} flyers{segment.trim() ? <> de <strong className="text-ink">{segment.trim()}</strong></> : null}; use as setas para mudar a ordem. </> : null}
                Código, nome e preço vão para o prompt <strong className="text-ink">exatamente</strong> como estão aqui.
              </p>
            </div>
            {batch && totalProducts > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g, i) => (
                  <span key={i} className="badge bg-zinc-100 text-zinc-600">Flyer {i + 1}: {g.length} {g.length === 1 ? "produto" : "produtos"}</span>
                ))}
                {totalProducts < count && <span className="badge bg-amber-50 text-amber-700">Com {totalProducts} produto(s) serão criados só {totalProducts} flyer(s)</span>}
              </div>
            )}
            <ProductsEditor ctx={ctx} products={products} onChange={setProducts} />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Título do flyer" className="sm:col-span-2"><input className="input" maxLength={80} value={layout.headline} onChange={(e) => setLayout({ ...layout, headline: e.target.value })} /></Field>
            <Field label="Subtítulo (opcional)"><input className="input" maxLength={160} value={layout.subheadline ?? ""} onChange={(e) => setLayout({ ...layout, subheadline: e.target.value })} /></Field>
            <Field label="Rodapé (opcional)"><input className="input" maxLength={120} value={layout.footerText ?? ""} onChange={(e) => setLayout({ ...layout, footerText: e.target.value })} /></Field>
            <Field label="Destaque">
              <select className="input" value={layout.emphasis} onChange={(e) => setLayout({ ...layout, emphasis: e.target.value as LayoutOptions["emphasis"] })}>
                <option value="price">Preço em destaque</option><option value="product">Produto em destaque</option>
              </select>
            </Field>
            <Field label="Mascote Digu">
              <select className="input" value={hasMascot ? "1" : "0"} disabled={!ctx.brandKit.mascots.length} onChange={(e) => setLayout({ ...layout, showMascot: e.target.value === "1", mascotFileId: layout.mascotFileId ?? ctx.brandKit.mascots[0]?.fileId ?? null })}>
                <option value="0">Sem mascote</option><option value="1">Incluir mascote</option>
              </select>
            </Field>
            <Field label="Instruções extras para o ChatGPT (opcional)" className="sm:col-span-2" hint="Ex.: fundo com luzes neon roxas, clima de setup gamer.">
              <textarea className="input min-h-[96px]" maxLength={1500} value={extra} onChange={(e) => setExtra(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500 sm:col-span-2">
              <span>Logo: {ctx.brandKit.logo ? "vai anexado" : <span className="text-amber-700">não cadastrado no Brand Kit</span>}</span>
              <span>Cores: {Object.values(brand.colors).slice(0, 4).map((c) => <span key={c} className="ml-1 inline-block h-3 w-3 rounded-full align-middle ring-1 ring-zinc-200" style={{ background: c }} />)}</span>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Resumo para aprovação</h2>
              <p className="mt-1 text-sm text-zinc-500">Confira o que vai em cada flyer. Nada é gerado antes de você aprovar.</p>
            </div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 text-sm sm:grid-cols-4">
              {[["Flyers", String(drafts.length)], ["Tipo", cat.label], ["Formato", `${getFormat(fmt.formatKey)?.label} · ${fmt.width}×${fmt.height}`], ["Segmento", segment.trim() || "—"]].map(([k, v]) => (
                <div key={k} className="bg-white p-3"><dt className="text-xs text-zinc-500">{k}</dt><dd className="mt-0.5 truncate font-medium">{v}</dd></div>
              ))}
            </dl>
            <ul className="space-y-3">
              {drafts.map((d, i) => (
                <li key={i} className="rounded-xl border border-zinc-200">
                  <div className="flex items-center gap-3 p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-medium">{i + 1}</span>
                    <input className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" value={d.name} maxLength={120} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Nome do flyer" />
                    <button className="btn-ghost btn-sm" onClick={() => setOpen(open === i ? null : i)}>Prompt<ChevronDown className={cn("h-3.5 w-3.5 transition", open === i && "rotate-180")} /></button>
                  </div>
                  <table className="w-full border-t border-zinc-100 text-[13px]">
                    <tbody>
                      {d.products.map((p) => (
                        <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                          <td className="w-12 py-2 pl-4">{p.imageFileId ? <img src={`/api/files/${p.imageFileId}`} alt="" className="h-8 w-8 rounded object-contain" /> : <span className="block h-8 w-8 rounded bg-zinc-100" />}</td>
                          <td className="py-2 pr-3">{p.name}<span className="ml-2 text-zinc-400">Cód. {p.code}</span></td>
                          <td className="whitespace-nowrap py-2 pr-4 text-right font-medium tabular-nums">{formatPrice(p.priceCents!)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {draftIssues[i]?.length > 0 && <p className="flex gap-1.5 border-t border-zinc-100 px-4 py-2 text-xs text-accent-600"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />O prompt editado perdeu: {draftIssues[i].join(", ")}.</p>}
                  {open === i && (
                    <div className="border-t border-zinc-100 p-4">
                      <textarea className="input min-h-[320px] font-mono text-xs leading-relaxed" value={d.prompt} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, prompt: e.target.value, edited: true } : x)))} />
                      <p className="mt-1.5 text-xs text-zinc-500">Pode editar à vontade, mas mantenha nome, código e preço de cada produto.</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-4 text-[13px] text-zinc-600 sm:flex-row sm:items-center">
              <p className="flex-1">Ao aprovar, os flyers ficam salvos. Em cada um você baixa as imagens, copia o prompt e abre o ChatGPT (site ou app). Depois envia a arte de volta e confere os preços.</p>
              <button className="btn-accent shrink-0" onClick={approve} disabled={saving || draftIssues.some((x) => x.length > 0) || drafts.some((d) => !d.name.trim())}>
                {saving ? <Spinner /> : <Check className="h-4 w-4" />}Aprovar {drafts.length > 1 ? `e criar ${drafts.length} flyers` : "e criar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {step < 3 && (
        <div className="mt-5 flex items-center justify-between">
          <button className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft className="h-4 w-4" />Voltar</button>
          <div className="flex items-center gap-3">
            {step === 1 && blockers.length > 0 && <span className="hidden text-xs text-zinc-500 sm:inline">{blockers[0]}</span>}
            <button className="btn-primary" onClick={next} disabled={!canNext}>{step === 2 ? "Ver resumo" : "Continuar"}<ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
      {step === 3 && <div className="mt-5"><button className="btn-ghost" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" />Voltar</button></div>}
    </div>
  );
}
