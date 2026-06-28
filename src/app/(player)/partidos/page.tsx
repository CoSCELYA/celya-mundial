import Link from "next/link";
import type { Match, Prediction, QuestionAnswer, Team } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getScoringConfig } from "@/lib/scoring";
import { isPredictionOpen, partitionByPlayed } from "@/lib/dates";
import { PHASE_LABEL } from "@/lib/constants";
import {
  CalendarDays,
  Lock,
  PencilLine,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Flag } from "@/components/flag";
import { LocalTime } from "@/components/local-time";
import { MatchAccordion } from "./_components/match-accordion";

type MatchWithTeams = Match & {
  homeTeam: Team | null;
  awayTeam: Team | null;
  question: {
    status: "ACTIVE" | "INACTIVE";
    text: string;
    options: string[];
    correctOption: number;
    answers: Pick<QuestionAnswer, "selectedOption" | "isCorrect">[];
  } | null;
};

export default async function PartidosPage() {
  const session = await requireSession();

  const [matches, predictions, cfg] = await Promise.all([
    prisma.match.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
        question: {
          select: {
            status: true,
            text: true,
            options: true,
            correctOption: true,
            answers: {
              where: { userId: session.userId },
              select: { selectedOption: true, isCorrect: true },
            },
          },
        },
      },
      orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
    }),
    prisma.prediction.findMany({ where: { userId: session.userId } }),
    getScoringConfig(),
  ]);

  const predByMatch = new Map<number, Prediction>();
  for (const p of predictions) predByMatch.set(p.matchId, p);

  // Separar próximos/en juego de los ya jugados, para poder plegar el pasado.
  const { upcoming, past } = partitionByPlayed(matches);

  const renderCard = (m: MatchWithTeams) => (
    <MatchCard
      key={m.id}
      match={m}
      prediction={predByMatch.get(m.id) ?? null}
      open={isPredictionOpen(m.kickoffAt, cfg.lockMinutes)}
    />
  );

  return (
    <div className="space-y-6">
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
        <>
          <MatchAccordion title="En juego y próximos" count={upcoming.length} defaultOpen>
            {upcoming.length > 0 ? (
              upcoming.map(renderCard)
            ) : (
              <p className="col-span-full rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/60 backdrop-blur">
                No hay partidos próximos por ahora.
              </p>
            )}
          </MatchAccordion>

          {past.length > 0 && (
            <MatchAccordion title="Partidos jugados" count={past.length}>
              {past.map(renderCard)}
            </MatchAccordion>
          )}
        </>
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
  // Eliminatorias: solo marcador, sin trivia (se ignora cualquier pregunta).
  const q = match.phase === "GROUP" ? match.question : null;
  const predictionAvailable = open && (!q || q.status === "ACTIVE");
  const unavailable = open && !predictionAvailable;
  const triviaSummaryQuestion = !open && q?.status === "ACTIVE" ? q : null;

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
        <StateChip open={open} finished={finished} disabled={unavailable} />
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

      {unavailable && (
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
          La pregunta está deshabilitada por el momento.
        </p>
      )}

      {triviaSummaryQuestion && (
        <TriviaSummary
          text={triviaSummaryQuestion.text}
          options={triviaSummaryQuestion.options}
          correctOption={triviaSummaryQuestion.correctOption}
          answer={triviaSummaryQuestion.answers[0] ?? null}
        />
      )}

      {predictionAvailable ? (
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

function TriviaSummary({
  text,
  options,
  correctOption,
  answer,
}: {
  text: string;
  options: string[];
  correctOption: number;
  answer: Pick<QuestionAnswer, "selectedOption" | "isCorrect"> | null;
}) {
  const userAnswer = answer ? options[answer.selectedOption] ?? "—" : null;
  const correctAnswer = options[correctOption] ?? "—";

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
        Trivia
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-white">{text}</p>
      {answer ? (
        <div className="mt-3 space-y-1.5 text-xs">
          <p
            className={`flex items-start gap-2 ${
              answer.isCorrect ? "text-success" : "text-danger"
            }`}
          >
            {answer.isCorrect ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 size-3.5 shrink-0" />
            )}
            <span>Tu respuesta: {userAnswer}</span>
          </p>
          {!answer.isCorrect && (
            <p className="pl-5 text-white/70">Respuesta correcta: {correctAnswer}</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-white/60">No respondiste la trivia.</p>
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

function StateChip({
  open,
  finished,
  disabled,
}: {
  open: boolean;
  finished: boolean;
  disabled: boolean;
}) {
  if (finished) {
    return (
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">
        Finalizado
      </span>
    );
  }
  if (open) {
    if (disabled) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/70">
          <Lock className="size-3" />
          Deshabilitado
        </span>
      );
    }

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
