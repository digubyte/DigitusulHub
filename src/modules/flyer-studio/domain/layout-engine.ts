/**
 * Motor inteligente de layout.
 *
 * Gera um FlyerDocument editável a partir de: produtos, categoria, formato,
 * Brand Kit e opções. É 100% determinístico — a IA apenas escolhe opções
 * (categoria, títulos, fundo, ênfase); textos comerciais vêm sempre do cadastro
 * via `binding`.
 *
 * Adaptação:
 *  - proporção do formato (vertical, quadrado, horizontal, banner largo);
 *  - quantidade de produtos (hero, dupla, grade, lista);
 *  - comprimento dos nomes (ajuste de fonte sem cortar texto);
 *  - categoria (cada uma com proposta visual própria — ver THEMES).
 */
import { boundText } from "./product-format";
import { containBox, fitText, gridCells, inset, type Box } from "./geometry";
import { isDark } from "./brand";
import type {
  BrandContext, CategoryKey, FlyerDocument, FlyerElement, ImageElement, LayoutOptions, PolygonElement, Product, ShapeElement, TextElement,
} from "./types";

// ───────────────────────── contexto e construtores ─────────────────────────

interface Ctx {
  W: number; H: number; u: number; m: number;
  aspect: number; shape: "portrait" | "square" | "landscape" | "wide";
  brand: BrandContext; opt: LayoutOptions; theme: Theme;
  bg: string; darkBg: boolean;
  els: FlyerElement[]; seq: number;
}

const base = (ctx: Ctx, role: FlyerElement["role"], name: string, b: Box) => ({
  id: `${role}-${++ctx.seq}`, name, x: r2(b.x), y: r2(b.y), width: r2(b.width), height: r2(b.height),
  rotation: 0, opacity: 1, locked: false, visible: true, role,
});
const r2 = (n: number) => Math.round(n * 100) / 100;

function addRect(ctx: Ctx, b: Box, fill: string, o: Partial<ShapeElement> = {}) {
  const el: ShapeElement = { ...base(ctx, o.role ?? "decor", o.name ?? "Forma", b), type: "rect", fill, stroke: "", strokeWidth: 0, cornerRadius: 0, ...o } as ShapeElement;
  ctx.els.push(el);
  return el;
}
function addEllipse(ctx: Ctx, b: Box, fill: string, o: Partial<ShapeElement> = {}) {
  const el: ShapeElement = { ...base(ctx, o.role ?? "decor", o.name ?? "Círculo", b), type: "ellipse", fill, stroke: "", strokeWidth: 0, cornerRadius: 0, ...o } as ShapeElement;
  ctx.els.push(el);
  return el;
}
function addPolygon(ctx: Ctx, b: Box, points: number[], fill: string, o: Partial<PolygonElement> = {}) {
  const el: PolygonElement = { ...base(ctx, "decor", o.name ?? "Forma", b), type: "polygon", points, fill, ...o } as PolygonElement;
  ctx.els.push(el);
  return el;
}

interface TextOpts {
  role?: TextElement["role"]; name?: string; family?: string; style?: TextElement["fontStyle"]; color: string;
  align?: TextElement["align"]; valign?: TextElement["verticalAlign"]; max: number; min?: number; lineHeight?: number;
  maxLines?: number; letterSpacing?: number; binding?: TextElement["binding"];
}
function addText(ctx: Ctx, b: Box, text: string, o: TextOpts) {
  const family = o.family ?? ctx.brand.fonts.body;
  const style = o.style ?? "normal";
  const lineHeight = o.lineHeight ?? 1.15;
  const fit = fitText({ text, width: b.width, height: b.height, max: o.max, min: o.min ?? o.max * 0.45, fontFamily: family, fontStyle: style, lineHeight, maxLines: o.maxLines, letterSpacing: o.letterSpacing });
  const el: TextElement = {
    ...base(ctx, o.role ?? "custom", o.name ?? "Texto", b), type: "text", text, fontFamily: family, fontSize: fit.fontSize, fontStyle: style,
    fill: o.color, align: o.align ?? "left", verticalAlign: o.valign ?? "top", lineHeight, letterSpacing: o.letterSpacing ?? 0,
  };
  if (o.binding) el.binding = o.binding;
  ctx.els.push(el);
  return el;
}
function addImage(ctx: Ctx, b: Box, fileId: string, nw: number, nh: number, o: Partial<ImageElement> = {}) {
  const el: ImageElement = {
    ...base(ctx, o.role ?? "custom", o.name ?? "Imagem", b), type: "image", fileId, naturalWidth: nw, naturalHeight: nh,
    fit: "contain", focusX: 0.5, focusY: 0.5, zoom: 1, cornerRadius: 0, ...o,
  } as ImageElement;
  ctx.els.push(el);
  return el;
}

/** Logotipo oficial: proporção preservada, bloqueado por padrão. Em fundo escuro, usa versão para fundo escuro ou uma placa branca. */
function addLogo(ctx: Ctx, area: Box, onDark: boolean, align: "left" | "center" | "right" = "left") {
  const variant = onDark && ctx.brand.logoOnDark ? ctx.brand.logoOnDark : ctx.brand.logo;
  if (!variant) return null;
  const needsPlate = onDark && !ctx.brand.logoOnDark;
  const pad = needsPlate ? Math.min(area.height * 0.18, ctx.u * 1.6) : 0;
  const inner = inset(area, pad, pad);
  const fit = containBox(variant.width, variant.height, inner);
  const dx = align === "left" ? inner.x - fit.x : align === "right" ? inner.x + inner.width - fit.width - fit.x : 0;
  const box = { ...fit, x: fit.x + dx };
  if (needsPlate) {
    addRect(ctx, { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad }, "#FFFFFF", { name: "Placa do logotipo", cornerRadius: pad * 0.8, role: "decor" });
  }
  return addImage(ctx, box, variant.fileId, variant.width, variant.height, { role: "logo", name: "Logotipo Digitusul", locked: true });
}

// ───────────────────────── temas por categoria ─────────────────────────

interface CardStyle {
  surface: string | null; stroke?: string; strokeWidth?: number; radius: number; shadow?: boolean;
  nameColor: string; codeColor: string; priceColor: string; brandColor: string;
  priceBadge?: { fill: string; text: string } | null;
  imageBackdrop?: string | null; accentStripe?: string | null;
  preferRow?: boolean; idealAspect: number;
}
interface Theme {
  defaultBg: (b: BrandContext) => string;
  headerAlign: "left" | "center";
  headerBand?: (ctx: Ctx) => string | null; // cor de faixa atrás do cabeçalho
  footerBand?: (ctx: Ctx) => string | null;
  tag?: (ctx: Ctx) => { text: string; fill: string; color: string } | null;
  headlineColor: (ctx: Ctx) => string;
  uppercase: boolean;
  decor: (ctx: Ctx) => void;
  card: (ctx: Ctx) => CardStyle;
}

const onBg = (ctx: Ctx, light: string, dark: string) => (ctx.darkBg ? dark : light);

export const THEMES: Record<CategoryKey, Theme> = {
  novidade: {
    defaultBg: (b) => b.colors.surface,
    headerAlign: "left",
    tag: (ctx) => ({ text: "NOVIDADE", fill: ctx.brand.colors.accent, color: "#FFFFFF" }),
    headlineColor: (ctx) => onBg(ctx, ctx.brand.colors.primary, "#FFFFFF"),
    uppercase: false,
    decor: (ctx) => {
      const { W, H, brand } = ctx;
      const s = Math.max(W, H) * 0.62;
      addEllipse(ctx, { x: W - s * 0.62, y: -s * 0.38, width: s, height: s }, brand.colors.primary, { opacity: 0.09, decorative: true, name: "Círculo decorativo" });
      addEllipse(ctx, { x: -s * 0.18, y: H - s * 0.22, width: s * 0.4, height: s * 0.4 }, brand.colors.accent, { opacity: 0.08, decorative: true, name: "Círculo decorativo" });
    },
    card: (ctx) => ({
      surface: null, radius: 0, nameColor: onBg(ctx, ctx.brand.colors.dark, "#FFFFFF"), codeColor: onBg(ctx, "#5B6478", "#C9D2E6"),
      priceColor: onBg(ctx, ctx.brand.colors.primary, "#FFFFFF"), brandColor: ctx.brand.colors.accent,
      imageBackdrop: onBg(ctx, "#EEF2FC", "rgba(255,255,255,0.08)"), idealAspect: 0.78,
    }),
  },
  promocional: {
    defaultBg: (b) => b.colors.primary,
    headerAlign: "center",
    tag: (ctx) => ({ text: "OFERTA", fill: ctx.brand.colors.accent, color: "#FFFFFF" }),
    headlineColor: (ctx) => onBg(ctx, ctx.brand.colors.primary, "#FFFFFF"),
    uppercase: true,
    decor: (ctx) => {
      const { W, H } = ctx;
      addPolygon(ctx, { x: 0, y: H * 0.42, width: W, height: H * 0.58 }, [0, 0.35, 1, 0, 1, 1, 0, 1], "#FFFFFF", { opacity: 0.07, decorative: true, name: "Faixa diagonal" });
    },
    card: (ctx) => ({
      surface: "#FFFFFF", radius: ctx.u * 2.2, shadow: true, nameColor: ctx.brand.colors.dark, codeColor: "#5B6478",
      priceColor: "#FFFFFF", brandColor: ctx.brand.colors.primary, priceBadge: { fill: ctx.brand.colors.accent, text: "#FFFFFF" }, idealAspect: 0.78,
    }),
  },
  reposicao: {
    defaultBg: (b) => b.colors.light,
    headerAlign: "left",
    headerBand: (ctx) => ctx.brand.colors.primary,
    tag: (ctx) => ({ text: "REPOSIÇÃO", fill: "#FFFFFF", color: ctx.brand.colors.primary }),
    headlineColor: () => "#FFFFFF",
    uppercase: false,
    decor: () => {},
    card: (ctx) => ({
      surface: "#FFFFFF", radius: ctx.u * 1.2, nameColor: ctx.brand.colors.dark, codeColor: "#5B6478", priceColor: ctx.brand.colors.primary,
      brandColor: ctx.brand.colors.accent, accentStripe: ctx.brand.colors.primary, preferRow: true, idealAspect: 2.1,
    }),
  },
  queima: {
    defaultBg: (b) => b.colors.surface,
    headerAlign: "center",
    headerBand: (ctx) => ctx.brand.colors.accent,
    footerBand: (ctx) => ctx.brand.colors.dark,
    tag: (ctx) => ({ text: "APROVEITE", fill: "#FFFFFF", color: ctx.brand.colors.accent }),
    headlineColor: () => "#FFFFFF",
    uppercase: true,
    decor: () => {},
    card: (ctx) => ({
      surface: "#FFFFFF", stroke: ctx.brand.colors.accent, strokeWidth: Math.max(2, ctx.u * 0.35), radius: ctx.u * 1.2,
      nameColor: ctx.brand.colors.dark, codeColor: "#5B6478", priceColor: "#FFFFFF", brandColor: ctx.brand.colors.accent,
      priceBadge: { fill: ctx.brand.colors.dark, text: "#FFFFFF" }, idealAspect: 0.8,
    }),
  },
  blackfriday: {
    defaultBg: () => "#0A0D14",
    headerAlign: "center",
    tag: (ctx) => ({ text: "OFERTAS ESPECIAIS", fill: ctx.brand.colors.accent, color: "#FFFFFF" }),
    headlineColor: (ctx) => onBg(ctx, ctx.brand.colors.dark, "#FFFFFF"),
    uppercase: true,
    decor: (ctx) => {
      const { W, H, brand } = ctx;
      const s = Math.max(W, H) * 0.7;
      addEllipse(ctx, { x: -s * 0.45, y: -s * 0.45, width: s, height: s }, brand.colors.accent, { opacity: 0.16, decorative: true, name: "Brilho" });
      addEllipse(ctx, { x: W - s * 0.5, y: H - s * 0.5, width: s, height: s }, brand.colors.primary, { opacity: 0.2, decorative: true, name: "Brilho" });
    },
    card: (ctx) => ({
      surface: "#141A28", stroke: ctx.brand.colors.primary, strokeWidth: Math.max(1.5, ctx.u * 0.22), radius: ctx.u * 1.8,
      nameColor: "#FFFFFF", codeColor: "#9AA4BA", priceColor: ctx.brand.colors.accent, brandColor: "#9AA4BA", idealAspect: 0.8,
    }),
  },
  institucional: {
    defaultBg: (b) => b.colors.surface,
    headerAlign: "left",
    headerBand: (ctx) => ctx.brand.colors.primary,
    footerBand: (ctx) => ctx.brand.colors.primary,
    tag: () => null,
    headlineColor: () => "#FFFFFF",
    uppercase: false,
    decor: () => {},
    card: (ctx) => ({
      surface: ctx.brand.colors.light, radius: ctx.u * 1.4, nameColor: ctx.brand.colors.dark, codeColor: "#5B6478",
      priceColor: ctx.brand.colors.primary, brandColor: ctx.brand.colors.accent, idealAspect: 0.85,
    }),
  },
};

// ───────────────────────── regiões ─────────────────────────

interface Regions { header: Box; body: Box; footer: Box; headerBandBox: Box; footerBandBox: Box }

function planRegions(ctx: Ctx, hasProducts: boolean): Regions {
  const { W, H, m, shape } = ctx;
  const mascot = ctx.opt.showMascot && !!ctx.brand.mascot;
  // Rodapé só ocupa espaço quando tem conteúdo (logotipo, frase ou mascote).
  const hasFooter = mascot || !!ctx.opt.footerText?.trim() || (ctx.opt.logoPosition === "footer" && !!ctx.brand.logo);
  if (shape === "wide") {
    const colW = W * 0.28;
    const fH = H * (mascot ? 0.36 : 0.28);
    const header = { x: m, y: m, width: colW, height: H - 2 * m - fH - m * 0.5 };
    const footer = { x: m, y: H - m - fH, width: colW, height: fH };
    const body = { x: m * 2 + colW, y: m, width: W - colW - 3 * m, height: H - 2 * m };
    const band = { x: 0, y: 0, width: colW + m * 1.5, height: H };
    return { header, body, footer, headerBandBox: band, footerBandBox: band };
  }
  const hRatio = !hasProducts ? 0.26 : shape === "portrait" ? (ctx.aspect < 0.65 ? 0.16 : 0.19) : shape === "square" ? 0.19 : 0.2;
  const fRatio = hasFooter ? (shape === "portrait" ? (ctx.aspect < 0.65 ? 0.075 : 0.09) : 0.1) * (mascot ? 1.45 : 1) : 0;
  const header = { x: m, y: m, width: W - 2 * m, height: H * hRatio };
  const footer = { x: m, y: H - m - H * fRatio, width: W - 2 * m, height: H * fRatio };
  const gap = m * 0.7;
  const body = { x: m, y: header.y + header.height + gap, width: W - 2 * m, height: footer.y - gap - (header.y + header.height + gap) };
  return {
    header, body, footer,
    headerBandBox: { x: 0, y: 0, width: W, height: header.y + header.height + m * 0.5 },
    footerBandBox: { x: 0, y: footer.y - m * 0.5, width: W, height: H - footer.y + m * 0.5 },
  };
}

// ───────────────────────── cabeçalho e rodapé ─────────────────────────

function renderHeader(ctx: Ctx, box: Box, onDark: boolean) {
  const { theme, opt, brand } = ctx;
  let area = { ...box };
  const align = ctx.shape === "wide" ? "left" : theme.headerAlign;

  if (opt.logoPosition === "header") {
    const lh = area.height * 0.26;
    addLogo(ctx, { x: area.x, y: area.y, width: area.width * (align === "center" ? 1 : 0.5), height: lh }, onDark, align === "center" ? "center" : "left");
    area = { ...area, y: area.y + lh + ctx.u, height: area.height - lh - ctx.u };
  }

  const tag = opt.style === "minimal" ? null : theme.tag?.(ctx);
  if (tag) {
    const th = Math.min(area.height * 0.17, ctx.u * 4.2);
    const fs = th * 0.5;
    const tw = Math.min(area.width, tag.text.length * fs * 0.72 + th * 1.2);
    const tx = align === "center" ? area.x + (area.width - tw) / 2 : area.x;
    addRect(ctx, { x: tx, y: area.y, width: tw, height: th }, tag.fill, { name: "Selo", cornerRadius: th / 2, role: "tag" });
    addText(ctx, { x: tx, y: area.y, width: tw, height: th }, tag.text, { role: "tag", name: "Texto do selo", family: brand.fonts.heading, style: "bold", color: tag.color, align: "center", valign: "middle", max: fs, maxLines: 1, letterSpacing: fs * 0.08 });
    area = { ...area, y: area.y + th + ctx.u * 1.2, height: area.height - th - ctx.u * 1.2 };
  }

  const hasSub = !!opt.subheadline?.trim();
  const headH = area.height * (hasSub ? 0.66 : 1);
  const headline = theme.uppercase ? opt.headline.toUpperCase() : opt.headline;
  addText(ctx, { x: area.x, y: area.y, width: area.width, height: headH }, headline, {
    role: "headline", name: "Título", family: brand.fonts.heading, style: "900", color: onDark ? "#FFFFFF" : theme.headlineColor(ctx),
    align, valign: hasSub ? "bottom" : "middle", max: Math.min(headH * 0.9, ctx.u * (ctx.shape === "wide" ? 9 : 11)), maxLines: 2, lineHeight: 1.02,
  });
  if (hasSub) {
    addText(ctx, { x: area.x, y: area.y + headH + ctx.u * 0.6, width: area.width, height: area.height - headH - ctx.u * 0.6 }, opt.subheadline!, {
      role: "subheadline", name: "Subtítulo", family: brand.fonts.body, style: "normal", color: onDark ? "rgba(255,255,255,0.86)" : "#4A5468",
      align, valign: "top", max: Math.min((area.height - headH) * 0.55, ctx.u * 3.6), maxLines: 2,
    });
  }
}

function renderFooter(ctx: Ctx, box: Box, onDark: boolean) {
  const { opt, brand } = ctx;
  let area = { ...box };
  const mascot = opt.showMascot ? brand.mascot : null;
  if (mascot) {
    const mw = Math.min(area.width * 0.32, (area.height * mascot.width) / mascot.height);
    const mb = containBox(mascot.width, mascot.height, { x: area.x + area.width - mw, y: area.y, width: mw, height: area.height }, "bottom");
    addImage(ctx, mb, mascot.fileId, mascot.width, mascot.height, { role: "mascot", name: "Mascote Digu" });
    area = { ...area, width: area.width - mw - ctx.u };
  }
  const stacked = ctx.shape === "wide";
  if (opt.logoPosition === "footer") {
    const lb = stacked ? { x: area.x, y: area.y, width: area.width, height: area.height * 0.5 } : { x: area.x, y: area.y + area.height * 0.1, width: area.width * 0.42, height: area.height * 0.8 };
    addLogo(ctx, lb, onDark, "left");
    area = stacked ? { ...area, y: area.y + area.height * 0.55, height: area.height * 0.45 } : { ...area, x: area.x + area.width * 0.46, width: area.width * 0.54 };
  }
  if (opt.footerText?.trim()) {
    addText(ctx, area, opt.footerText.trim(), {
      role: "footer-text", name: "Texto do rodapé", family: brand.fonts.body, style: "bold", color: onDark ? "#FFFFFF" : brand.colors.dark,
      align: opt.logoPosition === "footer" && !stacked ? "right" : "left", valign: "middle", max: Math.min(area.height * 0.34, ctx.u * 3), maxLines: 2,
    });
  }
}

// ───────────────────────── cartões de produto ─────────────────────────

function renderProduct(ctx: Ctx, cell: Box, p: Product, style: CardStyle, count: number) {
  const { brand, u } = ctx;
  if (style.surface) {
    addRect(ctx, cell, style.surface, {
      role: "product-card", name: `Cartão — ${p.name || p.code}`, cornerRadius: style.radius, shadow: style.shadow,
      stroke: style.stroke ?? "", strokeWidth: style.strokeWidth ?? 0,
    });
  }
  if (style.accentStripe) addRect(ctx, { x: cell.x, y: cell.y, width: Math.max(4, u * 0.9), height: cell.height }, style.accentStripe, { role: "product-card", name: "Faixa", cornerRadius: 0 });

  const pad = Math.min(cell.width, cell.height) * (style.surface ? 0.07 : 0.03);
  const inner = inset(cell, pad + (style.accentStripe ? u * 0.6 : 0), pad);
  const row = style.preferRow ? cell.width / cell.height > 1.25 : cell.width / cell.height > 1.6;
  const emphasisProduct = ctx.opt.emphasis === "product";

  let imgArea: Box, textArea: Box;
  if (row) {
    const iw = inner.width * (emphasisProduct ? 0.5 : 0.42);
    imgArea = { x: inner.x, y: inner.y, width: iw, height: inner.height };
    textArea = { x: inner.x + iw + pad, y: inner.y, width: inner.width - iw - pad, height: inner.height };
  } else {
    const ih = inner.height * (count === 1 ? (emphasisProduct ? 0.66 : 0.6) : emphasisProduct ? 0.6 : 0.54);
    imgArea = { x: inner.x, y: inner.y, width: inner.width, height: ih };
    textArea = { x: inner.x, y: inner.y + ih + pad * 0.6, width: inner.width, height: inner.height - ih - pad * 0.6 };
  }

  // Imagem do produto (sempre "contain": nunca recorta nem distorce)
  if (style.imageBackdrop) {
    const d = Math.min(imgArea.width, imgArea.height) * 0.92;
    addEllipse(ctx, { x: imgArea.x + (imgArea.width - d) / 2, y: imgArea.y + (imgArea.height - d) / 2, width: d, height: d }, style.imageBackdrop, { role: "product-card", name: "Fundo da imagem" });
  }
  if (p.imageFileId) {
    const nw = p.imageWidth || 1000, nh = p.imageHeight || 1000;
    const fit = containBox(nw, nh, inset(imgArea, imgArea.width * 0.04, imgArea.height * 0.04));
    const el = addImage(ctx, fit, p.imageFileId, nw, nh, { role: "product-image", name: `Imagem — ${p.name || p.code}` });
    el.binding = { productId: p.id, field: "image" };
  }

  // Bloco de texto: marca, nome, (descrição), código, preço
  const align: TextElement["align"] = row ? "left" : style.surface || count > 1 ? "center" : "center";
  const showDesc = !!p.description?.trim() && count <= 2;
  const showBrand = !!p.brand?.trim();
  const priceShare = ctx.opt.emphasis === "product" ? 0.3 : 0.38;
  const priceH = textArea.height * priceShare;
  const codeH = textArea.height * 0.12;
  const brandH = showBrand ? textArea.height * 0.1 : 0;
  const descH = showDesc ? textArea.height * 0.14 : 0;
  const nameH = textArea.height - priceH - codeH - brandH - descH;
  let y = textArea.y;
  const refSize = Math.min(textArea.width / 4.2, priceH * 0.9);

  if (showBrand) {
    addText(ctx, { x: textArea.x, y, width: textArea.width, height: brandH }, boundText(p, "brand").toUpperCase(), {
      role: "product-field", name: "Marca", family: brand.fonts.body, style: "bold", color: style.brandColor, align, valign: "bottom", max: Math.min(brandH * 0.8, refSize * 0.28), maxLines: 1, letterSpacing: 1,
      binding: { productId: p.id, field: "brand" },
    });
    y += brandH;
  }
  addText(ctx, { x: textArea.x, y, width: textArea.width, height: nameH }, boundText(p, "name"), {
    role: "product-field", name: `Nome — ${p.code}`, family: brand.fonts.body, style: "bold", color: style.nameColor, align, valign: row ? "bottom" : "top",
    max: Math.min(nameH / 1.2, refSize * (count === 1 ? 0.6 : 0.5)), min: 8, maxLines: count === 1 ? 3 : 4, lineHeight: 1.12,
    binding: { productId: p.id, field: "name" },
  });
  y += nameH;
  if (showDesc) {
    addText(ctx, { x: textArea.x, y, width: textArea.width, height: descH }, boundText(p, "description"), {
      role: "product-field", name: "Descrição", family: brand.fonts.body, color: style.codeColor, align, max: Math.min(descH * 0.45, refSize * 0.26), maxLines: 2,
      binding: { productId: p.id, field: "description" },
    });
    y += descH;
  }
  addText(ctx, { x: textArea.x, y, width: textArea.width, height: codeH }, boundText(p, "code"), {
    role: "product-field", name: `Código — ${p.code}`, family: brand.fonts.body, color: style.codeColor, align, valign: "middle",
    max: Math.min(codeH * 0.75, refSize * 0.32), maxLines: 1, binding: { productId: p.id, field: "code" },
  });
  y += codeH;

  const priceText = boundText(p, "price") || "R$ —";
  const priceBox = { x: textArea.x, y, width: textArea.width, height: priceH };
  if (style.priceBadge) {
    const bh = priceH * 0.86;
    const fs = fitText({ text: priceText, width: textArea.width * 0.86, height: bh * 0.7, max: bh * 0.62, min: 8, fontFamily: brand.fonts.price, fontStyle: "900", lineHeight: 1, maxLines: 1 }).fontSize;
    const bw = Math.min(textArea.width, priceText.length * fs * 0.68 + bh * 0.7);
    const bx = align === "left" ? textArea.x : textArea.x + (textArea.width - bw) / 2;
    const badge = { x: bx, y: y + (priceH - bh) / 2, width: bw, height: bh };
    addRect(ctx, badge, style.priceBadge.fill, { role: "price-badge", name: "Selo de preço", cornerRadius: bh * 0.22 });
    addText(ctx, badge, priceText, {
      role: "product-field", name: `Preço — ${p.code}`, family: brand.fonts.price, style: "900", color: style.priceBadge.text, align: "center", valign: "middle",
      max: fs, maxLines: 1, lineHeight: 1, binding: { productId: p.id, field: "price" },
    });
  } else {
    addText(ctx, priceBox, priceText, {
      role: "product-field", name: `Preço — ${p.code}`, family: brand.fonts.price, style: "900", color: style.priceColor, align, valign: "middle",
      max: Math.min(priceH * 0.8, refSize * (count === 1 ? 1.1 : 0.95)), maxLines: 1, lineHeight: 1, binding: { productId: p.id, field: "price" },
    });
  }
}

// ───────────────────────── composição ─────────────────────────

export interface ComposeInput {
  width: number;
  height: number;
  products: Product[];
  options: LayoutOptions;
  brand: BrandContext;
}

export function composeFlyer(input: ComposeInput): FlyerDocument {
  const { width: W, height: H, options: opt, brand } = input;
  const theme = THEMES[opt.category];
  const aspect = W / H;
  const shape: Ctx["shape"] = aspect > 2.2 ? "wide" : aspect > 1.2 ? "landscape" : aspect >= 0.9 ? "square" : "portrait";
  const u = Math.min(W, H) / 100;
  const bg = opt.backgroundColor || theme.defaultBg(brand);
  const ctx: Ctx = { W, H, u, m: u * (shape === "wide" ? 5 : 5.5), aspect, shape, brand, opt, theme, bg, darkBg: isDark(bg), els: [], seq: 0 };

  const products = input.products;
  const regions = planRegions(ctx, products.length > 0);

  if (opt.style !== "minimal") theme.decor(ctx);

  const headerBand = theme.headerBand?.(ctx) ?? null;
  const footerBand = theme.footerBand?.(ctx) ?? null;
  if (headerBand) addRect(ctx, regions.headerBandBox, headerBand, { name: "Faixa do cabeçalho", role: "decor" });
  if (footerBand && ctx.shape !== "wide") addRect(ctx, regions.footerBandBox, footerBand, { name: "Faixa do rodapé", role: "decor" });
  if (opt.category === "queima" && headerBand && ctx.shape !== "wide" && opt.style !== "minimal") {
    // borda inclinada abaixo da faixa (não invade a área dos produtos)
    const hb = regions.headerBandBox;
    addPolygon(ctx, { x: 0, y: hb.y + hb.height, width: W, height: ctx.m * 0.5 }, [0, 0, 1, 0, 0, 1], headerBand, { name: "Corte diagonal" });
  }

  renderHeader(ctx, regions.header, headerBand ? isDark(headerBand) : ctx.darkBg);

  const body = regions.body;
  const card = theme.card(ctx);
  if (opt.category === "institucional" && opt.bodyText?.trim()) {
    const textH = products.length ? body.height * 0.34 : body.height;
    addText(ctx, { ...body, height: textH }, opt.bodyText.trim(), {
      role: "body-text", name: "Texto do comunicado", family: brand.fonts.body, color: ctx.darkBg ? "#FFFFFF" : brand.colors.dark,
      max: Math.min(u * 4.4, textH / 3), min: u * 1.6, lineHeight: 1.4, valign: "top",
    });
    if (products.length) layoutProducts(ctx, { ...body, y: body.y + textH + ctx.m * 0.5, height: body.height - textH - ctx.m * 0.5 }, products, card);
  } else if (products.length) {
    layoutProducts(ctx, body, products, card);
  }

  renderFooter(ctx, regions.footer, footerBand ? isDark(footerBand) : ctx.darkBg);

  return {
    version: 1, width: W, height: H,
    background: { color: bg, imageFileId: opt.backgroundImageFileId ?? null },
    elements: ctx.els,
  };
}

function layoutProducts(ctx: Ctx, area: Box, products: Product[], card: CardStyle) {
  const n = products.length;
  const gap = ctx.u * (n > 6 ? 1.6 : 2.4);
  let cells: Box[];
  if (n === 1) {
    // Hero: área inteira; em formatos largos o cartão vira horizontal automaticamente.
    const maxW = ctx.shape === "portrait" || ctx.shape === "square" ? area.width : area.width;
    cells = [{ x: area.x + (area.width - maxW) / 2, y: area.y, width: maxW, height: area.height }];
  } else if (ctx.shape === "wide") {
    // Banner: uma linha (até 4) ou duas linhas.
    const rows = n <= 4 ? 1 : 2;
    const cols = Math.ceil(n / rows);
    const cw = (area.width - gap * (cols - 1)) / cols;
    const ch = (area.height - gap * (rows - 1)) / rows;
    cells = products.map((_, i) => ({ x: area.x + (i % cols) * (cw + gap), y: area.y + Math.floor(i / cols) * (ch + gap), width: cw, height: ch }));
  } else {
    cells = gridCells(n, area, gap, card.idealAspect);
  }
  products.forEach((p, i) => renderProduct(ctx, cells[i], p, card, n));
}

/** Re-sincroniza textos vinculados com o cadastro (após editar produtos). */
export function syncBoundTexts(doc: FlyerDocument, products: Product[]): FlyerDocument {
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    ...doc,
    elements: doc.elements.map((e) => {
      if (!e.binding) return e;
      const p = byId.get(e.binding.productId);
      if (!p) return e;
      if (e.type === "text") {
        const t = boundText(p, e.binding.field);
        const text = e.binding.field === "brand" ? t.toUpperCase() : e.binding.field === "price" && !t ? "R$ —" : t;
        return text === e.text ? e : { ...e, text };
      }
      if (e.type === "image" && e.binding.field === "image" && p.imageFileId && p.imageFileId !== e.fileId) {
        const nw = p.imageWidth || e.naturalWidth, nh = p.imageHeight || e.naturalHeight;
        // mantém a caixa atual e reencaixa a nova imagem sem distorcer
        const outer = { x: e.x, y: e.y, width: e.width, height: e.height };
        const fit = containBox(nw, nh, outer);
        return { ...e, fileId: p.imageFileId, naturalWidth: nw, naturalHeight: nh, ...fit };
      }
      return e;
    }),
  };
}
