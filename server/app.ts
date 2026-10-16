import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import argon2 from "argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { pool, transaction, db } from "./db.js";
import { userTable } from "./schema.js";
import { DomainError, ensure } from "./errors.js";
import {
  users,
  projects,
  userRow,
  task,
  isLeader,
  requireLeader,
  type Client,
} from "./store.js";
import type { User } from "../shared/model.js";
import { createTask, action } from "./tasks.js";
import { changeRelation } from "./relations.js";
import { schedule } from "./jobs.js";
import { describeAPI } from "./openapi.js";
import {
  taskQuerySchema,
  matchedTasks,
  timeFilterSchema,
} from "./timeFilter.js";
import { defaultTimeFilter } from "../shared/timeFilter.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
declare module "fastify" {
  interface FastifyRequest {
    user: User;
    csrf: string;
  }
}
export async function buildApp() {
  const app = Fastify({
    logger: {
      redact: [
        "req.headers.cookie",
        "req.headers.authorization",
        "req.body.password",
      ],
      level: process.env.LOG_LEVEL ?? "warn",
    },
    bodyLimit: 256 * 1024,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 600,
    timeWindow: "1 minute",
    keyGenerator: (req) =>
      req.cookies?.session ? hash(req.cookies.session) : req.ip,
  });
  await app.register(swagger, {
    openapi: { info: { title: "Open Task API", version: "1.0.0" } },
  });
  app.setErrorHandler((e, req, reply) => {
    const err = e as any;
    const status =
      e instanceof ZodError
        ? 422
        : err.code === "23505"
          ? 409
          : (err.statusCode ?? 500);
    reply.code(status).send({
      error: {
        code:
          e instanceof ZodError
            ? "invalid"
            : err.code === "23505"
              ? "duplicateRecord"
              : status >= 500
                ? "serverError"
                : (err.code ?? "invalid"),
        requestId: req.id,
        details: err.details ?? {},
      },
    });
    if (status >= 500) req.log.error(e);
  });
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "same-origin");
    if (!req.url.startsWith("/api/")) return;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      ensure(!origin || origin === `http://${req.headers.host}`, "csrf", 403);
    }
    if (req.url === "/api/v1/sessions" && req.method === "POST") return;
    const token = req.cookies.session;
    ensure(token, "unauthorized", 401);
    const r = await pool.query(
      "SELECT u.*,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active",
      [hash(token)],
    );
    ensure(r.rowCount, "unauthorized", 401);
    req.user = userRow(r.rows[0]);
    req.csrf = r.rows[0].csrf;
    if (!["GET", "HEAD"].includes(req.method))
      ensure(req.headers["x-csrf-token"] === req.csrf, "csrf", 403);
  });
  app.get("/health", async () => {
    await pool.query("SELECT 1");
    return { status: "ok" };
  });
  app.post(
    "/api/v1/sessions",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const b = z
        .object({
          username: z.string().max(100),
          password: z.string().max(256),
        })
        .parse(req.body);
      const r = await pool.query("SELECT * FROM users WHERE username=$1", [
        b.username,
      ]);
      ensure(
        r.rowCount &&
          r.rows[0].active &&
          (await argon2.verify(r.rows[0].password_hash, b.password)),
        "loginFailed",
        401,
      );
      const token = randomBytes(32).toString("hex"),
        csrf = randomBytes(24).toString("hex");
      await pool.query(
        "INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",
        [hash(token), r.rows[0].id, csrf],
      );
      reply.setCookie("session", token, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 43200,
      });
      return { user: userRow(r.rows[0]), csrf };
    },
  );
  app.delete("/api/v1/sessions", async (req, reply) => {
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      hash(req.cookies.session!),
    ]);
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/v1/me", async (req) => ({ user: req.user, csrf: req.csrf }));
  app.get("/api/v1/users", async () =>
    db
      .select({
        id: userTable.id,
        username: userTable.username,
        name: userTable.name,
        roles: userTable.roles,
        active: userTable.active,
      })
      .from(userTable)
      .orderBy(userTable.username),
  );
  app.get("/api/v1/projects", async () => transaction(projects));
  const mutate =
    (fn: (c: Client, u: User, b: any, params: any) => Promise<unknown>) =>
    async (req: any) =>
      transaction(async (c) => {
        // All writes affecting permissions, tasks and graph use the same short advisory lock.
        // This gives deterministic acceptance-versus-relation and role-transfer semantics.
        await c.query("SELECT pg_advisory_xact_lock(781002)");
        const fresh = (await users(c)).find(
          (u) => u.id === req.user.id && u.active,
        );
        ensure(fresh, "unauthorized", 401);
        const key = z
          .string()
          .min(8)
          .max(100)
          .parse(req.headers["idempotency-key"]);
        const fingerprint = hash(
          req.method + req.url + JSON.stringify(req.body),
        );
        const cached = await c.query(
          "SELECT * FROM idempotency WHERE user_id=$1 AND key=$2",
          [fresh.id, key],
        );
        if (cached.rowCount) {
          ensure(
            cached.rows[0].fingerprint === fingerprint,
            "idempotencyConflict",
            409,
          );
          return cached.rows[0].response;
        }
        const result = await fn(c, fresh, req.body ?? {}, req.params ?? {});
        await c.query(
          "INSERT INTO idempotency(user_id,key,fingerprint,response) VALUES($1,$2,$3,$4)",
          [fresh.id, key, fingerprint, JSON.stringify(result)],
        );
        return result;
      });
  app.get("/api/v1/time-preferences", async (req) => {
    const rows = (
      await pool.query(
        "SELECT scope,filter FROM time_preferences WHERE user_id=$1",
        [req.user.id],
      )
    ).rows;
    return {
      global:
        rows.find((r) => r.scope === "global")?.filter ?? defaultTimeFilter,
      projects: Object.fromEntries(
        rows
          .filter((r) => r.scope !== "global")
          .map((r) => [r.scope, r.filter]),
      ),
    };
  });
  app.put(
    "/api/v1/time-preferences",
    mutate(async (c, u, b) => {
      const v = z
        .object({
          scope: z.union([z.literal("global"), z.string().uuid()]),
          filter: timeFilterSchema.nullable(),
        })
        .parse(b);
      ensure(v.scope !== "global" || v.filter !== null, "invalid");
      if (v.scope !== "global")
        ensure(
          (await projects(c)).some((p) => p.id === v.scope),
          "projectRequired",
        );
      if (v.filter === null)
        await c.query(
          "DELETE FROM time_preferences WHERE user_id=$1 AND scope=$2",
          [u.id, v.scope],
        );
      else
        await c.query(
          "INSERT INTO time_preferences(user_id,scope,filter) VALUES($1,$2,$3) ON CONFLICT(user_id,scope) DO UPDATE SET filter=excluded.filter",
          [u.id, v.scope, v.filter],
        );
      return { ok: true };
    }),
  );
  app.post(
    "/api/v1/users",
    mutate(async (c, u, b) => {
      ensure(u.roles.includes("admin"), "forbidden", 403);
      const v = z
        .object({
          username: z.string().regex(/^[a-zA-Z0-9_.-]{2,50}$/),
          name: z.string().min(1).max(100),
          password: z.string().min(12).max(256),
          roles: z.array(z.enum(["admin", "leader", "member"])).min(1),
        })
        .parse(b);
      ensure(
        !v.roles.includes("leader") ||
          !(await users(c)).some((x) => isLeader(x) && x.active),
        "leaderExists",
      );
      const id = randomUUID();
      await c.query(
        "INSERT INTO users(id,username,name,password_hash,roles) VALUES($1,$2,$3,$4,$5)",
        [
          id,
          v.username,
          v.name,
          await argon2.hash(v.password),
          JSON.stringify(v.roles),
        ],
      );
      return { id };
    }),
  );
  app.patch(
    "/api/v1/users/:id",
    mutate(async (c, u, b, p) => {
      ensure(u.roles.includes("admin"), "forbidden", 403);
      const active = z.boolean().parse(b.active);
      ensure(p.id !== u.id, "selfDisable");
      if (!active) {
        ensure(
          !(await projects(c)).some((x) => x.managerId === p.id),
          "transferRequired",
          409,
        );
        const assigned = await c.query(
          "SELECT 1 FROM tasks WHERE stage NOT IN ('draft','done','cancelled') AND (data->>'ownerId'=$1 OR data->>'reviewerId'=$1 OR data->>'issuerId'=$1 OR (stage='approval' AND data->'approvalIds'->>(data->>'approvalIndex')::int=$1)) LIMIT 1",
          [p.id],
        );
        ensure(!assigned.rowCount, "transferRequired", 409);
        ensure(
          !(await users(c)).some((x) => x.id === p.id && isLeader(x)),
          "transferRequired",
          409,
        );
      }
      await c.query("UPDATE users SET active=$2 WHERE id=$1", [p.id, active]);
      await c.query("DELETE FROM sessions WHERE user_id=$1", [p.id]);
      return { ok: true };
    }),
  );
  app.post(
    "/api/v1/projects",
    mutate(async (c, u, b) => {
      requireLeader(u);
      const v = z
        .object({
          name: z.string().trim().min(1).max(200),
          managerId: z.string().uuid(),
          memberIds: z.array(z.string().uuid()).max(100),
          color: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/)
            .default("#7292c7"),
        })
        .parse(b);
      const all = await users(c);
      ensure(
        [v.managerId, ...v.memberIds].every((id) =>
          all.some((x) => x.id === id && x.active),
        ),
        "memberRequired",
      );
      const id = randomUUID();
      await c.query(
        "INSERT INTO projects(id,name,manager_id,member_ids,color) VALUES($1,$2,$3,$4,$5)",
        [id, v.name, v.managerId, JSON.stringify(v.memberIds), v.color],
      );
      return { id, ...v };
    }),
  );
  app.patch(
    "/api/v1/projects/:id",
    mutate(async (c, u, b, p) => {
      await c.query("SELECT id FROM projects WHERE id=$1 FOR UPDATE", [p.id]);
      const project = (await projects(c)).find((x) => x.id === p.id);
      ensure(project, "notFound", 404);
      ensure(project.managerId === u.id || isLeader(u), "forbidden", 403);
      const ids = z
        .array(z.string().uuid())
        .max(100)
        .parse(b.memberIds ?? project.memberIds);
      const color = z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .parse(b.color ?? project.color);
      const all = await users(c);
      ensure(
        ids.every((id) => all.some((x) => x.id === id && x.active)),
        "memberRequired",
      );
      if (b.managerId && b.managerId !== project.managerId) {
        requireLeader(u);
        ensure(
          all.some((x) => x.id === b.managerId && x.active),
          "memberRequired",
        );
        const pending = await c.query(
          "SELECT 1 FROM tasks WHERE project_id=$1 AND stage NOT IN ('draft','done','cancelled') AND (stage='approval' OR data->>'reviewerId'=$2 OR data->>'ownerId'=$2) LIMIT 1",
          [p.id, project.managerId],
        );
        ensure(!pending.rowCount, "transferRequired", 409);
        project.managerId = b.managerId;
      }
      await c.query(
        "UPDATE projects SET manager_id=$2,member_ids=$3,color=$4 WHERE id=$1",
        [p.id, project.managerId, JSON.stringify(ids), color],
      );
      return { ...project, memberIds: ids, color };
    }),
  );
  app.post("/api/v1/tasks", mutate(createTask));
  app.post(
    "/api/v1/tasks/:id/actions/:action",
    mutate(async (c, u, b, p) => {
      const result = await action(
        c,
        u,
        z.string().uuid().parse(p.id),
        p.action,
        b,
      );
      await schedule(c, result.id);
      return result;
    }),
  );
  app.post(
    "/api/v1/tasks/:id/relations",
    mutate((c, u, b, p) => changeRelation(c, u, p.id, b)),
  );
  app.delete(
    "/api/v1/tasks/:id",
    mutate(async (c, u, b, p) => {
      const t = await task(c, p.id, u);
      ensure(t.stage === "draft" && t.creatorId === u.id, "forbidden", 403);
      await c.query("DELETE FROM tasks WHERE id=$1", [t.id]);
      return { ok: true };
    }),
  );
  app.get("/api/v1/tasks", async (req) => {
    const q = taskQuerySchema
      .extend({
        cursor: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(200).default(100),
      })
      .parse(req.query);
    const match = matchedTasks(req.user.id, q);
    const r = await pool.query(
      `WITH RECURSIVE ${match.sql},
      page AS (SELECT * FROM matched WHERE number>$11 ORDER BY number LIMIT $12),
      ancestors(id) AS (
        SELECT id FROM page
        UNION
        SELECT r.target_id FROM ancestors a JOIN relations r ON r.source_id=a.id AND r.kind='parent'
          JOIN visible v ON v.id=r.target_id
      )
      SELECT
        COALESCE((SELECT jsonb_agg(data || CASE WHEN source='earlier' THEN '{"viewSource":"earlier"}'::jsonb ELSE '{}'::jsonb END ORDER BY number) FROM page), '[]') AS items,
        COALESCE((SELECT jsonb_agg(v.data || '{"viewSource":"context"}'::jsonb ORDER BY v.number)
          FROM visible v JOIN ancestors a ON a.id=v.id WHERE v.id NOT IN (SELECT id FROM page)), '[]') AS context,
        (SELECT count(*)::int FROM matched) AS total,
        EXISTS (SELECT 1 FROM matched WHERE number > (SELECT max(number) FROM page)) AS more,
        COALESCE((SELECT jsonb_object_agg(project, facts) FROM (
          SELECT COALESCE(project_id::text,'') AS project,
            jsonb_build_object('total',count(*),'done',count(*) FILTER (WHERE stage='done'),
              'reviewing',count(*) FILTER (WHERE stage='reviewing'),
              'blocked',count(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(data->'blocks') b WHERE b->>'resolved'='false'))) AS facts
          FROM matched GROUP BY project_id
        ) counts), '{}') AS counts`,
      [...match.values, q.cursor, q.limit],
    );
    const row = r.rows[0];
    return {
      items: row.items,
      context: row.context,
      total: row.total,
      counts: row.counts,
      nextCursor: row.more ? row.items.at(-1).number : null,
    };
  });
  app.get("/api/v1/tasks/:id", async (req) =>
    transaction(async (c) => {
      const t = await task(
        c,
        z
          .string()
          .uuid()
          .parse((req.params as any).id),
        req.user,
      );
      const rs = await c.query(
        "SELECT r.id,r.source_id AS \"sourceId\",r.target_id AS \"targetId\",r.kind FROM relations r JOIN tasks a ON a.id=r.source_id JOIN tasks b ON b.id=r.target_id WHERE (r.source_id=$1 OR r.target_id=$1) AND (a.stage<>'draft' OR a.creator_id=$2) AND (b.stage<>'draft' OR b.creator_id=$2)",
        [t.id, req.user.id],
      );
      const ids = [
        ...new Set(rs.rows.flatMap((r) => [r.sourceId, r.targetId])),
      ];
      const targets = ids.length
        ? (
            await c.query("SELECT data FROM tasks WHERE id=ANY($1::uuid[])", [
              ids,
            ])
          ).rows.map((r) => ({
            id: r.data.id,
            title: r.data.title,
            number: r.data.number,
            stage: r.data.stage,
          }))
        : [];
      return { task: t, relations: rs.rows, targets };
    }),
  );
  app.get("/api/v1/relations", async (req) => {
    const q = z
      .object({
        cursor: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(1000).default(500),
      })
      .parse(req.query);
    const r = await pool.query(
      "SELECT r.id,r.source_id AS \"sourceId\",r.target_id AS \"targetId\",r.kind FROM relations r JOIN tasks a ON a.id=r.source_id JOIN tasks b ON b.id=r.target_id WHERE (a.stage<>'draft' OR a.creator_id=$1) AND (b.stage<>'draft' OR b.creator_id=$1) AND ($2::uuid IS NULL OR r.id>$2) ORDER BY r.id LIMIT $3",
      [req.user.id, q.cursor ?? null, q.limit + 1],
    );
    return {
      items: r.rows.slice(0, q.limit),
      nextCursor: r.rows.length > q.limit ? r.rows[q.limit - 1].id : null,
    };
  });
  app.get("/api/v1/events", async (req) => {
    const q = taskQuerySchema
      .extend({
        cursor: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(200).default(100),
        taskId: z.string().uuid().optional(),
        actorId: z.string().uuid().optional(),
        taskSearch: z.string().max(200).optional(),
      })
      .parse(req.query);
    // A selected task's history is always complete, independent of viewing filters.
    const match = matchedTasks(
      req.user.id,
      q.taskId
        ? {
            ...q,
            search: "",
            projectId: undefined,
            stage: undefined,
            time: "all",
            related: undefined,
            relatedUserId: undefined,
          }
        : { ...q, search: q.taskSearch ?? "" },
    );
    const r = await pool.query(
      `WITH ${match.sql}
      SELECT t.data->>'title' AS "taskTitle",t.number AS "taskNumber",e.id,e.task_id AS "taskId",e.actor_id AS "actorId",e.type,e.version,e.before_value AS before,e.after_value AS after,e.note,e.at
      FROM events e JOIN matched t ON t.id=e.task_id
      WHERE ($11::bigint=0 OR e.id<$11) AND ($12::uuid IS NULL OR e.task_id=$12)
        AND ($13::uuid IS NULL OR e.actor_id=$13)
        AND ($15::text='' OR e.note ILIKE '%'||$15||'%' OR t.data->>'title' ILIKE '%'||$15||'%') ORDER BY e.id DESC LIMIT $14`,
      [
        ...match.values,
        q.cursor,
        q.taskId ?? null,
        q.actorId ?? null,
        q.limit + 1,
        q.taskId || q.taskSearch !== undefined ? "" : q.search,
      ],
    );
    return {
      items: r.rows.slice(0, q.limit),
      nextCursor: r.rows.length > q.limit ? r.rows[q.limit - 1].id : null,
    };
  });
  app.get("/api/v1/followups", async (req) => {
    const q = z
      .object({
        cursor: z.string().max(200).default(""),
        limit: z.coerce.number().int().min(1).max(1000).default(1000),
      })
      .parse(req.query);
    const r = await pool.query(
      "SELECT f.task_id AS \"taskId\",t.data->>'title' AS \"taskTitle\",t.number AS \"taskNumber\",f.reason,f.version,f.handler_id AS \"handlerId\",f.since,(f.task_id::text||':'||f.reason||':'||f.version::text) AS cursor FROM followups f JOIN tasks t ON t.id=f.task_id WHERE f.active AND (f.handler_id=$1 OR $2) AND (t.stage<>'draft' OR t.creator_id=$1) AND (f.task_id::text||':'||f.reason||':'||f.version::text)>$3 ORDER BY (f.task_id::text||':'||f.reason||':'||f.version::text) LIMIT $4",
      [req.user.id, isLeader(req.user), q.cursor, q.limit + 1],
    );
    return {
      items: r.rows.slice(0, q.limit),
      nextCursor: r.rows.length > q.limit ? r.rows[q.limit - 1].cursor : null,
    };
  });
  app.get("/api/v1/openapi.json", async () => describeAPI(app.swagger()));
  return app;
}
