"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cliente del navegador: habla SOLO con el BFF (`/api/backend/*`, mismo origen). La cookie de
 * sesión viaja sola y es httpOnly; acá nunca se toca un token.
 */

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly errors: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const GENERIC = "Error inesperado. Probá de nuevo.";

/** Mensaje para el usuario: `detail` → `title` → genérico (nunca detalles internos). */
export async function toApiError(res: Response): Promise<ApiError> {
  let body: { detail?: unknown; title?: unknown; code?: unknown; errors?: unknown } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // Respuesta sin JSON (otro backend): mensaje genérico.
  }
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const errors = Array.isArray(body.errors)
    ? (body.errors as FieldError[]).filter((e) => e && typeof e.field === "string")
    : [];
  return new ApiError(
    text(body.detail) ?? text(body.title) ?? GENERIC,
    res.status,
    text(body.code),
    errors,
  );
}

function goToLogin() {
  const next = window.location.pathname + window.location.search;
  // Recarga completa a propósito: descarta todo el estado de la sesión vencida.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?expired=1&next=${encodeURIComponent(next)}`);
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/backend${path}`, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Sin conexión. Revisá tu red.", 0, "NETWORK_ERROR");
  }
  if (res.status === 401 && path !== "/capabilities") {
    goToLogin();
    throw new ApiError("Tu sesión venció. Iniciá sesión de nuevo.", 401, "UNAUTHORIZED");
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Login/registro/logout contra las rutas del BFF que manejan la cookie. */
export async function authAction(
  action: "login" | "register" | "logout",
  body?: unknown,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError("Sin conexión. Revisá tu red.", 0, "NETWORK_ERROR");
  }
  if (!res.ok) throw await toApiError(res);
}

/**
 * Carga un recurso del backend con estados de carga y error. `pollMs` lo vuelve a pedir
 * periódicamente (sin mostrar "cargando"); puede ser una función del último dato, así una
 * pantalla consulta más seguido mientras algo está pendiente.
 */
export function useResource<T>(
  path: string | null,
  opts: { pollMs?: number | ((data: T | undefined) => number | undefined) } = {},
) {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  // `loading` se deriva: está cargando mientras la ruta pedida no terminó su primer pedido.
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const loading = path !== null && loadedPath !== path;
  const seq = useRef(0);
  const dataRef = useRef<T | undefined>(undefined);
  const pollRef = useRef(opts.pollMs);
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    pollRef.current = opts.pollMs;
  });

  const setData = useCallback((value: T | undefined) => {
    dataRef.current = value;
    setDataState(value);
    kick.current();
  }, []);

  /** Pide el recurso y aplica el resultado solo si sigue siendo el último pedido. */
  const load = useCallback((): Promise<void> => {
    if (path === null) return Promise.resolve();
    const mine = ++seq.current;
    const current = () => mine === seq.current;
    return api<T>(path).then(
      (value) => {
        if (!current()) return;
        dataRef.current = value;
        setDataState(value);
        setError(null);
        setLoadedPath(path);
      },
      (err: unknown) => {
        if (!current()) return;
        setError(err instanceof ApiError ? err : new ApiError(GENERIC, 0, null));
        setLoadedPath(path);
      },
    );
  }, [path]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      const p = pollRef.current;
      const ms = typeof p === "function" ? p(dataRef.current) : p;
      if (ms && !stopped) timer = setTimeout(() => void load().then(schedule), ms);
    };
    kick.current = schedule;
    const first = setTimeout(() => void load().then(schedule), 0);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearTimeout(timer);
      kick.current = () => {};
    };
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
