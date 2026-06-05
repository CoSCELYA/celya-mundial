import type { ReactNode } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { requireSession, isAdminRole } from "@/lib/auth";
import { LogoBrand } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { PlayerNav } from "@/app/(player)/_components/nav";

export default async function PlayerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const s = await requireSession();
  const isAdmin = isAdminRole(s.role);

  return (
    <div className="festive-bg min-h-screen overflow-x-hidden text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/" aria-label="Inicio" className="shrink-0">
              <LogoBrand className="h-7 w-auto" />
            </Link>
            <PlayerNav isAdmin={isAdmin} />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white sm:flex"
              >
                <Shield className="size-4" />
                Admin
              </Link>
            )}
            <span className="hidden text-sm font-medium text-white/80 sm:inline">
              {s.name}
            </span>
            <LogoutButton variant="ghost" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
