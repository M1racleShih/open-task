import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db.js";
import { buildApp } from "../server/app.js";
import { initJobs, boss } from "../server/jobs.js";
if (!process.env.DATABASE_URL?.endsWith("/open_task_test"))
  throw new Error("Performance fixtures require open_task_test");
await initJobs();
const app = await buildApp();
await app.listen({ port: 4312, host: "127.0.0.1" });
const row = (
  await pool.query(
    "SELECT data FROM tasks WHERE stage='working' AND data->>'title' NOT LIKE 'Performance fixture %' LIMIT 1",
  )
).rows[0];
if (!row) throw new Error("Run integration fixtures first");
const base = row.data;
await pool.query(
  `INSERT INTO tasks(id,creator_id,stage,project_id,data) SELECT gen_random_uuid(),creator_id,'working',project_id,data FROM tasks WHERE false`,
);
await pool.query(
  "DELETE FROM tasks WHERE data->>'title' LIKE 'Performance fixture %'",
);
for (let i = 0; i < 5000; i++) {
  const id = randomUUID();
  const data = {
    ...base,
    id,
    title: "Performance fixture " + i,
    number: 200000 + (Math.floor(Date.now() / 1000) % 100000) * 10000 + i,
  };
  await pool.query(
    "INSERT INTO tasks(id,number,creator_id,stage,project_id,data) VALUES($1,$2,$3,$4,$5,$6)",
    [id, data.number, data.creatorId, "working", data.projectId, data],
  );
}
const headersList: Record<string, string>[] = [];
for (let i = 0; i < 30; i++) {
  const username = "perf-user-" + i;
  await pool.query(
    "INSERT INTO users(id,username,name,password_hash,roles) SELECT gen_random_uuid(),$1,$1,password_hash,roles FROM users WHERE username='member' ON CONFLICT(username) DO NOTHING",
    [username],
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    remoteAddress: "127.0.1." + (i + 1),
    payload: { username, password: "OpenTask-Test-2026!" },
  });
  if (login.statusCode !== 200) throw new Error(login.body);
  headersList.push({
    cookie: login.headers["set-cookie"]!.toString().split(";")[0],
    "x-csrf-token": login.json().csrf,
    "Content-Type": "application/json",
  });
}
const samples: Record<string, number[]> = { list: [], detail: [], write: [] };
const statuses: Record<string, number> = {};
const started = performance.now();
const duration = Number(process.env.PERF_SECONDS ?? 300) * 1000;
// Thirty virtual users with one request per second each, 45% lists / 45% details / 10% comments.
await Promise.all(
  Array.from({ length: 30 }, async (_, index) => {
    let iteration = index;
    while (performance.now() - started < duration) {
      const kind =
        iteration % 10 === 0
          ? "write"
          : iteration % 2 === 0
            ? "list"
            : "detail";
      const url =
        kind === "list"
          ? "/tasks?limit=50"
          : kind === "detail"
            ? "/tasks/" + base.id
            : "/tasks/" + base.id + "/actions/comment";
      const t = performance.now();
      const r = await fetch("http://127.0.0.1:4312/api/v1" + url, {
        method: kind === "write" ? "POST" : "GET",
        headers: { ...headersList[index], "idempotency-key": randomUUID() },
        ...(kind === "write"
          ? {
              body: JSON.stringify({
                version: base.version,
                text: "Performance feedback discussion",
              }),
            }
          : {}),
      });
      await r.arrayBuffer();
      samples[kind].push(performance.now() - t);
      statuses[r.status] = (statuses[r.status] ?? 0) + 1;
      iteration++;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 1000 - (performance.now() - t))),
      );
    }
  }),
);
const report = {
  machine: {
    cpus: os.cpus().length,
    model: os.cpus()[0].model,
    totalMemory: os.totalmem(),
  },
  fixtureTasks: 5000,
  totalTasks: Number(
    (await pool.query("SELECT count(*) FROM tasks")).rows[0].count,
  ),
  concurrency: 30,
  durationSeconds: (performance.now() - started) / 1000,
  statuses,
  latency: Object.fromEntries(
    Object.entries(samples).map(([kind, values]) => {
      values.sort((a, b) => a - b);
      return [
        kind,
        {
          count: values.length,
          p95: values[Math.floor(values.length * 0.95)],
          max: values.at(-1),
        },
      ];
    }),
  ),
};
await writeFile("artifacts/performance.json", JSON.stringify(report, null, 2));
console.log(report);
await app.close();
await boss.stop();
await pool.end();

if (Object.keys(statuses).some((code) => code !== "200"))
  throw new Error(
    "Load test failed: non-200 responses; inspect artifacts/performance.json",
  );
if (report.latency.list.p95 >= 500 || report.latency.detail.p95 >= 500)
  throw new Error("Load test failed: API P95 exceeds 500ms");
