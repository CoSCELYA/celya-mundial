import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Next.js 16: middleware is now "proxy". This runs on the Edge runtime,
// so it only verifies the signed session cookie (no DB access). Layouts do
// the authoritative role/status checks.

const SESSION_COOKIE = "polla_session";

const PUBLIC_PATHS = ["/login", "/register"];

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

type Payload = { role?: string; status?: string };

async function readSession(req: NextRequest): Promise<Payload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as Payload;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const session = await readSession(req);

  // Logged-in users shouldn't see auth pages.
  if (isPublic) {
    if (session) {
      const url = req.nextUrl.clone();
      url.pathname = session.role === "EMPLEADO" ? "/" : "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // All other matched routes require a valid session.
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Admin area requires an admin role.
  if (pathname.startsWith("/admin")) {
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logos|.*\\..*).*)"],
};
