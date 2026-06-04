"use client";

import { use } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";
import { resetAction } from "../actions";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = use(searchParams);
  const [state, action] = useActionState(resetAction, null);

  if (!token) {
    return (
      <Card className="p-6">
        <h1 className="mb-2 text-xl font-semibold">Enlace inválido</h1>
        <p className="text-sm text-muted-foreground">
          Falta el token de recuperación.{" "}
          <Link href="/forgot-password" className="font-medium text-foreground hover:underline">
            Solicita uno nuevo
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Nueva contraseña</h1>
      <p className="mb-5 text-sm text-muted-foreground">Crea una contraseña nueva.</p>
      <form action={action} className="space-y-4">
        <FormMessage state={state} />
        <input type="hidden" name="token" value={token} />
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" placeholder="Mínimo 6 caracteres" required />
        </div>
        <SubmitButton className="w-full">Actualizar contraseña</SubmitButton>
      </form>
      {state?.success && (
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Ir a iniciar sesión
          </Link>
        </p>
      )}
    </Card>
  );
}
