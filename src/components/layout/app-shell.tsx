"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, KeyRound, LogOut, Settings2 } from "lucide-react";
import { HubLogo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { ModuleIcon } from "./icons";
import { cn } from "@/core/util";

export interface ShellUser { name: string; email: string; roleName: string }

export interface ShellSolution { key: string; name: string; icon: string; route: string }

/** Barra superior do Hub: Início · soluções ativas · Admin. */
export function AppShell({ user, solutions, canAdmin, children }: { user: ShellUser; solutions: ShellSolution[]; canAdmin: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  // O editor manual ocupa a tela inteira
  const fullBleed = /^\/estudio\/[^/]+$/.test(pathname) && pathname !== "/estudio/novo";

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  // Rotas que pertencem a cada solução (para marcar o item ativo).
  const extraMatch: Record<string, string[]> = { flyers: ["/estudio"] };
  const links = [
    { href: "/inicio", label: "Início", icon: <Home className="h-4 w-4" />, match: ["/inicio"] },
    ...solutions.map((s) => ({ href: s.route, label: s.name, icon: <ModuleIcon name={s.icon} className="h-4 w-4" />, match: [s.route, ...(extraMatch[s.key] ?? [])] })),
    ...(canAdmin ? [{ href: "/admin", label: "Admin", icon: <Settings2 className="h-4 w-4" />, match: ["/admin"] }] : []),
  ];
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  if (fullBleed) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(55%_100%_at_30%_0%,rgba(35,65,193,.16),transparent),radial-gradient(35%_70%_at_85%_0%,rgba(230,31,39,.07),transparent)]" />
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-surface/80 backdrop-blur">
        <div aria-hidden className="h-[3px] bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500" />
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link href="/inicio" aria-label="Início" className="mr-3 shrink-0"><HubLogo className="h-5 sm:h-[22px]" /></Link>
          <nav aria-label="Navegação principal" className="flex flex-1 items-center gap-1">
            {links.map((l) => {
              const active = l.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
              return (
                <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                  className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition-colors", active ? "bg-brand-600 text-white shadow-card" : "text-zinc-500 hover:bg-brand-50 hover:text-brand-700")}>
                  {l.icon}<span className="hidden sm:inline">{l.label}</span>
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenu(!menu)} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white" aria-label="Menu da conta" aria-expanded={menu}>{initials}</button>
            {menu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 bg-surface p-1 shadow-pop">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-zinc-500">{user.email}</p>
                </div>
                <div className="my-1 border-t border-zinc-100" />
                <Link href="/configuracoes" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"><KeyRound className="h-4 w-4 text-zinc-400" />Alterar senha</Link>
                <button onClick={logout} disabled={loggingOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50"><LogOut className="h-4 w-4 text-zinc-400" />Sair</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}
