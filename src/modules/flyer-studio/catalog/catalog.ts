import "server-only";
/**
 * Catálogo do site Digitusul (índice de busca público do e-commerce).
 * Reescrito a partir do Digitusul Prompt Genie: mesma fonte e regras
 * (estoque > 2, valor no cartão = campo `preco`), com tratamento de erro,
 * configuração por variáveis de ambiente e sem duplicação de código.
 */
import { HttpError } from "@/core/http";

const APP_ID = process.env.CATALOG_ALGOLIA_APP_ID || "91279IH7HY";
// Chave pública de busca (somente leitura) usada pelo próprio site.
const API_KEY = process.env.CATALOG_ALGOLIA_SEARCH_KEY || "MzIyZDVjNDUxOTY5NWVmNTk1YTllOTg2Njk1YTA3MTZmNTVjZjAzMDFhN2Q0M2Q5MDk5M2ZiZDk1ODQ5NTkzYmZpbHRlcnM9aWRfZW1wcmVzYSUzQTI1JTIwQU5EJTIwZW1fZXN0b3F1ZSUzQXRydWU=";
const INDEX = process.env.CATALOG_ALGOLIA_INDEX || "produtos_digitusul";
export const SITE_URL = process.env.CATALOG_SITE_URL || "https://www.digitusul.com.br";
const MIN_STOCK = Number(process.env.CATALOG_MIN_STOCK ?? 2);

export interface CatalogProduct {
  code: string;
  name: string;
  /** Valor no cartão em centavos (o PIX é um desconto aplicado pelo site e nunca é usado). */
  cardPriceCents: number;
  imageUrl: string | null;
  url: string;
  stock: number;
}

interface Hit { nome?: string; codigo?: string | number; preco?: number; preco_original?: number; estoque?: number; imagem?: string; url?: string }

const ATTRS = ["nome", "codigo", "preco", "preco_original", "estoque", "imagem", "url"];

async function algolia<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://${APP_ID}-dsn.algolia.net/1/indexes/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Algolia-Application-Id": APP_ID, "X-Algolia-API-Key": API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new HttpError(502, "Não foi possível acessar o catálogo do site. Tente novamente.");
  }
  if (!res.ok) throw new HttpError(502, `O catálogo do site respondeu com erro (${res.status}).`);
  return (await res.json()) as T;
}

function toProduct(h: Hit): CatalogProduct | null {
  const price = Number(h.preco ?? h.preco_original ?? 0);
  if (!h.nome || h.codigo == null || !(price > 0)) return null;
  const img = h.imagem && !/no_image/i.test(h.imagem) ? h.imagem : null;
  return {
    code: String(h.codigo),
    name: String(h.nome).trim(),
    cardPriceCents: Math.round(price * 100),
    imageUrl: img,
    url: h.url ? (h.url.startsWith("http") ? h.url : `${SITE_URL}${h.url}`) : SITE_URL,
    stock: Number(h.estoque ?? 0),
  };
}

const inStock = (p: CatalogProduct) => p.stock > MIN_STOCK;

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Busca produtos pelos códigos exatos (em lotes de 25). */
export async function productsByCodes(codes: string[]): Promise<{ products: CatalogProduct[]; notFound: string[] }> {
  const wanted = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  const found = new Map<string, CatalogProduct>();
  for (let i = 0; i < wanted.length; i += 25) {
    const batch = wanted.slice(i, i + 25);
    const json = await algolia<{ results: { hits: Hit[] }[] }>("*/queries", {
      requests: batch.map((code) => ({
        indexName: INDEX,
        params: new URLSearchParams({ query: code, hitsPerPage: "3", restrictSearchableAttributes: "codigo", attributesToRetrieve: ATTRS.join(",") }).toString(),
      })),
    });
    json.results.forEach((r, idx) => {
      const exact = r.hits.map(toProduct).find((p) => p && p.code === batch[idx]);
      if (exact) found.set(exact.code, exact);
    });
  }
  return { products: wanted.map((c) => found.get(c)).filter((p): p is CatalogProduct => !!p), notFound: wanted.filter((c) => !found.has(c)) };
}

/** Busca textual (nome) — usada pela busca com IA. */
export async function searchByTerms(terms: string[], perTerm = 40): Promise<CatalogProduct[][]> {
  const json = await algolia<{ results: { hits: Hit[] }[] }>("*/queries", {
    requests: terms.map((t) => ({
      indexName: INDEX,
      params: new URLSearchParams({ query: t, hitsPerPage: String(perTerm), restrictSearchableAttributes: "nome", typoTolerance: "false", attributesToRetrieve: ATTRS.join(",") }).toString(),
    })),
  });
  return json.results.map((r) => r.hits.map(toProduct).filter((p): p is CatalogProduct => !!p && inStock(p)));
}

/** Sorteio de produtos com estoque, opcionalmente dentro de uma categoria do site. */
export async function randomProducts(count: number, opts: { categorySlug?: string; exclude?: string[] } = {}): Promise<CatalogProduct[]> {
  const exclude = new Set(opts.exclude ?? []);
  const keep = (list: CatalogProduct[]) => list.filter((p) => inStock(p) && !exclude.has(p.code));

  if (opts.categorySlug) {
    const codes = shuffle(await categoryCodes(opts.categorySlug, Math.min(count * 3 + 10, 200))).filter((c) => !exclude.has(c));
    const picked: CatalogProduct[] = [];
    for (let i = 0; i < codes.length && picked.length < count && i < 250; i += 50) {
      picked.push(...keep((await productsByCodes(codes.slice(i, i + 50))).products));
    }
    return picked.slice(0, count);
  }

  const first = await algolia<{ hits: Hit[]; nbPages: number }>(`${INDEX}/query`, { query: "", hitsPerPage: 50, page: 0, attributesToRetrieve: ATTRS });
  const maxPage = Math.max(0, Math.min(first.nbPages - 1, 200));
  let pool = keep(first.hits.map(toProduct).filter((p): p is CatalogProduct => !!p));
  for (let attempt = 0; attempt < 6 && pool.length < count * 4; attempt++) {
    const page = Math.floor(Math.random() * (maxPage + 1));
    const r = await algolia<{ hits: Hit[] }>(`${INDEX}/query`, { query: "", hitsPerPage: 50, page, attributesToRetrieve: ATTRS });
    pool = pool.concat(keep(r.hits.map(toProduct).filter((p): p is CatalogProduct => !!p)));
  }
  const unique = [...new Map(pool.map((p) => [p.code, p])).values()];
  return shuffle(unique).slice(0, count);
}

/** Lê os SKUs listados nas páginas de uma categoria do site. */
async function categoryCodes(slug: string, target: number): Promise<string[]> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new HttpError(400, "Categoria inválida.");
  const load = async (page: number) => {
    const res = await fetch(page > 1 ? `${SITE_URL}/${slug}?pg=${page}` : `${SITE_URL}/${slug}`, {
      headers: { "User-Agent": "DigitusulHub/1.0" }, signal: AbortSignal.timeout(15_000), cache: "no-store",
    }).catch(() => null);
    if (!res || !res.ok) throw new HttpError(502, "Não foi possível abrir a categoria no site.");
    return res.text();
  };
  const first = await load(1);
  const pages = [...first.matchAll(/\?pg=(\d+)/g)].map((m) => Number(m[1]));
  const last = pages.length ? Math.min(Math.max(...pages), 30) : 1;
  const order = shuffle(Array.from({ length: last }, (_, i) => i + 1)).slice(0, 12);
  const codes = new Set<string>();
  for (const page of order) {
    if (codes.size >= target) break;
    const html = page === 1 ? first : await load(page);
    for (const m of html.matchAll(/data-sku="(\d+)"/g)) codes.add(m[1]);
  }
  return [...codes];
}

/** Hosts dos quais o servidor pode baixar imagens de produtos do catálogo. */
const IMAGE_HOSTS = (process.env.CATALOG_IMAGE_HOSTS || "www.digitusul.com.br,digitusul.com.br,cdn.noxcommerce.com.br").split(",").map((h) => h.trim());

export async function downloadCatalogImage(url: string): Promise<Uint8Array> {
  let u: URL;
  try { u = new URL(url); } catch { throw new HttpError(400, "URL de imagem inválida."); }
  if (u.protocol !== "https:" || !IMAGE_HOSTS.includes(u.hostname)) throw new HttpError(400, "Imagem fora dos domínios permitidos do catálogo.");
  const res = await fetch(u, { signal: AbortSignal.timeout(20_000), redirect: "error", cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) throw new HttpError(502, "Não foi possível baixar a imagem do produto.");
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > 10 * 1024 * 1024) throw new HttpError(413, "Imagem do catálogo maior que 10 MB.");
  return new Uint8Array(await res.arrayBuffer());
}
