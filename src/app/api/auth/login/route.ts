import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/core/http";
import { login, throttle } from "@/core/auth/auth-service";

const Body = z.object({ email: z.string().email("Informe um e-mail válido.").max(200), password: z.string().min(1, "Informe a senha.").max(200) });

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    throttle(`login:${req.headers.get("x-forwarded-for") ?? "local"}`);
    const { email, password } = await parseBody(req, Body);
    await login(email, password);
    return jsonOk({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
