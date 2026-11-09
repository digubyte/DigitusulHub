/**
 * Monta o "lote do dia": escolhe produtos de uma categoria e os distribui entre
 * os flyers, juntando no mesmo flyer o que tem a ver entre si (mesmo tipo de
 * produto, mesma marca, palavras em comum) e reservando os mais relevantes e
 * de maior valor para os flyers de 1 produto (destaques).
 *
 * "Relevância" = posição na listagem da categoria no site (rank 0 = primeiro).
 * Função pura: não acessa rede nem banco.
 */

export interface Candidate {
  code: string;
  name: string;
  cardPriceCents: number;
  rank: number;
}

export interface PlannedFlyer<T extends Candidate = Candidate> {
  size: number;
  theme: string;
  products: T[];
}

const STOP = new Set([
  "de", "da", "do", "das", "dos", "com", "sem", "para", "por", "pra", "em", "e", "ou", "a", "o", "as", "os", "um", "uma",
  "c", "s", "p", "x", "kit", "und", "un", "unid", "unidade", "unidades", "pct", "pacote", "cx", "caixa", "pc", "pcs", "peca", "pecas",
  "preto", "preta", "branco", "branca", "azul", "vermelho", "vermelha", "verde", "amarelo", "amarela", "rosa", "roxo", "roxa", "cinza",
  "prata", "dourado", "dourada", "laranja", "marrom", "bege", "transparente", "colorido", "colorida", "sortido", "sortida", "cores",
  "novo", "nova", "original", "linha", "modelo", "tipo", "serie", "pro", "plus", "max", "mini", "rgb", "led", "usb",
]);

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Palavras significativas do nome (sem números, medidas, cores e conectivos). */
export function nameTokens(name: string): string[] {
  return norm(name)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t) && !/\d/.test(t));
}

/** Tipo do produto = primeira palavra significativa (ex.: "mouse", "teclado", "squeeze"). */
export function productType(name: string): string {
  return nameTokens(name)[0] ?? "";
}

export function similarity(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => tb.has(t) && inter++);
  const jaccard = inter / (ta.size + tb.size - inter);
  const sameType = productType(a) && productType(a) === productType(b) ? 1 : 0;
  return sameType + jaccard;
}

const title = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Tema do flyer: o tipo de produto mais frequente no grupo. */
export function groupTheme(products: { name: string }[]): string {
  const count = new Map<string, number>();
  for (const p of products) {
    const t = productType(p.name);
    if (t) count.set(t, (count.get(t) ?? 0) + 1);
  }
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best) return "";
  if (!(best[1] >= Math.ceil(products.length / 2) || products.length === 1)) return "Variados";
  // Mostra a palavra como está escrita no nome (com acento), ex.: "Água" em vez de "agua".
  for (const p of products) {
    const word = p.name.split(/[^\p{L}\p{N}]+/u).find((w) => norm(w) === best[0]);
    if (word) return title(word.toLowerCase());
  }
  return title(best[0]);
}

/**
 * Distribui os candidatos nos tamanhos pedidos (ex.: [6,6,6,1,1,1]).
 * Os flyers voltam na mesma ordem dos tamanhos. Se faltar produto, o flyer fica menor.
 */
export function planBatch<T extends Candidate>(candidates: T[], sizes: number[]): { flyers: PlannedFlyer<T>[]; spare: T[] } {
  const pool = [...candidates].sort((a, b) => a.rank - b.rank);
  const used = new Set<string>();
  const take = (p: T) => { used.add(p.code); return p; };
  const free = () => pool.filter((p) => !used.has(p.code));
  const out: PlannedFlyer<T>[] = sizes.map((size) => ({ size, theme: "", products: [] }));

  // 1) Destaques (flyers de 1 produto): maior valor, com peso para a relevância, de tipos diferentes.
  const singles = out.filter((f) => f.size === 1);
  if (singles.length) {
    const len = Math.max(1, pool.length);
    const heroScore = (p: T) => p.cardPriceCents * (1 - (0.5 * p.rank) / len);
    const byValue = [...pool].sort((a, b) => heroScore(b) - heroScore(a) || a.rank - b.rank);
    const types = new Set<string>();
    for (const f of singles) {
      const pick = byValue.find((p) => !used.has(p.code) && !types.has(productType(p.name))) ?? byValue.find((p) => !used.has(p.code)) ?? free()[0];
      if (!pick) break;
      types.add(productType(pick.name));
      f.products.push(take(pick));
    }
  }

  // 2) Flyers com vários produtos: semente = mais relevante livre; completa com os mais parecidos com o grupo.
  const multis = out.filter((f) => f.size > 1).sort((a, b) => b.size - a.size);
  for (const f of multis) {
    const remaining = free();
    if (!remaining.length) break;
    // Prefere como semente um produto cujo tipo tenha itens suficientes para encher o flyer.
    const typeCount = new Map<string, number>();
    remaining.forEach((p) => typeCount.set(productType(p.name), (typeCount.get(productType(p.name)) ?? 0) + 1));
    const seed = remaining.find((p) => (typeCount.get(productType(p.name)) ?? 0) >= f.size) ?? remaining[0];
    f.products.push(take(seed));
    while (f.products.length < f.size) {
      const rest = free();
      if (!rest.length) break;
      let best = rest[0];
      let bestScore = -Infinity;
      for (const p of rest) {
        const avg = f.products.reduce((s, q) => s + similarity(p.name, q.name), 0) / f.products.length;
        const score = avg - p.rank * 0.002; // empate: o mais relevante
        if (score > bestScore) { bestScore = score; best = p; }
      }
      f.products.push(take(best));
    }
    // Dentro do flyer, mantém a ordem de relevância.
    f.products.sort((a, b) => a.rank - b.rank);
  }

  out.forEach((f) => (f.theme = groupTheme(f.products)));
  return { flyers: out, spare: free() };
}

/** Plano padrão do dia: 3 flyers com 6 produtos e 3 flyers com 1 produto. */
export const DEFAULT_DAILY_PLAN = [6, 6, 6, 1, 1, 1];
