/**
 * Sugestão de composição — o ÚNICO formato que a IA (ou o interpretador de
 * regras) pode devolver. Não contém produtos, preços nem códigos: a IA decide
 * apenas aparência e textos de chamada; os dados comerciais vêm do cadastro.
 */
import type { CategoryKey, LayoutOptions } from "../domain/types";
import { CATEGORIES } from "../domain/brand";
import { FORMATS } from "../domain/formats";

export interface CompositionSuggestion {
  category: CategoryKey | null;
  formatKey: string | null;
  headline: string | null;
  subheadline: string | null;
  footerText: string | null;
  backgroundColor: string | null;
  style: LayoutOptions["style"] | null;
  logoPosition: LayoutOptions["logoPosition"] | null;
  emphasis: LayoutOptions["emphasis"] | null;
  showMascot: boolean | null;
  /** Observações para o usuário (o que foi interpretado / ignorado). */
  notes: string[];
  source: "ai" | "rules";
}

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const FORMAT_KEYS = FORMATS.map((f) => f.key);

/** Valores monetários, percentuais e números longos não podem vir da IA em textos de chamada. */
const COMMERCIAL_PATTERN = /(r\$|\$|€|\d+\s*%|\d+[.,]\d{2}\b|\bpor apenas\b|\bde\s+\d+\s+por\b|\d{4,})/i;

export function containsCommercialValue(text: string) {
  return COMMERCIAL_PATTERN.test(text);
}

/**
 * Sanitiza a saída da IA: remove campos inválidos e qualquer texto com valores
 * comerciais (preço, desconto, código). Nada aqui pode alterar produtos.
 */
export function sanitizeSuggestion(raw: Partial<CompositionSuggestion>, source: CompositionSuggestion["source"]): CompositionSuggestion {
  const notes = [...(raw.notes ?? [])].filter((n) => typeof n === "string").slice(0, 6);
  const text = (v: unknown, max: number, field: string) => {
    if (typeof v !== "string" || !v.trim()) return null;
    const t = v.trim().slice(0, max);
    if (containsCommercialValue(t)) {
      notes.push(`Texto sugerido para "${field}" foi descartado por conter valores comerciais.`);
      return null;
    }
    return t;
  };
  return {
    category: CATEGORY_KEYS.includes(raw.category as CategoryKey) ? (raw.category as CategoryKey) : null,
    formatKey: raw.formatKey && FORMAT_KEYS.includes(raw.formatKey) ? raw.formatKey : null,
    headline: text(raw.headline, 60, "título"),
    subheadline: text(raw.subheadline, 120, "subtítulo"),
    footerText: text(raw.footerText, 90, "rodapé"),
    backgroundColor: typeof raw.backgroundColor === "string" && /^#[0-9a-f]{6}$/i.test(raw.backgroundColor) ? raw.backgroundColor.toUpperCase() : null,
    style: raw.style === "minimal" || raw.style === "default" ? raw.style : null,
    logoPosition: raw.logoPosition === "header" || raw.logoPosition === "footer" ? raw.logoPosition : null,
    emphasis: raw.emphasis === "price" || raw.emphasis === "product" ? raw.emphasis : null,
    showMascot: typeof raw.showMascot === "boolean" ? raw.showMascot : null,
    notes,
    source,
  };
}

/** Aplica a sugestão sobre as opções atuais (campos nulos não alteram nada). */
export function applySuggestion(opts: LayoutOptions, s: CompositionSuggestion): LayoutOptions {
  return {
    ...opts,
    category: s.category ?? opts.category,
    headline: s.headline ?? opts.headline,
    subheadline: s.subheadline ?? opts.subheadline,
    footerText: s.footerText ?? opts.footerText,
    backgroundColor: s.backgroundColor ?? opts.backgroundColor,
    style: s.style ?? opts.style,
    logoPosition: s.logoPosition ?? opts.logoPosition,
    emphasis: s.emphasis ?? opts.emphasis,
    showMascot: s.showMascot ?? opts.showMascot,
  };
}
