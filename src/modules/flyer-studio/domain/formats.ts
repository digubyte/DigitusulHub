export interface FlyerFormat {
  key: string;
  label: string;
  width: number;
  height: number;
  customizable: boolean;
  hint: string;
  /** Para PDF: tamanho físico em mm (quando aplicável). */
  pageMm?: { width: number; height: number };
}

/** A4 a 300 dpi. */
export const FORMATS: FlyerFormat[] = [
  { key: "ig-stories", label: "Instagram Stories", width: 1080, height: 1920, customizable: false, hint: "1080 × 1920" },
  { key: "ig-feed", label: "Instagram Feed vertical", width: 1080, height: 1350, customizable: false, hint: "1080 × 1350" },
  { key: "ig-square", label: "Instagram quadrado", width: 1080, height: 1080, customizable: false, hint: "1080 × 1080" },
  { key: "banner", label: "Banner horizontal", width: 1920, height: 600, customizable: false, hint: "1920 × 600" },
  { key: "site-banner", label: "Banner para site", width: 1440, height: 480, customizable: true, hint: "Dimensões personalizáveis" },
  { key: "a4-portrait", label: "A4 vertical", width: 2480, height: 3508, customizable: false, hint: "210 × 297 mm (300 dpi)", pageMm: { width: 210, height: 297 } },
  { key: "a4-landscape", label: "A4 horizontal", width: 3508, height: 2480, customizable: false, hint: "297 × 210 mm (300 dpi)", pageMm: { width: 297, height: 210 } },
  { key: "custom", label: "Personalizado", width: 1200, height: 1200, customizable: true, hint: "Defina largura e altura" },
];

export const MIN_DIM = 200;
export const MAX_DIM = 6000;

export function getFormat(key: string) {
  return FORMATS.find((f) => f.key === key);
}

/** Resolve as dimensões finais, aplicando limites para formatos personalizáveis. */
export function resolveDimensions(key: string, custom?: { width?: number; height?: number }) {
  const f = getFormat(key);
  if (!f) throw new Error(`Formato desconhecido: ${key}`);
  if (!f.customizable) return { width: f.width, height: f.height };
  const w = Math.round(custom?.width ?? f.width);
  const h = Math.round(custom?.height ?? f.height);
  if (!(w >= MIN_DIM && w <= MAX_DIM && h >= MIN_DIM && h <= MAX_DIM)) {
    throw new Error(`Dimensões devem estar entre ${MIN_DIM} e ${MAX_DIM} px.`);
  }
  return { width: w, height: h };
}
