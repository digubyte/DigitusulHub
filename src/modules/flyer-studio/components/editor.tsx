"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical,
  ArrowLeft, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Circle, Copy, Download, Eye, EyeOff, Grid3x3, ImagePlus, Layers,
  Lock, Magnet, Maximize, Minus, Package, Plus, Redo2, Save, Shapes, Square, Trash2, Type, Undo2, Unlock, Wand2, LayoutTemplate, Link2,
} from "lucide-react";
import { api, ConfirmDialog, Field, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { uploadFiles } from "@/components/upload/dropzone";
import { cn } from "@/core/util";
import { composeFlyer, syncBoundTexts } from "../domain/layout-engine";
import { EDITOR_FONTS, categoryLabel } from "../domain/brand";
import { getFormat } from "../domain/formats";
import { formatPrice, parsePriceInput } from "../domain/product-format";
import type { FlyerDocument, FlyerElement, ImageElement, LayoutOptions, Product, ShapeElement, TextElement } from "../domain/types";
import { ExportDialog } from "./export-dialog";
import { FlyerStage, type StageHandle } from "./flyer-stage";
import { ensureFonts } from "./image-cache";
import { AiComposer, LayoutOptionsForm } from "./layout-options";
import { ProductsEditor } from "./products-editor";
import { brandFromContext, brandLogoIds, newId, type StudioContext } from "./studio-types";

interface Snapshot { doc: FlyerDocument; products: Product[]; layout: LayoutOptions }
export interface EditorProject extends Snapshot { id: string; name: string; campaign: string; formatKey: string; width: number; height: number; version: number; canEdit: boolean; ownerName: string; isTemplate: boolean }

type Tab = "elementos" | "produtos" | "layout" | "camadas";

export function Editor({ ctx, initial }: { ctx: StudioContext; initial: EditorProject }) {
  const toast = useToast();
  const readOnly = !initial.canEdit;
  const [meta, setMeta] = useState({ name: initial.name, campaign: initial.campaign });
  const [state, setState] = useState<Snapshot>({ doc: initial.doc, products: initial.products, layout: initial.layout });
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const lastCoalesce = useRef<{ key: string; t: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [version, setVersion] = useState(initial.version);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("elementos");
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [fit, setFit] = useState(0.4);
  const [fontsReady, setFontsReady] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const stageRef = useRef<StageHandle>(null);
  const area = useRef<HTMLDivElement>(null);
  const { doc, products, layout } = state;
  const scale = zoom ?? fit;
  const selected = doc.elements.find((e) => e.id === selectedId) ?? null;

  // Fontes antes do primeiro desenho
  useEffect(() => {
    ensureFonts([...EDITOR_FONTS.filter((f) => doc.elements.some((e) => e.type === "text" && e.fontFamily === f)), ...Object.values(ctx.brandKit.fonts)]).then(() => setFontsReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ajuste de zoom à área disponível
  useEffect(() => {
    const el = area.current; if (!el) return;
    const ro = new ResizeObserver(() => setFit(Math.max(0.05, Math.min((el.clientWidth - 48) / doc.width, (el.clientHeight - 48) / doc.height))));
    ro.observe(el); return () => ro.disconnect();
  }, [doc.width, doc.height]);

  // Aviso ao sair com alterações não salvas
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  /** Aplica uma alteração com histórico (desfazer/refazer). `coalesce` agrupa digitação contínua. */
  // Referência síncrona do estado atual (eventos rápidos do canvas não usam closures antigas).
  const stateRef = useRef(state);
  const historyRef = useRef({ past, future });
  historyRef.current = { past, future };

  const apply = useCallback((s: Snapshot) => { stateRef.current = s; setState(s); }, []);

  const commit = useCallback((next: Partial<Snapshot>, coalesce?: string) => {
    if (readOnly) return;
    const cur = stateRef.current;
    const now = Date.now();
    const same = !!coalesce && lastCoalesce.current?.key === coalesce && now - lastCoalesce.current.t < 800;
    lastCoalesce.current = coalesce ? { key: coalesce, t: now } : null;
    if (!same) setPast([...historyRef.current.past.slice(-99), cur]);
    setFuture([]);
    const products = next.products ?? cur.products;
    let doc = next.doc ?? cur.doc;
    if (next.products) doc = syncBoundTexts(doc, products);
    apply({ doc, products, layout: next.layout ?? cur.layout });
    setDirty(true);
  }, [readOnly, apply]);

  const undo = useCallback(() => {
    const { past: p, future: f } = historyRef.current;
    if (!p.length) return;
    setFuture([stateRef.current, ...f]);
    setPast(p.slice(0, -1));
    apply(p[p.length - 1]);
    lastCoalesce.current = null;
    setDirty(true);
  }, [apply]);
  const redo = useCallback(() => {
    const { past: p, future: f } = historyRef.current;
    if (!f.length) return;
    setPast([...p, stateRef.current]);
    setFuture(f.slice(1));
    apply(f[0]);
    lastCoalesce.current = null;
    setDirty(true);
  }, [apply]);

  const updateEl = useCallback((id: string, patch: Partial<FlyerElement>, coalesce?: string) => {
    const d = stateRef.current.doc;
    commit({ doc: { ...d, elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as FlyerElement) : e)) } }, coalesce);
  }, [commit]);

  function addEl(el: FlyerElement) {
    commit({ doc: { ...doc, elements: [...doc.elements, el] } });
    setSelectedId(el.id);
  }
  function removeSelected() {
    if (!selected || selected.locked) return;
    commit({ doc: { ...doc, elements: doc.elements.filter((e) => e.id !== selected.id) } });
    setSelectedId(null);
  }
  function duplicateSelected() {
    if (!selected || selected.role === "logo") return;
    const copy = { ...selected, id: newId(), name: `${selected.name} (cópia)`, x: selected.x + 20, y: selected.y + 20, locked: false } as FlyerElement;
    addEl(copy);
  }
  function reorder(id: string, to: "up" | "down" | "top" | "bottom") {
    const els = [...doc.elements];
    const i = els.findIndex((e) => e.id === id);
    const [el] = els.splice(i, 1);
    const j = to === "up" ? Math.min(els.length, i + 1) : to === "down" ? Math.max(0, i - 1) : to === "top" ? els.length : 0;
    els.splice(j, 0, el);
    commit({ doc: { ...doc, elements: els } });
  }
  function align(dir: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") {
    if (!selected || selected.locked) return;
    const p: Partial<FlyerElement> = {};
    if (dir === "left") p.x = 0; if (dir === "right") p.x = doc.width - selected.width; if (dir === "hcenter") p.x = (doc.width - selected.width) / 2;
    if (dir === "top") p.y = 0; if (dir === "bottom") p.y = doc.height - selected.height; if (dir === "vcenter") p.y = (doc.height - selected.height) / 2;
    updateEl(selected.id, p);
  }

  const save = useCallback(async (): Promise<number | null> => {
    if (readOnly) return version;
    setSaving(true);
    try {
      const thumb = stageRef.current?.toDataURL({ mimeType: "image/jpeg", quality: 0.82, maxSide: 480 });
      const r = await api<{ version: number }>(`/api/flyers/${initial.id}`, {
        method: "PUT",
        json: { name: meta.name.trim() || "Sem nome", campaign: meta.campaign.trim() || null, formatKey: initial.formatKey, width: initial.width, height: initial.height, products: state.products, layoutConfig: state.layout, canvasState: state.doc, thumbnailDataUrl: thumb, baseVersion: version },
      });
      setVersion(r.version);
      setDirty(false);
      toast.success("Projeto salvo.");
      return r.version;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally { setSaving(false); }
  }, [readOnly, version, initial, meta, state, toast]);

  // Atalhos de teclado
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable]")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selected) { e.preventDefault(); removeSelected(); }
      else if (e.key === "Escape") setSelectedId(null);
      else if (selected && !selected.locked && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        updateEl(selected.id, { x: selected.x + (e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0), y: selected.y + (e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0) }, `nudge-${selected.id}`);
      }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  function regenerate() {
    const next = composeFlyer({ width: initial.width, height: initial.height, products, options: layout, brand: brandFromContext(ctx, layout.mascotFileId) });
    commit({ doc: next });
    setSelectedId(null);
    setRegenOpen(false);
    toast.success("Layout regenerado. Use Desfazer para voltar.");
  }

  async function addImage(files: File[], purpose = "element") {
    try {
      const [f] = await uploadFiles(files.slice(0, 1), purpose);
      const nw = f.width ?? 800, nh = f.height ?? 800;
      const s = Math.min((doc.width * 0.4) / nw, (doc.height * 0.4) / nh, 1);
      addEl(imageEl(f.id, nw, nh, (doc.width - nw * s) / 2, (doc.height - nh * s) / 2, nw * s, nh * s, f.name));
    } catch (e) { toast.error((e as Error).message); }
  }
  function addBrandAsset(a: { fileId: string; width: number; height: number; name: string }, role: FlyerElement["role"]) {
    const s = Math.min((doc.width * 0.3) / a.width, (doc.height * 0.3) / a.height);
    addEl({ ...imageEl(a.fileId, a.width, a.height, doc.width * 0.05, doc.height * 0.05, a.width * s, a.height * s, a.name), role });
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100">
      {/* Barra superior */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3">
        <Link href="/estudio" className="btn-icon btn-ghost" aria-label="Voltar ao Estúdio" onClick={(e) => { if (dirty && !confirm("Há alterações não salvas. Sair mesmo assim?")) e.preventDefault(); }}><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0">
          <input className="w-full max-w-[260px] truncate rounded px-1 font-display text-sm font-bold text-ink hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" value={meta.name} readOnly={readOnly} onChange={(e) => { setMeta({ ...meta, name: e.target.value }); setDirty(true); }} aria-label="Nome do projeto" />
          <p className="truncate px-1 text-[11px] text-ink-muted">{categoryLabel(layout.category)} · {getFormat(initial.formatKey)?.label} · {initial.width}×{initial.height}px · v{version}{readOnly && ` · somente leitura (${initial.ownerName})`}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-icon btn-ghost" onClick={undo} disabled={!past.length || readOnly} title="Desfazer (Ctrl+Z)" aria-label="Desfazer"><Undo2 className="h-4 w-4" /></button>
          <button className="btn-icon btn-ghost" onClick={redo} disabled={!future.length || readOnly} title="Refazer (Ctrl+Y)" aria-label="Refazer"><Redo2 className="h-4 w-4" /></button>
          <span className="mx-1 hidden h-6 w-px bg-slate-200 md:block" />
          <div className="hidden items-center gap-0.5 md:flex">
            <button className="btn-icon btn-ghost" onClick={() => setZoom(Math.max(0.05, scale / 1.25))} aria-label="Diminuir zoom"><Minus className="h-4 w-4" /></button>
            <button className="btn-ghost btn-sm w-14" onClick={() => setZoom(null)} title="Ajustar à tela">{Math.round(scale * 100)}%</button>
            <button className="btn-icon btn-ghost" onClick={() => setZoom(Math.min(4, scale * 1.25))} aria-label="Aumentar zoom"><Plus className="h-4 w-4" /></button>
            <button className="btn-icon btn-ghost" onClick={() => setZoom(null)} title="Ajustar à tela" aria-label="Ajustar à tela"><Maximize className="h-4 w-4" /></button>
            <button className={cn("btn-icon", showGrid ? "bg-brand-50 text-brand-700" : "btn-ghost")} onClick={() => setShowGrid((g) => !g)} title="Grade" aria-pressed={showGrid}><Grid3x3 className="h-4 w-4" /></button>
            <button className={cn("btn-icon", snap ? "bg-brand-50 text-brand-700" : "btn-ghost")} onClick={() => setSnap((s) => !s)} title="Encaixar na grade" aria-pressed={snap}><Magnet className="h-4 w-4" /></button>
          </div>
          <span className="mx-1 h-6 w-px bg-slate-200" />
          {!readOnly && <button className="btn-secondary btn-sm" onClick={() => save()} disabled={saving || !dirty}>{saving ? <Spinner /> : <Save className="h-4 w-4" />}<span className="hidden sm:inline">{dirty ? "Salvar" : "Salvo"}</span></button>}
          <button className="btn-accent btn-sm" onClick={() => setExportOpen(true)}><Download className="h-4 w-4" /><span className="hidden sm:inline">Exportar</span></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Painel esquerdo */}
        <aside className="order-2 flex max-h-[42vh] w-full shrink-0 flex-col border-t border-slate-200 bg-white md:order-1 md:max-h-none md:w-[340px] md:border-r md:border-t-0">
          <nav className="grid grid-cols-4 border-b border-slate-100" aria-label="Painéis">
            {([["elementos", "Elementos", Shapes], ["produtos", "Produtos", Package], ["layout", "Modelo", LayoutTemplate], ["camadas", "Camadas", Layers]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => setTab(k)} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", tab === k ? "border-b-2 border-brand-600 text-brand-700" : "text-ink-muted hover:text-ink")}><I className="h-4 w-4" />{l}</button>
            ))}
          </nav>
          <div className="thin-scroll flex-1 overflow-y-auto p-3">
            {tab === "elementos" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-secondary" disabled={readOnly} onClick={() => addEl(textEl(doc, ctx))}><Type className="h-4 w-4" />Texto</button>
                  <label className={cn("btn-secondary cursor-pointer", readOnly && "pointer-events-none opacity-50")}><ImagePlus className="h-4 w-4" />Imagem<input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files && addImage(Array.from(e.target.files))} /></label>
                  <button className="btn-secondary" disabled={readOnly} onClick={() => addEl(shapeEl("rect", doc, ctx))}><Square className="h-4 w-4" />Retângulo</button>
                  <button className="btn-secondary" disabled={readOnly} onClick={() => addEl(shapeEl("ellipse", doc, ctx))}><Circle className="h-4 w-4" />Círculo</button>
                </div>
                {ctx.brandKit.logo && (
                  <div>
                    <p className="label">Logotipo oficial</p>
                    <button className="flex h-16 w-full items-center justify-center rounded-lg border border-slate-200 bg-white p-2 hover:border-brand-300" disabled={readOnly} onClick={() => addBrandAsset({ ...ctx.brandKit.logo!, name: "Logotipo Digitusul" }, "logo")}>
                      <img src={ctx.brandKit.logo.url} alt="Logotipo" className="max-h-full object-contain" />
                    </button>
                  </div>
                )}
                {ctx.brandKit.mascots.length > 0 && <AssetGrid title="Mascote Digu" items={ctx.brandKit.mascots} disabled={readOnly} onPick={(a) => addBrandAsset(a, "mascot")} />}
                {ctx.brandKit.elements.length > 0 && <AssetGrid title="Elementos institucionais" items={ctx.brandKit.elements} disabled={readOnly} onPick={(a) => addBrandAsset(a, "custom")} />}
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-ink-muted">
                  <p className="mb-1 font-semibold text-ink-soft">Atalhos</p>
                  Ctrl+Z desfazer · Ctrl+Y refazer · Ctrl+S salvar · Ctrl+D duplicar · Del excluir · setas movem (Shift = 10px)
                </div>
              </div>
            )}
            {tab === "produtos" && (
              <div>
                <p className="mb-3 text-xs text-ink-muted">Alterações aqui atualizam automaticamente os textos vinculados no flyer (código, nome, preço).</p>
                {readOnly ? <ReadOnlyProducts products={products} /> : <ProductsEditor compact ctx={ctx} products={products} onChange={(p) => commit({ products: p }, "products")} />}
                {!readOnly && <button className="btn-secondary mt-4 w-full" onClick={() => setRegenOpen(true)}><Wand2 className="h-4 w-4" />Regerar layout com os produtos</button>}
              </div>
            )}
            {tab === "layout" && (
              <div className="space-y-4">
                {!readOnly && <AiComposer ctx={ctx} layout={layout} productNames={products.map((p) => p.name)} onApply={(l) => { commit({ layout: l }); setRegenOpen(true); }} />}
                <LayoutOptionsForm ctx={ctx} layout={layout} onChange={(l) => commit({ layout: l }, "layout")} />
                {!readOnly && <button className="btn-primary w-full" onClick={() => setRegenOpen(true)}><Wand2 className="h-4 w-4" />Aplicar modelo (regerar layout)</button>}
                <div className="border-t border-slate-100 pt-3">
                  <p className="label">Fundo do flyer</p>
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-9 w-12 rounded border border-slate-200" value={toHex(doc.background.color)} disabled={readOnly} onChange={(e) => commit({ doc: { ...doc, background: { ...doc.background, color: e.target.value.toUpperCase() } } }, "bg")} aria-label="Cor de fundo" />
                    <label className={cn("btn-secondary btn-sm cursor-pointer", readOnly && "pointer-events-none opacity-50")}>Imagem de fundo<input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={async (e) => { if (!e.target.files) return; try { const [f] = await uploadFiles([e.target.files[0]], "background"); commit({ doc: { ...doc, background: { ...doc.background, imageFileId: f.id } } }); } catch (err) { toast.error((err as Error).message); } }} /></label>
                    {doc.background.imageFileId && <button className="btn-ghost btn-sm" disabled={readOnly} onClick={() => commit({ doc: { ...doc, background: { ...doc.background, imageFileId: null } } })}>Remover</button>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{ctx.brandKit.colors.map((c) => <button key={c.key} title={c.name} disabled={readOnly} className="h-6 w-6 rounded-full ring-1 ring-slate-200" style={{ background: c.hex }} onClick={() => commit({ doc: { ...doc, background: { ...doc.background, color: c.hex } } })} />)}</div>
                </div>
              </div>
            )}
            {tab === "camadas" && (
              <ul className="space-y-1">
                {[...doc.elements].reverse().map((e) => (
                  <li key={e.id} className={cn("flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm", e.id === selectedId ? "bg-brand-50" : "hover:bg-slate-50")}>
                    <button className="min-w-0 flex-1 truncate text-left" onClick={() => setSelectedId(e.id)}>
                      <span className={cn(!e.visible && "text-slate-400 line-through")}>{e.name}</span>
                      {e.binding && <Link2 className="ml-1 inline h-3 w-3 text-brand-500" aria-label="vinculado ao produto" />}
                    </button>
                    <button className="btn-icon btn-ghost p-1" disabled={readOnly} onClick={() => updateEl(e.id, { visible: !e.visible })} aria-label={e.visible ? "Ocultar" : "Mostrar"}>{e.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>
                    <button className="btn-icon btn-ghost p-1" disabled={readOnly} onClick={() => updateEl(e.id, { locked: !e.locked })} aria-label={e.locked ? "Desbloquear" : "Bloquear"}>{e.locked ? <Lock className="h-3.5 w-3.5 text-amber-600" /> : <Unlock className="h-3.5 w-3.5" />}</button>
                    <button className="btn-icon btn-ghost p-1" disabled={readOnly} onClick={() => reorder(e.id, "up")} aria-label="Trazer para frente"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button className="btn-icon btn-ghost p-1" disabled={readOnly} onClick={() => reorder(e.id, "down")} aria-label="Enviar para trás"><ChevronDown className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Canvas */}
        <div ref={area} className="relative order-1 min-h-[40vh] min-w-0 flex-1 overflow-auto md:order-2">
          <div className="flex min-h-full min-w-full items-center justify-center p-6" style={{ width: doc.width * scale + 48, height: doc.height * scale + 48 }}>
            {fontsReady ? (
              <div className="shadow-pop">
                <FlyerStage ref={stageRef} doc={doc} scale={scale} editable={!readOnly} selectedId={selectedId} onSelect={setSelectedId} onChange={(id, p) => updateEl(id, p)} showGrid={showGrid} snap={snap} gridSize={Math.round(Math.min(doc.width, doc.height) / 24)} />
              </div>
            ) : <Spinner className="h-6 w-6 text-brand-600" />}
          </div>
        </div>

        {/* Propriedades */}
        <aside className="order-3 hidden w-[300px] shrink-0 border-l border-slate-200 bg-white lg:block">
          <div className="thin-scroll h-full overflow-y-auto p-3">
            {selected ? (
              <Properties el={selected} readOnly={readOnly} products={products} ctx={ctx} doc={doc}
                onChange={(p, k) => updateEl(selected.id, p, k)}
                onProduct={(id, patch) => commit({ products: products.map((x) => (x.id === id ? { ...x, ...patch } : x)) })}
                onAlign={align} onReorder={(to) => reorder(selected.id, to)} onDelete={removeSelected} onDuplicate={duplicateSelected} />
            ) : (
              <div className="space-y-3 text-sm text-ink-muted">
                <p className="font-display font-bold text-ink">Nenhum elemento selecionado</p>
                <p>Clique em um elemento no flyer ou na lista de camadas para editar suas propriedades.</p>
                <p className="rounded-lg bg-brand-50 p-3 text-xs text-brand-800"><Link2 className="mr-1 inline h-3 w-3" />Textos de código, nome e preço são vinculados ao cadastro do produto e sempre exibem os dados exatos.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} stage={stageRef.current} logoIds={brandLogoIds(ctx)}
        project={{ id: initial.id, name: meta.name, campaign: meta.campaign, formatKey: initial.formatKey, width: initial.width, height: initial.height, products, layout, doc, version }}
        ensureSaved={async () => (dirty && !readOnly ? save() : version)} onSelectElement={(id) => setSelectedId(id)} />
      <ConfirmDialog open={regenOpen} title="Regerar layout?" confirmLabel="Regerar" onCancel={() => setRegenOpen(false)} onConfirm={regenerate}
        message="O motor de layout vai recompor o flyer com os produtos e o modelo atuais. Ajustes manuais no canvas serão substituídos (você pode desfazer com Ctrl+Z)." />
    </div>
  );
}

// ───────────────────────── Propriedades ─────────────────────────

function Properties({ el, readOnly, products, ctx, doc, onChange, onProduct, onAlign, onReorder, onDelete, onDuplicate }: {
  el: FlyerElement; readOnly: boolean; products: Product[]; ctx: StudioContext; doc: FlyerDocument;
  onChange: (p: Partial<FlyerElement>, coalesce?: string) => void; onProduct: (id: string, patch: Partial<Product>) => void;
  onAlign: (d: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => void; onReorder: (to: "up" | "down" | "top" | "bottom") => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const dis = readOnly || el.locked;
  const product = el.binding ? products.find((p) => p.id === el.binding!.productId) : null;
  const num = (k: "x" | "y" | "width" | "height" | "rotation", label: string) => (
    <Field label={label}><input type="number" className="input px-2 py-1.5" disabled={dis || (el.role === "logo" && k === "rotation")} value={Math.round(el[k])}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (el.type === "image" && (k === "width" || k === "height")) {
          const r = el.width / el.height; // proporção travada
          onChange(k === "width" ? { width: v, height: v / r } : { height: v, width: v * r }, `${k}-${el.id}`);
        } else onChange({ [k]: v } as Partial<FlyerElement>, `${k}-${el.id}`);
      }} /></Field>
  );
  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-sm font-bold text-ink">{el.name}</p>
        <p className="text-[11px] text-ink-muted">{{ text: "Texto", image: "Imagem", rect: "Retângulo", ellipse: "Círculo", polygon: "Forma" }[el.type]}{el.role === "logo" && " · logotipo protegido"}{el.binding && " · vinculado ao produto"}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        <button className="btn-secondary btn-sm" disabled={readOnly} onClick={() => onChange({ locked: !el.locked })}>{el.locked ? <><Unlock className="h-3.5 w-3.5" />Desbloquear</> : <><Lock className="h-3.5 w-3.5" />Bloquear</>}</button>
        <button className="btn-secondary btn-sm" disabled={readOnly || el.role === "logo"} onClick={onDuplicate}><Copy className="h-3.5 w-3.5" />Duplicar</button>
        <button className="btn-danger btn-sm" disabled={dis} onClick={onDelete}><Trash2 className="h-3.5 w-3.5" />Excluir</button>
      </div>
      {el.role === "logo" && <p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">O logotipo mantém sempre a proporção original, sem rotação, recorte ou recoloração.</p>}

      <section>
        <p className="label">Alinhar na página</p>
        <div className="grid grid-cols-6 gap-1">
          {([["left", AlignStartVertical], ["hcenter", AlignCenterVertical], ["right", AlignEndVertical], ["top", AlignStartHorizontal], ["vcenter", AlignCenterHorizontal], ["bottom", AlignEndHorizontal]] as const).map(([d, I]) => (
            <button key={d} className="btn-icon btn-ghost border border-slate-200" disabled={dis} onClick={() => onAlign(d)} aria-label={`Alinhar ${d}`}><I className="h-4 w-4" /></button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        {num("x", "X")}{num("y", "Y")}{num("width", "Largura")}{num("height", "Altura")}{num("rotation", "Rotação")}
        <Field label="Opacidade"><input type="range" min={0} max={1} step={0.05} disabled={dis} value={el.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) }, `op-${el.id}`)} className="mt-2 w-full" /></Field>
      </section>

      <section>
        <p className="label">Ordem</p>
        <div className="grid grid-cols-4 gap-1">
          <button className="btn-icon btn-ghost border border-slate-200" disabled={readOnly} onClick={() => onReorder("top")} aria-label="Trazer para o topo"><ChevronsUp className="h-4 w-4" /></button>
          <button className="btn-icon btn-ghost border border-slate-200" disabled={readOnly} onClick={() => onReorder("up")} aria-label="Avançar"><ChevronUp className="h-4 w-4" /></button>
          <button className="btn-icon btn-ghost border border-slate-200" disabled={readOnly} onClick={() => onReorder("down")} aria-label="Recuar"><ChevronDown className="h-4 w-4" /></button>
          <button className="btn-icon btn-ghost border border-slate-200" disabled={readOnly} onClick={() => onReorder("bottom")} aria-label="Enviar para o fundo"><ChevronsDown className="h-4 w-4" /></button>
        </div>
      </section>

      {el.type === "text" && <TextProps el={el} dis={dis} readOnly={readOnly} product={product ?? null} ctx={ctx} onChange={onChange} onProduct={onProduct} />}
      {el.type === "image" && <ImageProps el={el} dis={dis} onChange={onChange} />}
      {(el.type === "rect" || el.type === "ellipse") && <ShapeProps el={el} dis={dis} ctx={ctx} onChange={onChange} />}
      {el.type === "polygon" && <Field label="Cor"><ColorInput value={el.fill} disabled={dis} ctx={ctx} onChange={(c) => onChange({ fill: c }, `fill-${el.id}`)} /></Field>}
      <p className="text-[10px] text-slate-400">Canvas {doc.width}×{doc.height}px</p>
    </div>
  );
}

function TextProps({ el, dis, readOnly, product, ctx, onChange, onProduct }: { el: TextElement; dis: boolean; readOnly: boolean; product: Product | null; ctx: StudioContext; onChange: (p: Partial<FlyerElement>, k?: string) => void; onProduct: (id: string, patch: Partial<Product>) => void }) {
  const field = el.binding?.field;
  const [price, setPrice] = useState(product?.priceCents != null ? formatPrice(product.priceCents).replace("R$ ", "") : "");
  useEffect(() => setPrice(product?.priceCents != null ? formatPrice(product.priceCents).replace("R$ ", "") : ""), [product?.priceCents]);
  return (
    <section className="space-y-2 border-t border-slate-100 pt-3">
      {el.binding && product ? (
        <div className="rounded-lg bg-brand-50 p-2.5">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-brand-800"><Link2 className="h-3 w-3" />Dado comercial do produto</p>
          {field === "price" ? (
            <Field label="Preço final (R$)"><input className="input" disabled={readOnly} value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => { const c = parsePriceInput(price); if (c != null && c > 0) onProduct(product.id, { priceCents: c, priceFromRule: false, priceUncertain: false }); else setPrice(product.priceCents != null ? formatPrice(product.priceCents).replace("R$ ", "") : ""); }} /></Field>
          ) : field === "code" ? (
            <Field label="Código"><input className="input" disabled={readOnly} value={product.code} onChange={(e) => onProduct(product.id, { code: e.target.value })} /></Field>
          ) : field === "name" ? (
            <Field label="Nome completo"><textarea className="input" disabled={readOnly} value={product.name} onChange={(e) => onProduct(product.id, { name: e.target.value })} /></Field>
          ) : (
            <Field label="Texto"><input className="input" disabled={readOnly} value={(product[field as "description" | "brand" | "extra"] as string) ?? ""} onChange={(e) => onProduct(product.id, { [field as string]: e.target.value })} /></Field>
          )}
          <p className="mt-1 text-[10px] text-brand-800/80">Alterar aqui atualiza o cadastro do produto e todos os textos vinculados.</p>
        </div>
      ) : (
        <Field label="Texto"><textarea className="input min-h-[70px]" disabled={dis} value={el.text} onChange={(e) => onChange({ text: e.target.value }, `text-${el.id}`)} /></Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fonte" className="col-span-2"><select className="input" disabled={dis} value={el.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })} style={{ fontFamily: el.fontFamily }}>{EDITOR_FONTS.map((f) => <option key={f}>{f}</option>)}</select></Field>
        <Field label="Tamanho"><input type="number" min={4} className="input" disabled={dis} value={Math.round(el.fontSize)} onChange={(e) => onChange({ fontSize: Math.max(4, Number(e.target.value)) }, `fs-${el.id}`)} /></Field>
        <Field label="Peso"><select className="input" disabled={dis} value={el.fontStyle} onChange={(e) => onChange({ fontStyle: e.target.value as TextElement["fontStyle"] })}>
          <option value="normal">Regular</option><option value="bold">Negrito</option><option value="800">Extra negrito</option><option value="900">Black</option><option value="italic">Itálico</option><option value="bold italic">Negrito itálico</option>
        </select></Field>
        <Field label="Alinhamento"><select className="input" disabled={dis} value={el.align} onChange={(e) => onChange({ align: e.target.value as TextElement["align"] })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></Field>
        <Field label="Vertical"><select className="input" disabled={dis} value={el.verticalAlign} onChange={(e) => onChange({ verticalAlign: e.target.value as TextElement["verticalAlign"] })}><option value="top">Topo</option><option value="middle">Meio</option><option value="bottom">Base</option></select></Field>
        <Field label="Entrelinha"><input type="number" step={0.05} min={0.6} max={3} className="input" disabled={dis} value={el.lineHeight} onChange={(e) => onChange({ lineHeight: Number(e.target.value) }, `lh-${el.id}`)} /></Field>
        <Field label="Espaçamento"><input type="number" step={0.5} className="input" disabled={dis} value={el.letterSpacing} onChange={(e) => onChange({ letterSpacing: Number(e.target.value) }, `ls-${el.id}`)} /></Field>
        <Field label="Cor" className="col-span-2"><ColorInput value={el.fill} disabled={dis} ctx={ctx} onChange={(c) => onChange({ fill: c }, `fill-${el.id}`)} /></Field>
      </div>
    </section>
  );
}

function ImageProps({ el, dis, onChange }: { el: ImageElement; dis: boolean; onChange: (p: Partial<FlyerElement>, k?: string) => void }) {
  if (el.role === "logo") return null;
  return (
    <section className="space-y-2 border-t border-slate-100 pt-3">
      <Field label="Enquadramento"><select className="input" disabled={dis} value={el.fit} onChange={(e) => onChange({ fit: e.target.value as ImageElement["fit"], zoom: 1, focusX: 0.5, focusY: 0.5 })}>
        <option value="contain">Imagem inteira (recomendado para produtos)</option><option value="cover">Preencher a área (recorta)</option>
      </select></Field>
      {el.fit === "cover" && <>
        <Field label={`Zoom (${el.zoom.toFixed(2)}×)`}><input type="range" min={1} max={4} step={0.05} disabled={dis} value={el.zoom} onChange={(e) => onChange({ zoom: Number(e.target.value) }, `z-${el.id}`)} className="w-full" /></Field>
        <Field label="Posição horizontal"><input type="range" min={0} max={1} step={0.01} disabled={dis} value={el.focusX} onChange={(e) => onChange({ focusX: Number(e.target.value) }, `fx-${el.id}`)} className="w-full" /></Field>
        <Field label="Posição vertical"><input type="range" min={0} max={1} step={0.01} disabled={dis} value={el.focusY} onChange={(e) => onChange({ focusY: Number(e.target.value) }, `fy-${el.id}`)} className="w-full" /></Field>
      </>}
      <Field label="Cantos arredondados"><input type="number" min={0} className="input" disabled={dis} value={el.cornerRadius} onChange={(e) => onChange({ cornerRadius: Math.max(0, Number(e.target.value)) }, `cr-${el.id}`)} /></Field>
      <p className="text-[11px] text-ink-muted">Imagens são sempre redimensionadas com a proporção original — sem distorção.</p>
    </section>
  );
}

function ShapeProps({ el, dis, ctx, onChange }: { el: ShapeElement; dis: boolean; ctx: StudioContext; onChange: (p: Partial<FlyerElement>, k?: string) => void }) {
  return (
    <section className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
      <Field label="Preenchimento" className="col-span-2"><ColorInput value={el.fill} disabled={dis} ctx={ctx} onChange={(c) => onChange({ fill: c }, `fill-${el.id}`)} /></Field>
      <Field label="Borda" className="col-span-2"><ColorInput value={el.stroke || "#000000"} disabled={dis} ctx={ctx} onChange={(c) => onChange({ stroke: c }, `st-${el.id}`)} /></Field>
      <Field label="Espessura"><input type="number" min={0} className="input" disabled={dis} value={el.strokeWidth} onChange={(e) => onChange({ strokeWidth: Math.max(0, Number(e.target.value)) }, `sw-${el.id}`)} /></Field>
      {el.type === "rect" && <Field label="Cantos"><input type="number" min={0} className="input" disabled={dis} value={Math.round(el.cornerRadius)} onChange={(e) => onChange({ cornerRadius: Math.max(0, Number(e.target.value)) }, `cr-${el.id}`)} /></Field>}
    </section>
  );
}

function ColorInput({ value, onChange, disabled, ctx }: { value: string; onChange: (c: string) => void; disabled?: boolean; ctx: StudioContext }) {
  return (
    <div>
      <div className="flex gap-2">
        <input type="color" className="h-9 w-12 shrink-0 rounded border border-slate-200" disabled={disabled} value={toHex(value)} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <input className="input font-mono text-xs" disabled={disabled} value={value} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && onChange(e.target.value.toUpperCase())} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">{ctx.brandKit.colors.map((c) => <button key={c.key} title={c.name} disabled={disabled} className="h-5 w-5 rounded-full ring-1 ring-slate-200" style={{ background: c.hex }} onClick={() => onChange(c.hex)} />)}</div>
    </div>
  );
}

function AssetGrid({ title, items, onPick, disabled }: { title: string; items: { fileId: string; url: string; width: number; height: number; name: string }[]; onPick: (a: { fileId: string; width: number; height: number; name: string }) => void; disabled?: boolean }) {
  return (
    <div>
      <p className="label">{title}</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((a) => (
          <button key={a.fileId} disabled={disabled} title={a.name} onClick={() => onPick(a)} className="flex aspect-square items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 hover:border-brand-300">
            <img src={a.url} alt={a.name} className="max-h-full max-w-full object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyProducts({ products }: { products: Product[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {products.map((p) => <li key={p.id} className="rounded-lg border border-slate-200 p-2"><p className="font-semibold">{p.name}</p><p className="text-xs text-ink-muted">Cód. {p.code} · {p.priceCents != null ? formatPrice(p.priceCents) : "sem preço"}</p></li>)}
    </ul>
  );
}

// ───────────────────────── fábricas de elementos ─────────────────────────

const base = (name: string, x: number, y: number, w: number, h: number) => ({ id: newId(), name, x, y, width: w, height: h, rotation: 0, opacity: 1, locked: false, visible: true, role: "custom" as const });

function textEl(doc: FlyerDocument, ctx: StudioContext): TextElement {
  const fs = Math.round(Math.min(doc.width, doc.height) * 0.06);
  return { ...base("Texto", doc.width * 0.1, doc.height * 0.45, doc.width * 0.8, fs * 1.6), type: "text", text: "Novo texto", fontFamily: ctx.brandKit.fonts.heading, fontSize: fs, fontStyle: "bold", fill: ctx.brandKit.colors.find((c) => c.key === "dark")?.hex ?? "#0B1A4A", align: "center", verticalAlign: "middle", lineHeight: 1.15, letterSpacing: 0 };
}
function shapeEl(type: "rect" | "ellipse", doc: FlyerDocument, ctx: StudioContext): ShapeElement {
  const s = Math.min(doc.width, doc.height) * 0.25;
  return { ...base(type === "rect" ? "Retângulo" : "Círculo", (doc.width - s) / 2, (doc.height - s) / 2, s, s), type, fill: ctx.brandKit.colors.find((c) => c.key === "accent")?.hex ?? "#E61F27", stroke: "", strokeWidth: 0, cornerRadius: type === "rect" ? s * 0.08 : 0 };
}
function imageEl(fileId: string, nw: number, nh: number, x: number, y: number, w: number, h: number, name: string): ImageElement {
  return { ...base(name || "Imagem", x, y, w, h), type: "image", fileId, naturalWidth: nw, naturalHeight: nh, fit: "contain", focusX: 0.5, focusY: 0.5, zoom: 1, cornerRadius: 0 };
}
function toHex(c: string) {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#FFFFFF";
}
