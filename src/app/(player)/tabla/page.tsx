import { Trophy, Medal } from "lucide-react";
import { Flag } from "@/components/flag";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getStandings, type StandingRow } from "@/lib/queries";
import { cn } from "@/lib/cn";

export const metadata = {
  title: "Tabla de Posiciones",
};

/** Iniciales a partir del nombre completo (máx. 2). */
function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Acento de medalla para el Top 3. */
function rankAccent(rank: number): { icon: typeof Trophy; className: string } | null {
  if (rank === 1) return { icon: Trophy, className: "text-accent" };
  if (rank === 2) return { icon: Medal, className: "text-white/70" };
  if (rank === 3) return { icon: Medal, className: "text-amber-600/80" };
  return null;
}

export default async function TablaPosicionesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const standings = await getStandings();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Trophy className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">Tabla de Posiciones</h1>
          <p className="text-sm text-white/60">
            Ranking general de la polla mundialista
          </p>
        </div>
      </header>

      {standings.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-16 text-center backdrop-blur">
          <Trophy className="mx-auto mb-3 size-10 text-white/30" />
          <p className="text-base font-semibold text-white">
            Aún no hay posiciones
          </p>
          <p className="mt-1 text-sm text-white/60">
            La tabla se llenará a medida que se jueguen los partidos.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur">
          {/* Cabecera (md+) */}
          <div className="hidden grid-cols-[3rem_1fr_5rem_5rem_5rem] items-center gap-3 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white/50 md:grid">
            <span>#</span>
            <span>Usuario</span>
            <span className="text-center">Campeón</span>
            <span className="text-center">Subcampeón</span>
            <span className="text-right">Puntos</span>
          </div>

          <ul className="divide-y divide-white/5">
            {standings.map((row) => (
              <StandingItem
                key={row.userId}
                row={row}
                isCurrentUser={row.userId === session.userId}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StandingItem({
  row,
  isCurrentUser,
}: {
  row: StandingRow;
  isCurrentUser: boolean;
}) {
  const accent = rankAccent(row.rank);

  return (
    <li
      className={cn(
        "grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-5 py-3 transition-colors md:grid-cols-[3rem_1fr_5rem_5rem_5rem]",
        isCurrentUser
          ? "bg-white/10 ring-1 ring-inset ring-accent"
          : "hover:bg-white/[0.04]",
      )}
    >
      {/* Posición */}
      <div className="flex items-center gap-1.5">
        {accent ? (
          <accent.icon className={cn("size-4", accent.className)} />
        ) : (
          <span className="w-4" />
        )}
        <span className="tnum text-sm font-semibold text-white/80">
          {row.rank}
        </span>
      </div>

      {/* Usuario */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-yellow text-xs font-bold text-brand-black">
          {getInitials(row.fullName)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-white">
              {row.fullName}
            </p>
            {isCurrentUser && (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
                Tú
              </span>
            )}
          </div>
          {/* Campeones en móvil */}
          <p className="mt-0.5 flex items-center gap-2 text-xs text-white/50 md:hidden">
            <span>{row.champion ? <Flag code={row.champion.fifaCode} size={18} /> : "—"}</span>
            <span className="text-white/30">/</span>
            <span>{row.runnerUp ? <Flag code={row.runnerUp.fifaCode} size={18} /> : "—"}</span>
          </p>
        </div>
      </div>

      {/* Campeón (md+) */}
      <div
        className="hidden text-center md:flex md:items-center md:justify-center"
        title={row.champion?.name ?? "Sin selección"}
      >
        {row.champion ? <Flag code={row.champion.fifaCode} size={22} /> : <span className="text-white/30">—</span>}
      </div>

      {/* Subcampeón (md+) */}
      <div
        className="hidden text-center md:flex md:items-center md:justify-center"
        title={row.runnerUp?.name ?? "Sin selección"}
      >
        {row.runnerUp ? <Flag code={row.runnerUp.fifaCode} size={22} /> : <span className="text-white/30">—</span>}
      </div>

      {/* Puntos */}
      <div className="text-right">
        <span className="tnum text-base font-bold text-accent">
          {row.totalPoints}
        </span>
        <span className="ml-1 text-[11px] uppercase tracking-wide text-white/40">
          pts
        </span>
      </div>
    </li>
  );
}
