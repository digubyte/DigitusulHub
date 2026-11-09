"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Copy, FileImage, Layers, LayoutTemplate, MoreVertical, Pencil, Plus, Search, Sparkles, Square, Trash2, X } from "lucide-react";
import { api, ConfirmDialog, EmptyState, Spinner } from "@/components/ui/primitives";
import { FlyersHeader } from "./flyers-header";
import { useToast } from "@/components/ui/toast";
import { cn, relativeTime } from "@/core/util";
import { categoryLabel } from "../domain/brand";
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
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<"selected" | "all" | null>(null);

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
  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function stopSelecting() { setSelecting(false); setSelected(new Set()); }
  const deletable = (items ?? []).filter((it) => it.canDelete);
  const allSelected = deletable.length > 0 && deletable.every((it) => selected.has(it.id));

  async function removeBulk() {
    if (!bulk) return;
    setBusy(true);
    try {
      const r = await api<{ deleted: number; skipped: number }>("/api/flyers/excluir", { method: "POST", json: bulk === "all" ? { all: true } : { ids: [...selected] } });
      toast.success(`${r.deleted} flyer(s) excluído(s).${r.skipped ? ` ${r.skipped} sem permissão ficaram.` : ""}`);
      setBulk(null); stopSelecting(); load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function remove() {
    if (!toDelete) return;
    setBusy(true);
    try { await api(`/api/flyers/${toDelete.id}`, { method: "DELETE" }); toast.success("Projeto excluído."); setToDelete(null); load(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }


  const scopes: { key: Scope; label: string; show: boolean }[] = [
    { key: "mine", label: "Meus flyers", show: true },
    { key: "all", label: "Equipe", show: ctx.perms.viewAll },
  ];

  return (
    <div>
      <FlyersHeader active="historico" canCreate={ctx.perms.create} subtitle="Todos os flyers gerados. Abra um para enviar ou baixar a arte." />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-0.5 rounded-lg bg-zinc-100 p-0.5">
          {scopes.filter((s) => s.show).map((s) => (
            <button key={s.key} onClick={() => setScope(s.key)} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium", scope === s.key ? "bg-surface text-ink shadow-card" : "text-zinc-500 hover:text-ink")}>{s.label}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input className="input pl-9" placeholder="Buscar por nome, código ou produto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar projetos" />
        </div>
        {!!items?.length && (selecting ? (
          <button className="btn-ghost" onClick={stopSelecting}><X className="h-4 w-4" />Cancelar seleção</button>
        ) : (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setSelecting(true)}><CheckSquare className="h-4 w-4" />Selecionar</button>
            {scope === "mine" && <button className="btn-danger" onClick={() => setBulk("all")}><Trash2 className="h-4 w-4" />Apagar todo o histórico</button>}
          </div>
        ))}
      </div>

      {selecting && (
        <div className="sticky top-16 z-20 mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-surface/95 px-4 py-2.5 shadow-pop backdrop-blur">
          <button className="btn-ghost btn-sm" onClick={() => setSelected(allSelected ? new Set() : new Set(deletable.map((it) => it.id)))}>
            {allSelected ? <CheckSquare className="h-4 w-4 text-brand-600" /> : <Square className="h-4 w-4" />}{allSelected ? "Desmarcar todos" : `Selecionar todos (${deletable.length})`}
          </button>
          <span className="flex-1 text-sm text-zinc-500">{selected.size} selecionado(s)</span>
          <button className="btn-danger btn-sm" disabled={!selected.size} onClick={() => setBulk("selected")}><Trash2 className="h-4 w-4" />Excluir selecionados</button>
        </div>
      )}

      {items === null ? <div className="flex justify-center py-16"><Spinner className="h-6 w-6 text-brand-600" /></div> : items.length === 0 ? (
        <EmptyState icon={scope === "templates" ? <LayoutTemplate className="h-10 w-10" /> : <FileImage className="h-10 w-10" />}
          title={scope === "templates" ? "Nenhum template salvo" : q || category || campaign ? "Nada encontrado" : "Nenhum flyer ainda"}
          text={scope === "templates" ? "Abra um projeto e use “Salvar como template” no menu do card para compartilhar um modelo com a equipe." : "Comece criando um flyer com um ou vários produtos."}
          action={ctx.perms.create && scope !== "templates" && <Link href="/criar" className="btn-primary"><Plus className="h-4 w-4" />Criar flyers</Link>} />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.id} className="group relative">
              {selecting && it.canDelete && (
                <button onClick={() => toggle(it.id)} aria-label={selected.has(it.id) ? `Desmarcar ${it.name}` : `Selecionar ${it.name}`} aria-pressed={selected.has(it.id)}
                  className={cn("absolute inset-0 z-10 rounded-xl text-left ring-2 transition", selected.has(it.id) ? "bg-brand-600/10 ring-brand-600" : "ring-transparent hover:ring-brand-300")}>
                  <span className={cn("absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 bg-surface", selected.has(it.id) ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-300")}>{selected.has(it.id) && "✓"}</span>
                </button>
              )}
              <Link href={it.isTemplate ? `/estudio/novo?template=${it.id}` : `/estudio/${it.id}`} className="block">
                <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-3 transition group-hover:border-zinc-300">
                  {it.thumbnailId ? <img src={`/api/files/${it.thumbnailId}`} alt="" className="max-h-full max-w-full object-contain" /> : it.mode === "chatgpt" ? <span className="flex flex-col items-center gap-2 text-xs text-zinc-400"><Sparkles className="h-6 w-6" />Aguardando arte</span> : <FileImage className="h-8 w-8 text-zinc-300" />}
                  {it.mode === "chatgpt" && <span className="badge absolute bottom-2 left-2 bg-surface/90 text-zinc-600 ring-1 ring-zinc-200">ChatGPT</span>}
                </div>
                <div className="pt-2.5">
                  <p className="truncate text-sm font-medium text-ink">{it.name}</p>
                  <p className="truncate text-xs text-zinc-500">{categoryLabel(it.category)} · {getFormat(it.formatKey)?.label ?? it.formatKey}</p>
                  <p className="truncate text-xs text-zinc-400">{it.productCount} produto(s) · {relativeTime(it.updatedAt)}{scope !== "mine" && ` · ${it.ownerName}`}</p>
                  {it.campaign && <span className="badge mt-1.5 bg-brand-50 text-brand-700">{it.campaign}</span>}
                </div>
              </Link>
              <div className={cn("absolute right-2 top-2", selecting && "hidden")}>
                <button className="btn-icon h-8 w-8 bg-surface/95 opacity-0 shadow-card ring-1 ring-zinc-200 transition group-hover:opacity-100 focus:opacity-100" aria-label="Ações" onClick={() => setMenu(menu === it.id ? null : it.id)}><MoreVertical className="h-4 w-4" /></button>
                {menu === it.id && (
                  <div className="absolute right-0 z-10 mt-1 w-52 rounded-xl border border-zinc-200 bg-surface p-1 shadow-pop" onMouseLeave={() => setMenu(null)}>
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

      <ConfirmDialog open={!!bulk} danger busy={busy} title={bulk === "all" ? "Apagar todo o histórico?" : `Excluir ${selected.size} flyer(s)?`} confirmLabel={bulk === "all" ? "Apagar tudo" : "Excluir"} onCancel={() => setBulk(null)} onConfirm={removeBulk}
        message={bulk === "all"
          ? <>Todos os <strong>seus</strong> flyers saem do histórico ({items?.length ?? 0} visíveis agora). Os de outras pessoas não são afetados. Isso não pode ser desfeito por aqui.</>
          : <>Os {selected.size} flyer(s) selecionados saem do histórico. Isso não pode ser desfeito por aqui.</>} />

      <ConfirmDialog open={!!toDelete} danger busy={busy} title="Excluir projeto?" confirmLabel="Excluir" onCancel={() => setToDelete(null)} onConfirm={remove}
        message={<>O projeto <strong>{toDelete?.name}</strong> será removido da biblioteca. O histórico de versões é preservado para auditoria.</>} />
    </div>
  );
}

