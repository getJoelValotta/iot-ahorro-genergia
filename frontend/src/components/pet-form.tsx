"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/auth-form";
import { ErrorMessage } from "@/components/error-message";
import { ApiError } from "@/lib/api";
import { SPECIES_LABEL, type Pet } from "@/lib/types";

export type PetInput = {
  name: string;
  species: string;
  breed: string | null;
  birthDate: string | null;
  photoUrl: string | null;
};

/** Alta y edición: solo nombre y especie son obligatorios. */
export function PetForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Pet;
  submitLabel: string;
  onSubmit: (input: PetInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const opt = (k: string) => String(f.get(k) ?? "").trim() || null;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: String(f.get("name") ?? "").trim(),
        species: String(f.get("species") ?? "dog"),
        breed: opt("breed"),
        birthDate: opt("birthDate"),
        photoUrl: opt("photoUrl"),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Error inesperado.", 0, null));
    } finally {
      setBusy(false);
    }
  }

  const fe = (field: string) => error?.errors.find((x) => x.field === field)?.message;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Nombre" error={fe("name")}>
          <Input id="name" name="name" required maxLength={80} defaultValue={initial?.name} />
        </Field>
        <Field id="species" label="Especie" error={fe("species")}>
          <select
            id="species"
            name="species"
            defaultValue={initial?.species ?? "dog"}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {Object.entries(SPECIES_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="breed" label="Raza (opcional)" error={fe("breed")}>
          <Input id="breed" name="breed" maxLength={80} defaultValue={initial?.breed ?? ""} />
        </Field>
        <Field id="birthDate" label="Fecha de nacimiento (opcional)" error={fe("birthDate")}>
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={initial?.birthDate?.slice(0, 10) ?? ""}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field id="photoUrl" label="URL de la foto (opcional)" error={fe("photoUrl")}>
            <Input
              id="photoUrl"
              name="photoUrl"
              type="url"
              placeholder="https://…"
              defaultValue={initial?.photoUrl ?? ""}
            />
          </Field>
        </div>
      </div>
      {error && !error.errors.length && <ErrorMessage error={error} />}
      {error && error.errors.length > 0 && (
        <p className="text-sm text-destructive">Revisá los campos marcados.</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
