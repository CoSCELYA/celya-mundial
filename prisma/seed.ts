import { PrismaClient, Phase } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Load .env when run directly (e.g. `tsx prisma/seed.ts`).
try {
  process.loadEnvFile();
} catch {
  /* env already provided by the platform */
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 1),
});
const prisma = new PrismaClient({ adapter });

type TeamSeed = { name: string; fifaCode: string; flagEmoji: string; group: string };

// 2026 FIFA World Cup final draw (Dec 5, 2025), names in Spanish.
const TEAMS: TeamSeed[] = [
  // Group A
  { name: "México", fifaCode: "MEX", flagEmoji: "🇲🇽", group: "A" },
  { name: "Sudáfrica", fifaCode: "RSA", flagEmoji: "🇿🇦", group: "A" },
  { name: "Corea del Sur", fifaCode: "KOR", flagEmoji: "🇰🇷", group: "A" },
  { name: "República Checa", fifaCode: "CZE", flagEmoji: "🇨🇿", group: "A" },
  // Group B
  { name: "Canadá", fifaCode: "CAN", flagEmoji: "🇨🇦", group: "B" },
  { name: "Bosnia y Herzegovina", fifaCode: "BIH", flagEmoji: "🇧🇦", group: "B" },
  { name: "Catar", fifaCode: "QAT", flagEmoji: "🇶🇦", group: "B" },
  { name: "Suiza", fifaCode: "SUI", flagEmoji: "🇨🇭", group: "B" },
  // Group C
  { name: "Brasil", fifaCode: "BRA", flagEmoji: "🇧🇷", group: "C" },
  { name: "Marruecos", fifaCode: "MAR", flagEmoji: "🇲🇦", group: "C" },
  { name: "Haití", fifaCode: "HAI", flagEmoji: "🇭🇹", group: "C" },
  { name: "Escocia", fifaCode: "SCO", flagEmoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C" },
  // Group D
  { name: "Estados Unidos", fifaCode: "USA", flagEmoji: "🇺🇸", group: "D" },
  { name: "Paraguay", fifaCode: "PAR", flagEmoji: "🇵🇾", group: "D" },
  { name: "Australia", fifaCode: "AUS", flagEmoji: "🇦🇺", group: "D" },
  { name: "Turquía", fifaCode: "TUR", flagEmoji: "🇹🇷", group: "D" },
  // Group E
  { name: "Alemania", fifaCode: "GER", flagEmoji: "🇩🇪", group: "E" },
  { name: "Curazao", fifaCode: "CUW", flagEmoji: "🇨🇼", group: "E" },
  { name: "Costa de Marfil", fifaCode: "CIV", flagEmoji: "🇨🇮", group: "E" },
  { name: "Ecuador", fifaCode: "ECU", flagEmoji: "🇪🇨", group: "E" },
  // Group F
  { name: "Países Bajos", fifaCode: "NED", flagEmoji: "🇳🇱", group: "F" },
  { name: "Japón", fifaCode: "JPN", flagEmoji: "🇯🇵", group: "F" },
  { name: "Suecia", fifaCode: "SWE", flagEmoji: "🇸🇪", group: "F" },
  { name: "Túnez", fifaCode: "TUN", flagEmoji: "🇹🇳", group: "F" },
  // Group G
  { name: "Bélgica", fifaCode: "BEL", flagEmoji: "🇧🇪", group: "G" },
  { name: "Egipto", fifaCode: "EGY", flagEmoji: "🇪🇬", group: "G" },
  { name: "Irán", fifaCode: "IRN", flagEmoji: "🇮🇷", group: "G" },
  { name: "Nueva Zelanda", fifaCode: "NZL", flagEmoji: "🇳🇿", group: "G" },
  // Group H
  { name: "España", fifaCode: "ESP", flagEmoji: "🇪🇸", group: "H" },
  { name: "Cabo Verde", fifaCode: "CPV", flagEmoji: "🇨🇻", group: "H" },
  { name: "Arabia Saudita", fifaCode: "KSA", flagEmoji: "🇸🇦", group: "H" },
  { name: "Uruguay", fifaCode: "URU", flagEmoji: "🇺🇾", group: "H" },
  // Group I
  { name: "Francia", fifaCode: "FRA", flagEmoji: "🇫🇷", group: "I" },
  { name: "Senegal", fifaCode: "SEN", flagEmoji: "🇸🇳", group: "I" },
  { name: "Irak", fifaCode: "IRQ", flagEmoji: "🇮🇶", group: "I" },
  { name: "Noruega", fifaCode: "NOR", flagEmoji: "🇳🇴", group: "I" },
  // Group J
  { name: "Argentina", fifaCode: "ARG", flagEmoji: "🇦🇷", group: "J" },
  { name: "Argelia", fifaCode: "ALG", flagEmoji: "🇩🇿", group: "J" },
  { name: "Austria", fifaCode: "AUT", flagEmoji: "🇦🇹", group: "J" },
  { name: "Jordania", fifaCode: "JOR", flagEmoji: "🇯🇴", group: "J" },
  // Group K
  { name: "Portugal", fifaCode: "POR", flagEmoji: "🇵🇹", group: "K" },
  { name: "RD Congo", fifaCode: "COD", flagEmoji: "🇨🇩", group: "K" },
  { name: "Uzbekistán", fifaCode: "UZB", flagEmoji: "🇺🇿", group: "K" },
  { name: "Colombia", fifaCode: "COL", flagEmoji: "🇨🇴", group: "K" },
  // Group L
  { name: "Inglaterra", fifaCode: "ENG", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L" },
  { name: "Croacia", fifaCode: "CRO", flagEmoji: "🇭🇷", group: "L" },
  { name: "Ghana", fifaCode: "GHA", flagEmoji: "🇬🇭", group: "L" },
  { name: "Panamá", fifaCode: "PAN", flagEmoji: "🇵🇦", group: "L" },
];

// Round-robin pairings for 4 teams (indices within a group).
const RR: [number, number][] = [
  [0, 1],
  [2, 3],
  [0, 2],
  [3, 1],
  [3, 0],
  [1, 2],
];

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 3_600_000);
}
function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

async function main() {
  console.log("🌱 Sembrando base de datos…");

  // Clean (idempotent re-seed)
  await prisma.pointsEntry.deleteMany();
  await prisma.questionAnswer.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.championPick.deleteMany();
  await prisma.question.deleteMany();
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();
  await prisma.prize.deleteMany();

  // Teams
  const teamByCode = new Map<string, number>();
  for (const t of TEAMS) {
    const created = await prisma.team.create({
      data: { name: t.name, fifaCode: t.fifaCode, flagEmoji: t.flagEmoji, groupName: t.group },
    });
    teamByCode.set(t.fifaCode, created.id);
  }
  console.log(`  ✔ ${TEAMS.length} equipos`);

  // Group-stage matches (72)
  const groupStart = new Date("2026-06-11T17:00:00.000Z");
  let seq = 0;
  const matchIds: number[] = [];
  const groupMatchIds: number[] = [];

  for (let g = 0; g < 12; g++) {
    const letter = GROUP_LETTERS[g];
    const groupTeams = TEAMS.filter((t) => t.group === letter);
    for (const [h, a] of RR) {
      const day = Math.floor(seq / 4);
      const slot = seq % 4; // 4 matches per day at 3h intervals
      const kickoff = addHours(addDays(groupStart, day), slot * 3);
      const m = await prisma.match.create({
        data: {
          phase: Phase.GROUP,
          groupName: letter,
          homeTeamId: teamByCode.get(groupTeams[h].fifaCode)!,
          awayTeamId: teamByCode.get(groupTeams[a].fifaCode)!,
          kickoffAt: kickoff,
          venue: null,
          status: "SCHEDULED",
        },
      });
      matchIds.push(m.id);
      groupMatchIds.push(m.id);
      seq++;
    }
  }
  console.log(`  ✔ 72 partidos de fase de grupos`);

  // Knockout matches (placeholders, teams TBD)
  const knockout: { phase: Phase; count: number; start: string; label: string }[] = [
    { phase: Phase.R32, count: 16, start: "2026-06-28T17:00:00.000Z", label: "Dieciseisavos" },
    { phase: Phase.R16, count: 8, start: "2026-07-04T17:00:00.000Z", label: "Octavos" },
    { phase: Phase.QF, count: 4, start: "2026-07-09T17:00:00.000Z", label: "Cuartos" },
    { phase: Phase.SF, count: 2, start: "2026-07-14T19:00:00.000Z", label: "Semifinal" },
    { phase: Phase.THIRD, count: 1, start: "2026-07-18T19:00:00.000Z", label: "Tercer puesto" },
    { phase: Phase.FINAL, count: 1, start: "2026-07-19T19:00:00.000Z", label: "Final" },
  ];

  for (const ko of knockout) {
    const start = new Date(ko.start);
    for (let i = 0; i < ko.count; i++) {
      const kickoff = addHours(addDays(start, Math.floor(i / 2)), (i % 2) * 4);
      const m = await prisma.match.create({
        data: {
          phase: ko.phase,
          groupName: null,
          label: `${ko.label} ${i + 1}`,
          homeTeamId: null,
          awayTeamId: null,
          kickoffAt: kickoff,
          status: "SCHEDULED",
        },
      });
      matchIds.push(m.id);
    }
  }
  console.log(`  ✔ 32 partidos de eliminatorias (equipos por definir)`);

  // Trivia solo en fase de grupos (las eliminatorias son solo marcador).
  let qn = 1;
  for (const id of groupMatchIds) {
    await prisma.question.create({
      data: {
        matchId: id,
        text: `Pregunta de negocio #${qn} — editar desde el panel de administración`,
        options: ["Opción A", "Opción B", "Opción C", "Opción D"],
        correctOption: 0,
        status: "ACTIVE",
      },
    });
    qn++;
  }
  console.log(`  ✔ ${groupMatchIds.length} preguntas de trivia (solo grupos)`);

  // Scoring config
  await prisma.scoringConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  console.log("  ✔ Configuración de puntaje por defecto");

  // Sample prizes
  await prisma.prize.createMany({
    data: [
      { position: 1, name: "Primer lugar", description: "Premio mayor para el líder de la polla", status: "ACTIVE" },
      { position: 2, name: "Segundo lugar", description: "Premio para el subcampeón de la polla", status: "ACTIVE" },
      { position: 3, name: "Tercer lugar", description: "Premio para el tercer puesto", status: "ACTIVE" },
    ],
  });
  console.log("  ✔ Premios de ejemplo");

  // Super admin
  const email = process.env.SUPERADMIN_EMAIL ?? "admin@celya.co";
  const password = process.env.SUPERADMIN_PASSWORD ?? "Celya2026*";
  const name = process.env.SUPERADMIN_NAME ?? "Super Administrador";
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { role: "SUPER_ADMIN", status: "ACTIVE", passwordHash, fullName: name },
    create: { email, fullName: name, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE" },
  });
  console.log(`  ✔ Super administrador: ${email}`);

  console.log("✅ Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
