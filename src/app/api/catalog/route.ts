import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { storeImage } from "@/core/storage/storage";
import { batchCandidates, downloadCatalogImage, productsByCodes, randomProducts, searchByTerms, type CatalogProduct } from "@/modules/flyer-studio/catalog/catalog";
import { planBatch } from "@/modules/flyer-studio/domain/batch-plan";
import type { CurrentUser } from "@/core/auth/session";
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
  z.object({
    action: z.literal("batch-plan"),
    category: z.string().max(120).optional(),
    term: z.string().trim().max(80).optional(),
    sizes: z.array(z.number().int().min(1).max(12)).min(1).max(8),
  }),
]);

/** Salva as fotos do site no armazenamento e devolve produtos com o preço da regra (calculado aqui). */
async function importProducts(user: CurrentUser, products: CatalogProduct[]) {
  const rule = await getPricingRule();
  const imageErrors: string[] = [];
  const out = await Promise.all(products.map(async (p): Promise<Product> => {
    let file: { id: string; width: number | null; height: number | null } | null = null;
    if (p.imageUrl) {
      try {
        file = await storeImage({ ownerId: user.id, data: await downloadCatalogImage(p.imageUrl), originalName: `${p.code}.img`, purpose: "product" });
      } catch {
        imageErrors.push(p.code);
      }
    }
    return {
      id: randomUUID(), code: p.code, name: p.name, priceCents: applyPricingRule(p.cardPriceCents, rule), cardPriceCents: p.cardPriceCents,
      priceFromRule: true, priceUncertain: false, origin: "site", sourceUrl: p.url, imageUrl: p.imageUrl ?? undefined,
      imageFileId: file?.id ?? null, imageWidth: file?.width ?? null, imageHeight: file?.height ?? null,
    };
  }));
  return { products: out, imageErrors };
}

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

  if (b.action === "batch-plan") {
    const total = b.sizes.reduce((x, y) => x + y, 0);
    if (total > 48) throw new HttpError(400, "Lote grande demais (máximo de 48 produtos).");
    const candidates = await batchCandidates({ category: b.category || undefined, term: b.term || undefined }, Math.max(60, total * 3));
    if (!candidates.length) throw new HttpError(404, "Nenhum produto com foto e estoque encontrado. Tente outra categoria ou palavra.");
    const { flyers, spare } = planBatch(candidates.map((p, rank) => ({ ...p, rank })), b.sizes);
    const chosen = flyers.flatMap((f) => f.products);
    const { products, imageErrors } = await importProducts(user, chosen);
    const byCode = new Map(products.map((p) => [p.code, p]));
    const rule = await getPricingRule();
    return jsonOk({
      flyers: flyers.map((f) => ({ size: f.size, theme: f.theme, products: f.products.map((p) => byCode.get(p.code)!) })),
      spare: spare.slice(0, 60).map((p) => ({ code: p.code, name: p.name, imageUrl: p.imageUrl, finalPriceCents: applyPricingRule(p.cardPriceCents, rule) })),
      found: candidates.length,
      imageErrors,
    });
  }

  // import: os dados são buscados de novo no servidor (o cliente não define preços).
  const { products, notFound } = await productsByCodes(b.codes);
  const { products: out, imageErrors } = await importProducts(user, products);
  return jsonOk({ products: out, notFound, imageErrors });
});

/** Chamadas a serviços externos podem demorar (limite da função na Vercel). */
export const maxDuration = 60;
