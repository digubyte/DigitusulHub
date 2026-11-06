import { BarChart3, LayoutDashboard, Megaphone, Palette, Settings, ShieldCheck, TrendingUp, Users, Boxes, type LucideIcon } from "lucide-react";

/** Ícones disponíveis para manifestos de módulos (registry.ts → icon). */
export const MODULE_ICONS: Record<string, LucideIcon> = { LayoutDashboard, Palette, TrendingUp, Users, Megaphone, BarChart3, Settings, ShieldCheck };

export function ModuleIcon({ name, className }: { name: string; className?: string }) {
  const I = MODULE_ICONS[name] ?? Boxes;
  return <I className={className} aria-hidden />;
}
