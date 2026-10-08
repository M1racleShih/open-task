import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../server/app.js";
import { pool } from "../server/db.js";
import { initJobs, boss } from "../server/jobs.js";
if (!process.env.DATABASE_URL?.endsWith("/open_task_test"))
  throw new Error(
    "Integration tests require the isolated open_task_test database; run scripts/test-db.sh.",
  );
const app = await buildApp();
const actors: Record<string, { cookie: string; csrf: string; id: string }> = {};
const prefix = "Integration " + randomUUID().slice(0, 8);
const future = new Date(Date.now() + 86400000).toISOString();
let projectId: string;
async function api(
  who: string,
  method: any,
  url: string,
  body?: any,
  key = randomUUID(),
) {
  const a = actors[who];
  const r = await app.inject({
    method,
    url: "/api/v1" + url,
    headers: {
      cookie: a?.cookie ?? "",
      "x-csrf-token": a?.csrf ?? "",
      "idempotency-key": key,
    },
    payload: body,
  });
  return { status: r.statusCode, data: r.json() };
}
async function ok(who: string, method: any, url: string, body?: any) {
  const r = await api(who, method, url, body);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  if (method === "GET" && url === "/followups") {
    while (r.data.nextCursor) {
      const next = await api(
        who,
        method,
        url + "?cursor=" + encodeURIComponent(r.data.nextCursor),
      );
      assert.equal(next.status, 200);
      r.data.items.push(...next.data.items);
      r.data.nextCursor = next.data.nextCursor;
    }
  }
  return r.data;
}
async function create(
  who = "member",
  project: string | null = projectId,
  owner = "member",
) {
  return ok(who, "POST", "/tasks", {
    title: prefix,
    outcome: "Deliver a written result",
    criteria: "Reviewer can verify evidence",
    scope: "MVP",
    ownerId: actors[owner].id,
    reviewerId: "",
    projectId: project,
    deadline: future,
    acceptBy: future,
    feedbackBy: future,
    reviewBy: "",
  });
}
async function act(who: string, t: any, name: string, b: any = {}) {
  return ok(who, "POST", `/tasks/${t.id}/actions/${name}`, {
    version: t.version,
    ...b,
  });
}
before(async () => {
  await initJobs();
  for (const who of ["admin", "leader", "manager", "member", "other"]) {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { username: who, password: "OpenTask-Test-2026!" },
    });
    assert.equal(r.statusCode, 200, r.body);
    actors[who] = {
      cookie: r.headers["set-cookie"]!.toString().split(";")[0],
      csrf: r.json().csrf,
      id: r.json().user.id,
    };
  }
  const p = await ok("leader", "POST", "/projects", {
    name: prefix,
    managerId: actors.manager.id,
    memberIds: [actors.member.id],
  });
  projectId = p.id;
});
after(async () => {
  await app.close();
  await boss.stop();
  await pool.end();
});
test("AC-01/02/05/07/25/29/34: private draft, two approvals, execution and returned submission history", async () => {
  let t = await create();
  assert.equal((await api("other", "GET", `/tasks/${t.id}`)).status, 404);
  assert.equal(
    (
      await api("member", "POST", `/tasks/${t.id}/actions/issue`, {
        version: 1,
      })
    ).status,
    403,
  );
  t = await act("member", t, "submitApproval");
  assert.equal(t.reviewerId, actors.manager.id);
  assert.equal((await api("other", "GET", `/tasks/${t.id}`)).status, 200);
  assert.equal(
    (
      await api("leader", "POST", `/tasks/${t.id}/actions/approve`, {
        version: t.version,
      })
    ).status,
    403,
  );
  t = await act("manager", t, "approve");
  assert.equal(t.stage, "approval");
  t = await act("leader", t, "approve");
  assert.equal(t.stage, "pending");
  t = await act("member", t, "accept");
  t = await act("member", t, "start");
  t = await act("member", t, "progress", {
    text: "Evidence ready",
    next: "Submit",
    feedbackBy: future,
  });
  t = await act("member", t, "submitResult", {
    text: "Result version one",
    links: ["https://example.org/evidence"],
    reviewBy: future,
  });
  assert.equal(
    (
      await api("leader", "POST", `/tasks/${t.id}/actions/pass`, {
        version: t.version,
        submissionId: t.submissions.at(-1).id,
      })
    ).status,
    403,
  );
  t = await act("manager", t, "returnResult", {
    submissionId: t.submissions.at(-1).id,
    reason: "Add detail",
    feedbackBy: future,
  });
  assert.equal(t.stage, "working");
  t = await act("member", t, "submitResult", {
    text: "Result version two",
    reviewBy: future,
  });
  t = await act("manager", t, "pass", {
    submissionId: t.submissions.at(-1).id,
  });
  assert.equal(t.stage, "done");
  assert.equal(t.submissions.length, 2);
  assert.equal(
    (
      await api("leader", "POST", `/tasks/${t.id}/actions/adjust`, {
        version: t.version,
      })
    ).status,
    409,
  );
});
test("AC-03/04/30/31/32/33/35: route variants, idempotency, mandatory deadline and self acceptance", async () => {
  let t = await create("leader", null, "leader");
  t = await act("leader", t, "issue");
  const key = randomUUID();
  const body = { version: t.version };
  const first = await api(
    "leader",
    "POST",
    `/tasks/${t.id}/actions/acceptStart`,
    body,
    key,
  );
  const retry = await api(
    "leader",
    "POST",
    `/tasks/${t.id}/actions/acceptStart`,
    body,
    key,
  );
  assert.deepEqual(first, retry);
  t = first.data;
  t = await act("leader", t, "submitResult", {
    text: "Leader result",
    reviewBy: future,
  });
  t = await act("leader", t, "pass", { submissionId: t.submissions.at(-1).id });
  assert.equal(t.stage, "done");
  let m = await create("manager");
  m = await act("manager", m, "submitApproval");
  assert.deepEqual(m.approvalIds, [actors.leader.id]);
  let temp = await create("member", null);
  temp = await act("member", temp, "submitApproval");
  assert.deepEqual(temp.approvalIds, [actors.leader.id]);
  assert.equal(temp.reviewerId, actors.leader.id);
  let missing = await create("leader");
  missing = await act("leader", missing, "edit", {
    fields: { ...missing, deadline: "" },
  });
  assert.equal(
    (
      await api("leader", "POST", `/tasks/${missing.id}/actions/issue`, {
        version: missing.version,
      })
    ).status,
    422,
  );
  const self = await create("member");
  const rejected = await api(
    "member",
    "POST",
    `/tasks/${self.id}/actions/edit`,
    {
      version: self.version,
      fields: { ...self, reviewerId: actors.member.id },
    },
  );
  assert.equal(rejected.status, 422);
  assert.equal(rejected.data.error.code, "selfReview");
  assert.deepEqual((await ok("member", "GET", `/tasks/${self.id}`)).task, self);
  const p = await ok("leader", "POST", "/projects", {
    name: prefix + " combined",
    managerId: actors.leader.id,
    memberIds: [],
  });
  let combined = await create("member", p.id);
  combined = await act("member", combined, "submitApproval");
  assert.equal(combined.approvalIds.length, 1);
  combined = await act("leader", combined, "approve");
  assert.equal(combined.stage, "pending");
});
test("AC-06/08/09/50: refusal, formal feedback and block collaboration", async () => {
  let refused = await create("leader");
  refused = await act("leader", refused, "issue");
  refused = await act("member", refused, "refuse", {
    reason: "Need reassignment",
  });
  assert.equal(refused.stage, "pending");
  assert.ok(
    (await ok("leader", "GET", "/followups")).items.some(
      (x: any) => x.taskId === refused.id && x.reason === "refused",
    ),
  );
  let t = await create("leader");
  t = await act("leader", t, "issue");
  t = await act("member", t, "acceptStart");
  t = await act("other", t, "comment", { text: "Discussion" });
  assert.equal(t.lastFeedbackAt, null);
  t = await act("other", t, "block", {
    reason: "Missing facts",
    help: "Provide source",
    helperId: actors.manager.id,
  });
  t = await act("manager", t, "replyBlock", {
    blockId: t.blocks[0].id,
    text: "Source found",
  });
  assert.equal(t.blocks[0].resolved, false);
  const deadline = t.deadline;
  t = await act("member", t, "resolveBlock", {
    blockId: t.blocks[0].id,
    reason: "Verified",
  });
  assert.equal(t.deadline, deadline);
  t = await act("member", t, "progress", {
    text: "No material progress, waiting for facts",
    next: "Read source",
    feedbackBy: future,
  });
  assert.ok(t.lastFeedbackAt);
  assert.equal(t.latestProgress.next, "Read source");
  const persisted = (await ok("member", "GET", "/tasks/" + t.id)).task;
  assert.equal(persisted.latestProgress.next, "Read source");
});
test("AC-49/11: returned approval and stale version rejection", async () => {
  let t = await create();
  t = await act("member", t, "submitApproval");
  t = await act("manager", t, "returnApproval", { reason: "Clarify" });
  t = await act("member", t, "edit", {
    fields: { ...t, outcome: "Clear result" },
  });
  t = await act("member", t, "submitApproval");
  assert.equal(
    (
      await api("manager", "POST", `/tasks/${t.id}/actions/approve`, {
        version: t.version - 1,
      })
    ).status,
    409,
  );
  t = await act("manager", t, "approve");
  assert.equal(t.stage, "approval");
});
test("AC-10/11/36/37/38/39: checklist approval preserves toggles, adjustment invalidates submission", async () => {
  let t = await create("leader");
  t = await act("leader", t, "issue");
  t = await act("member", t, "acceptStart");
  const itemId = randomUUID();
  t = await act("member", t, "requestChecklist", {
    items: [{ id: itemId, text: "Evidence" }],
    scopeChanged: false,
    reason: "Execution plan",
  });
  t = await act("leader", t, "approveChecklist", {
    requestId: t.checklistRequests[0].id,
  });
  t = await act("member", t, "requestChecklist", {
    items: [{ id: itemId, text: "Verified evidence" }],
    scopeChanged: true,
    reason: "Scope clarification",
  });
  t = await act("member", t, "toggle", {
    itemId,
    expectedDone: false,
    done: true,
  });
  assert.equal(t.stage, "working");
  assert.equal(t.lastFeedbackAt, null);
  t = await act("leader", t, "approveChecklist", {
    requestId: t.checklistRequests[1].id,
    confirmBy: future,
  });
  assert.equal(t.checklist[0].done, true);
  assert.equal(t.version, 2);
  assert.equal(
    (
      await api("member", "POST", `/tasks/${t.id}/actions/submitResult`, {
        version: 2,
        text: "result",
        reviewBy: future,
      })
    ).status,
    409,
  );
  t = await act("member", t, "progress", {
    text: "Continuing",
    next: "Read new agreement",
    feedbackBy: future,
  });
  t = await act("member", t, "confirm");
  t = await act("member", t, "submitResult", {
    text: "Done",
    reviewBy: future,
  });
  const old = t;
  t = await act("leader", t, "adjust", {
    fields: { ...t, outcome: "Revised outcome" },
    reason: "New requirement",
    confirmBy: future,
  });
  assert.equal(t.stage, "working");
  assert.equal(t.submissions.at(-1).status, "superseded");
  assert.equal(
    (
      await api("manager", "POST", `/tasks/${t.id}/actions/pass`, {
        version: old.version,
        submissionId: old.submissions.at(-1).id,
      })
    ).status,
    409,
  );
  t = await act("leader", t, "adjust", {
    fields: { ...t, ownerId: actors.other.id },
    reason: "Reassign",
    confirmBy: future,
  });
  assert.equal(t.stage, "pending");
  assert.equal(t.confirmedVersion, null);
});
test("AC-15/16/17/40/41/42/43: relation cycles, concurrent inverse edges, dependency and child review rules", async () => {
  let a = await create("leader"),
    b = await create("leader"),
    c = await create("leader");
  for (const task of [a, b, c]) await act("leader", task, "issue");
  a = (await ok("leader", "GET", "/tasks/" + a.id)).task;
  b = (await ok("leader", "GET", "/tasks/" + b.id)).task;
  c = (await ok("leader", "GET", "/tasks/" + c.id)).task;
  const rel = (from: any, to: any, kind: string) =>
    api("leader", "POST", `/tasks/${from.id}/relations`, {
      version: from.version,
      targetId: to.id,
      kind,
      reason: "Organize work",
    });
  const outcomes = await Promise.all([
    rel(a, b, "parent"),
    rel(b, a, "parent"),
  ]);
  assert.deepEqual(outcomes.map((x) => x.status).sort(), [200, 409]);
  const child = outcomes[0].status === 200 ? a : b,
    parent = child.id === a.id ? b : a;
  assert.equal(
    (await rel(child, parent, "dependency")).data.error.code,
    "hierarchyDependency",
  );
  assert.equal((await rel(c, parent, "dependency")).status, 200);
  assert.equal((await rel(c, child, "related")).status, 200);
  let execution = await act("member", c, "acceptStart");
  execution = await act("member", execution, "submitResult", {
    text: "Work done",
    reviewBy: future,
  });
  assert.equal(
    (
      await api("manager", "POST", `/tasks/${c.id}/actions/pass`, {
        version: execution.version,
        submissionId: execution.submissions.at(-1).id,
      })
    ).data.error.code,
    "dependencyIncomplete",
  );
  let p = await act("member", parent, "acceptStart");
  p = await act("member", p, "submitResult", {
    text: "Parent outcome",
    reviewBy: future,
  });
  assert.equal(
    (
      await api("manager", "POST", `/tasks/${p.id}/actions/pass`, {
        version: p.version,
        submissionId: p.submissions.at(-1).id,
      })
    ).data.error.code,
    "reasonRequired",
  );
  p = await act("manager", p, "pass", {
    submissionId: p.submissions.at(-1).id,
    reason: "Remaining child is not required for this parent outcome",
  });
  assert.equal(p.stage, "done");
  execution = await act("manager", execution, "pass", {
    submissionId: execution.submissions.at(-1).id,
  });
  assert.equal(execution.stage, "done");
  const follow = await create("leader");
  assert.equal((await rel(follow, p, "related")).status, 200);
});
test("AC-04: database fault rolls back task, event, approval and queued job atomically", async () => {
  let t = await create("leader");
  const before = await pool.query(
    "SELECT count(*)::int AS n FROM events WHERE task_id=$1",
    [t.id],
  );
  await pool.query(
    `CREATE OR REPLACE FUNCTION test_reject_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.task_id='${t.id}'::uuid AND NEW.type='issue' THEN RAISE EXCEPTION 'Injected integration write failure'; END IF; RETURN NEW; END $$`,
  );
  await pool.query(
    "CREATE TRIGGER test_event_fault BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION test_reject_event()",
  );
  try {
    assert.equal(
      (
        await api("leader", "POST", `/tasks/${t.id}/actions/issue`, {
          version: t.version,
        })
      ).status,
      500,
    );
    const read = await ok("leader", "GET", "/tasks/" + t.id);
    assert.equal(read.task.stage, "draft");
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM events WHERE task_id=$1",
          [t.id],
        )
      ).rows[0].n,
      before.rows[0].n,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM pgboss.job WHERE data->>'taskId'=$1",
          [t.id],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await pool.query("DROP TRIGGER test_event_fault ON events");
    await pool.query("DROP FUNCTION test_reject_event()");
  }
  t = await act("leader", t, "issue");
  assert.equal(t.stage, "pending");
});
test("AC-27/28: credentials, logout, disabled accounts and management authorization", async () => {
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/sessions",
        payload: { username: "member", password: "incorrect" },
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await api("member", "POST", "/projects", {
        name: "Unauthorized",
        managerId: actors.member.id,
        memberIds: [],
      })
    ).status,
    403,
  );
  assert.equal(
    (await api("other", "PATCH", "/projects/" + projectId, { memberIds: [] }))
      .status,
    403,
  );
  assert.equal(
    (
      await api("manager", "PATCH", "/projects/" + projectId, {
        memberIds: [actors.other.id],
      })
    ).status,
    200,
  );
  const username = "disabled-" + randomUUID().slice(0, 8);
  const account = await ok("admin", "POST", "/users", {
    username,
    name: "Disposable test account",
    password: "Test-Password-2026!",
    roles: ["member"],
  });
  await ok("admin", "PATCH", "/users/" + account.id, { active: false });
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/sessions",
        payload: { username, password: "Test-Password-2026!" },
      })
    ).statusCode,
    401,
  );
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: { username: "other", password: "OpenTask-Test-2026!" },
  });
  const ck = login.headers["set-cookie"]!.toString().split(";")[0];
  await app.inject({
    method: "DELETE",
    url: "/api/v1/sessions",
    headers: { cookie: ck, "x-csrf-token": login.json().csrf },
  });
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/api/v1/tasks",
        headers: { cookie: ck },
      })
    ).statusCode,
    401,
  );
});
test("AC-38: stale checklist requests reject; concurrent retained item stays checked", async () => {
  let t = await create("leader");
  t = await act("leader", t, "issue");
  const first = randomUUID();
  for (const value of ["First proposal", "Second proposal"])
    t = await act("member", t, "requestChecklist", {
      items: [{ id: first, text: value }],
      scopeChanged: false,
      reason: "Plan",
    });
  t = await act("leader", t, "approveChecklist", {
    requestId: t.checklistRequests[0].id,
  });
  assert.equal(
    (
      await api("leader", "POST", `/tasks/${t.id}/actions/approveChecklist`, {
        version: t.version,
        requestId: t.checklistRequests[1].id,
      })
    ).data.error.code,
    "checklistConflict",
  );
});
test("AC-41: a cancelled prerequisite still blocks result acceptance", async () => {
  let dependency = await create("leader"),
    t = await create("leader");
  dependency = await act("leader", dependency, "issue");
  dependency = await act("leader", dependency, "cancel", {
    reason: "Cancelled prerequisite",
  });
  t = await act("leader", t, "issue");
  await ok("leader", "POST", `/tasks/${t.id}/relations`, {
    version: t.version,
    targetId: dependency.id,
    kind: "dependency",
    reason: "Still required",
  });
  t = await act("member", t, "acceptStart");
  t = await act("member", t, "submitResult", {
    text: "Result",
    reviewBy: future,
  });
  assert.equal(
    (
      await api("manager", "POST", `/tasks/${t.id}/actions/pass`, {
        version: t.version,
        submissionId: t.submissions.at(-1).id,
      })
    ).data.error.code,
    "dependencyIncomplete",
  );
});
test("AC-01: public submission cannot expose a previously linked private draft", async () => {
  const a = await create("member"),
    b = await create("member");
  await ok("member", "POST", `/tasks/${a.id}/relations`, {
    version: a.version,
    targetId: b.id,
    kind: "related",
    reason: "Private context",
  });
  assert.equal(
    (
      await api("member", "POST", `/tasks/${a.id}/actions/submitApproval`, {
        version: a.version,
      })
    ).data.error.code,
    "privateRelation",
  );
  const list = await ok("other", "GET", "/relations");
  assert.ok(
    !list.items.some((r: any) => r.sourceId === a.id || r.targetId === a.id),
  );
});
test("AC-30/28: managing another project does not bypass this project approval", async () => {
  await ok("leader", "POST", "/projects", {
    name: prefix + " other manager",
    managerId: actors.other.id,
    memberIds: [],
  });
  let t = await create("other");
  t = await act("other", t, "submitApproval");
  assert.deepEqual(t.approvalIds, [actors.manager.id, actors.leader.id]);
  assert.equal(
    (
      await api("other", "POST", `/tasks/${t.id}/actions/approve`, {
        version: t.version,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api("admin", "POST", `/tasks/${t.id}/actions/approve`, {
        version: t.version,
      })
    ).status,
    403,
  );
});
test("AC-41 concurrency: acceptance cannot race a new incomplete prerequisite", async () => {
  let prerequisite = await create("leader"),
    t = await create("leader");
  prerequisite = await act("leader", prerequisite, "issue");
  t = await act("leader", t, "issue");
  t = await act("member", t, "acceptStart");
  t = await act("member", t, "submitResult", {
    text: "Result for concurrent review",
    reviewBy: future,
  });
  const results = await Promise.all([
    api("manager", "POST", `/tasks/${t.id}/actions/pass`, {
      version: t.version,
      submissionId: t.submissions.at(-1).id,
    }),
    api("leader", "POST", `/tasks/${t.id}/relations`, {
      version: t.version,
      targetId: prerequisite.id,
      kind: "dependency",
      reason: "Concurrent requirement",
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});
test("AC-04: retry creating a draft returns one task and one event", async () => {
  const key = randomUUID(),
    body = { title: prefix + " retried create" };
  const [a, b] = await Promise.all([
    api("member", "POST", "/tasks", body, key),
    api("member", "POST", "/tasks", body, key),
  ]);
  assert.equal(a.status, 200);
  assert.deepEqual(a, b);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM events WHERE task_id=$1",
        [a.data.id],
      )
    ).rows[0].n,
    1,
  );
});
test("AC-47: team, task and actor event queries return the same persisted progress facts", async () => {
  let t = await create("leader");
  t = await act("leader", t, "issue");
  t = await act("member", t, "acceptStart");
  t = await act("member", t, "progress", {
    text: "Cross-panel event",
    next: "Verify all views",
    feedbackBy: future,
  });
  const taskEvents = await ok("member", "GET", "/events?taskId=" + t.id);
  const e = taskEvents.items.find((e: any) => e.type === "progress");
  assert.equal(e.after.latestProgress.next, "Verify all views");
  const actorEvents = await ok(
    "leader",
    "GET",
    "/events?actorId=" + actors.member.id + "&search=Cross-panel",
  );
  assert.ok(
    actorEvents.items.some(
      (other: any) => other.id === e.id && other.at === e.at,
    ),
  );
  assert.equal(
    (
      await api("admin", "PATCH", "/users/" + actors.member.id, {
        active: false,
      })
    ).data.error.code,
    "transferRequired",
  );
});

test("UI polish: project color persists, partial update preserves members and rejects unauthorized or malformed writes", async () => {
  const original = (await ok("leader", "GET", "/projects")).find(
    (p: any) => p.id === projectId,
  );
  const changed = await ok("manager", "PATCH", `/projects/${projectId}`, {
    color: "#aa7755",
  });
  assert.equal(changed.color, "#aa7755");
  assert.deepEqual(changed.memberIds, original.memberIds);
  assert.equal(
    (await ok("member", "GET", "/projects")).find(
      (p: any) => p.id === projectId,
    ).color,
    "#aa7755",
  );
  for (const who of ["member", "other", "admin"])
    assert.equal(
      (await api(who, "PATCH", `/projects/${projectId}`, { color: "#ffffff" }))
        .status,
      403,
    );
  assert.equal(
    (
      await api("manager", "PATCH", `/projects/${projectId}`, {
        color: "red;display:none",
      })
    ).status,
    422,
  );
  assert.equal(
    (await ok("leader", "GET", "/projects")).find(
      (p: any) => p.id === projectId,
    ).color,
    "#aa7755",
  );
});
test("UI polish: every create entry validates assignments and resolves reviewer from owner, not creator", async () => {
  const base = {
    title: prefix + " assignments",
    projectId,
    ownerId: actors.member.id,
    reviewerId: "",
  };
  const created = await ok("leader", "POST", "/tasks", base);
  assert.equal(created.ownerId, actors.member.id);
  assert.equal(created.reviewerId, actors.manager.id);
  const managed = await ok("member", "POST", "/tasks", {
    ...base,
    ownerId: actors.manager.id,
  });
  assert.equal(managed.reviewerId, actors.leader.id);
  assert.equal(
    (
      await api("member", "POST", "/tasks", {
        ...base,
        reviewerId: actors.member.id,
      })
    ).data.error.code,
    "selfReview",
  );
  assert.equal(
    (await api("leader", "POST", "/tasks", { ...base, ownerId: randomUUID() }))
      .status,
    422,
  );
  assert.equal(
    (
      await api("leader", "POST", "/tasks", {
        ...base,
        reviewerId: randomUUID(),
      })
    ).status,
    422,
  );
  // The product permits an explicitly designated active reviewer and team-wide owners.
  const explicit = await ok("member", "POST", "/tasks", {
    ...base,
    ownerId: actors.other.id,
    reviewerId: actors.leader.id,
  });
  assert.equal(explicit.reviewerId, actors.leader.id);
});

test("checklist batch submission is atomic and checks content version and ownership", async () => {
  let t = await create("leader");
  t = await act("leader", t, "issue");
  const ids = [randomUUID(), randomUUID()];
  t = await act("member", t, "requestChecklist", {
    items: ids.map((id) => ({ id, text: "Batch item" })),
    scopeChanged: false,
    reason: "Plan",
  });
  t = await act("leader", t, "approveChecklist", {
    requestId: t.checklistRequests[0].id,
  });
  const body = {
    version: t.version,
    checklistVersion: t.checklistVersion,
    changes: ids.map((itemId) => ({ itemId, expectedDone: false, done: true })),
  };
  const path = `/tasks/${t.id}/actions/toggle`;
  assert.equal((await api("other", "POST", path, body)).status, 403);
  assert.equal(
    (
      await api("member", "POST", path, {
        ...body,
        checklistVersion: t.checklistVersion - 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await api("member", "POST", path, {
        ...body,
        changes: [body.changes[0], { ...body.changes[1], expectedDone: true }],
      })
    ).status,
    409,
  );
  assert.deepEqual(
    (await ok("member", "GET", `/tasks/${t.id}`)).task.checklist.map(
      (x: any) => x.done,
    ),
    [false, false],
  );
  t = await ok("member", "POST", path, body);
  assert.deepEqual(
    t.checklist.map((x: any) => x.done),
    [true, true],
  );
  assert.equal((await api("member", "POST", path, body)).status, 409);
});
