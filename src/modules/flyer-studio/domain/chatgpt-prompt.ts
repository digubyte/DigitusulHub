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
  /** Título opcional: vazio = arte sem chamada escrita. */
  headline?: string;
  subheadline?: string;
  footerText?: string;
  /** Segmento do lote (ex.: Gamer, Limpeza, Escritório). */
  segment?: string;
  products: Product[];
  colors: BrandContext["colors"];
  fonts: BrandContext["fonts"];
  hasLogo: boolean;
  /** Link público do logo (referência extra além do anexo). */
  logoUrl?: string;
  /** Sem estilo escolhido: o ChatGPT define o clima a partir dos produtos. */
  freeStyle?: boolean;
  /** Selos de condições aprovados (ex.: "10x sem juros"), escritos exatamente assim. */
  seals?: string[];
  /** Tema do flyer no lote (ex.: "Mouse", "Variados"). */
  theme?: string;
  hasMascot: boolean;
  emphasis: "price" | "product";
  extraInstructions?: string;
  /** Posição no lote, para variar a composição entre os flyers. */
  batch?: { index: number; total: number };
}

/** Clima de cada tipo de flyer (ponto de partida para a criatividade, não uma regra rígida). */
const CATEGORY_STYLE: Record<CategoryKey, string> = {
  novidade: "lançamento: moderno, tecnológico e convidativo, com selo \"NOVIDADE\"",
  promocional: "oferta: energia de varejo, chamativo e vibrante, com os preços saltando aos olhos",
  reposicao: "reposição: confiável e positivo, com selo \"DE VOLTA AO ESTOQUE\"",
  queima: "queima de estoque: urgência e oportunidade, contraste alto, selo \"QUEIMA DE ESTOQUE\" e preços enormes",
  blackfriday: "Black Friday: escuro e premium, com brilhos e detalhes na cor de destaque, selo \"BLACK FRIDAY\"",
  institucional: "institucional: elegante, sóbrio e claro",
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
const slug = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "produto";

/** Nome do arquivo de foto do produto — o mesmo nome é citado no prompt. */
/** Nome (sem extensão) usado no prompt e no arquivo anexado. */
export const productAttachmentBase = (p: Product, index: number) => `produto-${index + 1}-${slug(p.code || p.name)}`;
export const LOGO_ATTACHMENT_BASE = "logo-digitusul";
export const MASCOT_ATTACHMENT_BASE = "mascote-digu";

export function productAttachmentName(p: Product, index: number, mimeType = "image/png") {
  return `${productAttachmentBase(p, index)}.${EXT[mimeType] ?? "png"}`;
}
export function logoAttachmentName(mimeType = "image/png") {
  return `${LOGO_ATTACHMENT_BASE}.${EXT[mimeType] ?? "png"}`;
}
export function mascotAttachmentName(mimeType = "image/png") {
  return `${MASCOT_ATTACHMENT_BASE}.${EXT[mimeType] ?? "png"}`;
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

/** Produto principal do flyer: só quando um item vale bem mais que os outros (ex.: impressora + filamentos). */
export function heroProduct(products: Product[]): Product | null {
  if (products.length < 3) return null;
  const sorted = [...products].sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0));
  const [top, ...rest] = sorted;
  const median = rest[Math.floor(rest.length / 2)]?.priceCents ?? 0;
  return median > 0 && (top.priceCents ?? 0) >= median * 4 ? top : null;
}

export function buildChatGptPrompt(input: PromptInput): string {
  const blockers = promptBlockers(input.products, input.category);
  if (blockers.length) throw new Error(blockers.join(" "));

  const cat = CATEGORIES.find((c) => c.key === input.category)!;
  const fmt = getFormat(input.formatKey);
  const a = aspectDescription(input.width, input.height);
  const withImages = input.products.filter((p) => p.imageFileId);
  const lines: string[] = [];

  lines.push(`Crie a arte de um flyer ${input.freeStyle ? "" : `${cat.label.toLowerCase()} `}para a loja Digitusul${input.segment ? `, segmento ${input.segment}` : ""}.`);
  lines.push("");
  lines.push("FORMATO");
  lines.push(`- ${fmt?.label ?? "Personalizado"}: ${input.width} × ${input.height} px, proporção ${a.ratio} (${a.orientation}). Gere a imagem na proporção ${a.closest}, a mais próxima disponível.`);
  lines.push("- Mantenha textos, preços e logo afastados das bordas (margem de segurança de 6%), pois a arte pode ser recortada para o tamanho exato.");
  lines.push("");
  lines.push("DIREÇÃO DE ARTE (você tem liberdade criativa)");
  lines.push("- Pense como um diretor de arte: crie um design rico e marcante a partir dos próprios produtos — cenário, fundo, iluminação, texturas e elementos gráficos inspirados no universo deles (ex.: limpeza → frescor, água e brilho; gamer → luzes neon e setup; escritório → mesa organizada e produtividade).");
  lines.push("- Evite fundo liso ou chapado: use profundidade, luz, sombras, camadas, formas e movimento, sem deixar a arte poluída.");
  lines.push(input.freeStyle ? "- Clima do flyer: escolha você o que combina melhor com estes produtos (sem selos de campanha como \"Black Friday\" ou \"Queima de estoque\")." : `- Clima do flyer — ${CATEGORY_STYLE[input.category]}.`);
  lines.push(`- Paleta a partir das cores da marca: principal ${input.colors.primary}, destaque ${input.colors.accent}, escuro ${input.colors.dark}, claro ${input.colors.light}. Pode usar variações, degradês e tons que combinem com os produtos.`);
  lines.push(`- Tipografia moderna, com hierarquia forte e criativa (referência: ${input.fonts.heading} nos títulos e ${input.fonts.price} nos preços), sempre legível.`);
  lines.push(input.emphasis === "price" ? "- Os preços são o principal destaque, logo depois vêm as fotos." : "- As fotos dos produtos são o principal destaque, logo depois vêm os preços.");
  const hero = heroProduct(input.products);
  if (input.products.length <= 1) {
    lines.push("- Destaque único: o produto é o herói da arte, com foto grande e um cenário pensado para ele; nome legível e preço em tamanho grande.");
  } else if (hero) {
    lines.push(`- Hierarquia: "${hero.name.trim()}" é o produto principal — maior, em posição de destaque, com cartão próprio; os outros ${input.products.length - 1} aparecem como complementares, menores e organizados abaixo ou ao lado.`);
  } else {
    lines.push(`- Organize os ${input.products.length} produtos com clareza (grade, vitrine ou mosaico criativo), cada um com foto, nome, código e preço próximos e com o mesmo peso visual.`);
  }
  lines.push("- Preços em etiquetas fortes; pode deixar os centavos menores e elevados (ex.: R$ 115,⁹⁰), sem mudar o valor.");
  if (input.theme && input.theme !== "Variados" && input.products.length > 1) lines.push(`- Tema do flyer: ${input.theme}.`);
  if (input.batch && input.batch.total > 1) {
    lines.push(`- Este é o flyer ${input.batch.index + 1} de ${input.batch.total} de uma série: mantenha a identidade da série, mas crie uma composição própria para estes produtos.`);
  }
  lines.push("- Limite da criatividade: a liberdade vale para o design. Os produtos (fotos), os dados comerciais e o logo não mudam.");
  lines.push("");
  const texts = [
    input.headline?.trim() && `- Título: "${input.headline.trim()}"`,
    input.subheadline?.trim() && `- Subtítulo: "${input.subheadline.trim()}"`,
    input.footerText?.trim() && `- Rodapé: "${input.footerText.trim()}"`,
  ].filter(Boolean) as string[];
  if (texts.length) {
    lines.push("TEXTOS (escreva exatamente assim)");
    lines.push(...texts);
  } else {
    lines.push("TEXTOS");
    lines.push("- Título: crie uma chamada curta e chamativa (até 6 palavras) sobre o tema dos produtos, sem números, preços, descontos ou promessas.");
  }
  if (input.seals?.length) {
    lines.push("");
    lines.push("SELOS DE CONDIÇÕES (faixa no rodapé, com ícones, escritos exatamente assim)");
    input.seals.forEach((s) => lines.push(`- "${s}"`));
  }

  if (input.products.length) {
    lines.push("");
    lines.push(`PRODUTOS (${input.products.length}) — copie nome, código e preço caractere por caractere`);
    input.products.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name.trim()}`);
      lines.push(`   Código: Cód. ${p.code.trim()}`);
      lines.push(`   Preço: ${formatPrice(p.priceCents!)}`);
      if (p.imageFileId) lines.push(`   Foto: imagem anexada "${productAttachmentBase(p, i)}"`);
    });
  }

  lines.push("");
  lines.push("IMAGENS DE REFERÊNCIA (anexadas junto com este prompt)");
  let n = 1;
  if (input.hasLogo) lines.push(`${n++}. "${LOGO_ATTACHMENT_BASE}" — logo oficial da Digitusul${input.logoUrl ? ` (${input.logoUrl})` : ""}`);
  if (input.hasMascot) lines.push(`${n++}. "${MASCOT_ATTACHMENT_BASE}" — mascote Digu`);
  input.products.forEach((p, i) => {
    if (p.imageFileId) lines.push(`${n++}. "${productAttachmentBase(p, i)}" — foto de ${p.name.trim()}${p.imageUrl ? ` (${p.imageUrl})` : ""}`);
  });
  if (n === 1) lines.push("- Nenhuma imagem anexada.");
  if (withImages.length) lines.push("- Use as fotos reais dos produtos: não redesenhe nem troque modelo, cor ou marca. Pode recortar o fundo, girar levemente, dar escala, reflexo, sombra e integrar o produto ao cenário.");
  else lines.push("- Não há fotos dos produtos: não desenhe produtos inventados; use composição tipográfica e elementos gráficos.");
  if (input.hasLogo) lines.push("- Aplique o logo exatamente como na imagem anexada (sem alterar cores, proporção ou letras), em área limpa e bem visível, mas em tamanho moderado — no topo ou no rodapé, sem ocupar mais que cerca de um terço da largura. Os produtos são o foco.");
  else lines.push("- Escreva o nome \"Digitusul\" de forma discreta; não invente um logotipo.");
  if (input.hasMascot) lines.push("- Inclua o mascote anexado sem redesenhá-lo.");

  if (input.extraInstructions?.trim()) {
    lines.push("");
    lines.push("INSTRUÇÕES ADICIONAIS");
    lines.push(input.extraInstructions.trim());
  }

  lines.push("");
  lines.push("REGRAS OBRIGATÓRIAS");
  lines.push("- Não invente, arredonde ou altere preços, códigos ou nomes.");
  lines.push(`- Não adicione preço \"de/por\", valor no PIX, ${input.seals?.length ? "condições além dos selos listados, " : "parcelamento, descontos, frete, "}prazos, telefones, endereços ou qualquer outro texto comercial que não esteja listado acima.`);
  lines.push("- Todo texto em português do Brasil, sem erros de ortografia.");
  lines.push("- Não invente produtos, brindes ou selos de garantia que não foram pedidos.");
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
