"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createUser, updateUser } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";
import { ROLE_LABEL } from "@/lib/constants";

type ActionState = { error?: string; success?: string } | null;

export type UserFormData = {
  id: number;
  fullName: string;
  email: string;
  documento: string | null;
  role: string;
  status: string;
};

const ROLES = ["SUPER_ADMIN", "EMPLEADO"] as const;
const STATUSES = ["ACTIVE", "INACTIVE"] as const;
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

export function UserDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user?: UserFormData;
}) {
  const isEdit = Boolean(user);
  const action = isEdit ? updateUser : createUser;
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isEdit ? "Editar usuario" : "Nuevo usuario"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? "Actualiza los datos del usuario."
                : "Completa los datos para crear un usuario."}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </div>

        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={user!.id} />}

          <div>
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input
              id="fullName"
              name="fullName"
              required
              defaultValue={user?.fullName ?? ""}
              placeholder="Nombre y apellido"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={user?.email ?? ""}
              placeholder="correo@celya.co"
            />
          </div>

          <div>
            <Label htmlFor="documento">Documento</Label>
            <Input
              id="documento"
              name="documento"
              defaultValue={user?.documento ?? ""}
              placeholder="Opcional"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role">Rol</Label>
              <Select id="role" name="role" defaultValue={user?.role ?? "EMPLEADO"}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Estado</Label>
              <Select
                id="status"
                name="status"
                defaultValue={user?.status ?? "ACTIVE"}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required={!isEdit}
              placeholder={
                isEdit ? "Dejar vacío para no cambiar" : "Contraseña inicial"
              }
            />
          </div>

          <FormMessage state={state} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <SubmitButton variant="primary">
              {isEdit ? "Guardar cambios" : "Crear usuario"}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
