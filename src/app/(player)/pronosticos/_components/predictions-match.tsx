"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Flag } from "@/components/flag";
import { LocalTime } from "@/components/local-time";
import { PHASE_LABEL } from "@/lib/constants";
import type { MatchPredictionsRow } from "@/lib/queries";

/** Acordeón por partido: muestra el marcador de cada jugador para ese partido. */
export function PredictionsMatch({ match }: { match: MatchPredictionsRow }) {
  const [open, setOpen] = useState(false);

  const finished = match.status === "FINISHED";
  const hasReal = match.homeScore !== null && match.awayScore !== null;
  const tag =
    match.phase === "GROUP" && match.groupName
      ? `Grupo ${match.groupName}`
      : PHASE_LABEL[match.phase];
  const count = match.predictions.length;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/55">
            {tag}
            <span className="font-normal normal-case text-white/40">
              <LocalTime value={match.kickoffAt} mode="date" />
            </span>
          </span>
          <ChevronDown
            className={`size-5 shrink-0 text-white/60 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Flag code={match.homeCode} size={20} />
            <span className="truncate text-sm font-semibold text-white">{match.homeName}</span>
          </span>
          <span className="shrink-0">
            {finished && hasReal ? (
              <span className="tnum text-sm font-bold text-accent">
                {match.homeScore} - {match.awayScore}
              </span>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                vs
              </span>
            )}
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
            <span className="truncate text-sm font-semibold text-white">{match.awayName}</span>
            <Flag code={match.awayCode} size={20} />
          </span>
        </div>

        <span className="text-[11px] text-white/45">
          {count === 1 ? "1 pronóstico" : `${count} pronósticos`}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/10">
          {count === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-white/55">
              Nadie pronosticó este partido.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {match.predictions.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm text-white/90">{p.fullName}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tnum text-sm font-semibold text-white">
                      {p.homeScore} - {p.awayScore}
                    </span>
                    {p.pointsAwarded !== null && (
                      <span
                        className={`tnum w-12 text-right text-xs font-bold ${
                          p.pointsAwarded > 0 ? "text-accent" : "text-white/35"
                        }`}
                      >
                        {p.pointsAwarded > 0 ? `+${p.pointsAwarded}` : "0"} pts
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
