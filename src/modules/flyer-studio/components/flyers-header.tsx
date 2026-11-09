import Link from "next/link";
import { History, Palette, Sparkles } from "lucide-react";
import { cn } from "@/core/util";

/** Cabeçalho da solução "Gerador de flyers" com as abas Criar | Histórico. */
export function FlyersHeader({ active, subtitle, canCreate = true }: { active: "criar" | "historico"; subtitle: string; canCreate?: boolean }) {
  const tabs = [
    ...(canCreate ? [{ key: "criar", label: "Criar", href: "/criar", icon: Sparkles }] : []),
    { key: "historico", label: "Histórico", href: "/estudio", icon: History },
  ];
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-card"><Palette className="h-5 w-5" /></div>
        <div>
          <p className="eyebrow"><Link href="/inicio" className="hover:text-ink">Digitusul Hub</Link> / Soluções</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[26px]">Gerador de flyers</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
        </div>
      </div>
      <nav aria-label="Seções do gerador" className="flex shrink-0 gap-0.5 self-start rounded-lg bg-zinc-100 p-0.5 sm:self-auto">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium", active === t.key ? "bg-surface text-ink shadow-card" : "text-zinc-500 hover:text-ink")}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
