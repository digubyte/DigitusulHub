"use client";
import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/core/util";
import { Spinner } from "@/components/ui/primitives";

export interface UploadedFile { id: string; name: string; mimeType: string; width: number | null; height: number | null; size: number; url: string }

const ACCEPT_IMAGES = "image/png,image/jpeg,image/webp";
const MAX = 10 * 1024 * 1024;

/** Envia arquivos para o armazenamento privado. Validação final acontece no servidor. */
export async function uploadFiles(files: File[], purpose: string): Promise<UploadedFile[]> {
  const tooBig = files.find((f) => f.size > MAX);
  if (tooBig) throw new Error(`"${tooBig.name}" é maior que 10 MB.`);
  const form = new FormData();
  form.append("purpose", purpose);
  files.forEach((f) => form.append("file", f));
  const res = await fetch("/api/files", { method: "POST", body: form }).catch(() => null);
  if (!res) throw new Error("Sem conexão com o servidor.");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Falha no envio.");
  return data.files;
}

export function Dropzone({ onFiles, multiple = true, accept = ACCEPT_IMAGES, label = "Arraste imagens aqui ou clique para escolher", hint = "PNG, JPG ou WEBP · até 10 MB cada", compact, busy }: {
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
        over ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40",
      )}
    >
      {busy ? <Spinner className="h-5 w-5 text-brand-600" /> : <ImagePlus className={cn("text-brand-600", compact ? "h-5 w-5" : "h-7 w-7")} />}
      <p className={cn("font-semibold text-ink", compact ? "text-xs" : "text-sm")}>{busy ? "Enviando…" : label}</p>
      {!compact && <p className="text-xs text-ink-muted">{hint} · também aceita Ctrl+V</p>}
      <input ref={input} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
