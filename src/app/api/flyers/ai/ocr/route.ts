import { z } from "zod";
import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { driver } from "@/core/storage/storage";
import { logActivity } from "@/core/audit";
import { aiStatus, extractProductFromImage } from "@/modules/flyer-studio/ai/claude";
import { getPricingRule } from "@/modules/flyer-studio/services/brand-service";
import { applyPricingRule } from "@/modules/flyer-studio/domain/pricing";
import { parsePriceInput } from "@/modules/flyer-studio/domain/product-format";

/**
 * Lê um print/foto de produto já enviado e devolve um RASCUNHO de produto.
 * A IA apenas transcreve; o valor final é calculado aqui pela regra de preço.
 * Preço incerto (possível PIX) fica marcado e bloqueia a exportação até o usuário confirmar.
 */
export const POST = apiRoute({ permission: "flyers.ai.use" }, async ({ req, user }) => {
  if (!aiStatus().enabled) throw new HttpError(501, "Leitura de imagem indisponível: IA generativa não configurada.");
  const { fileId } = await parseBody(req, z.object({ fileId: z.string().min(1) }));
  const f = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!f || !["image/png", "image/jpeg", "image/webp"].includes(f.mimeType)) throw new HttpError(404, "Imagem não encontrada.");
  const data = await driver.get(f.storageKey);
  let r;
  try {
    r = await extractProductFromImage(Buffer.from(data).toString("base64"), f.mimeType as "image/png" | "image/jpeg" | "image/webp");
  } catch (e) {
    console.error("[ai.ocr]", e);
    throw new HttpError(502, "Não foi possível ler a imagem agora. Preencha os dados manualmente.");
  }
  const card = r.valor_cartao ? parsePriceInput(r.valor_cartao) : null;
  const rule = await getPricingRule();
  await logActivity(user.id, "ai.compose", { type: "file", id: f.id }, { kind: "ocr" });
  return jsonOk({
    draft: {
      code: r.codigo?.trim() ?? "",
      name: r.nome?.trim() ?? "",
      cardPriceCents: card,
      priceCents: card ? applyPricingRule(card, rule) : null,
      priceFromRule: !!card,
      priceUncertain: r.preco_incerto || !card,
      origin: "ocr" as const,
    },
    pixValue: r.valor_pix,
    note: r.observacao,
  });
});

/** Chamadas a serviços externos podem demorar (limite da função na Vercel). */
export const maxDuration = 60;
