"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserDialog, type UserFormData } from "./user-dialog";

/** Botón "Nuevo usuario" + modal de creación. */
export function NewUserButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus />
        Nuevo usuario
      </Button>
      <UserDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Botón de edición de una fila + modal con datos cargados. */
export function EditUserButton({ user }: { user: UserFormData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Editar usuario"
        title="Editar"
      >
        <Pencil />
      </Button>
      <UserDialog open={open} onClose={() => setOpen(false)} user={user} />
    </>
  );
}
