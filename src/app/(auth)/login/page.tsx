"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, null);

  return (
    <Card className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Iniciar sesión</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Ingresa con tu correo y contraseña.
      </p>
      <form action={action} className="space-y-4">
        <FormMessage state={state} />
        <div>
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" placeholder="tu@empresa.com" required />
        </div>
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" placeholder="••••••••" required />
        </div>
        <SubmitButton className="w-full">Ingresar</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-foreground hover:underline">
          Regístrate con tu correo corporativo
        </Link>
      </p>
    </Card>
  );
}
