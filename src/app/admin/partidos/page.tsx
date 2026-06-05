import { Trophy } from "lucide-react";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { PHASE_LABEL } from "@/lib/constants";
import { isSyncConfigured } from "@/lib/football-data";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Flag } from "@/components/flag";

import { ResultDialog } from "./_components/result-dialog";
import { SyncButton } from "./_components/sync-button";

const TH = "px-3 py-2 text-left text-[11px] uppercase tracking-wide text-muted-foreground font-semibold";
const TD = "px-3 py-3 align-middle text-sm text-foreground";

export default async function PartidosPage() {
  await requireAdmin();

  // Orden por fase (grupos → final, según el enum) y luego por fecha.
  const matches = await prisma.match.findMany({
    orderBy: [{ phase: "asc" }, { kickoffAt: "asc" }],
    include: { homeTeam: true, awayTeam: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Gestión de Partidos</h1>
          <p className="text-sm text-muted-foreground">
            Los 104 partidos oficiales del Mundial. Los equipos de eliminatorias y los
            marcadores se actualizan automáticamente desde la sincronización.
          </p>
        </div>
        <SyncButton configured={isSyncConfigured()} />
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
                  <th className={`${TH} text-right`}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => {
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
                            <Flag code={m.homeTeam?.fifaCode} size={16} />
                            <span className="font-medium">{homeName}</span>
                          </span>
                          <span className="tnum font-semibold text-foreground">
                            {hasScore ? `${m.homeScore} - ${m.awayScore}` : "—"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium">{awayName}</span>
                            <Flag code={m.awayTeam?.fifaCode} size={16} />
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
                        <ResultDialog
                          match={{
                            id: m.id,
                            phase: m.phase,
                            homeName,
                            awayName,
                            homeCode: m.homeTeam?.fifaCode ?? null,
                            awayCode: m.awayTeam?.fifaCode ?? null,
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
