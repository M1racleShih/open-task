import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { PgBoss } from "pg-boss";

const run = promisify(execFile);
const root = new URL("../", import.meta.url);

test(
  "backup restores nonempty time preferences and rejects same-count content corruption",
  { timeout: 45000 },
  async (t) => {
    const configured = new URL(
      process.env.DATABASE_URL ?? "postgres://invalid/invalid",
    );
    assert.equal(configured.hostname, "127.0.0.1");
    assert.equal(configured.port, "55432");
    assert.equal(
      configured.pathname,
      "/open_task_test",
      "Run scripts/test-db.sh; never use a normal workspace",
    );
    const suffix = randomUUID().replaceAll("-", "");
    const source = `open_task_restore_fixture_${suffix}`;
    const restored = `open_task_restore_result_${suffix}`;
    const url = (database: string) => {
      const result = new URL(configured);
      result.pathname = "/" + database;
      return result.toString();
    };
    const admin = new pg.Pool({ connectionString: url("postgres") });
    const fixture = new pg.Pool({ connectionString: url(source) });
    const restore = new pg.Pool({ connectionString: url(restored) });
    const boss = new PgBoss({ connectionString: url(source) });
    const created: string[] = [];
    t.after(async () => {
      await boss.stop();
      await Promise.all([fixture.end(), restore.end()]);
      try {
        for (const database of created)
          await admin.query(`DROP DATABASE "${database}"`);
      } finally {
        await admin.end();
      }
    });
    for (const database of [source, restored]) {
      await admin.query(`CREATE DATABASE "${database}"`);
      created.push(database);
    }
    for (const file of [
      "001_initial.sql",
      "002_project_color.sql",
      "003_time_preferences.sql",
    ])
      await fixture.query(
        await readFile(new URL("migrations/" + file, root), "utf8"),
      );
    await boss.start();
    await boss.createQueue("task-check");
    await boss.stop();
    const user = randomUUID(),
      project = randomUUID();
    await fixture.query(
      "INSERT INTO users(id,username,name,password_hash,roles) VALUES($1,'restore-fixture','Synthetic restore account','synthetic-hash','[\"member\"]')",
      [user],
    );
    await fixture.query(
      "INSERT INTO projects(id,name,manager_id) VALUES($1,'Synthetic restore project',$2)",
      [project, user],
    );
    const filter = {
      mode: "custom",
      start: "2026-10-01",
      end: "2026-10-31",
      includeEarlier: true,
      includeUnscheduled: false,
    };
    for (const scope of ["global", project])
      await fixture.query(
        "INSERT INTO time_preferences(user_id,scope,filter) VALUES($1,$2,$3)",
        [user, scope, filter],
      );
    const compose = ["compose", "exec", "-T", "db"];
    const dump = await run(
      "docker",
      [...compose, "pg_dump", "-U", "open_task", "-d", source, "-Fc"],
      { cwd: root, encoding: "buffer" },
    );
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "docker",
        [
          ...compose,
          "pg_restore",
          "-U",
          "open_task",
          "-d",
          restored,
          "--exit-on-error",
        ],
        { cwd: root, stdio: ["pipe", "ignore", "pipe"] },
      );
      let stderr = "";
      child.stderr.on("data", (data) => {
        stderr += data;
      });
      child.on("error", reject);
      child.stdin.on("error", reject);
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(stderr)),
      );
      child.stdin.end(dump.stdout);
    });
    const verify = () =>
      run("bash", ["scripts/verify-restored-db.sh", source, restored], {
        cwd: root,
      });
    const result = await verify();
    assert.equal(result.stdout.trim().split("\n").length, 12);
    assert.deepEqual(
      (
        await restore.query(
          "SELECT scope,filter FROM time_preferences ORDER BY scope",
        )
      ).rows,
      (
        await fixture.query(
          "SELECT scope,filter FROM time_preferences ORDER BY scope",
        )
      ).rows,
    );
    await restore.query(
      "UPDATE time_preferences SET filter=jsonb_set(filter,'{includeEarlier}','false') WHERE scope='global'",
    );
    await assert.rejects(
      verify,
      (error: any) =>
        error.code === 1 &&
        error.stderr.includes("Restore mismatch: time_preferences"),
    );
  },
);
