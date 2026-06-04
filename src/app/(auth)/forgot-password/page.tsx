"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";
import { forgotAction } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotAction, null);

  return (
    <Card className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Recuperar contraseña</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Te enviaremos un enlace para restablecerla.
      </p>
      <form action={action} className="space-y-4">
        <FormMessage state={state} />
        <div>
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" placeholder="tu@celya.co" required />
        </div>
        <SubmitButton className="w-full">Enviar enlace</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          Volver a iniciar sesión
        </Link>
      </p>
    </Card>
  );
}
