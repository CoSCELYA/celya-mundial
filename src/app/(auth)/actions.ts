"use server";

import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { loginSchema, registerSchema, forgotSchema, resetSchema } from "@/lib/validations";
import { sendMail, resetEmail } from "@/lib/mailer";

export type ActionState = { error?: string; success?: string } | null;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Correo o contraseña incorrectos." };
  }
  if (user.status === "PENDING") {
    return { error: "Tu cuenta está pendiente de aprobación por un administrador." };
  }
  if (user.status === "INACTIVE") {
    return { error: "Tu cuenta está inactiva. Contacta al administrador." };
  }

  await setSessionCookie({
    userId: user.id,
    role: user.role,
    status: user.status,
    name: user.fullName,
    email: user.email,
  });

  redirect(user.role === "EMPLEADO" ? "/" : "/admin");
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    documento: formData.get("documento"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Ya existe una cuenta con este correo." };
  }

  await prisma.user.create({
    data: {
      fullName: parsed.data.fullName,
      documento: parsed.data.documento || null,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "EMPLEADO",
      status: "PENDING",
    },
  });

  return {
    success:
      "¡Registro recibido! Tu cuenta quedó pendiente de aprobación. Te avisaremos cuando esté activa.",
  };
}

export async function forgotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond the same way to avoid account enumeration.
  if (user) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt },
    });
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const url = `${base}/reset-password?token=${token}`;
    const { subject, html, text } = resetEmail(user.fullName, url);
    await sendMail({ to: user.email, subject, html, text });
  }

  return {
    success:
      "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.",
  };
}

export async function resetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const tokenHash = sha256(parsed.data.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "El enlace es inválido o expiró. Solicita uno nuevo." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: "Tu contraseña fue actualizada. Ya puedes iniciar sesión." };
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
