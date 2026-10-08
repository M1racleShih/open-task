import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { pool, transaction } from "./db.js";
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12)
  throw new Error(
    "Set SEED_PASSWORD (at least 12 characters) for explicitly labeled local acceptance accounts.",
  );
await transaction(async (c) => {
  for (const [username, name, roles] of [
    ["admin", "Test Administrator", ["admin"]],
    ["leader", "Test Leader", ["leader"]],
    ["manager", "Test Project Manager", ["member"]],
    ["member", "Test Member", ["member"]],
    ["other", "Test Other Member", ["member"]],
  ] as const) {
    await c.query(
      "INSERT INTO users(id,username,name,password_hash,roles) VALUES($1,$2,$3,$4,$5) ON CONFLICT(username) DO NOTHING",
      [
        randomUUID(),
        username,
        name,
        await argon2.hash(password),
        JSON.stringify(roles),
      ],
    );
  }
});
console.log(
  "Local acceptance accounts created if absent; existing passwords unchanged.",
);
await pool.end();
