"use client";

import {
  BatteryIndicator,
  DeviceMap,
  OnlineBadge,
  OvenbirdProvider,
  useDeviceStatus,
} from "@ovenbird/react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { PetAvatar } from "@/components/pet-avatar";
import { ApiError, api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Pet } from "@/lib/types";

const OVENBIRD_URL =
  process.env.NEXT_PUBLIC_OVENBIRD_URL || "https://iotplatform.ovenbirdconsulting.com.ar";

/**
 * Mapa en vivo con `@ovenbird/react` (único acceso del front a Ovenbird). El token de solo
 * lectura lo pide el servidor de Next al backend (`POST /embed-token`) con la cookie; el
 * provider lo vuelve a pedir solo cuando vence (401).
 */
export function LiveMap({
  pets,
  onTokenError,
}: {
  pets: Pet[];
  onTokenError: (err: ApiError) => void;
}) {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const deviceIds = pets.map((p) => p.deviceId as string);

  const getToken = useCallback(async () => {
    try {
      const { token } = await api<{ token: string }>("/embed-token", { method: "POST", body: {} });
      return token;
    } catch (err) {
      if (err instanceof ApiError) onTokenError(err);
      throw err;
    }
  }, [onTokenError]);

  const petFor = (deviceId: string) => pets.find((p) => p.deviceId === deviceId);

  return (
    <OvenbirdProvider baseUrl={OVENBIRD_URL} getToken={getToken}>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-hidden rounded-xl border bg-background">
          <DeviceMap
            deviceIds={deviceIds}
            followDeviceId={selected}
            showTrail
            trailMinutes={30}
            height={460}
            onMarkerClick={setSelected}
            renderPopup={(device) => <strong>{petFor(device.deviceId)?.name ?? device.name}</strong>}
          />
        </div>
        <ul className="space-y-2" aria-label="Mascotas en el mapa">
          {pets.map((pet) => (
            <PetStatusRow
              key={pet.id}
              pet={pet}
              selected={selected === pet.deviceId}
              onSelect={() => setSelected(pet.deviceId ?? undefined)}
            />
          ))}
        </ul>
      </div>
    </OvenbirdProvider>
  );
}

function PetStatusRow({
  pet,
  selected,
  onSelect,
}: {
  pet: Pet;
  selected: boolean;
  onSelect: () => void;
}) {
  const { status, online, loading, error } = useDeviceStatus(pet.deviceId as string);
  const battery = status?.dps.battery_pct?.value;
  const pct = typeof battery === "number" ? battery : null;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border bg-background p-3 text-left transition",
          selected ? "ring-2 ring-primary" : "hover:bg-muted",
        )}
      >
        <PetAvatar photoUrl={pet.photoUrl} name={pet.name} className="size-10" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium">{pet.name}</p>
          {loading && !status ? (
            <p className="text-xs text-muted-foreground">Conectando…</p>
          ) : error && !status ? (
            <p className="text-xs text-destructive">Sin datos del collar por ahora.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <OnlineBadge online={online} lastSeenAt={status?.lastSeenAt ?? null} />
                <BatteryIndicator pct={pct} />
              </div>
              <p className="text-xs text-muted-foreground">
                Último dato: {timeAgo(status?.lastSeenAt ?? null)}
              </p>
            </>
          )}
        </div>
      </button>
    </li>
  );
}
