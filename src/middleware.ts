import { NextResponse, type NextRequest } from "next/server";

/**
 * Filtro rápido: sem cookie de sessão, páginas internas redirecionam ao login.
 * A validação real (sessão no banco, permissões) acontece no servidor de cada
 * página e rota de API — este middleware é apenas conveniência de navegação.
 */
const PUBLIC = ["/login", "/primeiro-acesso", "/recuperar-senha", "/redefinir-senha", "/brand/", "/_next", "/favicon"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p)) || pathname.startsWith("/api/")) return NextResponse.next();
  if (!req.cookies.get("dh_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?voltar=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
