"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ClipboardCopy, Copy, Download, Eraser, Globe, ImagePlus, ScanText, Trash2, Plus, CheckCircle2 } from "lucide-react";
import { api, Spinner } from "@/components/ui/primitives";
import { Dropzone, uploadFiles } from "@/components/upload/dropzone";
import { useToast } from "@/components/ui/toast";
import { checkProduct, formatPrice, parsePriceInput } from "../domain/product-format";
import { buildCategoryCsv, buildProductList } from "../domain/lists";
import { describeRule } from "../domain/pricing";
import type { Product } from "../domain/types";
import { CatalogImportModal } from "./catalog-import";
import { newId, type StudioContext } from "./studio-types";

const MAX_PRODUCTS = 24;
export const emptyProduct = (): Product => ({ id: newId(), code: "", name: "", priceCents: null, imageFileId: null, origin: "manual" });

export function ProductsEditor({ products, onChange, ctx, compact }: { products: Product[]; onChange: (p: Product[]) => void; ctx: StudioContext; compact?: boolean }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const update = (id: string, patch: Partial<Product>) => onChange(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const move = (i: number, d: -1 | 1) => {
    const a = [...products]; const j = i + d; if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; onChange(a);
  };
  const add = (list: Product[]) => {
    const room = MAX_PRODUCTS - products.length;
    if (room <= 0) return toast.error(`Limite de ${MAX_PRODUCTS} produtos por flyer.`);
    if (list.length > room) toast.info(`Apenas ${room} produto(s) adicionados — limite de ${MAX_PRODUCTS}.`);
    onChange([...products, ...list.slice(0, room)]);
  };

  async function setImage(p: Product, files: File[]) {
    setBusyId(p.id);
    try {
      const [f] = await uploadFiles(files.slice(0, 1), "product");
      update(p.id, { imageFileId: f.id, imageWidth: f.width, imageHeight: f.height });
    } catch (e) { toast.error((e as Error).message); } finally { setBusyId(null); }
  }

  async function bulk(files: File[]) {
    setBulkBusy(true);
    try {
      const up = await uploadFiles(files.slice(0, MAX_PRODUCTS - products.length), "product");
      add(up.map((f) => ({ ...emptyProduct(), imageFileId: f.id, imageWidth: f.width, imageHeight: f.height })));
      toast.success(`${up.length} imagem(ns) adicionada(s). Preencha código, nome e preço${ctx.aiEnabled && ctx.perms.ai ? " ou use “Ler dados da imagem”" : ""}.`);
    } catch (e) { toast.error((e as Error).message); } finally { setBulkBusy(false); }
  }

  async function removeBg(p: Product) {
    if (!p.imageFileId) return;
    setBusyId(p.id);
    try {
      const r = await api<{ file: { id: string; width: number; height: number } }>(`/api/files/${p.imageFileId}/remove-bg`, { method: "POST" });
      update(p.id, { imageFileId: r.file.id, imageWidth: r.file.width, imageHeight: r.file.height });
      toast.success("Fundo removido. A imagem original continua salva.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusyId(null); }
  }

  async function ocr(p: Product) {
    if (!p.imageFileId) return;
    setBusyId(p.id);
    try {
      const r = await api<{ draft: Partial<Product>; pixValue: string | null; note: string }>("/api/flyers/ai/ocr", { method: "POST", json: { fileId: p.imageFileId } });
      // Só preenche campos vazios — nunca sobrescreve o que o usuário digitou.
      update(p.id, {
        code: p.code || r.draft.code || "",
        name: p.name || r.draft.name || "",
        ...(p.priceCents == null ? { priceCents: r.draft.priceCents ?? null, cardPriceCents: r.draft.cardPriceCents ?? null, priceFromRule: r.draft.priceFromRule, priceUncertain: r.draft.priceUncertain } : {}),
        origin: "ocr",
      });
      toast.info(r.note || "Dados lidos. Confira antes de continuar.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusyId(null); }
  }

  const issues = products.flatMap((p, i) => checkProduct(p, i));
  const errors = issues.filter((i) => i.level === "error");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary btn-sm" onClick={() => add([emptyProduct()])}><Plus className="h-4 w-4" />Adicionar produto</button>
        <button className="btn-secondary btn-sm" onClick={() => setCatalogOpen(true)}><Globe className="h-4 w-4" />Importar do site Digitusul</button>
        <span className="ml-auto text-xs text-ink-muted">{products.length}/{MAX_PRODUCTS} produtos</span>
      </div>

      <Dropzone compact={compact || products.length > 0} busy={bulkBusy} onFiles={bulk} label="Arraste várias fotos para criar um produto por imagem" />

      {products.length === 0 && <p className="rounded-lg bg-zinc-50 p-4 text-center text-sm text-ink-muted">Nenhum produto. Para flyers institucionais, os produtos são opcionais.</p>}

      <ol className="space-y-3">
        {products.map((p, i) => {
          const pIssues = issues.filter((x) => x.productId === p.id);
          const err = (f: string) => pIssues.some((x) => x.field === f && x.level === "error");
          return (
            <li key={p.id} className="card p-3">
              <div className="flex gap-3">
                <div className="w-24 shrink-0 sm:w-28">
                  {p.imageFileId ? (
                    <div className="group relative aspect-square overflow-hidden rounded-lg bg-[conic-gradient(#f1f5f9_25%,#fff_0_50%,#f1f5f9_0_75%,#fff_0)] bg-[length:12px_12px]">
                      <img src={`/api/files/${p.imageFileId}`} alt={p.name || "Produto"} className="h-full w-full object-contain" />
                      {busyId === p.id && <div className="absolute inset-0 flex items-center justify-center bg-surface/70"><Spinner className="text-brand-600" /></div>}
                    </div>
                  ) : (
                    <Dropzone compact multiple={false} busy={busyId === p.id} label="Imagem" onFiles={(f) => setImage(p, f)} />
                  )}
                  {p.imageFileId && (
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                      <label className="btn-icon btn-ghost cursor-pointer" title="Substituir imagem"><ImagePlus className="h-3.5 w-3.5" /><input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files && setImage(p, Array.from(e.target.files))} /></label>
                      <button className="btn-icon btn-ghost" title={ctx.removeBgEnabled ? "Remover fundo" : "Remoção de fundo não configurada"} disabled={!ctx.removeBgEnabled || busyId === p.id} onClick={() => removeBg(p)}><Eraser className="h-3.5 w-3.5" /></button>
                      {ctx.aiEnabled && ctx.perms.ai && <button className="btn-icon btn-ghost" title="Ler dados da imagem (IA)" disabled={busyId === p.id} onClick={() => ocr(p)}><ScanText className="h-3.5 w-3.5" /></button>}
                      <button className="btn-icon btn-ghost" title="Remover imagem" onClick={() => update(p.id, { imageFileId: null, imageWidth: null, imageHeight: null })}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-6">
                  <label className="sm:col-span-2"><span className="label">Código *</span><input className={`input ${err("code") ? "border-accent-500" : ""}`} value={p.code} onChange={(e) => update(p.id, { code: e.target.value })} /></label>
                  <div className="sm:col-span-4"><PriceField product={p} error={err("priceCents")} onChange={(patch) => update(p.id, patch)} ctx={ctx} /></div>
                  <label className="sm:col-span-6"><span className="label">Nome completo *</span><input className={`input ${err("name") ? "border-accent-500" : ""}`} value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} /></label>
                  {!compact && <>
                    <label className="sm:col-span-4"><span className="label">Descrição complementar</span><input className="input" value={p.description ?? ""} onChange={(e) => update(p.id, { description: e.target.value || undefined })} /></label>
                    <label className="sm:col-span-2"><span className="label">Marca</span><input className="input" value={p.brand ?? ""} onChange={(e) => update(p.id, { brand: e.target.value || undefined })} /></label>
                    <label className="sm:col-span-6"><span className="label">Informações adicionais</span><input className="input" value={p.extra ?? ""} onChange={(e) => update(p.id, { extra: e.target.value || undefined })} /></label>
                  </>}
                </div>
                <div className="flex flex-col gap-0.5">
                  <button className="btn-icon btn-ghost" aria-label="Mover para cima" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></button>
                  <button className="btn-icon btn-ghost" aria-label="Mover para baixo" onClick={() => move(i, 1)} disabled={i === products.length - 1}><ArrowDown className="h-4 w-4" /></button>
                  <button className="btn-icon btn-ghost" aria-label="Duplicar" onClick={() => add([{ ...p, id: newId() }])}><Copy className="h-4 w-4" /></button>
                  <button className="btn-icon btn-ghost text-accent-600" aria-label="Excluir produto" onClick={() => onChange(products.filter((x) => x.id !== p.id))}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {pIssues.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {pIssues.map((x, k) => <li key={k} className={`flex items-center gap-1.5 text-xs ${x.level === "error" ? "text-accent-600" : "text-amber-700"}`}><AlertTriangle className="h-3 w-3" />{x.message}</li>)}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
          {errors.length === 0 ? <span className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Dados obrigatórios completos</span> : <span className="text-xs text-accent-600">{errors.length} pendência(s) obrigatória(s)</span>}
          <button className="btn-ghost btn-sm ml-auto" onClick={() => { navigator.clipboard.writeText(buildProductList(products)); toast.success("Lista copiada (Código - Nome - Valor)."); }}><ClipboardCopy className="h-3.5 w-3.5" />Copiar lista</button>
          <button className="btn-ghost btn-sm" onClick={() => download("produtos-digitusul.csv", buildCategoryCsv(products), "text/csv;charset=utf-8")}><Download className="h-3.5 w-3.5" />CSV (Sku,Nome,Ativo,Ordem)</button>
        </div>
      )}

      <CatalogImportModal open={catalogOpen} onClose={() => setCatalogOpen(false)} ctx={ctx} existing={products.map((p) => p.code).filter(Boolean)} room={MAX_PRODUCTS - products.length} onImport={(list) => add(list)} />
    </div>
  );
}

function PriceField({ product: p, onChange, error, ctx }: { product: Product; onChange: (patch: Partial<Product>) => void; error: boolean; ctx: StudioContext }) {
  const [raw, setRaw] = useState(p.priceCents != null ? formatPrice(p.priceCents).replace("R$ ", "") : "");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setRaw(p.priceCents != null ? formatPrice(p.priceCents).replace("R$ ", "") : ""); }, [p.priceCents]);
  function commit() {
    if (!raw.trim()) { onChange({ priceCents: null, priceFromRule: false }); setInvalid(false); return; }
    const c = parsePriceInput(raw);
    if (c == null) return setInvalid(true);
    setInvalid(false);
    if (c !== p.priceCents) onChange({ priceCents: c, priceFromRule: false, priceUncertain: false });
  }
  return (
    <div>
      <span className="label">Preço final *</span>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-muted">R$</span>
          <input className={`input pl-9 font-semibold ${error || invalid ? "border-accent-500" : ""}`} inputMode="decimal" placeholder="0,00" value={raw} onChange={(e) => setRaw(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
        </div>
        {p.priceUncertain && <button className="btn-secondary btn-sm whitespace-nowrap" onClick={() => onChange({ priceUncertain: false })} title="Confirme que o valor lido é o valor no cartão (não PIX)">Confirmar valor</button>}
      </div>
      {invalid && <p className="mt-1 text-xs text-accent-600">Valor inválido. Use o formato 1.299,90.</p>}
      {p.priceFromRule && p.cardPriceCents != null && !invalid && (
        <p className="mt-1 text-[11px] text-ink-muted">Cartão {formatPrice(p.cardPriceCents)} → {describeRule(ctx.pricingRule)}{p.origin === "site" ? " · origem: site" : p.origin === "ocr" ? " · origem: leitura de imagem" : ""}</p>
      )}
    </div>
  );
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20_000);
}
