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
test("checklist reason is optional only when scope and acceptance criteria are unchanged", async () => {
  let t = await create("leader");
  t = await act("leader", t, "issue");
  t = await act("member", t, "acceptStart");
  const items = [{ id: randomUUID(), text: "Execution detail" }];
  const path = `/tasks/${t.id}/actions/requestChecklist`;
  for (const reason of [undefined, "", " \n\t "]) {
    const r = await api("member", "POST", path, {
      version: t.version,
      items,
      scopeChanged: true,
      reason,
    });
    assert.equal(r.status, 422);
    assert.equal(r.data.error.code, "reasonRequired");
    t = await act("member", t, "requestChecklist", {
      items,
      scopeChanged: false,
      reason,
    });
    assert.equal(t.checklistRequests.at(-1).reason, "");
  }
  // Optional does not permit non-text or oversized payloads.
  for (const reason of [null, 42, {}, "x".repeat(20001)]) {
    assert.equal(
      (
        await api("member", "POST", path, {
          version: t.version,
          items,
          scopeChanged: false,
          reason,
        })
      ).status,
      422,
    );
  }
  assert.equal(
    (
      await api("other", "POST", path, {
        version: t.version,
        items,
        scopeChanged: false,
      })
    ).status,
    403,
  );
  t = await act("leader", t, "approveChecklist", {
    requestId: t.checklistRequests.at(-1).id,
  });
  assert.equal(t.checklist[0].text, "Execution detail");
  assert.equal(t.version, 1);
  t = await act("member", t, "requestChecklist", {
    items,
    scopeChanged: true,
    reason: "  New scope  ",
  });
  assert.equal(t.checklistRequests.at(-1).reason, "New scope");
  t = await act("leader", t, "approveChecklist", {
    requestId: t.checklistRequests.at(-1).id,
    confirmBy: future,
  });
  assert.equal(t.version, 2);
  assert.notEqual(t.confirmedVersion, t.version);
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

const octoberFilter = "time=custom&start=2026-10-01&end=2026-10-31";
const timeFields = (patch: any = {}) => ({
  title: prefix + " Time",
  outcome: "Time result",
  scope: "Current plan",
  criteria: "Verify dates",
  projectId,
  ownerId: actors.member.id,
  reviewerId: actors.leader.id,
  deadline: "2026-10-10T12:00:00+08:00",
  acceptBy: future,
  feedbackBy: future,
  reviewBy: "",
  ...patch,
});
test("AC-66/69/70: legacy deadlines, cross-month intervals, Shanghai end boundary and draft date validation", async () => {
  const title = prefix + " Time boundaries";
  const cases = [
    { deadline: "2026-10-31T23:59:59+08:00" },
    { deadline: "2026-11-01T00:00:00+08:00" },
    {
      plannedStart: "2026-09-20T00:00:00+08:00",
      deadline: "2026-10-10T10:00:00+08:00",
    },
    {
      plannedStart: "2026-10-10T10:00:00+08:00",
      deadline: "2026-10-10T10:00:00+08:00",
    },
    { deadline: "", plannedStart: "" },
  ];
  const tasks = [];
  for (const dates of cases)
    tasks.push(
      await ok("member", "POST", "/tasks", timeFields({ title, ...dates })),
    );
  // Simulate a stored task from the pre-start-field version, preserving its title and old snapshots.
  await pool.query("UPDATE tasks SET data=data-'plannedStart' WHERE id=$1", [
    tasks[0].id,
  ]);
  const path = `/tasks?search=${encodeURIComponent(title)}&${octoberFilter}`;
  const result = await ok("member", "GET", path);
  assert.deepEqual(
    result.items.map((t: any) => t.id),
    [tasks[0].id, tasks[2].id, tasks[3].id],
  );
  assert.equal(result.total, 3);
  const unscheduled = await ok(
    "member",
    "GET",
    path + "&includeUnscheduled=true",
  );
  assert.equal(unscheduled.total, 4);
  assert.equal(
    (await ok("other", "GET", path + "&includeUnscheduled=true")).total,
    0,
  );
  const invalid = await api(
    "member",
    "POST",
    "/tasks",
    timeFields({ plannedStart: "2026-10-11T00:00:00Z" }),
  );
  assert.equal(invalid.status, 422);
  assert.equal(invalid.data.error.code, "startAfterDeadline");
  assert.equal(
    (
      await api(
        "member",
        "POST",
        "/tasks",
        timeFields({ plannedStart: "not a date" }),
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await api(
        "member",
        "GET",
        "/tasks?time=custom&start=2026-02-29&end=2026-10-31",
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await api(
        "member",
        "GET",
        "/tasks?time=custom&start=2026-11-01&end=2026-10-31",
      )
    ).status,
    422,
  );
  assert.equal(
    (await api("member", "GET", "/tasks?includeEarlier=maybe")).status,
    422,
  );
  const noDeadline = await ok(
    "leader",
    "POST",
    "/tasks",
    timeFields({ deadline: "" }),
  );
  assert.equal(
    (
      await api("leader", "POST", `/tasks/${noDeadline.id}/actions/issue`, {
        version: 1,
      })
    ).data.error.code,
    "dateRequired",
  );
  // Malformed optional old draft dates must never abort the list.
  await pool.query(
    "UPDATE tasks SET data=jsonb_set(data,'{deadline}','\"old invalid input\"') WHERE id=$1",
    [tasks[4].id],
  );
  assert.equal(
    (await ok("member", "GET", path + "&includeUnscheduled=true")).total,
    4,
  );
});
test("AC-67/68/71: server preferences are user-owned, durable, independently overridden and CSRF protected", async () => {
  const global = {
    mode: "custom",
    start: "2026-10-01",
    end: "2026-10-31",
    includeUnscheduled: false,
    includeEarlier: false,
  };
  const september = { ...global, start: "2026-09-01", end: "2026-09-30" };
  await pool.query(
    "DELETE FROM time_preferences WHERE user_id=ANY($1::uuid[])",
    [[actors.member.id, actors.other.id]],
  );
  assert.equal(
    (await ok("other", "GET", "/time-preferences")).global.mode,
    "all",
  );
  await ok("member", "PUT", "/time-preferences", {
    scope: "global",
    filter: global,
  });
  await ok("member", "PUT", "/time-preferences", {
    scope: projectId,
    filter: september,
  });
  await ok("member", "PUT", "/time-preferences", {
    scope: "global",
    filter: { ...global, mode: "month" },
  });
  let prefs = await ok("member", "GET", "/time-preferences");
  assert.deepEqual(prefs.projects[projectId], september);
  assert.equal(prefs.global.mode, "month");
  assert.equal(
    (await ok("other", "GET", "/time-preferences")).global.mode,
    "all",
  );
  const csrf = await app.inject({
    method: "PUT",
    url: "/api/v1/time-preferences",
    headers: { cookie: actors.member.cookie, "idempotency-key": randomUUID() },
    payload: { scope: "global", filter: global },
  });
  assert.equal(csrf.statusCode, 403);
  await ok("member", "PUT", "/time-preferences", {
    scope: projectId,
    filter: null,
  });
  prefs = await ok("member", "GET", "/time-preferences");
  assert.equal(prefs.projects[projectId], undefined);
  assert.equal(
    (
      await api("member", "PUT", "/time-preferences", {
        scope: "global",
        filter: { ...global, start: "2026-11-01" },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await api("member", "PUT", "/time-preferences", {
        scope: randomUUID(),
        filter: global,
      })
    ).data.error.code,
    "projectRequired",
  );
});
test("AC-72/73/76: match before pagination, transitive cross-project ancestors, no descendant expansion and private drafts", async () => {
  const title = prefix + " Time pagination";
  let parent = await ok(
    "leader",
    "POST",
    "/tasks",
    timeFields({
      title: "Outside parent",
      projectId: null,
      deadline: "2026-09-01T00:00:00Z",
    }),
  );
  let grandparent = await ok(
    "leader",
    "POST",
    "/tasks",
    timeFields({
      title: "Outside grandparent",
      projectId: null,
      deadline: "2026-09-01T00:00:00Z",
    }),
  );
  parent = await act("leader", parent, "issue");
  grandparent = await act("leader", grandparent, "issue");
  // Disposable rows: 210 non-matches precede 205 matching tasks in number order.
  const template = await ok(
    "member",
    "POST",
    "/tasks",
    timeFields({ title, deadline: "2026-09-01T00:00:00Z" }),
  );
  const rows = await pool.query(
    `INSERT INTO tasks(id,creator_id,stage,project_id,data)
    SELECT gen_random_uuid(),$1,'draft',$2,$3::jsonb || jsonb_build_object('deadline', CASE WHEN n<=210 THEN '2026-09-01T00:00:00Z' ELSE '2026-10-10T00:00:00Z' END)
    FROM generate_series(1,415) n RETURNING id,number`,
    [actors.member.id, projectId, template],
  );
  for (const row of rows.rows)
    await pool.query(
      "UPDATE tasks SET data=data||jsonb_build_object('id',id,'number',number) WHERE id=$1",
      [row.id],
    );
  const child = rows.rows[210],
    sibling = rows.rows[0];
  for (const [source, target] of [
    [child.id, parent.id],
    [parent.id, grandparent.id],
    [sibling.id, parent.id],
  ])
    await pool.query(
      "INSERT INTO relations(id,source_id,target_id,kind) VALUES($1,$2,$3,'parent')",
      [randomUUID(), source, target],
    );
  const path = `/tasks?search=${encodeURIComponent(title)}&projectId=${projectId}&${octoberFilter}&limit=200`;
  const page = await ok("member", "GET", path);
  assert.equal(page.total, 205);
  assert.equal(page.items.length, 200);
  assert.equal(page.items[0].id, child.id);
  assert.deepEqual(
    new Set(page.context.map((t: any) => t.id)),
    new Set([parent.id, grandparent.id]),
  );
  assert(page.context.every((t: any) => t.viewSource === "context"));
  assert.equal(page.counts[projectId].total, 205);
  const next = await ok("member", "GET", path + "&cursor=" + page.nextCursor);
  assert.equal(next.items.length, 5);
  assert.equal(next.total, 205);
  assert.equal(next.nextCursor, null);
  assert(!page.items.some((t: any) => t.id === sibling.id));
  assert.equal((await ok("other", "GET", path)).total, 0);
  // An unreadable private ancestor must be omitted even if an inconsistent legacy relation exists.
  const hidden = await ok(
    "other",
    "POST",
    "/tasks",
    timeFields({ title: "Private ancestor" }),
  );
  await pool.query(
    "INSERT INTO relations(id,source_id,target_id,kind) VALUES($1,$2,$3,'parent')",
    [randomUUID(), grandparent.id, hidden.id],
  );
  assert(
    !(await ok("member", "GET", path)).context.some(
      (t: any) => t.id === hidden.id,
    ),
  );
  // A parent matching by its own dates must not pull in outside children.
  const parents = await ok(
    "leader",
    "GET",
    `/tasks?search=Outside parent&time=custom&start=2026-09-01&end=2026-09-30`,
  );
  assert(!parents.items.some((t: any) => t.id === child.id));
});
test("AC-73/74/75: latest planned dates drive results, old agreement/history remain and out-of-range followups survive", async () => {
  const title = prefix + " Time version";
  let task = await ok(
    "leader",
    "POST",
    "/tasks",
    timeFields({ title, plannedStart: "2026-10-01T00:00:00+08:00" }),
  );
  task = await act("leader", task, "issue");
  task = await act("member", task, "acceptStart");
  // Legacy confirmed snapshot without plannedStart remains meaningful when dates are changed.
  await pool.query(
    "UPDATE tasks SET data=jsonb_set(data,'{confirmedTerms}',(data->'confirmedTerms')-'plannedStart') WHERE id=$1",
    [task.id],
  );
  const invalidMember = await api(
    "member",
    "POST",
    `/tasks/${task.id}/actions/adjust`,
    {
      version: task.version,
      fields: {
        ...task,
        plannedStart: "2026-11-01T00:00:00Z",
        deadline: "2026-11-10T00:00:00Z",
      },
      reason: "Move",
      confirmBy: future,
    },
  );
  assert.equal(invalidMember.status, 403);
  task = await act("leader", task, "adjust", {
    fields: {
      ...task,
      plannedStart: "2026-11-01T00:00:00Z",
      deadline: "2026-11-10T00:00:00Z",
    },
    reason: "Move schedule",
    confirmBy: future,
  });
  assert.equal(task.confirmedVersion, 1);
  assert.equal(task.version, 2);
  assert.equal(task.confirmedTerms.plannedStart, undefined);
  assert.equal(task.confirmedTerms.deadline, "2026-10-10T12:00:00+08:00");
  assert.equal(
    (
      await ok(
        "member",
        "GET",
        `/tasks?search=${encodeURIComponent(title)}&${octoberFilter}`,
      )
    ).total,
    0,
  );
  assert.equal(
    (
      await ok(
        "member",
        "GET",
        `/tasks?search=${encodeURIComponent(title)}&time=custom&start=2026-11-01&end=2026-11-30`,
      )
    ).total,
    1,
  );
  assert.equal(
    (await ok("member", "GET", `/tasks/${task.id}`)).task.id,
    task.id,
  );
  assert.equal(
    (
      await ok(
        "member",
        "GET",
        `/events?search=${encodeURIComponent(title)}&${octoberFilter}`,
      )
    ).items.length,
    0,
  );
  const history = await ok(
    "member",
    "GET",
    `/events?taskId=${task.id}&${octoberFilter}`,
  );
  assert(history.items.some((e: any) => e.type === "created"));
  assert(
    history.items.some(
      (e: any) =>
        e.type === "adjust" && e.before.plannedStart !== e.after.plannedStart,
    ),
  );
  assert(
    (await ok("member", "GET", "/followups")).items.some(
      (n: any) => n.taskId === task.id && n.reason === "confirm",
    ),
  );
  const version = await pool.query(
    "SELECT terms FROM versions WHERE task_id=$1 AND version=2",
    [task.id],
  );
  assert.equal(version.rows[0].terms.plannedStart, task.plannedStart);
  assert.equal(
    (
      await api("member", "POST", `/tasks/${task.id}/actions/confirm`, {
        version: 1,
      })
    ).status,
    409,
  );
  task = await act("member", task, "confirm");
  assert.equal(task.confirmedTerms.plannedStart, task.plannedStart);
  assert.equal(task.confirmedVersion, 2);
  const freshDraft = await ok("member", "POST", "/tasks", {
    title: prefix + " New without dates",
  });
  assert.equal(freshDraft.plannedStart, "");
  assert.equal(freshDraft.deadline, "");
  let datedDraft = await act("member", freshDraft, "edit", {
    fields: timeFields({
      title: prefix + " Legacy client",
      plannedStart: "2026-10-01T00:00:00Z",
    }),
  });
  const legacyFields = { ...datedDraft };
  delete legacyFields.plannedStart;
  datedDraft = await act("member", datedDraft, "edit", {
    fields: legacyFields,
  });
  assert.equal(datedDraft.plannedStart, "2026-10-01T00:00:00Z");
});
test("AC-72/73: earlier unfinished labels honor project/search/status and outside dependencies still block acceptance", async () => {
  const title = prefix + " Time earlier";
  let previous = await ok(
    "leader",
    "POST",
    "/tasks",
    timeFields({ title, deadline: "2026-09-10T00:00:00Z" }),
  );
  previous = await act("leader", previous, "issue");
  let current = await ok("leader", "POST", "/tasks", timeFields({ title }));
  current = await act("leader", current, "issue");
  await ok("leader", "POST", `/tasks/${current.id}/relations`, {
    version: current.version,
    targetId: previous.id,
    kind: "dependency",
    reason: "Prerequisite",
  });
  const path = `/tasks?search=${encodeURIComponent(title)}&projectId=${projectId}&${octoberFilter}`;
  assert.equal((await ok("member", "GET", path)).total, 1);
  const earlier = await ok("member", "GET", path + "&includeEarlier=true");
  assert.equal(earlier.total, 2);
  assert.equal(
    earlier.items.find((t: any) => t.id === previous.id).viewSource,
    "earlier",
  );
  assert.equal(
    (await ok("member", "GET", path + "&includeEarlier=true&stage=working"))
      .total,
    0,
  );
  assert.equal(
    (
      await ok(
        "member",
        "GET",
        path.replace(projectId, randomUUID()) + "&includeEarlier=true",
      )
    ).total,
    0,
  );
  current = await act("member", current, "acceptStart");
  current = await act("member", current, "submitResult", {
    text: "Complete",
    reviewBy: future,
  });
  assert.equal(
    (
      await api("leader", "POST", `/tasks/${current.id}/actions/pass`, {
        version: current.version,
        submissionId: current.submissions.at(-1).id,
      })
    ).data.error.code,
    "dependencyIncomplete",
  );
  assert(
    (await ok("member", "GET", `/tasks/${current.id}`)).targets.some(
      (t: any) => t.id === previous.id,
    ),
  );
  previous = await act("leader", previous, "cancel", {
    reason: "No longer planned",
  });
  assert.equal(
    (await ok("member", "GET", path + "&includeEarlier=true")).total,
    1,
  );
});
