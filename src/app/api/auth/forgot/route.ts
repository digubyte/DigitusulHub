import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/core/http";
import { requestPasswordReset, throttle } from "@/core/auth/auth-service";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    throttle(`forgot:${req.headers.get("x-forwarded-for") ?? "local"}`, 8);
    const { email } = await parseBody(req, z.object({ email: z.string().email("Informe um e-mail válido.").max(200) }));
    await requestPasswordReset(email);
    return jsonOk({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
