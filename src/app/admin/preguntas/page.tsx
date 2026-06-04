import { Check, Lock, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PHASE_LABEL } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { deleteQuestion } from "@/app/admin/actions";
import { QuestionDialog } from "./_components/question-dialog";

const TH =
  "px-4 py-2 text-left text-[11px] uppercase tracking-wide text-muted-foreground font-semibold";

function matchTeams(home?: { name: string } | null, away?: { name: string } | null) {
  return `${home?.name ?? "Por definir"} vs ${away?.name ?? "Por definir"}`;
}

export default async function PreguntasPage() {
  await requireAdmin();

  const [questions, matches] = await Promise.all([
    prisma.question.findMany({
      include: {
        match: { include: { homeTeam: true, awayTeam: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.match.findMany({
      include: { homeTeam: true, awayTeam: true },
      orderBy: { kickoffAt: "asc" },
    }),
  ]);

  const matchOptions = matches.map((m) => ({
    id: m.id,
    label: `${PHASE_LABEL[m.phase]} — ${matchTeams(m.homeTeam, m.awayTeam)}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Preguntas de trivia</h1>
          <p className="text-sm text-muted-foreground">
            Una pregunta por partido. Si ya fue respondida queda bloqueada y no
            se puede editar ni eliminar.
          </p>
        </div>
        <QuestionDialog
          matches={matchOptions}
          trigger={
            <>
              <Plus className="size-4" />
              Nueva pregunta
            </>
          }
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={TH}>ID</th>
                <th className={TH}>Pregunta</th>
                <th className={TH}>Opciones</th>
                <th className={TH}>Estado</th>
                <th className={TH}>Bloqueo</th>
                <th className={`${TH} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {questions.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No hay preguntas registradas todavía.
                  </td>
                </tr>
              )}

              {questions.map((q) => {
                const locked = q.lockedAt !== null;
                return (
                  <tr key={q.id} className="border-b border-border align-top">
                    <td className="px-4 py-3 tnum text-muted-foreground">
                      {q.id}
                    </td>

                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-foreground">{q.text}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {PHASE_LABEL[q.match.phase]} ·{" "}
                        {matchTeams(q.match.homeTeam, q.match.awayTeam)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        {q.options.map((opt, i) => {
                          const isCorrect = i === q.correctOption;
                          return (
                            <li
                              key={i}
                              className={
                                isCorrect
                                  ? "flex items-center gap-1.5 font-medium text-success"
                                  : "flex items-center gap-1.5 text-muted-foreground"
                              }
                            >
                              {isCorrect ? (
                                <Check className="size-4 shrink-0" />
                              ) : (
                                <span className="inline-block size-4 shrink-0" />
                              )}
                              <span>{opt}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={q.status} />
                    </td>

                    <td className="px-4 py-3">
                      {locked ? (
                        <Badge tone="neutral">
                          <Lock className="size-3.5" />
                          Bloqueada
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Editable
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {locked ? (
                          <span className="text-xs text-muted-foreground">
                            Bloqueada
                          </span>
                        ) : (
                          <>
                            <QuestionDialog
                              matches={matchOptions}
                              question={{
                                id: q.id,
                                matchId: q.matchId,
                                text: q.text,
                                options: q.options,
                                correctOption: q.correctOption,
                                status: q.status,
                              }}
                              trigger="Editar"
                            />
                            <form action={deleteQuestion}>
                              <input type="hidden" name="id" value={q.id} />
                              <button
                                type="submit"
                                className="text-xs font-medium text-danger hover:underline"
                              >
                                Eliminar
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
