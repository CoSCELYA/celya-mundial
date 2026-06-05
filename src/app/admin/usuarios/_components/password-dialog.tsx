"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, X } from "lucide-react";
import { resetUserPassword } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";

type ActionState = { error?: string; success?: string } | null;

export function ResetPasswordButton({
  user,
}: {
  user: { id: number; fullName: string; email: string };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    resetUserPassword,
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Restablecer contraseña"
        title="Restablecer contraseña"
      >
        <KeyRound />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Restablecer contraseña
                </h2>
                <p className="text-sm text-muted-foreground">
                  Nueva contraseña para {user.fullName} ({user.email}).
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Cerrar">
                <X />
              </Button>
            </div>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="id" value={user.id} />
              <div>
                <Label htmlFor="reset-password">Nueva contraseña</Label>
                <Input
                  id="reset-password"
                  name="password"
                  type="text"
                  required
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Comparte esta contraseña con el usuario; podrá cambiarla luego.
                </p>
              </div>

              <FormMessage state={state} />

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  {state?.success ? "Cerrar" : "Cancelar"}
                </Button>
                <SubmitButton variant="primary">Guardar contraseña</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
