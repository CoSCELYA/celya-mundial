/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/cn";

/** celya logo that adapts to light/dark. Uses black logo in light, white in dark. */
export function Logo({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/logos/LOGO_NEGRO.svg"
        alt="celya · Polla Mundialista"
        className={cn("block dark:hidden", className)}
      />
      <img
        src="/logos/LOGO_BLANCO.svg"
        alt="celya · Polla Mundialista"
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}

/** Brand logo (black + yellow) for festive / always-dark surfaces. */
export function LogoBrand({ className }: { className?: string }) {
  return (
    <img
      src="/logos/LOGO_BLANCO.svg"
      alt="celya · Polla Mundialista"
      className={className}
    />
  );
}
