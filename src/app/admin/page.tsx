import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/queries";
import { formatDateTime } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flag } from "@/components/flag";
import { cn } from "@/lib/cn";

type Stat = {
  label: string;
  value: number;
  highlight?: boolean;
};

function StatCard({ label, value, highlight }: Stat) {
  return (
    <Card className={cn("p-5", highlight && "border-l-4 border-l-accent")}>
      <div className="text-[30px] font-semibold leading-none tnum">{value}</div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </Card>
  );
}

function TeamLabel({
  team,
}: {
  team: { name: string; fifaCode: string } | null;
}) {
  if (!team) {
    return <span className="text-muted-foreground">Por definir</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Flag code={team.fifaCode} size={20} />
      <span>{team.name}</span>
    </span>
  );
}

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [
    totalUsers,
    pendingUsers,
    totalMatches,
    finishedMatches,
    totalQuestions,
    upcomingMatches,
    standings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.match.count(),
    prisma.match.count({ where: { status: "FINISHED" } }),
    prisma.question.count(),
    prisma.match.findMany({
      orderBy: { kickoffAt: "asc" },
      take: 5,
      include: { homeTeam: true, awayTeam: true },
    }),
    getStandings(),
  ]);

  const topFive = standings.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Resumen general</h2>
        <p className="text-sm text-muted-foreground">
          Vista rápida del estado de la polla.
        </p>
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total usuarios" value={totalUsers} />
        <StatCard
          label="Pendientes de aprobación"
          value={pendingUsers}
          highlight
        />
        <StatCard label="Total partidos" value={totalMatches} />
        <StatCard label="Partidos finalizados" value={finishedMatches} />
        <StatCard label="Total preguntas" value={totalQuestions} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming matches */}
        <Card>
          <CardHeader>
            <CardTitle>Próximos partidos</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay partidos programados.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingMatches.map((match) => (
                  <li
                    key={match.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                      <span className="flex flex-wrap items-center gap-1.5 font-medium">
                        <TeamLabel team={match.homeTeam} />
                        <span className="text-muted-foreground">vs</span>
                        <TeamLabel team={match.awayTeam} />
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {formatDateTime(match.kickoffAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top 5 standings */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 tabla</CardTitle>
          </CardHeader>
          <CardContent>
            {topFive.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay jugadores en la tabla.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {topFive.map((row) => (
                  <li
                    key={row.userId}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground tnum">
                        {row.rank}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {row.fullName}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tnum">
                      {row.totalPoints}
                      <span className="ml-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        pts
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
