import { requireSession } from "@/lib/auth";
import { getUserSummary } from "@/lib/queries";
import { Flag } from "@/components/flag";
import { LocalTime } from "@/components/local-time";
import type { PointsType } from "@prisma/client";

export const metadata = {
  title: "Detalle de Puntos",
};

const TYPE_LABEL: Record<PointsType, string> = {
  EXACT: "Marcador exacto",
  RESULT: "Resultado acertado",
  TRIVIA: "Trivia correcta",
  CHAMPION: "Campeón acertado",
  RUNNERUP: "Subcampeón acertado",
};

type SummaryEntry = Awaited<
  ReturnType<typeof getUserSummary>
>["entries"][number];

function ResumenCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tnum text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/50">{hint}</p> : null}
    </div>
  );
}

function MatchLabel({ entry }: { entry: SummaryEntry }) {
  const match = entry.match;
  if (!match) {
    if (entry.type === "CHAMPION" || entry.type === "RUNNERUP") {
      return <span className="text-white/70">Predicción de campeón</span>;
    }
    return <span className="text-white/50">—</span>;
  }

  const home = match.homeTeam;
  const away = match.awayTeam;

  return (
    <span className="flex items-center gap-2 text-white/90">
      <span className="inline-flex items-center gap-1.5">
        {home ? <Flag code={home.fifaCode} size={20} /> : null}
        <span className="truncate">{home?.name ?? "Por definir"}</span>
      </span>
      <span className="text-white/40">vs</span>
      <span className="inline-flex items-center gap-1.5">
        {away ? <Flag code={away.fifaCode} size={20} /> : null}
        <span className="truncate">{away?.name ?? "Por definir"}</span>
      </span>
    </span>
  );
}

export default async function MisPuntosPage() {
  const session = await requireSession();
  const summary = await getUserSummary(session.userId);

  return (
    <main className="festive-bg min-h-screen px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Detalle de Puntos</h1>
          <p className="mt-1 text-sm text-white/60">
            Tu historial de aciertos y puntos acumulados.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ResumenCard
            label="Puntos totales"
            value={summary.totalPoints.toString()}
          />
          <ResumenCard
            label="Posición"
            value={summary.rank ? summary.rank.toString() : "—"}
            hint={`de ${summary.totalPlayers} jugadores`}
          />
          <ResumenCard
            label="Marcadores exactos"
            value={summary.exactCount.toString()}
          />
          <ResumenCard
            label="Resultados acertados"
            value={summary.resultCount.toString()}
          />
          <ResumenCard
            label="Trivias correctas"
            value={summary.triviaCorrect.toString()}
          />
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-white/60">
            Historial
          </h2>

          {summary.entries.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
              <p className="text-sm text-white/70">
                Todavía no has sumado puntos.
              </p>
              <p className="mt-1 text-xs text-white/50">
                Responde las trivias y registra tus marcadores para empezar a
                puntuar.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {summary.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {TYPE_LABEL[entry.type]}
                    </p>
                    <div className="mt-1 truncate text-sm">
                      <MatchLabel entry={entry} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span className="text-xs text-white/50">
                      <LocalTime value={entry.createdAt} mode="date" />
                    </span>
                    <span className="tnum text-lg font-bold text-accent">
                      +{entry.points}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
