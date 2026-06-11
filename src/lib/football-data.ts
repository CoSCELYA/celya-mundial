import "server-only";
import type { Match, Phase } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  recomputeMatchPoints,
  recomputeChampionPoints,
  type RecomputeMatchPointsResult,
} from "@/lib/scoring";

// Integracion con football-data.org (v4). Requiere FOOTBALL_DATA_TOKEN.
// Competicion FIFA World Cup => code "WC".
const BASE = "https://api.football-data.org/v4";
const COMPETITION = "WC";

const ACTIVE_LEAD_MS = 15 * 60_000;
const ACTIVE_TAIL_MS = 4 * 60 * 60_000;

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

type ApiMatchPayload = { matches?: ApiMatch[]; match?: ApiMatch };

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

export async function hasActiveMatchWindow(now: Date = new Date()): Promise<boolean> {
  return (await getCurrentSyncTarget(now)) !== null;
}

async function getCurrentSyncTarget(now: Date = new Date()) {
  const live = await prisma.match.findFirst({
    where: { status: "LIVE" },
    orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
  });
  if (live) return live;

  const from = new Date(now.getTime() - ACTIVE_TAIL_MS);
  const to = new Date(now.getTime() + ACTIVE_LEAD_MS);

  return prisma.match.findFirst({
    where: {
      status: { not: "FINISHED" },
      kickoffAt: { gte: from, lte: to },
    },
    orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
  });
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

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
  predictionsScored: number;
  pointsEntriesCreated: number;
  totalPointsCreated: number;
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
    predictionsScored: 0,
    pointsEntriesCreated: 0,
    totalPointsCreated: 0,
    unmatched: 0,
    unknownStages: 0,
    errors: 0,
  };
}

type FetchResult =
  | { ok: true; matches: ApiMatch[] }
  | { ok: false; result: SyncResult };

async function fetchApiMatches(token: string, url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: { "X-Auth-Token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      let msg = `Error de la API (${res.status}).`;
      if (res.status === 401 || res.status === 403) {
        msg = `Token o plan invalido (${res.status}). Verifica FOOTBALL_DATA_TOKEN.`;
      } else if (res.status === 429) {
        const retry = res.headers.get("Retry-After");
        msg = `Limite de peticiones alcanzado (429).${retry ? ` Reintenta en ${retry}s.` : ""}`;
      } else if (res.status >= 500) {
        msg = `La API de football-data no esta disponible (${res.status}).`;
      }
      return { ok: false, result: emptyResult(false, msg) };
    }
    const data = (await res.json()) as ApiMatchPayload;
    return { ok: true, matches: data.match ? [data.match] : data.matches ?? [] };
  } catch (e) {
    const err = e as Error;
    const msg =
      err.name === "TimeoutError" || err.name === "AbortError"
        ? "Tiempo de espera agotado al contactar la API."
        : `No se pudo contactar la API: ${err.message}`;
    return { ok: false, result: emptyResult(false, msg) };
  }
}

type TeamResolver = (api: ApiTeam) => number | null;

async function createTeamResolver(): Promise<TeamResolver> {
  const teams = await prisma.team.findMany();
  const byFifa = new Map(teams.map((t) => [t.fifaCode.toUpperCase(), t.id]));
  const byName = new Map(teams.map((t) => [normalize(t.name), t.id]));

  return (api: ApiTeam): number | null => {
    if (!api) return null;
    if (api.tla && byFifa.has(api.tla.toUpperCase())) return byFifa.get(api.tla.toUpperCase())!;
    for (const cand of [api.name, api.shortName]) {
      if (!cand) continue;
      const n = normalize(cand);
      if (NAME_ALIASES[n] && byFifa.has(NAME_ALIASES[n])) return byFifa.get(NAME_ALIASES[n])!;
      if (byName.has(n)) return byName.get(n)!;
    }
    return null;
  };
}

function apiDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type Target = Pick<
  Match,
  | "id"
  | "externalId"
  | "phase"
  | "homeTeamId"
  | "awayTeamId"
  | "kickoffAt"
  | "status"
  | "homeScore"
  | "awayScore"
>;

type ApplyResult = {
  hasScore: boolean;
  shouldRecompute: boolean;
  finished: boolean;
  teamsKnown: boolean;
  assigned: number;
};

function hasStoredScore(target: Target): boolean {
  return target.homeScore !== null && target.awayScore !== null;
}

function emptyScoring(): RecomputeMatchPointsResult {
  return {
    hasScore: false,
    predictionsScored: 0,
    pointsEntriesCreated: 0,
    totalPointsCreated: 0,
  };
}

async function recomputeStoredScore(
  matchId: number,
  context: string,
): Promise<{ scoring: RecomputeMatchPointsResult; errors: number }> {
  try {
    const scoring = await recomputeMatchPoints(matchId);
    return { scoring, errors: 0 };
  } catch (error) {
    console.error(`[sync] Error recalculando puntos (${context})`, error);
    return { scoring: emptyScoring(), errors: 1 };
  }
}

async function canAssignExternalId(targetId: number, externalId: number): Promise<boolean> {
  const conflict = await prisma.match.findFirst({
    where: { externalId, NOT: { id: targetId } },
    select: { id: true },
  });
  return conflict === null;
}

function findApiMatchForTarget(
  target: Target,
  apiMatches: ApiMatch[],
  resolveTeam: TeamResolver,
): ApiMatch | null {
  if (target.externalId) {
    return apiMatches.find((m) => m.id === target.externalId) ?? null;
  }

  const samePhase = apiMatches.filter((m) => STAGE_TO_PHASE[m.stage] === target.phase);

  if (target.phase === "GROUP" && target.homeTeamId && target.awayTeamId) {
    const byTeams = samePhase.find((m) => {
      const h = resolveTeam(m.homeTeam);
      const a = resolveTeam(m.awayTeam);
      return (
        (h === target.homeTeamId && a === target.awayTeamId) ||
        (h === target.awayTeamId && a === target.homeTeamId)
      );
    });
    if (byTeams) return byTeams;
  }

  const closest = samePhase
    .map((m) => ({
      match: m,
      delta: Math.abs(new Date(m.utcDate).getTime() - target.kickoffAt.getTime()),
    }))
    .sort((a, b) => a.delta - b.delta)[0];

  return closest && closest.delta <= ACTIVE_TAIL_MS ? closest.match : null;
}

export async function syncCurrentWorldCupMatch(now: Date = new Date()): Promise<SyncResult> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return emptyResult(false, "FOOTBALL_DATA_TOKEN no esta configurado.");
  }

  const target = await getCurrentSyncTarget(now);
  if (!target) {
    return emptyResult(true, "Sin partido actual; no se consulto la API.");
  }

  const url = target.externalId
    ? `${BASE}/matches/${target.externalId}`
    : `${BASE}/competitions/${COMPETITION}/matches?dateFrom=${apiDate(
        target.kickoffAt,
      )}&dateTo=${apiDate(target.kickoffAt)}`;

  const fetched = await fetchApiMatches(token, url);
  if (!fetched.ok) {
    if (hasStoredScore(target)) {
      const { scoring, errors } = await recomputeStoredScore(target.id, "api-error");
      return {
        ...fetched.result,
        message: `${fetched.result.message} Se recalculo el marcador local guardado.`,
        predictionsScored: scoring.predictionsScored,
        pointsEntriesCreated: scoring.pointsEntriesCreated,
        totalPointsCreated: scoring.totalPointsCreated,
        errors: fetched.result.errors + errors,
      };
    }
    return fetched.result;
  }

  const resolveTeam = await createTeamResolver();
  const apiMatch = findApiMatchForTarget(target, fetched.matches, resolveTeam);
  if (!apiMatch) {
    if (hasStoredScore(target)) {
      const { scoring, errors } = await recomputeStoredScore(target.id, "api-unmatched");
      return {
        ...emptyResult(errors === 0, "No se encontro en la API el partido actual; se recalculo el marcador local guardado."),
        fetched: fetched.matches.length,
        predictionsScored: scoring.predictionsScored,
        pointsEntriesCreated: scoring.pointsEntriesCreated,
        totalPointsCreated: scoring.totalPointsCreated,
        unmatched: 1,
        errors,
      };
    }
    return {
      ...emptyResult(true, "No se encontro en la API el partido actual."),
      fetched: fetched.matches.length,
      unmatched: 1,
    };
  }

  const phase = STAGE_TO_PHASE[apiMatch.stage];
  if (!phase) {
    if (hasStoredScore(target)) {
      const { scoring, errors } = await recomputeStoredScore(target.id, "unknown-stage");
      return {
        ...emptyResult(errors === 0, `Fase desconocida en la API: ${apiMatch.stage}. Se recalculo el marcador local guardado.`),
        fetched: fetched.matches.length,
        predictionsScored: scoring.predictionsScored,
        pointsEntriesCreated: scoring.pointsEntriesCreated,
        totalPointsCreated: scoring.totalPointsCreated,
        unknownStages: 1,
        errors,
      };
    }
    return {
      ...emptyResult(true, `Fase desconocida en la API: ${apiMatch.stage}.`),
      fetched: fetched.matches.length,
      unknownStages: 1,
    };
  }

  const h = resolveTeam(apiMatch.homeTeam);
  const a = resolveTeam(apiMatch.awayTeam);
  let result: ApplyResult;

  if (target.phase === "GROUP") {
    if (!h || !a) {
      if (hasStoredScore(target)) {
        const { scoring, errors } = await recomputeStoredScore(target.id, "teams-unmatched");
        return {
          ...emptyResult(errors === 0, "No se pudieron emparejar los equipos del partido actual; se recalculo el marcador local guardado."),
          fetched: fetched.matches.length,
          predictionsScored: scoring.predictionsScored,
          pointsEntriesCreated: scoring.pointsEntriesCreated,
          totalPointsCreated: scoring.totalPointsCreated,
          unmatched: 1,
          errors,
        };
      }
      return {
        ...emptyResult(true, "No se pudieron emparejar los equipos del partido actual."),
        fetched: fetched.matches.length,
        unmatched: 1,
      };
    }
    result = await applyUpdate(target, apiMatch, h);
  } else {
    result = await applyKnockoutUpdate(target, apiMatch, h, a);
  }

  let errors = 0;
  let scoring = emptyScoring();
  if (result.shouldRecompute) {
    const recomputed = await recomputeStoredScore(target.id, "api-match");
    scoring = recomputed.scoring;
    errors += recomputed.errors;
  }
  if (target.phase === "FINAL" && result.hasScore) {
    try {
      await recomputeChampionPoints();
    } catch (error) {
      console.error("[sync] Error recalculando campeon/subcampeon", error);
      errors++;
    }
  }

  return {
    ok: true,
    message:
      `Sincronizacion del partido actual completa: ${result.hasScore ? 1 : 0} marcador` +
      (errors > 0 ? `. Avisos: ${errors} con error.` : "."),
    fetched: fetched.matches.length,
    matchesUpdated: 1,
    teamsAssigned: result.assigned,
    scoresUpdated: result.hasScore ? 1 : 0,
    predictionsScored: scoring.predictionsScored,
    pointsEntriesCreated: scoring.pointsEntriesCreated,
    totalPointsCreated: scoring.totalPointsCreated,
    unmatched: result.teamsKnown ? 0 : 1,
    unknownStages: 0,
    errors,
  };
}

export async function syncWorldCup(): Promise<SyncResult> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return emptyResult(false, "FOOTBALL_DATA_TOKEN no esta configurado.");
  }

  const fetched = await fetchApiMatches(token, `${BASE}/competitions/${COMPETITION}/matches`);
  if (!fetched.ok) return fetched.result;

  const resolveTeam = await createTeamResolver();
  const ourMatches = await prisma.match.findMany({ orderBy: { kickoffAt: "asc" } });

  let matchesUpdated = 0;
  let teamsAssigned = 0;
  let scoresUpdated = 0;
  let predictionsScored = 0;
  let pointsEntriesCreated = 0;
  let totalPointsCreated = 0;
  let unmatched = 0;
  let unknownStages = 0;
  let errors = 0;
  const unknownStageSet = new Set<string>();
  const affectedForPoints = new Set<number>();
  let finalTouched = false;

  type OurMatch = (typeof ourMatches)[number];

  async function processMatch(
    target: OurMatch,
    am: ApiMatch,
    fn: () => Promise<ApplyResult>,
    phase: Phase,
  ): Promise<void> {
    try {
      const r = await fn();
      matchesUpdated++;
      teamsAssigned += r.assigned;
      scoresUpdated += r.hasScore ? 1 : 0;
      if (!r.teamsKnown) unmatched++;
      if (r.shouldRecompute) affectedForPoints.add(target.id);
      if (phase === "FINAL" && r.hasScore) finalTouched = true;
    } catch {
      errors++;
    }
  }

  const apiByPhase = new Map<Phase, ApiMatch[]>();
  for (const am of fetched.matches) {
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

  for (const [phase, list] of apiByPhase) {
    const ourPhase = ourMatches.filter((m) => m.phase === phase);

    if (phase === "GROUP") {
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

  for (const id of affectedForPoints) {
    try {
      const scoring = await recomputeMatchPoints(id);
      predictionsScored += scoring.predictionsScored;
      pointsEntriesCreated += scoring.pointsEntriesCreated;
      totalPointsCreated += scoring.totalPointsCreated;
    } catch (error) {
      console.error("[sync] Error recalculando puntos en sync completo", error);
      errors++;
    }
  }
  if (finalTouched) {
    try {
      await recomputeChampionPoints();
    } catch (error) {
      console.error("[sync] Error recalculando campeon/subcampeon en sync completo", error);
      errors++;
    }
  }

  const extras: string[] = [];
  if (unmatched > 0) extras.push(`${unmatched} sin emparejar`);
  if (unknownStages > 0)
    extras.push(`${unknownStages} con fase desconocida (${[...unknownStageSet].join(", ")})`);
  if (errors > 0) extras.push(`${errors} con error`);

  return {
    ok: errors === 0,
    message:
      `Sincronizacion completa: ${matchesUpdated} partidos actualizados, ` +
      `${teamsAssigned} equipos asignados, ${scoresUpdated} marcadores` +
      (extras.length ? `. Avisos: ${extras.join("; ")}.` : "."),
    fetched: fetched.matches.length,
    matchesUpdated,
    teamsAssigned,
    scoresUpdated,
    predictionsScored,
    pointsEntriesCreated,
    totalPointsCreated,
    unmatched,
    unknownStages,
    errors,
  };
}

function resolveWinner(
  am: ApiMatch,
  homeId: number,
  awayId: number,
  homeScore: number,
  awayScore: number,
): number | null {
  if (homeScore > awayScore) return homeId;
  if (awayScore > homeScore) return awayId;
  const w = am.score?.winner;
  if (w === "HOME_TEAM") return homeId;
  if (w === "AWAY_TEAM") return awayId;
  const pen = am.score?.penalties;
  if (pen && pen.home !== null && pen.away !== null) {
    return pen.home > pen.away ? homeId : awayId;
  }
  return null;
}

async function applyUpdate(
  target: Target,
  am: ApiMatch,
  apiHomeId: number,
): Promise<ApplyResult> {
  const status = mapStatus(am.status);
  const ft = am.score?.fullTime;
  let homeScore: number | null = null;
  let awayScore: number | null = null;
  if (ft && ft.home !== null && ft.away !== null) {
    if (target.homeTeamId === apiHomeId) {
      homeScore = ft.home;
      awayScore = ft.away;
    } else {
      homeScore = ft.away;
      awayScore = ft.home;
    }
  }

  const hasScore = homeScore !== null && awayScore !== null;
  const hadScore = target.homeScore !== null && target.awayScore !== null;

  const data: {
    externalId?: number;
    status: Status;
    kickoffAt: Date;
    homeScore?: number;
    awayScore?: number;
  } = {
    status,
    kickoffAt: new Date(am.utcDate),
  };
  if (await canAssignExternalId(target.id, am.id)) {
    data.externalId = am.id;
  }
  if (hasScore) {
    data.homeScore = homeScore!;
    data.awayScore = awayScore!;
  }

  await prisma.match.update({ where: { id: target.id }, data });
  return {
    hasScore,
    shouldRecompute: hasScore || hadScore,
    finished: status === "FINISHED" && hasScore,
    teamsKnown: true,
    assigned: 0,
  };
}

async function applyKnockoutUpdate(
  target: Target,
  am: ApiMatch,
  homeId: number | null,
  awayId: number | null,
): Promise<ApplyResult> {
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
  const hadScore = target.homeScore !== null && target.awayScore !== null;

  const data: {
    externalId?: number;
    kickoffAt: Date;
    homeTeamId?: number;
    awayTeamId?: number;
    status?: Status;
    homeScore?: number | null;
    awayScore?: number | null;
    winnerTeamId?: number | null;
  } = { kickoffAt: new Date(am.utcDate) };
  if (await canAssignExternalId(target.id, am.id)) {
    data.externalId = am.id;
  }
  if (homeId) data.homeTeamId = homeId;
  if (awayId) data.awayTeamId = awayId;

  let hasScore = false;
  let finished = false;

  if (teamsKnown && rawHome !== null && rawAway !== null) {
    data.status = status;
    data.homeScore = rawHome;
    data.awayScore = rawAway;
    data.winnerTeamId =
      status === "FINISHED" ? resolveWinner(am, effHome!, effAway!, rawHome, rawAway) : null;
    hasScore = true;
    finished = status === "FINISHED";
  } else if (teamsKnown) {
    data.status = status === "FINISHED" ? "SCHEDULED" : status;
  }

  await prisma.match.update({ where: { id: target.id }, data });
  return {
    hasScore,
    shouldRecompute: hasScore || (teamsKnown && hadScore),
    finished,
    teamsKnown,
    assigned,
  };
}
