"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage, Loading } from "@/components/error-message";
import { useResource } from "@/lib/api";
import { useCapabilities } from "@/lib/capabilities";
import type { User } from "@/lib/types";

export default function AccountPage() {
  const { data: me, error, loading } = useResource<User>("/auth/me");
  const { capabilities } = useCapabilities();
  return (
    <>
      <h1 className="text-2xl font-bold">Mi cuenta</h1>
      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorMessage error={error} />
          ) : me ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Nombre</dt>
              <dd className="font-medium">{me.name}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium break-all">{me.email}</dd>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>{me.phone || "—"}</dd>
            </dl>
          ) : null}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Funciones del servidor: {capabilities.variants.join(", ") || "modo base"}.
      </p>
    </>
  );
}
