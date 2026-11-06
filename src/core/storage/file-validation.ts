/**
 * Validação de uploads pelo conteúdo real (assinatura binária), não pela
 * extensão nem pelo Content-Type informado pelo navegador.
 */
// 4 MB: a Vercel limita o corpo de cada requisição a 4,5 MB. Fotos maiores são reduzidas no navegador antes do envio.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type AllowedMime = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

export function sniffImageMime(buf: Uint8Array): AllowedMime | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  const head = new TextDecoder().decode(buf.slice(0, 1024)).trimStart().toLowerCase();
  if ((head.startsWith("<?xml") || head.startsWith("<svg")) && head.includes("<svg")) return "image/svg+xml";
  return null;
}

/** SVG só é aceito sem scripts, handlers de evento ou referências externas. */
export function isSafeSvg(text: string): boolean {
  const t = text.toLowerCase();
  if (/<script[\s>]/.test(t)) return false;
  if (/\son[a-z]+\s*=/.test(t)) return false;
  if (/javascript:/.test(t)) return false;
  if (/<foreignobject[\s>]/.test(t)) return false;
  if (/(href|src)\s*=\s*["']\s*(https?:|\/\/)/.test(t)) return false;
  if (/<!entity/.test(t)) return false;
  return true;
}

/** Lê dimensões de PNG/JPEG/WEBP/SVG sem dependências nativas. */
export function readImageSize(buf: Uint8Array, mime: AllowedMime): { width: number; height: number } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  try {
    if (mime === "image/png") return { width: dv.getUint32(16), height: dv.getUint32(20) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        const len = dv.getUint16(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
        }
        i += 2 + len;
      }
      return null;
    }
    if (mime === "image/webp") {
      const chunk = new TextDecoder().decode(buf.slice(12, 16));
      if (chunk === "VP8X") return { width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
      if (chunk === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
      if (chunk === "VP8L") {
        const b = dv.getUint32(21, true);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    if (mime === "image/svg+xml") {
      const head = new TextDecoder().decode(buf.slice(0, 4096));
      const vb = head.match(/viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      if (vb) return { width: Math.round(parseFloat(vb[3])), height: Math.round(parseFloat(vb[4])) };
      const w = head.match(/\swidth\s*=\s*["']([\d.]+)/i);
      const h = head.match(/\sheight\s*=\s*["']([\d.]+)/i);
      if (w && h) return { width: Math.round(parseFloat(w[1])), height: Math.round(parseFloat(h[1])) };
      return null;
    }
  } catch {
    return null;
  }
  return null;
}
