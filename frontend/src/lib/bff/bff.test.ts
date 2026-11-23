import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { forwardToBackend, loginOrRegister, logout } from "./bff";
import { SESSION_COOKIE } from "./session";

const BACKEND = "http://backend.test/api/v1";
const ORIGIN = "http://localhost:3000";

function req(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; origin?: string | null } = {},
) {
  const headers = new Headers({ host: "localhost:3000" });
  if (init.cookie) headers.set("cookie", `${SESSION_COOKIE}=${init.cookie}`);
  if (init.origin !== null) headers.set("origin", init.origin ?? ORIGIN);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`${ORIGIN}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function backendReturning(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    }),
  );
}

describe("forwardToBackend (proxy /api/backend/*)", () => {
  it("convierte la cookie de sesión en Authorization: Bearer y reenvía path y query", async () => {
    const fetch = backendReturning(200, { data: [] });
    const res = await forwardToBackend(req("/api/backend/pets?page=2&limit=5", { cookie: "tok123" }), ["pets"], {
      fetch,
      backendUrl: BACKEND,
    });
    expect(res.status).toBe(200);
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(`${BACKEND}/pets?page=2&limit=5`);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer tok123");
    // La cookie del front nunca viaja al backend.
    expect(new Headers(init?.headers).get("cookie")).toBeNull();
    expect(await res.json()).toEqual({ data: [] });
  });

  it("sin cookie no agrega Authorization", async () => {
    const fetch = backendReturning(200, { apiVersion: "1", variants: [] });
    await forwardToBackend(req("/api/backend/capabilities"), ["capabilities"], { fetch, backendUrl: BACKEND });
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("authorization")).toBeNull();
  });

  it("un 401 del backend borra la cookie y avisa que la sesión venció", async () => {
    const fetch = backendReturning(401, { code: "UNAUTHORIZED", title: "No autenticado" });
    const res = await forwardToBackend(req("/api/backend/pets", { cookie: "vencido" }), ["pets"], {
      fetch,
      backendUrl: BACKEND,
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("x-session-expired")).toBe("1");
    const cleared = res.cookies.get(SESSION_COOKIE);
    expect(cleared?.value).toBe("");
    expect(cleared?.maxAge).toBe(0);
  });

  it("reenvía el cuerpo y el método de los pedidos que modifican datos", async () => {
    const fetch = backendReturning(201, { id: "p1" });
    const res = await forwardToBackend(
      req("/api/backend/pets", { method: "POST", body: { name: "Rex", species: "dog" }, cookie: "t" }),
      ["pets"],
      { fetch, backendUrl: BACKEND },
    );
    expect(res.status).toBe(201);
    const init = fetch.mock.calls[0][1];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Rex", species: "dog" });
  });

  it("rechaza POST/PUT/PATCH/DELETE de otro origen (CSRF) sin llamar al backend", async () => {
    const fetch = backendReturning(200, {});
    for (const origin of ["http://malo.example", null]) {
      const res = await forwardToBackend(
        req("/api/backend/pets/1", { method: "DELETE", cookie: "t", origin }),
        ["pets", "1"],
        { fetch, backendUrl: BACKEND },
      );
      expect(res.status).toBe(403);
      expect(res.headers.get("content-type")).toMatch(/problem\+json/);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("no deja salir del prefijo del backend con segmentos '..'", async () => {
    const fetch = backendReturning(200, {});
    const res = await forwardToBackend(req("/api/backend/x"), ["..", "admin"], { fetch, backendUrl: BACKEND });
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("si el backend no responde, devuelve 502 problem+json sin detalles", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 10.1.1.1:3001");
    });
    const res = await forwardToBackend(req("/api/backend/pets", { cookie: "t" }), ["pets"], {
      fetch,
      backendUrl: BACKEND,
    });
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toMatch(/ECONNREFUSED|10\.1\.1\.1/);
  });

  it("propaga 204 sin cuerpo", async () => {
    const fetch = backendReturning(204, null);
    const res = await forwardToBackend(
      req("/api/backend/pets/1", { method: "DELETE", cookie: "t" }),
      ["pets", "1"],
      { fetch, backendUrl: BACKEND },
    );
    expect(res.status).toBe(204);
  });
});

describe("loginOrRegister", () => {
  it("guarda el token en una cookie httpOnly y no lo devuelve al navegador", async () => {
    const fetch = backendReturning(200, { accessToken: "jwt-secreto", tokenType: "Bearer", expiresIn: 1800 });
    const res = await loginOrRegister(
      req("/api/auth/login", { method: "POST", body: { email: "a@b.c", password: "x" } }),
      "login",
      { fetch, backendUrl: BACKEND },
    );
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("jwt-secreto");
    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie).toMatchObject({ value: "jwt-secreto", httpOnly: true, sameSite: "lax", maxAge: 1800, path: "/" });
    expect(String(fetch.mock.calls[0][0])).toBe(`${BACKEND}/auth/login`);
  });

  it("usa 3600 s si el backend no manda expiresIn", async () => {
    const fetch = backendReturning(201, { accessToken: "t", tokenType: "Bearer" });
    const res = await loginOrRegister(
      req("/api/auth/register", { method: "POST", body: { email: "a@b.c", password: "x", name: "A" } }),
      "register",
      { fetch, backendUrl: BACKEND },
    );
    expect(res.status).toBe(201);
    expect(res.cookies.get(SESSION_COOKIE)?.maxAge).toBe(3600);
  });

  it("propaga el error del backend sin guardar cookie", async () => {
    const problem = { code: "INVALID_CREDENTIALS", title: "Credenciales inválidas", status: 401, detail: "x" };
    const fetch = backendReturning(401, problem, { "content-type": "application/problem+json" });
    const res = await loginOrRegister(
      req("/api/auth/login", { method: "POST", body: { email: "a@b.c", password: "x" } }),
      "login",
      { fetch, backendUrl: BACKEND },
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(problem);
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("verifica el origen", async () => {
    const fetch = backendReturning(200, {});
    const res = await loginOrRegister(
      req("/api/auth/login", { method: "POST", body: {}, origin: "http://malo.example" }),
      "login",
      { fetch, backendUrl: BACKEND },
    );
    expect(res.status).toBe(403);
  });
});

describe("logout", () => {
  it("borra la cookie", async () => {
    const res = logout(req("/api/auth/logout", { method: "POST", cookie: "t" }));
    expect(res.status).toBe(204);
    expect(res.cookies.get(SESSION_COOKIE)?.maxAge).toBe(0);
  });
});
