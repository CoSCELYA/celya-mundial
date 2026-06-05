"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { syncMatches, type ActionState } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/form-message";

export function SyncButton({ configured }: { configured: boolean }) {
  const [state, formAction] = useActionState<ActionState, FormData>(syncMatches, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={formAction}>
        <SubmitButton variant="primary">
          <RefreshCw className="size-4" />
          Sincronizar resultados
        </SubmitButton>
      </form>
      {!configured ? (
        <p className="max-w-xs text-right text-[11px] text-muted-foreground">
          Configura <code>FOOTBALL_DATA_TOKEN</code> para traer equipos y marcadores automáticamente.
        </p>
      ) : null}
      {state ? (
        <div className="max-w-xs">
          <FormMessage state={state} />
        </div>
      ) : null}
    </div>
  );
}
