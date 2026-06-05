import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { AdminNav } from "@/app/admin/_components/nav";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  const session = await getSession();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-14 items-center border-b border-border px-5">
          <Logo className="h-7 w-auto" />
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <span className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Administración
          </span>
          <AdminNav />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <h1 className="text-sm font-semibold sm:text-base">Panel de administración</h1>
          <div className="flex items-center gap-3">
            {session && (
              <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
                {session.name}
              </span>
            )}
            <LogoutButton />
          </div>
        </header>

        <main className="overflow-x-auto p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
