"use client";
import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/core/util";
import { Spinner } from "@/components/ui/primitives";

export interface UploadedFile { id: string; name: string; mimeType: string; width: number | null; height: number | null; size: number; url: string }

const ACCEPT_IMAGES = "image/png,image/jpeg,image/webp";
/** Mesmo limite do servidor (a hospedagem aceita até 4,5 MB por requisição). */
const MAX = 4 * 1024 * 1024;
const RASTER = ["image/png", "image/jpeg", "image/webp"];

/**
 * Fotos acima do limite são reduzidas no navegador mantendo a proporção
 * (sem recorte nem distorção) e recodificadas em WEBP, que preserva transparência.
 */
async function shrinkIfNeeded(f: File): Promise<File> {
  if (f.size <= MAX || !RASTER.includes(f.type)) return f;
  const bmp = await createImageBitmap(f);
  for (const maxSide of [4000, 3000, 2400, 1800]) {
    const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * s);
    canvas.height = Math.round(bmp.height * s);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.92));
    if (blob && blob.size <= MAX) return new File([blob], f.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  }
  throw new Error(`"${f.name}" é muito grande. Reduza a imagem para menos de 4 MB.`);
}

/** Envia arquivos (um por requisição) para o armazenamento privado. Validação final acontece no servidor. */
export async function uploadFiles(files: File[], purpose: string): Promise<UploadedFile[]> {
  const out: UploadedFile[] = [];
  for (const original of files) {
    const f = await shrinkIfNeeded(original);
    if (f.size > MAX) throw new Error(`"${f.name}" é maior que 4 MB.`);
    const form = new FormData();
    form.append("purpose", purpose);
    form.append("file", f);
    const res = await fetch("/api/files", { method: "POST", body: form }).catch(() => null);
    if (!res) throw new Error("Sem conexão com o servidor.");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || (res.status === 413 ? "Arquivo grande demais." : "Falha no envio."));
    out.push(...data.files);
  }
  return out;
}

export function Dropzone({ onFiles, multiple = true, accept = ACCEPT_IMAGES, label = "Arraste imagens aqui ou clique para escolher", hint = "PNG, JPG ou WEBP · fotos grandes são reduzidas automaticamente", compact, busy }: {
  onFiles: (files: File[]) => void; multiple?: boolean; accept?: string; label?: string; hint?: string; compact?: boolean; busy?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !busy && input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) take(e.dataTransfer.files); }}
      onPaste={(e) => take(e.clipboardData.files)}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        compact ? "gap-1 p-3" : "gap-2 p-6",
        over ? "border-brand-500 bg-brand-50" : "border-zinc-200 bg-zinc-50/60 hover:border-brand-300 hover:bg-brand-50/40",
      )}
    >
      {busy ? <Spinner className="h-5 w-5 text-brand-600" /> : <ImagePlus className={cn("text-brand-600", compact ? "h-5 w-5" : "h-7 w-7")} />}
      <p className={cn("font-semibold text-ink", compact ? "text-xs" : "text-sm")}>{busy ? "Enviando…" : label}</p>
      {!compact && <p className="text-xs text-ink-muted">{hint} · também aceita Ctrl+V</p>}
      <input ref={input} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
