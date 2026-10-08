import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { pool, transaction } from "../server/db.js";
import { initJobs, boss, schedule } from "../server/jobs.js";
if (!process.env.DATABASE_URL?.endsWith("/open_task_test"))
  throw new Error("Recovery fixtures require open_task_test");
await initJobs();
const row = await pool.query(
  "SELECT data FROM tasks WHERE stage='pending' AND data->>'refused' IS NULL LIMIT 1",
);
const t = row.rows[0].data;
t.acceptBy = new Date(Date.now() - 60000).toISOString();
await pool.query("UPDATE tasks SET data=$2 WHERE id=$1", [t.id, t]);
const launch = () =>
  spawn(process.execPath, ["--import", "tsx", "server/worker.ts"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
let worker = launch();
let logs = "";
worker.stdout?.on("data", (x) => (logs += x));
worker.stderr?.on("data", (x) => (logs += x));
async function waitFor(fn: () => Promise<boolean>, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return;
    await delay(500);
  }
  throw new Error("Recovery condition timeout: " + logs);
}
await waitFor(
  async () =>
    !!(
      await pool.query(
        "SELECT 1 FROM followups WHERE task_id=$1 AND reason='acceptOverdue' AND active",
        [t.id],
      )
    ).rowCount,
);
worker.kill("SIGTERM");
await new Promise((resolve) => worker.once("exit", resolve));
await transaction((c) => schedule(c, t.id));
const queued = await pool.query(
  "SELECT id FROM pgboss.job WHERE data->>'taskId'=$1 AND state='created'",
  [t.id],
);
assert.ok(queued.rowCount);
worker = launch();
worker.stdout?.on("data", (x) => (logs += x));
worker.stderr?.on("data", (x) => (logs += x));
await waitFor(
  async () =>
    !(
      await pool.query(
        "SELECT 1 FROM pgboss.job WHERE id=$1 AND state IN ('created','active','retry')",
        [queued.rows[0].id],
      )
    ).rowCount,
);
const count = (
  await pool.query(
    "SELECT count(*)::int AS n FROM followups WHERE task_id=$1",
    [t.id],
  )
).rows[0].n;
await transaction((c) => schedule(c, t.id));
await delay(3000);
assert.equal(
  (
    await pool.query(
      "SELECT count(*)::int AS n FROM followups WHERE task_id=$1",
      [t.id],
    )
  ).rows[0].n,
  count,
);
const failedId = await boss.send(
  "task-check",
  { taskId: "invalid-uuid" },
  { retryLimit: 2, retryDelay: 1, priority: 100 },
);
await waitFor(
  async () =>
    !!(
      await pool.query(
        "SELECT 1 FROM pgboss.job WHERE id=$1 AND state='failed' AND retry_count=2 AND output IS NOT NULL",
        [failedId],
      )
    ).rowCount,
  45000,
);
worker.kill("SIGTERM");
await new Promise((resolve) => worker.once("exit", resolve));
await writeFile(
  "artifacts/worker-recovery.json",
  JSON.stringify(
    {
      result: "passed",
      taskId: t.id,
      queuedWhileStopped: queued.rowCount,
      stableFollowupCount: count,
      failedJobId: failedId,
      retryLimit: 2,
      checks: [
        "restart catches overdue",
        "queued job resumes",
        "repeat check deduplicates",
        "bounded failed job retains output",
      ],
    },
    null,
    2,
  ),
);
console.log(
  "Worker recovery, duplicate checks and bounded failure history passed",
);
await boss.stop();
await pool.end();
