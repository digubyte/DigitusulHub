import { apiRoute, jsonOk, parseBody } from "@/core/http";
import { ProjectWriteSchema } from "@/modules/flyer-studio/domain/schemas";
import { createFlyer, listFlyers } from "@/modules/flyer-studio/services/flyer-service";

export const GET = apiRoute({ permission: "flyers.access" }, async ({ req, user }) => {
  const sp = new URL(req.url).searchParams;
  const scope = (sp.get("escopo") as "mine" | "all" | "templates") || "mine";
  const items = await listFlyers(user, { q: sp.get("q") ?? undefined, category: sp.get("categoria") ?? undefined, campaign: sp.get("campanha") ?? undefined, batchId: sp.get("lote") ?? undefined, scope });
  return jsonOk({ items });
});

export const POST = apiRoute({ permission: "flyers.create" }, async ({ req, user }) => {
  const data = await parseBody(req, ProjectWriteSchema);
  const id = await createFlyer(user, data);
  return jsonOk({ id }, 201);
});
