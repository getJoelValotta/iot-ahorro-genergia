"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnlineDot } from "@/components/device-link";
import { ErrorMessage, Loading } from "@/components/error-message";
import { api, ApiError, useResource, asApiError } from "@/lib/api";
import { countdown, timeAgo } from "@/lib/format";
import type { Device, Page, Pet } from "@/lib/types";

type Code = { code: string; expiresAt: string };

export default function PairPage() {
  const [code, setCode] = useState<Code | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Mientras hay un código vigente se refresca la lista seguido para ver aparecer la unidad.
  const devices = useResource<Page<Device>>("/devices?limit=100", { pollMs: code ? 5000 : 30000 });
  const pets = useResource<Page<Pet>>("/pets?limit=100");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setCode(await api<Code>("/pairing-codes", { method: "POST", body: {} }));
    } catch (err) {
      setError(asApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const remaining = code ? Date.parse(code.expiresAt) - now : 0;
  const expired = code !== null && remaining <= 0;
  const petName = (id?: string | null) => pets.data?.data.find((p) => p.id === id)?.name;

  return (
    <>
      <h1 className="text-2xl font-bold">Emparejar una unidad</h1>

      <Card>
        <CardHeader>
          <CardTitle>Código de emparejamiento</CardTitle>
          <CardDescription>Sirve una sola vez y vence a los 10 minutos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {code && (
            <div className="rounded-xl border bg-muted/40 p-4 text-center">
              <p
                className={`font-mono text-4xl font-bold tracking-widest ${expired ? "text-muted-foreground line-through" : ""}`}
                aria-live="polite"
              >
                {code.code}
              </p>
              <p className={`mt-1 text-sm ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                {expired ? "El código venció. Generá otro." : `Vence en ${countdown(remaining)}`}
              </p>
            </div>
          )}
          <Button onClick={generate} disabled={busy}>
            <RefreshCw className={busy ? "animate-spin" : ""} />
            {code ? "Generar otro código" : "Generar código"}
          </Button>
          <ErrorMessage error={error} title="No se pudo generar el código" />

          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Encendé la unidad (la placa que recibe al collar) cerca de tu celular.</li>
            <li>
              Abrí la app <strong>Ovenbird Smart</strong> en el celular y tocá{" "}
              <em>Agregar dispositivo</em>.
            </li>
            <li>
              Elegí la unidad que aparece como <strong>OB-xxxx</strong> e ingresá el código de
              arriba.
            </li>
            <li>
              Cuando la unidad aparezca abajo, entrá a la ficha de tu mascota y vinculala.{" "}
              <Link href="/pets" className="underline">
                Ir a mis mascotas
              </Link>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="size-4" /> Tus dispositivos
          </CardTitle>
          <CardDescription>
            Los que ya vinculaste y los que emparejaste con un código reciente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.loading && !devices.data ? (
            <Loading />
          ) : devices.error ? (
            <ErrorMessage error={devices.error} title="No pudimos listar los dispositivos" />
          ) : (devices.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay dispositivos. Generá un código y emparejá la unidad con la app.
            </p>
          ) : (
            <ul className="divide-y">
              {devices.data?.data.map((d) => (
                <li key={d.deviceId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Visto {timeAgo(d.lastSeenAt)} · {d.petId ? `Vinculado a ${petName(d.petId) ?? "una mascota"}` : "Libre"}
                    </p>
                  </div>
                  <OnlineDot online={d.online} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
