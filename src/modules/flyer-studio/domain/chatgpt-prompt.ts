/**
 * Monta o prompt que será colado no ChatGPT para gerar a arte do flyer.
 *
 * Regra central mantida: os dados comerciais (nome, código e preço) saem do
 * cadastro, já formatados pelo aplicativo, e o prompt exige que sejam copiados
 * caractere por caractere. Depois que a arte volta, o usuário confere cada
 * preço antes de salvar (checklist na tela do projeto).
 */
import { CATEGORIES } from "./brand";
import { getFormat } from "./formats";
import { formatPrice } from "./product-format";
import type { BrandContext, CategoryKey, Product } from "./types";

export interface PromptInput {
  category: CategoryKey;
  formatKey: string;
  width: number;
  height: number;
  headline: string;
  subheadline?: string;
  footerText?: string;
  /** Segmento do lote (ex.: Gamer, Limpeza, Escritório). */
  segment?: string;
  products: Product[];
  colors: BrandContext["colors"];
  fonts: BrandContext["fonts"];
  hasLogo: boolean;
  hasMascot: boolean;
  emphasis: "price" | "product";
  extraInstructions?: string;
  /** Posição no lote, para variar a composição entre os flyers. */
  batch?: { index: number; total: number };
}

/** Direção visual por tipo de flyer. */
const CATEGORY_STYLE: Record<CategoryKey, string> = {
  novidade: "visual moderno e limpo, fundo claro com formas geométricas suaves, destaque para o produto como lançamento, selo \"NOVIDADE\"",
  promocional: "visual de oferta forte e organizado, fundo na cor principal, preços em grande destaque, energia de varejo sem poluição visual",
  reposicao: "visual informativo e confiável, selo \"DE VOLTA AO ESTOQUE\", foco na disponibilidade do produto",
  queima: "visual de urgência e oportunidade, faixas diagonais e selo \"QUEIMA DE ESTOQUE\", contraste alto, preços enormes",
  blackfriday: "visual escuro e premium (fundo quase preto), detalhes na cor de destaque, tipografia condensada e impactante, selo \"BLACK FRIDAY\"",
  institucional: "visual institucional sóbrio e elegante, muito espaço em branco, comunicação clara e direta",
};

/** Proporção legível + orientação para o ChatGPT (que gera 1:1, 2:3 ou 3:2). */
export function aspectDescription(width: number, height: number) {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = gcd(width, height);
  const ratio = `${width / g}:${height / g}`;
  const r = width / height;
  const orientation = r > 1.05 ? "horizontal" : r < 0.95 ? "vertical" : "quadrada";
  const closest = r > 1.05 ? "3:2" : r < 0.95 ? "2:3" : "1:1";
  const simple = width / g <= 32 && height / g <= 32;
  return { ratio: simple ? ratio : `${r.toFixed(2).replace(".", ",")}:1`, orientation, closest };
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "produto";

/** Nome do arquivo de foto do produto — o mesmo nome é citado no prompt. */
export function productAttachmentName(p: Product, index: number, mimeType = "image/png") {
  return `produto-${index + 1}-${slug(p.code || p.name)}.${EXT[mimeType] ?? "png"}`;
}
export function logoAttachmentName(mimeType = "image/png") {
  return `logo-digitusul.${EXT[mimeType] ?? "png"}`;
}
export function mascotAttachmentName(mimeType = "image/png") {
  return `mascote-digu.${EXT[mimeType] ?? "png"}`;
}

/** Problemas que impedem montar o prompt (dados comerciais incompletos). */
export function promptBlockers(products: Product[], category: CategoryKey): string[] {
  const out: string[] = [];
  if (category !== "institucional" && products.length === 0) out.push("Adicione ao menos um produto.");
  products.forEach((p, i) => {
    const label = p.name?.trim() || `#${i + 1}`;
    if (!p.code?.trim()) out.push(`Produto ${label}: falta o código.`);
    if (!p.name?.trim()) out.push(`Produto ${label}: falta o nome.`);
    if (p.priceCents == null || p.priceCents <= 0) out.push(`Produto ${label}: falta o preço.`);
    if (p.priceUncertain) out.push(`Produto ${label}: confirme se o valor é o do cartão (não PIX).`);
  });
  return out;
}

export function buildChatGptPrompt(input: PromptInput): string {
  const blockers = promptBlockers(input.products, input.category);
  if (blockers.length) throw new Error(blockers.join(" "));

  const cat = CATEGORIES.find((c) => c.key === input.category)!;
  const fmt = getFormat(input.formatKey);
  const a = aspectDescription(input.width, input.height);
  const withImages = input.products.filter((p) => p.imageFileId);
  const lines: string[] = [];

  lines.push(`Crie a arte de um flyer ${cat.label.toLowerCase()} para a loja Digitusul${input.segment ? `, segmento ${input.segment}` : ""}.`);
  lines.push("");
  lines.push("FORMATO");
  lines.push(`- ${fmt?.label ?? "Personalizado"}: ${input.width} × ${input.height} px, proporção ${a.ratio} (${a.orientation}). Gere a imagem na proporção ${a.closest}, a mais próxima disponível.`);
  lines.push("- Mantenha textos, preços e logo afastados das bordas (margem de segurança de 6%), pois a arte pode ser recortada para o tamanho exato.");
  lines.push("");
  lines.push("ESTILO");
  lines.push(`- ${CATEGORY_STYLE[input.category]}.`);
  lines.push(`- Cores da marca: principal ${input.colors.primary}, destaque ${input.colors.accent}, escuro ${input.colors.dark}, claro ${input.colors.light}. Use apenas essa paleta.`);
  lines.push(`- Tipografia sem serifa e moderna (referência: ${input.fonts.heading} para títulos e ${input.fonts.price} para preços), sempre legível.`);
  lines.push(input.emphasis === "price" ? "- O maior destaque visual é o preço de cada produto." : "- O maior destaque visual é a foto de cada produto; o preço vem logo em seguida.");
  if (input.batch && input.batch.total > 1) {
    lines.push(`- Este é o flyer ${input.batch.index + 1} de ${input.batch.total} de uma mesma série: mantenha a identidade visual da série, variando a composição.`);
  }
  lines.push("");
  lines.push("TEXTOS (escreva exatamente assim)");
  lines.push(`- Título: "${input.headline.trim()}"`);
  if (input.subheadline?.trim()) lines.push(`- Subtítulo: "${input.subheadline.trim()}"`);
  if (input.footerText?.trim()) lines.push(`- Rodapé: "${input.footerText.trim()}"`);

  if (input.products.length) {
    lines.push("");
    lines.push(`PRODUTOS (${input.products.length}) — copie nome, código e preço caractere por caractere`);
    input.products.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name.trim()}`);
      lines.push(`   Código: Cód. ${p.code.trim()}`);
      lines.push(`   Preço: ${formatPrice(p.priceCents!)}`);
      if (p.imageFileId) lines.push(`   Foto: arquivo anexado "${productAttachmentName(p, i)}" (o nome pode ter outra extensão)`);
    });
  }

  lines.push("");
  lines.push("IMAGENS ANEXADAS");
  if (withImages.length) lines.push("- Use as fotos anexadas dos produtos como estão: não redesenhe, não troque o modelo, a cor ou a marca do produto. Pode remover o fundo e adicionar sombra suave.");
  else lines.push("- Não há fotos dos produtos: não desenhe produtos inventados; use composição tipográfica e elementos gráficos.");
  if (input.hasLogo) lines.push(`- Aplique o logo anexado ("${logoAttachmentName()}") sem alterar cores, proporção ou letras, em área limpa e bem visível.`);
  else lines.push("- Escreva o nome \"Digitusul\" de forma discreta; não invente um logotipo.");
  if (input.hasMascot) lines.push(`- Inclua o mascote anexado ("${mascotAttachmentName()}") sem redesenhá-lo.`);

  if (input.extraInstructions?.trim()) {
    lines.push("");
    lines.push("INSTRUÇÕES ADICIONAIS");
    lines.push(input.extraInstructions.trim());
  }

  lines.push("");
  lines.push("REGRAS OBRIGATÓRIAS");
  lines.push("- Não invente, arredonde ou altere preços, códigos ou nomes.");
  lines.push("- Não adicione preço \"de/por\", parcelamento, porcentagem de desconto, frete, prazos, telefones, endereços ou qualquer texto que não esteja listado acima.");
  lines.push("- Todo texto em português do Brasil, sem erros de ortografia.");
  lines.push("- Gere uma única imagem, sem moldura de mockup.");
  return lines.join("\n");
}

/**
 * Divide os produtos de um lote entre N flyers, mantendo a ordem e
 * distribuindo as sobras nos primeiros (ex.: 14 produtos / 6 flyers → 3,3,2,2,2,2).
 */
export function splitIntoFlyers<T>(items: T[], flyers: number): T[][] {
  const n = Math.max(1, Math.min(flyers, Math.max(items.length, 1)));
  const base = Math.floor(items.length / n);
  const extra = items.length % n;
  const out: T[][] = [];
  let pos = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push(items.slice(pos, pos + size));
    pos += size;
  }
  return out;
}
