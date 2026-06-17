import { Trophy } from "lucide-react";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getStandings } from "@/lib/queries";
import { StandingRow } from "./_components/standing-row";

export const metadata = {
  title: "Tabla de Posiciones",
};

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
              <StandingRow
                key={row.userId}
                row={row}
                isCurrentUser={row.userId === session.userId}
              />
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-white/40">
        Toca a un jugador para ver cómo ganó sus puntos.
      </p>
    </div>
  );
}
