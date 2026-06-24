import "server-only";
import type { Match, Phase } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  recomputeMatchPoints,
  recomputeChampionPoints,
  recomputeClosedTriviaPoints,
  type RecomputeMatchPointsResult,
} from "@/lib/scoring";

// Integracion con football-data.org (v4). Requiere FOOTBALL_DATA_TOKEN.
// Competicion FIFA World Cup => code "WC".
const BASE = "https://api.football-data.org/v4";
const COMPETITION = "WC";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

const ACTIVE_LEAD_MS = 15 * 60_000;
const ACTIVE_TAIL_MS = 4 * 60 * 60_000;
const ESPN_FINISHED_TAIL_MS = 24 * 60 * 60_000;

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

type EspnCompetitor = {
  homeAway: "home" | "away";
  score?: string | number | null;
  team?: {
    abbreviation?: string | null;
    displayName?: string | null;
    name?: string | null;
  } | null;
};

type EspnEvent = {
  id: string;
  date: string;
  status?: {
    type?: {
      state?: "pre" | "in" | "post";
      completed?: boolean;
    } | null;
  } | null;
  competitions?: Array<{
    competitors?: EspnCompetitor[];
  }>;
};

type EspnScoreboardPayload = { events?: EspnEvent[] };

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

/**
 * Todos los partidos activos en este momento: en juego (LIVE) o dentro de la
 * ventana de sincronización. Sirve para detectar partidos simultáneos, que el
 * sync por-partido no podría cubrir (solo atiende uno por corrida).
 */
async function countActiveSyncTargets(now: Date = new Date()): Promise<number> {
  const from = new Date(now.getTime() - ACTIVE_TAIL_MS);
  const to = new Date(now.getTime() + ACTIVE_LEAD_MS);
  return prisma.match.count({
    where: {
      status: { not: "FINISHED" },
      OR: [{ status: "LIVE" }, { kickoffAt: { gte: from, lte: to } }],
    },
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

function mapEspnStatus(event: EspnEvent): Status {
  const state = event.status?.type?.state;
  if (event.status?.type?.completed || state === "post") return "FINISHED";
  if (state === "in") return "LIVE";
  return "SCHEDULED";
}

export type SyncResult = {
  ok: boolean;
  message: string;
  source?: "football-data" | "espn-fallback" | "local-score";
  selectedMatch?: {
    id: number;
    externalId: number | null;
    phase: Phase;
    homeTeamId: number | null;
    awayTeamId: number | null;
    kickoffAt: string;
    status: Status;
    storedScore: string | null;
  };
  appliedScore?: string | null;
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

async function withClosedTrivia(
  result: SyncResult,
  now: Date,
  excludeMatchIds: number[] = [],
): Promise<SyncResult> {
  const trivia = await recomputeClosedTriviaPoints(now, excludeMatchIds);
  if (
    trivia.matchesChecked === 0 &&
    trivia.pointsEntriesCreated === 0 &&
    trivia.totalPointsCreated === 0 &&
    trivia.errors === 0
  ) {
    return result;
  }

  const suffix =
    ` Trivia cerrada: ${trivia.pointsEntriesCreated} entradas` +
    (trivia.errors > 0 ? `, ${trivia.errors} errores.` : ".");

  return {
    ...result,
    ok: result.ok && trivia.errors === 0,
    message: `${result.message} ${suffix}`,
    pointsEntriesCreated: result.pointsEntriesCreated + trivia.pointsEntriesCreated,
    totalPointsCreated: result.totalPointsCreated + trivia.totalPointsCreated,
    errors: result.errors + trivia.errors,
  };
}

function selectedMatchDebug(target: Target): NonNullable<SyncResult["selectedMatch"]> {
  return {
    id: target.id,
    externalId: target.externalId,
    phase: target.phase,
    homeTeamId: target.homeTeamId,
    awayTeamId: target.awayTeamId,
    kickoffAt: target.kickoffAt.toISOString(),
    status: target.status,
    storedScore: hasStoredScore(target) ? `${target.homeScore}-${target.awayScore}` : null,
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

async function fetchEspnEventsForDate(date: Date): Promise<EspnEvent[]> {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${ymd}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as EspnScoreboardPayload;
  return data.events ?? [];
}

async function fetchEspnEventsAround(date: Date): Promise<EspnEvent[]> {
  const dates = [
    date,
    new Date(date.getTime() - 12 * 60 * 60_000),
    new Date(date.getTime() + 12 * 60 * 60_000),
  ];
  const seen = new Set<string>();
  const events: EspnEvent[] = [];
  for (const d of dates) {
    for (const event of await fetchEspnEventsForDate(d)) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      events.push(event);
    }
  }
  return events;
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
  appliedScore: string | null;
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
    return null;
  }

  const closest = samePhase
    .map((m) => ({
      match: m,
      delta: Math.abs(new Date(m.utcDate).getTime() - target.kickoffAt.getTime()),
    }))
    .sort((a, b) => a.delta - b.delta)[0];

  return closest && closest.delta <= ACTIVE_TAIL_MS ? closest.match : null;
}

function isCurrentEspnEvent(event: EspnEvent, now: Date): boolean {
  const status = mapEspnStatus(event);
  if (status === "LIVE") return true;
  if (status !== "FINISHED") return false;

  const kickoff = new Date(event.date).getTime();
  return now.getTime() - kickoff <= ESPN_FINISHED_TAIL_MS && now.getTime() >= kickoff;
}

async function findEspnCurrentEventTarget(
  now: Date,
  resolveTeam: TeamResolver,
): Promise<{ target: Target; event: EspnEvent } | null> {
  const events = await fetchEspnEventsAround(now);
  const candidates = events
    .filter((event) => isCurrentEspnEvent(event, now))
    .sort((a, b) => {
      const statusA = mapEspnStatus(a);
      const statusB = mapEspnStatus(b);
      if (statusA === "LIVE" && statusB !== "LIVE") return -1;
      if (statusB === "LIVE" && statusA !== "LIVE") return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  for (const event of candidates) {

    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const homeId = resolveTeam({
      id: 0,
      name: home?.team?.displayName ?? home?.team?.name ?? "",
      shortName: home?.team?.name ?? null,
      tla: home?.team?.abbreviation ?? null,
    });
    const awayId = resolveTeam({
      id: 0,
      name: away?.team?.displayName ?? away?.team?.name ?? "",
      shortName: away?.team?.name ?? null,
      tla: away?.team?.abbreviation ?? null,
    });
    if (!homeId || !awayId) continue;

    const target = await prisma.match.findFirst({
      where: {
        OR: [
          { homeTeamId: homeId, awayTeamId: awayId },
          { homeTeamId: awayId, awayTeamId: homeId },
        ],
      },
      orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
    });
    if (target) return { target, event };
  }

  return null;
}

function parseEspnScore(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function findEspnEventForTarget(
  target: Target,
  events: EspnEvent[],
  resolveTeam: TeamResolver,
): EspnEvent | null {
  if (!target.homeTeamId || !target.awayTeamId) return null;

  for (const event of events) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const homeId = resolveTeam({
      id: 0,
      name: home?.team?.displayName ?? home?.team?.name ?? "",
      shortName: home?.team?.name ?? null,
      tla: home?.team?.abbreviation ?? null,
    });
    const awayId = resolveTeam({
      id: 0,
      name: away?.team?.displayName ?? away?.team?.name ?? "",
      shortName: away?.team?.name ?? null,
      tla: away?.team?.abbreviation ?? null,
    });

    if (
      (homeId === target.homeTeamId && awayId === target.awayTeamId) ||
      (homeId === target.awayTeamId && awayId === target.homeTeamId)
    ) {
      return event;
    }
  }

  return null;
}

async function applyEspnEventUpdate(
  target: Target,
  event: EspnEvent,
  resolveTeam: TeamResolver,
): Promise<ApplyResult | null> {
  const competitors = event.competitions?.[0]?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  const espnHomeId = resolveTeam({
    id: 0,
    name: home?.team?.displayName ?? home?.team?.name ?? "",
    shortName: home?.team?.name ?? null,
    tla: home?.team?.abbreviation ?? null,
  });
  const espnAwayId = resolveTeam({
    id: 0,
    name: away?.team?.displayName ?? away?.team?.name ?? "",
    shortName: away?.team?.name ?? null,
    tla: away?.team?.abbreviation ?? null,
  });

  const rawHome = parseEspnScore(home?.score);
  const rawAway = parseEspnScore(away?.score);
  const status = mapEspnStatus(event);
  const hasScore = rawHome !== null && rawAway !== null && status !== "SCHEDULED";
  const hadScore = target.homeScore !== null && target.awayScore !== null;

  const data: {
    status: Status;
    kickoffAt: Date;
    homeScore?: number;
    awayScore?: number;
    winnerTeamId?: number | null;
  } = {
    status,
    kickoffAt: new Date(event.date),
  };

  if (hasScore) {
    if (target.homeTeamId === espnHomeId) {
      data.homeScore = rawHome;
      data.awayScore = rawAway;
    } else {
      data.homeScore = rawAway;
      data.awayScore = rawHome;
    }
    if (status === "FINISHED" && target.homeTeamId && target.awayTeamId) {
      if (data.homeScore > data.awayScore) data.winnerTeamId = target.homeTeamId;
      else if (data.awayScore > data.homeScore) data.winnerTeamId = target.awayTeamId;
      else data.winnerTeamId = null;
    }
  }

  await prisma.match.update({ where: { id: target.id }, data });
  return {
    hasScore,
    shouldRecompute: hasScore || hadScore,
    finished: status === "FINISHED" && hasScore,
    teamsKnown: espnHomeId !== null && espnAwayId !== null,
    assigned: 0,
    appliedScore: hasScore ? `${data.homeScore}-${data.awayScore}` : null,
  };
}

async function applyEspnFallbackUpdate(
  target: Target,
  resolveTeam: TeamResolver,
): Promise<ApplyResult | null> {
  const events = await fetchEspnEventsAround(target.kickoffAt);
  const event = findEspnEventForTarget(target, events, resolveTeam);
  if (!event) return null;
  return applyEspnEventUpdate(target, event, resolveTeam);
}

export async function syncCurrentWorldCupMatch(now: Date = new Date()): Promise<SyncResult> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return withClosedTrivia(emptyResult(false, "FOOTBALL_DATA_TOKEN no esta configurado."), now);
  }

  // Si hay varios partidos activos a la vez (p. ej. dos a la misma hora), el
  // sync por-partido solo cubriría uno y dejaría el otro atascado en LIVE. En
  // ese caso hacemos un sync completo (una sola llamada a la API) para
  // actualizarlos todos.
  if ((await countActiveSyncTargets(now)) > 1) {
    return syncWorldCup();
  }

  const resolveTeam = await createTeamResolver();
  const currentEspnTarget = await findEspnCurrentEventTarget(now, resolveTeam);
  // Un evento ESPN sigue siendo "actual" hasta 24h después de finalizar; no debe
  // secuestrar el objetivo si en nuestra DB ese partido ya está FINISHED, porque
  // dejaría sin atender a otro partido aún activo (en juego) del mismo horario.
  const espnTarget =
    currentEspnTarget && currentEspnTarget.target.status !== "FINISHED"
      ? currentEspnTarget.target
      : null;
  const target = espnTarget ?? (await getCurrentSyncTarget(now));
  if (!target) {
    return withClosedTrivia(emptyResult(true, "Sin partido actual; no se consulto la API."), now);
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
      return withClosedTrivia({
        ...fetched.result,
        message: `${fetched.result.message} Se recalculo el marcador local guardado.`,
        predictionsScored: scoring.predictionsScored,
        pointsEntriesCreated: scoring.pointsEntriesCreated,
        totalPointsCreated: scoring.totalPointsCreated,
        errors: fetched.result.errors + errors,
      }, now, [target.id]);
    }
    return withClosedTrivia(fetched.result, now);
  }

  const apiMatch = findApiMatchForTarget(target, fetched.matches, resolveTeam);
  if (!apiMatch) {
    try {
      const fallback = await applyEspnFallbackUpdate(target, resolveTeam);
      if (fallback?.hasScore) {
        const { scoring, errors } = await recomputeStoredScore(target.id, "api-unmatched-espn");
        return withClosedTrivia({
          ...emptyResult(
            errors === 0,
            "No se encontro en la API el partido actual; se aplico marcador ESPN.",
          ),
          source: "espn-fallback",
          selectedMatch: selectedMatchDebug(target),
          appliedScore: fallback.appliedScore,
          fetched: fetched.matches.length,
          matchesUpdated: 1,
          teamsAssigned: fallback.assigned,
          scoresUpdated: 1,
          predictionsScored: scoring.predictionsScored,
          pointsEntriesCreated: scoring.pointsEntriesCreated,
          totalPointsCreated: scoring.totalPointsCreated,
          unmatched: fallback.teamsKnown ? 0 : 1,
          errors,
        }, now, [target.id]);
      }
    } catch (error) {
      console.error("[sync] Error consultando fallback ESPN tras api-unmatched", error);
    }

    if (currentEspnTarget) {
      try {
        const fallback = await applyEspnEventUpdate(
          currentEspnTarget.target,
          currentEspnTarget.event,
          resolveTeam,
        );
        if (fallback?.hasScore) {
          const { scoring, errors } = await recomputeStoredScore(
            currentEspnTarget.target.id,
            "api-unmatched-current-espn",
          );
          return withClosedTrivia({
            ...emptyResult(
              errors === 0,
              "No se encontro en la API el partido actual; se aplico evento en vivo ESPN.",
            ),
            source: "espn-fallback",
            selectedMatch: selectedMatchDebug(currentEspnTarget.target),
            appliedScore: fallback.appliedScore,
            fetched: fetched.matches.length,
            matchesUpdated: 1,
            teamsAssigned: fallback.assigned,
            scoresUpdated: 1,
            predictionsScored: scoring.predictionsScored,
            pointsEntriesCreated: scoring.pointsEntriesCreated,
            totalPointsCreated: scoring.totalPointsCreated,
            unmatched: fallback.teamsKnown ? 0 : 1,
            errors,
          }, now, [currentEspnTarget.target.id]);
        }
      } catch (error) {
        console.error("[sync] Error aplicando evento en vivo ESPN tras api-unmatched", error);
      }
    }

    if (hasStoredScore(target)) {
      const { scoring, errors } = await recomputeStoredScore(target.id, "api-unmatched");
      return withClosedTrivia({
        ...emptyResult(errors === 0, "No se encontro en la API el partido actual; se recalculo el marcador local guardado."),
        source: "local-score",
        selectedMatch: selectedMatchDebug(target),
        appliedScore: `${target.homeScore}-${target.awayScore}`,
        fetched: fetched.matches.length,
        predictionsScored: scoring.predictionsScored,
        pointsEntriesCreated: scoring.pointsEntriesCreated,
        totalPointsCreated: scoring.totalPointsCreated,
        unmatched: 1,
        errors,
      }, now, [target.id]);
    }
    return withClosedTrivia({
      ...emptyResult(true, "No se encontro en la API el partido actual."),
      selectedMatch: selectedMatchDebug(target),
      fetched: fetched.matches.length,
      unmatched: 1,
    }, now);
  }

  const phase = STAGE_TO_PHASE[apiMatch.stage];
  if (!phase) {
    if (hasStoredScore(target)) {
      const { scoring, errors } = await recomputeStoredScore(target.id, "unknown-stage");
      return withClosedTrivia({
        ...emptyResult(errors === 0, `Fase desconocida en la API: ${apiMatch.stage}. Se recalculo el marcador local guardado.`),
        fetched: fetched.matches.length,
        predictionsScored: scoring.predictionsScored,
        pointsEntriesCreated: scoring.pointsEntriesCreated,
        totalPointsCreated: scoring.totalPointsCreated,
        unknownStages: 1,
        errors,
      }, now, [target.id]);
    }
    return withClosedTrivia({
      ...emptyResult(true, `Fase desconocida en la API: ${apiMatch.stage}.`),
      fetched: fetched.matches.length,
      unknownStages: 1,
    }, now);
  }

  const h = resolveTeam(apiMatch.homeTeam);
  const a = resolveTeam(apiMatch.awayTeam);
  let result: ApplyResult;

  if (target.phase === "GROUP") {
    if (!h || !a) {
      if (hasStoredScore(target)) {
        const { scoring, errors } = await recomputeStoredScore(target.id, "teams-unmatched");
        return withClosedTrivia({
          ...emptyResult(errors === 0, "No se pudieron emparejar los equipos del partido actual; se recalculo el marcador local guardado."),
          fetched: fetched.matches.length,
          predictionsScored: scoring.predictionsScored,
          pointsEntriesCreated: scoring.pointsEntriesCreated,
          totalPointsCreated: scoring.totalPointsCreated,
          unmatched: 1,
          errors,
        }, now, [target.id]);
      }
      return withClosedTrivia({
        ...emptyResult(true, "No se pudieron emparejar los equipos del partido actual."),
        fetched: fetched.matches.length,
        unmatched: 1,
      }, now);
    }
    result = await applyUpdate(target, apiMatch, h);
  } else {
    result = await applyKnockoutUpdate(target, apiMatch, h, a);
  }

  let usedEspnFallback = false;
  if (!result.hasScore) {
    try {
      const fallback = await applyEspnFallbackUpdate(target, resolveTeam);
      if (fallback?.hasScore) {
        result = fallback;
        usedEspnFallback = true;
      }
    } catch (error) {
      console.error("[sync] Error consultando fallback ESPN", error);
    }
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

  return withClosedTrivia({
    ok: true,
    message:
      `Sincronizacion del partido actual completa: ${result.hasScore ? 1 : 0} marcador` +
      (usedEspnFallback ? " (fallback ESPN)" : "") +
      (errors > 0 ? `. Avisos: ${errors} con error.` : "."),
    source: usedEspnFallback ? "espn-fallback" : "football-data",
    selectedMatch: selectedMatchDebug(target),
    appliedScore: result.appliedScore,
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
  }, now, result.shouldRecompute ? [target.id] : []);
}

export async function syncWorldCup(): Promise<SyncResult> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return withClosedTrivia(emptyResult(false, "FOOTBALL_DATA_TOKEN no esta configurado."), new Date());
  }

  const fetched = await fetchApiMatches(token, `${BASE}/competitions/${COMPETITION}/matches`);
  if (!fetched.ok) return withClosedTrivia(fetched.result, new Date());

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

  return withClosedTrivia({
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
  }, new Date(), [...affectedForPoints]);
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
    appliedScore: hasScore ? `${homeScore}-${awayScore}` : null,
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
    appliedScore: hasScore ? `${data.homeScore}-${data.awayScore}` : null,
  };
}
