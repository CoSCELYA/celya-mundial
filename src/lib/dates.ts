// Formato de fechas en hora de Colombia (America/Bogota), robusto sin importar
// la zona horaria del servidor. Para hora local del visitante, ver el
// componente cliente <LocalTime>.
const TZ = "America/Bogota";
const LOCALE = "es-CO";

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function asDate(date: Date | string): Date {
  return typeof date === "string" ? new Date(date) : date;
}

// Ensambla "11 jun 2026" (sin los "de" que agrega el locale es-CO).
function compactDate(d: Date): string {
  const parts = dateFmt.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}`;
}

export function formatDateTime(date: Date | string): string {
  const d = asDate(date);
  return `${compactDate(d)} · ${timeFmt.format(d)}`;
}

export function formatDate(date: Date | string): string {
  return compactDate(asDate(date));
}

export function formatTime(date: Date | string): string {
  return timeFmt.format(asDate(date));
}

/** Deadline = kickoff minus lockMinutes. */
export function predictionDeadline(kickoff: Date, lockMinutes: number): Date {
  return new Date(kickoff.getTime() - lockMinutes * 60_000);
}

/** Whether predictions are still open for a match. */
export function isPredictionOpen(kickoff: Date, lockMinutes: number, now = new Date()): boolean {
  return now.getTime() < predictionDeadline(kickoff, lockMinutes).getTime();
}

/**
 * Separa los partidos en "próximos o en juego" y "ya jugados".
 * En juego (LIVE) o con inicio futuro → upcoming; el resto → past
 * (más recientes primero).
 */
export function partitionByPlayed<T extends { status: string; kickoffAt: Date }>(
  matches: T[],
  now: number = Date.now(),
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const m of matches) {
    const isLive = m.status === "LIVE";
    const isUpcoming = m.status !== "FINISHED" && m.kickoffAt.getTime() > now;
    if (isLive || isUpcoming) upcoming.push(m);
    else past.push(m);
  }
  past.reverse();
  return { upcoming, past };
}
