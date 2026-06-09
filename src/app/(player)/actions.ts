"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getScoringConfig, isChampionPickOpen } from "@/lib/scoring";
import { isPredictionOpen } from "@/lib/dates";
import { scoreSchema, championSchema } from "@/lib/validations";

export type ActionState = { error?: string; success?: string } | null;

/**
 * Registra la respuesta de trivia del empleado para el partido indicado.
 * Crea (o actualiza) el QuestionAnswer único por [userId, questionId] y calcula
 * si la respuesta es correcta. Editable hasta el cierre del plazo del partido.
 */
export async function answerTrivia(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireSession();
  if (s.role !== "EMPLEADO") return { error: "Solo empleados pueden pronosticar." };

  const matchId = Number(fd.get("matchId"));
  const selectedOption = Number(fd.get("selectedOption"));

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return { error: "Partido inválido." };
  }
  if (!Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption > 3) {
    return { error: "Selecciona una opción válida." };
  }

  const question = await prisma.question.findUnique({
    where: { matchId },
    include: { match: true },
  });
  if (!question) return { error: "Este partido no tiene pregunta de trivia." };
  if (question.status !== "ACTIVE") return { error: "La pregunta no está disponible." };

  const cfg = await getScoringConfig();
  if (!isPredictionOpen(question.match.kickoffAt, cfg.lockMinutes)) {
    return { error: "El tiempo para este partido ya cerró." };
  }

  const isCorrect = selectedOption === question.correctOption;

  // Las respuestas se pueden cambiar hasta el cierre del plazo (deadline) del
  // partido; el bloqueo de edición admin también se rige por ese plazo.
  await prisma.questionAnswer.upsert({
    where: { userId_questionId: { userId: s.userId, questionId: question.id } },
    update: { selectedOption, isCorrect },
    create: {
      userId: s.userId,
      questionId: question.id,
      selectedOption,
      isCorrect,
    },
  });

  revalidatePath(`/partidos/${matchId}`);
  return { success: "Respuesta registrada." };
}

/**
 * Guarda el pronóstico de marcador del empleado para un partido.
 * Exige haber respondido antes la trivia del partido y que no haya pasado el deadline.
 * Upsert de Prediction único por [userId, matchId].
 */
export async function savePrediction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireSession();
  if (s.role !== "EMPLEADO") return { error: "Solo empleados pueden pronosticar." };

  const matchId = Number(fd.get("matchId"));
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return { error: "Partido inválido." };
  }

  const parsed = scoreSchema.safeParse({
    homeScore: fd.get("homeScore"),
    awayScore: fd.get("awayScore"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Marcador inválido." };
  }
  const { homeScore, awayScore } = parsed.data;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { question: true },
  });
  if (!match) return { error: "El partido no existe." };
  if (!match.question) return { error: "Este partido no tiene pregunta de trivia." };

  const answer = await prisma.questionAnswer.findUnique({
    where: { userId_questionId: { userId: s.userId, questionId: match.question.id } },
  });
  if (!answer) return { error: "Primero responde la pregunta de trivia." };

  const cfg = await getScoringConfig();
  if (!isPredictionOpen(match.kickoffAt, cfg.lockMinutes)) {
    return { error: "El tiempo para este partido ya cerró." };
  }

  await prisma.prediction.upsert({
    where: { userId_matchId: { userId: s.userId, matchId } },
    update: { homeScore, awayScore },
    create: { userId: s.userId, matchId, homeScore, awayScore },
  });

  revalidatePath("/partidos");
  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/");
  return { success: "Pronóstico guardado." };
}

/**
 * Guarda la selección de campeón y subcampeón del empleado.
 * Ambos equipos deben ser distintos y la selección debe seguir abierta.
 * Upsert de ChampionPick único por userId.
 */
export async function saveChampionPick(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireSession();
  if (s.role !== "EMPLEADO") return { error: "Solo empleados pueden pronosticar." };

  const parsed = championSchema.safeParse({
    championTeamId: fd.get("championTeamId"),
    runnerUpTeamId: fd.get("runnerUpTeamId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Selección inválida." };
  }
  const { championTeamId, runnerUpTeamId } = parsed.data;

  if (championTeamId === runnerUpTeamId) {
    return { error: "El campeón y el subcampeón deben ser distintos." };
  }

  if (!(await isChampionPickOpen())) {
    return { error: "La selección de campeón ya está cerrada." };
  }

  await prisma.championPick.upsert({
    where: { userId: s.userId },
    update: { championTeamId, runnerUpTeamId },
    create: { userId: s.userId, championTeamId, runnerUpTeamId },
  });

  revalidatePath("/campeones");
  revalidatePath("/");
  return { success: "Selección guardada." };
}
