"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { answerTrivia, type ActionState } from "@/app/(player)/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";

export function TriviaForm({
  matchId,
  text,
  options,
}: {
  matchId: number;
  text: string;
  options: string[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(answerTrivia, null);

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
          Pregunta de trivia
        </p>
        <p className="mt-1 text-base font-semibold text-white">{text}</p>
        <p className="mt-1 text-xs text-white/60">
          Responde la trivia para habilitar el ingreso de tu marcador.
        </p>
      </div>

      <fieldset className="space-y-2">
        {options.map((option, index) => (
          <label
            key={index}
            className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition-colors hover:bg-white/10 has-[:checked]:border-accent has-[:checked]:bg-accent/10"
          >
            <input
              type="radio"
              name="selectedOption"
              value={index}
              required
              className="size-4 shrink-0 accent-accent"
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>

      <FormMessage state={state} />

      <SubmitButton variant="primary" size="lg" className="w-full">
        Enviar respuesta
      </SubmitButton>
    </form>
  );
}
