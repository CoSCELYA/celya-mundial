import "server-only";
import { prisma } from "@/lib/db";
import type { Phase, Prisma, ScoringConfig } from "@prisma/client";

// Fases de eliminación puntuadas por "clasificación" (acertar quién avanza) en
// vez del resultado 1X2. Los dieciseisavos (R32) quedan con el esquema de grupos
// porque ya empezaron cuando se hizo el cambio.
const ADVANCER_SCORED_PHASES: Phase[] = ["R16", "QF", "SF", "THIRD", "FINAL"];

/** Si la fase se puntúa por clasificado (octavos en adelante). */
export function isAdvancerScored(phase: Phase): boolean {
  return ADVANCER_SCORED_PHASES.includes(phase);
}

export type RecomputeMatchPointsResult = {
  hasScore: boolean;
  predictionsScored: number;
  pointsEntriesCreated: number;
  totalPointsCreated: number;
};

export type RecomputeClosedTriviaResult = {
  matchesChecked: number;
  pointsEntriesCreated: number;
  totalPointsCreated: number;
  errors: number;
};

/** Return the singleton scoring config, creating defaults if missing. */
export async function getScoringConfig(): Promise<ScoringConfig> {
  const existing = await prisma.scoringConfig.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.scoringConfig.create({ data: { id: 1 } });
}

function outcome(home: number, away: number): number {
  return Math.sign(home - away); // 1 home win, 0 draw, -1 away win
}

/**
 * Reasigna el desempate aleatorio de todos los usuarios. Se llama UNA vez por
 * evento de recálculo (carga de resultado en admin, o un sync que aplicó un
 * marcador), no por cada partido, para que los empates se rebarajen al cerrar
 * partidos sin penalizar el rendimiento del sync completo.
 */
export async function reshuffleTiebreakers(): Promise<void> {
  await prisma.$executeRaw`UPDATE "User" SET "tiebreaker" = random()`;
}

/**
 * Contexto de eliminatoria para puntuar por clasificado (octavos en adelante).
 * `winnerTeamId` es el equipo que avanza (definido por penales si hubo empate).
 */
type AdvancerContext = {
  advancerScored: boolean;
  homeTeamId: number | null;
  awayTeamId: number | null;
  winnerTeamId: number | null;
};

/** Equipo con más goles en un marcador; null si es empate. */
function higherTeam(
  home: number,
  away: number,
  homeTeamId: number | null,
  awayTeamId: number | null,
): number | null {
  if (home > away) return homeTeamId;
  if (away > home) return awayTeamId;
  return null;
}

/** Points for a single prediction vs the current official score. */
export function predictionPoints(
  pred: { homeScore: number; awayScore: number },
  real: { homeScore: number; awayScore: number },
  cfg: Pick<ScoringConfig, "exactPts" | "resultPts">,
  ctx?: AdvancerContext,
): { points: number; type: "EXACT" | "RESULT" | null } {
  // El marcador exacto (90'/prórroga) siempre otorga el máximo, en toda fase.
  if (pred.homeScore === real.homeScore && pred.awayScore === real.awayScore) {
    return { points: cfg.exactPts, type: "EXACT" };
  }

  // Eliminatorias R16+: se premia acertar quién clasifica, no el 1X2.
  if (ctx?.advancerScored) {
    const predAdvancer = higherTeam(
      pred.homeScore,
      pred.awayScore,
      ctx.homeTeamId,
      ctx.awayTeamId,
    );
    const actualAdvancer =
      ctx.winnerTeamId ??
      higherTeam(real.homeScore, real.awayScore, ctx.homeTeamId, ctx.awayTeamId);
    if (predAdvancer !== null && actualAdvancer !== null && predAdvancer === actualAdvancer) {
      return { points: cfg.resultPts, type: "RESULT" };
    }
    return { points: 0, type: null };
  }

  // Grupos y dieciseisavos: resultado 1X2 (sin cambios).
  if (outcome(pred.homeScore, pred.awayScore) === outcome(real.homeScore, real.awayScore)) {
    return { points: cfg.resultPts, type: "RESULT" };
  }
  return { points: 0, type: null };
}

async function recomputeTriviaPointsInTransaction(
  tx: Prisma.TransactionClient,
  matchId: number,
  cfg: Pick<ScoringConfig, "triviaPts">,
): Promise<{ pointsEntriesCreated: number; totalPointsCreated: number }> {
  await tx.pointsEntry.deleteMany({ where: { matchId, type: "TRIVIA" } });

  const question = await tx.question.findUnique({
    where: { matchId },
    include: {
      match: { select: { phase: true } },
      answers: { where: { isCorrect: true } },
    },
  });
  // Solo la fase de grupos tiene trivia; las eliminatorias son solo marcador.
  if (question?.status !== "ACTIVE" || question.match.phase !== "GROUP") {
    return { pointsEntriesCreated: 0, totalPointsCreated: 0 };
  }

  // Inserción por lotes (no fila por fila) para que el recálculo sea rápido.
  if (question.answers.length > 0) {
    await tx.pointsEntry.createMany({
      data: question.answers.map((ans) => ({
        userId: ans.userId,
        matchId,
        type: "TRIVIA" as const,
        points: cfg.triviaPts,
      })),
    });
  }

  return {
    pointsEntriesCreated: question.answers.length,
    totalPointsCreated: question.answers.length * cfg.triviaPts,
  };
}

export async function recomputeTriviaPoints(matchId: number): Promise<RecomputeMatchPointsResult> {
  const cfg = await getScoringConfig();

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${matchId})`;
      const trivia = await recomputeTriviaPointsInTransaction(tx, matchId, cfg);

      return {
        hasScore: false,
        predictionsScored: 0,
        pointsEntriesCreated: trivia.pointsEntriesCreated,
        totalPointsCreated: trivia.totalPointsCreated,
      };
    },
    { maxWait: 20_000, timeout: 20_000 },
  );

  return result;
}

export async function recomputeClosedTriviaPoints(
  now: Date = new Date(),
  excludeMatchIds: number[] = [],
): Promise<RecomputeClosedTriviaResult> {
  const cfg = await getScoringConfig();
  const closedDeadlineThreshold = new Date(now.getTime() + cfg.lockMinutes * 60_000);
  // Solo partidos cerrados que aún NO tienen puntos de trivia: tras el deadline
  // las respuestas quedan bloqueadas, así que una vez calificado un partido no
  // hay que recalcularlo. Esto evita reprocesar miles de entradas en cada cron.
  const matches = await prisma.match.findMany({
    where: {
      phase: "GROUP",
      kickoffAt: { lte: closedDeadlineThreshold },
      question: { is: { status: "ACTIVE" } },
      pointsLog: { none: { type: "TRIVIA" } },
      ...(excludeMatchIds.length > 0 ? { id: { notIn: excludeMatchIds } } : {}),
    },
    select: { id: true },
    orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
  });

  const result: RecomputeClosedTriviaResult = {
    matchesChecked: matches.length,
    pointsEntriesCreated: 0,
    totalPointsCreated: 0,
    errors: 0,
  };

  for (const match of matches) {
    try {
      const scoring = await recomputeTriviaPoints(match.id);
      result.pointsEntriesCreated += scoring.pointsEntriesCreated;
      result.totalPointsCreated += scoring.totalPointsCreated;
    } catch (error) {
      console.error(`[scoring] Error recalculando trivia cerrada (${match.id})`, error);
      result.errors++;
    }
  }

  return result;
}

/**
 * Recompute all points derived from a single match (prediction + trivia) using
 * the current stored score, even if the match is still live.
 * Idempotent: wipes previous entries for the match and recreates them.
 */
export async function recomputeMatchPoints(matchId: number): Promise<RecomputeMatchPointsResult> {
  const cfg = await getScoringConfig();

  const result = await prisma.$transaction(
    async (tx) => {
      // Serializa recomputes concurrentes del mismo partido (cron + carga manual)
      // para que dos transacciones no dupliquen entradas de puntos.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${matchId})`;

      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          predictions: true,
          question: { include: { answers: true } },
        },
      });
      if (!match) {
        return {
          hasScore: false,
          predictionsScored: 0,
          pointsEntriesCreated: 0,
          totalPointsCreated: 0,
        };
      }

      // Clear previous score-derived points for this match.
      await tx.pointsEntry.deleteMany({
        where: { matchId, type: { in: ["EXACT", "RESULT"] } },
      });
      await tx.prediction.updateMany({
        where: { matchId },
        data: { pointsAwarded: null, scoredAt: null },
      });

      const hasScore = match.homeScore !== null && match.awayScore !== null;
      const trivia = await recomputeTriviaPointsInTransaction(tx, matchId, cfg);
      if (!hasScore) {
        return {
          hasScore: false,
          predictionsScored: 0,
          pointsEntriesCreated: trivia.pointsEntriesCreated,
          totalPointsCreated: trivia.totalPointsCreated,
        };
      }

      const real = { homeScore: match.homeScore!, awayScore: match.awayScore! };
      const advancerCtx: AdvancerContext = {
        advancerScored: isAdvancerScored(match.phase),
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        winnerTeamId: match.winnerTeamId,
      };
      let pointsEntriesCreated = 0;
      let totalPointsCreated = 0;

      for (const pred of match.predictions) {
        const { points, type } = predictionPoints(pred, real, cfg, advancerCtx);
        await tx.prediction.update({
          where: { id: pred.id },
          data: { pointsAwarded: points, scoredAt: new Date() },
        });
        if (points > 0 && type) {
          await tx.pointsEntry.create({
            data: { userId: pred.userId, matchId, type, points },
          });
          pointsEntriesCreated++;
          totalPointsCreated += points;
        }
      }

      pointsEntriesCreated += trivia.pointsEntriesCreated;
      totalPointsCreated += trivia.totalPointsCreated;

      return {
        hasScore: true,
        predictionsScored: match.predictions.length,
        pointsEntriesCreated,
        totalPointsCreated,
      };
    },
    { maxWait: 20_000, timeout: 20_000 },
  );

  return result;
}

/**
 * Recompute champion / runner-up points based on the current FINAL score.
 * Champion = FINAL winner, runner-up = FINAL loser. Idempotent.
 */
export async function recomputeChampionPoints(): Promise<void> {
  const cfg = await getScoringConfig();
  const final = await prisma.match.findFirst({ where: { phase: "FINAL" } });

  await prisma.$transaction(async (tx) => {
    // Lock fijo para serializar el recálculo global de campeón/subcampeón.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;

    await tx.pointsEntry.deleteMany({ where: { type: { in: ["CHAMPION", "RUNNERUP"] } } });
    await tx.championPick.updateMany({ data: { championPts: null, runnerUpPts: null } });

    const decided =
      final !== null &&
      final.homeScore !== null &&
      final.awayScore !== null &&
      (final.homeScore !== final.awayScore || final.winnerTeamId !== null);

    const ready =
      final &&
      final.homeTeamId !== null &&
      final.awayTeamId !== null &&
      decided;
    if (!ready) return;

    // Campeón = ganador de la final. Si el marcador quedó empatado (penales),
    // se usa el ganador registrado (winnerTeamId).
    let championId: number;
    if (final.homeScore! !== final.awayScore!) {
      championId = final.homeScore! > final.awayScore! ? final.homeTeamId! : final.awayTeamId!;
    } else {
      championId = final.winnerTeamId!;
    }
    const runnerUpId = championId === final.homeTeamId! ? final.awayTeamId! : final.homeTeamId!;

    const picks = await tx.championPick.findMany();
    for (const pick of picks) {
      const cPts = pick.championTeamId === championId ? cfg.championPts : 0;
      const rPts = pick.runnerUpTeamId === runnerUpId ? cfg.runnerUpPts : 0;
      await tx.championPick.update({
        where: { id: pick.id },
        data: { championPts: cPts, runnerUpPts: rPts },
      });
      if (cPts > 0) {
        await tx.pointsEntry.create({
          data: { userId: pick.userId, type: "CHAMPION", points: cPts },
        });
      }
      if (rPts > 0) {
        await tx.pointsEntry.create({
          data: { userId: pick.userId, type: "RUNNERUP", points: rPts },
        });
      }
    }
  });
}

/** Whether the champion/runner-up pick is still editable (before lock phase begins). */
export async function isChampionPickOpen(): Promise<boolean> {
  const cfg = await getScoringConfig();
  // Locked once the earliest match of the lock phase has kicked off.
  const lockMatch = await prisma.match.findFirst({
    where: { phase: cfg.championLockPhase },
    orderBy: { kickoffAt: "asc" },
  });
  if (!lockMatch) return true;
  return Date.now() < lockMatch.kickoffAt.getTime();
}
