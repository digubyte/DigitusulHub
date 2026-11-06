import { NextResponse } from "next/server";
import { db } from "@/core/db";
import { apiRoute, HttpError } from "@/core/http";
import { driver } from "@/core/storage/storage";

/**
 * Entrega de arquivos privados. Exige sessão válida; os identificadores são
 * aleatórios e não enumeráveis. Cabeçalhos impedem execução de conteúdo ativo.
 */
export const GET = apiRoute<{ id: string }>({}, async ({ params }) => {
  const f = await db.storedFile.findUnique({ where: { id: params.id } });
  if (!f) throw new HttpError(404, "Arquivo não encontrado.");
  const data = await driver.get(f.storageKey).catch(() => null);
  if (!data) throw new HttpError(404, "Arquivo indisponível no armazenamento.");
  return new NextResponse(Buffer.from(data), {
    headers: {
      "Content-Type": f.mimeType,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": `inline; filename="${f.id}"`,
    },
  });
});
