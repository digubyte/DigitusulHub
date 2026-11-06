"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { api, Field, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/core/util";
import { CATEGORIES } from "../domain/brand";
import { getFormat } from "../domain/formats";
import { composeFlyer } from "../domain/layout-engine";
import { validateFlyer } from "../domain/validation";
import { checkProduct } from "../domain/product-format";
import type { CategoryKey, LayoutOptions, Product } from "../domain/types";
import { FlyerStage, type StageHandle } from "./flyer-stage";
import { ensureFonts } from "./image-cache";
import { AiComposer, CategoryPicker, defaultLayout, FormatPicker, LayoutOptionsForm } from "./layout-options";
import { ProductsEditor } from "./products-editor";
import { brandFromContext, brandLogoIds, type StudioContext } from "./studio-types";

const STEPS = ["Informações", "Produtos", "Modelo e IA", "Prévia"];

export function Wizard({ ctx, template }: { ctx: StudioContext; template?: { layout: LayoutOptions; formatKey: string; width: number; height: number; campaign: string | null; name: string } | null }) {
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(template ? `${template.name.replace(/ \(template\)$/, "")} — novo` : "");
  const [campaign, setCampaign] = useState(template?.campaign ?? "");
  const [fmt, setFmt] = useState({ formatKey: template?.formatKey ?? "ig-feed", width: template?.width ?? 1080, height: template?.height ?? 1350 });
  const [layout, setLayout] = useState<LayoutOptions>(template?.layout ?? defaultLayout());
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const stageRef = useRef<StageHandle>(null);
  const previewBox = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(520);

  useEffect(() => { ensureFonts(Object.values(ctx.brandKit.fonts)).then(() => setFontsReady(true)); }, [ctx.brandKit.fonts]);
  useEffect(() => {
    const el = previewBox.current; if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el); return () => ro.disconnect();
  }, [step]);

  function setCategory(c: CategoryKey) {
    const prevDefault = CATEGORIES.find((x) => x.key === layout.category)?.defaultHeadline;
    setLayout({ ...layout, category: c, headline: !layout.headline || layout.headline === prevDefault ? CATEGORIES.find((x) => x.key === c)!.defaultHeadline : layout.headline });
  }

  const dimsOk = fmt.width >= 200 && fmt.width <= 6000 && fmt.height >= 200 && fmt.height <= 6000;
  const productErrors = products.flatMap((p, i) => checkProduct(p, i)).filter((x) => x.level === "error");
  const needsProducts = layout.category !== "institucional";
  const canNext = [
    !!name.trim() && dimsOk,
    productErrors.length === 0 && (!needsProducts || products.length > 0),
    !!layout.headline.trim(),
    true,
  ][step];

  const doc = useMemo(() => (step === 3 ? composeFlyer({ width: fmt.width, height: fmt.height, products, options: layout, brand: brandFromContext(ctx, layout.mascotFileId) }) : null), [step, fmt, products, layout, ctx]);
  const issues = useMemo(() => (doc ? validateFlyer(doc, products, { expectedWidth: fmt.width, expectedHeight: fmt.height, brandLogoFileIds: brandLogoIds(ctx) }) : []), [doc, products, fmt, ctx]);
  const scale = doc ? Math.min(boxW / doc.width, 640 / doc.height) : 1;

  async function create() {
    if (!doc) return;
    setSaving(true);
    try {
      const thumb = stageRef.current?.toDataURL({ mimeType: "image/jpeg", quality: 0.82, maxSide: 480 });
      const r = await api<{ id: string }>("/api/flyers", {
        method: "POST",
        json: { name: name.trim(), campaign: campaign.trim() || null, formatKey: fmt.formatKey, width: fmt.width, height: fmt.height, products, layoutConfig: layout, canvasState: doc, thumbnailDataUrl: thumb },
      });
      toast.success("Projeto criado e salvo.");
      router.push(`/estudio/${r.id}`);
    } catch (e) { toast.error((e as Error).message); setSaving(false); }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/estudio" className="btn-icon btn-ghost" aria-label="Voltar ao Estúdio"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Estúdio de Flyers</p>
          <h1 className="font-display text-2xl font-extrabold">Novo flyer</h1>
        </div>
      </div>

      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button disabled={i > step} onClick={() => setStep(i)} className="w-full text-left">
              <div className={cn("h-1.5 rounded-full", i <= step ? "bg-brand-600" : "bg-slate-200")} />
              <p className={cn("mt-1.5 flex items-center gap-1 text-xs font-semibold", i === step ? "text-brand-700" : i < step ? "text-ink-soft" : "text-slate-400")}>
                {i < step && <Check className="h-3 w-3" />}<span className="hidden sm:inline">{i + 1}. </span>{s}
              </p>
            </button>
          </li>
        ))}
      </ol>

      <div className="card p-4 sm:p-6">
        {step === 0 && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do projeto *"><input className="input" autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ofertas de informática — semana 45" /></Field>
              <Field label="Campanha (opcional)"><input className="input" maxLength={80} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Ex.: Volta às aulas" /></Field>
            </div>
            <div><p className="label mb-2">Tipo de flyer</p><CategoryPicker value={layout.category} onChange={setCategory} /></div>
            <div><p className="label mb-2">Formato</p><FormatPicker {...fmt} onChange={setFmt} /></div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-4 text-sm text-ink-muted">Cadastre os produtos. Código, nome e preço final são obrigatórios e serão exibidos <strong>exatamente</strong> como informados.</p>
            <ProductsEditor ctx={ctx} products={products} onChange={setProducts} />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <AiComposer ctx={ctx} layout={layout} productNames={products.map((p) => p.name)} onApply={(l, s) => {
              setLayout(l);
              if (s.formatKey && s.formatKey !== fmt.formatKey) { const f = getFormat(s.formatKey)!; setFmt({ formatKey: f.key, width: f.width, height: f.height }); toast.info(`Formato alterado para ${f.label}.`); }
            }} />
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="badge bg-brand-50 text-brand-700">{CATEGORIES.find((c) => c.key === layout.category)?.label}</span>
                <span className="badge bg-slate-100 text-ink-soft">{getFormat(fmt.formatKey)?.label} · {fmt.width}×{fmt.height}</span>
                <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setStep(0)}>alterar</button>
              </div>
              <LayoutOptionsForm ctx={ctx} layout={layout} onChange={setLayout} />
            </div>
          </div>
        )}

        {step === 3 && doc && (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div ref={previewBox} className="flex min-h-[300px] items-center justify-center self-start rounded-xl bg-slate-100 p-3">
              {fontsReady ? <div className="shadow-pop"><FlyerStage ref={stageRef} doc={doc} scale={scale} /></div> : <Spinner className="h-6 w-6 text-brand-600" />}
            </div>
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold">Composição gerada</h2>
                <p className="text-sm text-ink-muted">Layout adaptado para {products.length} produto(s), {getFormat(fmt.formatKey)?.label.toLowerCase()} e categoria {CATEGORIES.find((c) => c.key === layout.category)?.label.toLowerCase()}. Tudo continua editável no editor.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold">Verificação</p>
                {issues.length === 0 ? <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Nenhuma pendência encontrada.</p> : (
                  <ul className="space-y-1">{issues.map((x, i) => <li key={i} className={cn("flex gap-1.5 text-xs", x.level === "error" ? "text-accent-600" : "text-amber-700")}><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{x.message}</li>)}</ul>
                )}
              </div>
              <button className="btn-accent w-full py-2.5" onClick={create} disabled={saving}>{saving && <Spinner />}Salvar e abrir no editor</button>
              <p className="text-xs text-ink-muted">A exportação (PNG, JPG, PDF) é feita no editor, após a validação final.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button className="btn-secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft className="h-4 w-4" />Voltar</button>
        {step < 3 && (
          <button className="btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            {step === 2 ? "Gerar prévia" : "Continuar"}<ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {step === 1 && !canNext && <p className="mt-2 text-right text-xs text-ink-muted">{needsProducts && products.length === 0 ? "Adicione ao menos um produto." : "Preencha código, nome e preço de todos os produtos para continuar."}</p>}
    </div>
  );
}
