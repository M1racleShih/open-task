import staticPlugin from "@fastify/static";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { initJobs, boss } from "./jobs.js";
import { pool } from "./db.js";
const port = Number(process.env.PORT ?? 4310);
const host = process.env.HOST ?? "127.0.0.1";
await initJobs();
const app = await buildApp();
await app.register(staticPlugin, {
  root: fileURLToPath(new URL("../dist", import.meta.url)),
});
app.setNotFoundHandler((req, reply) =>
  req.url.startsWith("/api/")
    ? reply.code(404).send({ error: { code: "notFound" } })
    : reply.sendFile("index.html"),
);
await app.listen({ port, host });
console.log(`Open Task: http://${host}:${port}`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    await boss.stop();
    await pool.end();
    process.exit(0);
  });
