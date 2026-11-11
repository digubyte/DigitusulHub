"use client";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";

const FOLDER_KEY = "digitusul.claudeFolder";
const CLAUDE_ORANGE = "#D97757";

/** Mascote em pixel art digitando (SVG + CSS, sem imagem externa). */
export function ClaudeMascot({ size = 30 }: { size?: number }) {
  const o = CLAUDE_ORANGE;
  return (
    <svg viewBox="0 0 22 16" width={size} height={(size * 16) / 22} shapeRendering="crispEdges" aria-hidden className="cc-mascot">
      <g className="cc-body">
        <rect x="5" y="1" width="12" height="8" fill={o} />
        <rect x="4" y="3" width="1" height="3" fill={o} />
        <rect x="17" y="3" width="1" height="3" fill={o} />
        <rect x="8" y="3" width="1" height="2" fill="#1c1917" className="cc-eye" />
        <rect x="13" y="3" width="1" height="2" fill="#1c1917" className="cc-eye" />
        <rect x="6" y="9" width="1" height="2" fill={o} />
        <rect x="9" y="9" width="1" height="2" fill={o} />
        <rect x="12" y="9" width="1" height="2" fill={o} />
        <rect x="15" y="9" width="1" height="2" fill={o} />
      </g>
      <rect x="3" y="6" width="2" height="5" fill={o} className="cc-arm-l" />
      <rect x="17" y="6" width="2" height="5" fill={o} className="cc-arm-r" />
      <rect x="1" y="12" width="20" height="3" rx="0.5" fill="#44403c" />
      {[3, 6, 9, 12, 15, 18].map((x, i) => (
        <rect key={x} x={x} y="13" width="2" height="1" fill="#a8a29e" className="cc-key" style={{ animationDelay: `${i * 0.13}s` }} />
      ))}
    </svg>
  );
}

function claudeLink(folder: string, prompt: string, terminal = false) {
  return terminal
    ? `claude-cli://open?cwd=${encodeURIComponent(folder)}&q=${encodeURIComponent(prompt)}`
    : `claude://code/new?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(prompt)}`;
}

/**
 * Abre uma sessão do Claude Code (app do Claude no computador) já com o comando do lote escrito.
 * Por segurança o app nunca envia sozinho: a pessoa só aperta Enter.
 * A pasta do projeto fica salva neste navegador (é diferente em cada computador).
 */
export function CallClaudeButton({ prompt, label = "Chamar o Claude" }: { prompt: string; label?: string }) {
  const toast = useToast();
  const [folder, setFolder] = useState("");
  const [asking, setAsking] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setFolder(localStorage.getItem(FOLDER_KEY) ?? ""); } catch { /* sem localStorage */ }
  }, []);
  useEffect(() => {
    if (!asking) return;
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAsking(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [asking]);

  function open(terminal = false) {
    const f = folder.trim();
    if (!f) { setAsking(true); return; }
    try { localStorage.setItem(FOLDER_KEY, f); } catch { /* ignora */ }
    window.location.href = claudeLink(f, prompt, terminal);
    setAsking(false);
    toast.info("Abrindo o Claude… no app, confira o comando e aperte Enter.");
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-stretch">
        <button type="button" onClick={() => open()} className="cc-button" title={`Abre o Claude Code com: ${prompt}`}>
          <ClaudeMascot />
          <span>{label}</span>
        </button>
        <button type="button" onClick={() => setAsking((v) => !v)} className="cc-button-more" aria-label="Configurar pasta do projeto">▾</button>
      </div>
      {asking && (
        <div className="absolute right-0 z-30 mt-2 w-80 space-y-2 rounded-xl border border-zinc-200 bg-surface p-3 text-[13px] shadow-pop">
          <p className="font-medium">Pasta do projeto neste computador</p>
          <input className="input text-xs" autoFocus placeholder="C:\Users\...\Documents\Digitusul\DigitusulHub" value={folder}
            onChange={(e) => setFolder(e.target.value)} onKeyDown={(e) => e.key === "Enter" && open()} />
          <p className="text-[12px] text-zinc-500">Fica salva só neste navegador. O app abre já com <code className="rounded bg-zinc-100 px-1">{prompt}</code> escrito.</p>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm flex-1" disabled={!folder.trim()} onClick={() => open()}>Abrir no app</button>
            <button className="btn-ghost btn-sm" disabled={!folder.trim()} onClick={() => open(true)} title="Abre o Claude Code num terminal">Terminal</button>
          </div>
        </div>
      )}
    </div>
  );
}
