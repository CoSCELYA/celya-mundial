"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  HelpCircle,
  Trophy,
  ListOrdered,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/partidos", label: "Partidos", icon: CalendarDays },
  { href: "/admin/preguntas", label: "Preguntas", icon: HelpCircle },
  { href: "/admin/premios", label: "Premios", icon: Trophy },
  { href: "/admin/tabla", label: "Tabla de posiciones", icon: ListOrdered },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

/** Lateral admin navigation with active-route highlighting. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-accent/15 text-accent hover:bg-accent/15 hover:text-accent",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
