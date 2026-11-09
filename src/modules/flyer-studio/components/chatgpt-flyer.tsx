"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Check, ClipboardCopy, Download, ExternalLink, FileArchive, ImageUp, Pencil, RotateCcw } from "lucide-react";
import { api, Spinner } from "@/components/ui/primitives";
import { Dropzone, uploadFiles } from "@/components/upload/dropzone";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/core/util";
import { formatPrice } from "../domain/product-format";
import type { LayoutOptions, Product } from "../domain/types";
import { buildAttachmentsZip, CHATGPT_URL, copyText, downloadBlob, fileSlug, fitToFormat, originalFile } from "./chatgpt-assets";
import type { StudioContext } from "./studio-types";

export interface ChatGptFlyer {
  id: string; name: string; products: Product[]; prompt: string; resultFileId: string | null;
  width: number; height: number; formatKey: string; canEdit: boolean; layout: LayoutOptions;
}

export function attachmentSetFor(f: ChatGptFlyer, ctx: StudioContext) {
  const mascot = f.layout.showMascot ? (ctx.brandKit.mascots.find((m) => m.fileId === f.layout.mascotFileId) ?? ctx.brandKit.mascots[0]) : null;
  return { products: f.products, logoFileId: ctx.brandKit.logo?.fileId ?? null, mascotFileId: mascot?.fileId ?? null };
}

/** Um flyer do fluxo ChatGPT: anexos → prompt → ChatGPT → arte → conferência → download. */
export function ChatGptFlyerCard({ flyer, ctx, index, onChange }: { flyer: ChatGptFlyer; ctx: StudioContext; index?: number; onChange: (f: ChatGptFlyer) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; width: number | null; height: number | null } | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [promptDraft, setPromptDraft] = useState(flyer.prompt);
  const hasAttachments = flyer.products.some((p) => p.imageFileId) || !!ctx.brandKit.logo;
  const done = !!flyer.resultFileId;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  const downloadAttachments = () => run("zip", async () => {
    const zip = await buildAttachmentsZip([{ set: attachmentSetFor(flyer, ctx) }]);
    if (!zip) return toast.info("Este flyer não tem imagens para anexar.");
    downloadBlob(zip, `imagens-${fileSlug(flyer.name)}.zip`);
  });

  async function copyAndOpen() {
    const ok = await copyText(flyer.prompt);
    setCopied(ok);
    if (ok) toast.success("Prompt copiado. No ChatGPT: anexe as imagens e cole com Ctrl+V.");
    else toast.error("Não foi possível copiar. Abra o prompt e copie manualmente.");
    window.open(CHATGPT_URL, "_blank", "noopener");
  }

  const upload = (files: File[]) => run("upload", async () => {
    const [f] = await uploadFiles(files.slice(0, 1), "result");
    setPending({ id: f.id, width: f.width, height: f.height });
    setChecked(new Set());
  });

  const saveResult = () => run("save", async () => {
    await api(`/api/flyers/${flyer.id}/chatgpt`, { method: "POST", json: { fileId: pending!.id, checked: true } });
    onChange({ ...flyer, resultFileId: pending!.id });
    setPending(null);
    toast.success("Arte salva no histórico.");
  });

  const resetResult = () => run("reset", async () => {
    await api(`/api/flyers/${flyer.id}/chatgpt`, { method: "POST", json: { fileId: null, checked: false } });
    onChange({ ...flyer, resultFileId: null });
  });

  const savePrompt = () => run("prompt", async () => {
    await api(`/api/flyers/${flyer.id}/chatgpt`, { method: "PUT", json: { prompt: promptDraft } });
    onChange({ ...flyer, prompt: promptDraft.trim() });
    setEditing(false);
    toast.success("Prompt atualizado.");
  });

  const download = (exact: boolean) => run(exact ? "exact" : "orig", async () => {
    const blob = exact ? await fitToFormat(flyer.resultFileId!, flyer.width, flyer.height) : await originalFile(flyer.resultFileId!);
    const ext = exact ? "png" : (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
    downloadBlob(blob, `${fileSlug(flyer.name)}${exact ? `-${flyer.width}x${flyer.height}` : ""}.${ext}`);
    api(`/api/flyers/${flyer.id}/export`, { method: "POST", json: { format: "png", width: exact ? flyer.width : 0, height: exact ? flyer.height : 0, version: 0 } }).catch(() => {});
  });

  const allChecked = flyer.products.every((p) => checked.has(p.id));
  const preview = pending?.id ?? flyer.resultFileId;

  return (
    <article className="card flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
        {index != null && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] font-medium">{index + 1}</span>}
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{flyer.name}</p>
        <span className={cn("badge", done ? "bg-emerald-50 text-emerald-700" : pending ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500")}>{done ? "Pronto" : pending ? "Conferir" : "Aguardando arte"}</span>
      </header>

      <div className="grid flex-1 gap-4 p-4 sm:grid-cols-[150px_1fr]">
        <div className="mx-auto flex aspect-[4/5] w-full max-w-[200px] items-center justify-center overflow-hidden rounded-lg bg-zinc-100/80 sm:max-w-none sm:self-start">
          {preview ? <img src={`/api/files/${preview}`} alt={`Arte de ${flyer.name}`} className="h-full w-full object-contain" />
            : flyer.products.find((p) => p.imageFileId) ? <img src={`/api/files/${flyer.products.find((p) => p.imageFileId)!.imageFileId}`} alt="" className="h-full w-full bg-white object-contain p-4 opacity-60" />
            : <ImageUp className="h-6 w-6 text-zinc-300" />}
        </div>

        <div className="min-w-0 space-y-3">
          <ul className="space-y-1 text-[13px]">
            {flyer.products.map((p) => (
              <li key={p.id} className="flex items-baseline gap-2">
                {pending && <input type="checkbox" className="translate-y-[2px] accent-zinc-900" aria-label={`Conferido: ${p.name}`} checked={checked.has(p.id)} onChange={(e) => { const s = new Set(checked); if (e.target.checked) s.add(p.id); else s.delete(p.id); setChecked(s); }} />}
                <span className="min-w-0 flex-1 truncate">{p.name} <span className="text-zinc-400">· {p.code}</span></span>
                <span className="font-medium tabular-nums">{formatPrice(p.priceCents ?? 0)}</span>
              </li>
            ))}
          </ul>

          {pending ? (
            <div className="space-y-2 rounded-lg bg-amber-50/70 p-3 text-[13px]">
              <p className="text-amber-900">Compare a arte com a lista: marque cada produto cujo <strong>nome, código e preço</strong> estão exatamente iguais. Se algum estiver errado, peça a correção no ChatGPT.</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary btn-sm" disabled={!allChecked || busy === "save"} onClick={saveResult}>{busy === "save" ? <Spinner /> : <Check className="h-3.5 w-3.5" />}Tudo confere, salvar</button>
                <button className="btn-ghost btn-sm" onClick={() => setPending(null)}>Cancelar</button>
              </div>
            </div>
          ) : done ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary btn-sm" onClick={() => download(true)} disabled={!!busy}>{busy === "exact" ? <Spinner /> : <Download className="h-3.5 w-3.5" />}Baixar {flyer.width}×{flyer.height}</button>
              <button className="btn-secondary btn-sm" onClick={() => download(false)} disabled={!!busy}>Original</button>
              {flyer.canEdit && <button className="btn-ghost btn-sm" onClick={resetResult} disabled={!!busy}><RotateCcw className="h-3.5 w-3.5" />Gerar de novo</button>}
            </div>
          ) : flyer.canEdit ? (
            <ol className="space-y-2 text-[13px]">
              <Step n={1} label="Baixar imagens para anexar" done={false}>
                <button className="btn-secondary btn-sm" onClick={downloadAttachments} disabled={!hasAttachments || !!busy}>{busy === "zip" ? <Spinner /> : <FileArchive className="h-3.5 w-3.5" />}{hasAttachments ? "Baixar ZIP" : "Sem imagens"}</button>
              </Step>
              <Step n={2} label="Copiar prompt e abrir o ChatGPT" done={copied}>
                <button className="btn-accent btn-sm" onClick={copyAndOpen}><ClipboardCopy className="h-3.5 w-3.5" />Copiar e abrir<ExternalLink className="h-3 w-3 opacity-70" /></button>
              </Step>
              <Step n={3} label="Enviar a arte gerada" done={false}>
                <div className="w-full"><Dropzone compact multiple={false} busy={busy === "upload"} onFiles={upload} label="Arraste a imagem ou clique" /></div>
              </Step>
            </ol>
          ) : <p className="text-[13px] text-zinc-500">Aguardando a arte do responsável.</p>}

          <div className="border-t border-zinc-100 pt-2">
            {editing ? (
              <div className="space-y-2">
                <textarea className="input min-h-[260px] font-mono text-xs leading-relaxed" value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm" onClick={savePrompt} disabled={busy === "prompt"}>{busy === "prompt" && <Spinner />}Salvar prompt</button>
                  <button className="btn-ghost btn-sm" onClick={() => { setEditing(false); setPromptDraft(flyer.prompt); }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <details className="group text-[13px]">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-zinc-500 hover:text-ink">Ver prompt</summary>
                <pre className="thin-scroll mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-700">{flyer.prompt}</pre>
                <div className="mt-2 flex gap-2">
                  <button className="btn-ghost btn-sm" onClick={() => copyText(flyer.prompt).then((ok) => ok && toast.success("Prompt copiado."))}><ClipboardCopy className="h-3.5 w-3.5" />Copiar</button>
                  {flyer.canEdit && <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Editar</button>}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Step({ n, label, done, children }: { n: number; label: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium", done ? "bg-zinc-900 text-surface" : "bg-zinc-100 text-zinc-500")}>{done ? <Check className="h-3 w-3" /> : n}</span>
      <span className="min-w-[10rem] flex-1 text-zinc-600">{label}</span>
      {children}
    </li>
  );
}
