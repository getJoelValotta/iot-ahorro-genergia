import { NextResponse, type NextRequest } from "next/server";
import {
  backendUrl as defaultBackendUrl,
  DEFAULT_SESSION_S,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./session";

/**
 * Intermediario (BFF) entre el navegador y el backend. El navegador habla solo con el
 * servidor de Next (cookie httpOnly); este reenvía al backend con `Authorization: Bearer`.
 */

export type BffDeps = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  backendUrl: string;
};

const defaults = (): BffDeps => ({ fetch: (u, i) => fetch(u, i), backendUrl: defaultBackendUrl() });

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Headers del backend que se devuelven al navegador. */
const PASS_HEADERS = ["content-type", "retry-after"];

function problem(status: number, code: string, title: string, detail: string): NextResponse {
  return new NextResponse(JSON.stringify({ type: "about:blank", title, status, detail, code }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

/**
 * Protección CSRF: la cookie viaja sola, así que en los métodos que modifican datos se exige
 * que el header `Origin` sea el mismo host que atiende el pedido.
 */
export function isSameOrigin(req: NextRequest): boolean {
  if (!MUTATING.has(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const forbiddenOrigin = () =>
  problem(403, "FORBIDDEN_ORIGIN", "Origen no permitido", "El pedido no vino de esta aplicación.");

const backendDown = () =>
  problem(
    502,
    "BACKEND_UNAVAILABLE",
    "Servidor no disponible",
    "No pudimos conectarnos con el servidor. Probá de nuevo en unos minutos.",
  );

function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}

async function copyResponse(upstream: Response): Promise<NextResponse> {
  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  const body = upstream.status === 204 || upstream.status === 304 ? null : await upstream.arrayBuffer();
  return new NextResponse(body, { status: upstream.status, headers });
}

/** Proxy genérico `/api/backend/<path>` → `<backend>/<path>`. */
export async function forwardToBackend(
  req: NextRequest,
  segments: string[],
  deps: BffDeps = defaults(),
): Promise<NextResponse> {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  if (segments.some((s) => s === ".." || s === "." || s === "")) {
    return problem(400, "BAD_PATH", "Ruta inválida", "La ruta pedida no es válida.");
  }
  // Login y registro solo por /api/auth/*: por acá el token llegaría al JavaScript del navegador.
  // (Express no distingue mayúsculas en las rutas, por eso se compara en minúsculas.)
  const [first, second] = segments.map((s) => s.toLowerCase());
  if (first === "auth" && (second === "login" || second === "register")) {
    return problem(404, "NOT_FOUND", "No encontrado", "Usá /api/auth para iniciar sesión.");
  }

  const url = `${deps.backendUrl}/${segments.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const headers = new Headers({ accept: "application/json" });
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);

  let upstream: Response;
  try {
    upstream = await deps.fetch(url, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return backendDown();
  }

  const res = await copyResponse(upstream);
  if (upstream.status === 401) {
    // Token vencido o inválido: se borra la cookie y el navegador va al login.
    res.headers.set("x-session-expired", "1");
    clearSession(res);
  }
  return res;
}

/** `POST /api/auth/login|register`: guarda el token en la cookie y no se lo da al navegador. */
export async function loginOrRegister(
  req: NextRequest,
  action: "login" | "register",
  deps: BffDeps = defaults(),
): Promise<NextResponse> {
  if (!isSameOrigin(req)) return forbiddenOrigin();

  let upstream: Response;
  try {
    upstream = await deps.fetch(`${deps.backendUrl}/auth/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: await req.text(),
      cache: "no-store",
    });
  } catch {
    return backendDown();
  }

  if (!upstream.ok) return copyResponse(upstream);

  let token: { accessToken?: unknown; expiresIn?: unknown };
  try {
    token = (await upstream.json()) as typeof token;
  } catch {
    return backendDown();
  }
  if (typeof token.accessToken !== "string" || !token.accessToken) return backendDown();

  const maxAge =
    typeof token.expiresIn === "number" && token.expiresIn > 0
      ? Math.floor(token.expiresIn)
      : DEFAULT_SESSION_S;
  const res = NextResponse.json({ ok: true }, { status: upstream.status });
  res.cookies.set(SESSION_COOKIE, token.accessToken, sessionCookieOptions(maxAge));
  return res;
}

/** `POST /api/auth/logout`: borra la cookie (el JWT no tiene revocación en el backend). */
export function logout(req: NextRequest): NextResponse {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  return clearSession(new NextResponse(null, { status: 204 }));
}
