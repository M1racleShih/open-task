import { initJobs, boss, schedule } from "./jobs.js";
import { pool, transaction } from "./db.js";
import { syncFollowups } from "./followups.js";
import { users, isLeader } from "./store.js";
await initJobs();
await boss.work<{ taskId: string }>(
  "task-check",
  { batchSize: 50, pollingIntervalSeconds: 1 },
  async (jobs) => {
    for (const job of jobs)
      await transaction(async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(781002)");
        const row = await c.query(
          "SELECT data FROM tasks WHERE id=$1 FOR UPDATE",
          [job.data.taskId],
        );
        const leader = (await users(c)).find(isLeader);
        if (row.rowCount && leader)
          await syncFollowups(c, row.rows[0].data, leader.id);
      });
  },
);
async function sweep() {
  await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(781002)");
    const leader = (await users(c)).find(isLeader);
    if (leader) {
      const rows = await c.query(
        "SELECT data FROM tasks WHERE stage NOT IN ('draft','done','cancelled')",
      );
      for (const r of rows.rows) await syncFollowups(c, r.data, leader.id);
    }
    await c.query(
      "INSERT INTO worker_health(name,checked_at) VALUES('followups',now()) ON CONFLICT(name) DO UPDATE SET checked_at=now(),error=null",
    );
  });
}
await sweep();
const timer = setInterval(
  () =>
    sweep().catch(async (e) => {
      console.error("Followup sweep failed", e.message);
      await pool
        .query("UPDATE worker_health SET error=$1 WHERE name='followups'", [
          e.message,
        ])
        .catch(() => {});
    }),
  15000,
);
console.log("Task followup worker started");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    clearInterval(timer);
    await boss.stop();
    await pool.end();
    process.exit(0);
  });
