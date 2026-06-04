import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getSession, type SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/db";

const ADMIN_ROLES: Role[] = ["ADMIN", "SUPER_ADMIN"];

/** Require any authenticated, ACTIVE session. Redirects to /login otherwise. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.status !== "ACTIVE") redirect("/login?estado=inactivo");
  return session;
}

/** Require an admin-level session (ADMIN or SUPER_ADMIN). */
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

/** Fetch the full user record for the current session, or null. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}
