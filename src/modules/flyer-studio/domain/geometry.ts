/** Utilitários geométricos e de medição de texto (determinísticos, sem DOM). */

export interface Box { x: number; y: number; width: number; height: number }

/** Largura média de caractere (em em) por família/peso — estimativa conservadora. */
function charFactor(fontFamily: string, fontStyle: string) {
  const bold = /bold|800|900/.test(fontStyle);
  const f = fontFamily.toLowerCase();
  if (f.includes("oswald")) return bold ? 0.5 : 0.46;
  if (f.includes("montserrat")) return bold ? 0.66 : 0.6;
  if (f.includes("poppins")) return bold ? 0.64 : 0.58;
  if (f.includes("playfair")) return bold ? 0.6 : 0.54;
  return bold ? 0.6 : 0.56; // Inter / Roboto
}

/** Quebra o texto em linhas para uma largura dada (estimativa). */
export function wrapLines(text: string, fontSize: number, width: number, fontFamily: string, fontStyle: string, letterSpacing = 0): string[] {
  const cw = fontSize * charFactor(fontFamily, fontStyle) + letterSpacing;
  const maxChars = Math.max(1, Math.floor(width / cw));
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(""); continue; }
    let line = "";
    for (const w of words) {
      if (w.length > maxChars) {
        // palavra maior que a linha: quebra forçada (o Konva também quebra por caractere)
        if (line) { lines.push(line); line = ""; }
        for (let i = 0; i < w.length; i += maxChars) {
          const chunk = w.slice(i, i + maxChars);
          if (chunk.length === maxChars) lines.push(chunk); else line = chunk;
        }
        continue;
      }
      const candidate = line ? `${line} ${w}` : w;
      if (candidate.length <= maxChars) line = candidate;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function textHeight(text: string, fontSize: number, width: number, fontFamily: string, fontStyle: string, lineHeight: number, letterSpacing = 0) {
  return wrapLines(text, fontSize, width, fontFamily, fontStyle, letterSpacing).length * fontSize * lineHeight;
}

/**
 * Maior tamanho de fonte (entre min e max) em que o texto cabe na caixa.
 * Retorna { fontSize, fits } — fits=false quando nem o mínimo cabe.
 */
export function fitText(opts: { text: string; width: number; height: number; max: number; min: number; fontFamily: string; fontStyle: string; lineHeight: number; maxLines?: number; letterSpacing?: number }) {
  const { text, width, height, fontFamily, fontStyle, lineHeight } = opts;
  let size = Math.floor(opts.max);
  const min = Math.max(6, Math.floor(opts.min));
  while (size >= min) {
    const lines = wrapLines(text, size, width, fontFamily, fontStyle, opts.letterSpacing ?? 0);
    if (lines.length * size * lineHeight <= height && (!opts.maxLines || lines.length <= opts.maxLines)) return { fontSize: size, fits: true, lines: lines.length };
    size -= Math.max(1, Math.round(size * 0.04));
  }
  return { fontSize: min, fits: false, lines: wrapLines(text, min, width, fontFamily, fontStyle).length };
}

/** Caixa delimitadora considerando rotação (Konva gira em torno do canto superior esquerdo). */
export function boundingBox(e: { x: number; y: number; width: number; height: number; rotation: number }): Box {
  if (!e.rotation) return { x: e.x, y: e.y, width: e.width, height: e.height };
  const r = (e.rotation * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  const pts = [[0, 0], [e.width, 0], [e.width, e.height], [0, e.height]].map(([px, py]) => [e.x + px * cos - py * sin, e.y + px * sin + py * cos]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

export function intersects(a: Box, b: Box, tolerance = 0.5) {
  return a.x < b.x + b.width - tolerance && a.x + a.width > b.x + tolerance && a.y < b.y + b.height - tolerance && a.y + a.height > b.y + tolerance;
}

export function inside(inner: Box, outer: Box, tolerance = 1) {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.width <= outer.x + outer.width + tolerance && inner.y + inner.height <= outer.y + outer.height + tolerance;
}

/** Encaixa uma imagem (proporção preservada) dentro de uma caixa. */
export function containBox(naturalW: number, naturalH: number, box: Box, align: "center" | "bottom" = "center"): Box {
  const s = Math.min(box.width / naturalW, box.height / naturalH);
  const w = naturalW * s, h = naturalH * s;
  return { x: box.x + (box.width - w) / 2, y: align === "bottom" ? box.y + box.height - h : box.y + (box.height - h) / 2, width: w, height: h };
}

/**
 * Escolhe colunas × linhas para n itens maximizando o tamanho útil de cada célula,
 * dado a proporção ideal (largura/altura) de um cartão de produto.
 */
export function chooseGrid(n: number, width: number, height: number, gap: number, idealAspect: number) {
  let best = { cols: 1, rows: n, score: -1 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = (width - gap * (cols - 1)) / cols;
    const ch = (height - gap * (rows - 1)) / rows;
    if (cw <= 0 || ch <= 0) continue;
    const usable = Math.min(cw, ch * idealAspect); // largura útil de um cartão "ideal"
    const empty = cols * rows - n;
    const score = usable * (1 - empty * 0.04);
    if (score > best.score) best = { cols, rows, score };
  }
  return { cols: best.cols, rows: best.rows };
}

/** Distribui n células em grade; a última linha incompleta é centralizada. */
export function gridCells(n: number, area: Box, gap: number, idealAspect: number): Box[] {
  const { cols, rows } = chooseGrid(n, area.width, area.height, gap, idealAspect);
  const cw = (area.width - gap * (cols - 1)) / cols;
  const ch = (area.height - gap * (rows - 1)) / rows;
  const cells: Box[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const c = i - r * cols;
    const offset = ((cols - inRow) * (cw + gap)) / 2;
    cells.push({ x: area.x + offset + c * (cw + gap), y: area.y + r * (ch + gap), width: cw, height: ch });
  }
  return cells;
}

export function inset(b: Box, dx: number, dy = dx): Box {
  return { x: b.x + dx, y: b.y + dy, width: Math.max(0, b.width - 2 * dx), height: Math.max(0, b.height - 2 * dy) };
}
