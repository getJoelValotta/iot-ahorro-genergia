"use client";

import Link from "next/link";
import { BatteryCharging, MapPin, PawPrint } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading } from "@/components/error-message";
import { useCapabilities } from "@/lib/capabilities";

/** Inicio público: presenta el portal y muestra qué anuncia el backend conectado. */
export default function Home() {
  const { loading, capabilities, error } = useCapabilities();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 p-6">
      <div className="space-y-3 text-center">
        <PawPrint className="mx-auto size-12 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Seguimiento de mascotas</h1>
        <p className="text-muted-foreground">
          Mirá dónde está tu mascota, el estado de su collar y activá el modo ahorro para que la
          batería dure más.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            Iniciar sesión
          </Link>
          <Link href="/register" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Crear cuenta
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-4" /> Mapa en vivo
            </CardTitle>
            <CardDescription>Ubicación, batería y conexión de cada collar.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BatteryCharging className="size-4" /> Modo ahorro
            </CardTitle>
            <CardDescription>Menos reportes por hora, mucha más autonomía.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card size="sm">
        <CardContent className="text-sm text-muted-foreground">
          {loading ? (
            <Loading text="Consultando el servidor…" />
          ) : error ? (
            <span>
              No se pudieron leer las capacidades del servidor: el portal funciona en{" "}
              <strong>modo base</strong>.
            </span>
          ) : (
            <span>
              Servidor conectado (API v{capabilities.apiVersion}). Funciones extra:{" "}
              <strong>
                {capabilities.variants.length
                  ? capabilities.variants.join(", ")
                  : "ninguna (modo base)"}
              </strong>
            </span>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
