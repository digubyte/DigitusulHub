"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { HubLogo } from "./logo";
import { ModuleIcon } from "./icons";
import { cn } from "@/core/util";

export interface ShellNavItem { key: string; name: string; icon: string; route: string; status: string; section: string }
export interface ShellUser { name: string; email: string; roleName: string }

export function AppShell({ nav, user, children }: { nav: ShellNavItem[]; user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  // O editor ocupa a tela inteira
  const fullBleed = /^\/estudio\/[^/]+$/.test(pathname) && pathname !== "/estudio/novo";

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

  const sidebar = (
    <nav aria-label="Navegação principal" className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" aria-label="Início"><HubLogo className="h-6" /></Link>
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((s) => s.items.length > 0 && (
          <div key={s.key} className="mt-4">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
            <ul className="space-y-0.5">
              {s.items.map((item) => {
                const active = pathname === item.route || pathname.startsWith(item.route + "/");
                return (
                  <li key={item.key}>
                    <Link
                      href={item.route}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                        active ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-slate-100 hover:text-ink",
                      )}
                    >
                      <ModuleIcon name={item.icon} className={cn("h-[18px] w-[18px]", active ? "text-brand-600" : "text-slate-400 group-hover:text-ink-soft")} />
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.status === "development" && <span className="badge bg-slate-100 text-[10px] text-slate-500">Em breve</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white" aria-hidden>{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-ink-muted">{user.roleName}</p>
          </div>
          <button className="btn-icon btn-ghost" onClick={logout} disabled={loggingOut} title="Sair" aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className={cn("hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:block", fullBleed && "lg:hidden")}>{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-pop">
            <button className="btn-icon btn-ghost absolute right-2 top-3" onClick={() => setOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className={cn("flex min-w-0 flex-1 flex-col", !fullBleed && "lg:pl-64")}>
        <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden", fullBleed && "hidden")}>
          <button className="btn-icon btn-ghost" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
          <HubLogo className="h-5" />
        </header>
        <main className={cn("flex-1", fullBleed ? "" : "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8")}>{children}</main>
      </div>
    </div>
  );
}
