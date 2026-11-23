"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage, Loading } from "@/components/error-message";
import { PetAvatar } from "@/components/pet-avatar";
import { PetForm, type PetInput } from "@/components/pet-form";
import { api, useResource } from "@/lib/api";
import { SPECIES_LABEL, type Page, type Pet } from "@/lib/types";

const LIMIT = 12;

export default function PetsPage() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useResource<Page<Pet>>(
    `/pets?page=${page}&limit=${LIMIT}`,
  );
  const pets = data?.data ?? [];
  // Tolerante: si el backend no manda `meta`, se pagina mientras la página venga llena.
  const total = data?.meta?.total;
  const hasNext = total !== undefined ? page * LIMIT < total : pets.length === LIMIT;

  async function create(input: PetInput) {
    // En el alta se omiten los opcionales vacíos (otros backends pueden no aceptar null).
    const body = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== null));
    await api<Pet>("/pets", { method: "POST", body });
    setCreating(false);
    await reload();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Mis mascotas</h1>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus /> Nueva mascota
          </Button>
        )}
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>Nueva mascota</CardTitle>
          </CardHeader>
          <CardContent>
            <PetForm submitLabel="Crear" onSubmit={create} onCancel={() => setCreating(false)} />
          </CardContent>
        </Card>
      )}

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorMessage error={error} title="No pudimos cargar tus mascotas" />
      ) : pets.length === 0 && page === 1 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Todavía no cargaste mascotas. Creá la primera con “Nueva mascota”.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <li key={pet.id}>
              <Link href={`/pets/${pet.id}`} className="block">
                <Card className="transition hover:ring-2 hover:ring-primary/30">
                  <CardContent className="flex items-center gap-3">
                    <PetAvatar photoUrl={pet.photoUrl} name={pet.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{pet.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {SPECIES_LABEL[pet.species] ?? pet.species}
                        {pet.breed ? ` · ${pet.breed}` : ""}
                      </p>
                    </div>
                    {pet.deviceId ? (
                      <Badge variant="secondary">
                        <Radio /> Collar
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sin collar</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page}
            {total !== undefined ? ` de ${Math.max(1, Math.ceil(total / LIMIT))}` : ""}
          </span>
          <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setPage(page + 1)}>
            Siguiente <ChevronRight />
          </Button>
        </div>
      )}
    </>
  );
}
