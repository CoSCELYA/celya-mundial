import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

// Limpia la cookie de sesión y vuelve al login. Se usa cuando una cuenta
// queda inactiva: garantiza que la sesión se cierre sin bucle de redirección.
export function GET(req: NextRequest) {
  const reason = req.nextUrl.searchParams.get("estado");
  const url = new URL(reason ? `/login?estado=${reason}` : "/login", req.url);
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
