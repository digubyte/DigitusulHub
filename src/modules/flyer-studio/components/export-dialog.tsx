"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileJson, FileImage, FileText } from "lucide-react";
import { api, Modal, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/core/util";
import { getFormat } from "../domain/formats";
import { validateFlyer, type ValidationIssue } from "../domain/validation";
import type { FlyerDocument, LayoutOptions, Product } from "../domain/types";
import { preloadAll } from "./image-cache";
import type { StageHandle } from "./flyer-stage";

type Fmt = "png" | "jpg" | "pdf" | "json";

export function ExportDialog({ open, onClose, stage, project, logoIds, ensureSaved, onSelectElement }: {
  open: boolean; onClose: () => void; stage: StageHandle | null;
  project: { id: string; name: string; formatKey: string; width: number; height: number; products: Product[]; layout: LayoutOptions; doc: FlyerDocument; version: number; campaign: string };
  logoIds: string[]; ensureSaved: () => Promise<number | null>; onSelectElement: (id: string) => void;
}) {
  const toast = useToast();
  const [fmt, setFmt] = useState<Fmt>("png");
  const [failed, setFailed] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);

  const imageIds = useMemo(() => [
    ...project.doc.elements.filter((e) => e.type === "image" && e.visible).map((e) => (e as { fileId: string }).fileId),
    ...(project.doc.background.imageFileId ? [project.doc.background.imageFileId] : []),
  ], [project.doc]);

  useEffect(() => {
    if (!open) return;
    setChecking(true);
    preloadAll(imageIds).then(setFailed).finally(() => setChecking(false));
  }, [open, imageIds]);

  const issues: ValidationIssue[] = useMemo(() => validateFlyer(project.doc, project.products, {
    expectedWidth: project.width, expectedHeight: project.height, brandLogoFileIds: logoIds, failedImageIds: failed,
  }), [project, logoIds, failed]);
  const errors = issues.filter((i) => i.level === "error");
  const blocked = fmt !== "json" && errors.length > 0;

  const slug = project.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "flyer";

  async function run() {
    if (!stage) return;
    setBusy(true);
    try {
      const version = await ensureSaved();
      if (version == null) return;
      if (fmt === "json") {
        const data = { kind: "digitusul-hub/flyer", schema: 1, exportedAt: new Date().toISOString(), project: { name: project.name, campaign: project.campaign, formatKey: project.formatKey, width: project.width, height: project.height, products: project.products, layoutConfig: project.layout, canvasState: project.doc } };
        await api(`/api/flyers/${project.id}/export`, { method: "POST", json: { format: "json", width: project.width, height: project.height, version } });
        save(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `${slug}.dhflyer.json`);
        toast.success("Arquivo editável exportado.");
        return onClose();
      }
      const mime = fmt === "jpg" ? "image/jpeg" : "image/png";
      const url = stage.toDataURL({ mimeType: mime, quality: fmt === "jpg" ? 0.95 : undefined });
      const dims = await imageSize(url);
      // Garantia de resolução: o arquivo precisa ter exatamente as dimensões do formato.
      if (dims.width !== project.width || dims.height !== project.height) {
        throw new Error(`Falha de resolução: gerado ${dims.width}×${dims.height}px, esperado ${project.width}×${project.height}px.`);
      }
      await api(`/api/flyers/${project.id}/export`, { method: "POST", json: { format: fmt, width: dims.width, height: dims.height, version } });
      if (fmt === "pdf") {
        const { jsPDF } = await import("jspdf");
        const f = getFormat(project.formatKey);
        const page = f?.pageMm ?? { width: project.width, height: project.height };
        const unit = f?.pageMm ? "mm" : "px";
        const pdf = new jsPDF({ orientation: page.width > page.height ? "landscape" : "portrait", unit, format: [page.width, page.height], hotfixes: ["px_scaling"] });
        pdf.addImage(stage.toDataURL({ mimeType: "image/jpeg", quality: 0.95 }), "JPEG", 0, 0, page.width, page.height);
        pdf.setProperties({ title: project.name });
        pdf.save(`${slug}.pdf`);
      } else {
        save(await (await fetch(url)).blob(), `${slug}.${fmt}`);
      }
      toast.success(`Exportado em ${project.width}×${project.height}px.`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const options: { key: Fmt; label: string; desc: string; icon: typeof FileImage }[] = [
    { key: "png", label: "PNG", desc: "Alta qualidade, sem perdas", icon: FileImage },
    { key: "jpg", label: "JPG", desc: "Arquivo menor (qualidade 95%)", icon: FileImage },
    { key: "pdf", label: "PDF", desc: getFormat(project.formatKey)?.pageMm ? "Página A4 para impressão" : "Página no tamanho do flyer", icon: FileText },
    { key: "json", label: "Editável (.dhflyer.json)", desc: "Reabre no Digitusul Hub", icon: FileJson },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Exportar flyer" size="lg" footer={
      <>
        <span className="mr-auto self-center text-xs text-ink-muted">{project.width}×{project.height}px · sem marca d’água</span>
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-accent" onClick={run} disabled={busy || checking || blocked}>{busy ? <Spinner /> : <Download className="h-4 w-4" />}Exportar</button>
      </>
    }>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button key={o.key} onClick={() => setFmt(o.key)} className={cn("flex items-start gap-3 rounded-xl border p-3 text-left", fmt === o.key ? "border-brand-600 ring-2 ring-brand-600/20" : "border-slate-200 hover:border-brand-300")}>
            <o.icon className="mt-0.5 h-5 w-5 text-brand-600" />
            <span><span className="block text-sm font-semibold">{o.label}</span><span className="text-xs text-ink-muted">{o.desc}</span></span>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-semibold">Validação antes da exportação</p>
        {checking ? <p className="flex items-center gap-2 text-sm text-ink-muted"><Spinner />Verificando imagens…</p> : issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Códigos, preços, nomes, imagens, área útil, logotipo e dimensões conferidos.</p>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {issues.map((x, i) => (
              <li key={i} className={cn("flex items-start gap-1.5 text-xs", x.level === "error" ? "text-accent-600" : "text-amber-700")}>
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="flex-1">{x.message}</span>
                {x.elementId && <button className="font-semibold underline" onClick={() => { onSelectElement(x.elementId!); onClose(); }}>localizar</button>}
              </li>
            ))}
          </ul>
        )}
        {blocked && <p className="mt-2 text-xs font-semibold text-accent-600">Corrija os erros para exportar a imagem. O formato editável continua disponível.</p>}
      </div>
    </Modal>
  );
}

function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((res, rej) => { const i = new window.Image(); i.onload = () => res({ width: i.naturalWidth, height: i.naturalHeight }); i.onerror = rej; i.src = url; });
}
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20_000);
}
