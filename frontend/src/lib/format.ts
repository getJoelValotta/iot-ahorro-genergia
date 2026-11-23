const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** "hace 3 minutos", o "nunca" si no hay fecha. */
export function timeAgo(iso: string | Date | null | undefined, now = Date.now()): string {
  if (!iso) return "nunca";
  const t = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  if (Number.isNaN(t)) return "nunca";
  const s = Math.round((t - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return "recién";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** Duración simple para la tarjeta de ahorro: "~13 h" o "~2,5 días". */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return "—";
  if (hours < 48) return `~${Math.round(hours)} h`;
  const days = hours / 24;
  return `~${days.toLocaleString("es-AR", { maximumFractionDigits: 1 })} días`;
}

/** mm:ss para la cuenta regresiva del código. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
