import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/core/http";
import { resetPassword, throttle } from "@/core/auth/auth-service";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    throttle(`reset:${req.headers.get("x-forwarded-for") ?? "local"}`, 10);
    const { token, password } = await parseBody(req, z.object({ token: z.string().min(10).max(200), password: z.string().max(200) }));
    await resetPassword(token, password);
    return jsonOk({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
