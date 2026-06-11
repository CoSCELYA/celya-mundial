import Link from "next/link";
import type { Match, Prediction, Team } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getScoringConfig } from "@/lib/scoring";
import { isPredictionOpen } from "@/lib/dates";
import { PHASE_ORDER, PHASE_LABEL } from "@/lib/constants";
import { CalendarDays, Lock, PencilLine, ArrowRight } from "lucide-react";
import { Flag } from "@/components/flag";
import { LocalTime } from "@/components/local-time";

type MatchWithTeams = Match & {
  homeTeam: Team | null;
  awayTeam: Team | null;
};

export default async function PartidosPage() {
  const session = await requireSession();

  const [matches, predictions, cfg] = await Promise.all([
    prisma.match.findMany({
      include: { homeTeam: true, awayTeam: true },
      orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
    }),
    prisma.prediction.findMany({ where: { userId: session.userId } }),
    getScoringConfig(),
  ]);

  const predByMatch = new Map<number, Prediction>();
  for (const p of predictions) predByMatch.set(p.matchId, p);

  // Agrupar partidos por fase, respetando el orden oficial.
  const byPhase = new Map<string, MatchWithTeams[]>();
  for (const phase of PHASE_ORDER) byPhase.set(phase, []);
  for (const m of matches) byPhase.get(m.phase)?.push(m);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Pronóstico de partidos
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Responde la trivia y registra tu marcador antes de que cierre cada partido.
        </p>
      </header>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/70 backdrop-blur">
          Todavía no hay partidos programados.
        </div>
      ) : (
        PHASE_ORDER.map((phase) => {
          const list = byPhase.get(phase) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={phase} className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                {PHASE_LABEL[phase]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    prediction={predByMatch.get(m.id) ?? null}
                    open={isPredictionOpen(m.kickoffAt, cfg.lockMinutes)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function MatchCard({
  match,
  prediction,
  open,
}: {
  match: MatchWithTeams;
  prediction: Prediction | null;
  open: boolean;
}) {
  const finished = match.status === "FINISHED";
  const hasRealScore = match.homeScore !== null && match.awayScore !== null;

  const tag =
    match.phase === "GROUP" && match.groupName
      ? `Grupo ${match.groupName}`
      : PHASE_LABEL[match.phase];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
          {tag}
        </span>
        <StateChip open={open} finished={finished} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <TeamSide
          fifaCode={match.homeTeam?.fifaCode}
          name={match.homeTeam?.name}
          align="start"
        />
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-white/40">
          vs
        </span>
        <TeamSide
          fifaCode={match.awayTeam?.fifaCode}
          name={match.awayTeam?.name}
          align="end"
        />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-white/60">
        <CalendarDays className="size-3.5 shrink-0" />
        <span><LocalTime value={match.kickoffAt} /></span>
      </div>

      {hasRealScore && (
        <ScoreRow
          label={finished ? "Resultado final" : "Marcador registrado"}
          home={match.homeScore as number}
          away={match.awayScore as number}
          accent
        />
      )}

      {prediction ? (
        <ScoreRow
          label="Tu pronóstico"
          home={prediction.homeScore}
          away={prediction.awayScore}
        />
      ) : (
        <p className="text-xs text-white/50">Aún no has pronosticado este partido.</p>
      )}

      {open ? (
        <Link
          href={`/partidos/${match.id}`}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          <PencilLine className="size-4" />
          {prediction ? "Editar pronóstico" : "Pronosticar"}
        </Link>
      ) : (
        <Link
          href={`/partidos/${match.id}`}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border border-white/15 px-4 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10"
        >
          Ver detalle
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function TeamSide({
  fifaCode,
  name,
  align,
}: {
  fifaCode?: string;
  name?: string;
  align: "start" | "end";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "end" ? "flex-row-reverse text-right" : "text-left"
      }`}
    >
      {fifaCode && <Flag code={fifaCode} size={22} />}
      <span className="truncate text-sm font-semibold text-white">
        {name ?? "Por definir"}
      </span>
    </div>
  );
}

function ScoreRow({
  label,
  home,
  away,
  accent = false,
}: {
  label: string;
  home: number;
  away: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
        {label}
      </span>
      <span
        className={`tnum text-sm font-bold ${accent ? "text-accent" : "text-white"}`}
      >
        {home} - {away}
      </span>
    </div>
  );
}

function StateChip({ open, finished }: { open: boolean; finished: boolean }) {
  if (finished) {
    return (
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">
        Finalizado
      </span>
    );
  }
  if (open) {
    return (
      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
        Abierto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">
      <Lock className="size-3" />
      Cerrado
    </span>
  );
}
