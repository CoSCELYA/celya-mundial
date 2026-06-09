import { NextResponse, type NextRequest } from "next/server";
import { syncWorldCup, hasActiveMatchWindow } from "@/lib/football-data";

export const dynamic = "force-dynamic";

// Endpoint para sincronización programada (cron cada 15 min).
// Protección: cabecera Authorization: Bearer <CRON_SECRET> o ?key=<CRON_SECRET>.
// Por defecto solo consulta la API si hay un partido en curso/por empezar;
// usa ?force=1 para forzar una sincronización completa.
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

  // Ahorra peticiones: si no hay partido en ventana, no se consulta la API.
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!force && !(await hasActiveMatchWindow())) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: "Sin partidos en curso; no se consultó la API.",
    });
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
