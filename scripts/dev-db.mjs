// Local development database using PGlite (Postgres compiled to WASM) exposed
// over the Postgres wire protocol on a TCP port. Works on any architecture
// (incl. Windows ARM64) without Docker. Data persists in .devdb/.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", ".devdb");

const PORT = 5433;
const HOST = "127.0.0.1";

async function main() {
  const db = await PGlite.create({ dataDir });
  const server = new PGLiteSocketServer({ db, port: PORT, host: HOST });
  await server.start();
  console.log(`PGlite escuchando en ${HOST}:${PORT}`);

  const shutdown = async () => {
    console.log("Deteniendo PGlite…");
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
