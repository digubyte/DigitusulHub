"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, ClipboardPaste, Dices, Download, FileText, Loader2, RotateCcw, Search, Sparkles, Upload, Wand2, X } from "lucide-react";
import { api, Spinner } from "@/components/ui/primitives";
import { uploadFiles } from "@/components/upload/dropzone";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/core/util";
import { CATEGORIES } from "../domain/brand";
import { FORMATS, getFormat } from "../domain/formats";
import { formatPrice, parsePriceInput } from "../domain/product-format";
import { applyPricingRule, describeRule } from "../domain/pricing";
import { buildCategoryCsv, buildProductList } from "../domain/lists";
import { buildChatGptPrompt, promptBlockers, splitIntoFlyers } from "../domain/chatgpt-prompt";
import type { CategoryKey, LayoutOptions, Product } from "../domain/types";
import { defaultLayout } from "./layout-options";
import { brandFromContext, newId, type StudioContext } from "./studio-types";
import { copyText, downloadBlob } from "./chatgpt-assets";
import type { ChatGptFlyer } from "./chatgpt-flyer";
import { ChatGptBatchView } from "./chatgpt-views";

const MAX_TOTAL = 60;
const PER_FLYER = 24;
const QUICK_COUNTS = [6, 12, 20, 30, 60];
const MAIN_FORMATS = ["ig-stories", "ig-feed", "ig-square"];

interface Preview { code: string }

export function CreateFlyers({ ctx }: { ctx: StudioContext }) {
  const toast = useToast();
  const [items, setItems] = useState<Product[]>([]);
  const [priceText, setPriceText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [reading, setReading] = useState<Set<string>>(new Set());
  // Passo 1
  const [codesText, setCodesText] = useState("");
  const [count, setCount] = useState("6");
  const [category, setCategory] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  // Passo 3
  const [flyers, setFlyers] = useState(1);
  const [formatKey, setFormatKey] = useState("ig-stories");
  const [layout, setLayout] = useState<LayoutOptions>(defaultLayout());
  const [segment, setSegment] = useState("");
  const [extra, setExtra] = useState("");
  const [result, setResult] = useState<{ flyers: ChatGptFlyer[]; list: Product[] } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ai = ctx.aiEnabled && ctx.perms.ai;
  const room = MAX_TOTAL - items.length;
  const wantedCount = Math.min(Math.max(1, Math.floor(Number(count) || 1)), MAX_TOTAL);
  const patch = (id: string, v: Partial<Product>) => setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...v } : p)));

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  /** Importa pelo servidor (preço calculado lá e foto salva), em blocos de 24. */
  async function importCodes(codes: string[]): Promise<Product[]> {
    const out: Product[] = [];
    for (let i = 0; i < codes.length; i += 24) {
      const r = await api<{ products: Product[]; notFound: string[]; imageErrors: string[] }>("/api/catalog", { method: "POST", json: { action: "import", codes: codes.slice(i, i + 24) } });
      out.push(...r.products);
      if (r.notFound?.length) toast.error(`Código(s) não encontrado(s): ${r.notFound.join(", ")}`);
    }
    return out;
  }
  const existingCodes = () => items.map((p) => p.code).filter(Boolean);
  const add = (list: Product[]) => setItems((prev) => [...prev, ...list.slice(0, MAX_TOTAL - prev.length)]);

  const searchCodes = () => run("codes", async () => {
    const have = new Set(existingCodes());
    const codes = [...new Set(codesText.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean))].filter((c) => !have.has(c)).slice(0, room);
    if (!codes.length) { toast.info("Esses códigos já estão na lista ou não há espaço."); return; }
    const got = await importCodes(codes);
    add(got);
    setCodesText("");
    if (got.length) toast.success(`${got.length} produto(s) adicionado(s).`);
  });

  async function drawCodes(n: number, exclude: string[]) {
    const codes: string[] = [];
    while (codes.length < n) {
      const want = Math.min(24, n - codes.length);
      const r = await api<{ products: Preview[] }>("/api/catalog", { method: "POST", json: { action: "random", count: want, category: category || undefined, exclude: [...exclude, ...codes].slice(-200) } });
      const fresh = r.products.map((p) => p.code).filter((c) => !codes.includes(c));
      if (!fresh.length) break;
      codes.push(...fresh);
      if (r.products.length < want) break;
    }
    return codes.slice(0, n);
  }

  const draw = () => run("draw", async () => {
    if (room <= 0) { toast.error(`Limite de ${MAX_TOTAL} produtos atingido.`); return; }
    const n = Math.min(wantedCount, room);
    const codes = await drawCodes(n, existingCodes());
    if (!codes.length) { toast.error("Nenhum produto com estoque acima de 2 unidades encontrado. Tente outra categoria."); return; }
    const got = await importCodes(codes);
    add(got);
    toast.success(`${got.length} produto(s) sorteado(s) do site.`);
  });

  const reroll = (p: Product) => run(`reroll-${p.id}`, async () => {
    const [code] = await drawCodes(1, existingCodes());
    if (!code) { toast.error("Nenhum produto novo encontrado. Tente outra categoria."); return; }
    const [np] = await importCodes([code]);
    if (np) setItems((prev) => prev.map((x) => (x.id === p.id ? { ...np, id: p.id } : x)));
  });

  const aiSearch = () => run("ai", async () => {
    const r = await api<{ products: Preview[]; note?: string }>("/api/catalog", { method: "POST", json: { action: "ai-search", prompt: aiPrompt } });
    const have = new Set(existingCodes());
    const codes = r.products.map((p) => p.code).filter((c) => !have.has(c)).slice(0, room);
    if (!codes.length) { toast.error(r.note || "Nenhum produto com estoque encontrado."); return; }
    const got = await importCodes(codes);
    add(got);
    toast.success(`${got.length} produto(s) encontrados pela IA.`);
  });

  /** Lê nome, código e valor no cartão de um print (quando a IA está configurada). */
  async function readImage(p: Product) {
    setReading((s) => new Set(s).add(p.id));
    try {
      const r = await api<{ draft: Partial<Product>; note: string }>("/api/flyers/ai/ocr", { method: "POST", json: { fileId: p.imageFileId } });
      setItems((prev) => prev.map((x) => x.id !== p.id ? x : {
        ...x, code: x.code || r.draft.code || "", name: x.name || r.draft.name || "",
        ...(x.cardPriceCents == null ? { cardPriceCents: r.draft.cardPriceCents ?? null, priceCents: r.draft.priceCents ?? null, priceFromRule: !!r.draft.cardPriceCents, priceUncertain: r.draft.priceUncertain } : {}),
      }));
    } catch (e) { toast.error((e as Error).message); } finally {
      setReading((s) => { const n = new Set(s); n.delete(p.id); return n; });
    }
  }

  const addFiles = useCallback(async (files: File[]) => {
    const valid = files.filter((f) => ["image/png", "image/jpeg", "image/webp"].includes(f.type)).slice(0, MAX_TOTAL - items.length);
    if (!valid.length) { toast.error("Formatos aceitos: JPG, PNG e WEBP."); return; }
    setBusy("upload");
    try {
      const up = await uploadFiles(valid, "product");
      const created: Product[] = up.map((f) => ({ id: newId(), code: "", name: "", priceCents: null, cardPriceCents: null, imageFileId: f.id, imageWidth: f.width, imageHeight: f.height, origin: "ocr" }));
      setItems((prev) => [...prev, ...created]);
      if (ai) for (const p of created) await readImage(p);
      else toast.info("Preencha nome, código e valor no cartão de cada imagem.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }, [items.length, ai]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  async function pasteButton() {
    try {
      const clip = await navigator.clipboard.read();
      const files: File[] = [];
      for (const it of clip) {
        const type = it.types.find((t) => t.startsWith("image/"));
        if (type) { const b = await it.getType(type); files.push(new File([b], "colado.png", { type: b.type })); }
      }
      if (!files.length) { toast.error("Nenhuma imagem na área de transferência."); return; }
      await addFiles(files);
    } catch { toast.error("Use Ctrl+V para colar a imagem aqui."); }
  }

  function setCardPrice(p: Product, text: string) {
    setPriceText((t) => ({ ...t, [p.id]: text }));
    const card = parsePriceInput(text);
    patch(p.id, card && card > 0
      ? { cardPriceCents: card, priceCents: applyPricingRule(card, ctx.pricingRule), priceFromRule: true, priceUncertain: false }
      : { cardPriceCents: null, priceCents: null });
  }

  // ── Passo 3: divisão e prompts ──
  const groups = useMemo(() => splitIntoFlyers(items, flyers), [items, flyers]);
  const blockers = promptBlockers(items, layout.category);
  const tooMany = groups.some((g) => g.length > PER_FLYER);
  const fmt = getFormat(formatKey)!;
  const cat = CATEGORIES.find((c) => c.key === layout.category)!;

  function setStyle(c: CategoryKey) {
    const prev = CATEGORIES.find((x) => x.key === layout.category)?.defaultHeadline;
    setLayout({ ...layout, category: c, headline: !layout.headline || layout.headline === prev ? CATEGORIES.find((x) => x.key === c)!.defaultHeadline : layout.headline });
  }

  const generate = () => run("generate", async () => {
    const brand = brandFromContext(ctx, layout.mascotFileId);
    const hasMascot = layout.showMascot && ctx.brandKit.mascots.length > 0;
    const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date());
    const base = `${segment.trim() || cat.label} · ${date}`;
    const drafts = groups.map((g, i) => ({
      name: groups.length > 1 ? `${base} · ${i + 1}/${groups.length}` : base,
      products: g,
      prompt: buildChatGptPrompt({
        category: layout.category, formatKey, width: fmt.width, height: fmt.height, headline: layout.headline, subheadline: layout.subheadline, footerText: layout.footerText,
        segment: segment.trim() || undefined, products: g, colors: brand.colors, fonts: brand.fonts, hasLogo: !!ctx.brandKit.logo, hasMascot, emphasis: layout.emphasis,
        extraInstructions: extra, batch: groups.length > 1 ? { index: i, total: groups.length } : undefined,
      }),
    }));
    const r = await api<{ ids: string[] }>("/api/flyers/chatgpt", {
      method: "POST",
      json: { campaign: segment.trim() || null, formatKey, width: fmt.width, height: fmt.height, layoutConfig: layout, flyers: drafts },
    });
    setResult({
      list: items,
      flyers: drafts.map((d, i) => ({ id: r.ids[i], name: d.name, products: d.products, prompt: d.prompt, resultFileId: null, width: fmt.width, height: fmt.height, formatKey, canEdit: true, layout })),
    });
    toast.success(drafts.length > 1 ? `${drafts.length} prompts prontos e salvos no histórico.` : "Prompt pronto e salvo no histórico.");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  });

  function clearAll() {
    setItems([]); setPriceText({}); setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const list = buildProductList(result?.list ?? items);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Gerador de flyers</h1>
        <p className="mt-1 text-sm text-zinc-500">Até {MAX_TOTAL} produtos · {describeRule(ctx.pricingRule).toLowerCase()} · nunca usa o valor PIX</p>
      </header>

      {/* 1. Adicionar */}
      <Section n={1} title="Adicionar produtos" subtitle="Do site, por código, fotos ou prints colados." aside={<span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">{items.length}/{MAX_TOTAL}</span>}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Tile icon={Dices} title="Sortear do site">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {ctx.siteCategories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
            <div className="flex gap-2">
              <input className="input w-16 text-center" inputMode="numeric" value={count} aria-label="Quantidade" onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} onBlur={() => setCount(String(wantedCount))} />
              <button className="btn-accent flex-1" onClick={draw} disabled={!!busy || room <= 0}>{busy === "draw" ? <Spinner /> : <Dices className="h-4 w-4" />}Sortear</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_COUNTS.map((n) => (
                <button key={n} onClick={() => setCount(String(n))} className={cn("rounded-full border px-2.5 py-0.5 text-xs", wantedCount === n ? "border-brand-300 bg-brand-50 text-brand-700" : "border-zinc-200 text-zinc-500 hover:text-ink")}>{n}</button>
              ))}
            </div>
          </Tile>
          <Tile icon={Search} title="Buscar por código">
            <textarea className="input min-h-[76px] font-mono" placeholder={"12345\n67890"} value={codesText} onChange={(e) => setCodesText(e.target.value)} />
            <button className="btn-secondary w-full" onClick={searchCodes} disabled={!!busy || !codesText.trim() || room <= 0}>{busy === "codes" ? <Spinner /> : <Search className="h-4 w-4" />}Buscar</button>
          </Tile>
          <Tile icon={Upload} title="Enviar fotos ou prints">
            <p className="text-xs text-zinc-500">JPG, PNG ou WEBP.{ai ? " A IA lê nome, código e valor." : ""}</p>
            <input ref={fileRef} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            <button className="btn-secondary mt-auto w-full" onClick={() => fileRef.current?.click()} disabled={!!busy || room <= 0}>{busy === "upload" ? <Spinner /> : <Upload className="h-4 w-4" />}Escolher imagens</button>
          </Tile>
          <Tile icon={ClipboardPaste} title="Colar imagem">
            <p className="text-xs text-zinc-500">Ctrl+V em qualquer lugar da página.</p>
            <button className="btn-secondary mt-auto w-full" onClick={pasteButton} disabled={!!busy || room <= 0}>Colar</button>
          </Tile>
        </div>

        {ai && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-brand-600" />
              <input className="input" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && aiPrompt.trim().length >= 3 && !busy && aiSearch()} placeholder='Busca com IA: "quero 12 itens gamer"' />
            </div>
            <button className="btn-primary" onClick={aiSearch} disabled={!!busy || aiPrompt.trim().length < 3}>{busy === "ai" ? <Spinner /> : <Sparkles className="h-4 w-4" />}Buscar com IA</button>
          </div>
        )}

        {items.length > 0 && (
          <div className={cn("mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6", items.length > 18 && "thin-scroll max-h-[26rem] overflow-y-auto pr-1")}>
            {items.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-surface">
                {p.imageFileId ? <img src={`/api/files/${p.imageFileId}`} alt={p.name || "Produto"} className="h-24 w-full bg-white object-contain p-2" /> : <div className="flex h-24 items-center justify-center text-[11px] text-zinc-400">sem imagem</div>}
                <p className="truncate px-2 pb-2 text-xs font-medium">{reading.has(p.id) ? "Lendo imagem…" : p.name || "Aguardando dados"}</p>
                <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== p.id))} aria-label="Remover produto" className="absolute right-1 top-1 rounded-md bg-surface/90 p-1 text-zinc-400 hover:text-accent-600"><X className="h-3.5 w-3.5" /></button>
                {p.origin === "site" && (
                  <button onClick={() => reroll(p)} disabled={!!busy} title="Sortear outro no lugar" aria-label="Sortear outro produto no lugar deste" className="absolute left-1 top-1 rounded-md bg-surface/90 p-1 text-zinc-400 hover:text-brand-600">
                    {busy === `reroll-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Dices className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 2. Conferir */}
      {items.length > 0 && (
        <Section n={2} title="Conferir produtos" subtitle={`O valor final é calculado pelo aplicativo: ${describeRule(ctx.pricingRule).toLowerCase()}.`}>
          {blockers.length > 0 && (
            <div className="mb-4 flex gap-2 rounded-lg bg-accent-50 p-3 text-[13px] text-accent-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{blockers.slice(0, 5).map((b, i) => <p key={i}>{b}</p>)}{blockers.length > 5 && <p>…e mais {blockers.length - 5}.</p>}</div>
            </div>
          )}
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {items.map((p, i) => (
              <li key={p.id} className="grid gap-3 p-3 sm:grid-cols-[56px_1fr_120px_150px_auto] sm:items-center">
                <div className="hidden h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-white sm:flex">{p.imageFileId ? <img src={`/api/files/${p.imageFileId}`} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-zinc-400">{i + 1}</span>}</div>
                <input className="input" placeholder="Nome do produto" value={p.name} onChange={(e) => patch(p.id, { name: e.target.value })} aria-label="Nome" />
                <input className="input font-mono" placeholder="Código" value={p.code} onChange={(e) => patch(p.id, { code: e.target.value })} aria-label="Código" />
                <input className="input" placeholder="Valor no cartão" inputMode="decimal" aria-label="Valor no cartão"
                  value={priceText[p.id] ?? (p.cardPriceCents != null ? formatPrice(p.cardPriceCents).replace("R$ ", "") : "")}
                  onChange={(e) => setCardPrice(p, e.target.value)} />
                <div className="flex items-center gap-2 sm:justify-end">
                  {p.priceUncertain ? (
                    <button className="btn-secondary btn-sm" onClick={() => patch(p.id, { priceUncertain: false })} title="Confirme que o valor lido é o do cartão, não o PIX"><CheckCircle2 className="h-3.5 w-3.5" />É valor do cartão</button>
                  ) : (
                    <span className="whitespace-nowrap rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-brand-700">{p.priceCents != null ? formatPrice(p.priceCents) : "—"}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 3. Gerar */}
      {items.length > 0 && (
        <Section n={3} title="Gerar flyers" subtitle="Escolha quantos flyers, o formato e o estilo. Os produtos são divididos em ordem.">
          <div className="space-y-5">
            <Chips label="Quantos flyers?" value={String(flyers)} onChange={(v) => setFlyers(Number(v))} options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: String(n) }))} />
            <Chips label="Formato" value={formatKey} onChange={setFormatKey} options={[...FORMATS.filter((f) => MAIN_FORMATS.includes(f.key)), ...FORMATS.filter((f) => !MAIN_FORMATS.includes(f.key) && !f.customizable)].map((f) => ({ value: f.key, label: f.label.replace("Instagram ", "").replace(/^./, (c) => c.toUpperCase()), hint: f.hint }))} />
            <Chips label="Estilo" value={layout.category} onChange={(v) => setStyle(v as CategoryKey)} options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="label">Título do flyer</span><input className="input" maxLength={80} value={layout.headline} onChange={(e) => setLayout({ ...layout, headline: e.target.value })} /></label>
              <label><span className="label">Segmento (opcional)</span><input className="input" maxLength={60} placeholder="Gamer, Limpeza, Escritório…" value={segment} onChange={(e) => setSegment(e.target.value)} /></label>
            </div>
            <details className="group rounded-xl border border-zinc-200 px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-zinc-600 hover:text-ink">Mais opções</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label><span className="label">Subtítulo</span><input className="input" maxLength={160} value={layout.subheadline ?? ""} onChange={(e) => setLayout({ ...layout, subheadline: e.target.value })} /></label>
                <label><span className="label">Rodapé</span><input className="input" maxLength={120} value={layout.footerText ?? ""} onChange={(e) => setLayout({ ...layout, footerText: e.target.value })} /></label>
                <label><span className="label">Destaque</span>
                  <select className="input" value={layout.emphasis} onChange={(e) => setLayout({ ...layout, emphasis: e.target.value as LayoutOptions["emphasis"] })}><option value="price">Preço</option><option value="product">Produto</option></select>
                </label>
                <label><span className="label">Mascote Digu</span>
                  <select className="input" disabled={!ctx.brandKit.mascots.length} value={layout.showMascot ? "1" : "0"} onChange={(e) => setLayout({ ...layout, showMascot: e.target.value === "1", mascotFileId: layout.mascotFileId ?? ctx.brandKit.mascots[0]?.fileId ?? null })}>
                    <option value="0">Sem mascote</option><option value="1">Com mascote</option>
                  </select>
                </label>
                <label className="sm:col-span-2"><span className="label">Instruções extras para o ChatGPT</span><textarea className="input min-h-[70px]" maxLength={1500} placeholder="Ex.: fundo com luzes neon, clima de setup gamer" value={extra} onChange={(e) => setExtra(e.target.value)} /></label>
              </div>
            </details>

            <div className="rounded-xl bg-zinc-50 p-4">
              <p className="mb-2 text-xs font-medium text-zinc-500">Resumo · {groups.length} {groups.length === 1 ? "flyer" : "flyers"} · {fmt.label} {fmt.width}×{fmt.height} · {cat.label}</p>
              <ol className="space-y-1 text-[13px]">
                {groups.map((g, i) => (
                  <li key={i} className={cn("truncate", g.length > PER_FLYER && "text-accent-600")}>
                    <span className="font-medium">Flyer {i + 1}</span> <span className="text-zinc-500">({g.length})</span>: {g.map((p) => p.name || "sem nome").join(" · ")}
                  </li>
                ))}
              </ol>
              {tooMany && <p className="mt-2 text-xs text-accent-600">Máximo de {PER_FLYER} produtos por flyer: aumente a quantidade de flyers.</p>}
              {!ctx.brandKit.logo && <p className="mt-2 text-xs text-amber-700">Logo não cadastrado em Admin › Brand Kit: o prompt pede só o nome “Digitusul”.</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-accent h-11 px-5 text-[15px]" onClick={generate} disabled={!!busy || blockers.length > 0 || tooMany || !layout.headline.trim()}>
                {busy === "generate" ? <Spinner /> : <Wand2 className="h-4 w-4" />}Aprovar e gerar {groups.length > 1 ? `${groups.length} prompts` : "prompt"}
              </button>
              {blockers.length > 0 && <span className="text-xs text-zinc-500">Corrija os produtos do passo 2 para continuar.</span>}
            </div>
          </div>
        </Section>
      )}

      {/* Resultados */}
      {result && (
        <div ref={resultRef} className="scroll-mt-20">
          <Section n={4} title="Resultados" subtitle="Para cada flyer: baixe as imagens, copie o prompt, cole no ChatGPT (site ou app) e envie a arte de volta."
            aside={<button className="btn-ghost btn-sm" onClick={clearAll}><RotateCcw className="h-3.5 w-3.5" />Começar de novo</button>}>
            <ChatGptBatchView ctx={ctx} flyers={result.flyers} campaign={null} embedded />
            <div className="mt-6 rounded-xl border border-zinc-200 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-zinc-400" />Lista de produtos</p>
              <pre className="thin-scroll max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-mono text-xs">{list}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-secondary btn-sm" onClick={() => copyText(list).then((ok) => ok && toast.success("Lista copiada!"))}><ClipboardCopy className="h-3.5 w-3.5" />Copiar lista</button>
                <button className="btn-secondary btn-sm" onClick={() => downloadBlob(new Blob([list], { type: "text/plain;charset=utf-8" }), "produtos-digitusul.txt")}><Download className="h-3.5 w-3.5" />Baixar TXT</button>
                <button className="btn-secondary btn-sm" onClick={() => downloadBlob(new Blob([buildCategoryCsv(result.list)], { type: "text/csv;charset=utf-8" }), "categoria-digitusul.csv")}><Download className="h-3.5 w-3.5" />Baixar CSV</button>
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ n, title, subtitle, aside, children }: { n: number; title: string; subtitle?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{n}</span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Tile({ icon: Icon, title, children }: { icon: typeof Dices; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-brand-600" />{title}</p>
      {children}
    </div>
  );
}

function Chips({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; hint?: string }[] }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} role="radio" aria-checked={value === o.value} title={o.hint} onClick={() => onChange(o.value)}
            className={cn("rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors", value === o.value ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-200 bg-surface text-zinc-600 hover:border-zinc-300 hover:text-ink")}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
