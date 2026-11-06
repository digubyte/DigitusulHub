import { describe, expect, it } from "vitest";
import { composeFlyer, syncBoundTexts } from "@/modules/flyer-studio/domain/layout-engine";
import { validateFlyer, hasBlockingIssues } from "@/modules/flyer-studio/domain/validation";
import { formatPrice, parsePriceInput, boundText } from "@/modules/flyer-studio/domain/product-format";
import { applyPricingRule, DEFAULT_PRICING_RULE } from "@/modules/flyer-studio/domain/pricing";
import { brandContextFromKit, CATEGORIES, DEFAULT_BRAND_COLORS } from "@/modules/flyer-studio/domain/brand";
import { FORMATS, resolveDimensions } from "@/modules/flyer-studio/domain/formats";
import { chooseGrid, boundingBox, inside } from "@/modules/flyer-studio/domain/geometry";
import { buildCategoryCsv, buildProductList } from "@/modules/flyer-studio/domain/lists";
import type { CategoryKey, LayoutOptions, Product, TextElement } from "@/modules/flyer-studio/domain/types";

const brand = brandContextFromKit({ colors: DEFAULT_BRAND_COLORS, fonts: {}, logo: { fileId: "logo1", width: 800, height: 200 } });
const product = (i: number, over: Partial<Product> = {}): Product => ({
  id: `p${i}`, code: `${10000 + i}`, name: `Produto de teste número ${i} com nome razoavelmente longo`, priceCents: 12990 + i, imageFileId: `img${i}`, imageWidth: 800, imageHeight: 600, ...over,
});
const options = (category: CategoryKey, over: Partial<LayoutOptions> = {}): LayoutOptions => ({
  category, headline: "Título", showMascot: false, logoPosition: "footer", style: "default", emphasis: "price", ...over,
});
const vc = (w: number, h: number) => ({ expectedWidth: w, expectedHeight: h, brandLogoFileIds: ["logo1"] });

describe("preços", () => {
  it("formata em reais", () => {
    expect(formatPrice(129990)).toBe("R$ 1.299,90");
    expect(formatPrice(5)).toBe("R$ 0,05");
  });
  it("interpreta entradas comuns sem arredondar silenciosamente", () => {
    expect(parsePriceInput("1.299,90")).toBe(129990);
    expect(parsePriceInput("R$ 1.299,90")).toBe(129990);
    expect(parsePriceInput("1299.9")).toBe(129990);
    expect(parsePriceInput("1.299")).toBe(129900);
    expect(parsePriceInput("12,5")).toBe(1250);
    expect(parsePriceInput("12,555")).toBeNull();
    expect(parsePriceInput("abc")).toBeNull();
    expect(parsePriceInput("")).toBeNull();
  });
  it("aplica a regra cartão + 8,12% com finais comerciais (mesmo resultado do app anterior)", () => {
    expect(applyPricingRule(78550, DEFAULT_PRICING_RULE)).toBe(84950); // 849,28 -> 849,50
    expect(applyPricingRule(9953, DEFAULT_PRICING_RULE)).toBe(10775); // 107,61 -> 107,75
  });
  it("arredonda para o próximo final ,50/,75/,90/,95/,99", () => {
    const rule = { markupEnabled: false, markupBps: 0, rounding: "psychological" as const };
    expect(applyPricingRule(935, { ...rule, markupEnabled: true })).toBe(950);
    expect(applyPricingRule(902, { ...rule, markupEnabled: true })).toBe(950);
    expect(applyPricingRule(999, { ...rule, markupEnabled: true })).toBe(999);
    expect(applyPricingRule(976, { ...rule, markupEnabled: true })).toBe(990);
  });
  it("modo centavos e acréscimo desativado", () => {
    expect(applyPricingRule(78550, { markupEnabled: true, markupBps: 812, rounding: "cents" })).toBe(84928);
    expect(applyPricingRule(78550, { markupEnabled: false, markupBps: 812, rounding: "psychological" })).toBe(78550);
  });
});

describe("motor de layout", () => {
  for (const cat of CATEGORIES.map((c) => c.key)) {
    for (const f of FORMATS) {
      for (const n of [1, 2, 4, 6]) {
        it(`${cat} · ${f.key} · ${n} produto(s): composição válida`, () => {
          const products = Array.from({ length: n }, (_, i) => product(i));
          const doc = composeFlyer({ width: f.width, height: f.height, products, options: options(cat), brand });
          expect(doc.width).toBe(f.width);
          expect(doc.height).toBe(f.height);
          const issues = validateFlyer(doc, products, vc(f.width, f.height)).filter((i) => i.level === "error");
          expect(issues).toEqual([]);
        });
      }
    }
  }

  it("preserva exatamente código, nome e preço do cadastro", () => {
    const products = [product(1), product(2, { name: "Nome com acentuação: Café ç ã", priceCents: 199 })];
    const doc = composeFlyer({ width: 1080, height: 1350, products, options: options("promocional"), brand });
    for (const p of products) {
      const texts = doc.elements.filter((e): e is TextElement => e.type === "text" && e.binding?.productId === p.id);
      expect(texts.find((t) => t.binding!.field === "price")!.text).toBe(formatPrice(p.priceCents!));
      expect(texts.find((t) => t.binding!.field === "code")!.text).toBe(`Cód. ${p.code}`);
      expect(texts.find((t) => t.binding!.field === "name")!.text).toBe(p.name);
    }
  });

  it("categorias produzem composições visualmente distintas", () => {
    const products = [product(1), product(2), product(3), product(4)];
    const sig = (cat: CategoryKey) => {
      const d = composeFlyer({ width: 1080, height: 1080, products, options: options(cat), brand });
      return `${d.background.color}|${d.elements.map((e) => `${e.type}:${e.role}`).join(",")}`;
    };
    const sigs = new Set(CATEGORIES.map((c) => sig(c.key)));
    expect(sigs.size).toBe(CATEGORIES.length);
  });

  it("a grade se adapta à quantidade e ao formato", () => {
    expect(chooseGrid(4, 1000, 1000, 10, 0.8)).toEqual({ cols: 2, rows: 2 });
    expect(chooseGrid(6, 1000, 1300, 10, 0.8).cols * chooseGrid(6, 1000, 1300, 10, 0.8).rows).toBeGreaterThanOrEqual(6);
    expect(chooseGrid(2, 1000, 1600, 10, 0.8)).toEqual({ cols: 1, rows: 2 });
  });

  it("logotipo preserva a proporção e fica bloqueado", () => {
    const doc = composeFlyer({ width: 1080, height: 1920, products: [product(1)], options: options("blackfriday"), brand });
    const logo = doc.elements.find((e) => e.role === "logo")!;
    expect(logo.locked).toBe(true);
    expect(logo.width / logo.height).toBeCloseTo(4, 2);
  });

  it("sincroniza textos vinculados após editar o produto", () => {
    const products = [product(1)];
    const doc = composeFlyer({ width: 1080, height: 1080, products, options: options("novidade"), brand });
    const updated = [{ ...products[0], priceCents: 4990 }];
    const synced = syncBoundTexts(doc, updated);
    expect(validateFlyer(doc, updated, vc(1080, 1080)).some((i) => i.code === "binding.price")).toBe(true);
    expect(hasBlockingIssues(validateFlyer(synced, updated, vc(1080, 1080)))).toBe(false);
  });
});

describe("validação pré-exportação", () => {
  const products = [product(1)];
  const base = () => composeFlyer({ width: 1080, height: 1080, products, options: options("promocional"), brand });

  it("bloqueia preço alterado manualmente no canvas", () => {
    const doc = base();
    const price = doc.elements.find((e) => e.binding?.field === "price") as TextElement;
    price.text = "R$ 1,00";
    expect(validateFlyer(doc, products, vc(1080, 1080)).some((i) => i.code === "binding.price" && i.level === "error")).toBe(true);
  });
  it("bloqueia preço coberto por elemento decorativo", () => {
    const doc = base();
    const price = doc.elements.find((e) => e.binding?.field === "price")!;
    doc.elements.push({ ...price, id: "x", type: "rect", role: "custom", name: "Retângulo", fill: "#000", stroke: "", strokeWidth: 0, cornerRadius: 0, binding: undefined } as never);
    expect(validateFlyer(doc, products, vc(1080, 1080)).some((i) => i.code === "price.covered")).toBe(true);
  });
  it("bloqueia logotipo distorcido", () => {
    const doc = base();
    const logo = doc.elements.find((e) => e.role === "logo")!;
    logo.width *= 1.3;
    expect(validateFlyer(doc, products, vc(1080, 1080)).some((i) => i.code === "logo.distorted")).toBe(true);
  });
  it("bloqueia produto sem código/preço e preço incerto (PIX)", () => {
    const bad = [product(1, { code: "", priceCents: null, priceUncertain: true })];
    const doc = composeFlyer({ width: 1080, height: 1080, products: bad, options: options("promocional"), brand });
    const codes = validateFlyer(doc, bad, vc(1080, 1080)).map((i) => i.code);
    expect(codes).toContain("product.code");
    expect(codes).toContain("product.priceCents");
  });
  it("bloqueia omissão de produto do flyer", () => {
    const doc = base();
    doc.elements = doc.elements.filter((e) => !(e.binding?.field === "price"));
    expect(validateFlyer(doc, products, vc(1080, 1080)).some((i) => i.code === "missing.price")).toBe(true);
  });
  it("bloqueia elementos críticos fora da área", () => {
    const doc = base();
    const name = doc.elements.find((e) => e.binding?.field === "name")!;
    name.x = 2000;
    expect(validateFlyer(doc, products, vc(1080, 1080)).some((i) => i.code === "bounds" && i.level === "error")).toBe(true);
  });
  it("detecta dimensões diferentes do formato", () => {
    expect(validateFlyer(base(), products, vc(1080, 1350)).some((i) => i.code === "dimensions")).toBe(true);
  });
});

describe("formatos e utilitários", () => {
  it("formatos fixos ignoram dimensões customizadas; personalizados validam limites", () => {
    expect(resolveDimensions("ig-stories", { width: 10, height: 10 })).toEqual({ width: 1080, height: 1920 });
    expect(resolveDimensions("custom", { width: 1500, height: 500 })).toEqual({ width: 1500, height: 500 });
    expect(() => resolveDimensions("custom", { width: 50, height: 500 })).toThrow();
  });
  it("caixa rotacionada", () => {
    const bb = boundingBox({ x: 0, y: 0, width: 100, height: 50, rotation: 90 });
    expect(bb.width).toBeCloseTo(50);
    expect(inside({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true);
  });
  it("lista e CSV no modelo do site", () => {
    const ps = [product(1, { name: 'Cabo "HDMI", 2m' })];
    expect(buildProductList(ps)).toBe(`10001 - Cabo "HDMI", 2m - ${formatPrice(12991)}`);
    expect(buildCategoryCsv(ps)).toBe('﻿Sku,Nome,Ativo,Ordem\r\n10001,"Cabo ""HDMI"", 2m",1,\r\n');
    expect(boundText(ps[0], "code")).toBe("Cód. 10001");
  });
});
