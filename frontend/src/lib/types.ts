/**
 * Modelos del contrato (docs/01 §6) en versión tolerante (docs/06 §3.1): los opcionales
 * pueden venir `null` o ausentes, `lastSeenAt` puede ser null y los listados pueden no traer `meta`.
 */

export type Species = "dog" | "cat" | "other";

export type User = { id: string; email: string; name: string; phone?: string | null };

export type Pet = {
  id: string;
  name: string;
  species: Species | string;
  breed?: string | null;
  birthDate?: string | null;
  photoUrl?: string | null;
  deviceId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Device = {
  deviceId: string;
  name: string;
  productId: string;
  online: boolean;
  lastSeenAt?: string | null;
  petId?: string | null;
};

export type Page<T> = { data: T[]; meta?: { page: number; limit: number; total: number } };

export type Capabilities = { apiVersion: string; variants: string[] };

export type PowerMode = "normal" | "saving";

export type PowerState = {
  mode: PowerMode;
  reportIntervalS: number;
  command: {
    status: "none" | "pending" | "confirmed" | "failed";
    commandId: string | null;
    requestedAt: string | null;
  };
  batteryPct: number | null;
  batteryCapacityMah: number;
  estimates: Record<
    PowerMode,
    { avgCurrentMa: number; hoursFull: number; hoursRemaining: number | null }
  >;
};

export const SPECIES_LABEL: Record<string, string> = {
  dog: "Perro",
  cat: "Gato",
  other: "Otro",
};
