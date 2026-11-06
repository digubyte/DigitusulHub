import { z } from "zod";
import { apiRoute, jsonOk, parseBody } from "@/core/http";
import { logActivity } from "@/core/audit";
import { aiStatus, suggestComposition } from "@/modules/flyer-studio/ai/claude";
import { interpretPrompt } from "@/modules/flyer-studio/ai/rule-interpreter";
import { getBrandKit } from "@/modules/flyer-studio/services/brand-service";

/**
 * "Criar com IA": devolve apenas parâmetros visuais (sugestão). Sem chave de IA
 * ou em caso de falha, usa o interpretador determinístico e informa o motivo.
 */
export const POST = apiRoute({ permission: "flyers.ai.use" }, async ({ req, user }) => {
  const { prompt, productNames } = await parseBody(req, z.object({ prompt: z.string().trim().min(3, "Descreva o flyer desejado.").max(800), productNames: z.array(z.string().max(200)).max(24) }));
  const status = aiStatus();
  let suggestion = interpretPrompt(prompt);
  let fallbackReason: string | null = status.enabled ? null : "IA generativa não configurada — usando interpretação por regras.";
  if (status.enabled) {
    try {
      const kit = await getBrandKit();
      suggestion = await suggestComposition(prompt, { productNames, approvedPhrases: kit.approvedPhrases.map((p) => p.text) });
      // Completa campos que a IA deixou vazios com o que as regras identificaram.
      const rules = interpretPrompt(prompt);
      suggestion = { ...suggestion, formatKey: suggestion.formatKey ?? rules.formatKey, category: suggestion.category ?? rules.category };
    } catch (e) {
      console.error("[ai.compose]", e);
      fallbackReason = "A IA não respondeu agora — usando interpretação por regras.";
    }
  }
  await logActivity(user.id, "ai.compose", null, { source: suggestion.source });
  return jsonOk({ suggestion, fallbackReason });
});
