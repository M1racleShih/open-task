import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import staticPlugin from "@fastify/static";
import { request, type APIRequestContext } from "@playwright/test";
import { buildApp } from "../server/app.js";
import { pool, connectionString } from "../server/db.js";
import { initJobs, boss } from "../server/jobs.js";
import { terms, type Task, type Project, type User } from "../shared/model.js";

// A fixed database and an API started by this runner prevent accidental writes
// to an existing application. There is deliberately no configurable target URL.
const database = new URL(connectionString);
assert.equal(database.hostname, "127.0.0.1");
assert.equal(database.port, "55432");
assert.equal(
  database.pathname,
  "/open_task_release_case",
  "Use the isolated case database",
);
assert.equal(
  (await pool.query("SELECT current_database() AS name")).rows[0].name,
  "open_task_release_case",
);
const run = randomUUID().slice(0, 8);
const prefix = `[模拟验收 ${run}]`;
const output = `artifacts/release-case/${run}`;
const base = "http://127.0.0.1:4318";
const checks: string[] = [];
const actors: Record<
  string,
  { ctx: APIRequestContext; user: User; csrf: string }
> = {};
const taskIds: string[] = [];
let worker: ChildProcess | undefined;
let workerLogs = "";
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
await mkdir(output, { recursive: true });
const at = (hours: number) =>
  new Date(Date.now() + hours * 3600000).toISOString();
const dates = {
  plannedStart: at(0),
  acceptBy: at(2),
  feedbackBy: at(4),
  deadline: at(24),
  reviewBy: "",
};
const record = (name: string) => {
  checks.push(name);
  console.log(`PASS: ${name}`);
};

async function serve() {
  const server = await buildApp();
  await server.register(staticPlugin, {
    root: fileURLToPath(new URL("../dist", import.meta.url)),
  });
  server.setNotFoundHandler((req, reply) =>
    req.url.startsWith("/api/")
      ? reply.code(404).send({ error: { code: "notFound" } })
      : reply.sendFile("index.html"),
  );
  try {
    await server.listen({ host: "127.0.0.1", port: 4318 });
    return server;
  } catch (error) {
    await server.close();
    throw error;
  }
}
async function api(
  who: string,
  path: string,
  body?: unknown,
  status = 200,
  code?: string,
  key = randomUUID(),
  method = body === undefined ? "GET" : "POST",
) {
  const actor = actors[who];
  const response = await actor.ctx.fetch(base + "/api/v1" + path, {
    method,
    data: body,
    headers: { "X-CSRF-Token": actor.csrf, "Idempotency-Key": key },
  });
  const data = await response.json();
  assert.equal(response.status(), status, JSON.stringify(data));
  if (code) assert.equal(data.error.code, code);
  return data;
}
async function read(id: string): Promise<Task> {
  return (await api("leader", `/tasks/${id}`)).task;
}
async function act(
  who: string,
  task: Task,
  action: string,
  fields: Record<string, unknown> = {},
): Promise<Task> {
  return api(who, `/tasks/${task.id}/actions/${action}`, {
    version: task.version,
    ...fields,
  });
}
async function waitFor(condition: () => Promise<boolean>, name: string) {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    if (await condition()) return;
    await delay(500);
  }
  throw new Error(`Timed out: ${name}; worker: ${workerLogs}`);
}
async function startWorker() {
  const started = new Date().toISOString();
  worker = spawn(process.execPath, ["--import", "tsx", "server/worker.ts"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  worker.stdout!.on("data", (data) => {
    workerLogs += data.toString();
  });
  worker.stderr!.on("data", (data) => {
    workerLogs += data.toString();
  });
  worker.on("error", (error) => {
    workerLogs += error.message;
  });
  await waitFor(
    async () =>
      !!(
        await pool.query(
          "SELECT 1 FROM worker_health WHERE name='followups' AND checked_at >= $1 AND error IS NULL",
          [started],
        )
      ).rowCount,
    "new worker heartbeat",
  );
}
async function stopWorker() {
  if (!worker || worker.exitCode !== null) return;
  const current = worker;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => current.kill("SIGKILL"), 10000);
    current.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    current.kill("SIGTERM");
  });
  worker = undefined;
}
async function snapshot() {
  return (
    await pool.query(
      "SELECT id,data FROM tasks WHERE id=ANY($1::uuid[]) ORDER BY id",
      [taskIds],
    )
  ).rows;
}

try {
  await initJobs();
  app = await serve(); // Fail if occupied; never reuse another running API.
  for (const username of ["leader", "manager", "member", "other", "admin"]) {
    const ctx = await request.newContext();
    actors[username] = { ctx, user: {} as User, csrf: "" };
    const response = await ctx.post(base + "/api/v1/sessions", {
      data: { username, password: "OpenTask-Test-2026!" },
    });
    assert.equal(response.status(), 200);
    const { user, csrf } = await response.json();
    actors[username] = { ctx, user, csrf };
  }
  record("五个独立会话登录；会话凭据不写入报告");
  const project: Project = await api("leader", "/projects", {
    name: `${prefix} IssueLite CSV 导出`,
    managerId: actors.manager.user.id,
    memberIds: [actors.member.user.id, actors.other.user.id],
  });
  // Nonempty preferences ensure the subsequent backup check covers real content.
  const filter = {
    mode: "month",
    start: "",
    end: "",
    includeUnscheduled: true,
    includeEarlier: false,
  };
  await api(
    "member",
    "/time-preferences",
    { scope: "global", filter },
    200,
    undefined,
    randomUUID(),
    "PUT",
  );
  await api(
    "member",
    "/time-preferences",
    { scope: project.id, filter },
    200,
    undefined,
    randomUUID(),
    "PUT",
  );
  const preferences = await api("member", "/time-preferences");
  assert.deepEqual(preferences.global, filter);
  assert.deepEqual(preferences.projects[project.id], filter);
  await api(
    "member",
    "/projects",
    { name: "越权建项目", managerId: actors.member.user.id, memberIds: [] },
    403,
    "forbidden",
  );
  const missingCsrf = await actors.member.ctx.post(base + "/api/v1/tasks", {
    data: { title: "CSRF probe" },
    headers: { "Idempotency-Key": randomUUID() },
  });
  assert.equal(missingCsrf.status(), 403);
  record("负责人建项目；普通成员越权及缺失 CSRF 被拒绝");

  async function draft(
    title: string,
    owner: string,
    reviewer: string,
    outcome: string,
    criteria: string,
    creator = "leader",
  ) {
    const task: Task = await api(creator, "/tasks", {
      title: `${prefix} ${title}`,
      projectId: project.id,
      ownerId: actors[owner].user.id,
      reviewerId: actors[reviewer].user.id,
      outcome,
      criteria,
      scope:
        "模拟项目；不含导入、权限重构与附件。成果说明不代表真实开发或测试。",
      ...dates,
    });
    taskIds.push(task.id);
    return task;
  }
  const key = randomUUID();
  const payload = {
    title: `${prefix} 实现 CSV 导出`,
    projectId: project.id,
    ownerId: actors.member.user.id,
    reviewerId: "",
    outcome: "导出当前筛选结果的 CSV，交付实现说明及自测记录。",
    criteria: "中文可读；逗号、双引号、换行正确转义；空结果保留表头。",
    scope: "模拟：仅导出编号、标题、状态；不含导入、权限重构与附件。",
    ...dates,
  };
  let impl: Task = await api("member", "/tasks", payload, 200, undefined, key);
  taskIds.push(impl.id);
  assert.equal(
    (await api("member", "/tasks", payload, 200, undefined, key)).id,
    impl.id,
  );
  assert.equal(impl.reviewerId, actors.manager.user.id);
  await api("other", `/tasks/${impl.id}`, undefined, 404, "notFound");
  record("私有草稿、自动验收人和幂等重试保持同一任务");
  impl = await act("member", impl, "submitApproval");
  for (const who of ["leader", "admin"])
    await api(
      who,
      `/tasks/${impl.id}/actions/approve`,
      { version: impl.version },
      403,
      "forbidden",
    );
  impl = await act("manager", impl, "approve");
  assert.equal(impl.stage, "approval");
  impl = await act("leader", impl, "approve");
  assert.equal(impl.stage, "pending");
  assert.equal((await api("other", `/tasks/${impl.id}`)).task.id, impl.id);
  record(
    "项目负责人批准后仍等团队负责人；管理员无业务审批特权；提交后团队可见",
  );

  let root = await act(
    "leader",
    await draft(
      "交付 CSV 导出 v0.1",
      "manager",
      "leader",
      "汇总需求、实现和验证结果。",
      "三个子任务完成，明确交付结论。结果为模拟。",
    ),
    "issue",
  );
  let requirement = await act(
    "leader",
    await draft(
      "确认导出规则",
      "manager",
      "leader",
      "确定字段、编码、转义与空结果规则。",
      "覆盖中文、逗号、双引号、换行及空结果。结果为模拟。",
    ),
    "issue",
  );
  let release = await act(
    "leader",
    await draft(
      "验证并整理交付说明",
      "other",
      "manager",
      "执行约定用例并整理发布说明。",
      "汇总六类用例，引用需求与实现成果。结果为模拟。",
    ),
    "issue",
  );
  root = await act("manager", root, "acceptStart");
  for (const child of [impl, requirement, release])
    await api("leader", `/tasks/${child.id}/relations`, {
      version: child.version,
      targetId: root.id,
      kind: "parent",
      reason: "组成同一交付目标",
    });
  for (const [child, prerequisite] of [
    [impl, requirement],
    [release, impl],
  ])
    await api("leader", `/tasks/${child.id}/relations`, {
      version: child.version,
      targetId: prerequisite.id,
      kind: "dependency",
      reason: "前置成果先验收",
    });
  assert.equal((await api("leader", `/tasks/${impl.id}`)).relations.length, 3);
  record("四个任务、三个父子关系、两条前置依赖持久化");

  impl = await act("member", impl, "acceptStart");
  impl = await act("member", impl, "requestChecklist", {
    items: [
      "导出当前筛选结果",
      "中文编码与特殊字符转义",
      "空结果表头与自测记录",
    ].map((text) => ({ id: randomUUID(), text })),
    reason: "分解既定实现工作，不变更范围。",
    scopeChanged: false,
  });
  assert.equal(impl.checklist.length, 0);
  assert(
    (await api("leader", "/followups")).items.some(
      (n: { taskId: string; reason: string }) =>
        n.taskId === impl.id && n.reason === "checklist",
    ),
  );
  impl = await act("leader", impl, "approveChecklist", {
    requestId: impl.checklistRequests[0].id,
  });
  assert.equal(impl.checklist.length, 3);
  record("接受任务；清单先申请、待办指向负责人、批准后才生效");
  const oldVersion = impl.version;
  impl = await act("leader", impl, "adjust", {
    fields: {
      ...terms(impl),
      criteria: impl.criteria + " 中文文件带 UTF-8 BOM。",
      deadline: at(26),
    },
    reason: "明确 Excel 打开中文文件的编码要求。",
    confirmBy: at(3),
  });
  await api(
    "member",
    `/tasks/${impl.id}/actions/confirm`,
    { version: oldVersion },
    409,
    "versionConflict",
  );
  await api(
    "member",
    `/tasks/${impl.id}/actions/submitResult`,
    { version: impl.version, text: "旧约定提交", reviewBy: at(28) },
    409,
    "confirmationRequired",
  );
  assert.equal((await read(impl.id)).confirmedVersion, oldVersion);
  impl = await act("member", impl, "confirm");
  assert.equal(impl.confirmedVersion, impl.version);
  record("调整保留原承诺；旧版本与未确认提交被拒绝；确认后使用新约定");
  impl = await act("member", impl, "block", {
    reason: "需确认空结果表头。",
    help: "确认空结果导出的具体表现。",
    helperId: actors.manager.user.id,
  });
  const block = impl.blocks[0];
  assert(
    (await api("manager", "/followups")).items.some(
      (n: { taskId: string; reason: string }) =>
        n.taskId === impl.id && n.reason === `blocked:${block.id}`,
    ),
  );
  impl = await act("manager", impl, "replyBlock", {
    blockId: block.id,
    text: "保留编号、标题、状态三列表头，无数据行。",
  });
  impl = await act("member", impl, "resolveBlock", {
    blockId: block.id,
    reason: "规则已明确。",
  });
  assert(impl.blocks[0].resolved);
  const feedback = impl.feedbackBy;
  impl = await act("member", impl, "comment", {
    text: "模拟讨论：已收到编码规则。",
  });
  assert.equal(impl.feedbackBy, feedback);
  record("阻塞待办 → 协助回复 → 负责人解除；评论不更新正式反馈期限");
  impl = await act("member", impl, "progress", {
    text: "模拟进展：导出逻辑已整理，特殊字符用例待补。",
    next: "补齐特殊字符与空结果说明后验收。",
    feedbackBy: at(6),
  });
  assert.match(impl.latestProgress!.next, /特殊字符/);
  impl = await act("member", impl, "toggle", {
    checklistVersion: impl.checklistVersion,
    changes: impl.checklist.map((item) => ({
      itemId: item.id,
      expectedDone: false,
      done: true,
    })),
  });
  assert(impl.checklist.every((item) => item.done));
  assert.equal(impl.stage, "working");
  record("正式进展保留下一步；清单全部完成不会关闭任务");
  impl = await act("member", impl, "submitResult", {
    text: "模拟成果 v1：已说明筛选导出与中文编码；特殊字符证据暂缺。",
    reviewBy: at(27),
  });
  await api(
    "other",
    `/tasks/${impl.id}/actions/pass`,
    { version: impl.version, submissionId: impl.submissions[0].id },
    403,
    "forbidden",
  );
  await api(
    "manager",
    `/tasks/${impl.id}/actions/pass`,
    { version: impl.version, submissionId: impl.submissions[0].id },
    409,
    "dependencyIncomplete",
  );
  assert.equal((await read(impl.id)).stage, "reviewing");
  impl = await act("manager", impl, "returnResult", {
    submissionId: impl.submissions[0].id,
    reason: "补充逗号、双引号、换行与空结果验证说明。",
    feedbackBy: at(8),
  });
  assert.equal(impl.submissions[0].status, "returned");
  record("非验收人被拒绝；未完成依赖阻止验收；退回保存成果及理由");
  async function finish(
    task: Task,
    owner: string,
    reviewer: string,
    text: string,
  ) {
    if (task.stage === "pending") task = await act(owner, task, "acceptStart");
    task = await act(owner, task, "submitResult", { text, reviewBy: at(28) });
    return act(reviewer, task, "pass", {
      submissionId: task.submissions.at(-1)!.id,
    });
  }
  requirement = await finish(
    requirement,
    "manager",
    "leader",
    "模拟规则成果：三列、UTF-8 BOM、CSV 转义、空结果表头。",
  );
  impl = await act("member", impl, "submitResult", {
    text: "模拟成果 v2：补齐筛选范围、中文、逗号、双引号、换行、空结果六类说明；本例未执行真实 CSV 软件。",
    reviewBy: at(28),
  });
  await api(
    "manager",
    `/tasks/${impl.id}/actions/pass`,
    { version: impl.version, submissionId: impl.submissions[0].id },
    409,
    "versionConflict",
  );
  impl = await act("manager", impl, "pass", {
    submissionId: impl.submissions[1].id,
  });
  assert.deepEqual(
    impl.submissions.map((s) => s.status),
    ["returned", "accepted"],
  );
  record("依赖完成后重交通过；旧成果 ID 被拒绝；两次成果保留");
  release = await finish(
    release,
    "other",
    "manager",
    "模拟交付说明：规则与实现已验收，汇总六类用例；仅验证 OpenTask。",
  );
  root = await read(root.id);
  assert.equal(root.stage, "working");
  root = await finish(
    root,
    "manager",
    "leader",
    "模拟交付汇总：三个子任务已完成，OpenTask case 闭环。",
  );
  await api(
    "member",
    `/tasks/${impl.id}/actions/start`,
    { version: impl.version },
    409,
    "terminal",
  );
  const all = await api("leader", `/tasks?projectId=${project.id}&time=all`);
  assert.equal(all.total, 4);
  assert(all.items.every((t: Task) => t.stage === "done"));
  assert.equal(all.counts[project.id].done, 4);
  assert(
    !(await api("leader", "/followups")).items.some((n: { taskId: string }) =>
      taskIds.includes(n.taskId),
    ),
  );
  record("子任务不自动完成父任务；显式验收后四任务完成、待办清空且不可重开");
  const history = await api("leader", `/events?taskId=${impl.id}&limit=200`);
  for (const type of [
    "created",
    "submitApproval",
    "approve",
    "acceptStart",
    "requestChecklist",
    "approveChecklist",
    "adjust",
    "confirm",
    "block",
    "replyBlock",
    "resolveBlock",
    "progress",
    "toggle",
    "submitResult",
    "returnResult",
    "pass",
  ])
    assert(
      history.items.some((e: { type: string }) => e.type === type),
      `Missing event ${type}`,
    );
  const beforeRestart = await snapshot();
  await app.close();
  app = undefined;
  app = await serve();
  assert.deepEqual(await snapshot(), beforeRestart);
  assert.equal((await read(impl.id)).stage, "done");
  const jobs = await pool.query(
    "SELECT id FROM pgboss.job WHERE data->>'taskId'=ANY($1::text[]) AND state='created'",
    [taskIds],
  );
  assert(jobs.rowCount, "Case jobs should queue while worker is stopped");
  await startWorker();
  await waitFor(
    async () =>
      !(
        await pool.query(
          "SELECT 1 FROM pgboss.job WHERE id=ANY($1::uuid[]) AND state <> 'completed'",
          [jobs.rows.map((r) => r.id)],
        )
      ).rowCount,
    "case jobs complete",
  );
  await stopWorker();
  await startWorker();
  assert.deepEqual(await snapshot(), beforeRestart);
  await stopWorker();
  record(
    "完整历史、API 重启与会话可用、worker 消费停机队列并重启，数据保持一致",
  );
  const report = {
    result: "passed",
    channel: "HTTP API + PostgreSQL + worker",
    run,
    at: new Date().toISOString(),
    database: "open_task_release_case",
    base,
    project: { id: project.id, name: project.name },
    tasks: [root, requirement, impl, release].map(
      ({ id, number, title, stage }) => ({
        id,
        number,
        title,
        stage,
        url: `${base}/?task=${id}`,
      }),
    ),
    checks,
    limits: [
      "模拟开发项目，不验证 CSV 软件本身",
      "此脚本不验证浏览器；界面证据单独记录",
      "未执行公网部署、负载测试或备份恢复",
    ],
  };
  await writeFile(`${output}/result.json`, JSON.stringify(report, null, 2));
  await writeFile(
    "artifacts/release-case/latest.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    `Release case passed: ${checks.length} checks; ${output}/result.json`,
  );
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify(
      { result: "failed", run, checks, error: String(error), workerLogs },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await stopWorker();
  for (const actor of Object.values(actors)) await actor.ctx.dispose();
  await app?.close();
  await boss.stop();
  await pool.end();
}
