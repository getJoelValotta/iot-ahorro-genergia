"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { LogOut, MapPin, PawPrint, QrCode, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authAction, useResource } from "@/lib/api";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/pets", label: "Mascotas", icon: PawPrint },
  { href: "/pair", label: "Emparejar", icon: QrCode },
  { href: "/map", label: "Mapa", icon: MapPin },
  { href: "/account", label: "Mi cuenta", icon: UserRound },
];

const MeCtx = createContext<User | undefined>(undefined);
export const useMe = () => useContext(MeCtx);

/** Marco de las páginas privadas: menú, usuario actual y cerrar sesión. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: me } = useResource<User>("/auth/me");
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await authAction("logout");
    } finally {
      // Recarga completa: no queda nada de la sesión en memoria.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }

  return (
    <MeCtx.Provider value={me}>
      <header className="sticky top-0 z-[1000] border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
          <Link href="/pets" className="mr-2 flex items-center gap-2 font-semibold">
            <PawPrint className="size-5 text-primary" />
            <span className="hidden sm:inline">Mascotas G1</span>
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Principal">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap",
                    active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          <span className="hidden max-w-40 truncate text-sm text-muted-foreground md:inline">
            {me?.name}
          </span>
          <Button variant="ghost" size="sm" onClick={logout} disabled={leaving} aria-label="Cerrar sesión">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 sm:p-6">{children}</main>
    </MeCtx.Provider>
  );
}
