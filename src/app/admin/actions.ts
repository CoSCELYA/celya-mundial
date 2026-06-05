"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { recomputeMatchPoints, recomputeChampionPoints } from "@/lib/scoring";
import { syncWorldCup } from "@/lib/football-data";
import {
  userUpsertSchema,
  scoreSchema,
  questionUpsertSchema,
  prizeUpsertSchema,
  scoringConfigSchema,
} from "@/lib/validations";

export type ActionState = { error?: string; success?: string } | null;

function field(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v : "";
}

function optionalField(fd: FormData, name: string): string | undefined {
  const v = field(fd, name).trim();
  return v.length > 0 ? v : undefined;
}

function revalidateAdmin(paths: string[]): void {
  for (const p of paths) revalidatePath(p);
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

export async function createUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = userUpsertSchema.safeParse({
    fullName: field(fd, "fullName"),
    email: field(fd, "email"),
    documento: optionalField(fd, "documento"),
    role: field(fd, "role"),
    status: field(fd, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const password = field(fd, "password");
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres" };
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) {
    return { error: "Ya existe un usuario con ese correo." };
  }

  await prisma.user.create({
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      documento: parsed.data.documento ?? null,
      role: parsed.data.role,
      status: parsed.data.status,
      passwordHash: await hashPassword(password),
    },
  });

  revalidateAdmin(["/admin/usuarios", "/admin/tabla", "/admin"]);
  return { success: "Usuario creado correctamente." };
}

export async function updateUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = Number(field(fd, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Usuario inválido." };
  }

  const parsed = userUpsertSchema.safeParse({
    fullName: field(fd, "fullName"),
    email: field(fd, "email"),
    documento: optionalField(fd, "documento"),
    role: field(fd, "role"),
    status: field(fd, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const conflict = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id } },
  });
  if (conflict) {
    return { error: "Ya existe otro usuario con ese correo." };
  }

  const password = field(fd, "password");
  const data: {
    fullName: string;
    email: string;
    documento: string | null;
    role: typeof parsed.data.role;
    status: typeof parsed.data.status;
    passwordHash?: string;
  } = {
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    documento: parsed.data.documento ?? null,
    role: parsed.data.role,
    status: parsed.data.status,
  };

  if (password.length > 0) {
    if (password.length < 6) {
      return { error: "La contraseña debe tener al menos 6 caracteres" };
    }
    data.passwordHash = await hashPassword(password);
  }

  await prisma.user.update({ where: { id }, data });

  revalidateAdmin(["/admin/usuarios", "/admin/tabla", "/admin"]);
  return { success: "Usuario actualizado correctamente." };
}

export async function deleteUser(fd: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(field(fd, "id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const session = await getSession();
  if (session && session.userId === id) {
    // Un admin no puede eliminarse a sí mismo.
    return;
  }

  await prisma.user.delete({ where: { id } });

  revalidateAdmin(["/admin/usuarios", "/admin/tabla", "/admin"]);
}

export async function setUserStatus(fd: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(field(fd, "id"));
  const status = field(fd, "status");
  if (!Number.isInteger(id) || id <= 0) return;
  if (status !== "PENDING" && status !== "ACTIVE" && status !== "INACTIVE") return;

  await prisma.user.update({ where: { id }, data: { status } });

  revalidateAdmin(["/admin/usuarios", "/admin/tabla", "/admin"]);
}

// ---------------------------------------------------------------------------
// Partidos
// ---------------------------------------------------------------------------

// Los partidos NO se crean/editan/eliminan: son los 104 oficiales del Mundial.
// Se sincronizan desde football-data.org (equipos de eliminatorias y marcadores).
export async function syncMatches(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAdmin();

  const result = await syncWorldCup();
  revalidateAdmin(["/admin/partidos", "/admin/tabla", "/admin", "/partidos", "/tabla"]);
  return result.ok ? { success: result.message } : { error: result.message };
}

// Carga/corrección manual del marcador (respaldo si la API no está disponible).
export async function setMatchResult(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = Number(field(fd, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Partido inválido." };
  }

  const status = field(fd, "status");
  if (status !== "SCHEDULED" && status !== "LIVE" && status !== "FINISHED") {
    return { error: "Estado de partido inválido." };
  }

  const parsed = scoreSchema.safeParse({
    homeScore: field(fd, "homeScore"),
    awayScore: field(fd, "awayScore"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const match = await prisma.match.update({
    where: { id },
    data: {
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      status,
    },
  });

  // Recalcula puntos para asignar (si FINISHED) o limpiar (si vuelve a no FINISHED).
  await recomputeMatchPoints(id);
  if (status === "FINISHED" && match.phase === "FINAL") {
    await recomputeChampionPoints();
  }

  revalidateAdmin(["/admin/partidos", "/admin/tabla", "/admin"]);
  return { success: "Resultado guardado correctamente." };
}

// ---------------------------------------------------------------------------
// Preguntas (trivia)
// ---------------------------------------------------------------------------

export async function createQuestion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = questionUpsertSchema.safeParse({
    matchId: field(fd, "matchId"),
    text: field(fd, "text"),
    option0: field(fd, "option0"),
    option1: field(fd, "option1"),
    option2: field(fd, "option2"),
    option3: field(fd, "option3"),
    correctOption: field(fd, "correctOption"),
    status: field(fd, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const exists = await prisma.question.findUnique({ where: { matchId: parsed.data.matchId } });
  if (exists) {
    return { error: "Ese partido ya tiene una pregunta." };
  }

  await prisma.question.create({
    data: {
      matchId: parsed.data.matchId,
      text: parsed.data.text,
      options: [parsed.data.option0, parsed.data.option1, parsed.data.option2, parsed.data.option3],
      correctOption: parsed.data.correctOption,
      status: parsed.data.status,
    },
  });

  revalidateAdmin(["/admin/preguntas", "/admin"]);
  return { success: "Pregunta creada correctamente." };
}

export async function updateQuestion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = Number(field(fd, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Pregunta inválida." };
  }

  const current = await prisma.question.findUnique({ where: { id } });
  if (!current) {
    return { error: "La pregunta no existe." };
  }
  if (current.lockedAt) {
    return { error: "La pregunta ya fue respondida y está bloqueada." };
  }

  const parsed = questionUpsertSchema.safeParse({
    matchId: field(fd, "matchId"),
    text: field(fd, "text"),
    option0: field(fd, "option0"),
    option1: field(fd, "option1"),
    option2: field(fd, "option2"),
    option3: field(fd, "option3"),
    correctOption: field(fd, "correctOption"),
    status: field(fd, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.question.update({
    where: { id },
    data: {
      matchId: parsed.data.matchId,
      text: parsed.data.text,
      options: [parsed.data.option0, parsed.data.option1, parsed.data.option2, parsed.data.option3],
      correctOption: parsed.data.correctOption,
      status: parsed.data.status,
    },
  });

  revalidateAdmin(["/admin/preguntas", "/admin"]);
  return { success: "Pregunta actualizada correctamente." };
}

export async function deleteQuestion(fd: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(field(fd, "id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const current = await prisma.question.findUnique({ where: { id } });
  // Guard: a locked (already answered) question cannot be deleted.
  if (!current || current.lockedAt) return;

  await prisma.question.delete({ where: { id } });

  revalidateAdmin(["/admin/preguntas", "/admin"]);
}

// ---------------------------------------------------------------------------
// Premios
// ---------------------------------------------------------------------------

export async function createPrize(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = prizeUpsertSchema.safeParse({
    position: optionalField(fd, "position"),
    name: field(fd, "name"),
    description: optionalField(fd, "description"),
    imageUrl: optionalField(fd, "imageUrl"),
    status: field(fd, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.prize.create({
    data: {
      position: parsed.data.position ?? null,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      status: parsed.data.status,
    },
  });

  revalidateAdmin(["/admin/premios", "/admin"]);
  return { success: "Premio creado correctamente." };
}

export async function updatePrize(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = Number(field(fd, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Premio inválido." };
  }

  const parsed = prizeUpsertSchema.safeParse({
    position: optionalField(fd, "position"),
    name: field(fd, "name"),
    description: optionalField(fd, "description"),
    imageUrl: optionalField(fd, "imageUrl"),
    status: field(fd, "status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.prize.update({
    where: { id },
    data: {
      position: parsed.data.position ?? null,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      status: parsed.data.status,
    },
  });

  revalidateAdmin(["/admin/premios", "/admin"]);
  return { success: "Premio actualizado correctamente." };
}

export async function deletePrize(fd: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(field(fd, "id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await prisma.prize.delete({ where: { id } });

  revalidateAdmin(["/admin/premios", "/admin"]);
}

// ---------------------------------------------------------------------------
// Configuración de puntaje (solo SUPER_ADMIN)
// ---------------------------------------------------------------------------

export async function updateScoringConfig(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = scoringConfigSchema.safeParse({
    exactPts: field(fd, "exactPts"),
    resultPts: field(fd, "resultPts"),
    triviaPts: field(fd, "triviaPts"),
    championPts: field(fd, "championPts"),
    runnerUpPts: field(fd, "runnerUpPts"),
    lockMinutes: field(fd, "lockMinutes"),
    championLockPhase: field(fd, "championLockPhase"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.scoringConfig.upsert({
    where: { id: 1 },
    update: { ...parsed.data },
    create: { id: 1, ...parsed.data },
  });

  revalidateAdmin(["/admin/tabla", "/admin"]);
  return { success: "Configuración de puntaje actualizada." };
}
