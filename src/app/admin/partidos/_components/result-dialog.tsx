"use client";

import { useActionState, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { MatchStatus, Phase } from "@prisma/client";

import { setMatchResult, type ActionState } from "@/app/admin/actions";

import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";
import { Flag } from "@/components/flag";

export type ResultMatch = {
  id: number;
  phase: Phase;
  homeName: string;
  awayName: string;
  homeCode: string | null;
  awayCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
};

const STATUS_OPTIONS: { value: MatchStatus; label: string }[] = [
  { value: "SCHEDULED", label: "Programado" },
  { value: "LIVE", label: "En juego" },
  { value: "FINISHED", label: "Finalizado" },
];

export function ResultDialog({
  match,
  trigger,
}: {
  match: ResultMatch;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(setMatchResult, null);

  // Cierra el diálogo al tener éxito (patrón de estado derivado, sin efecto).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.success) setOpen(false);
  }

  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [home, setHome] = useState<string>(String(match.homeScore ?? 0));
  const [away, setAway] = useState<string>(String(match.awayScore ?? 0));

  const isKnockout = match.phase !== "GROUP";
  const isTie = home !== "" && away !== "" && Number(home) === Number(away);
  const needsWinner = isKnockout && status === "FINISHED" && isTie;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="contents">
        {trigger}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Marcador</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </Button>
            </div>

            <p className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Flag code={match.homeCode} size={16} /> {match.homeName} vs {match.awayName}{" "}
              <Flag code={match.awayCode} size={16} />
            </p>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="id" value={match.id} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rd-home">{match.homeName}</Label>
                  <Input
                    id="rd-home"
                    name="homeScore"
                    type="number"
                    min={0}
                    className="tnum"
                    value={home}
                    onChange={(e) => setHome(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="rd-away">{match.awayName}</Label>
                  <Input
                    id="rd-away"
                    name="awayScore"
                    type="number"
                    min={0}
                    className="tnum"
                    value={away}
                    onChange={(e) => setAway(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="rd-status">Estado</Label>
                <Select
                  id="rd-status"
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MatchStatus)}
                  required
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>

              {needsWinner && (
                <div>
                  <Label htmlFor="rd-winner">Ganador (definición por penales)</Label>
                  <Select id="rd-winner" name="winner" defaultValue="" required>
                    <option value="" disabled>
                      Selecciona el ganador
                    </option>
                    <option value="home">{match.homeName}</option>
                    <option value="away">{match.awayName}</option>
                  </Select>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    El partido terminó empatado: indica quién avanzó.
                  </p>
                </div>
              )}

              <FormMessage state={state} />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <SubmitButton>Guardar resultado</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
