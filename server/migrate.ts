import { readFile } from "node:fs/promises";
import { pool, transaction } from "./db.js";
await transaction(async (c) => {
  await c.query("SELECT pg_advisory_xact_lock(781001)");
  for (const file of [
    "001_initial.sql",
    "002_project_color.sql",
    "003_time_preferences.sql",
  ])
    await c.query(
      await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
});
console.log("Database migration applied");
await pool.end();
