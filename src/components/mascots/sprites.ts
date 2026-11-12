/**
 * Sprites em pixel art dos mascotes do painel: Digu (camaleão da Digitusul) e o mascote do Claude.
 * Cada sprite é uma lista de linhas; cada caractere é um pixel com a cor da paleta ('.' = transparente).
 */
export const PALETTE: Record<string, string> = {
  g: "#9ED11C", // verde-limão (Digu)
  G: "#5E8A0A", // verde escuro (pés)
  b: "#1E63D6", // azul (crista e bolinhas)
  w: "#FFFFFF",
  o: "#8A4A16", // íris castanha
  k: "#141414",
  c: "#F4E9BE", // boca/creme
  p: "#E96A7B", // língua
  r: "#E61F27", // vermelho Digitusul
  h: "#5B5D63", // moletom
  H: "#3A3B40",
  O: "#D97757", // laranja Claude
  s: "#A8A29E", // tecla
  y: "#FACC15", // brilho
};

// ── Digu (16 × 17) ────────────────────────────────────────────────
const DIGU_HEAD = [
  "......bbbb......",
  "....bbbggbbb....",
  "...bgggbbgggb...",
  "..gggggggggggg..",
  "..gwwwggggwwwg..",
  "..gwokggggkowg..",
  "..gwwwggggwwwg..",
  "..ggggbggbgggg..",
  "..ggccccccccgg..",
  "...gcppppppcg...",
];
const DIGU_BODY = [
  "....hhkkkkhh....",
  "...ghhkrrkhhg...",
  "...ghhkrkkhhgbb.",
  "....hhkkkkhh.bgb",
];
export const DIGU = {
  stand: [...DIGU_HEAD, ...DIGU_BODY, "....gg....gg.bb.", "....gg....gg....", "...GGG....GGG..."],
  walkA: [...DIGU_HEAD, ...DIGU_BODY, "...gg......gg.bb", "..gg........gg..", ".GGG........GGG."],
  walkB: [...DIGU_HEAD, ...DIGU_BODY, ".....gg..gg..bb.", ".....gg..gg.....", ".....GG..GG....."],
  sit: [...DIGU_HEAD, ...DIGU_BODY, "...gggg..gggg...", "...GG.....GG....", "................"],
  cheer: [
    ...DIGU_HEAD.slice(0, 8),
    "g.ggccccccccgg.g",
    "g..gcppppppcg..g",
    "gg..hhkkkkhh..gg",
    "...hhhkrrkhhh...",
    "....hhkrkkhh.bb.",
    "....hhkkkkhh.bgb",
    "....gg....gg.bb.",
    "....gg....gg....",
    "...GGG....GGG...",
  ],
  // espiando por cima da borda (só cabeça e mãos), como na referência
  peek: [...DIGU_HEAD.slice(0, 8), "ggg.gggggggg.ggg"],
};

// ── Mascote do Claude (16 × 10) ───────────────────────────────────
const CLAWD_TOP = [
  "...OOOOOOOOOO...",
  "...OOOOOOOOOO...",
  "..OOOkOOOOkOOO..",
  "..OOOkOOOOkOOO..",
  "...OOOOOOOOOO...",
  "...OOOOOOOOOO...",
  "...OOOOOOOOOO...",
];
export const CLAWD = {
  stand: [...CLAWD_TOP, "...O.O....O.O...", "...O.O....O.O...", "................"],
  walkA: [...CLAWD_TOP, "...O.O....O.O...", "..O...O..O...O..", "................"],
  walkB: [...CLAWD_TOP, "....OO....OO....", "....OO....OO....", "................"],
  sit: ["................", ...CLAWD_TOP, "..OO........OO..", "................"],
  cheer: [
    "OO.OOOOOOOOOO.OO",
    ".O.OOOOOOOOOO.O.",
    "..OOOkOOOOkOOO..",
    "..OOOkOOOOkOOO..",
    "...OOOOOOOOOO...",
    "...OOOOOOOOOO...",
    "...OOOOOOOOOO...",
    "...O.O....O.O...",
    "...O.O....O.O...",
    "................",
  ],
};

// ── Objetos ───────────────────────────────────────────────────────
export const LAPTOP_A = [
  "..kkkkkkkk..",
  "..kbbbbbbk..",
  "..kbwwbbbk..",
  "..kbbbbbbk..",
  "..kkkkkkkk..",
  "hhhhhhhhhhhh",
  ".HHsHHsHHsH.",
];
export const LAPTOP_B = [
  "..kkkkkkkk..",
  "..kbbbbbbk..",
  "..kbbbwwbk..",
  "..kbbbbbbk..",
  "..kkkkkkkk..",
  "hhhhhhhhhhhh",
  ".HsHHsHHsHH.",
];
export const BALL = [".rr.", "rwwr", "rwwr", ".rr."];
export const HEART = [".r.r.", "rrrrr", ".rrr.", "..r.."];
export const SPARK = ["..y..", ".yyy.", "yyyyy", ".yyy.", "..y.."];

export const ALL_SPRITES: Record<string, string[]> = {
  ...Object.fromEntries(Object.entries(DIGU).map(([k, v]) => [`digu.${k}`, v])),
  ...Object.fromEntries(Object.entries(CLAWD).map(([k, v]) => [`clawd.${k}`, v])),
  LAPTOP_A, LAPTOP_B, BALL, HEART, SPARK,
};

/** Converte um sprite em retângulos (junta pixels iguais vizinhos na linha). */
export function spriteRects(rows: string[]) {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      if (ch !== "." && PALETTE[ch]) out.push({ x, y, w, fill: PALETTE[ch] });
      x += w;
    }
  });
  return out;
}
