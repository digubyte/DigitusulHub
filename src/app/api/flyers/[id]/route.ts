import { apiRoute, jsonOk, parseBody } from "@/core/http";
import { ProjectWriteSchema } from "@/modules/flyer-studio/domain/schemas";
import { deleteFlyer, getFlyer, listVersions, updateFlyer } from "@/modules/flyer-studio/services/flyer-service";

export const GET = apiRoute<{ id: string }>({ permission: "flyers.access" }, async ({ user, params, req }) => {
  if (new URL(req.url).searchParams.get("versoes")) return jsonOk({ versions: await listVersions(user, params.id) });
  return jsonOk(await getFlyer(user, params.id));
});

export const PUT = apiRoute<{ id: string }>({ permission: "flyers.access" }, async ({ req, user, params }) => {
  const data = await parseBody(req, ProjectWriteSchema);
  const version = await updateFlyer(user, params.id, data);
  return jsonOk({ version });
});

export const DELETE = apiRoute<{ id: string }>({ permission: "flyers.access" }, async ({ user, params }) => {
  await deleteFlyer(user, params.id);
  return jsonOk({ ok: true });
});
