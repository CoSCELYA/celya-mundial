"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";
import { createQuestion, updateQuestion } from "@/app/admin/actions";

type ActionState = { error?: string; success?: string } | null;

type MatchOption = { id: number; label: string };

type QuestionData = {
  id: number;
  matchId: number;
  text: string;
  options: string[];
  correctOption: number;
  status: string;
};

export function QuestionDialog({
  matches,
  question,
  trigger,
}: {
  matches: MatchOption[];
  question?: QuestionData;
  trigger: React.ReactNode;
}) {
  const isEdit = Boolean(question);
  const [open, setOpen] = useState(false);
  const action = isEdit ? updateQuestion : createQuestion;
  const [state, formAction] = useActionState<ActionState, FormData>(
    action,
    null,
  );

  // Estado local de las 4 opciones para alimentar el Select de respuesta correcta.
  const [options, setOptions] = useState<string[]>(
    question?.options ?? ["", "", "", ""],
  );

  // Cierra el modal cuando la acción fue exitosa.
  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  function setOption(index: number, value: string) {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={isEdit ? "ghost" : "primary"}
        size={isEdit ? "sm" : "md"}
        onClick={() => setOpen(true)}
        className={isEdit ? "text-xs" : undefined}
      >
        {trigger}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold">
              {isEdit ? "Editar pregunta" : "Nueva pregunta"}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Define la pregunta, sus 4 opciones y la respuesta correcta.
            </p>

            <form action={formAction} className="space-y-4">
              <FormMessage state={state} />

              {isEdit && (
                <input type="hidden" name="id" value={question!.id} />
              )}

              <div>
                <Label htmlFor="matchId">Partido</Label>
                <Select
                  id="matchId"
                  name="matchId"
                  defaultValue={question?.matchId ?? ""}
                  required
                >
                  <option value="" disabled>
                    Selecciona un partido
                  </option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="text">Pregunta</Label>
                <Textarea
                  id="text"
                  name="text"
                  defaultValue={question?.text ?? ""}
                  placeholder="¿Quién marcará el primer gol?"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i}>
                    <Label htmlFor={`option${i}`}>Opción {i + 1}</Label>
                    <Input
                      id={`option${i}`}
                      name={`option${i}`}
                      value={options[i] ?? ""}
                      onChange={(e) => setOption(i, e.target.value)}
                      required
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="correctOption">Respuesta correcta</Label>
                  <Select
                    id="correctOption"
                    name="correctOption"
                    defaultValue={question?.correctOption ?? 0}
                    required
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <option key={i} value={i}>
                        {options[i]?.trim()
                          ? options[i]
                          : `Opción ${i + 1}`}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    id="status"
                    name="status"
                    defaultValue={question?.status ?? "ACTIVE"}
                    required
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo</option>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <SubmitButton>
                  {isEdit ? "Guardar cambios" : "Crear pregunta"}
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
