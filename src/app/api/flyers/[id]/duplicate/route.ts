import { z } from "zod";
import { apiRoute, jsonOk, parseBody } from "@/core/http";
import { duplicateFlyer } from "@/modules/flyer-studio/services/flyer-service";

export const POST = apiRoute<{ id: string }>({ permission: "flyers.create" }, async ({ req, user, params }) => {
  const { asTemplate } = await parseBody(req, z.object({ asTemplate: z.boolean().optional() }));
  return jsonOk({ id: await duplicateFlyer(user, params.id, { asTemplate }) }, 201);
});
