import type { Phase } from "@prisma/client";

export const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

export const PHASE_LABEL: Record<Phase, string> = {
  GROUP: "Fase de Grupos",
  R32: "Dieciseisavos",
  R16: "Octavos",
  QF: "Cuartos",
  SF: "Semifinal",
  THIRD: "Tercer puesto",
  FINAL: "Final",
};

/** Order used to render phases (group first, final last). */
export const PHASE_ORDER: Phase[] = ["GROUP", "R32", "R16", "QF", "SF", "THIRD", "FINAL"];

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  EMPLEADO: "Empleado",
};
