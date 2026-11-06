/** Lista de produtos e planilha (herdado do Digitusul Prompt Genie). */
import { formatPrice } from "./product-format";
import type { Product } from "./types";

/** "Código - Nome - Valor final", um por linha. */
export function buildProductList(products: Product[]): string {
  return products.map((p) => `${p.code} - ${p.name} - ${p.priceCents == null ? "(sem preço)" : formatPrice(p.priceCents)}`).join("\n");
}

const csvCell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Planilha no modelo do site: Sku,Nome,Ativo,Ordem (BOM para acentos no Excel). */
export function buildCategoryCsv(products: { code: string; name: string }[]): string {
  return "﻿" + ["Sku,Nome,Ativo,Ordem", ...products.map((p) => `${csvCell(p.code)},${csvCell(p.name)},1,`)].join("\r\n") + "\r\n";
}
