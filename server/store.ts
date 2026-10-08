import type pg from "pg";
import type { User, Project, Task, Event, Relation } from "../shared/model.js";
import { ensure } from "./errors.js";
export type Client = pg.PoolClient;
export const userRow = (r: any): User => ({
  id: r.id,
  username: r.username,
  name: r.name,
  roles: r.roles,
  active: r.active,
});
export async function users(c: Client) {
  return (
    await c.query(
      "SELECT id,username,name,roles,active FROM users ORDER BY username",
    )
  ).rows.map(userRow);
}
export async function projects(c: Client): Promise<Project[]> {
  return (
    await c.query(
      'SELECT id,name,color,manager_id AS "managerId",member_ids AS "memberIds" FROM projects ORDER BY name',
    )
  ).rows;
}
export async function task(c: Client, id: string, actor: User): Promise<Task> {
  const r = await c.query("SELECT data FROM tasks WHERE id=$1 FOR UPDATE", [
    id,
  ]);
  ensure(r.rowCount, "notFound", 404);
  const t = r.rows[0].data as Task;
  ensure(t.stage !== "draft" || t.creatorId === actor.id, "notFound", 404);
  return t;
}
export async function save(c: Client, t: Task) {
  t.updatedAt = new Date().toISOString();
  t.revision++;
  await c.query("UPDATE tasks SET data=$2,stage=$3,project_id=$4 WHERE id=$1", [
    t.id,
    t,
    t.stage,
    t.projectId,
  ]);
}
export async function event(
  c: Client,
  t: Task,
  actor: User,
  type: string,
  before: unknown,
  after: unknown,
  note = "",
) {
  await c.query(
    "INSERT INTO events(task_id,actor_id,type,version,before_value,after_value,note) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      t.id,
      actor.id,
      type,
      t.version,
      JSON.stringify(before),
      JSON.stringify(after),
      note,
    ],
  );
}
export async function relations(c: Client): Promise<Relation[]> {
  return (
    await c.query(
      'SELECT id,source_id AS "sourceId",target_id AS "targetId",kind FROM relations',
    )
  ).rows;
}
export const isLeader = (u: User) => u.roles.includes("leader");
export const requireLeader = (u: User) => ensure(isLeader(u), "forbidden", 403);
