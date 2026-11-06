import type { BindingField, Product } from "./types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata centavos como moeda brasileira. Espaços normalizados (Intl usa NBSP). */
export function formatPrice(cents: number): string {
  return BRL.format(cents / 100).replace(/ /g, " ");
}

/**
 * Converte o texto digitado pelo usuário em centavos.
 * Aceita "1.299,90", "1299,9", "1299.90", "R$ 1.299,90". Retorna null se inválido.
 * Nunca arredonda silenciosamente além de 2 casas: mais casas => inválido.
 */
export function parsePriceInput(raw: string): number | null {
  let s = raw.replace(/R\$|\s| /gi, "").trim();
  if (!s) return null;
  if (!/^[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let decimalSep: string | null = null;
  if (lastComma >= 0 && lastDot >= 0) decimalSep = lastComma > lastDot ? "," : ".";
  else if (lastComma >= 0) decimalSep = ",";
  else if (lastDot >= 0) {
    // "1.299" é ambíguo: tratamos ponto seguido de exatamente 3 dígitos como milhar.
    decimalSep = /\.\d{3}$/.test(s) && s.split(".").length >= 2 ? null : ".";
  }
  let intPart = s;
  let decPart = "";
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, idx);
    decPart = s.slice(idx + 1);
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (decPart.length > 2 || /[.,]/.test(decPart)) return null;
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return null;
  const cents = Number(intPart || "0") * 100 + Number((decPart + "00").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Texto exibido para um campo vinculado — única fonte de texto comercial no flyer. */
export function boundText(p: Product, field: BindingField): string {
  switch (field) {
    case "code": return `Cód. ${p.code}`;
    case "name": return p.name;
    case "description": return p.description ?? "";
    case "brand": return p.brand ?? "";
    case "price": return p.priceCents == null ? "" : formatPrice(p.priceCents);
    case "extra": return p.extra ?? "";
    case "image": return "";
  }
}

export interface ProductIssue { productId: string; field: keyof Product | "image"; level: "error" | "warning"; message: string }

/** Campos obrigatórios do cadastro. */
export function checkProduct(p: Product, index: number): ProductIssue[] {
  const label = p.name?.trim() ? `"${p.name.trim()}"` : `#${index + 1}`;
  const out: ProductIssue[] = [];
  if (!p.code?.trim()) out.push({ productId: p.id, field: "code", level: "error", message: `Produto ${label}: informe o código.` });
  if (!p.name?.trim()) out.push({ productId: p.id, field: "name", level: "error", message: `Produto ${label}: informe o nome completo.` });
  if (p.priceCents == null) out.push({ productId: p.id, field: "priceCents", level: "error", message: `Produto ${label}: informe o preço final.` });
  else if (!(p.priceCents > 0)) out.push({ productId: p.id, field: "priceCents", level: "error", message: `Produto ${label}: o preço deve ser maior que zero.` });
  if (p.priceUncertain) out.push({ productId: p.id, field: "priceCents", level: "error", message: `Produto ${label}: confirme se o valor lido é o valor no cartão (não PIX).` });
  if (!p.imageFileId) out.push({ productId: p.id, field: "image", level: "warning", message: `Produto ${label}: sem imagem.` });
  return out;
}
