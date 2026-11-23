import { AppShell } from "@/components/app-shell";

/** Páginas privadas (el `proxy.ts` ya redirige al login si no hay sesión). */
export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
