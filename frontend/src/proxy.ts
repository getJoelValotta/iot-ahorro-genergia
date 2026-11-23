import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/bff/session";

/**
 * Antes de renderizar: las páginas privadas sin cookie de sesión van al login, y el login
 * con sesión va a "Mis mascotas". La validez real del token la decide el backend (401).
 */
const PRIVATE = ["/pets", "/pair", "/map", "/account"];
const AUTH_PAGES = ["/login", "/register"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && PRIVATE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (hasSession && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/pets", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/pets/:path*", "/pair/:path*", "/map/:path*", "/account/:path*", "/login", "/register"],
};
