"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileImage, FileUp, Layers, LayoutTemplate, MoreVertical, Pencil, Plus, Search, Sparkles, Trash2, Wrench } from "lucide-react";
import { api, ConfirmDialog, EmptyState, PageHeader, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn, relativeTime } from "@/core/util";
import { CATEGORIES, categoryLabel } from "../domain/brand";
import { getFormat } from "../domain/formats";
import type { StudioContext } from "./studio-types";

interface Item { id: string; name: string; category: string; campaign: string | null; formatKey: string; width: number; height: number; thumbnailId: string | null; isTemplate: boolean; updatedAt: string; ownerName: string; productCount: number; canEdit: boolean; canDelete: boolean; mode: string; batchId: string | null; resultFileId: string | null }
type Scope = "mine" | "all" | "templates";

export function StudioHome({ ctx, campaigns }: { ctx: StudioContext; campaigns: string[] }) {
  const toast = useToast();
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("mine");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [campaign, setCampaign] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ escopo: scope });
    if (q.trim()) sp.set("q", q.trim());
    if (category) sp.set("categoria", category);
    if (campaign) sp.set("campanha", campaign);
    try { setItems((await api<{ items: Item[] }>(`/api/flyers?${sp}`)).items); } catch (e) { toast.error((e as Error).message); setItems([]); }
  }, [scope, q, category, campaign]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  async function duplicate(it: Item, asTemplate = false) {
    setMenu(null);
    try {
      const r = await api<{ id: string }>(`/api/flyers/${it.id}/duplicate`, { method: "POST", json: { asTemplate } });
      toast.success(asTemplate ? "Template publicado para a equipe." : "Projeto duplicado.");
      if (asTemplate) load(); else router.push(`/estudio/${r.id}`);
    } catch (e) { toast.error((e as Error).message); }
  }
  async function remove() {
    if (!toDelete) return;
    setBusy(true);
    try { await api(`/api/flyers/${toDelete.id}`, { method: "DELETE" }); toast.success("Projeto excluído."); setToDelete(null); load(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function importFile(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (data?.kind !== "digitusul-hub/flyer" || !data.project) throw new Error("Arquivo não é um flyer editável do Digitusul Hub.");
      const p = data.project;
      const r = await api<{ id: string }>("/api/flyers", { method: "POST", json: { name: `${p.name} (importado)`, campaign: p.campaign || null, formatKey: p.formatKey, width: p.width, height: p.height, products: p.products, layoutConfig: p.layoutConfig, canvasState: p.canvasState } });
      toast.success("Projeto importado.");
      router.push(`/estudio/${r.id}`);
    } catch (e) { toast.error((e as Error).message.startsWith("Unexpected") ? "Arquivo inválido." : (e as Error).message); }
  }

  const scopes: { key: Scope; label: string; show: boolean }[] = [
    { key: "mine", label: "Meus flyers", show: true },
    { key: "all", label: "Equipe", show: ctx.perms.viewAll },
    { key: "templates", label: "Templates salvos", show: true },
  ];

  return (
    <div>
      <PageHeader title="Estúdio de Flyers" subtitle="Monte o pedido, aprove o prompt e gere a arte no ChatGPT — um flyer ou o lote do dia." actions={ctx.perms.create && (
        <>
          <label className="btn-ghost cursor-pointer" title="Importar arquivo editável (.json)"><FileUp className="h-4 w-4" />Importar<input type="file" hidden accept=".json,application/json" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} /></label>
          <Link href="/estudio/novo?modo=manual" className="btn-secondary" title="Montar no editor, com preço garantido ao centavo"><Wrench className="h-4 w-4" />Montar manualmente</Link>
          <Link href="/estudio/novo" className="btn-accent"><Plus className="h-4 w-4" />Novo flyer ou lote</Link>
        </>
      )} />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-0.5 rounded-lg bg-zinc-100 p-0.5">
          {scopes.filter((s) => s.show).map((s) => (
            <button key={s.key} onClick={() => setScope(s.key)} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium", scope === s.key ? "bg-white text-ink shadow-card" : "text-zinc-500 hover:text-ink")}>{s.label}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -tranzinc-y-1/2 text-zinc-400" />
          <input className="input pl-9" placeholder="Pesquisar por nome, campanha, código ou produto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar projetos" />
        </div>
        <select className="input lg:w-48" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select className="input lg:w-48" value={campaign} onChange={(e) => setCampaign(e.target.value)} aria-label="Filtrar por campanha">
          <option value="">Todas as campanhas</option>
          {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {items === null ? <div className="flex justify-center py-16"><Spinner className="h-6 w-6 text-brand-600" /></div> : items.length === 0 ? (
        <EmptyState icon={scope === "templates" ? <LayoutTemplate className="h-10 w-10" /> : <FileImage className="h-10 w-10" />}
          title={scope === "templates" ? "Nenhum template salvo" : q || category || campaign ? "Nada encontrado" : "Nenhum flyer ainda"}
          text={scope === "templates" ? "Abra um projeto e use “Salvar como template” no menu do card para compartilhar um modelo com a equipe." : "Comece criando um flyer com um ou vários produtos."}
          action={ctx.perms.create && scope !== "templates" && <Link href="/estudio/novo" className="btn-primary"><Plus className="h-4 w-4" />Criar novo flyer</Link>} />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.id} className="group relative">
              <Link href={it.isTemplate ? `/estudio/novo?template=${it.id}` : `/estudio/${it.id}`} className="block">
                <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-3 transition group-hover:border-zinc-300">
                  {it.thumbnailId ? <img src={`/api/files/${it.thumbnailId}`} alt="" className="max-h-full max-w-full object-contain" /> : it.mode === "chatgpt" ? <span className="flex flex-col items-center gap-2 text-xs text-zinc-400"><Sparkles className="h-6 w-6" />Aguardando arte</span> : <FileImage className="h-8 w-8 text-zinc-300" />}
                  {it.mode === "chatgpt" && <span className="badge absolute bottom-2 left-2 bg-white/90 text-zinc-600 ring-1 ring-zinc-200">ChatGPT</span>}
                </div>
                <div className="pt-2.5">
                  <p className="truncate text-sm font-medium text-ink">{it.name}</p>
                  <p className="truncate text-xs text-zinc-500">{categoryLabel(it.category)} · {getFormat(it.formatKey)?.label ?? it.formatKey}</p>
                  <p className="truncate text-xs text-zinc-400">{it.productCount} produto(s) · {relativeTime(it.updatedAt)}{scope !== "mine" && ` · ${it.ownerName}`}</p>
                  {it.campaign && <span className="badge mt-1.5 bg-brand-50 text-brand-700">{it.campaign}</span>}
                </div>
              </Link>
              <div className="absolute right-2 top-2">
                <button className="btn-icon h-8 w-8 bg-white/95 opacity-0 shadow-card ring-1 ring-zinc-200 transition group-hover:opacity-100 focus:opacity-100" aria-label="Ações" onClick={() => setMenu(menu === it.id ? null : it.id)}><MoreVertical className="h-4 w-4" /></button>
                {menu === it.id && (
                  <div className="absolute right-0 z-10 mt-1 w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-pop" onMouseLeave={() => setMenu(null)}>
                    {it.isTemplate ? (
                      <Link href={`/estudio/novo?template=${it.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"><Plus className="h-4 w-4" />Usar template</Link>
                    ) : (
                      <Link href={`/estudio/${it.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"><Pencil className="h-4 w-4" />{it.canEdit ? "Abrir e editar" : "Visualizar"}</Link>
                    )}
                    {ctx.perms.create && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50" onClick={() => duplicate(it)}><Copy className="h-4 w-4" />Duplicar</button>}
                    {it.batchId && <Link href={`/estudio/lote/${it.batchId}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"><Layers className="h-4 w-4" />Abrir lote</Link>}
                    {ctx.perms.templates && !it.isTemplate && it.mode !== "chatgpt" && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50" onClick={() => duplicate(it, true)}><LayoutTemplate className="h-4 w-4" />Salvar como template</button>}
                    {it.canDelete && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-accent-600 hover:bg-accent-50" onClick={() => { setMenu(null); setToDelete(it); }}><Trash2 className="h-4 w-4" />Excluir</button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!toDelete} danger busy={busy} title="Excluir projeto?" confirmLabel="Excluir" onCancel={() => setToDelete(null)} onConfirm={remove}
        message={<>O projeto <strong>{toDelete?.name}</strong> será removido da biblioteca. O histórico de versões é preservado para auditoria.</>} />
    </div>
  );
}
