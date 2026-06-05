"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { loginSchema, registerSchema } from "@/lib/validations";

export type ActionState = { error?: string; success?: string } | null;

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
  if (user.status === "INACTIVE") {
    return { error: "Tu cuenta está inactiva. Contacta al administrador." };
  }

  await setSessionCookie({
    userId: user.id,
    role: user.role,
    status: "ACTIVE",
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

  const user = await prisma.user.create({
    data: {
      fullName: parsed.data.fullName,
      documento: parsed.data.documento || null,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "EMPLEADO",
      status: "ACTIVE",
    },
  });

  // Acceso inmediato: el control de quién participa es interno (dominio @celya.co).
  await setSessionCookie({
    userId: user.id,
    role: user.role,
    status: "ACTIVE",
    name: user.fullName,
    email: user.email,
  });

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
