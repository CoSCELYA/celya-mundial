"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { createPrize, updatePrize } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";

type PrizeData = {
  id: number;
  position: number | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type Props = {
  /** Si se pasa, el diálogo está en modo edición. */
  prize?: PrizeData;
};

export function PrizeDialog({ prize }: Props) {
  const isEdit = Boolean(prize);
  const action = isEdit ? updatePrize : createPrize;

  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, null);

  // Cierra el diálogo cuando la acción termina con éxito.
  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <>
      {isEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Pencil className="size-4" />
          Editar
        </Button>
      ) : (
        <Button type="button" variant="primary" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Nuevo premio
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">
                {isEdit ? "Editar premio" : "Nuevo premio"}
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
              {isEdit && (
                <input type="hidden" name="id" value={prize!.id} />
              )}

              <div>
                <Label htmlFor="position">Posición</Label>
                <Input
                  id="position"
                  name="position"
                  type="number"
                  min={1}
                  placeholder="Ej: 1"
                  defaultValue={prize?.position ?? ""}
                />
              </div>

              <div>
                <Label htmlFor="name">Premio</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="Nombre del premio"
                  defaultValue={prize?.name ?? ""}
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Descripción del premio (opcional)"
                  defaultValue={prize?.description ?? ""}
                />
              </div>

              <div>
                <Label htmlFor="imageUrl">URL de la imagen</Label>
                <Input
                  id="imageUrl"
                  name="imageUrl"
                  type="url"
                  placeholder="https://..."
                  defaultValue={prize?.imageUrl ?? ""}
                />
              </div>

              <div>
                <Label htmlFor="status">Estado</Label>
                <Select
                  id="status"
                  name="status"
                  defaultValue={prize?.status ?? "ACTIVE"}
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </Select>
              </div>

              <FormMessage state={state} />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <SubmitButton variant="primary">
                  {isEdit ? "Guardar cambios" : "Crear premio"}
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
