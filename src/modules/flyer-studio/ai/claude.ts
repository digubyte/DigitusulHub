import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { CATEGORIES } from "../domain/brand";
import { FORMATS } from "../domain/formats";
import { sanitizeSuggestion, type CompositionSuggestion } from "./suggestion";

/**
 * Integração com a API do Claude (Anthropic). A chave fica SOMENTE no servidor
 * (variável ANTHROPIC_API_KEY); o navegador nunca a recebe.
 */
export function aiStatus() {
  const enabled = !!process.env.ANTHROPIC_API_KEY;
  return { enabled, provider: "Anthropic Claude", model: process.env.AI_MODEL || "claude-opus-5-5" };
}

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("IA não configurada.");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 2 });
  return client;
}

export class AiUnavailableError extends Error {}

async function parseWithClaude<T extends z.ZodType>(opts: { system: string; content: Anthropic.Beta.BetaContentBlockParam[]; schema: T; effort?: "low" | "medium" | "high" }): Promise<z.infer<T>> {
  const res = await getClient().beta.messages.parse({
    model: aiStatus().model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
    messages: [{ role: "user", content: opts.content }],
  });
  if (res.stop_reason === "refusal") throw new AiUnavailableError("A IA recusou o pedido. Reformule a solicitação.");
  if (!res.parsed_output) throw new AiUnavailableError("Resposta da IA ilegível.");
  return res.parsed_output as z.infer<T>;
}

// ───────────────────────── Criar com IA ─────────────────────────

const CompositionSchema = z.object({
  category: z.enum(CATEGORIES.map((c) => c.key) as [string, ...string[]]).nullable(),
  formatKey: z.enum(FORMATS.map((f) => f.key) as [string, ...string[]]).nullable(),
  headline: z.string().nullable(),
  subheadline: z.string().nullable(),
  footerText: z.string().nullable(),
  backgroundColor: z.string().nullable(),
  style: z.enum(["default", "minimal"]).nullable(),
  logoPosition: z.enum(["header", "footer"]).nullable(),
  emphasis: z.enum(["price", "product"]).nullable(),
  showMascot: z.boolean().nullable(),
  notes: z.array(z.string()),
});

const COMPOSE_SYSTEM = `Você é diretor de arte da Digitusul (varejo de informática, papelaria e escritório).
Interprete o pedido do usuário e escolha APENAS parâmetros visuais de um flyer; um motor de layout fará a composição.
Regras obrigatórias:
- Nunca escreva preços, valores, descontos, percentuais, códigos ou características de produtos. Os dados comerciais vêm do cadastro e não passam por você.
- headline: chamada curta (até 5 palavras) em português, sem números. subheadline: frase de apoio opcional. footerText: opcional (ex.: chamada institucional), sem telefones ou endereços inventados.
- backgroundColor: hex #RRGGBB apenas se o pedido mencionar cor de fundo; prefira as cores da marca (azul #2341C1, vermelho #E61F27, azul profundo #0B1A4A, branco #FFFFFF).
- Use null quando o pedido não indicar o campo.
- notes: até 3 observações curtas em português para o usuário sobre o que foi interpretado.
Categorias: ${CATEGORIES.map((c) => `${c.key} (${c.label})`).join(", ")}.
Formatos: ${FORMATS.map((f) => `${f.key} (${f.label})`).join(", ")}.`;

export async function suggestComposition(prompt: string, ctx: { productNames: string[]; approvedPhrases: string[] }): Promise<CompositionSuggestion> {
  const context = [
    `Pedido: ${prompt}`,
    `Quantidade de produtos cadastrados: ${ctx.productNames.length}`,
    ctx.productNames.length ? `Nomes dos produtos (somente para contexto do tema, não reescreva): ${ctx.productNames.slice(0, 12).join("; ")}` : "",
    ctx.approvedPhrases.length ? `Frases aprovadas pela marca (prefira-as quando couberem): ${ctx.approvedPhrases.slice(0, 20).join(" | ")}` : "",
  ].filter(Boolean).join("\n");
  const out = await parseWithClaude({ system: COMPOSE_SYSTEM, content: [{ type: "text", text: context }], schema: CompositionSchema });
  return sanitizeSuggestion(out as Partial<CompositionSuggestion>, "ai");
}

// ───────────────────────── Leitura de imagem (OCR) ─────────────────────────

const OcrSchema = z.object({
  nome: z.string().nullable(),
  codigo: z.string().nullable(),
  valor_cartao: z.string().nullable(),
  valor_pix: z.string().nullable(),
  preco_incerto: z.boolean(),
  observacao: z.string(),
});
export type OcrResult = z.infer<typeof OcrSchema>;

const OCR_SYSTEM = `Você lê imagens de produtos da loja Digitusul (prints do site, fotos de etiqueta, páginas de produto).
Extraia: nome completo do produto, código do produto e os preços visíveis.
REGRAS CRÍTICAS SOBRE PREÇO:
- Nunca use o valor PIX como valor no cartão.
- Havendo dois preços (PIX e cartão/parcelado/"no cartão"), devolva o do cartão em valor_cartao e o PIX em valor_pix.
- Havendo apenas um preço e sem certeza de que é o valor no cartão, defina preco_incerto = true e coloque-o em valor_cartao.
- Não calcule, não arredonde e não converta: copie os valores exatamente como aparecem.
- Não invente dados. Campo ausente ou ilegível = null, com explicação em observacao (português).`;

export async function extractProductFromImage(base64: string, mediaType: "image/png" | "image/jpeg" | "image/webp"): Promise<OcrResult> {
  return parseWithClaude({
    system: OCR_SYSTEM,
    content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
      { type: "text", text: "Extraia os dados deste produto seguindo as regras de preço." },
    ],
    schema: OcrSchema,
  });
}

// ───────────────────────── Busca no catálogo com IA ─────────────────────────

const TermsSchema = z.object({ quantidade: z.number().int(), termos: z.array(z.string()) });
const PickSchema = z.object({ codigos: z.array(z.string()) });

export async function catalogSearchTerms(prompt: string, max: number) {
  return parseWithClaude({
    system: `Você ajuda o marketing da loja Digitusul (informática, papelaria, escritório, brinquedos, utilidades, eletrônicos etc.).
A partir do pedido, gere de 8 a 20 termos de busca curtos (1 a 3 palavras, português) e concretos para encontrar produtos no catálogo.
quantidade: número de itens pedido (padrão 12, máximo ${max}).`,
    content: [{ type: "text", text: prompt }],
    schema: TermsSchema,
  });
}

export async function catalogPickRelevant(prompt: string, requested: number, candidates: { code: string; name: string }[]) {
  const out = await parseWithClaude({
    system: "Você seleciona produtos de um catálogo que combinam de verdade com o pedido. Retorne em codigos apenas códigos da lista de candidatos, os mais relevantes primeiro, até a quantidade desejada. Não inclua itens sem relação só para completar a quantidade.",
    content: [{ type: "text", text: `Pedido: ${prompt}\nQuantidade desejada: ${requested}\n\nCandidatos (codigo | nome):\n${candidates.map((c) => `${c.code} | ${c.name}`).join("\n")}` }],
    schema: PickSchema,
  });
  const allowed = new Set(candidates.map((c) => c.code));
  return [...new Set(out.codigos)].filter((c) => allowed.has(c)).slice(0, requested);
}
