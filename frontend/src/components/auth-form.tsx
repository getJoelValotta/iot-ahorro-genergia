"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { PawPrint } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorMessage } from "@/components/error-message";
import { ApiError, authAction } from "@/lib/api";

/** Solo rutas internas como destino después del login (evita redirecciones abiertas). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/pets";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (isRegister) {
      body.name = String(form.get("name") ?? "");
      const phone = String(form.get("phone") ?? "").trim();
      if (phone) body.phone = phone;
      if (body.password.length < 8) {
        setError(
          new ApiError("La contraseña debe tener al menos 8 caracteres.", 400, "VALIDATION_ERROR", [
            { field: "password", message: "debe tener al menos 8 caracteres" },
          ]),
        );
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await authAction(mode, body);
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Error inesperado.", 0, null));
      setBusy(false);
    }
  }

  const fieldError = (f: string) => error?.errors.find((e) => e.field === f)?.message;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <Card>
        <CardHeader className="text-center">
          <PawPrint className="mx-auto size-8 text-primary" />
          <CardTitle className="text-xl">{isRegister ? "Crear cuenta" : "Iniciar sesión"}</CardTitle>
          <CardDescription>
            {isRegister ? "Registrate para cargar tus mascotas." : "Entrá con tu email y contraseña."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {params.get("expired") && !error && (
            <Alert className="mb-4">
              <AlertDescription>Tu sesión venció. Iniciá sesión de nuevo.</AlertDescription>
            </Alert>
          )}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {isRegister && (
              <Field id="name" label="Nombre" error={fieldError("name")}>
                <Input id="name" name="name" autoComplete="name" required maxLength={100} />
              </Field>
            )}
            <Field id="email" label="Email" error={fieldError("email")}>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </Field>
            <Field
              id="password"
              label="Contraseña"
              hint={isRegister ? "Al menos 8 caracteres." : undefined}
              error={fieldError("password")}
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
              />
            </Field>
            {isRegister && (
              <Field id="phone" label="Teléfono (opcional)" error={fieldError("phone")}>
                <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} />
              </Field>
            )}
            {error && !error.errors.length && <ErrorMessage error={error} />}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Un momento…" : isRegister ? "Crear cuenta" : "Entrar"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isRegister ? "¿Ya tenés cuenta? " : "¿No tenés cuenta? "}
            <Link className="underline" href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Iniciá sesión" : "Registrate"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
