import { NextResponse, type NextRequest } from "next/server";
import { syncWorldCup } from "@/lib/football-data";

export const dynamic = "force-dynamic";

// Endpoint para sincronización programada (cron de Railway).
// Protección: cabecera Authorization: Bearer <CRON_SECRET> o ?key=<CRON_SECRET>.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Falla cerrado: sin secreto configurado el endpoint no se expone.
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Sincronización no configurada (falta CRON_SECRET)." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? key;
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const result = await syncWorldCup();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
