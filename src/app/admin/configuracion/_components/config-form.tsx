"use client";

import { useActionState } from "react";
import type { ScoringConfig } from "@prisma/client";
import { updateScoringConfig } from "@/app/admin/actions";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { PHASE_ORDER, PHASE_LABEL } from "@/lib/constants";

type ActionState = { error?: string; success?: string } | null;

const NUMBER_FIELDS: {
  name: keyof ScoringConfig;
  label: string;
  help: string;
}[] = [
  { name: "exactPts", label: "Marcador exacto", help: "Puntos por acertar el marcador exacto." },
  {
    name: "resultPts",
    label: "Resultado (1X2)",
    help: "Puntos por acertar solo el ganador o el empate.",
  },
  { name: "triviaPts", label: "Trivia", help: "Puntos por responder correctamente la trivia." },
  { name: "championPts", label: "Campeón", help: "Puntos por acertar el campeón del torneo." },
  {
    name: "runnerUpPts",
    label: "Subcampeón",
    help: "Puntos por acertar el subcampeón del torneo.",
  },
  {
    name: "lockMinutes",
    label: "Minutos de bloqueo",
    help: "Minutos antes del inicio en que se cierra el pronóstico.",
  },
];

export function ConfigForm({ config }: { config: ScoringConfig }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateScoringConfig, null);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {NUMBER_FIELDS.map((field) => (
          <div key={field.name}>
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              name={field.name}
              type="number"
              min={0}
              step={1}
              defaultValue={String(config[field.name] ?? 0)}
              className="tnum"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>
          </div>
        ))}

        <div className="sm:col-span-2">
          <Label htmlFor="championLockPhase">Fase de bloqueo de campeón</Label>
          <Select
            id="championLockPhase"
            name="championLockPhase"
            defaultValue={config.championLockPhase}
          >
            {PHASE_ORDER.map((phase) => (
              <option key={phase} value={phase}>
                {PHASE_LABEL[phase]}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Al iniciar esta fase se cierra la edición del campeón y subcampeón.
          </p>
        </div>
      </div>

      <FormMessage state={state} />

      <div className="flex justify-end">
        <SubmitButton variant="primary">Guardar configuración</SubmitButton>
      </div>
    </form>
  );
}
