"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeviceLink } from "@/components/device-link";
import { ErrorMessage, Loading } from "@/components/error-message";
import { PetAvatar } from "@/components/pet-avatar";
import { PetForm, type PetInput } from "@/components/pet-form";
import { PowerCard } from "@/components/power-card";
import { api, ApiError, useResource, asApiError } from "@/lib/api";
import { useHasVariant } from "@/lib/capabilities";
import { SPECIES_LABEL, type Pet } from "@/lib/types";

export default function PetDetailPage() {
  const { petId } = useParams<{ petId: string }>();
  const router = useRouter();
  const { data: pet, error, loading, setData } = useResource<Pet>(`/pets/${petId}`);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);
  const [deleting, setDeleting] = useState(false);
  const powerSaving = useHasVariant("power-saving");

  async function save(input: PetInput) {
    const updated = await api<Pet>(`/pets/${petId}`, { method: "PATCH", body: input });
    setData(updated);
    setEditing(false);
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api<void>(`/pets/${petId}`, { method: "DELETE" });
      router.replace("/pets");
    } catch (err) {
      setDeleteError(asApiError(err));
      setDeleting(false);
    }
  }

  return (
    <>
      <Link href="/pets" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft /> Mis mascotas
      </Link>

      {loading && !pet ? (
        <Loading />
      ) : error ? (
        <ErrorMessage
          error={error}
          title={error.status === 404 ? "Mascota no encontrada" : "No pudimos cargar la mascota"}
        />
      ) : pet ? (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <PetAvatar photoUrl={pet.photoUrl} name={pet.name} className="size-20" />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-2xl">{pet.name}</CardTitle>
                <p className="text-muted-foreground">
                  {SPECIES_LABEL[pet.species] ?? pet.species}
                  {pet.breed ? ` · ${pet.breed}` : ""}
                  {pet.birthDate ? ` · nació el ${pet.birthDate.slice(0, 10)}` : ""}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <PetForm
                  initial={pet}
                  submitLabel="Guardar cambios"
                  onSubmit={save}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil /> Editar
                  </Button>
                  <Button variant="destructive" onClick={() => setConfirming(true)}>
                    <Trash2 /> Borrar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <DeviceLink pet={pet} onChange={(p) => p && setData(p)} />

          {powerSaving && pet.deviceId && <PowerCard key={pet.deviceId} petId={pet.id} />}

          <Dialog open={confirming} onOpenChange={setConfirming}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Borrar a {pet.name}?</DialogTitle>
                <DialogDescription>
                  Se borra su ficha y, si tenía collar, el collar queda libre para otra mascota.
                </DialogDescription>
              </DialogHeader>
              <ErrorMessage error={deleteError} />
              <DialogFooter>
                <DialogClose render={<Button variant="outline">Cancelar</Button>} />
                <Button variant="destructive" onClick={remove} disabled={deleting}>
                  {deleting ? "Borrando…" : "Borrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
  );
}
