import { describe, expect, it } from "vitest";
import { DEFAULT_ROLES, ALL_PERMISSIONS, canDeleteFlyer, canEditFlyer, canViewFlyer } from "@/core/permissions";
import { MODULES } from "@/core/modules/registry";
import { isSafeSvg, readImageSize, sniffImageMime } from "@/core/storage/file-validation";
import { interpretPrompt } from "@/modules/flyer-studio/ai/rule-interpreter";
import { applySuggestion, containsCommercialValue, sanitizeSuggestion } from "@/modules/flyer-studio/ai/suggestion";
import type { LayoutOptions } from "@/modules/flyer-studio/domain/types";

const perms = (role: keyof typeof DEFAULT_ROLES) => new Set<string>(DEFAULT_ROLES[role].permissions);

describe("perfis e permissões", () => {
  it("colaborador só edita/exclui os próprios flyers", () => {
    const p = perms("COLABORADOR");
    expect(canEditFlyer(p, "u1", "u1")).toBe(true);
    expect(canEditFlyer(p, "u1", "u2")).toBe(false);
    expect(canViewFlyer(p, "u1", "u2")).toBe(false);
    expect(canViewFlyer(p, "u1", "u2", true)).toBe(true); // templates compartilhados
    expect(canDeleteFlyer(p, "u1", "u2")).toBe(false);
    expect(p.has("users.manage")).toBe(false);
    expect(p.has("brandkit.manage")).toBe(false);
  });
  it("gestor vê a equipe mas não edita projetos de outros", () => {
    const p = perms("GESTOR");
    expect(canViewFlyer(p, "u1", "u2")).toBe(true);
    expect(canEditFlyer(p, "u1", "u2")).toBe(false);
    expect(p.has("users.manage")).toBe(false);
  });
  it("administrador tem todas as permissões", () => {
    expect(perms("ADMIN").size).toBe(ALL_PERMISSIONS.length);
    expect(canDeleteFlyer(perms("ADMIN"), "u1", "u2")).toBe(true);
  });
  it("todo módulo referencia uma permissão existente", () => {
    for (const m of MODULES) expect(ALL_PERMISSIONS).toContain(m.permission);
  });
});

describe("uploads", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 2, 0, 0, 0, 1, 0x2c]);
  it("identifica o tipo pelo conteúdo", () => {
    expect(sniffImageMime(png)).toBe("image/png");
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageMime(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffImageMime(new TextEncoder().encode("MZ executável"))).toBeNull();
  });
  it("lê dimensões de PNG e SVG", () => {
    expect(readImageSize(png, "image/png")).toEqual({ width: 512, height: 300 });
    expect(readImageSize(new TextEncoder().encode('<svg viewBox="0 0 1080 540">'), "image/svg+xml")).toEqual({ width: 1080, height: 540 });
  });
  it("rejeita SVG com script, eventos ou referências externas", () => {
    expect(isSafeSvg('<svg><path d="M0"/></svg>')).toBe(true);
    expect(isSafeSvg("<svg><script>alert(1)</script></svg>")).toBe(false);
    expect(isSafeSvg('<svg onload="x()"></svg>')).toBe(false);
    expect(isSafeSvg('<svg><image href="https://evil/x.png"/></svg>')).toBe(false);
  });
});

describe("IA: proteção dos dados comerciais", () => {
  it("descarta textos sugeridos com preços, percentuais ou códigos", () => {
    expect(containsCommercialValue("Tudo por R$ 9,90")).toBe(true);
    expect(containsCommercialValue("Até 50% off")).toBe(true);
    expect(containsCommercialValue("Cód 123456")).toBe(true);
    expect(containsCommercialValue("Ofertas da semana")).toBe(false);
    const s = sanitizeSuggestion({ headline: "Notebook por 2.999,00", subheadline: "Tecnologia para você", category: "x" as never, backgroundColor: "blue" }, "ai");
    expect(s.headline).toBeNull();
    expect(s.subheadline).toBe("Tecnologia para você");
    expect(s.category).toBeNull();
    expect(s.backgroundColor).toBeNull();
  });
  it("a sugestão não tem como alterar produtos", () => {
    const opts: LayoutOptions = { category: "novidade", headline: "A", showMascot: false, logoPosition: "footer", style: "default", emphasis: "price" };
    const s = sanitizeSuggestion({ category: "promocional", headline: "Ofertas", products: [{ priceCents: 1 }] } as never, "ai");
    const out = applySuggestion(opts, s) as unknown as Record<string, unknown>;
    expect(out.products).toBeUndefined();
    expect(out.category).toBe("promocional");
  });
  it("interpretador de regras entende o pedido de exemplo", () => {
    const s = interpretPrompt("Crie um flyer promocional minimalista com seis produtos de informática, fundo azul, preços destacados e logotipo no rodapé.");
    expect(s).toMatchObject({ category: "promocional", style: "minimal", backgroundColor: "#2341C1", emphasis: "price", logoPosition: "footer", source: "rules" });
    expect(s.notes.join(" ")).toMatch(/cadastro/);
    expect(interpretPrompt("stories de black friday sem mascote")).toMatchObject({ category: "blackfriday", formatKey: "ig-stories", showMascot: false });
  });
});
