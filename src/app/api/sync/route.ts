import { NextResponse, type NextRequest } from "next/server";
import { syncWorldCup } from "@/lib/football-data";

export const dynamic = "force-dynamic";

// Endpoint para sincronizacion programada (cron cada 15 min).
// Proteccion: cabecera Authorization: Bearer <CRON_SECRET> o ?key=<CRON_SECRET>.
// Hace una sincronizacion completa (una sola llamada a la API): asigna equipos
// y fechas de eliminatorias, actualiza marcadores y recalcula solo lo que
// cambio. Es rapida porque no reprocesa partidos cuyo marcador no cambio.
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

  const result = await syncWorldCup();
  console.info("[sync]", {
    ok: result.ok,
    message: result.message,
    fetched: result.fetched,
    matchesUpdated: result.matchesUpdated,
    scoresUpdated: result.scoresUpdated,
    predictionsScored: result.predictionsScored,
    pointsEntriesCreated: result.pointsEntriesCreated,
    totalPointsCreated: result.totalPointsCreated,
    unmatched: result.unmatched,
    unknownStages: result.unknownStages,
    errors: result.errors,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
