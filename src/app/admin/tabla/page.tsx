import { requireAdmin } from "@/lib/auth";
import { getStandings } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { Trophy } from "lucide-react";

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const MEDALLA: Record<number, string> = {
  1: "text-accent",
  2: "text-muted-foreground",
  3: "text-brand-orange",
};

export default async function TablaPage() {
  await requireAdmin();
  const standings = await getStandings();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Tabla de Posiciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Ranking general de jugadores por puntos acumulados.
        </p>
      </header>

      {standings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Trophy className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Aún no hay posiciones
              </p>
              <p className="text-sm text-muted-foreground">
                Cuando los jugadores acumulen puntos, aparecerán aquí.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      #
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Usuario
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Nombre completo
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Aciertos exactos
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Total puntos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => {
                    const esPodio = row.rank <= 3;
                    return (
                      <tr
                        key={row.userId}
                        className="border-b border-border last:border-0 transition-colors hover:bg-muted/50"
                      >
                        <td className="px-5 py-3 align-middle">
                          <div className="flex items-center gap-2">
                            {esPodio ? (
                              <Trophy
                                className={cn("size-4", MEDALLA[row.rank])}
                              />
                            ) : (
                              <span
                                aria-hidden
                                className="size-2 rounded-full bg-muted-foreground/30"
                              />
                            )}
                            <span className="tnum font-semibold text-foreground">
                              {row.rank}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-black text-xs font-bold text-brand-yellow">
                              {iniciales(row.fullName)}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {row.email}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 align-middle font-medium text-foreground">
                          {row.fullName}
                        </td>
                        <td className="px-5 py-3 align-middle text-right">
                          <span className="tnum text-foreground">
                            {row.exactCount}
                          </span>
                        </td>
                        <td className="px-5 py-3 align-middle text-right">
                          <span className="tnum inline-flex min-w-12 items-center justify-center rounded-md bg-brand-black px-2.5 py-1 text-sm font-bold text-brand-yellow">
                            {row.totalPoints}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
