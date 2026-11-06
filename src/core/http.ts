import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { getCurrentUser, type CurrentUser } from "@/core/auth/session";
import type { PermissionKey } from "@/core/permissions";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const jsonOk = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Proteção CSRF: requisições que alteram estado precisam vir da mesma origem. */
export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new HttpError(403, "Origem da requisição não verificada.");
  if (new URL(origin).host !== host) throw new HttpError(403, "Origem da requisição não permitida.");
}

type Handler<C> = (ctx: { req: Request; user: CurrentUser; params: C }) => Promise<Response>;

/**
 * Envolve um route handler com: verificação de origem, autenticação,
 * autorização por permissão e tratamento uniforme de erros.
 */
export function apiRoute<C = Record<string, string>>(opts: { permission?: PermissionKey }, handler: Handler<C>) {
  return async (req: Request, routeCtx: { params: Promise<C> }) => {
    try {
      assertSameOrigin(req);
      const user = await getCurrentUser();
      if (!user || !user.permissions.has("hub.access")) throw new HttpError(401, "Sessão expirada. Faça login novamente.");
      if (opts.permission && !user.permissions.has(opts.permission)) throw new HttpError(403, "Você não tem permissão para esta ação.");
      const params = (routeCtx?.params ? await routeCtx.params : {}) as C;
      return await handler({ req, user, params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  console.error("[api] erro inesperado", e);
  return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Corpo da requisição inválido.");
  }
  return schema.parse(raw);
}

export function requirePermission(user: CurrentUser, p: PermissionKey) {
  if (!user.permissions.has(p)) throw new HttpError(403, "Você não tem permissão para esta ação.");
}
