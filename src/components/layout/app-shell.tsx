"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, KeyRound, LogOut, Settings2, Sparkles } from "lucide-react";
import { HubLogo } from "./logo";
import { cn } from "@/core/util";

export interface ShellUser { name: string; email: string; roleName: string }

/** Barra superior simples: Criar flyers · Histórico · Admin. */
export function AppShell({ user, canCreate, canAdmin, children }: { user: ShellUser; canCreate: boolean; canAdmin: boolean; children: React.ReactNode }) {
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

  const links = [
    ...(canCreate ? [{ href: "/criar", label: "Criar flyers", icon: Sparkles, match: ["/criar"] }] : []),
    { href: "/estudio", label: "Histórico", icon: History, match: ["/estudio"] },
    ...(canAdmin ? [{ href: "/admin", label: "Admin", icon: Settings2, match: ["/admin"] }] : []),
  ];
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  if (fullBleed) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(35,65,193,.10),transparent)]" />
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link href="/criar" aria-label="Início" className="mr-3 shrink-0"><HubLogo className="h-5 sm:h-[22px]" /></Link>
          <nav aria-label="Navegação principal" className="flex flex-1 items-center gap-1">
            {links.map((l) => {
              const active = l.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
              return (
                <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                  className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition-colors", active ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-ink")}>
                  <l.icon className="h-4 w-4" /><span className="hidden sm:inline">{l.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenu(!menu)} className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white" aria-label="Menu da conta" aria-expanded={menu}>{initials}</button>
            {menu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-1 shadow-pop">
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
