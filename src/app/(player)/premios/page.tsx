import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Gift, Trophy } from "lucide-react";

export default async function PremiosPage() {
  await requireSession();

  const prizes = await prisma.prize.findMany({
    where: { status: "ACTIVE" },
    orderBy: { position: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/20 text-accent">
          <Gift className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Premios</h1>
        <p className="mt-2 text-sm text-white/70">
          Estos son los premios en juego de la Polla Mundialista 2026.
        </p>
      </header>

      {prizes.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-12 text-center text-sm text-white/70 backdrop-blur">
          Aún no hay premios publicados. ¡Muy pronto!
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prizes.map((prize) => (
            <article
              key={prize.id}
              className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur"
            >
              <div className="relative flex aspect-video items-center justify-center bg-white/5">
                {prize.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={prize.imageUrl}
                    alt={prize.name}
                    className="h-full w-full object-cover"
                  />
                ) : prize.position === 1 ? (
                  <Trophy className="size-16 text-accent" />
                ) : (
                  <Gift className="size-16 text-accent" />
                )}
                {prize.position != null && (
                  <span className="absolute left-3 top-3 flex size-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground tnum">
                    {prize.position}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-base font-semibold text-white">{prize.name}</h2>
                {prize.description && (
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{prize.description}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
