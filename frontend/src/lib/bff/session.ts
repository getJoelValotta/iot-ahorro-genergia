/**
 * Cookie de sesión del BFF. El token del backend vive SOLO acá (httpOnly): el JavaScript del
 * navegador nunca lo ve, así un script malicioso no lo puede robar (docs/06 §2 y §3.2).
 */
export const SESSION_COOKIE = "g1_session";

/** Si el backend no manda `expiresIn` (otros grupos), se usa 1 h. */
export const DEFAULT_SESSION_S = 3600;

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Solo en producción: en el aula se prueba por http://192.168... y Secure lo impediría.
    // COOKIE_SECURE=false lo desactiva aunque se corra `next start` (demo por IP en HTTP).
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/**
 * URL del backend leída en el servidor en tiempo de ejecución: para cambiar de backend
 * (pruebas cruzadas) alcanza con cambiar la variable y reiniciar.
 */
export function backendUrl(): string {
  const url =
    process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
  return url.replace(/\/+$/, "");
}
