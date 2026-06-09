# Polla Mundialista · celya — Mundial 2026

Plataforma de polla (quiniela) deportiva para celya: pronósticos del Mundial 2026,
trivia de negocio antes de cada partido, ranking, premios y panel de administración.

## Stack
- **Next.js 16** (App Router, Server Actions) + **TypeScript** + **React 19**
- **Tailwind CSS v4** (sistema de diseño celya: tema oscuro, Poppins)
- **PostgreSQL** + **Prisma 6** (driver adapter `pg`, motor de consultas WASM)
- Autenticación propia por cookie JWT firmada (`jose` + `bcryptjs`)

## Roles
- **SUPER_ADMIN**: todo + configuración de puntaje.
- **ADMIN**: usuarios, resultados de partidos, preguntas, premios, tabla.
- **EMPLEADO**: pronósticos, trivia, campeón/subcampeón, sus puntos, tabla, premios.

## Funcionalidades
- Registro abierto a cualquier correo. La cuenta queda **pendiente** hasta que un administrador la apruebe; antes de aprobarse, el login muestra "pendiente de aprobación".
- El administrador puede **aprobar**, **inactivar** o reactivar un usuario; los cambios de estado son inmediatos.
- Gestión de usuarios, carga de resultados de partidos, preguntas de trivia (104, se bloquean al ser respondidas) y premios.
- Pronóstico de marcadores con **gate de trivia** y deadline configurable antes del partido (1 h por defecto).
- Selección de campeón/subcampeón (bloqueada al iniciar la fase configurada, octavos por defecto).
- Cálculo automático de puntos: marcador exacto, resultado, trivia, campeón y subcampeón (configurable).
- Tabla de posiciones y detalle de puntos.

## Desarrollo local

No requiere Docker: se usa **PGlite** (Postgres en WASM) expuesto por TCP.

```bash
npm install
cp .env.example .env            # ajusta AUTH_SECRET, etc. (los valores por defecto sirven para local)

# 1) Levanta la base de datos local (deja esta terminal abierta)
node scripts/dev-db.mjs

# 2) En otra terminal: sincroniza esquema y carga datos del Mundial 2026
npm run db:push
npm run db:seed

# 3) Inicia la app
npm run dev
```

App en http://localhost:3000 · Admin inicial: `admin@celya.co` / `Celya2026*` (ver `.env`).

## Sincronización de partidos (football-data.org)
Los 104 partidos son fijos: el admin **no** crea, edita ni elimina partidos. Los equipos de
las eliminatorias y los marcadores se traen automáticamente de [football-data.org](https://www.football-data.org):
- Define `FOOTBALL_DATA_TOKEN` (token gratuito). Sin token, la sincronización se desactiva y
  queda disponible la carga **manual** de resultados como respaldo.
- Botón **"Sincronizar resultados"** en `/admin/partidos`, o endpoint `GET/POST /api/sync`
  (protegido con `CRON_SECRET`) para un **cron** de Railway que actualice en vivo.
- Al sincronizar/cargar un resultado finalizado, los puntos se recalculan automáticamente.

## Despliegue en Railway
1. Crea un proyecto en Railway y añade el plugin **PostgreSQL** (define `DATABASE_URL`).
2. Conecta este repositorio como servicio web.
3. Define las variables de entorno (ver `.env.example`): `AUTH_SECRET`,
   `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, y opcionalmente `FOOTBALL_DATA_TOKEN`/`CRON_SECRET`.
4. El build corre `prisma generate && next build`; el arranque corre `prisma migrate deploy && next start`
   (aplica las migraciones de `prisma/migrations`).
5. Tras el primer despliegue, ejecuta el seed una vez (Railway → comando puntual):
   `npm run db:seed`.

## Variables de entorno
Ver [`.env.example`](.env.example).

## Scripts útiles
- `npm run dev` — servidor de desarrollo
- `npm run db:push` — sincroniza el esquema (desarrollo)
- `npm run db:seed` — carga equipos, 104 partidos, trivias, premios y superadmin
- `npm run db:deploy` — aplica migraciones (producción)
- `npm run db:reset` — resetea la base de datos local
