import { requireSession } from "@/lib/auth";
import { getScoringConfig } from "@/lib/scoring";
import { BookOpen, ClipboardList, Crown, HandHeart, Target } from "lucide-react";

export default async function ReglasPage() {
  await requireSession();

  const cfg = await getScoringConfig();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-accent/20 text-accent">
          <BookOpen className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Instrucciones y Reglas
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Todo lo que necesitas saber para jugar la Polla Mundialista 2026.
        </p>
      </header>

      <div className="space-y-6">
        <Section icon={<ClipboardList className="size-5 text-accent" />} title="Cómo jugar">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-white/80 marker:text-accent marker:font-semibold">
            <li>
              Antes de cada partido, responde la pregunta de trivia. Es obligatorio responderla
              para poder registrar tu marcador.
            </li>
            <li>
              Registra tu marcador del partido (goles del local y del visitante) hasta{" "}
              <strong className="text-white">1 hora antes</strong> del inicio. Después de ese
              momento se cierra y no podrás cambiarlo.
            </li>
            <li>
              Cuando el partido termine y se cargue el resultado oficial, se calcularán tus puntos
              automáticamente.
            </li>
          </ol>
        </Section>

        <Section icon={<Target className="size-5 text-accent" />} title="Puntaje">
          <ul className="space-y-2 text-sm text-white/80">
            <ScoreRow label="Marcador exacto" points={cfg.exactPts} />
            <ScoreRow label="Resultado acertado (ganador o empate)" points={cfg.resultPts} />
            <ScoreRow label="Trivia respondida correctamente" points={cfg.triviaPts} />
            <ScoreRow label="Campeón acertado" points={cfg.championPts} />
            <ScoreRow label="Subcampeón acertado" points={cfg.runnerUpPts} />
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-white/50">
            El marcador exacto y el resultado acertado no se suman entre sí: cada partido otorga el
            mayor de los dos.
          </p>
        </Section>

        <Section icon={<Crown className="size-5 text-accent" />} title="Campeón y Subcampeón">
          <p className="text-sm leading-relaxed text-white/80">
            Elige quién levantará la copa y quién quedará en segundo lugar. Puedes editar tu
            selección hasta que comiencen los <strong className="text-white">Octavos de final</strong>.
            Una vez iniciada esa fase, tu elección queda bloqueada.
          </p>
        </Section>

        <Section icon={<HandHeart className="size-5 text-accent" />} title="Fair play">
          <p className="text-sm leading-relaxed text-white/80">
            Juega limpio: cada participante registra sus propios pronósticos y respuestas. No
            compartas cuentas ni intentes modificar marcadores fuera de tiempo. El objetivo es
            disfrutar el Mundial en equipo y que gane el mejor pronosticador. ¡Buena suerte!
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ScoreRow({ label, points }: { label: string; points: number }) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span>{label}</span>
      <span className="shrink-0 rounded-md bg-accent/20 px-2 py-0.5 text-sm font-bold text-accent tnum">
        {points} {points === 1 ? "pt" : "pts"}
      </span>
    </li>
  );
}
