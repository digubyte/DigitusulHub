/**
 * Monta o prompt que será colado no ChatGPT para gerar a arte do flyer.
 *
 * Regra central mantida: os dados comerciais (nome, código e preço) saem do
 * cadastro, já formatados pelo aplicativo, e o prompt exige que sejam copiados
 * caractere por caractere. Depois que a arte volta, o usuário confere cada
 * preço antes de salvar (checklist na tela do projeto).
 */
import { CATEGORIES, OFFICIAL_LOGOS, styleReferencesFor } from "./brand";
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
  const single = input.products.length <= 1;
  const refs = styleReferencesFor(input.products);
  lines.push("PADRÃO VISUAL (o mais importante depois dos dados)");
  lines.push(`- Siga o padrão das referências de estilo anexadas ("${refs[0].base}" e "${refs[1].base}"): são flyers aprovados da Digitusul. Reproduza o mesmo nível de acabamento, a organização do layout, a tipografia, a iluminação e o respiro.`);
  lines.push("- Das referências, copie só o estilo: NÃO copie os produtos, os textos, os preços nem as marcas que aparecem nelas.");
  lines.push("- Resultado de peça publicitária profissional de varejo, como feita por um designer no Photoshop — não pode parecer \"arte de IA\".");
  lines.push("- Fundo: estúdio limpo com luz suave e profundidade; superfície ou pódio discreto sob o produto; formas geométricas sutis na cor dominante. Sem excesso de brilhos, partículas, neon, fumaça ou efeitos.");
  lines.push("- Foto: o produto real anexado, nítido e em tamanho generoso, com sombra e reflexo naturais.");
  lines.push(`- Cores: escolha uma cor dominante coerente com o produto (ou o azul da marca ${input.colors.primary}) + branco/cinza claro + um tom escuro (${input.colors.dark}). Destaques em ${input.colors.accent} só onde ajudar.`);
  lines.push("- Tipografia: títulos em sans-serif condensada e pesada (estilo Bebas Neue/Oswald), textos de apoio em sans-serif fina; hierarquia clara, alinhamentos consistentes.");
  lines.push("- Preço em pílula/etiqueta sólida de cantos arredondados: \"R$\" pequeno, valor grande e centavos menores e elevados (ex.: R$ 115,⁹⁰), sem mudar o valor.");
  lines.push("- Ícones sempre de traço fino e monocromáticos.");
  if (!input.freeStyle) lines.push(`- Clima do flyer — ${CATEGORY_STYLE[input.category]}.`);
  lines.push("");
  lines.push("LAYOUT");
  const hero = heroProduct(input.products);
  if (single) {
    lines.push("- Topo à esquerda: logo da Digitusul.");
    lines.push("- Bloco de título à esquerda: linha curta com a categoria/marca do produto em letras pequenas; nome do produto em 2 linhas grandes (a 2ª linha na cor dominante); variante ou modelo em caixa alta com letras espaçadas.");
    lines.push("- Até 3 benefícios curtos com ícones de traço fino, só o que for evidente pelo nome do produto (na dúvida, omita; sem números técnicos inventados).");
    lines.push("- Produto grande à direita/centro, sobre pódio ou superfície, ocupando boa parte da arte.");
    lines.push("- Rodapé à esquerda: código pequeno, nome completo do produto e o preço em pílula grande. À direita, os selos com ícones finos separados por divisores.");
  } else {
    lines.push("- Topo: logo da Digitusul; título grande em 1–2 linhas com uma palavra/expressão em faixa colorida (pílula); subtítulo curto em uma linha.");
    if (hero) lines.push(`- "${hero.name.trim()}" é o produto principal: cartão maior em destaque logo abaixo do título; os outros ${input.products.length - 1} em cartões menores abaixo.`);
    else lines.push(`- Os ${input.products.length} produtos em grade de cartões brancos de cantos arredondados e sombra suave (2 colunas), todos com o mesmo peso visual.`);
    lines.push("- Cada cartão: foto do produto, \"Cód.\" em texto pequeno, nome em negrito (até 3 linhas) e o preço em pílula colorida no canto inferior.");
    lines.push("- Rodapé: faixa na cor escura com os selos (ícone fino + texto) e o logo da Digitusul.");
  }
  lines.push(input.emphasis === "price" ? "- Os preços são o principal destaque, logo depois vêm as fotos." : "- As fotos dos produtos são o principal destaque, logo depois vêm os preços.");
  if (input.theme && input.theme !== "Variados" && input.products.length > 1) lines.push(`- Tema do flyer: ${input.theme}.`);
  if (input.batch && input.batch.total > 1) {
    lines.push(`- Este é o flyer ${input.batch.index + 1} de ${input.batch.total} de uma série: mesmo padrão visual, composição adaptada a estes produtos.`);
  }
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
  if (input.hasLogo) {
    lines.push(`${n++}. "${OFFICIAL_LOGOS.dark.base}" — logo oficial da Digitusul, ${OFFICIAL_LOGOS.dark.use} (${OFFICIAL_LOGOS.dark.path})`);
    lines.push(`${n++}. "${OFFICIAL_LOGOS.light.base}" — logo oficial da Digitusul, ${OFFICIAL_LOGOS.light.use} (${OFFICIAL_LOGOS.light.path})`);
  }
  refs.forEach((r) => lines.push(`${n++}. "${r.base}" — referência de estilo, só o padrão visual (${r.path})`));
  if (input.hasMascot) lines.push(`${n++}. "${MASCOT_ATTACHMENT_BASE}" — mascote Digu`);
  input.products.forEach((p, i) => {
    if (p.imageFileId) lines.push(`${n++}. "${productAttachmentBase(p, i)}" — foto de ${p.name.trim()}${p.imageUrl ? ` (${p.imageUrl})` : ""}`);
  });
  if (n === 1) lines.push("- Nenhuma imagem anexada.");
  if (withImages.length) lines.push("- Use as fotos reais dos produtos: não redesenhe nem troque modelo, cor ou marca. Pode recortar o fundo, girar levemente, dar escala, reflexo, sombra e integrar o produto ao cenário.");
  else lines.push("- Não há fotos dos produtos: não desenhe produtos inventados; use composição tipográfica e elementos gráficos.");
  if (input.hasLogo) {
    lines.push(`- LOGO: coloque o arquivo de logo anexado como imagem, sem redesenhar. Use "${OFFICIAL_LOGOS.dark.base}" sobre fundo escuro/colorido e "${OFFICIAL_LOGOS.light.base}" sobre fundo claro.`);
    lines.push("- O logo é o símbolo do \"D\" com a faixa curva por dentro + a palavra \"DIGITUSUL®\" + \"Tecnologia e Suprimentos\" embaixo, numa cor só. Não recrie, não troque a fonte, não aplique degradê, 3D, contorno ou outras cores.");
    lines.push("- Tamanho moderado (até cerca de um terço da largura), em área limpa e bem visível.");
  }
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
