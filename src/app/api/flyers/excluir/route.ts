import { z } from "zod";
import { apiRoute, HttpError, jsonOk, parseBody } from "@/core/http";
import { bulkDeleteFlyers } from "@/modules/flyer-studio/services/flyer-service";

/** Exclui vários flyers de uma vez, ou todo o histórico do usuário (`all: true`). */
export const POST = apiRoute({ permission: "flyers.access" }, async ({ req, user }) => {
  const b = await parseBody(req, z.object({ ids: z.array(z.string().min(1).max(64)).max(500).optional(), all: z.boolean().optional() }));
  if (!b.all && !b.ids?.length) throw new HttpError(400, "Selecione ao menos um flyer.");
  return jsonOk(await bulkDeleteFlyers(user, b));
});
