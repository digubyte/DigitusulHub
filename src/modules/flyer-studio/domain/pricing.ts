/**
 * Regra de preço comercial (herdada do Digitusul Prompt Genie).
 *
 * Valor final = valor no cartão × (1 + acréscimo), arredondado para cima até o
 * próximo final comercial (,50 / ,75 / ,90 / ,95 / ,99), ou apenas para 2 casas.
 * O valor PIX NUNCA é usado. Todo o cálculo é feito em centavos inteiros pelo
 * aplicativo — nunca pela IA.
 */
export interface PricingRule {
  markupEnabled: boolean;
  /** Acréscimo em pontos-base (8,12% = 812). Inteiro para evitar erro de ponto flutuante. */
  markupBps: number;
  rounding: "psychological" | "cents";
}

export const DEFAULT_PRICING_RULE: PricingRule = { markupEnabled: true, markupBps: 812, rounding: "psychological" };

export const PRICE_ENDINGS = [50, 75, 90, 95, 99] as const;

export function applyPricingRule(cardPriceCents: number, rule: PricingRule): number {
  if (!Number.isSafeInteger(cardPriceCents) || cardPriceCents <= 0) throw new Error("Valor no cartão inválido.");
  const bps = rule.markupEnabled ? rule.markupBps : 0;
  // Centavos exatos com 4 casas extras de precisão (inteiro).
  const raw10k = cardPriceCents * (10000 + bps); // = centavos × 10000
  if (rule.rounding === "cents" || !rule.markupEnabled) {
    // arredondamento comercial (meio para cima)
    return Math.floor((raw10k + 5000) / 10000);
  }
  const base = Math.floor(raw10k / 1_000_000); // reais inteiros
  const centsPart10k = raw10k - base * 1_000_000; // centavos × 10000 dentro do real
  for (const ending of PRICE_ENDINGS) {
    if (centsPart10k <= ending * 10000) return base * 100 + ending;
  }
  return (base + 1) * 100 + 50;
}

export function describeRule(rule: PricingRule) {
  if (!rule.markupEnabled) return "Valor final igual ao valor no cartão";
  const pct = (rule.markupBps / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `Valor no cartão + ${pct}%${rule.rounding === "psychological" ? ", arredondado para ,50/,75/,90/,95/,99" : ""}`;
}
