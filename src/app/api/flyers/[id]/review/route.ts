import { apiRoute, jsonOk, parseBody } from "@/core/http";
import { ReviewSchema } from "@/modules/flyer-studio/domain/schemas";
import { setReview } from "@/modules/flyer-studio/services/chatgpt-service";

/** Aprovar / refazer / pedir alterações na arte do flyer. */
export const POST = apiRoute<{ id: string }>({ permission: "flyers.access" }, async ({ req, user, params }) => {
  const { status, note } = await parseBody(req, ReviewSchema);
  await setReview(user, params.id, status, note);
  return jsonOk({ ok: true });
});
