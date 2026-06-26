"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Shield, X } from "lucide-react";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
};

const ITEMS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/partidos", label: "Partidos" },
  { href: "/pronosticos", label: "Pronósticos" },
  { href: "/tabla", label: "Tabla" },
  { href: "/premios", label: "Premios" },
  { href: "/reglas", label: "Reglas" },
];

/**
 * Navegación del área de jugador. En escritorio muestra los enlaces en línea;
 * en móvil colapsa en un menú hamburguesa (evita el desbordamiento horizontal).
 */
export function PlayerNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Escritorio: enlaces en línea */}
      <nav className="hidden items-center gap-1 sm:flex sm:gap-2">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white",
              isActive(item.href) &&
                "text-accent underline decoration-accent decoration-2 underline-offset-8 hover:text-accent",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Móvil: botón hamburguesa */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        className="inline-flex size-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Móvil: panel desplegable bajo el header */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 top-0 z-40 cursor-default sm:hidden"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute inset-x-0 top-full z-50 border-b border-white/10 bg-[#0a0f1f] shadow-2xl shadow-black/50 sm:hidden">
            <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-3">
              {ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white",
                    isActive(item.href) && "bg-accent/15 text-accent",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Shield className="size-4" />
                  Admin
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
