import "server-only";
import { prisma } from "@/lib/db";
import type { ScoringConfig } from "@prisma/client";

export type RecomputeMatchPointsResult = {
  hasScore: boolean;
  predictionsScored: number;
  pointsEntriesCreated: number;
  totalPointsCreated: number;
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

/** Points for a single prediction vs the current official score. */
export function predictionPoints(
  pred: { homeScore: number; awayScore: number },
  real: { homeScore: number; awayScore: number },
  cfg: Pick<ScoringConfig, "exactPts" | "resultPts">,
): { points: number; type: "EXACT" | "RESULT" | null } {
  if (pred.homeScore === real.homeScore && pred.awayScore === real.awayScore) {
    return { points: cfg.exactPts, type: "EXACT" };
  }
  if (outcome(pred.homeScore, pred.awayScore) === outcome(real.homeScore, real.awayScore)) {
    return { points: cfg.resultPts, type: "RESULT" };
  }
  return { points: 0, type: null };
}

/**
 * Recompute all points derived from a single match (prediction + trivia) using
 * the current stored score, even if the match is still live.
 * Idempotent: wipes previous entries for the match and recreates them.
 */
export async function recomputeMatchPoints(matchId: number): Promise<RecomputeMatchPointsResult> {
  const cfg = await getScoringConfig();

  return prisma.$transaction(
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

      // Clear previous derived points for this match.
      await tx.pointsEntry.deleteMany({ where: { matchId } });
      await tx.prediction.updateMany({
        where: { matchId },
        data: { pointsAwarded: null, scoredAt: null },
      });

      const hasScore = match.homeScore !== null && match.awayScore !== null;
      if (!hasScore) {
        return {
          hasScore: false,
          predictionsScored: 0,
          pointsEntriesCreated: 0,
          totalPointsCreated: 0,
        };
      }

      const real = { homeScore: match.homeScore!, awayScore: match.awayScore! };
      let pointsEntriesCreated = 0;
      let totalPointsCreated = 0;

      for (const pred of match.predictions) {
        const { points, type } = predictionPoints(pred, real, cfg);
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

      // Trivia points for correct answers to this match's question.
      if (match.question) {
        for (const ans of match.question.answers) {
          if (ans.isCorrect) {
            await tx.pointsEntry.create({
              data: { userId: ans.userId, matchId, type: "TRIVIA", points: cfg.triviaPts },
            });
            pointsEntriesCreated++;
            totalPointsCreated += cfg.triviaPts;
          }
        }
      }

      return {
        hasScore: true,
        predictionsScored: match.predictions.length,
        pointsEntriesCreated,
        totalPointsCreated,
      };
    },
    { maxWait: 20_000, timeout: 20_000 },
  );
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
