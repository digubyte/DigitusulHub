import { apiRoute, HttpError, jsonOk } from "@/core/http";
import { publicFileInfo, storeImage, type FilePurpose } from "@/core/storage/storage";
import { logActivity } from "@/core/audit";

const PURPOSES: FilePurpose[] = ["product", "background", "element", "brand", "misc"];

/** Upload de imagens (multipart). Valida conteúdo real, tamanho e dimensões. */
export const POST = apiRoute({}, async ({ req, user }) => {
  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, "Envio inválido.");
  const purpose = (form.get("purpose") as FilePurpose) || "misc";
  if (!PURPOSES.includes(purpose)) throw new HttpError(400, "Finalidade inválida.");
  if (purpose === "brand" && !user.permissions.has("brandkit.manage")) throw new HttpError(403, "Somente administradores enviam arquivos do Brand Kit.");
  if (purpose !== "brand" && !user.permissions.has("flyers.access")) throw new HttpError(403, "Sem permissão para enviar arquivos.");
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) throw new HttpError(400, "Nenhum arquivo enviado.");
  if (files.length > 12) throw new HttpError(400, "Envie no máximo 12 arquivos por vez.");
  const out = [];
  for (const f of files) {
    const stored = await storeImage({ ownerId: user.id, data: new Uint8Array(await f.arrayBuffer()), originalName: f.name || "imagem", purpose, allowSvg: purpose === "brand" });
    out.push(publicFileInfo(stored));
  }
  await logActivity(user.id, "file.upload", null, { count: out.length, purpose });
  return jsonOk({ files: out }, 201);
});
