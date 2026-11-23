"use client";

import Link from "next/link";
import { useState } from "react";
import { Link2, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage, Loading } from "@/components/error-message";
import { api, ApiError, useResource, asApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Device, Page, Pet } from "@/lib/types";

/** Vincular / desvincular el collar de una mascota (PUT/DELETE /pets/{id}/device). */
export function DeviceLink({ pet, onChange }: { pet: Pet; onChange: (pet: Pet | null) => void }) {
  const devices = useResource<Page<Device>>("/devices?limit=100");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const all = devices.data?.data ?? [];
  const current = pet.deviceId ? all.find((d) => d.deviceId === pet.deviceId) : undefined;
  const free = all.filter((d) => !d.petId);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await devices.reload();
    } catch (err) {
      setError(asApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const link = () =>
    run(async () => {
      const updated = await api<Pet>(`/pets/${pet.id}/device`, {
        method: "PUT",
        body: { deviceId: selected },
      });
      setSelected("");
      onChange(updated);
    });

  const unlink = () =>
    run(async () => {
      await api<void>(`/pets/${pet.id}/device`, { method: "DELETE" });
      onChange({ ...pet, deviceId: null });
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collar</CardTitle>
        <CardDescription>
          {pet.deviceId
            ? "Este collar envía la ubicación de la mascota."
            : "Elegí una unidad emparejada para ver a tu mascota en el mapa."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pet.deviceId ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium">{current?.name ?? pet.deviceId}</p>
              {current && (
                <p className="text-muted-foreground">
                  <OnlineDot online={current.online} /> Visto {timeAgo(current.lastSeenAt)}
                </p>
              )}
            </div>
            <Button variant="outline" onClick={unlink} disabled={busy}>
              <Unlink /> Desvincular
            </Button>
          </div>
        ) : devices.loading && !devices.data ? (
          <Loading text="Buscando dispositivos…" />
        ) : devices.error ? (
          <ErrorMessage error={devices.error} title="No pudimos listar los dispositivos" />
        ) : free.length === 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>No hay dispositivos libres en tu cuenta.</p>
            <Link href="/pair" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Emparejar una unidad
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="device" className="sr-only">
              Dispositivo
            </label>
            <select
              id="device"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-8 min-w-56 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Elegí un dispositivo…</option>
              {free.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.name} — {d.online ? "en línea" : `visto ${timeAgo(d.lastSeenAt)}`}
                </option>
              ))}
            </select>
            <Button onClick={link} disabled={!selected || busy}>
              <Link2 /> Vincular
            </Button>
          </div>
        )}
        <ErrorMessage error={error} />
      </CardContent>
    </Card>
  );
}

export function OnlineDot({ online }: { online: boolean }) {
  return (
    <Badge variant={online ? "secondary" : "outline"} className="mr-1 align-middle">
      <span
        className={`inline-block size-2 rounded-full ${online ? "bg-green-500" : "bg-muted-foreground/50"}`}
      />
      {online ? "En línea" : "Desconectado"}
    </Badge>
  );
}
