export const meta = {
  name: "polla-build-ui",
  description: "Construye en paralelo los server actions y todas las pantallas (admin + jugador) de la Polla Mundialista celya",
  phases: [
    { title: "Acciones", detail: "Server actions admin + jugador + utilidades" },
    { title: "Pantallas", detail: "Layouts y páginas admin + jugador en paralelo" },
  ],
};

// ---------------------------------------------------------------------------
// SPEC compartido: todos los agentes reciben esto. Es la fuente de verdad.
// ---------------------------------------------------------------------------
const SPEC = `
# Proyecto: Polla Mundialista — celya (Mundial 2026)
App Next.js 16 (App Router) + TypeScript + Tailwind v4 + Prisma 6 + React 19.
Idioma de toda la UI: ESPAÑOL. cwd del repo: la raíz del proyecto.

## Reglas Next.js 16 (IMPORTANTES, son breaking changes)
- \`params\` y \`searchParams\` en pages/layouts son **Promesas**: tipar como \`Promise<...>\` y \`await\`.
  Ej: \`export default async function P({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; }\`
- Server Components por defecto. Cualquier componente que use hooks (useActionState, useFormStatus, useState, onClick) DEBE empezar con \`"use client"\`.
- Server actions viven en archivos con \`"use server"\` arriba. Se importan en client components.
- Usa \`redirect\` de \`next/navigation\` y \`revalidatePath\` de \`next/cache\` tras mutaciones.
- Alias de imports: \`@/\` = \`src/\`. Ej: \`import { prisma } from "@/lib/db"\`.

## Utilidades existentes (NO las modifiques, solo impórtalas)
- \`@/lib/db\` -> \`prisma\` (PrismaClient).
- \`@/lib/auth\` -> \`requireSession()\`, \`requireAdmin()\`, \`requireSuperAdmin()\`, \`getSession()\`, \`getCurrentUser()\`, \`isAdminRole(role)\`. Todas async; las require* redirigen si no cumple.
- \`@/lib/session\` -> getSession() devuelve \`{ userId:number, role, status, name:string, email:string } | null\`.
- \`@/lib/scoring\` -> \`getScoringConfig()\`, \`recomputeMatchPoints(matchId)\`, \`recomputeChampionPoints()\`, \`isChampionPickOpen()\`, \`predictionPoints(pred, real, cfg)\`.
- \`@/lib/dates\` -> \`formatDateTime(d)\`, \`formatDate(d)\`, \`formatTime(d)\`, \`predictionDeadline(kickoff, lockMinutes)\`, \`isPredictionOpen(kickoff, lockMinutes, now?)\`.
- \`@/lib/queries\` -> \`getStandings()\` (StandingRow[]), \`getUserSummary(userId)\`, \`getChampionPick(userId)\`, \`getScoringConfig\`.
- \`@/lib/constants\` -> \`GROUPS\` (["A".."L"]), \`PHASE_LABEL\` (Record<Phase,string>), \`PHASE_ORDER\` (Phase[]), \`ROLE_LABEL\`.
- \`@/lib/validations\` -> esquemas zod (loginSchema, registerSchema, scoreSchema, championSchema, userUpsertSchema, matchUpsertSchema, questionUpsertSchema, prizeUpsertSchema, scoringConfigSchema).
- Tipos Prisma: \`import type { Phase, Role, ... } from "@prisma/client"\`.

## Primitivos UI existentes (NO los modifiques, solo impórtalos)
- \`@/components/ui/button\` -> \`Button\` props: variant: "primary"|"secondary"|"ghost"|"danger"|"dark"; size: "sm"|"md"|"lg"|"icon".
- \`@/components/ui/card\` -> \`Card, CardHeader, CardTitle, CardContent\`.
- \`@/components/ui/input\` -> \`Input, Label, Select, Textarea\`.
- \`@/components/ui/badge\` -> \`Badge\` (props tone: "neutral"|"yellow"|"teal"|"red"), \`StatusBadge\` (props status:string -> traduce ACTIVE/INACTIVE/PENDING/SCHEDULED/LIVE/FINISHED).
- \`@/components/ui/submit-button\` -> \`SubmitButton\` (botón con spinner pending; acepta props de Button).
- \`@/components/form-message\` -> \`FormMessage\` props \`{ state: {error?,success?}|null }\`.
- \`@/components/theme-toggle\` -> \`ThemeToggle\`.
- \`@/components/logo\` -> \`Logo\` (adapta claro/oscuro), \`LogoBrand\` (blanco, para fondos oscuros/festivos).
- \`@/components/logout-button\` -> \`LogoutButton\` (lo crea la fase 1).
- \`@/lib/cn\` -> \`cn(...)\` para combinar clases.
- Iconos: \`lucide-react\` (size 14-18, usa className "size-4").

## Sistema de diseño (design brief celya)
- Tokens Tailwind disponibles como clases: bg-background, text-foreground, bg-card, text-card-foreground, border-border, bg-muted, text-muted-foreground, bg-accent + text-accent-foreground (AMARILLO #FFCD00 = acción primaria / activo), bg-primary + text-primary-foreground, text-success (teal), text-danger (rojo), ring-ring, border-input.
- El AMARILLO es escaso: solo acción primaria, estado activo, barras de progreso, bordes de acento. No pintar áreas grandes de amarillo.
- Tarjetas: \`rounded-xl border border-border bg-card\`, padding 20-24px. Botones radio ~10px. Números con clase \`tnum\` (tabular-nums).
- Micro-labels de tablas: 11px, MAYÚSCULAS, tracking amplio, text-muted-foreground, font-semibold (\`text-[11px] uppercase tracking-wide text-muted-foreground font-semibold\`).
- Soporta modo claro y oscuro (ya configurado por tokens; usa solo las clases de token).

## Roles y enums
- Role: SUPER_ADMIN | ADMIN | EMPLEADO. UserStatus: PENDING | ACTIVE | INACTIVE.
- Phase: GROUP | R32 | R16 | QF | SF | THIRD | FINAL. MatchStatus: SCHEDULED | LIVE | FINISHED. CommonStatus: ACTIVE | INACTIVE.
- Match: { id, phase, groupName?, label?, homeTeamId?, awayTeamId?, homeTeam?, awayTeam?, kickoffAt, venue?, status, homeScore?, awayScore? }. homeTeam/awayTeam pueden ser null (eliminatorias por definir).
- Team: { id, name, fifaCode, flagEmoji, groupName? }.
- Question (1:1 con Match): { id, matchId, text, options:string[4], correctOption:number, status, lockedAt? }.

## Reglas de negocio
- Deadline de pronóstico = kickoff - lockMinutes (config, default 60 min). Usa isPredictionOpen(kickoff, cfg.lockMinutes).
- GATE de trivia: el empleado debe responder la pregunta del partido ANTES de registrar el marcador.
- Una pregunta con lockedAt != null no se puede editar ni eliminar (se bloquea cuando alguien la responde).
- Campeón/Subcampeón editable hasta isChampionPickOpen()===false (por defecto al iniciar Octavos/R16).
- Al guardar resultado de un partido se llama recomputeMatchPoints(id); si es la FINAL, además recomputeChampionPoints().

## Estética por área
- ADMIN (/admin/*): dashboard SaaS minimalista. Sidebar fija a la izquierda + topbar. Tablas. Fondo bg-background, tarjetas bg-card.
- JUGADOR (rutas raíz): festivo pero dentro de marca. Layout con clase \`festive-bg\` (gradiente morado) y texto claro; usa tarjetas translúcidas \`bg-white/5 border-white/10 backdrop-blur\` y acentos amarillos. Banderas con emoji grande.
- AUTH: ya hecho (no tocar).

## Contrato EXACTO de server actions (fase 1 los crea; las páginas los consumen)
type ActionState = { error?: string; success?: string } | null

### \`@/app/admin/actions\` (todas "use server", protegidas con requireAdmin(); updateScoringConfig con requireSuperAdmin())
- createUser(prev:ActionState, fd:FormData): campos fullName,email,documento?,role,status,password
- updateUser(prev, fd): campos id, fullName,email,documento?,role,status, password? (si vacío no cambia)
- deleteUser(fd:FormData): campo id  -> revalida, no retorna estado
- setUserStatus(fd:FormData): campos id, status -> revalida (para aprobar/activar/inactivar)
- createMatch(prev, fd): phase, groupName?, homeTeamId?, awayTeamId?, kickoffAt (string datetime-local), venue?
- updateMatch(prev, fd): id + campos de createMatch
- deleteMatch(fd): id
- setMatchResult(prev, fd): id, homeScore, awayScore, status -> recomputeMatchPoints; si FINAL recomputeChampionPoints
- createQuestion(prev, fd): matchId, text, option0, option1, option2, option3, correctOption, status
- updateQuestion(prev, fd): id + campos; ERROR si la pregunta tiene lockedAt
- deleteQuestion(fd): id; no-op/ERROR si lockedAt
- createPrize(prev, fd): position?, name, description?, imageUrl?, status
- updatePrize(prev, fd): id + campos
- deletePrize(fd): id
- updateScoringConfig(prev, fd): exactPts,resultPts,triviaPts,championPts,runnerUpPts,lockMinutes,championLockPhase (requireSuperAdmin)

### \`@/app/(player)/actions\` (todas "use server", protegidas con requireSession() y rol EMPLEADO)
- answerTrivia(prev:ActionState, fd:FormData): matchId, selectedOption -> crea QuestionAnswer (unique [userId,questionId]); marca question.lockedAt si es la primera respuesta global; calcula isCorrect; rechaza si pasó el deadline. revalida el partido.
- savePrediction(prev, fd): matchId, homeScore, awayScore -> exige que el usuario YA respondió la trivia del partido; upsert Prediction (unique [userId,matchId]); rechaza si pasó el deadline. revalida.
- saveChampionPick(prev, fd): championTeamId, runnerUpTeamId (deben ser distintos) -> upsert ChampionPick (unique userId); rechaza si !isChampionPickOpen().

## Reglas para TODOS los agentes
- Crea SOLO los archivos que se te asignan. No modifiques archivos de otros agentes ni de \`src/lib\` o \`src/components/ui\`.
- Si necesitas un componente cliente (formulario, botón con onClick), créalo como archivo propio dentro de tu carpeta asignada con "use client".
- NO ejecutes \`npm\`, \`next build\`, ni el servidor. Solo escribe archivos.
- Código limpio, tipado, en español visible. Evita \`any\`. Usa los primitivos UI; no reinstales librerías.
`;

// ---------------------------------------------------------------------------
phase("Acciones");

const phase1 = [
  () =>
    agent(
      `${SPEC}\n\nTAREA: Crea el archivo \`src/app/admin/actions.ts\` con TODAS las server actions del contrato "@/app/admin/actions" (createUser, updateUser, deleteUser, setUserStatus, createMatch, updateMatch, deleteMatch, setMatchResult, createQuestion, updateQuestion, deleteQuestion, createPrize, updatePrize, deletePrize, updateScoringConfig).\n` +
        `Detalles:\n` +
        `- "use server" arriba. Importa prisma, requireAdmin/requireSuperAdmin, hashPassword desde "@/lib/password", recomputeMatchPoints/recomputeChampionPoints, revalidatePath, y los zod schemas de "@/lib/validations".\n` +
        `- Cada create/update valida con su schema y retorna { error } con el primer issue, o { success }.\n` +
        `- kickoffAt: convierte el string datetime-local con new Date(value).\n` +
        `- setMatchResult: actualiza homeScore/awayScore/status; si status==="FINISHED" llama recomputeMatchPoints(id); si además el match.phase==="FINAL" llama recomputeChampionPoints(). Si status pasa a no FINISHED igual llama recomputeMatchPoints para limpiar.\n` +
        `- updateQuestion/deleteQuestion: si la pregunta tiene lockedAt, retorna { error: "La pregunta ya fue respondida y está bloqueada." } y no modifica.\n` +
        `- deleteUser/setMatchResult etc: revalida rutas /admin/usuarios, /admin/partidos, /admin/preguntas, /admin/premios, /admin/tabla, /admin según corresponda.\n` +
        `- No permitas que un admin se elimine a sí mismo (compara con getSession()).\n` +
        `Devuelve un resumen de las firmas exportadas.`,
      { label: "admin/actions.ts", phase: "Acciones" },
    ),
  () =>
    agent(
      `${SPEC}\n\nTAREA: Crea el archivo \`src/app/(player)/actions.ts\` con las server actions del contrato "@/app/(player)/actions" (answerTrivia, savePrediction, saveChampionPick).\n` +
        `Detalles:\n` +
        `- "use server" arriba. Importa prisma, requireSession, getScoringConfig/isChampionPickOpen, isPredictionOpen, revalidatePath, zod schemas (scoreSchema, championSchema).\n` +
        `- En cada acción: const s = await requireSession(); if (s.role !== "EMPLEADO") return { error: "Solo empleados pueden pronosticar." }.\n` +
        `- answerTrivia: busca la Question del matchId (con su match para el kickoff). Si !isPredictionOpen(match.kickoffAt, cfg.lockMinutes) -> { error: "El tiempo para este partido ya cerró." }. isCorrect = selectedOption===question.correctOption. upsert QuestionAnswer por [userId,questionId]. Si la pregunta no tenía lockedAt, set lockedAt=new Date(). revalida \`/partidos/\${matchId}\`.\n` +
        `- savePrediction: valida scoreSchema. Verifica que exista QuestionAnswer del usuario para la question del match; si no -> { error: "Primero responde la pregunta de trivia." }. Verifica deadline. upsert Prediction por [userId,matchId]. revalida \`/partidos\`, \`/partidos/\${matchId}\`, \`/\`.\n` +
        `- saveChampionPick: valida championSchema; championTeamId !== runnerUpTeamId. Si !(await isChampionPickOpen()) -> { error: "La selección de campeón ya está cerrada." }. upsert ChampionPick por userId. revalida \`/campeones\`, \`/\`.\n` +
        `Devuelve un resumen de las firmas exportadas.`,
      { label: "(player)/actions.ts", phase: "Acciones" },
    ),
  () =>
    agent(
      `${SPEC}\n\nTAREA: Crea SOLO el archivo \`src/components/logout-button.tsx\`.\n` +
        `- Client component "use client". Renderiza un <form action={logoutAction}> con un SubmitButton variant="ghost" size="sm" que diga "Cerrar sesión" con icono LogOut de lucide-react.\n` +
        `- Importa logoutAction desde "@/app/(auth)/actions".\n` +
        `- Acepta prop opcional className y variant para el botón.\n` +
        `Devuelve la firma del componente.`,
      { label: "logout-button.tsx", phase: "Acciones" },
    ),
];
await parallel(phase1);

// ---------------------------------------------------------------------------
phase("Pantallas");

const pages = [
  {
    label: "admin: layout + dashboard",
    prompt:
      `Crea el LAYOUT y DASHBOARD del panel admin.\n` +
      `Archivos:\n` +
      `1) \`src/app/admin/layout.tsx\` (Server Component, async). Llama \`await requireAdmin()\`. Estructura: sidebar fija a la izquierda (w-60) bg-card border-r con: arriba el <Logo className="h-7 w-auto"/>, micro-label "ADMINISTRACIÓN", y navegación a /admin (Dashboard), /admin/usuarios (Usuarios), /admin/partidos (Partidos), /admin/preguntas (Preguntas), /admin/premios (Premios), /admin/tabla (Tabla de posiciones), /admin/configuracion (Configuración). Cada item: icono lucide + texto. Para resaltar el activo crea un client component \`src/app/admin/_components/nav.tsx\` ("use client") que use usePathname y aplique al activo \`bg-accent/15 text-accent\`. Topbar (h-14 bg-card border-b) con título a la izquierda, y a la derecha <ThemeToggle/> y el nombre del usuario (getSession) con <LogoutButton/>. Contenido en <main className="p-6"> con max-w. Responsive: en móvil el sidebar puede colapsar a oculto (no crítico, deja al menos overflow).\n` +
      `2) \`src/app/admin/page.tsx\` (Server Component async, requireAdmin). Dashboard con KPI stat-cards (number 30px semibold + label): total usuarios, usuarios pendientes de aprobación, total partidos, partidos finalizados, total preguntas. Usa prisma.count. La tarjeta destacada (usuarios pendientes) con borde izquierdo grueso amarillo (border-l-4 border-accent). Debajo, una tarjeta "Próximos partidos" listando los siguientes 5 partidos por kickoffAt con equipos (flag + nombre o "Por definir") y fecha (formatDateTime). Y una tarjeta "Top 5 tabla" con getStandings().slice(0,5).\n` +
      `3) \`src/app/admin/_components/nav.tsx\` como se indicó.`,
  },
  {
    label: "admin: usuarios",
    prompt:
      `Crea la página de Gestión de Usuarios (ver pantalla del PDF: tabla con ID, USUARIO, NOMBRE COMPLETO, EMAIL/DOCUMENTO, ROL, ESTADO, ACCIONES).\n` +
      `Archivos:\n` +
      `1) \`src/app/admin/usuarios/page.tsx\` (Server Component async, requireAdmin). Lista todos los usuarios (prisma.user.findMany orderBy createdAt desc). Muestra una tabla minimalista (header bg-muted/40, micro-labels mayúscula, filas separadas por border-t, hover bg-muted/30, celdas px-4 py-3). ROL y ESTADO con StatusBadge/Badge (usa ROLE_LABEL para rol). Botón primario "Nuevo usuario" arriba a la derecha que abre un modal de creación. En cada fila: botón editar (abre modal con datos) y botón eliminar (form con deleteUser). Si el usuario está PENDING, muestra botón "Aprobar" (form setUserStatus status=ACTIVE). Encabezado de página con <h1> grande semibold y subtítulo muted.\n` +
      `2) \`src/app/admin/usuarios/_components/user-dialog.tsx\` ("use client"): modal (overlay fijo + tarjeta centrada) con formulario controlado por useActionState para createUser/updateUser. Campos: fullName, email, documento, role (Select con SUPER_ADMIN/ADMIN/EMPLEADO usando ROLE_LABEL), status (Select PENDING/ACTIVE/INACTIVE), password (en crear requerido; en editar opcional con placeholder "Dejar vacío para no cambiar"). Incluye id hidden en editar. Cierra con Esc y botón Cancelar. Usa FormMessage para mostrar error/success y cierra/recarga (router.refresh()) en success.\n` +
      `3) \`src/app/admin/usuarios/_components/user-actions.tsx\` ("use client") si necesitas botones de fila (editar abre dialog, eliminar/aprobar via <form>). Mantén la tabla en el server component y pasa los datos necesarios.`,
  },
  {
    label: "admin: partidos",
    prompt:
      `Crea la página de Gestión de Partidos (PDF: tabla FECHA/HORA, ENCUENTRO Y MARCADOR, FASE/GRUPO, ESTADO, ACCIONES; programación y actualización de resultados en tiempo real).\n` +
      `Archivos:\n` +
      `1) \`src/app/admin/partidos/page.tsx\` (Server async, requireAdmin). Trae prisma.match.findMany ordby kickoffAt asc, include homeTeam, awayTeam; y prisma.team.findMany para los selects. Tabla: FECHA/HORA (formatDateTime), ENCUENTRO (flag home + nombre vs flag away + nombre; si null muestra "Por definir" o el label), MARCADOR (homeScore-awayScore o "—"), FASE/GRUPO (PHASE_LABEL[phase] + grupo si aplica), ESTADO (StatusBadge). Acciones: "Resultado" (abre dialog de marcador), "Editar", "Eliminar" (form deleteMatch). Botón "Nuevo partido" arriba.\n` +
      `2) \`src/app/admin/partidos/_components/match-dialog.tsx\` ("use client"): modal create/update (useActionState createMatch/updateMatch). Campos: phase (Select con PHASE_ORDER + PHASE_LABEL), groupName (Select A-L, visible/útil sólo si GROUP), homeTeamId/awayTeamId (Select con equipos, opción vacía "Por definir"), kickoffAt (input datetime-local), venue. Recibe la lista de equipos por props.\n` +
      `3) \`src/app/admin/partidos/_components/result-dialog.tsx\` ("use client"): modal pequeño con homeScore, awayScore (number min 0) y status (Select SCHEDULED/LIVE/FINISHED), useActionState setMatchResult. Muestra los nombres de los equipos.\n` +
      `Pasa los datos del server a los client components por props (incluye lista de equipos serializable).`,
  },
  {
    label: "admin: preguntas",
    prompt:
      `Crea la página de Gestión de Preguntas de trivia (PDF: tabla ID, PREGUNTA, OPCIONES con la correcta resaltada en verde, ESTADO, ACCIONES; nota "si ya fue respondida queda bloqueada").\n` +
      `Archivos:\n` +
      `1) \`src/app/admin/preguntas/page.tsx\` (Server async, requireAdmin). prisma.question.findMany include match(con homeTeam,awayTeam) ordby id. Muestra tabla: ID, PREGUNTA (texto + debajo, muted, el partido asociado), OPCIONES (lista de las 4; resalta la correcta con un check verde / clase text-success), ESTADO (StatusBadge), columna BLOQUEO (si lockedAt: Badge tone="neutral" "Bloqueada" con icono Lock; si no, "Editable"). Acciones: Editar y Eliminar SOLO si !lockedAt; si lockedAt, muestra texto muted "Bloqueada". Botón "Nueva pregunta" arriba.\n` +
      `2) \`src/app/admin/preguntas/_components/question-dialog.tsx\` ("use client"): modal create/update (useActionState createQuestion/updateQuestion). Campos: matchId (Select con partidos: "PHASE_LABEL — home vs away"), text (Textarea), 4 inputs option0..3, correctOption (Select 0..3 mostrando el texto de cada opción o "Opción 1..4"), status (Select ACTIVE/INACTIVE). Recibe lista de partidos por props.\n` +
      `Pasa partidos serializables por props.`,
  },
  {
    label: "admin: premios",
    prompt:
      `Crea la página de Gestión de Premios (PDF: tabla ID/posición, IMAGEN, PREMIO, DESCRIPCIÓN, ESTADO, ACCIONES).\n` +
      `Archivos:\n` +
      `1) \`src/app/admin/premios/page.tsx\` (Server async, requireAdmin). prisma.prize.findMany ordby position asc nulls last (ordena en JS). Tabla: POSICIÓN (#n), IMAGEN (si imageUrl muestra <img> 40px rounded; si no, placeholder icono Gift), PREMIO (name), DESCRIPCIÓN, ESTADO (StatusBadge), ACCIONES (Editar / Eliminar form deletePrize). Botón "Nuevo premio" arriba.\n` +
      `2) \`src/app/admin/premios/_components/prize-dialog.tsx\` ("use client"): modal create/update (useActionState createPrize/updatePrize). Campos: position (number opcional), name, description (Textarea), imageUrl (input url opcional), status (Select). id hidden en editar.`,
  },
  {
    label: "admin: tabla",
    prompt:
      `Crea la página de Tabla de Posiciones del admin (PDF: ranking #, USUARIO, NOMBRE COMPLETO, TOTAL PUNTOS).\n` +
      `Archivo: \`src/app/admin/tabla/page.tsx\` (Server async, requireAdmin). Usa getStandings() de "@/lib/queries". Tabla con columnas: # (posición; top 3 con dot/medalla amarilla), USUARIO (avatar con iniciales: círculo bg-primary text-accent-foreground? usa bg-brand-black text-brand-yellow font-bold, + email muted), NOMBRE COMPLETO, ACIERTOS EXACTOS (exactCount), TOTAL PUNTOS (badge oscuro con número, clase tnum). Si no hay datos, empty state. Encabezado de página grande.`,
  },
  {
    label: "admin: configuracion",
    prompt:
      `Crea la página de Configuración de puntaje (solo SUPER_ADMIN).\n` +
      `Archivos:\n` +
      `1) \`src/app/admin/configuracion/page.tsx\` (Server async): \`await requireSuperAdmin()\`; trae getScoringConfig(). Renderiza un formulario (client component) con los valores actuales.\n` +
      `2) \`src/app/admin/configuracion/_components/config-form.tsx\` ("use client"): useActionState(updateScoringConfig). Campos numéricos: exactPts, resultPts, triviaPts, championPts, runnerUpPts, lockMinutes; y championLockPhase (Select con PHASE_ORDER/PHASE_LABEL). Cada campo con Label y ayuda muted (ej. "Puntos por marcador exacto"). FormMessage + SubmitButton "Guardar configuración". Recibe config por props.`,
  },
  {
    label: "player: layout + home",
    prompt:
      `Crea el LAYOUT festivo del jugador y la HOME (PDF: top nav INICIO, TABLA DE POSICIONES, INSTRUCCIONES Y REGLAS, PREMIOS; tarjetas "Mis puntos" y "Mis campeones"; bienvenida).\n` +
      `Archivos:\n` +
      `1) \`src/app/(player)/layout.tsx\` (Server async). \`const s = await requireSession()\`. Aplica \`<div className="festive-bg min-h-screen text-white">\`. Top nav (sticky top-0, backdrop-blur, border-b border-white/10) con <LogoBrand className="h-7"/> a la izquierda y enlaces a / (Inicio), /partidos (Partidos), /tabla (Tabla), /premios (Premios), /reglas (Reglas). Crea \`src/app/(player)/_components/nav.tsx\` ("use client", usePathname) para resaltar activo con texto amarillo (text-accent) y underline. A la derecha: nombre del usuario, <ThemeToggle/> (opcional) y <LogoutButton variant="ghost"/>. Si el usuario es ADMIN/SUPER_ADMIN muestra también un link a /admin. Contenido en <main className="mx-auto max-w-5xl px-4 py-6">.\n` +
      `2) \`src/app/(player)/page.tsx\` (Server async, requireSession). Saludo "Hola {nombre}, ¡Bienvenido a la Polla Mundialista!". Tarjetas translúcidas (bg-white/5 border border-white/10 rounded-xl backdrop-blur): "Mis puntos" (getUserSummary(userId): totalPoints grande tnum, y rank/totalPlayers), "Mis campeones" (getChampionPick: campeón y subcampeón con bandera o "Sin elegir" + link a /campeones). Sección "Partidos para pronosticar": próximos partidos abiertos (kickoff futuro, isPredictionOpen) con link a /partidos/{id}; usa prisma. Usa componentes inline.\n` +
      `Para tarjetas translúcidas NO uses los tokens bg-card (son claros); usa utilidades white/amber directamente porque el fondo es oscuro festivo.`,
  },
  {
    label: "player: partidos (lista + detalle)",
    prompt:
      `Crea la lista de partidos y el detalle con GATE de trivia + ingreso de marcador (PDF pantallas "Pronóstico de Partidos", "Pregunta de Trivia antes del Partido", "Ingreso de Marcador").\n` +
      `Archivos:\n` +
      `1) \`src/app/(player)/partidos/page.tsx\` (Server async, requireSession). Lista partidos agrupados por fase (PHASE_ORDER, PHASE_LABEL). Para cada partido una tarjeta translúcida (festiva) con: flags + nombres (o "Por definir"), fecha (formatDateTime), grupo/fase, estado (abierto/cerrado/finalizado según isPredictionOpen y status). Si tiene el pronóstico del usuario, muéstralo (prisma.prediction). Botón/Link "Pronosticar" a /partidos/{id} si abierto; si cerrado, muestra el marcador real si FINISHED. Trae predicciones del usuario para marcar estado.\n` +
      `2) \`src/app/(player)/partidos/[id]/page.tsx\` (Server async, requireSession; params es Promise<{id:string}>). Trae el match (include teams, question, predictions del usuario, y la respuesta de trivia del usuario para esa question). Calcula open = isPredictionOpen(kickoff, cfg.lockMinutes). Muestra cabecera con equipos grandes (flags) y fecha. Lógica:\n` +
      `   - Si !open o status FINISHED: muestra solo lectura (marcador real si hay; pronóstico del usuario; mensaje "El tiempo para pronosticar cerró").\n` +
      `   - Si open y el usuario NO ha respondido la trivia: muestra el formulario de trivia (componente cliente) con la pregunta y 4 opciones (radios), action answerTrivia.\n` +
      `   - Si open y YA respondió la trivia: muestra el formulario de marcador (home/away number inputs) con savePrediction, precargando el pronóstico previo si existe. Indica "Puedes editar hasta {formatDateTime(deadline)}".\n` +
      `3) \`src/app/(player)/partidos/[id]/_components/trivia-form.tsx\` ("use client", useActionState answerTrivia): radios option0..3, matchId hidden, FormMessage, SubmitButton "Enviar respuesta". En success router.refresh().\n` +
      `4) \`src/app/(player)/partidos/[id]/_components/score-form.tsx\` ("use client", useActionState savePrediction): inputs homeScore/awayScore (con nombres de equipos), matchId hidden, FormMessage, SubmitButton "Guardar marcador". router.refresh() en success.\n` +
      `Estilo festivo (fondo oscuro): usa utilidades white/amber, no bg-card.`,
  },
  {
    label: "player: campeones",
    prompt:
      `Crea la página de Selección de Campeón y Subcampeón (PDF "Selección de Campeón y Subcampeón"; editable hasta octavos).\n` +
      `Archivos:\n` +
      `1) \`src/app/(player)/campeones/page.tsx\` (Server async, requireSession). Trae todos los equipos (prisma.team.findMany ordby groupName,name), el pick actual (getChampionPick(userId)) y open = await isChampionPickOpen(). Cabecera "Ingresa tu campeón y subcampeón". Si !open: muestra solo lectura del pick (banderas + nombres) y aviso "La selección está cerrada". Si open: muestra el formulario.\n` +
      `2) \`src/app/(player)/campeones/_components/champion-form.tsx\` ("use client", useActionState saveChampionPick): dos Select (campeón, subcampeón) poblados con los equipos (value=id, muestra "flag nombre"); precarga el pick actual. Valida en cliente que sean distintos (o deja que el server responda). FormMessage + SubmitButton "Guardar selección". router.refresh() en success.\n` +
      `Estilo festivo (fondo oscuro).`,
  },
  {
    label: "player: mis-puntos",
    prompt:
      `Crea la página Detalle de Puntos (PDF "Detalle de Puntos": historial breve de aciertos, puntos acumulados y fecha; tarjetas resumen).\n` +
      `Archivo: \`src/app/(player)/mis-puntos/page.tsx\` (Server async, requireSession). Usa getUserSummary(userId). Arriba tarjetas resumen translúcidas: Puntos totales (tnum grande), Posición (rank/totalPlayers), Marcadores exactos (exactCount), Resultados acertados (resultCount), Trivias correctas (triviaCorrect). Luego una lista/tabla "Historial" con summary.entries: cada PointsEntry -> tipo legible (EXACT="Marcador exacto", RESULT="Resultado acertado", TRIVIA="Trivia correcta", CHAMPION="Campeón acertado", RUNNERUP="Subcampeón acertado"), el partido si entry.match (flags + nombres), puntos (+N en amarillo, tnum) y fecha (formatDate). Empty state si no hay entries. Estilo festivo (fondo oscuro).`,
  },
  {
    label: "player: tabla",
    prompt:
      `Crea la Tabla de Posiciones del jugador (PDF "Tabla de Posiciones" vista empleado: posición, puntos y campeones seleccionados; resalta al usuario actual).\n` +
      `Archivo: \`src/app/(player)/tabla/page.tsx\` (Server async, requireSession). getStandings(). Tabla translúcida (festiva): #, USUARIO (avatar iniciales bg-brand-yellow text-brand-black + nombre), CAMPEÓN (flag o "—"), SUBCAMPEÓN (flag o "—"), PUNTOS (tnum). Top 3 con medalla/acento amarillo. Resalta la fila del usuario actual (session.userId) con borde/anillo amarillo (ring-1 ring-accent / bg-white/10). Empty state si vacío.`,
  },
  {
    label: "player: premios + reglas",
    prompt:
      `Crea dos páginas del jugador: Premios y Reglas.\n` +
      `Archivos:\n` +
      `1) \`src/app/(player)/premios/page.tsx\` (Server async, requireSession). prisma.prize.findMany where status ACTIVE ordby position. Muestra tarjetas festivas en grid con: posición (#), imagen (img si imageUrl, si no icono Gift/Trophy lucide grande amarillo), nombre, descripción. Empty state si no hay premios.\n` +
      `2) \`src/app/(player)/reglas/page.tsx\` (Server async, requireSession). Trae getScoringConfig() para mostrar los puntos reales. Página estática "Instrucciones y Reglas" con secciones: Cómo jugar (responder la trivia antes de cada partido, registrar marcador hasta 1 hora antes del inicio), Puntaje (lista con cfg.exactPts marcador exacto, cfg.resultPts resultado, cfg.triviaPts trivia, cfg.championPts campeón, cfg.runnerUpPts subcampeón), Campeón/Subcampeón (editable hasta octavos), Fair play. Usa tarjetas festivas y buen tipografiado. Sin formularios.`,
  },
];

const built = await parallel(
  pages.map((p) => () =>
    agent(`${SPEC}\n\nTAREA (${p.label}):\n${p.prompt}\n\nAl terminar, devuelve la lista de archivos que creaste.`, {
      label: p.label,
      phase: "Pantallas",
    }),
  ),
);

log(`Pantallas construidas: ${built.filter(Boolean).length}/${pages.length}`);
return { phase1: phase1.length, pages: built.filter(Boolean).length };
