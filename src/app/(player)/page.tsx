import Link from "next/link";
import { Trophy, Medal, CalendarClock, ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserSummary, getChampionPick, getScoringConfig } from "@/lib/queries";
import { isPredictionOpen } from "@/lib/dates";
import { PHASE_LABEL } from "@/lib/constants";
import { Flag } from "@/components/flag";
import { LocalTime } from "@/components/local-time";

export default async function PlayerHomePage() {
  const s = await requireSession();

  const [summary, championPick, cfg] = await Promise.all([
    getUserSummary(s.userId),
    getChampionPick(s.userId),
    getScoringConfig(),
  ]);

  // Upcoming matches with an open prediction window.
  const now = new Date();
  const upcoming = await prisma.match.findMany({
    where: { kickoffAt: { gt: now } },
    include: { homeTeam: true, awayTeam: true, question: { select: { status: true } } },
    orderBy: { kickoffAt: "asc" },
    take: 12,
  });
  const openMatches = upcoming
    .filter(
      (m) =>
        m.question?.status === "ACTIVE" &&
        isPredictionOpen(m.kickoffAt, cfg.lockMinutes, now),
    )
    .slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Bienvenida */}
      <section>
        <h1 className="text-2xl font-bold sm:text-3xl">
          Hola {s.name}, <span className="text-accent">¡Bienvenido a la Polla Mundialista!</span>
        </h1>
        <p className="mt-1 text-sm text-white/70">
          Pronostica los partidos, responde la trivia y compite por el primer lugar.
        </p>
      </section>

      {/* Tarjetas resumen */}
      <section className="grid gap-4 sm:grid-cols-2">
        {/* Mis puntos */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/60">
            <Trophy className="size-4 text-accent" />
            Mis puntos
          </div>
          <div className="mt-3 flex items-end justify-between">
            <span className="tnum text-4xl font-bold text-accent">
              {summary.totalPoints}
            </span>
            <span className="text-sm text-white/70">
              {summary.rank != null ? (
                <>
                  Posición{" "}
                  <span className="tnum font-semibold text-white">#{summary.rank}</span>{" "}
                  de{" "}
                  <span className="tnum font-semibold text-white">{summary.totalPlayers}</span>
                </>
              ) : (
                "Sin posición aún"
              )}
            </span>
          </div>
        </div>

        {/* Mis campeones */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/60">
              <Medal className="size-4 text-accent" />
              Mis campeones
            </div>
            <Link
              href="/campeones"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Editar
              <ArrowRight className="size-3" />
            </Link>
          </div>
          {championPick ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Flag code={championPick.championTeam.fifaCode} size={22} />
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-white/50">Campeón</div>
                  <div className="text-sm font-semibold">{championPick.championTeam.name}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Flag code={championPick.runnerUpTeam.fifaCode} size={22} />
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-white/50">Subcampeón</div>
                  <div className="text-sm font-semibold">{championPick.runnerUpTeam.name}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-white/70">
              Sin elegir.{" "}
              <Link href="/campeones" className="font-medium text-accent hover:underline">
                Elige tu campeón y subcampeón
              </Link>
              .
            </div>
          )}
        </div>
      </section>

      {/* Partidos para pronosticar */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="size-5 text-accent" />
            Partidos para pronosticar
          </h2>
          <Link
            href="/partidos"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            Ver todos
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {openMatches.length === 0 ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/70 backdrop-blur">
            No hay partidos abiertos para pronosticar en este momento.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {openMatches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/partidos/${m.id}`}
                  className="group flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur transition-colors hover:border-accent/40 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/50">
                    <span>
                      {PHASE_LABEL[m.phase]}
                      {m.groupName ? ` · Grupo ${m.groupName}` : ""}
                    </span>
                    <span className="tnum"><LocalTime value={m.kickoffAt} /></span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {m.homeTeam && <Flag code={m.homeTeam.fifaCode} size={20} />}
                      {m.homeTeam?.name ?? "Por definir"}
                    </span>
                    <span className="text-xs font-medium text-white/50">vs</span>
                    <span className="flex items-center justify-end gap-2 text-right text-sm font-semibold">
                      {m.awayTeam?.name ?? "Por definir"}
                      {m.awayTeam && <Flag code={m.awayTeam.fifaCode} size={20} />}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                    Pronosticar
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
