"use client";

import { useState } from "react";
import { Trophy, Medal, X, Target, CheckCircle2, HelpCircle, Crown } from "lucide-react";
import type { PointsType } from "@prisma/client";

import { Flag } from "@/components/flag";
import { cn } from "@/lib/cn";
import type { StandingRow as Row } from "@/lib/queries";

/** Iniciales a partir del nombre completo (máx. 2). */
function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Acento de medalla para el Top 3. */
function rankAccent(rank: number): { icon: typeof Trophy; className: string } | null {
  if (rank === 1) return { icon: Trophy, className: "text-accent" };
  if (rank === 2) return { icon: Medal, className: "text-white/70" };
  if (rank === 3) return { icon: Medal, className: "text-amber-600/80" };
  return null;
}

/** Filas del desglose, en orden de presentación. */
const BREAKDOWN_ROWS: {
  type: PointsType;
  label: string;
  icon: typeof Target;
  unit: string;
  unitPlural: string;
}[] = [
  { type: "EXACT", label: "Marcador exacto", icon: Target, unit: "marcador", unitPlural: "marcadores" },
  { type: "RESULT", label: "Resultado acertado", icon: CheckCircle2, unit: "resultado", unitPlural: "resultados" },
  { type: "TRIVIA", label: "Trivia correcta", icon: HelpCircle, unit: "trivia", unitPlural: "trivias" },
  { type: "CHAMPION", label: "Campeón acertado", icon: Crown, unit: "acierto", unitPlural: "aciertos" },
  { type: "RUNNERUP", label: "Subcampeón acertado", icon: Crown, unit: "acierto", unitPlural: "aciertos" },
];

export function StandingRow({
  row,
  isCurrentUser,
}: {
  row: Row;
  isCurrentUser: boolean;
}) {
  const [open, setOpen] = useState(false);
  const accent = rankAccent(row.rank);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-5 py-3 text-left transition-colors md:grid-cols-[3rem_1fr_5rem_5rem_5rem]",
          isCurrentUser
            ? "bg-white/10 ring-1 ring-inset ring-accent"
            : "hover:bg-white/[0.04]",
        )}
        aria-label={`Ver desglose de puntos de ${row.fullName}`}
      >
        {/* Posición */}
        <div className="flex items-center gap-1.5">
          {accent ? (
            <accent.icon className={cn("size-4", accent.className)} />
          ) : (
            <span className="w-4" />
          )}
          <span className="tnum text-sm font-semibold text-white/80">{row.rank}</span>
        </div>

        {/* Usuario */}
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-yellow text-xs font-bold text-brand-black">
            {getInitials(row.fullName)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-white">{row.fullName}</p>
              {isCurrentUser && (
                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
                  Tú
                </span>
              )}
            </div>
            {/* Campeones en móvil */}
            <p className="mt-0.5 flex items-center gap-2 text-xs text-white/50 md:hidden">
              <span>{row.champion ? <Flag code={row.champion.fifaCode} size={18} /> : "—"}</span>
              <span className="text-white/30">/</span>
              <span>{row.runnerUp ? <Flag code={row.runnerUp.fifaCode} size={18} /> : "—"}</span>
            </p>
          </div>
        </div>

        {/* Campeón (md+) */}
        <div
          className="hidden text-center md:flex md:items-center md:justify-center"
          title={row.champion?.name ?? "Sin selección"}
        >
          {row.champion ? <Flag code={row.champion.fifaCode} size={22} /> : <span className="text-white/30">—</span>}
        </div>

        {/* Subcampeón (md+) */}
        <div
          className="hidden text-center md:flex md:items-center md:justify-center"
          title={row.runnerUp?.name ?? "Sin selección"}
        >
          {row.runnerUp ? <Flag code={row.runnerUp.fifaCode} size={22} /> : <span className="text-white/30">—</span>}
        </div>

        {/* Puntos */}
        <div className="text-right">
          <span className="tnum text-base font-bold text-accent">{row.totalPoints}</span>
          <span className="ml-1 text-[11px] uppercase tracking-wide text-white/40">pts</span>
        </div>
      </button>

      {open ? (
        <BreakdownDialog row={row} onClose={() => setOpen(false)} />
      ) : null}
    </li>
  );
}

function BreakdownDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const rows = BREAKDOWN_ROWS.map((b) => ({ ...b, data: row.breakdown[b.type] })).filter(
    // Campeón/subcampeón solo se muestran si ya se otorgaron puntos.
    (b) =>
      b.type === "EXACT" || b.type === "RESULT" || b.type === "TRIVIA" || b.data.points > 0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-white/10 bg-[#0c1530] p-6 text-white shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-yellow text-sm font-bold text-brand-black">
              {getInitials(row.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row.fullName}</p>
              <p className="text-xs text-white/50">
                Posición #{row.rank} · {row.totalPoints} pts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-white/50">
          Cómo ganó sus puntos
        </p>

        <ul className="space-y-2">
          {rows.map((b) => (
            <li
              key={b.type}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <b.icon className="size-4 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{b.label}</span>
                  <span className="text-[11px] text-white/50">
                    {b.data.count} {b.data.count === 1 ? b.unit : b.unitPlural}
                  </span>
                </span>
              </span>
              <span className="tnum shrink-0 text-sm font-bold text-accent">
                {b.data.points > 0 ? `+${b.data.points}` : "0"} pts
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-sm font-semibold text-white/70">Total</span>
          <span className="tnum text-lg font-bold text-accent">{row.totalPoints} pts</span>
        </div>
      </div>
    </div>
  );
}
