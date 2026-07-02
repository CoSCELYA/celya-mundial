import { requireSession } from "@/lib/auth";
import { getScoringConfig } from "@/lib/scoring";
import { PHASE_LABEL } from "@/lib/constants";
import {
  BookOpen,
  ClipboardList,
  Crown,
  HandHeart,
  ListOrdered,
  Swords,
  Target,
} from "lucide-react";

function lockLabel(minutes: number): string {
  if (minutes <= 0) return "el inicio del partido";
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} ${h === 1 ? "hora" : "horas"} antes`;
  }
  return `${minutes} minutos antes`;
}

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
              En la <strong className="text-white">fase de grupos</strong>, antes de cada partido
              responde la pregunta de trivia (obligatoria para registrar tu marcador). En las{" "}
              <strong className="text-white">eliminatorias</strong> no hay trivia: registras solo el
              marcador.
            </li>
            <li>
              Registra tu marcador del partido (goles del local y del visitante) hasta{" "}
              <strong className="text-white">{lockLabel(cfg.lockMinutes)}</strong> del inicio.
              Después de ese momento se cierra y no podrás cambiarlo.
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

        <Section
          icon={<Swords className="size-5 text-accent" />}
          title="Puntaje en eliminatorias (desde octavos)"
        >
          <p className="text-sm leading-relaxed text-white/80">
            Desde <strong className="text-white">octavos de final</strong> ya no necesitas acertar el
            resultado exacto para sumar: lo importante es acertar{" "}
            <strong className="text-white">quién clasifica</strong>.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <ScoreRow label="Marcador exacto de los 90'/prórroga" points={cfg.exactPts} />
            <ScoreRow label="Acertar quién clasifica" points={cfg.resultPts} />
          </ul>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-white/50">
            <li>
              Tu equipo que clasifica es el que pusiste con más goles. Si aciertas quién avanza —
              aunque el partido se defina por penales— ganas los puntos.
            </li>
            <li>
              Los penales no cuentan para el marcador: solo definen quién avanza. El marcador exacto
              se refiere a los 90 minutos (o la prórroga).
            </li>
            <li>Si pronosticas un empate, solo sumas acertando el marcador exacto.</li>
            <li>
              Los <strong className="text-white/70">dieciseisavos</strong> mantienen el puntaje por
              resultado (ganador/empate), porque esa ronda ya había comenzado.
            </li>
          </ul>
        </Section>

        <Section
          icon={<ListOrdered className="size-5 text-accent" />}
          title="Posiciones y desempates"
        >
          <p className="text-sm leading-relaxed text-white/80">
            La tabla de posiciones se ordena así:
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-white/80 marker:font-semibold marker:text-accent">
            <li>
              <strong className="text-white">Puntos totales</strong> (de mayor a menor).
            </li>
            <li>
              <strong className="text-white">Más marcadores exactos</strong> (desempate
              deportivo).
            </li>
            <li>
              <strong className="text-white">Más resultados acertados</strong>.
            </li>
            <li>
              <strong className="text-white">Aleatorio</strong>, rebarajado cada vez que se
              recalculan los puntos.
            </li>
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-white/50">
            El criterio aleatorio solo decide cuando dos jugadores quedan iguales en puntos,
            marcadores exactos y resultados acertados.
          </p>
        </Section>

        <Section icon={<Crown className="size-5 text-accent" />} title="Campeón y Subcampeón">
          <p className="text-sm leading-relaxed text-white/80">
            Elige quién levantará la copa y quién quedará en segundo lugar. Puedes editar tu
            selección hasta que comience la fase de{" "}
            <strong className="text-white">{PHASE_LABEL[cfg.championLockPhase]}</strong>. Una vez
            iniciada esa fase, tu elección queda bloqueada.
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
