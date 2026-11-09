"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/core/util";

export const THEME_KEY = "dh:theme";

/**
 * Script executado antes da página aparecer: aplica o tema salvo (ou o do sistema)
 * para a tela não piscar em branco no modo escuro.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch {}
  }
  return (
    <button onClick={toggle} className={cn("btn-icon btn-ghost h-8 w-8", className)} aria-label={dark ? "Usar modo claro" : "Usar modo escuro"} title={dark ? "Modo claro" : "Modo escuro"}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
