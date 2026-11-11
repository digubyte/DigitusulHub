"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCopy, Download, ExternalLink, FileArchive, Presentation } from "lucide-react";
import { zipSync } from "fflate";
import { Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { getFormat } from "../domain/formats";
import { categoryLabel } from "../domain/brand";
import { attachmentSetFor, ChatGptFlyerCard, type ChatGptFlyer } from "./chatgpt-flyer";
import { buildAttachmentsZip, CHATGPT_URL, copyText, downloadBlob, fileSlug, fitToFormat } from "./chatgpt-assets";
import type { StudioContext } from "./studio-types";

export function ChatGptProjectView({ ctx, flyer, batchId }: { ctx: StudioContext; flyer: ChatGptFlyer; batchId: string | null }) {
  const [f, setF] = useState(flyer);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-6 flex items-center gap-3">
        <Link href={batchId ? `/estudio/lote/${batchId}` : "/estudio"} className="btn-icon btn-ghost -ml-2" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0">
          <p className="eyebrow">{categoryLabel(f.layout.category)} · {getFormat(f.formatKey)?.label} · {f.width}×{f.height}</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{f.name}</h1>
        </div>
      </div>
      <ChatGptFlyerCard flyer={f} ctx={ctx} onChange={setF} />
    </div>
  );
}

export function ChatGptBatchView({ ctx, flyers: initial, campaign, embedded, batchId }: { ctx: StudioContext; flyers: ChatGptFlyer[]; campaign: string | null; embedded?: boolean; batchId?: string | null }) {
  const toast = useToast();
  const [flyers, setFlyers] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const ready = flyers.filter((f) => f.resultFileId);
  const first = flyers[0];
  const title = first.name.replace(/ · \d+\/\d+$/, "");

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  const allAttachments = () => run("zip", async () => {
    const zip = await buildAttachmentsZip(flyers.map((f, i) => ({ folder: `flyer-${i + 1}`, set: attachmentSetFor(f, ctx) })));
    if (!zip) { toast.info("Nenhuma imagem para anexar."); return; }
    downloadBlob(zip, `imagens-${fileSlug(title)}.zip`);
  });

  const allResults = () => run("results", async () => {
    const files: Record<string, Uint8Array> = {};
    for (const [i, f] of flyers.entries()) {
      if (!f.resultFileId) continue;
      const b = await fitToFormat(f.resultFileId, f.width, f.height);
      files[`${String(i + 1).padStart(2, "0")}-${fileSlug(f.name)}.png`] = new Uint8Array(await b.arrayBuffer());
    }
    downloadBlob(new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: "application/zip" }), `${fileSlug(title)}-flyers.zip`);
  });

  async function copyAll() {
    const text = flyers.map((f, i) => `===== FLYER ${i + 1} de ${flyers.length}: ${f.name} =====\n\n${f.prompt}`).join("\n\n\n");
    if (await copyText(text)) toast.success("Todos os prompts copiados, um abaixo do outro.");
  }

  return (
    <div>
      <div className={embedded ? "mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" : "mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"}>
        {embedded ? (
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-200"><div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${(ready.length / flyers.length) * 100}%` }} /></div>
            <span className="text-xs text-zinc-500">{ready.length} de {flyers.length} prontos</span>
          </div>
        ) : (
        <div className="flex items-start gap-3">
          <Link href="/estudio" className="btn-icon btn-ghost -ml-2 mt-1" aria-label="Voltar ao Estúdio"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <p className="eyebrow">Lote · {categoryLabel(first.layout.category)} · {getFormat(first.formatKey)?.label}{campaign ? ` · ${campaign}` : ""}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-zinc-200"><div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${(ready.length / flyers.length) * 100}%` }} /></div>
              <span className="text-xs text-zinc-500">{ready.length} de {flyers.length} prontos</span>
            </div>
          </div>
        </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={allAttachments} disabled={!!busy}>{busy === "zip" ? <Spinner /> : <FileArchive className="h-4 w-4" />}{flyers.length > 1 ? "Imagens do lote" : "Imagens"}</button>
          {flyers.length > 1 && <button className="btn-secondary" onClick={copyAll}><ClipboardCopy className="h-4 w-4" />Copiar todos os prompts</button>}
          <a className="btn-secondary" href={CHATGPT_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />ChatGPT</a>
          {batchId && <Link className="btn-accent" href={`/estudio/lote/${batchId}/aprovar`}><Presentation className="h-4 w-4" />Aprovar flyers ({ready.filter((f) => (f.reviewStatus ?? "pending") === "pending").length})</Link>}
          <button className="btn-primary" onClick={allResults} disabled={!ready.length || !!busy}>{busy === "results" ? <Spinner /> : <Download className="h-4 w-4" />}Baixar prontos ({ready.length})</button>
        </div>
      </div>

      {!embedded && <p className="mb-6 max-w-3xl text-[13px] text-zinc-500">
        Faça um flyer por vez, no mesmo chat do ChatGPT. Em cada cartão: baixe as imagens, clique em <strong className="font-medium text-ink">Copiar e abrir</strong>, anexe as fotos, cole o prompt e envie. Quando a arte ficar pronta, baixe e arraste de volta no cartão.
      </p>}

      <div className={embedded ? "grid gap-4 lg:grid-cols-2" : "grid gap-4 xl:grid-cols-2"}>
        {flyers.map((f, i) => (
          <ChatGptFlyerCard key={f.id} flyer={f} ctx={ctx} index={i} onChange={(nf) => setFlyers((all) => all.map((x) => (x.id === nf.id ? nf : x)))} />
        ))}
      </div>
    </div>
  );
}
