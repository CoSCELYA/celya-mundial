import "server-only";
import { prisma } from "@/lib/db";
import { getScoringConfig } from "@/lib/scoring";
import type { PointsType } from "@prisma/client";

/** Desglose de cómo se ganaron los puntos, por categoría. */
export type PointsBreakdown = Record<PointsType, { count: number; points: number }>;

export type StandingRow = {
  rank: number;
  userId: number;
  fullName: string;
  email: string;
  totalPoints: number;
  exactCount: number;
  resultCount: number;
  tiebreaker: number;
  breakdown: PointsBreakdown;
  champion: { name: string; flagEmoji: string; fifaCode: string } | null;
  runnerUp: { name: string; flagEmoji: string; fifaCode: string } | null;
};

function emptyBreakdown(): PointsBreakdown {
  return {
    EXACT: { count: 0, points: 0 },
    RESULT: { count: 0, points: 0 },
    TRIVIA: { count: 0, points: 0 },
    CHAMPION: { count: 0, points: 0 },
    RUNNERUP: { count: 0, points: 0 },
  };
}

/** Full ranking of EMPLEADO users by accumulated points (with tiebreakers). */
export async function getStandings(): Promise<StandingRow[]> {
  const users = await prisma.user.findMany({
    where: { role: "EMPLEADO" },
    include: {
      pointsLog: true,
      championPick: {
        include: { championTeam: true, runnerUpTeam: true },
      },
    },
  });

  const rows = users.map((u) => {
    const breakdown = emptyBreakdown();
    for (const e of u.pointsLog) {
      breakdown[e.type].count += 1;
      breakdown[e.type].points += e.points;
    }
    const totalPoints = u.pointsLog.reduce((s, e) => s + e.points, 0);
    const exactCount = breakdown.EXACT.count;
    const resultCount = breakdown.RESULT.count;
    return {
      userId: u.id,
      fullName: u.fullName,
      email: u.email,
      totalPoints,
      exactCount,
      resultCount,
      tiebreaker: u.tiebreaker,
      breakdown,
      champion: u.championPick
        ? {
            name: u.championPick.championTeam.name,
            flagEmoji: u.championPick.championTeam.flagEmoji,
            fifaCode: u.championPick.championTeam.fifaCode,
          }
        : null,
      runnerUp: u.championPick
        ? {
            name: u.championPick.runnerUpTeam.name,
            flagEmoji: u.championPick.runnerUpTeam.flagEmoji,
            fifaCode: u.championPick.runnerUpTeam.fifaCode,
          }
        : null,
    };
  });

  rows.sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      b.exactCount - a.exactCount ||
      b.resultCount - a.resultCount ||
      // Desempate aleatorio (se rebaraja al recalcular puntos), reemplaza el
      // antiguo orden alfabético.
      a.tiebreaker - b.tiebreaker,
  );

  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

/** Aggregate stats for a single user, used by "Detalle de Puntos" and home. */
export async function getUserSummary(userId: number) {
  const [entries, predictions, answers] = await Promise.all([
    prisma.pointsEntry.findMany({
      where: { userId },
      include: { match: { include: { homeTeam: true, awayTeam: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.prediction.findMany({ where: { userId } }),
    prisma.questionAnswer.findMany({ where: { userId } }),
  ]);

  const totalPoints = entries.reduce((s, e) => s + e.points, 0);
  const exactCount = entries.filter((e) => e.type === "EXACT").length;
  const resultCount = entries.filter((e) => e.type === "RESULT").length;
  const triviaCorrect = answers.filter((a) => a.isCorrect).length;

  const standings = await getStandings();
  const rank = standings.find((s) => s.userId === userId)?.rank ?? null;

  return {
    totalPoints,
    exactCount,
    resultCount,
    triviaCorrect,
    predictionsCount: predictions.length,
    rank,
    totalPlayers: standings.length,
    entries,
  };
}

/** The user's champion / runner-up pick with team details. */
export async function getChampionPick(userId: number) {
  return prisma.championPick.findUnique({
    where: { userId },
    include: { championTeam: true, runnerUpTeam: true },
  });
}

export { getScoringConfig };
