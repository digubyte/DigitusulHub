import { z } from "zod";
import { db } from "@/core/db";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { logActivity } from "@/core/audit";
import { getFlyer } from "@/modules/flyer-studio/services/flyer-service";
import { getBrandKit } from "@/modules/flyer-studio/services/brand-service";
import { validateFlyer } from "@/modules/flyer-studio/domain/validation";

/**
 * Registra uma exportação. Antes, revalida no servidor o projeto SALVO
 * (dados comerciais, logotipo, dimensões) — a exportação só é aceita se a
 * versão salva não tiver erros bloqueantes e corresponder ao que foi exportado.
 */
export const POST = apiRoute<{ id: string }>({ permission: "flyers.access" }, async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ format: z.enum(["png", "jpg", "pdf", "json"]), width: z.number().int(), height: z.number().int(), version: z.number().int() }));
  const flyer = await getFlyer(user, params.id);
  if (flyer.mode === "chatgpt") {
    // A arte veio do ChatGPT: a conferência dos dados foi feita ao salvar a arte.
    if (!flyer.resultFileId) throw new HttpError(422, "Envie a arte gerada no ChatGPT antes de baixar.");
    await db.flyerProject.update({ where: { id: flyer.id }, data: { lastExportAt: new Date() } });
    await logActivity(user.id, "flyer.export", { type: "flyer", id: flyer.id }, { format: body.format, width: body.width, height: body.height, mode: "chatgpt" });
    return jsonOk({ ok: true });
  }
  if (body.version !== flyer.version) throw new HttpError(409, "Salve o projeto antes de exportar.");
  if (body.format !== "json" && (body.width !== flyer.width || body.height !== flyer.height)) {
    throw new HttpError(422, `Arquivo gerado com ${body.width}×${body.height}px, mas o formato exige ${flyer.width}×${flyer.height}px.`);
  }
  const kit = await getBrandKit();
  const issues = validateFlyer(flyer.canvasState, flyer.products, {
    expectedWidth: flyer.width, expectedHeight: flyer.height,
    brandLogoFileIds: [kit.logo?.fileId, kit.logoOnDark?.fileId].filter(Boolean) as string[],
  }).filter((i) => i.level === "error");
  if (body.format !== "json" && issues.length) throw new HttpError(422, "O projeto salvo tem pendências que impedem a exportação.", issues.map((i) => ({ message: i.message })));
  await db.flyerProject.update({ where: { id: flyer.id }, data: { lastExportAt: new Date() } });
  await logActivity(user.id, "flyer.export", { type: "flyer", id: flyer.id }, { format: body.format, width: body.width, height: body.height, version: flyer.version });
  return jsonOk({ ok: true });
});
