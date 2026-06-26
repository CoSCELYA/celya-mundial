import { Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getPlayedMatchPredictions } from "@/lib/queries";
import { PredictionsMatch } from "./_components/predictions-match";

export const metadata = {
  title: "Pronósticos",
};

export default async function PronosticosPage() {
  await requireSession();
  const matches = await getPlayedMatchPredictions();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          <Users className="size-6 text-accent" />
          Pronósticos
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Mira el marcador que pronosticó cada jugador en los partidos ya jugados.
        </p>
      </header>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/70 backdrop-blur">
          Todavía no hay partidos jugados.
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <PredictionsMatch key={m.matchId} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
