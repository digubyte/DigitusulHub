import { describe, expect, it } from "vitest";
import { DEFAULT_DAILY_PLAN, groupTheme, nameTokens, planBatch, productType, similarity, type Candidate } from "@/modules/flyer-studio/domain/batch-plan";

let n = 0;
const c = (name: string, price = 5000): Candidate => ({ code: String(1000 + n), name, cardPriceCents: price, rank: n++ });

describe("tokens e similaridade", () => {
  it("ignora cores, medidas e conectivos", () => {
    expect(nameTokens("Mouse Gamer Sem Fio Preto 7200 DPI RGB")).toEqual(["mouse", "gamer", "fio", "dpi"]);
    expect(productType("Caneca Térmica Inox 450ml")).toBe("caneca");
  });
  it("mesmo tipo é mais parecido que tipos diferentes", () => {
    expect(similarity("Mouse Gamer Redragon", "Mouse Office Logitech")).toBeGreaterThan(similarity("Mouse Gamer Redragon", "Teclado Gamer Redragon"));
  });
  it("tema do grupo", () => {
    expect(groupTheme([{ name: "Mouse A" }, { name: "Mouse B" }, { name: "Teclado C" }])).toBe("Mouse");
    expect(groupTheme([{ name: "Mouse A" }, { name: "Teclado B" }, { name: "Fone C" }])).toBe("Variados");
  });
});

describe("planBatch", () => {
  n = 0;
  const cands = [
    ...["Mouse Gamer A", "Mouse Gamer B", "Mouse Office C", "Mouse Sem Fio D", "Mouse Vertical E", "Mouse Pad F", "Mouse Gamer G"].map((x) => c(x)),
    ...["Teclado Mecânico A", "Teclado Gamer B", "Teclado Office C", "Teclado Sem Fio D", "Teclado Compacto E", "Teclado Numérico F"].map((x) => c(x)),
    ...["Headset Gamer A", "Headset Office B", "Headset Bluetooth C", "Headset USB D", "Headset 7.1 E", "Headset Infantil F"].map((x) => c(x)),
    c("Cadeira Gamer Premium", 129900), c("Monitor Gamer 27", 99900), c("Notebook Gamer", 499900), c("Webcam Full HD", 19900),
  ];
  const { flyers, spare } = planBatch(cands, DEFAULT_DAILY_PLAN);

  it("respeita os tamanhos e a ordem do plano", () => {
    expect(flyers.map((f) => f.products.length)).toEqual([6, 6, 6, 1, 1, 1]);
  });
  it("não repete produto", () => {
    const codes = flyers.flatMap((f) => f.products.map((p) => p.code));
    expect(new Set(codes).size).toBe(codes.length);
    expect(spare.length).toBe(cands.length - codes.length);
  });
  it("destaques são os de maior valor e de tipos diferentes", () => {
    const singles = flyers.filter((f) => f.size === 1).map((f) => f.products[0].name);
    expect(singles).toEqual(expect.arrayContaining(["Notebook Gamer", "Cadeira Gamer Premium", "Monitor Gamer 27"]));
  });
  it("agrupa por tipo de produto", () => {
    const themes = flyers.filter((f) => f.size === 6).map((f) => f.theme).sort();
    expect(themes).toEqual(["Headset", "Mouse", "Teclado"]);
  });
  it("com poucos produtos, os flyers ficam menores", () => {
    const r = planBatch(cands.slice(0, 4), [6, 1]);
    expect(r.flyers.map((f) => f.products.length)).toEqual([3, 1]);
  });
});
