import { format } from "date-fns";
import { es } from "date-fns/locale";

const TZ = "America/Bogota";

/** Format a date in Colombian timezone with the given pattern. */
function inTz(date: Date): Date {
  // Render the instant as it appears in America/Bogota.
  const s = date.toLocaleString("en-US", { timeZone: TZ });
  return new Date(s);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(inTz(d), "d MMM yyyy · h:mm a", { locale: es });
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(inTz(d), "d MMM yyyy", { locale: es });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(inTz(d), "h:mm a", { locale: es });
}

/** Deadline = kickoff minus lockMinutes. */
export function predictionDeadline(kickoff: Date, lockMinutes: number): Date {
  return new Date(kickoff.getTime() - lockMinutes * 60_000);
}

/** Whether predictions are still open for a match. */
export function isPredictionOpen(kickoff: Date, lockMinutes: number, now = new Date()): boolean {
  return now.getTime() < predictionDeadline(kickoff, lockMinutes).getTime();
}
