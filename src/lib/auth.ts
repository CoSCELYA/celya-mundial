import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getSession, type SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/db";

// El único rol administrador es SUPER_ADMIN; el resto son empleados.
const ADMIN_ROLES: Role[] = ["SUPER_ADMIN"];

/**
 * Require an authenticated, ACTIVE session. Validates status/role against the
 * database on every call so deactivating a user takes effect immediately
 * (even if their JWT cookie is still valid).
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { status: true, role: true, fullName: true, email: true },
  });
  // Cuenta inactiva o inexistente: cerrar sesión (borra la cookie) y volver al login.
  if (!user || user.status !== "ACTIVE") redirect("/api/logout?estado=inactivo");

  return {
    ...session,
    status: user.status,
    role: user.role,
    name: user.fullName,
    email: user.email,
  };
}

/** Require an admin-level session (SUPER_ADMIN). */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!ADMIN_ROLES.includes(session.role)) redirect("/");
  return session;
}

/** Require the SUPER_ADMIN role. */
export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "SUPER_ADMIN") redirect("/admin");
  return session;
}

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

/** Fetch the user record for the current session (without passwordHash), or null. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    omit: { passwordHash: true },
  });
}
