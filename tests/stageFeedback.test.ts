import { test } from "node:test";
import assert from "node:assert/strict";
import {
  StageBaseline,
  stageEvent,
  feedbackObsolete,
  type StageFeedback,
} from "../shared/stageFeedback.js";
import { responseFacts } from "../shared/commitment.js";
import type { Event, Task } from "../shared/model.js";
import { demoTask, demoUsers } from "./fixtures/stageFeedback.js";
const task = demoTask();
const change = (patch: Partial<Task>) => demoTask({ revision: 2, ...patch });
const feedback = (after = change({ stage: "reviewing" })): StageFeedback => ({
  id: 1,
  kind: "remote",
  before: task,
  task: after,
});
const event = (
  before = task,
  after = change({ stage: "reviewing" }),
  patch: Partial<Event> = {},
): Event => ({
  id: 7,
  taskId: task.id,
  actorId: demoUsers[1].id,
  type: "submitResult",
  version: 1,
  before,
  after,
  note: "Synthetic result",
  at: "2026-10-16T12:00:00Z",
  ...patch,
});

test("first read, new task/account baseline, and unchanged polls stay quiet", () => {
  const baseline = new StageBaseline();
  assert.equal(baseline.observe(task).feedback, null);
  assert.equal(baseline.observe(change({})).feedback, null);
  assert.equal(
    baseline.observe(change({ revision: 3, approvalIndex: 1, refused: "No" }))
      .feedback,
    null,
  );
  for (const current of [task, change({ id: "other", stage: "done" })]) {
    assert.equal(new StageBaseline().observe(current).feedback, null);
  }
});

test("own acknowledgement fences old reads and suppresses polling duplicates even after dismissal", () => {
  const baseline = new StageBaseline();
  baseline.observe(task);
  const saved = change({ stage: "reviewing" });
  assert.equal(baseline.observe(saved, "submitResult").feedback?.kind, "local");
  assert.equal(baseline.observe(task).applied, false);
  assert.equal(baseline.current, saved);
  assert.equal(baseline.observe(saved).feedback, null);
  const remote = baseline.observe(
    change({ revision: 3, stage: "done" }),
  ).feedback!;
  assert.equal(remote.kind, "remote");
  assert.equal(baseline.observe(remote.task).feedback, null);
});

test("same-stage approval/refusal/confirmation have business receipts without fabricated transitions", () => {
  for (const [action, before, after] of [
    [
      "approve",
      demoTask({ stage: "approval" }),
      change({ stage: "approval", approvalIndex: 1 }),
    ],
    [
      "refuse",
      demoTask({ stage: "pending" }),
      change({ stage: "pending", refused: "Unavailable" }),
    ],
    [
      "confirm",
      demoTask({ version: 2 }),
      change({ version: 2, confirmedVersion: 2 }),
    ],
  ] as const) {
    const baseline = new StageBaseline();
    baseline.observe(before);
    const notice = baseline.observe(after, action).feedback!;
    assert.equal(notice.before.stage, notice.task.stage);
    assert.equal(notice.kind, "local");
    assert.equal(baseline.observe(after).feedback, null);
  }
});

test("stage metadata selects the latest real transition, excluding newer comments and future snapshots", () => {
  const review = change({ stage: "reviewing" });
  const returned = change({ revision: 3, stage: "working" });
  const done = change({ revision: 4, stage: "done" });
  const final = change({ revision: 5, stage: "done", updatedAt: "2030-01-01" });
  const events = [
    event(done, final, { id: 11, type: "comment" }),
    event(returned, done, { id: 10, type: "pass" }),
    event(review, returned, { id: 9 }),
    event(task, review),
  ];
  assert.equal(stageEvent(feedback(final), events)?.id, 10);
  assert.equal(stageEvent(feedback(review), events)?.id, 7);
  assert.equal(stageEvent(feedback(final), events)?.at, "2026-10-16T12:00:00Z");
});

test("missing, malformed, mismatched or unrelated history never manufactures actor/time", () => {
  for (const events of [
    [],
    [event(task, task)],
    [event(task, change({ stage: "done" }))],
    [event(undefined, undefined, { taskId: "other" })],
    [event(undefined, undefined, { at: "invalid" })],
    [event(undefined, undefined, { actorId: "" })],
    [event(undefined, undefined, { after: { stage: "reviewing" } })],
    [event(task, change({ revision: 10, stage: "reviewing" }))],
  ]) {
    assert.equal(stageEvent(feedback(), events), undefined);
  }
});

test("all lifecycle outcomes use the existing response contract, including multilevel, returned/refused and terminal", () => {
  const leader = demoUsers[0].id;
  const next = (task: Task) =>
    responseFacts(task, leader).map(({ reason, handlerId }) => [
      reason,
      handlerId,
    ]);
  assert.deepEqual(next(change({ stage: "approval", approvalIndex: 1 })), [
    ["approval", demoUsers[2].id],
  ]);
  assert.deepEqual(next(change({ stage: "approvalReturned" })), [
    ["approvalReturned", task.creatorId],
  ]);
  assert.deepEqual(next(change({ stage: "pending", refused: "No" })), [
    ["refused", task.issuerId],
  ]);
  assert.deepEqual(next(change({ stage: "reviewing" })), [
    ["review", task.reviewerId],
  ]);
  assert.equal(
    next(change({ version: 2, confirmedVersion: 1 }))[0][0],
    "confirm",
  );
  assert.equal(next(change({ stage: "working" }))[0][0], "feedback");
  for (const stage of ["done", "cancelled"] as const)
    assert.deepEqual(next(change({ stage })), []);
});

test("same-stage reassignment retires stale next-handler advice without creating a field notification", () => {
  const pending = demoTask({ stage: "pending", revision: 2 });
  const notice = feedback(pending);
  const reassigned = change({
    stage: "pending",
    revision: 3,
    ownerId: demoUsers[1].id,
    version: 2,
  });
  assert.equal(feedbackObsolete(notice, reassigned), true);
  const baseline = new StageBaseline();
  baseline.observe(pending);
  assert.equal(baseline.observe(reassigned).feedback, null);
  assert.equal(
    feedbackObsolete(notice, change({ stage: "pending", revision: 3 })),
    false,
  );
  assert.equal(
    feedbackObsolete(
      notice,
      change({ stage: "pending", revision: 1, ownerId: "other" }),
    ),
    false,
  );
});
