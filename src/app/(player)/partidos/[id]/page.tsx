import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Lock, CheckCircle2, XCircle } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getScoringConfig } from "@/lib/scoring";
import { formatDateTime, isPredictionOpen, predictionDeadline } from "@/lib/dates";
import { PHASE_LABEL } from "@/lib/constants";
import { Flag } from "@/components/flag";
import { TriviaForm } from "./_components/trivia-form";
import { ScoreForm } from "./_components/score-form";

export default async function PartidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) notFound();

  const session = await requireSession();

  const [match, cfg] = await Promise.all([
    prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        question: {
          include: {
            answers: { where: { userId: session.userId } },
          },
        },
        predictions: { where: { userId: session.userId } },
      },
    }),
    getScoringConfig(),
  ]);

  if (!match) notFound();

  const open = isPredictionOpen(match.kickoffAt, cfg.lockMinutes);
  const finished = match.status === "FINISHED";
  const hasRealScore = match.homeScore !== null && match.awayScore !== null;

  const prediction = match.predictions[0] ?? null;
  const question = match.question;
  const triviaAnswer = question?.answers[0] ?? null;

  const homeName = match.homeTeam?.name ?? "Por definir";
  const awayName = match.awayTeam?.name ?? "Por definir";
  const homeCode = match.homeTeam?.fifaCode ?? null;
  const awayCode = match.awayTeam?.fifaCode ?? null;

  const tag =
    match.phase === "GROUP" && match.groupName
      ? `Grupo ${match.groupName}`
      : PHASE_LABEL[match.phase];

  const deadlineLabel = formatDateTime(predictionDeadline(match.kickoffAt, cfg.lockMinutes));
  const teamsDefined = Boolean(match.homeTeam && match.awayTeam);
  const readOnly = !open || finished;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Link
        href="/partidos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
      >
        <ArrowLeft className="size-4" />
        Volver a partidos
      </Link>

      {/* Cabecera del partido */}
      <header className="rounded-xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
          {tag}
        </span>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-center gap-2">
            {match.homeTeam && <Flag code={match.homeTeam.fifaCode} size={40} />}
            <span className="text-sm font-semibold text-white">{homeName}</span>
          </div>
          <div className="px-2">
            {finished && hasRealScore ? (
              <span className="tnum text-3xl font-bold text-accent">
                {match.homeScore} - {match.awayScore}
              </span>
            ) : (
              <span className="text-sm font-semibold uppercase tracking-wide text-white/40">
                vs
              </span>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            {match.awayTeam && <Flag code={match.awayTeam.fifaCode} size={40} />}
            <span className="text-sm font-semibold text-white">{awayName}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/60">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {formatDateTime(match.kickoffAt)}
          </span>
          {match.venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {match.venue}
            </span>
          )}
        </div>
      </header>

      {readOnly ? (
        <ReadOnlyView
          finished={finished}
          hasRealScore={hasRealScore}
          homeScore={match.homeScore}
          awayScore={match.awayScore}
          prediction={prediction}
          triviaAnswer={triviaAnswer}
          question={question}
        />
      ) : !teamsDefined ? (
        <InfoBox>
          Este partido aún no tiene equipos definidos. Vuelve cuando se conozcan los rivales.
        </InfoBox>
      ) : !question ? (
        <InfoBox>Este partido todavía no tiene una pregunta de trivia disponible.</InfoBox>
      ) : !triviaAnswer ? (
        <TriviaForm matchId={match.id} text={question.text} options={question.options} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            Ya respondiste la trivia de este partido.
          </div>
          <ScoreForm
            matchId={match.id}
            homeName={homeName}
            awayName={awayName}
            homeCode={homeCode}
            awayCode={awayCode}
            homeScore={prediction?.homeScore ?? null}
            awayScore={prediction?.awayScore ?? null}
            deadlineLabel={deadlineLabel}
          />
        </div>
      )}
    </div>
  );
}

function ReadOnlyView({
  finished,
  hasRealScore,
  homeScore,
  awayScore,
  prediction,
  triviaAnswer,
  question,
}: {
  finished: boolean;
  hasRealScore: boolean;
  homeScore: number | null;
  awayScore: number | null;
  prediction: { homeScore: number; awayScore: number } | null;
  triviaAnswer: { selectedOption: number; isCorrect: boolean } | null;
  question: { text: string; options: string[] } | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 backdrop-blur">
        <Lock className="size-4 shrink-0 text-accent" />
        {finished
          ? "Este partido ya finalizó."
          : "El tiempo para pronosticar este partido cerró."}
      </div>

      {finished && hasRealScore && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/60">
            Resultado final
          </p>
          <p className="tnum text-2xl font-bold text-accent">
            {homeScore} - {awayScore}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/60">
          Tu pronóstico
        </p>
        {prediction ? (
          <p className="tnum text-2xl font-bold text-white">
            {prediction.homeScore} - {prediction.awayScore}
          </p>
        ) : (
          <p className="text-sm text-white/60">No registraste un pronóstico.</p>
        )}
      </div>

      {question && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/60">
            Trivia
          </p>
          <p className="text-sm font-semibold text-white">{question.text}</p>
          {triviaAnswer ? (
            <div
              className={`mt-3 inline-flex items-center gap-2 text-sm ${
                triviaAnswer.isCorrect ? "text-success" : "text-danger"
              }`}
            >
              {triviaAnswer.isCorrect ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <XCircle className="size-4 shrink-0" />
              )}
              <span>
                Tu respuesta:{" "}
                {question.options[triviaAnswer.selectedOption] ?? "—"}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/60">No respondiste la trivia.</p>
          )}
        </div>
      )}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/70 backdrop-blur">
      {children}
    </div>
  );
}
