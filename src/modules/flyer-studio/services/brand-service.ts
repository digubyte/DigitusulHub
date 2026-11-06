import "server-only";
import { db } from "@/core/db";
import { parseJson } from "@/core/util";
import { DEFAULT_BRAND_COLORS, DEFAULT_BRAND_FONTS, brandContextFromKit } from "../domain/brand";
import { DEFAULT_PRICING_RULE, type PricingRule } from "../domain/pricing";
import type { BrandContext } from "../domain/types";

export interface BrandKitView {
  colors: { key: string; name: string; hex: string; usage: string }[];
  fonts: { heading: string; body: string; price: string };
  rules: string;
  approvedPhrases: { category: string; text: string }[];
  logo: FileRef | null;
  logoOnDark: FileRef | null;
  mascots: (FileRef & { assetId: string; name: string })[];
  elements: (FileRef & { assetId: string; name: string })[];
  updatedAt: string | null;
}
export interface FileRef { fileId: string; url: string; width: number; height: number }

async function fileRef(id: string | null | undefined): Promise<FileRef | null> {
  if (!id) return null;
  const f = await db.storedFile.findUnique({ where: { id } });
  if (!f) return null;
  return { fileId: f.id, url: `/api/files/${f.id}`, width: f.width ?? 1000, height: f.height ?? 1000 };
}

export async function getBrandKit(): Promise<BrandKitView> {
  const kit = await db.brandKit.findUnique({ where: { id: "default" } });
  const assets = await db.brandAsset.findMany({ orderBy: { createdAt: "asc" } });
  const refs = await Promise.all(assets.map(async (a) => ({ a, ref: await fileRef(a.fileId) })));
  const withRef = refs.filter((r) => r.ref).map((r) => ({ ...r.ref!, assetId: r.a.id, name: r.a.name, kind: r.a.kind }));
  return {
    colors: parseJson(kit?.colors, DEFAULT_BRAND_COLORS),
    fonts: { ...DEFAULT_BRAND_FONTS, ...parseJson(kit?.fonts, {}) },
    rules: kit?.rules ?? "",
    approvedPhrases: parseJson(kit?.approvedPhrases, []),
    logo: await fileRef(kit?.logoFileId),
    logoOnDark: await fileRef(kit?.logoOnDarkFileId),
    mascots: withRef.filter((x) => x.kind === "mascot"),
    elements: withRef.filter((x) => x.kind === "element"),
    updatedAt: kit?.updatedAt.toISOString() ?? null,
  };
}

/** Contexto de marca para o motor de layout. */
export function toBrandContext(kit: BrandKitView, mascotFileId?: string | null): BrandContext {
  const mascot = kit.mascots.find((m) => m.fileId === mascotFileId) ?? kit.mascots[0] ?? null;
  return brandContextFromKit({
    colors: kit.colors,
    fonts: kit.fonts,
    logo: kit.logo && { fileId: kit.logo.fileId, width: kit.logo.width, height: kit.logo.height },
    logoOnDark: kit.logoOnDark && { fileId: kit.logoOnDark.fileId, width: kit.logoOnDark.width, height: kit.logoOnDark.height },
    mascot: mascot && { fileId: mascot.fileId, width: mascot.width, height: mascot.height },
  });
}

export async function getPricingRule(): Promise<PricingRule> {
  const s = await db.setting.findUnique({ where: { key: "flyers.pricingRule" } });
  return { ...DEFAULT_PRICING_RULE, ...parseJson<Partial<PricingRule>>(s?.value, {}) };
}
