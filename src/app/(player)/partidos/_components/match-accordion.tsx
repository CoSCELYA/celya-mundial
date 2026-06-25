"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Sección plegable de partidos. Permite cerrar los partidos ya jugados y dejar
 * a la vista solo los próximos o en juego.
 */
export function MatchAccordion({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left backdrop-blur transition-colors hover:bg-white/10"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          {title}
          <span className="tnum rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">
            {count}
          </span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 text-white/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && <div className="grid gap-3 sm:grid-cols-2">{children}</div>}
    </section>
  );
}
