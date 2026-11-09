/**
 * Modelo de dados do Estúdio de Flyers.
 *
 * Princípio central: os dados comerciais (Product) são a fonte da verdade.
 * Elementos de texto que exibem código, nome, preço etc. carregam um
 * `binding` para o produto; o texto é sempre derivado do cadastro e nunca
 * produzido por IA.
 */

export type CategoryKey = "novidade" | "promocional" | "reposicao" | "queima" | "blackfriday" | "institucional";

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  brand?: string;
  /** Preço final em centavos. null = ainda não informado (bloqueia exportação). */
  priceCents: number | null;
  imageFileId?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  extra?: string;
  /** Origem dos dados: digitado, catálogo do site ou leitura de imagem (OCR). */
  origin?: "manual" | "site" | "ocr";
  /** Valor no cartão (base para a regra de preço), quando conhecido. */
  cardPriceCents?: number | null;
  /** true quando o preço final foi calculado pela regra de preço a partir do valor no cartão. */
  priceFromRule?: boolean;
  /** true quando não foi possível confirmar se o valor lido é cartão ou PIX — bloqueia exportação. */
  priceUncertain?: boolean;
  sourceUrl?: string;
  /** Endereço público da foto no site (referência no prompt do ChatGPT). */
  imageUrl?: string;
}

export type BindingField = "code" | "name" | "description" | "brand" | "price" | "extra" | "image";

export type ElementRole =
  | "logo" | "mascot" | "headline" | "subheadline" | "tag" | "footer-text" | "body-text"
  | "product-image" | "product-field" | "product-card" | "price-badge" | "decor" | "custom";

interface ElementBase {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  role: ElementRole;
  /** Elementos decorativos podem sangrar para fora da área útil. */
  decorative?: boolean;
  binding?: { productId: string; field: BindingField };
}

export interface TextElement extends ElementBase {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: "normal" | "bold" | "italic" | "bold italic" | "800" | "900";
  fill: string;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  lineHeight: number;
  letterSpacing: number;
}

export interface ImageElement extends ElementBase {
  type: "image";
  fileId: string;
  naturalWidth: number;
  naturalHeight: number;
  /** contain = imagem inteira visível (padrão para produtos); cover = preenche e recorta. */
  fit: "contain" | "cover";
  /** Ponto focal (0..1) e zoom (>=1) — ajuste de enquadramento sem distorcer. */
  focusX: number;
  focusY: number;
  zoom: number;
  cornerRadius: number;
}

export interface ShapeElement extends ElementBase {
  type: "rect" | "ellipse";
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  shadow?: boolean;
}

export interface PolygonElement extends ElementBase {
  type: "polygon";
  /** Pontos normalizados (0..1) relativos à caixa do elemento: [x0,y0,x1,y1,...] */
  points: number[];
  fill: string;
}

export type FlyerElement = TextElement | ImageElement | ShapeElement | PolygonElement;

export interface FlyerDocument {
  version: 1;
  width: number;
  height: number;
  background: { color: string; imageFileId?: string | null; imageNaturalWidth?: number; imageNaturalHeight?: number };
  elements: FlyerElement[];
}

export interface BrandContext {
  colors: { primary: string; accent: string; dark: string; light: string; surface: string };
  fonts: { heading: string; body: string; price: string };
  logo?: { fileId: string; width: number; height: number } | null;
  logoOnDark?: { fileId: string; width: number; height: number } | null;
  mascot?: { fileId: string; width: number; height: number } | null;
}

export interface LayoutOptions {
  category: CategoryKey;
  headline: string;
  subheadline?: string;
  footerText?: string;
  showMascot: boolean;
  mascotFileId?: string | null;
  logoPosition: "footer" | "header";
  backgroundColor?: string | null;
  backgroundImageFileId?: string | null;
  style: "default" | "minimal";
  /** Para Institucional: texto principal do comunicado. */
  bodyText?: string;
  /** Destaque visual: preço (padrão) ou produto. */
  emphasis: "price" | "product";
}
