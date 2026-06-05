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
  score?: { fullTime?: { home: number | null; away: number | null } } | null;
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
};

export async function syncWorldCup(): Promise<SyncResult> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return {
      ok: false,
      message: "FOOTBALL_DATA_TOKEN no está configurado.",
      fetched: 0,
      matchesUpdated: 0,
      teamsAssigned: 0,
      scoresUpdated: 0,
      unmatched: 0,
    };
  }

  let apiMatches: ApiMatch[] = [];
  try {
    const res = await fetch(`${BASE}/competitions/${COMPETITION}/matches`, {
      headers: { "X-Auth-Token": token },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `Error de la API (${res.status}). Verifica el token o el plan.`,
        fetched: 0,
        matchesUpdated: 0,
        teamsAssigned: 0,
        scoresUpdated: 0,
        unmatched: 0,
      };
    }
    const data = (await res.json()) as { matches?: ApiMatch[] };
    apiMatches = data.matches ?? [];
  } catch (e) {
    return {
      ok: false,
      message: `No se pudo contactar la API: ${(e as Error).message}`,
      fetched: 0,
      matchesUpdated: 0,
      teamsAssigned: 0,
      scoresUpdated: 0,
      unmatched: 0,
    };
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
  const affectedFinished: number[] = [];
  let finalTouched = false;

  // Agrupa partidos de la API por fase.
  const apiByPhase = new Map<Phase, ApiMatch[]>();
  for (const am of apiMatches) {
    const phase = STAGE_TO_PHASE[am.stage];
    if (!phase) continue;
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
        const updated = await applyUpdate(target.id, am, h, a, target.homeTeamId);
        matchesUpdated++;
        scoresUpdated += updated.scored ? 1 : 0;
        if (updated.finished) affectedFinished.push(target.id);
      }
    } else {
      // Eliminatorias: empareja por orden cronológico (índice por fecha).
      const apiSorted = [...list].sort(
        (x, y) => new Date(x.utcDate).getTime() - new Date(y.utcDate).getTime(),
      );
      const ourSorted = [...ourPhase].sort(
        (x, y) => x.kickoffAt.getTime() - y.kickoffAt.getTime(),
      );
      const n = Math.min(apiSorted.length, ourSorted.length);
      for (let i = 0; i < n; i++) {
        const am = apiSorted[i];
        const target = ourSorted[i];
        const h = resolveTeam(am.homeTeam);
        const a = resolveTeam(am.awayTeam);
        // Asigna equipos de eliminatorias cuando se definan.
        const assigned =
          (h && target.homeTeamId !== h ? 1 : 0) + (a && target.awayTeamId !== a ? 1 : 0);
        teamsAssigned += assigned;
        const updated = await applyKnockoutUpdate(target.id, am, h, a);
        matchesUpdated++;
        scoresUpdated += updated.scored ? 1 : 0;
        if (updated.finished) {
          affectedFinished.push(target.id);
          if (phase === "FINAL") finalTouched = true;
        }
      }
    }
  }

  // Recalcula puntos de los partidos finalizados.
  for (const id of affectedFinished) {
    await recomputeMatchPoints(id);
  }
  if (finalTouched) await recomputeChampionPoints();

  return {
    ok: true,
    message: `Sincronización completa: ${matchesUpdated} partidos actualizados, ${teamsAssigned} equipos asignados, ${scoresUpdated} marcadores.`,
    fetched: apiMatches.length,
    matchesUpdated,
    teamsAssigned,
    scoresUpdated,
    unmatched,
  };
}

// Grupo: mantiene los equipos locales; alinea el marcador según orientación.
async function applyUpdate(
  matchId: number,
  am: ApiMatch,
  apiHomeId: number,
  apiAwayId: number,
  ourHomeId: number | null,
): Promise<{ scored: boolean; finished: boolean }> {
  const status = mapStatus(am.status);
  const ft = am.score?.fullTime;
  let homeScore: number | null = null;
  let awayScore: number | null = null;
  if (ft && ft.home !== null && ft.away !== null) {
    // Si nuestro "home" coincide con el "home" de la API, orientación directa.
    if (ourHomeId === apiHomeId) {
      homeScore = ft.home;
      awayScore = ft.away;
    } else {
      homeScore = ft.away;
      awayScore = ft.home;
    }
  }
  await prisma.match.update({
    where: { id: matchId },
    data: {
      externalId: am.id,
      status,
      homeScore,
      awayScore,
      kickoffAt: new Date(am.utcDate),
    },
  });
  return { scored: homeScore !== null, finished: status === "FINISHED" && homeScore !== null };
}

// Eliminatorias: asigna equipos directamente desde la API.
async function applyKnockoutUpdate(
  matchId: number,
  am: ApiMatch,
  homeId: number | null,
  awayId: number | null,
): Promise<{ scored: boolean; finished: boolean }> {
  const status = mapStatus(am.status);
  const ft = am.score?.fullTime;
  const homeScore = ft && ft.home !== null ? ft.home : null;
  const awayScore = ft && ft.away !== null ? ft.away : null;
  await prisma.match.update({
    where: { id: matchId },
    data: {
      externalId: am.id,
      status,
      homeTeamId: homeId ?? undefined,
      awayTeamId: awayId ?? undefined,
      homeScore,
      awayScore,
      kickoffAt: new Date(am.utcDate),
    },
  });
  return {
    scored: homeScore !== null && awayScore !== null,
    finished: status === "FINISHED" && homeScore !== null && awayScore !== null,
  };
}
