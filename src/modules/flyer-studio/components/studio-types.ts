import type { BrandKitView } from "../services/brand-service";
import type { PricingRule } from "../domain/pricing";
import type { SiteCategory } from "../catalog/categories";
import type { FlyerDocument, LayoutOptions, Product } from "../domain/types";
import { brandContextFromKit } from "../domain/brand";

export interface StudioContext {
  brandKit: BrandKitView;
  pricingRule: PricingRule;
  aiEnabled: boolean;
  removeBgEnabled: boolean;
  siteCategories: SiteCategory[];
  perms: { create: boolean; ai: boolean; templates: boolean; viewAll: boolean };
  userName: string;
}

export interface ProjectState {
  id?: string;
  name: string;
  campaign: string;
  formatKey: string;
  width: number;
  height: number;
  products: Product[];
  layout: LayoutOptions;
  doc: FlyerDocument | null;
  version?: number;
}

export function brandFromContext(ctx: StudioContext, mascotFileId?: string | null) {
  const k = ctx.brandKit;
  const mascot = k.mascots.find((m) => m.fileId === mascotFileId) ?? k.mascots[0] ?? null;
  return brandContextFromKit({
    colors: k.colors,
    fonts: k.fonts,
    logo: k.logo && { fileId: k.logo.fileId, width: k.logo.width, height: k.logo.height },
    logoOnDark: k.logoOnDark && { fileId: k.logoOnDark.fileId, width: k.logoOnDark.width, height: k.logoOnDark.height },
    mascot: mascot && { fileId: mascot.fileId, width: mascot.width, height: mascot.height },
  });
}

export function brandLogoIds(ctx: StudioContext) {
  return [ctx.brandKit.logo?.fileId, ctx.brandKit.logoOnDark?.fileId].filter(Boolean) as string[];
}

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
