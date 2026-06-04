"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import type { Phase } from "@prisma/client";

import { createMatch, updateMatch, type ActionState } from "@/app/admin/actions";
import { GROUPS, PHASE_LABEL, PHASE_ORDER } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";

export type TeamOption = {
  id: number;
  name: string;
  flagEmoji: string;
  groupName: string | null;
};

export type MatchData = {
  id: number;
  phase: Phase;
  groupName: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  kickoffAt: string;
  venue: string | null;
};

/** Convierte un ISO string a formato datetime-local (YYYY-MM-DDTHH:mm) en hora local. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MatchDialog({
  teams,
  match,
  trigger,
}: {
  teams: TeamOption[];
  match?: MatchData;
  trigger?: ReactNode;
}) {
  const isEdit = Boolean(match);
  const action = isEdit ? updateMatch : createMatch;

  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const [phase, setPhase] = useState<Phase>(match?.phase ?? "GROUP");

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <>
      {trigger ? (
        <button type="button" onClick={() => setOpen(true)} className="contents">
          {trigger}
        </button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Nuevo partido
        </Button>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {isEdit ? "Editar partido" : "Nuevo partido"}
              </h2>
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

            <form action={formAction} className="space-y-4">
              {isEdit ? <input type="hidden" name="id" value={match!.id} /> : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="md-phase">Fase</Label>
                  <Select
                    id="md-phase"
                    name="phase"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value as Phase)}
                    required
                  >
                    {PHASE_ORDER.map((p) => (
                      <option key={p} value={p}>
                        {PHASE_LABEL[p]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="md-group">Grupo</Label>
                  <Select
                    id="md-group"
                    name="groupName"
                    defaultValue={match?.groupName ?? ""}
                    disabled={phase !== "GROUP"}
                  >
                    <option value="">Sin grupo</option>
                    {GROUPS.map((g) => (
                      <option key={g} value={g}>
                        Grupo {g}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="md-home">Equipo local</Label>
                  <Select id="md-home" name="homeTeamId" defaultValue={match?.homeTeamId ?? ""}>
                    <option value="">Por definir</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.flagEmoji} {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="md-away">Equipo visitante</Label>
                  <Select id="md-away" name="awayTeamId" defaultValue={match?.awayTeamId ?? ""}>
                    <option value="">Por definir</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.flagEmoji} {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="md-kickoff">Fecha y hora</Label>
                <Input
                  id="md-kickoff"
                  name="kickoffAt"
                  type="datetime-local"
                  defaultValue={match ? toLocalInput(match.kickoffAt) : ""}
                  required
                />
              </div>

              <div>
                <Label htmlFor="md-venue">Estadio / sede</Label>
                <Input
                  id="md-venue"
                  name="venue"
                  type="text"
                  defaultValue={match?.venue ?? ""}
                  placeholder="Opcional"
                />
              </div>

              <FormMessage state={state} />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <SubmitButton>{isEdit ? "Guardar cambios" : "Crear partido"}</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
