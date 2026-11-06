/**
 * Validação pré-exportação. Regras críticas (erros) bloqueiam a exportação.
 * Executada no navegador antes de exportar e também no servidor ao registrar
 * a exportação.
 */
import { boundText, checkProduct } from "./product-format";
import { boundingBox, inside, intersects, textHeight } from "./geometry";
import type { FlyerDocument, Product } from "./types";

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  elementId?: string;
  productId?: string;
}

export interface ValidationContext {
  expectedWidth: number;
  expectedHeight: number;
  brandLogoFileIds: string[]; // logo oficial e variante para fundo escuro
  brandLogoSizes?: Record<string, { width: number; height: number }>;
  failedImageIds?: string[];
}

export function validateFlyer(doc: FlyerDocument, products: Product[], vc: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (i: ValidationIssue) => issues.push(i);
  const canvas = { x: 0, y: 0, width: doc.width, height: doc.height };

  // Dimensões
  if (doc.width !== vc.expectedWidth || doc.height !== vc.expectedHeight) {
    push({ level: "error", code: "dimensions", message: `Dimensões do canvas (${doc.width}×${doc.height}) diferentes do formato (${vc.expectedWidth}×${vc.expectedHeight}).` });
  }

  // Cadastro dos produtos
  products.forEach((p, i) => checkProduct(p, i).forEach((pi) => push({ level: pi.level, code: `product.${String(pi.field)}`, message: pi.message, productId: p.id })));

  const visible = doc.elements.filter((e) => e.visible);
  const byProduct = new Map(products.map((p) => [p.id, p]));

  // Elementos vinculados: texto idêntico ao cadastro
  for (const e of visible) {
    if (!e.binding) continue;
    const p = byProduct.get(e.binding.productId);
    if (!p) {
      push({ level: "error", code: "binding.orphan", message: `"${e.name}" refere-se a um produto que não está mais no cadastro. Remova o elemento.`, elementId: e.id });
      continue;
    }
    if (e.type === "text") {
      let expected = boundText(p, e.binding.field);
      if (e.binding.field === "brand") expected = expected.toUpperCase();
      if (e.binding.field === "price" && !expected) continue; // ausência de preço já reportada no cadastro
      if (e.text !== expected) {
        const what = { price: "Preço", code: "Código", name: "Nome", description: "Descrição", brand: "Marca", extra: "Informação", image: "Imagem" }[e.binding.field];
        push({ level: "error", code: `binding.${e.binding.field}`, message: `${what} de "${p.name || p.code}" no flyer difere do cadastro.`, elementId: e.id, productId: p.id });
      }
    }
    if (e.type === "image" && e.binding.field === "image" && p.imageFileId && e.fileId !== p.imageFileId) {
      push({ level: "warning", code: "binding.image", message: `A imagem de "${p.name || p.code}" no flyer não é a imagem cadastrada.`, elementId: e.id, productId: p.id });
    }
  }

  // Cada produto precisa exibir nome, código e preço
  for (const p of products) {
    for (const field of ["name", "code", "price"] as const) {
      if (!visible.some((e) => e.type === "text" && e.binding?.productId === p.id && e.binding.field === field)) {
        const label = { name: "nome", code: "código", price: "preço" }[field];
        push({ level: "error", code: `missing.${field}`, message: `O ${label} de "${p.name || p.code || "produto"}" não aparece no flyer. Regere o layout ou remova o produto do cadastro.`, productId: p.id });
      }
    }
  }

  // Área útil e sobreposição de preços
  visible.forEach((e, idx) => {
    const bb = boundingBox(e);
    const critical = !!e.binding || e.role === "logo";
    if (!e.decorative && !inside(bb, canvas)) {
      push({ level: critical ? "error" : "warning", code: "bounds", message: `"${e.name}" está fora da área do flyer.`, elementId: e.id });
    }
    if (e.type === "text" && e.binding?.field === "price") {
      for (const above of visible.slice(idx + 1)) {
        if (above.binding?.productId === e.binding.productId && above.binding.field === "price") continue;
        if (above.opacity <= 0.05) continue;
        if (intersects(bb, boundingBox(above))) {
          push({ level: "error", code: "price.covered", message: `O preço "${e.text}" está coberto por "${above.name}".`, elementId: above.id });
        }
      }
    }
    if (e.type === "text" && e.text.trim()) {
      const h = textHeight(e.text, e.fontSize, e.width, e.fontFamily, e.fontStyle, e.lineHeight, e.letterSpacing);
      if (h > e.height * 1.08) {
        push({ level: e.binding ? "error" : "warning", code: "text.overflow", message: `O texto "${e.name}" pode estar sendo cortado. Aumente a caixa ou reduza a fonte.`, elementId: e.id });
      }
    }
  });

  // Logotipo
  const logos = visible.filter((e) => e.role === "logo");
  if (vc.brandLogoFileIds.length === 0) {
    push({ level: "warning", code: "logo.unconfigured", message: "O logotipo oficial ainda não foi cadastrado no Brand Kit." });
  } else if (logos.length === 0) {
    push({ level: "warning", code: "logo.missing", message: "O flyer não contém o logotipo Digitusul." });
  }
  for (const l of logos) {
    if (l.type !== "image") continue;
    if (vc.brandLogoFileIds.length && !vc.brandLogoFileIds.includes(l.fileId)) {
      push({ level: "error", code: "logo.mismatch", message: "O logotipo usado não corresponde ao logotipo oficial do Brand Kit.", elementId: l.id });
    }
    const natural = l.naturalWidth / l.naturalHeight;
    const shown = l.width / l.height;
    if (Math.abs(shown - natural) / natural > 0.015) {
      push({ level: "error", code: "logo.distorted", message: "O logotipo está distorcido (proporção alterada).", elementId: l.id });
    }
    if (l.fit === "cover" && l.zoom !== 1) {
      push({ level: "error", code: "logo.cropped", message: "O logotipo está recortado.", elementId: l.id });
    }
  }

  // Imagens que não carregaram
  for (const id of vc.failedImageIds ?? []) {
    push({ level: "error", code: "image.unavailable", message: "Uma ou mais imagens não puderam ser carregadas.", elementId: visible.find((e) => e.type === "image" && e.fileId === id)?.id });
  }

  return issues;
}

export const hasBlockingIssues = (issues: ValidationIssue[]) => issues.some((i) => i.level === "error");
