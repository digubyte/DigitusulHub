import { describe, expect, it } from "vitest";
import { aspectDescription, buildChatGptPrompt, heroProduct, productAttachmentBase, promptBlockers, splitIntoFlyers, type PromptInput } from "@/modules/flyer-studio/domain/chatgpt-prompt";
import type { Product } from "@/modules/flyer-studio/domain/types";
import { styleReferencesFor } from "@/modules/flyer-studio/domain/brand";

const product = (over: Partial<Product> = {}): Product => ({ id: Math.random().toString(36), code: "12345", name: "Mouse Gamer RGB 7200 DPI", priceCents: 12990, imageFileId: "f1", ...over });

const base = (over: Partial<PromptInput> = {}): PromptInput => ({
  category: "promocional", formatKey: "ig-feed", width: 1080, height: 1350, headline: "Ofertas da semana",
  products: [product(), product({ code: "A-77", name: "Teclado Mecânico", priceCents: 129999, imageFileId: null })],
  colors: { primary: "#2341C1", accent: "#E61F27", dark: "#0B1A4A", light: "#F3F5FA", surface: "#FFFFFF" },
  fonts: { heading: "Montserrat", body: "Inter", price: "Montserrat" },
  hasLogo: true, hasMascot: false, emphasis: "price", ...over,
});

describe("buildChatGptPrompt", () => {
  it("copia nome, código e preço exatos de cada produto", () => {
    const p = buildChatGptPrompt(base());
    expect(p).toContain("Mouse Gamer RGB 7200 DPI");
    expect(p).toContain("Cód. 12345");
    expect(p).toContain("R$ 129,90");
    expect(p).toContain("Teclado Mecânico");
    expect(p).toContain("Cód. A-77");
    expect(p).toContain("R$ 1.299,99");
    expect(p).not.toMatch(/ /);
  });

  it("informa formato, proporção e regras de não alterar preços", () => {
    const p = buildChatGptPrompt(base());
    expect(p).toContain("1080 × 1350 px");
    expect(p).toContain("4:5");
    expect(p).toContain("2:3");
    expect(p).toMatch(/Não invente, arredonde ou altere preços/);
    expect(p).toContain("logo-digitusul");
  });

  it("referencia a foto anexada só de quem tem imagem", () => {
    const p = buildChatGptPrompt(base());
    expect(p).toContain(`"${productAttachmentBase(base().products[0], 0)}"`);
    expect(p.match(/Foto: imagem anexada/g)).toHaveLength(1);
  });

  it("inclui segmento, posição no lote e instruções extras", () => {
    const p = buildChatGptPrompt(base({ segment: "Gamer", batch: { index: 2, total: 6 }, extraInstructions: "Fundo com luzes neon." }));
    expect(p).toContain("segmento Gamer");
    expect(p).toContain("flyer 3 de 6");
    expect(p).toContain("Fundo com luzes neon.");
  });

  it("recusa produtos sem preço, código ou com valor incerto", () => {
    expect(() => buildChatGptPrompt(base({ products: [product({ priceCents: null })] }))).toThrow(/preço/);
    expect(promptBlockers([product({ code: " " })], "promocional")[0]).toMatch(/código/);
    expect(promptBlockers([product({ priceUncertain: true })], "promocional")[0]).toMatch(/PIX/);
    expect(promptBlockers([], "promocional")).toHaveLength(1);
    expect(promptBlockers([], "institucional")).toHaveLength(0);
  });
});

describe("aspectDescription", () => {
  it("descreve proporção e orientação", () => {
    expect(aspectDescription(1080, 1350)).toEqual({ ratio: "4:5", orientation: "vertical", closest: "2:3" });
    expect(aspectDescription(1080, 1080).closest).toBe("1:1");
    expect(aspectDescription(1920, 600)).toMatchObject({ ratio: "16:5", orientation: "horizontal", closest: "3:2" });
    expect(aspectDescription(2480, 3508).ratio).toBe("0,71:1");
  });
});

describe("splitIntoFlyers", () => {
  it("divide mantendo a ordem e espalhando as sobras", () => {
    const items = Array.from({ length: 14 }, (_, i) => i);
    const parts = splitIntoFlyers(items, 6);
    expect(parts.map((p) => p.length)).toEqual([3, 3, 2, 2, 2, 2]);
    expect(parts.flat()).toEqual(items);
  });
  it("não cria flyers vazios quando há menos produtos que flyers", () => {
    expect(splitIntoFlyers([1, 2, 3], 6)).toEqual([[1], [2], [3]]);
    expect(splitIntoFlyers([], 6)).toEqual([[]]);
  });
});

describe("imagens de referência", () => {
  it("lista os 2 logos oficiais, as referências de estilo e as fotos", () => {
    const p = buildChatGptPrompt(base({ products: [product({ imageUrl: "https://cdn.exemplo.com/mouse.webp" })] }));
    expect(p).toContain("IMAGENS DE REFERÊNCIA");
    expect(p).toContain('1. "logo-digitusul-branco" — logo oficial da Digitusul, versão branca');
    expect(p).toContain('2. "logo-digitusul-azul" — logo oficial da Digitusul, versão azul-marinho');
    expect(p).toContain('3. "referencia-estilo-1" — referência de estilo');
    expect(p).toContain('4. "referencia-estilo-2" — referência de estilo');
    expect(p).toMatch(/5\. "produto-1-12345" — foto de Mouse Gamer RGB 7200 DPI \(https:\/\/cdn\.exemplo\.com\/mouse\.webp\)/);
    expect(p).toContain("sem redesenhar");
    expect(p).toContain("Bloco de título à esquerda");
  });
  it("flyer com vários produtos pede grade de cartões e mostra o tema", () => {
    const p = buildChatGptPrompt(base({ theme: "Mouse" }));
    expect(p).toContain("grade de cartões brancos");
    expect(p).not.toContain("liberdade criativa");
    expect(p).toContain("NÃO copie os produtos");
    expect(p).toContain("Tema do flyer: Mouse.");
  });
  it("referências de estilo: destaque usa as de destaque, grade as de grade, sempre 2 diferentes e estáveis", () => {
    const one = styleReferencesFor([{ code: "40727" }]);
    const six = styleReferencesFor(["1", "2", "3", "4", "5", "6"].map((code) => ({ code })));
    expect(one).toHaveLength(2);
    expect(one.every((r) => r.path.includes("/destaque-"))).toBe(true);
    expect(six.every((r) => r.path.includes("/grade-"))).toBe(true);
    expect(one[0].path).not.toBe(one[1].path);
    expect(styleReferencesFor([{ code: "40727" }])).toEqual(one);
    for (let i = 0; i < 50; i++) { const r = styleReferencesFor([{ code: `X${i}` }, { code: "Y" }]); expect(r[0].path).not.toBe(r[1].path); }
  });
});

describe("título opcional", () => {
  it("sem título, o prompt não pede chamada escrita", () => {
    const p = buildChatGptPrompt(base({ headline: "" }));
    expect(p).not.toContain('Título: "');
    expect(p).toContain("crie uma chamada curta");
  });
  it("com título, ele vai exatamente como digitado", () => {
    expect(buildChatGptPrompt(base({ headline: "Semana Gamer" }))).toContain('- Título: "Semana Gamer"');
  });
});

describe("selos e hierarquia", () => {
  it("selos aprovados vão no rodapé e liberam só essas condições", () => {
    const p = buildChatGptPrompt(base({ seals: ["10% OFF no PIX", "10x sem juros"] }));
    expect(p).toContain("SELOS DE CONDIÇÕES");
    expect(p).toContain('- "10x sem juros"');
    expect(p).toContain("condições além dos selos listados");
    expect(buildChatGptPrompt(base())).toContain("parcelamento, descontos, frete");
  });
  it("produto bem mais caro vira o principal", () => {
    const filamentos = [1, 2, 3, 4, 5].map((i) => product({ id: String(i), code: `F${i}`, name: `Filamento ${i}`, priceCents: 11590 }));
    const impressora = product({ id: "0", code: "47659", name: "Impressora 3D LAB A1", priceCents: 492599 });
    expect(heroProduct([impressora, ...filamentos])?.code).toBe("47659");
    expect(buildChatGptPrompt(base({ products: [impressora, ...filamentos] }))).toContain('"Impressora 3D LAB A1" é o produto principal');
    expect(heroProduct(filamentos)).toBeNull();
  });
});


describe("estilo livre", () => {
  it("sem estilo, o prompt não impõe categoria nem selo de campanha", () => {
    const p = buildChatGptPrompt(base({ freeStyle: true }));
    expect(p.split("\n")[0]).toBe("Crie a arte de um flyer para a loja Digitusul.");
    expect(p).not.toContain("Clima do flyer");
  });
});
