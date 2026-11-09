/** Schemas de validação (servidor) do Estúdio de Flyers. */
import { z } from "zod";
import { CATEGORIES } from "./brand";
import { FORMATS } from "./formats";

const id = z.string().min(1).max(64);
const color = z.string().max(40).regex(/^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|transparent)?$/, "Cor inválida");
const num = z.number().finite();
const MAX_PRODUCTS = 24;

export const ProductSchema = z.object({
  id,
  code: z.string().trim().max(40),
  name: z.string().trim().max(200),
  description: z.string().trim().max(400).optional(),
  brand: z.string().trim().max(60).optional(),
  priceCents: z.number().int().min(0).max(10_000_000_00).nullable(),
  imageFileId: id.nullable().optional(),
  imageWidth: z.number().int().positive().nullable().optional(),
  imageHeight: z.number().int().positive().nullable().optional(),
  extra: z.string().trim().max(200).optional(),
  origin: z.enum(["manual", "site", "ocr"]).optional(),
  cardPriceCents: z.number().int().min(0).max(10_000_000_00).nullable().optional(),
  priceFromRule: z.boolean().optional(),
  priceUncertain: z.boolean().optional(),
  sourceUrl: z.string().url().max(500).optional(),
  imageUrl: z.string().url().max(500).optional(),
});

const binding = z.object({ productId: id, field: z.enum(["code", "name", "description", "brand", "price", "extra", "image"]) }).optional();
const roles = ["logo", "mascot", "headline", "subheadline", "tag", "footer-text", "body-text", "product-image", "product-field", "product-card", "price-badge", "decor", "custom"] as const;
const elementBase = {
  id, name: z.string().max(120), x: num, y: num, width: num.min(0).max(20000), height: num.min(0).max(20000),
  rotation: num.min(-360).max(360), opacity: num.min(0).max(1), locked: z.boolean(), visible: z.boolean(),
  role: z.enum(roles), decorative: z.boolean().optional(), binding,
};

export const ElementSchema = z.discriminatedUnion("type", [
  z.object({
    ...elementBase, type: z.literal("text"), text: z.string().max(2000), fontFamily: z.string().max(60), fontSize: num.min(4).max(1000),
    fontStyle: z.enum(["normal", "bold", "italic", "bold italic", "800", "900"]), fill: color, align: z.enum(["left", "center", "right"]),
    verticalAlign: z.enum(["top", "middle", "bottom"]), lineHeight: num.min(0.5).max(4), letterSpacing: num.min(-50).max(200),
  }),
  z.object({
    ...elementBase, type: z.literal("image"), fileId: id, naturalWidth: num.positive(), naturalHeight: num.positive(), fit: z.enum(["contain", "cover"]),
    focusX: num.min(0).max(1), focusY: num.min(0).max(1), zoom: num.min(1).max(10), cornerRadius: num.min(0).max(5000),
  }),
  z.object({
    ...elementBase, type: z.enum(["rect", "ellipse"]), fill: color, stroke: color, strokeWidth: num.min(0).max(500), cornerRadius: num.min(0).max(5000), shadow: z.boolean().optional(),
  }),
  z.object({ ...elementBase, type: z.literal("polygon"), points: z.array(num.min(-1).max(2)).min(6).max(200), fill: color }),
]);

export const DocumentSchema = z.object({
  version: z.literal(1),
  width: z.number().int().min(100).max(8000),
  height: z.number().int().min(100).max(8000),
  background: z.object({ color, imageFileId: id.nullable().optional(), imageNaturalWidth: num.optional(), imageNaturalHeight: num.optional() }),
  elements: z.array(ElementSchema).max(600),
});

export const LayoutOptionsSchema = z.object({
  category: z.enum(CATEGORIES.map((c) => c.key) as [string, ...string[]]),
  headline: z.string().trim().max(80),
  subheadline: z.string().trim().max(160).optional(),
  footerText: z.string().trim().max(120).optional(),
  showMascot: z.boolean(),
  mascotFileId: id.nullable().optional(),
  logoPosition: z.enum(["footer", "header"]),
  backgroundColor: color.nullable().optional(),
  backgroundImageFileId: id.nullable().optional(),
  style: z.enum(["default", "minimal"]),
  bodyText: z.string().trim().max(1200).optional(),
  emphasis: z.enum(["price", "product"]),
});

export const ProjectWriteSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do projeto.").max(120),
  campaign: z.string().trim().max(80).optional().nullable(),
  formatKey: z.enum(FORMATS.map((f) => f.key) as [string, ...string[]]),
  width: z.number().int().min(200).max(6000),
  height: z.number().int().min(200).max(6000),
  products: z.array(ProductSchema).max(MAX_PRODUCTS, `Máximo de ${MAX_PRODUCTS} produtos por flyer.`),
  layoutConfig: LayoutOptionsSchema,
  canvasState: DocumentSchema,
  thumbnailDataUrl: z.string().max(3_000_000).startsWith("data:image/").optional(),
  versionNote: z.string().max(200).optional(),
  baseVersion: z.number().int().optional(),
});

export type ProjectWrite = z.infer<typeof ProjectWriteSchema>;
export { MAX_PRODUCTS };

/** Criação de flyers gerados no ChatGPT (1 flyer ou um lote de até 8). */
export const MAX_BATCH = 8;
export const ChatGptBatchSchema = z.object({
  campaign: z.string().trim().max(80).optional().nullable(),
  formatKey: z.enum(FORMATS.map((f) => f.key) as [string, ...string[]]),
  width: z.number().int().min(200).max(6000),
  height: z.number().int().min(200).max(6000),
  layoutConfig: LayoutOptionsSchema,
  flyers: z.array(z.object({
    name: z.string().trim().min(1, "Informe o nome do flyer.").max(120),
    products: z.array(ProductSchema).max(MAX_PRODUCTS, `Máximo de ${MAX_PRODUCTS} produtos por flyer.`),
    prompt: z.string().trim().min(40, "Prompt muito curto.").max(20000),
  })).min(1).max(MAX_BATCH, `Máximo de ${MAX_BATCH} flyers por lote.`),
});
export type ChatGptBatch = z.infer<typeof ChatGptBatchSchema>;

export const ChatGptResultSchema = z.object({
  fileId: z.string().min(1).max(64).nullable(),
  /** Confirmação de que nome, código e preço de cada produto foram conferidos na arte. */
  checked: z.boolean(),
});
