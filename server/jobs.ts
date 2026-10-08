import { PgBoss } from "pg-boss";
import { connectionString } from "./db.js";
import type { Client } from "./store.js";
export const boss = new PgBoss({ connectionString, max: 3 });
boss.on("error", (e) => console.error("Background queue error", e.message));
export async function initJobs() {
  await boss.start();
  await boss.createQueue("task-check", {
    retryLimit: 3,
    retryDelay: 5,
    expireInSeconds: 60,
  });
}
export async function schedule(c: Client, taskId: string) {
  await boss.send(
    "task-check",
    { taskId },
    {
      db: { executeSql: (text, values) => c.query(text, values) },
      retryLimit: 3,
      retryDelay: 5,
    },
  );
}
