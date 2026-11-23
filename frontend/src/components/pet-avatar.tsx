/* eslint-disable @next/next/no-img-element -- URLs de fotos externas arbitrarias */
"use client";

import { PawPrint } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Foto de la mascota o una imagen por defecto si no tiene (o si la URL falla). */
export function PetAvatar({
  photoUrl,
  name,
  className,
}: {
  photoUrl?: string | null;
  name: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const base = cn("size-14 shrink-0 rounded-full object-cover", className);
  if (!photoUrl || broken) {
    return (
      <div
        className={cn(base, "flex items-center justify-center bg-primary/10 text-primary")}
        aria-label={`${name} (sin foto)`}
        role="img"
      >
        <PawPrint className="size-1/2" />
      </div>
    );
  }
  return <img src={photoUrl} alt={name} className={base} onError={() => setBroken(true)} />;
}
