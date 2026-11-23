import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ApiError } from "@/lib/api";

/** Error para el usuario: solo el texto del backend (`detail`/`title`) o uno genérico. */
export function ErrorMessage({
  error,
  title = "No se pudo completar",
}: {
  error: ApiError | Error | string | null | undefined;
  title?: string;
}) {
  if (!error) return null;
  const text = typeof error === "string" ? error : error.message;
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}

export function Loading({ text = "Cargando…" }: { text?: string }) {
  return (
    <p className="text-sm text-muted-foreground animate-pulse" role="status">
      {text}
    </p>
  );
}
