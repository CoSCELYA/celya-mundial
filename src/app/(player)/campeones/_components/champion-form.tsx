"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Team } from "@prisma/client";
import { saveChampionPick, type ActionState } from "@/app/(player)/actions";
import { Label, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";

export function ChampionForm({
  teams,
  championTeamId,
  runnerUpTeamId,
}: {
  teams: Team[];
  championTeamId: number | null;
  runnerUpTeamId: number | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(saveChampionPick, null);

  const [champion, setChampion] = useState<string>(championTeamId ? String(championTeamId) : "");
  const [runnerUp, setRunnerUp] = useState<string>(runnerUpTeamId ? String(runnerUpTeamId) : "");

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  const sameTeam = champion !== "" && champion === runnerUp;

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur"
    >
      <div className="space-y-2">
        <Label htmlFor="championTeamId" className="text-white/80">
          Campeón
        </Label>
        <Select
          id="championTeamId"
          name="championTeamId"
          required
          value={champion}
          onChange={(e) => setChampion(e.target.value)}
        >
          <option value="" disabled>
            Selecciona un equipo
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="runnerUpTeamId" className="text-white/80">
          Subcampeón
        </Label>
        <Select
          id="runnerUpTeamId"
          name="runnerUpTeamId"
          required
          value={runnerUp}
          onChange={(e) => setRunnerUp(e.target.value)}
        >
          <option value="" disabled>
            Selecciona un equipo
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {sameTeam && (
        <p className="text-sm text-danger">
          El campeón y el subcampeón deben ser distintos.
        </p>
      )}

      <FormMessage state={state} />

      <SubmitButton variant="primary" size="lg" className="w-full" disabled={sameTeam}>
        Guardar selección
      </SubmitButton>
    </form>
  );
}
