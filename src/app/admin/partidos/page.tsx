import { Pencil, Trophy } from "lucide-react";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { PHASE_LABEL } from "@/lib/constants";
import { deleteMatch } from "@/app/admin/actions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";

import { MatchDialog, type TeamOption } from "./_components/match-dialog";
import { ResultDialog } from "./_components/result-dialog";

const TH = "px-3 py-2 text-left text-[11px] uppercase tracking-wide text-muted-foreground font-semibold";
const TD = "px-3 py-3 align-middle text-sm text-foreground";

export default async function PartidosPage() {
  await requireAdmin();

  const [matches, teams] = await Promise.all([
    prisma.match.findMany({
      orderBy: { kickoffAt: "asc" },
      include: { homeTeam: true, awayTeam: true },
    }),
    prisma.team.findMany({ orderBy: [{ groupName: "asc" }, { name: "asc" }] }),
  ]);

  const teamOptions: TeamOption[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    flagEmoji: t.flagEmoji,
    groupName: t.groupName,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Gestión de Partidos</h1>
          <p className="text-sm text-muted-foreground">
            Programa los encuentros y actualiza los marcadores en tiempo real.
          </p>
        </div>
        <MatchDialog teams={teamOptions} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partidos ({matches.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Fecha / Hora</th>
                  <th className={TH}>Encuentro y marcador</th>
                  <th className={TH}>Fase / Grupo</th>
                  <th className={TH}>Estado</th>
                  <th className={`${TH} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td className={`${TD} text-muted-foreground`} colSpan={5}>
                      Aún no hay partidos programados.
                    </td>
                  </tr>
                ) : (
                  matches.map((m) => {
                    const homeName = m.homeTeam?.name ?? m.label ?? "Por definir";
                    const awayName = m.awayTeam?.name ?? "Por definir";
                    const hasScore = m.homeScore != null && m.awayScore != null;
                    return (
                      <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                          {formatDateTime(m.kickoffAt)}
                          {m.venue ? (
                            <div className="text-[11px] text-muted-foreground/80">{m.venue}</div>
                          ) : null}
                        </td>
                        <td className={TD}>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5">
                              <span className="text-lg leading-none">{m.homeTeam?.flagEmoji ?? "🏳️"}</span>
                              <span className="font-medium">{homeName}</span>
                            </span>
                            <span className="tnum font-semibold text-foreground">
                              {hasScore ? `${m.homeScore} - ${m.awayScore}` : "—"}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="font-medium">{awayName}</span>
                              <span className="text-lg leading-none">{m.awayTeam?.flagEmoji ?? "🏳️"}</span>
                            </span>
                          </div>
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {PHASE_LABEL[m.phase]}
                          {m.groupName ? (
                            <span className="text-muted-foreground"> · Grupo {m.groupName}</span>
                          ) : null}
                        </td>
                        <td className={TD}>
                          <StatusBadge status={m.status} />
                        </td>
                        <td className={`${TD} text-right`}>
                          <div className="flex items-center justify-end gap-1.5">
                            <ResultDialog
                              match={{
                                id: m.id,
                                homeName,
                                awayName,
                                homeFlag: m.homeTeam?.flagEmoji ?? "🏳️",
                                awayFlag: m.awayTeam?.flagEmoji ?? "🏳️",
                                homeScore: m.homeScore,
                                awayScore: m.awayScore,
                                status: m.status,
                              }}
                              trigger={
                                <span className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted">
                                  <Trophy className="size-4" />
                                  Resultado
                                </span>
                              }
                            />
                            <MatchDialog
                              teams={teamOptions}
                              match={{
                                id: m.id,
                                phase: m.phase,
                                groupName: m.groupName,
                                homeTeamId: m.homeTeamId,
                                awayTeamId: m.awayTeamId,
                                kickoffAt: m.kickoffAt.toISOString(),
                                venue: m.venue,
                              }}
                              trigger={
                                <span className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted">
                                  <Pencil className="size-4" />
                                  Editar
                                </span>
                              }
                            />
                            <form action={deleteMatch}>
                              <input type="hidden" name="id" value={m.id} />
                              <SubmitButton variant="danger" size="sm">
                                Eliminar
                              </SubmitButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
