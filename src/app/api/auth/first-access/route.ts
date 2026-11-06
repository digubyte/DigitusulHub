import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/core/http";
import { throttle } from "@/core/auth/auth-service";
import { completeFirstAccess } from "@/core/auth/first-access";

const Body = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  email: z.string().trim().email("E-mail inválido.").max(200),
  password: z.string().max(200),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    throttle(`first-access:${req.headers.get("x-forwarded-for") ?? "local"}`, 10);
    await completeFirstAccess(await parseBody(req, Body));
    return jsonOk({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
