"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { HubLogo } from "./logo";
import { ModuleIcon } from "./icons";
import { cn } from "@/core/util";

export interface ShellNavItem { key: string; name: string; icon: string; route: string; status: string; section: string }
export interface ShellUser { name: string; email: string; roleName: string }

const COLLAPSE_KEY = "dh:sidebar-collapsed";

export function AppShell({ nav, user, children }: { nav: ShellNavItem[]; user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch {} }, []);
  function toggleCollapsed() {
    setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch {} return !c; });
  }

  // O editor ocupa a tela inteira
  const fullBleed = /^\/estudio\/[^/]+$/.test(pathname) && !["/estudio/novo", "/estudio/lote"].includes(pathname) && !pathname.startsWith("/estudio/lote");

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const sections = [
    { key: "main", label: "Módulos", items: nav.filter((n) => n.section === "main") },
    { key: "system", label: "Sistema", items: nav.filter((n) => n.section === "system") },
  ];

  const sidebar = (mini: boolean) => (
    <nav aria-label="Navegação principal" className="flex h-full flex-col">
      <div className={cn("flex h-16 items-center", mini ? "justify-center" : "justify-between pl-5 pr-3")}>
        {!mini && <Link href="/dashboard" aria-label="Início"><HubLogo className="h-[22px]" /></Link>}
        <button className="btn-icon btn-ghost hidden h-8 w-8 lg:inline-flex" onClick={toggleCollapsed} aria-label={mini ? "Expandir menu" : "Recolher menu"} title={mini ? "Expandir menu" : "Recolher menu"}>
          {mini ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((s) => s.items.length > 0 && (
          <div key={s.key} className="mt-3 first:mt-1">
            {!mini && <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-zinc-400">{s.label}</p>}
            {mini && s.key === "system" && <div className="mx-2 my-2 border-t border-zinc-200" />}
            <ul className="space-y-0.5">
              {s.items.map((item) => {
                const active = pathname === item.route || pathname.startsWith(item.route + "/");
                return (
                  <li key={item.key}>
                    <Link
                      href={item.route}
                      title={mini ? item.name : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg text-[13.5px] font-medium transition-colors",
                        mini ? "h-9 justify-center" : "px-2.5 py-[7px]",
                        active ? "bg-white text-ink shadow-card ring-1 ring-zinc-200/80" : "text-zinc-500 hover:bg-zinc-200/50 hover:text-ink",
                      )}
                    >
                      <ModuleIcon name={item.icon} className={cn("h-[17px] w-[17px] shrink-0", active ? "text-brand-600" : "text-zinc-400 group-hover:text-zinc-600")} />
                      {!mini && <span className="flex-1 truncate">{item.name}</span>}
                      {!mini && item.status === "development" && <span className="text-[10px] font-medium text-zinc-400">em breve</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="p-3">
        <div className={cn("flex items-center gap-2.5 rounded-xl", mini ? "flex-col" : "px-1.5 py-1.5")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white" title={mini ? `${user.name} · ${user.roleName}` : undefined} aria-hidden>{initials}</div>
          {!mini && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
              <p className="truncate text-xs text-zinc-500">{user.roleName}</p>
            </div>
          )}
          <button className="btn-icon btn-ghost h-8 w-8" onClick={logout} disabled={loggingOut} title="Sair" aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );

  const sideW = collapsed ? "lg:w-[68px]" : "lg:w-60";
  const padL = collapsed ? "lg:pl-[68px]" : "lg:pl-60";

  return (
    <div className="min-h-screen lg:flex">
      <aside className={cn("hidden shrink-0 border-r border-zinc-200/70 bg-zinc-50 lg:fixed lg:inset-y-0 lg:block", sideW, fullBleed && "lg:hidden")}>{sidebar(collapsed)}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-zinc-900/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-zinc-50 shadow-pop">
            <button className="btn-icon btn-ghost absolute right-2 top-3.5" onClick={() => setOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button>
            {sidebar(false)}
          </aside>
        </div>
      )}
      <div className={cn("flex min-w-0 flex-1 flex-col", !fullBleed && padL)}>
        <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-200/70 bg-white/80 px-4 backdrop-blur lg:hidden", fullBleed && "hidden")}>
          <button className="btn-icon btn-ghost" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
          <HubLogo className="h-5" />
        </header>
        <main className={cn("flex-1", fullBleed ? "" : "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10")}>{children}</main>
      </div>
    </div>
  );
}
