"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { savePrediction, type ActionState } from "@/app/(player)/actions";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";
import { Flag } from "@/components/flag";
import { LocalTime } from "@/components/local-time";

export function ScoreForm({
  matchId,
  homeName,
  awayName,
  homeCode,
  awayCode,
  homeScore,
  awayScore,
  deadline,
}: {
  matchId: number;
  homeName: string;
  awayName: string;
  homeCode: string | null;
  awayCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  deadline: number;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(savePrediction, null);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur"
    >
      <input type="hidden" name="matchId" value={matchId} />

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
          Ingreso de marcador
        </p>
        <p className="mt-1 text-xs text-white/60">
          Puedes editar tu pronóstico hasta <LocalTime value={deadline} />.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="homeScore" className="flex items-center gap-1.5 text-white/80">
            <Flag code={homeCode} size={16} />
            {homeName}
          </Label>
          <Input
            id="homeScore"
            name="homeScore"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={homeScore ?? ""}
            placeholder="0"
            className="tnum h-12 bg-white/10 text-center text-xl font-bold text-white"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="awayScore" className="flex items-center gap-1.5 text-white/80">
            <Flag code={awayCode} size={16} />
            {awayName}
          </Label>
          <Input
            id="awayScore"
            name="awayScore"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={awayScore ?? ""}
            placeholder="0"
            className="tnum h-12 bg-white/10 text-center text-xl font-bold text-white"
          />
        </div>
      </div>

      <FormMessage state={state} />

      <SubmitButton variant="primary" size="lg" className="w-full">
        Guardar marcador
      </SubmitButton>
    </form>
  );
}
