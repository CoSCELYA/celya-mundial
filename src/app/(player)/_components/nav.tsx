"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
};

const ITEMS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/partidos", label: "Partidos" },
  { href: "/tabla", label: "Tabla" },
  { href: "/premios", label: "Premios" },
  { href: "/reglas", label: "Reglas" },
];

/** Top navigation for the player area, highlights the active route in yellow. */
export function PlayerNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 sm:gap-2">
      {ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white",
              active &&
                "text-accent underline decoration-accent decoration-2 underline-offset-8 hover:text-accent",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
