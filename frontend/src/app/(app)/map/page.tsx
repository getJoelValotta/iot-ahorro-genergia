"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorMessage, Loading } from "@/components/error-message";
import { ApiError, useResource } from "@/lib/api";
import type { Page, Pet } from "@/lib/types";

// Leaflet necesita `window`: el mapa se carga solo en el navegador.
const LiveMap = dynamic(() => import("@/components/live-map").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => <Loading text="Cargando mapa…" />,
});

export default function MapPage() {
  const pets = useResource<Page<Pet>>("/pets?limit=100");
  const [tokenError, setTokenError] = useState<ApiError | null>(null);
  const onTokenError = useCallback((err: ApiError) => setTokenError(err), []);
  const withCollar = (pets.data?.data ?? []).filter((p) => p.deviceId);

  return (
    <>
      <h1 className="text-2xl font-bold">Mapa en vivo</h1>
      {pets.loading && !pets.data ? (
        <Loading />
      ) : pets.error ? (
        <ErrorMessage error={pets.error} title="No pudimos cargar tus mascotas" />
      ) : withCollar.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-muted-foreground">
              Ninguna de tus mascotas tiene collar vinculado todavía.
            </p>
            <Link href="/pair" className={buttonVariants()}>
              Emparejar un collar
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {tokenError && (
            <ErrorMessage
              error={tokenError}
              title={
                tokenError.code === "NO_LINKED_DEVICES"
                  ? "No hay collares vinculados"
                  : "No pudimos conectar con el mapa"
              }
            />
          )}
          <LiveMap pets={withCollar} onTokenError={onTokenError} />
          <p className="text-xs text-muted-foreground">
            Tocá una mascota para centrar el mapa en ella. Las posiciones sin GPS no se dibujan.
          </p>
        </>
      )}
    </>
  );
}
