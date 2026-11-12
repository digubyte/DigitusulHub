import { describe, expect, it } from "vitest";
import { ALL_SPRITES, PALETTE, spriteRects } from "@/components/mascots/sprites";

describe("sprites dos mascotes", () => {
  it("todas as linhas de cada sprite têm a mesma largura e só usam cores da paleta", () => {
    for (const [name, rows] of Object.entries(ALL_SPRITES)) {
      const w = rows[0].length;
      rows.forEach((r, i) => expect(r.length, `${name} linha ${i}`).toBe(w));
      for (const ch of rows.join("")) if (ch !== ".") expect(PALETTE[ch], `${name}: cor '${ch}'`).toBeDefined();
    }
  });
  it("frames do mesmo personagem têm o mesmo tamanho (não pulam na animação)", () => {
    const groups: Record<string, string[][]> = {};
    for (const [n, rows] of Object.entries(ALL_SPRITES)) if (n.includes(".") && !n.endsWith(".peek")) (groups[n.split(".")[0]] ??= []).push(rows);
    for (const [g, list] of Object.entries(groups)) {
      const [w, h] = [list[0][0].length, list[0].length];
      list.forEach((rows) => { expect(rows[0].length, g).toBe(w); expect(rows.length, g).toBe(h); });
    }
  });
  it("gera retângulos juntando pixels iguais", () => {
    expect(spriteRects(["gg.b"])).toEqual([{ x: 0, y: 0, w: 2, fill: PALETTE.g }, { x: 3, y: 0, w: 1, fill: PALETTE.b }]);
  });
});
