import "server-only";
import type { Phase } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recomputeMatchPoints, recomputeChampionPoints } from "@/lib/scoring";

// Integración con football-data.org (v4). Requiere FOOTBALL_DATA_TOKEN (gratuito).
// Competición FIFA World Cup => code "WC".
const BASE = "https://api.football-data.org/v4";
const COMPETITION = "WC";

type ApiTeam = {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
} | null;

type ApiMatch = {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, ...
  stage: string; // GROUP_STAGE, LAST_32, LAST_16, QUARTER_FINALS, SEMI_FINALS, THIRD_PLACE, FINAL
  group?: string | null; // "GROUP_A" | null
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score?: {
    winner?: string | null; // HOME_TEAM | AWAY_TEAM | DRAW | null
    duration?: string | null; // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
    fullTime?: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null } | null;
  } | null;
};

const STAGE_TO_PHASE: Record<string, Phase> = {
  GROUP_STAGE: "GROUP",
  LAST_32: "R32",
  ROUND_OF_32: "R32",
  LAST_16: "R16",
  ROUND_OF_16: "R16",
  QUARTER_FINALS: "QF",
  QUARTER_FINAL: "QF",
  SEMI_FINALS: "SF",
  SEMI_FINAL: "SF",
  THIRD_PLACE: "THIRD",
  FINAL: "FINAL",
};

export function isSyncConfigured(): boolean {
  return Boolean(process.env.FOOTBALL_DATA_TOKEN);
}

/**
 * ¿Hay algún partido en curso o por empezar? Se usa para que el cron solo
 * consulte la API cuando vale la pena: desde 15 min antes del kickoff hasta
 * ~4 h después (cubre prórroga, penales y demoras), o si ya está en juego.
 * Cuando no hay ventana activa, el cron no gasta peticiones a football-data.
 */
export async function hasActiveMatchWindow(now: Date = new Date()): Promise<boolean> {
  const LEAD_MS = 15 * 60_000; // empieza un poco antes del kickoff
  const TAIL_MS = 4 * 60 * 60_000; // sigue un buen rato después por si acaso
  const from = new Date(now.getTime() - TAIL_MS);
  const to = new Date(now.getTime() + LEAD_MS);

  const count = await prisma.match.count({
    where: {
      OR: [
        { status: "LIVE" },
        { status: { not: "FINISHED" }, kickoffAt: { gte: from, lte: to } },
      ],
    },
  });
  return count > 0;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z]/g, "");
}

// Aliases de nombres en inglés (football-data) -> código FIFA nuestro.
const NAME_ALIASES: Record<string, string> = {
  korearepublic: "KOR",
  southkorea: "KOR",
  czechia: "CZE",
  czechrepublic: "CZE",
  turkiye: "TUR",
  turkey: "TUR",
  cotedivoire: "CIV",
  ivorycoast: "CIV",
  iran: "IRN",
  iranislamicrepublic: "IRN",
  usa: "USA",
  unitedstates: "USA",
  netherlands: "NED",
  saudiarabia: "KSA",
  capeverde: "CPV",
  caboverde: "CPV",
  congodr: "COD",
  drcongo: "COD",
  democraticrepublicofthecongo: "COD",
  newzealand: "NZL",
  bosniaandherzegovina: "BIH",
  curacao: "CUW",
  southafrica: "RSA",
};

type Status = "SCHEDULED" | "LIVE" | "FINISHED";
function mapStatus(api: string): Status {
  if (api === "FINISHED" || api === "AWARDED") return "FINISHED";
  if (api === "IN_PLAY" || api === "PAUSED") return "LIVE";
  return "SCHEDULED";
}

export type SyncResult = {
  ok: boolean;
  message: string;
  fetched: number;
  matchesUpdated: number;
  teamsAssigned: number;
  scoresUpdated: number;
  unmatched: number;
  unknownStages: number;
  errors: number;
};

function emptyResult(ok: boolean, message: string): SyncResult {
  return {
    ok,
    message,
    fetched: 0,
    matchesUpdated: 0,
    teamsAssigned: 0,
    scoresUpdated: 0,
    unmatched: 0,
    unknownStages: 0,
    errors: 0,
  };
}

export async function syncWorldCup(): Promise<SyncResult> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return emptyResult(false, "FOOTBALL_DATA_TOKEN no está configurado.");
  }

  let apiMatches: ApiMatch[] = [];
  try {
    const res = await fetch(`${BASE}/competitions/${COMPETITION}/matches`, {
      headers: { "X-Auth-Token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      let msg = `Error de la API (${res.status}).`;
      if (res.status === 401 || res.status === 403) {
        msg = `Token o plan inválido (${res.status}). Verifica FOOTBALL_DATA_TOKEN.`;
      } else if (res.status === 429) {
        const retry = res.headers.get("Retry-After");
        msg = `Límite de peticiones alcanzado (429).${retry ? ` Reintenta en ${retry}s.` : ""}`;
      } else if (res.status >= 500) {
        msg = `La API de football-data no está disponible (${res.status}).`;
      }
      return emptyResult(false, msg);
    }
    const data = (await res.json()) as { matches?: ApiMatch[] };
    apiMatches = data.matches ?? [];
  } catch (e) {
    const err = e as Error;
    const msg =
      err.name === "TimeoutError" || err.name === "AbortError"
        ? "Tiempo de espera agotado al contactar la API."
        : `No se pudo contactar la API: ${err.message}`;
    return emptyResult(false, msg);
  }

  // Resolución de equipos: tla/nombre -> id interno.
  const teams = await prisma.team.findMany();
  const byFifa = new Map(teams.map((t) => [t.fifaCode.toUpperCase(), t.id]));
  const byName = new Map(teams.map((t) => [normalize(t.name), t.id]));

  function resolveTeam(api: ApiTeam): number | null {
    if (!api) return null;
    if (api.tla && byFifa.has(api.tla.toUpperCase())) return byFifa.get(api.tla.toUpperCase())!;
    for (const cand of [api.name, api.shortName]) {
      if (!cand) continue;
      const n = normalize(cand);
      if (NAME_ALIASES[n] && byFifa.has(NAME_ALIASES[n])) return byFifa.get(NAME_ALIASES[n])!;
      if (byName.has(n)) return byName.get(n)!;
    }
    return null;
  }

  const ourMatches = await prisma.match.findMany({ orderBy: { kickoffAt: "asc" } });

  let matchesUpdated = 0;
  let teamsAssigned = 0;
  let scoresUpdated = 0;
  let unmatched = 0;
  let unknownStages = 0;
  let errors = 0;
  const unknownStageSet = new Set<string>();
  const affectedFinished: number[] = [];
  let finalTouched = false;

  type OurMatch = (typeof ourMatches)[number];

  // Procesa el resultado de un applyUpdate/applyKnockoutUpdate aislando errores.
  async function processMatch(
    target: OurMatch,
    am: ApiMatch,
    fn: () => Promise<{ scored: boolean; finished: boolean; teamsKnown: boolean; assigned: number }>,
    phase: Phase,
  ): Promise<void> {
    try {
      const r = await fn();
      matchesUpdated++;
      teamsAssigned += r.assigned;
      scoresUpdated += r.scored ? 1 : 0;
      if (!r.teamsKnown) unmatched++;
      if (r.finished) {
        affectedFinished.push(target.id);
        if (phase === "FINAL") finalTouched = true;
      }
    } catch {
      // No abortar toda la sincronización por un fallo puntual (p.ej. colisión de externalId).
      errors++;
    }
  }

  // Agrupa partidos de la API por fase (registra stages no reconocidos).
  const apiByPhase = new Map<Phase, ApiMatch[]>();
  for (const am of apiMatches) {
    const phase = STAGE_TO_PHASE[am.stage];
    if (!phase) {
      unknownStages++;
      unknownStageSet.add(am.stage);
      continue;
    }
    const arr = apiByPhase.get(phase) ?? [];
    arr.push(am);
    apiByPhase.set(phase, arr);
  }

  // Procesa cada fase.
  for (const [phase, list] of apiByPhase) {
    const ourPhase = ourMatches.filter((m) => m.phase === phase);

    if (phase === "GROUP") {
      // Empareja por par de equipos (sin importar orden local).
      for (const am of list) {
        const h = resolveTeam(am.homeTeam);
        const a = resolveTeam(am.awayTeam);
        if (!h || !a) {
          unmatched++;
          continue;
        }
        const target = ourPhase.find(
          (m) =>
            (m.homeTeamId === h && m.awayTeamId === a) ||
            (m.homeTeamId === a && m.awayTeamId === h),
        );
        if (!target) {
          unmatched++;
          continue;
        }
        await processMatch(target, am, () => applyUpdate(target, am, h), phase);
      }
    } else {
      // Eliminatorias: ancla por externalId estable; usa orden cronológico solo
      // como primera asignación para partidos que aún no tienen externalId.
      const apiSorted = [...list].sort(
        (x, y) => new Date(x.utcDate).getTime() - new Date(y.utcDate).getTime(),
      );
      const remaining: ApiMatch[] = [];
      for (const am of apiSorted) {
        const anchored = ourPhase.find((m) => m.externalId === am.id);
        if (!anchored) {
          remaining.push(am);
          continue;
        }
        const h = resolveTeam(am.homeTeam);
        const a = resolveTeam(am.awayTeam);
        await processMatch(anchored, am, () => applyKnockoutUpdate(anchored, am, h, a), phase);
      }

      const freeTargets = ourPhase
        .filter((m) => m.externalId === null)
        .sort((x, y) => x.kickoffAt.getTime() - y.kickoffAt.getTime());
      const n = Math.min(remaining.length, freeTargets.length);
      for (let i = 0; i < n; i++) {
        const am = remaining[i];
        const target = freeTargets[i];
        const h = resolveTeam(am.homeTeam);
        const a = resolveTeam(am.awayTeam);
        await processMatch(target, am, () => applyKnockoutUpdate(target, am, h, a), phase);
      }
    }
  }

  // Recalcula puntos de los partidos finalizados (aislando errores).
  for (const id of affectedFinished) {
    try {
      await recomputeMatchPoints(id);
    } catch {
      errors++;
    }
  }
  if (finalTouched) {
    try {
      await recomputeChampionPoints();
    } catch {
      errors++;
    }
  }

  const extras: string[] = [];
  if (unmatched > 0) extras.push(`${unmatched} sin emparejar`);
  if (unknownStages > 0)
    extras.push(`${unknownStages} con fase desconocida (${[...unknownStageSet].join(", ")})`);
  if (errors > 0) extras.push(`${errors} con error`);

  return {
    ok: true,
    message:
      `Sincronización completa: ${matchesUpdated} partidos actualizados, ` +
      `${teamsAssigned} equipos asignados, ${scoresUpdated} marcadores` +
      (extras.length ? `. Avisos: ${extras.join("; ")}.` : "."),
    fetched: apiMatches.length,
    matchesUpdated,
    teamsAssigned,
    scoresUpdated,
    unmatched,
    unknownStages,
    errors,
  };
}

type Target = { id: number; homeTeamId: number | null; awayTeamId: number | null };

// Calcula el ganador de un partido finalizado (incluyendo penales en empates).
function resolveWinner(
  am: ApiMatch,
  homeId: number,
  awayId: number,
  homeScore: number,
  awayScore: number,
): number | null {
  if (homeScore > awayScore) return homeId;
  if (awayScore > homeScore) return awayId;
  // Empate en el marcador (fullTime): se decide por penales / score.winner.
  const w = am.score?.winner;
  if (w === "HOME_TEAM") return homeId;
  if (w === "AWAY_TEAM") return awayId;
  const pen = am.score?.penalties;
  if (pen && pen.home !== null && pen.away !== null) {
    return pen.home > pen.away ? homeId : awayId;
  }
  return null;
}

// Grupo: mantiene los equipos locales; alinea el marcador según orientación.
async function applyUpdate(
  target: Target,
  am: ApiMatch,
  apiHomeId: number,
): Promise<{ scored: boolean; finished: boolean; teamsKnown: boolean; assigned: number }> {
  const status = mapStatus(am.status);
  const ft = am.score?.fullTime;
  let homeScore: number | null = null;
  let awayScore: number | null = null;
  if (ft && ft.home !== null && ft.away !== null) {
    // Si nuestro "home" coincide con el "home" de la API, orientación directa.
    if (target.homeTeamId === apiHomeId) {
      homeScore = ft.home;
      awayScore = ft.away;
    } else {
      homeScore = ft.away;
      awayScore = ft.home;
    }
  }
  await prisma.match.update({
    where: { id: target.id },
    data: {
      externalId: am.id,
      status,
      homeScore,
      awayScore,
      kickoffAt: new Date(am.utcDate),
    },
  });
  return {
    scored: homeScore !== null,
    finished: status === "FINISHED" && homeScore !== null,
    teamsKnown: true,
    assigned: 0,
  };
}

// Eliminatorias: asigna equipos desde la API. Nunca marca FINISHED ni guarda
// marcador si no se conocen ambos equipos (evita estados inconsistentes).
async function applyKnockoutUpdate(
  target: Target,
  am: ApiMatch,
  homeId: number | null,
  awayId: number | null,
): Promise<{ scored: boolean; finished: boolean; teamsKnown: boolean; assigned: number }> {
  const status = mapStatus(am.status);
  const ft = am.score?.fullTime;
  const rawHome = ft && ft.home !== null ? ft.home : null;
  const rawAway = ft && ft.away !== null ? ft.away : null;

  const effHome = homeId ?? target.homeTeamId;
  const effAway = awayId ?? target.awayTeamId;
  const teamsKnown = effHome !== null && effAway !== null;
  const assigned =
    (homeId && target.homeTeamId !== homeId ? 1 : 0) +
    (awayId && target.awayTeamId !== awayId ? 1 : 0);

  const data: {
    externalId: number;
    kickoffAt: Date;
    homeTeamId?: number;
    awayTeamId?: number;
    status?: Status;
    homeScore?: number | null;
    awayScore?: number | null;
    winnerTeamId?: number | null;
  } = {
    externalId: am.id,
    kickoffAt: new Date(am.utcDate),
  };
  if (homeId) data.homeTeamId = homeId;
  if (awayId) data.awayTeamId = awayId;

  let scored = false;
  let finished = false;

  if (teamsKnown && rawHome !== null && rawAway !== null) {
    data.status = status;
    data.homeScore = rawHome;
    data.awayScore = rawAway;
    data.winnerTeamId =
      status === "FINISHED" ? resolveWinner(am, effHome!, effAway!, rawHome, rawAway) : null;
    scored = true;
    finished = status === "FINISHED";
  } else if (teamsKnown) {
    // Equipos conocidos pero sin marcador: no marcar FINISHED todavía.
    data.status = status === "FINISHED" ? "SCHEDULED" : status;
  }
  // Si los equipos no se conocen, no se toca status/marcador (solo externalId/fecha).

  await prisma.match.update({ where: { id: target.id }, data });
  return { scored, finished, teamsKnown, assigned };
}
