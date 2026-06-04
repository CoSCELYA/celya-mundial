"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";
import { registerAction } from "../actions";

export default function RegisterPage() {
  const [state, action] = useActionState(registerAction, null);

  return (
    <Card className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Crear cuenta</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Regístrate con tu correo corporativo de celya.
      </p>
      <form action={action} className="space-y-4">
        <FormMessage state={state} />
        <div>
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" name="fullName" placeholder="Tu nombre" required />
        </div>
        <div>
          <Label htmlFor="documento">Documento (opcional)</Label>
          <Input id="documento" name="documento" placeholder="Cédula / ID" />
        </div>
        <div>
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" placeholder="tu@celya.co" required />
        </div>
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" placeholder="Mínimo 6 caracteres" required />
        </div>
        <SubmitButton className="w-full">Registrarme</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}
