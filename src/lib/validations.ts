import { z } from "zod";

const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN ?? "celya.co";

export const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const registerSchema = z.object({
  fullName: z.string().min(3, "Ingresa tu nombre completo"),
  documento: z.string().optional(),
  email: z
    .string()
    .email("Correo inválido")
    .refine((e) => e.toLowerCase().endsWith(`@${allowedDomain}`), {
      message: `El correo debe ser del dominio @${allowedDomain}`,
    }),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const forgotSchema = z.object({
  email: z.string().email("Correo inválido"),
});

export const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const scoreSchema = z.object({
  homeScore: z.coerce.number().int().min(0).max(99),
  awayScore: z.coerce.number().int().min(0).max(99),
});

export const championSchema = z.object({
  championTeamId: z.coerce.number().int().positive(),
  runnerUpTeamId: z.coerce.number().int().positive(),
});

export const userUpsertSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  documento: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "EMPLEADO"]),
  status: z.enum(["PENDING", "ACTIVE", "INACTIVE"]),
});

export const matchUpsertSchema = z.object({
  phase: z.enum(["GROUP", "R32", "R16", "QF", "SF", "THIRD", "FINAL"]),
  groupName: z.string().optional(),
  homeTeamId: z.coerce.number().int().optional(),
  awayTeamId: z.coerce.number().int().optional(),
  kickoffAt: z.string().min(1),
  venue: z.string().optional(),
});

export const questionUpsertSchema = z.object({
  matchId: z.coerce.number().int().positive(),
  text: z.string().min(3),
  option0: z.string().min(1),
  option1: z.string().min(1),
  option2: z.string().min(1),
  option3: z.string().min(1),
  correctOption: z.coerce.number().int().min(0).max(3),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const prizeUpsertSchema = z.object({
  position: z.coerce.number().int().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const scoringConfigSchema = z.object({
  exactPts: z.coerce.number().int().min(0),
  resultPts: z.coerce.number().int().min(0),
  triviaPts: z.coerce.number().int().min(0),
  championPts: z.coerce.number().int().min(0),
  runnerUpPts: z.coerce.number().int().min(0),
  lockMinutes: z.coerce.number().int().min(0),
  championLockPhase: z.enum(["GROUP", "R32", "R16", "QF", "SF", "THIRD", "FINAL"]),
});
