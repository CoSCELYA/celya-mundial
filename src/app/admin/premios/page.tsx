import { Gift, Trophy } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deletePrize } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PrizeDialog } from "./_components/prize-dialog";

export default async function PremiosPage() {
  await requireAdmin();

  const rows = await prisma.prize.findMany();

  // Ordena por posición ascendente, dejando los sin posición (null) al final.
  const prizes = [...rows].sort((a, b) => {
    if (a.position == null && b.position == null) return a.id - b.id;
    if (a.position == null) return 1;
    if (b.position == null) return -1;
    return a.position - b.position;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Premios</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los premios de la polla mundialista.
          </p>
        </div>
        <PrizeDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de premios</CardTitle>
        </CardHeader>
        <CardContent>
          {prizes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Trophy className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aún no hay premios registrados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    <th className="py-2 pr-4">Posición</th>
                    <th className="py-2 pr-4">Imagen</th>
                    <th className="py-2 pr-4">Premio</th>
                    <th className="py-2 pr-4">Descripción</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {prizes.map((prize) => (
                    <tr
                      key={prize.id}
                      className="border-b border-border last:border-0 align-middle"
                    >
                      <td className="py-3 pr-4 tnum font-medium text-foreground">
                        {prize.position != null ? `#${prize.position}` : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        {prize.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={prize.imageUrl}
                            alt={prize.name}
                            className="size-10 rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                            <Gift className="size-4" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {prize.name}
                      </td>
                      <td className="py-3 pr-4 max-w-xs text-muted-foreground">
                        {prize.description || "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={prize.status} />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <PrizeDialog
                            prize={{
                              id: prize.id,
                              position: prize.position,
                              name: prize.name,
                              description: prize.description,
                              imageUrl: prize.imageUrl,
                              status: prize.status,
                            }}
                          />
                          <form action={deletePrize}>
                            <input type="hidden" name="id" value={prize.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              Eliminar
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
