import { z } from "zod";
import { apiRoute, jsonOk, parseBody } from "@/core/http";
import { changePassword } from "@/core/auth/auth-service";

export const POST = apiRoute({}, async ({ req, user }) => {
  const { current, next } = await parseBody(req, z.object({ current: z.string().max(200), next: z.string().max(200) }));
  await changePassword(user.id, current, next);
  return jsonOk({ ok: true });
});
