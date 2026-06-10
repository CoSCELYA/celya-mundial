"use client";

import { useSyncExternalStore } from "react";

type Mode = "datetime" | "date" | "time";

// false durante SSR y la primera hidratación; true tras montar en el cliente.
// Evita el setState-en-efecto y cualquier desajuste de hidratación.
const noop = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

// Ensambla la fecha/hora en la zona indicada (tz undefined = zona del navegador).
function formatIn(d: Date, mode: Mode, tz: string | undefined): string {
  const dateF = new Intl.DateTimeFormat("es-CO", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeF = new Intl.DateTimeFormat("es-CO", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const parts = dateF.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  const compact = `${get("day")} ${get("month")} ${get("year")}`;
  if (mode === "date") return compact;
  if (mode === "time") return timeF.format(d);
  return `${compact} · ${timeF.format(d)}`;
}

/**
 * Muestra una fecha/hora en la zona horaria LOCAL del visitante.
 * El primer render (servidor + hidratación) usa hora de Colombia de forma
 * determinista; tras montar, cambia a la zona del navegador. Así un usuario
 * en El Salvador u Honduras (UTC-6) ve su propia hora, sin desajustes.
 */
export function LocalTime({
  value,
  mode = "datetime",
}: {
  value: string | number | Date;
  mode?: Mode;
}) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  // Antes de hidratar: hora de Colombia (determinista). Después: zona del navegador.
  const tz = useHydrated() ? undefined : "America/Bogota";
  return <span suppressHydrationWarning>{formatIn(new Date(ms), mode, tz)}</span>;
}
