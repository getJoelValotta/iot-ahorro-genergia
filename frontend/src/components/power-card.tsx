"use client";

import { useState } from "react";
import { BatteryCharging, CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ErrorMessage, Loading } from "@/components/error-message";
import { api, ApiError, useResource, asApiError } from "@/lib/api";
import { formatHours, timeAgo } from "@/lib/format";
import type { PowerMode, PowerState } from "@/lib/types";

const POLL_PENDING_MS = 3000;
const POLL_IDLE_MS = 30000;

/**
 * Variante power-saving: tarjeta "Batería y ahorro". Solo se monta si el backend anuncia
 * `power-saving` en /capabilities. Mientras el cambio está pendiente consulta cada 3 s (el
 * backend reconcilia el estado del comando con Ovenbird en cada GET).
 */
export function PowerCard({ petId }: { petId: string }) {
  const power = useResource<PowerState>(`/pets/${petId}/power`, {
    pollMs: (s) => (s?.command.status === "pending" ? POLL_PENDING_MS : POLL_IDLE_MS),
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const state = power.data;

  async function change(mode: PowerMode) {
    setSending(true);
    setError(null);
    try {
      const next = await api<PowerState>(`/pets/${petId}/power`, { method: "PUT", body: { mode } });
      power.setData(next);
    } catch (err) {
      setError(asApiError(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BatteryCharging className="size-5" /> Batería y ahorro
        </CardTitle>
        <CardDescription>
          En modo Ahorro el collar reporta con menos frecuencia y apaga el GPS entre reportes, pero
          sigue recibiendo tus órdenes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {power.loading && !state ? (
          <Loading />
        ) : power.error && !state ? (
          <ErrorMessage error={power.error} title="No pudimos leer el estado de la batería" />
        ) : state ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Batería actual</p>
                <p className="text-2xl font-semibold">
                  {state.batteryPct === null ? "Sin dato" : `${Math.round(state.batteryPct)} %`}
                </p>
              </div>
              <label className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <span className={state.mode === "normal" ? "font-medium" : "text-muted-foreground"}>
                  Normal
                </span>
                <Switch
                  checked={state.mode === "saving"}
                  disabled={sending}
                  onCheckedChange={(checked) => void change(checked ? "saving" : "normal")}
                  aria-label="Modo ahorro"
                />
                <span className={state.mode === "saving" ? "font-medium" : "text-muted-foreground"}>
                  Ahorro
                </span>
              </label>
            </div>

            <CommandStatus state={state} sending={sending} />
            <ErrorMessage error={error} title="No se pudo cambiar el modo" />

            <div className="grid gap-3 sm:grid-cols-2">
              <Estimate
                title="Normal"
                active={state.mode === "normal"}
                detail="Reporta cada 15 s"
                estimate={state.estimates.normal}
              />
              <Estimate
                title="Ahorro"
                active={state.mode === "saving"}
                detail="Reporta cada 2,5 min"
                estimate={state.estimates.saving}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Estimación con una batería supuesta de {state.batteryCapacityMah} mAh. Normal: {" "}
              {formatHours(state.estimates.normal.hoursFull)} · Ahorro:{" "}
              {formatHours(state.estimates.saving.hoursFull)} con carga completa.
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CommandStatus({ state, sending }: { state: PowerState; sending: boolean }) {
  const { status, requestedAt } = state.command;
  if (sending || status === "pending") {
    return (
      <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400" role="status">
        <Loader2 className="size-4 animate-spin" /> Enviando… el collar lo aplica en su próximo
        reporte.
      </p>
    );
  }
  if (status === "confirmed") {
    return (
      <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400" role="status">
        <CheckCircle2 className="size-4" /> Aplicado en el collar ({timeAgo(requestedAt)}).
      </p>
    );
  }
  if (status === "failed") {
    return (
      <p className="flex items-center gap-2 text-sm text-destructive" role="status">
        <CircleAlert className="size-4" /> El collar no respondió. Probá de nuevo.
      </p>
    );
  }
  return null;
}

function Estimate({
  title,
  detail,
  active,
  estimate,
}: {
  title: string;
  detail: string;
  active: boolean;
  estimate: PowerState["estimates"]["normal"];
}) {
  return (
    <div className={`rounded-lg border p-3 ${active ? "border-primary bg-primary/5" : ""}`}>
      <p className="font-medium">
        {title} {active && <span className="text-xs text-primary">(actual)</span>}
      </p>
      <p className="text-xs text-muted-foreground">{detail}</p>
      <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
        <dt className="text-muted-foreground">Carga completa</dt>
        <dd className="text-right font-medium">{formatHours(estimate.hoursFull)}</dd>
        <dt className="text-muted-foreground">Con la carga actual</dt>
        <dd className="text-right font-medium">{formatHours(estimate.hoursRemaining)}</dd>
      </dl>
    </div>
  );
}
