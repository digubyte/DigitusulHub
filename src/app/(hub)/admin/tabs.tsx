"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/core/util";

export function AdminTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções da administração" className="thin-scroll -mx-4 overflow-x-auto border-b border-zinc-200 px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cn("block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold", active ? "border-brand-600 text-brand-700" : "border-transparent text-ink-muted hover:text-ink")}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
