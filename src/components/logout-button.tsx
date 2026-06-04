"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/ui/submit-button";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";

export function LogoutButton({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: ButtonVariant;
}) {
  return (
    <form action={logoutAction}>
      <SubmitButton variant={variant} size="sm" className={className}>
        <LogOut className="size-4" />
        Cerrar sesión
      </SubmitButton>
    </form>
  );
}
