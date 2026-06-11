import { NextResponse, type NextRequest } from "next/server";
import { syncCurrentWorldCupMatch, syncWorldCup } from "@/lib/football-data";

export const dynamic = "force-dynamic";

// Endpoint para sincronizacion programada (cron cada 15 min).
// Proteccion: cabecera Authorization: Bearer <CRON_SECRET> o ?key=<CRON_SECRET>.
// Por defecto solo consulta la API para el partido actual.
// Usa ?force=1 para forzar una sincronizacion completa.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Falla cerrado: sin secreto configurado el endpoint no se expone.
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Sincronizacion no configurada (falta CRON_SECRET)." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? key;
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const result = force ? await syncWorldCup() : await syncCurrentWorldCupMatch();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
