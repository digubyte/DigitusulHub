import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/core/db";
import { HttpError } from "@/core/http";
import { MAX_UPLOAD_BYTES, isSafeSvg, readImageSize, sniffImageMime } from "./file-validation";

/**
 * Armazenamento privado de arquivos.
 * Os arquivos ficam fora de /public e só são servidos por /api/files/[id],
 * que verifica a sessão. Para produção, implemente StorageDriver com S3/R2/GCS
 * (URLs assinadas) e troque `driver` abaixo.
 */
export interface StorageDriver {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

class LocalDriver implements StorageDriver {
  constructor(private root: string) {}
  private resolve(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root))) throw new Error("Caminho inválido");
    return p;
  }
  async put(key: string, data: Uint8Array) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  }
  async get(key: string) {
    return new Uint8Array(await readFile(this.resolve(key)));
  }
  async remove(key: string) {
    await unlink(this.resolve(key)).catch(() => {});
  }
}

export const driver: StorageDriver = new LocalDriver(path.resolve(process.cwd(), process.env.STORAGE_DIR || "storage"));

export type FilePurpose = "product" | "brand" | "background" | "thumbnail" | "element" | "misc";
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export async function storeImage(opts: {
  ownerId: string;
  data: Uint8Array;
  originalName: string;
  purpose: FilePurpose;
  allowSvg?: boolean;
  derivedFromId?: string;
}) {
  const { data } = opts;
  if (data.byteLength === 0) throw new HttpError(400, "Arquivo vazio.");
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, "Arquivo maior que 10 MB.");
  const mime = sniffImageMime(data);
  if (!mime) throw new HttpError(415, "Formato não suportado. Envie PNG, JPG ou WEBP.");
  if (mime === "image/svg+xml") {
    if (!opts.allowSvg) throw new HttpError(415, "SVG só é aceito no Brand Kit. Envie PNG, JPG ou WEBP.");
    if (!isSafeSvg(new TextDecoder().decode(data))) throw new HttpError(415, "SVG contém conteúdo não permitido (scripts ou referências externas).");
  }
  const size = readImageSize(data, mime);
  if (size && (size.width > 12000 || size.height > 12000)) throw new HttpError(413, "Imagem com dimensões acima de 12000 px.");
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXT[mime]}`;
  await driver.put(key, data);
  return db.storedFile.create({
    data: {
      ownerId: opts.ownerId,
      originalName: opts.originalName.slice(0, 200),
      mimeType: mime,
      size: data.byteLength,
      storageKey: key,
      sha256: createHash("sha256").update(data).digest("hex"),
      purpose: opts.purpose,
      width: size?.width ?? null,
      height: size?.height ?? null,
      derivedFromId: opts.derivedFromId ?? null,
    },
  });
}

export function publicFileInfo(f: { id: string; originalName: string; mimeType: string; width: number | null; height: number | null; size: number }) {
  return { id: f.id, name: f.originalName, mimeType: f.mimeType, width: f.width, height: f.height, size: f.size, url: `/api/files/${f.id}` };
}
