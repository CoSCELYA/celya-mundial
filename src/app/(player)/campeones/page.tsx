import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChampionPick } from "@/lib/queries";
import { isChampionPickOpen } from "@/lib/scoring";
import { Trophy, Medal, Lock } from "lucide-react";
import { Flag } from "@/components/flag";
import { ChampionForm } from "./_components/champion-form";

export default async function CampeonesPage() {
  const session = await requireSession();

  const [teams, pick, open] = await Promise.all([
    prisma.team.findMany({ orderBy: [{ groupName: "asc" }, { name: "asc" }] }),
    getChampionPick(session.userId),
    isChampionPickOpen(),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/20 text-accent">
          <Trophy className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Ingresa tu campeón y subcampeón
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Elige quién levantará la copa y quién quedará segundo en el Mundial 2026.
        </p>
      </header>

      {open ? (
        <ChampionForm
          teams={teams}
          championTeamId={pick?.championTeamId ?? null}
          runnerUpTeamId={pick?.runnerUpTeamId ?? null}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 backdrop-blur">
            <Lock className="size-4 shrink-0 text-accent" />
            <span>La selección está cerrada.</span>
          </div>

          {pick ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <PickCard
                label="Campeón"
                icon={<Trophy className="size-4 text-accent" />}
                fifaCode={pick.championTeam.fifaCode}
                name={pick.championTeam.name}
              />
              <PickCard
                label="Subcampeón"
                icon={<Medal className="size-4 text-white/70" />}
                fifaCode={pick.runnerUpTeam.fifaCode}
                name={pick.runnerUpTeam.name}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/70 backdrop-blur">
              No registraste una selección de campeón y subcampeón.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PickCard({
  label,
  icon,
  fifaCode,
  name,
}: {
  label: string;
  icon: React.ReactNode;
  fifaCode: string;
  name: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur">
      <div className="mb-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/60">
        {icon}
        {label}
      </div>
      <div className="flex justify-center">
        <Flag code={fifaCode} size={40} />
      </div>
      <div className="mt-3 text-base font-semibold text-white">{name}</div>
    </div>
  );
}
