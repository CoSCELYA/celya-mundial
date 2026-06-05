export const meta = {
  name: "polla-flags",
  description: "Reemplaza los emojis de bandera por el componente <Flag> en todas las pantallas",
  phases: [{ title: "Banderas" }],
};

const SPEC = `
Proyecto Next.js 16 + TS. Idioma UI: español. Existe un componente nuevo de banderas en ícono:

  import { Flag } from "@/components/flag";
  // API: <Flag code={fifaCode} size={number} className?={string} />
  //  - code: el código FIFA del equipo (string). Ej: team.fifaCode ("MEX", "BRA"...).
  //  - size: alto en px (el ancho sigue proporción 4:3). Usa tamaños acordes:
  //      ~18-22 en tablas/listas; ~36-44 en cabeceras grandes de partido.

TAREA GENERAL: en el archivo asignado, reemplaza CADA renderizado de bandera por emoji
(p.ej. {team.flagEmoji}, {homeTeam.flagEmoji}, {champion.flagEmoji}, etc.) por <Flag code={...fifaCode} size={...} />.
- El objeto del equipo SIEMPRE tiene la propiedad fifaCode disponible (Prisma incluye todos los campos
  escalares al usar include: { homeTeam: true }; y StandingRow.champion/runnerUp ahora tienen .fifaCode).
  Por lo tanto, donde antes usabas X.flagEmoji ahora usa <Flag code={X.fifaCode} ... />.
- Conserva el tamaño visual: si el emoji era grande (cabecera del partido, p.ej. text-4xl/5xl), usa size ~40.
  Si estaba en una lista/tabla/badge, usa size ~18-22.
- Mantén el resto del layout y estilos. Añade el import de Flag si falta.
- Para equipos "por definir" (homeTeam/awayTeam null) NO renderices Flag (deja el texto "Por definir" como esté).
  Si el código ya hace render condicional del equipo, pon el Flag dentro de esa condición.
- NO cambies lógica, queries ni otros archivos. Solo el archivo asignado.
- Quita referencias a flagEmoji que queden sin uso.
Devuelve un resumen de los cambios.
`;

const files = [
  "src/app/(player)/partidos/[id]/page.tsx",
  "src/app/(player)/partidos/page.tsx",
  "src/app/(player)/page.tsx",
  "src/app/(player)/mis-puntos/page.tsx",
  "src/app/(player)/campeones/_components/champion-form.tsx",
  "src/app/(player)/campeones/page.tsx",
  "src/app/(player)/tabla/page.tsx",
  "src/app/admin/page.tsx",
];

phase("Banderas");
const res = await parallel(
  files.map((f) => () =>
    agent(`${SPEC}\n\nARCHIVO ASIGNADO: \`${f}\`\nLee el archivo, aplica los reemplazos y guárdalo.`, {
      label: f.replace("src/app/", ""),
      phase: "Banderas",
    }),
  ),
);
return { updated: res.filter(Boolean).length };
