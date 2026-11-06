import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { storeImage } from "@/core/storage/storage";
import { downloadCatalogImage, productsByCodes, randomProducts, searchByTerms, type CatalogProduct } from "@/modules/flyer-studio/catalog/catalog";
import { aiStatus, catalogPickRelevant, catalogSearchTerms } from "@/modules/flyer-studio/ai/claude";
import { getPricingRule } from "@/modules/flyer-studio/services/brand-service";
import { applyPricingRule } from "@/modules/flyer-studio/domain/pricing";
import type { Product } from "@/modules/flyer-studio/domain/types";

const MAX = 24;
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("random"), count: z.number().int().min(1).max(MAX), category: z.string().max(120).optional(), exclude: z.array(z.string().max(40)).max(200).optional() }),
  z.object({ action: z.literal("codes"), codes: z.array(z.string().trim().min(1).max(40)).min(1).max(MAX) }),
  z.object({ action: z.literal("ai-search"), prompt: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("import"), codes: z.array(z.string().trim().min(1).max(40)).min(1).max(MAX) }),
]);

/** Prévia com o valor final já calculado pela regra (para conferência antes de importar). */
async function withFinal(list: CatalogProduct[]) {
  const rule = await getPricingRule();
  return list.map((p) => ({ ...p, finalPriceCents: applyPricingRule(p.cardPriceCents, rule) }));
}

export const POST = apiRoute({ permission: "flyers.create" }, async ({ req, user }) => {
  const b = await parseBody(req, Body);

  if (b.action === "random") return jsonOk({ products: await withFinal(await randomProducts(b.count, { categorySlug: b.category, exclude: b.exclude })) });

  if (b.action === "codes") {
    const r = await productsByCodes(b.codes);
    return jsonOk({ products: await withFinal(r.products), notFound: r.notFound });
  }

  if (b.action === "ai-search") {
    if (!user.permissions.has("flyers.ai.use")) throw new HttpError(403, "Sem permissão para usar IA.");
    if (!aiStatus().enabled) throw new HttpError(501, "Busca com IA indisponível: IA generativa não configurada.");
    try {
      const ai = await catalogSearchTerms(b.prompt, MAX);
      const requested = Math.min(Math.max(1, Math.round(ai.quantidade || 12)), MAX);
      const terms = [...new Set(ai.termos.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
      if (!terms.length) return jsonOk({ products: [], terms, note: "A IA não gerou termos de busca." });
      const groups = await searchByTerms(terms);
      const seen = new Set<string>();
      const candidates: CatalogProduct[] = [];
      for (let round = 0; candidates.length < 150; round++) {
        let any = false;
        for (const g of groups) {
          const p = g[round];
          if (!p) continue;
          any = true;
          if (!seen.has(p.code)) { seen.add(p.code); candidates.push(p); }
        }
        if (!any) break;
      }
      const picked = await catalogPickRelevant(b.prompt, requested, candidates);
      const byCode = new Map(candidates.map((c) => [c.code, c]));
      return jsonOk({ products: await withFinal(picked.map((c) => byCode.get(c)!).filter(Boolean)), terms });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      console.error("[catalog.ai-search]", e);
      throw new HttpError(502, "A busca com IA falhou. Tente novamente ou use o sorteio/códigos.");
    }
  }

  // import: os dados são buscados de novo no servidor (o cliente não define preços).
  const { products, notFound } = await productsByCodes(b.codes);
  const rule = await getPricingRule();
  const out: Product[] = [];
  const imageErrors: string[] = [];
  for (const p of products) {
    let file: { id: string; width: number | null; height: number | null } | null = null;
    if (p.imageUrl) {
      try {
        file = await storeImage({ ownerId: user.id, data: await downloadCatalogImage(p.imageUrl), originalName: `${p.code}.img`, purpose: "product" });
      } catch {
        imageErrors.push(p.code);
      }
    }
    out.push({
      id: randomUUID(), code: p.code, name: p.name, priceCents: applyPricingRule(p.cardPriceCents, rule), cardPriceCents: p.cardPriceCents,
      priceFromRule: true, priceUncertain: false, origin: "site", sourceUrl: p.url,
      imageFileId: file?.id ?? null, imageWidth: file?.width ?? null, imageHeight: file?.height ?? null,
    });
  }
  return jsonOk({ products: out, notFound, imageErrors });
});
