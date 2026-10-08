import staticPlugin from "@fastify/static";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { initJobs, boss } from "./jobs.js";
import { pool } from "./db.js";
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
await app.listen({ port: Number(process.env.PORT ?? 4310), host: "127.0.0.1" });
console.log("Open Task: http://127.0.0.1:4310");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    await boss.stop();
    await pool.end();
    process.exit(0);
  });
