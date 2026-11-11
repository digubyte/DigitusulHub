import type { BrandContext, CategoryKey } from "./types";

/** Cores extraídas do logotipo oficial enviado (azul #2341C1 e vermelho #E61F27). */
export const DEFAULT_BRAND_COLORS = [
  { key: "primary", name: "Azul institucional", hex: "#2341C1", usage: "Cor principal, fundos e títulos" },
  { key: "accent", name: "Vermelho Digitusul", hex: "#E61F27", usage: "Destaques, preços e ações importantes" },
  { key: "dark", name: "Azul profundo", hex: "#0B1A4A", usage: "Textos e fundos escuros" },
  { key: "light", name: "Cinza claro", hex: "#F3F5FA", usage: "Superfícies e fundos neutros" },
  { key: "surface", name: "Branco", hex: "#FFFFFF", usage: "Cartões e áreas de leitura" },
];

/** Logo oficial da Digitusul (copiado do site). Usado quando o Brand Kit ainda não tem logo. */
export const SITE_LOGO = {
  publicPath: "/brand/digitusul-logo.webp",
  siteUrl: "https://www.digitusul.com.br/media/digitusul-logo-25-d7aed9306c.webp",
};

/**
 * Logo oficial em alta resolução (2000 px), monocromático, nas duas versões usadas nas artes.
 * É o que vai anexado ao ChatGPT: o logo do site (255 px, colorido) fazia o ChatGPT redesenhar a marca.
 */
export const OFFICIAL_LOGOS = {
  dark: { base: "logo-digitusul-branco", path: "/brand/logo-digitusul-branco.png", use: "versão branca, para fundos escuros ou coloridos" },
  light: { base: "logo-digitusul-azul", path: "/brand/logo-digitusul-azul.png", use: "versão azul-marinho, para fundos claros" },
} as const;

/** Flyers aprovados pela Digitusul, usados como padrão visual (layout, tipografia e acabamento). */
export const STYLE_REFERENCES = {
  destaque: ["/brand/referencias/destaque-1.jpg", "/brand/referencias/destaque-2.jpg", "/brand/referencias/destaque-3.jpg", "/brand/referencias/destaque-4.jpg", "/brand/referencias/destaque-5.jpg", "/brand/referencias/destaque-6.jpg"],
  grade: ["/brand/referencias/grade-1.jpg", "/brand/referencias/grade-2.jpg", "/brand/referencias/grade-3.jpg", "/brand/referencias/grade-4.jpg"],
} as const;

/**
 * Duas referências de estilo para o flyer. A escolha depende só dos produtos,
 * então o prompt e os anexos sempre apontam para os mesmos arquivos.
 */
export function styleReferencesFor(products: { code: string }[]): { base: string; path: string }[] {
  const list = products.length <= 1 ? STYLE_REFERENCES.destaque : STYLE_REFERENCES.grade;
  const key = products.map((p) => p.code).join("|");
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = h % list.length, b = (a + 1 + (h >> 8) % (list.length - 1)) % list.length;
  return [a, b].map((i, k) => ({ base: `referencia-estilo-${k + 1}`, path: list[i] }));
}

/** Selos de condições reais do site (rodapé do flyer). Editáveis no Brand Kit como frases da categoria "selo". */
export const DEFAULT_SEALS = ["10% OFF no PIX", "10x sem juros", "Entrega para todo o Brasil"];
export const SEAL_CATEGORY = "selo";
export function sealsFromKit(phrases: { category: string; text: string }[]): string[] {
  const own = phrases.filter((p) => p.category === SEAL_CATEGORY).map((p) => p.text);
  return own.length ? own : DEFAULT_SEALS;
}

export const DEFAULT_BRAND_FONTS = { heading: "Montserrat", body: "Inter", price: "Montserrat" };

/** Fontes disponíveis no editor (carregadas via Google Fonts em app/layout.tsx). */
export const EDITOR_FONTS = ["Inter", "Montserrat", "Poppins", "Roboto", "Oswald", "Playfair Display"];

export const CATEGORIES: { key: CategoryKey; label: string; description: string; defaultHeadline: string }[] = [
  { key: "novidade", label: "Novidade", description: "Lançamentos com composição moderna e valorização do produto.", defaultHeadline: "Novidade" },
  { key: "promocional", label: "Promocional", description: "Produto e preço em grande destaque, orientado à conversão.", defaultHeadline: "Ofertas da semana" },
  { key: "reposicao", label: "Reposição", description: "Foco na disponibilidade e no retorno ao estoque.", defaultHeadline: "De volta ao estoque" },
  { key: "queima", label: "Queima de Estoque", description: "Comunicação promocional forte, ênfase em oportunidade.", defaultHeadline: "Queima de estoque" },
  { key: "blackfriday", label: "Black Friday", description: "Visual escuro e diferenciado, consistente com a marca.", defaultHeadline: "Black Friday" },
  { key: "institucional", label: "Institucional", description: "Comunicados, serviços, avisos e eventos.", defaultHeadline: "Comunicado" },
];

export function categoryLabel(key: string) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function brandContextFromKit(kit: {
  colors: { key?: string; hex: string }[];
  fonts: Partial<BrandContext["fonts"]>;
  logo?: BrandContext["logo"];
  logoOnDark?: BrandContext["logoOnDark"];
  mascot?: BrandContext["mascot"];
}): BrandContext {
  const get = (k: string, fb: string) => kit.colors.find((c) => c.key === k)?.hex ?? fb;
  return {
    colors: {
      primary: get("primary", "#2341C1"),
      accent: get("accent", "#E61F27"),
      dark: get("dark", "#0B1A4A"),
      light: get("light", "#F3F5FA"),
      surface: get("surface", "#FFFFFF"),
    },
    fonts: { ...DEFAULT_BRAND_FONTS, ...kit.fonts },
    logo: kit.logo ?? null,
    logoOnDark: kit.logoOnDark ?? null,
    mascot: kit.mascot ?? null,
  };
}

export function luminance(hex: string) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const isDark = (hex: string) => luminance(hex) < 0.35;
