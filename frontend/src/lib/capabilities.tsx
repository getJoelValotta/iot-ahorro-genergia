"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Capabilities } from "./types";

type State = { loading: boolean; capabilities: Capabilities; error: boolean };

const BASE: Capabilities = { apiVersion: "1", variants: [] };
const Ctx = createContext<State>({ loading: true, capabilities: BASE, error: false });

/**
 * Lee `GET /capabilities` del backend conectado (vía BFF). Si falla o da 404/501 se usa
 * `variants = []`: modo base, se oculta la UI de variantes (docs/01 Parte III).
 */
export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ loading: true, capabilities: BASE, error: false });

  useEffect(() => {
    let alive = true;
    fetch("/api/backend/capabilities", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Partial<Capabilities>;
        const variants = Array.isArray(body.variants)
          ? body.variants.filter((v): v is string => typeof v === "string")
          : [];
        return { apiVersion: String(body.apiVersion ?? "1"), variants };
      })
      .then((capabilities) => alive && setState({ loading: false, capabilities, error: false }))
      .catch(() => alive && setState({ loading: false, capabilities: BASE, error: true }));
    return () => {
      alive = false;
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useCapabilities() {
  return useContext(Ctx);
}

export function useHasVariant(id: string): boolean {
  return useContext(Ctx).capabilities.variants.includes(id);
}
