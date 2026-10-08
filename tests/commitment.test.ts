import { test } from "node:test";
import assert from "node:assert/strict";
import {
  commitment,
  responseFacts,
  agreementChanges,
  lifecycleState,
} from "../shared/commitment.js";
import { terms, type Task } from "../shared/model.js";

const base: Task = {
  id: "task",
  number: 1,
  creatorId: "creator",
  issuerId: "leader",
  stage: "working",
  title: "Prepare a report",
  outcome: "A reviewable report",
  criteria: "Evidence can be verified",
  scope: "Monthly work",
  ownerId: "owner",
  reviewerId: "reviewer",
  projectId: "project",
  deadline: "2026-10-10T10:00:00Z",
  acceptBy: "2026-10-08T10:00:00Z",
  feedbackBy: "2026-10-09T10:00:00Z",
  reviewBy: "",
  version: 1,
  revision: 1,
  confirmedVersion: 1,
  confirmedTerms: null,
  confirmBy: null,
  approvalIds: ["manager", "leader"],
  approvalIndex: 0,
  refused: null,
  lastFeedbackAt: null,
  checklistVersion: 1,
  checklist: [],
  checklistRequests: [],
  blocks: [],
  submissions: [],
  createdAt: "2026-10-08T09:00:00Z",
  updatedAt: "2026-10-08T09:00:00Z",
};
base.confirmedTerms = terms(base);
const task = (patch: Partial<Task> = {}): Task =>
  structuredClone({ ...base, ...patch });
const now = Date.parse("2026-10-08T12:00:00Z");

test("a named assignee does not establish a promise in drafts, approval or pending tasks", () => {
  for (const stage of [
    "draft",
    "approval",
    "approvalReturned",
    "pending",
  ] as const) {
    const state = commitment(
      task({ stage, confirmedVersion: null, confirmedTerms: null }),
    );
    assert.equal(state.hasPromise, false, stage);
    assert.equal(state.group, "waiting", stage);
  }
  assert.equal(
    responseFacts(
      task({ stage: "approval", approvalIndex: 0 }),
      "leader",
      now,
    )[0].handlerId,
    "manager",
  );
  assert.equal(
    responseFacts(
      task({ stage: "approval", approvalIndex: 1 }),
      "leader",
      now,
    )[0].handlerId,
    "leader",
  );
});
test("an unaccepted new version keeps the old delivery, feedback and reviewer agreement visible", () => {
  const changed = task({
    version: 2,
    deadline: "2026-10-20T10:00:00Z",
    feedbackBy: "2026-10-18T10:00:00Z",
    reviewerId: "new-reviewer",
    confirmBy: "2026-10-08T11:00:00Z",
  });
  const state = commitment(changed);
  assert.equal(state.group, "changed");
  assert.equal(state.effective.deadline, base.deadline);
  assert.equal(state.effective.feedbackBy, base.feedbackBy);
  assert.equal(state.effective.reviewerId, "reviewer");
  const responses = responseFacts(changed, "leader", now);
  assert.deepEqual(responses[0], {
    reason: "confirm",
    handlerId: "owner",
    due: changed.confirmBy,
    overdue: true,
  });
  assert.equal(responses[1].due, base.feedbackBy);
  assert.deepEqual(agreementChanges(changed), [
    "reviewerId",
    "deadline",
    "feedbackBy",
  ]);
  assert.equal(changed.deadline, "2026-10-20T10:00:00Z");
});
test("confirming the current version uses current terms; reassignment needs a new first acceptance", () => {
  const current = task({
    version: 2,
    confirmedVersion: 2,
    deadline: "2026-10-20T10:00:00Z",
  });
  current.confirmedTerms = terms(current);
  assert.equal(commitment(current).group, "active");
  assert.equal(commitment(current).effective.deadline, current.deadline);
  assert.deepEqual(agreementChanges(current), []);
  const reassigned = task({
    stage: "pending",
    version: 2,
    ownerId: "other",
    confirmedVersion: null,
    confirmedTerms: null,
  });
  assert.equal(commitment(reassigned).hasPromise, false);
  assert.equal(responseFacts(reassigned, "leader", now)[0].handlerId, "other");
});
test("review waits on the designated reviewer, without execution feedback; checklist 100% does not close work", () => {
  const reviewing = task({
    stage: "reviewing",
    reviewBy: "2026-10-08T11:00:00Z",
  });
  assert.equal(commitment(reviewing).group, "review");
  assert.deepEqual(responseFacts(reviewing, "leader", now), [
    {
      reason: "review",
      handlerId: "reviewer",
      due: reviewing.reviewBy,
      overdue: true,
    },
  ]);
  const checked = task({ checklist: [{ id: "a", text: "Done", done: true }] });
  assert.equal(commitment(checked).group, "active");
  assert.equal(responseFacts(checked, "leader", now)[0].reason, "feedback");
});
test("refusal goes to the issuer; help and pending changes have separate response owners", () => {
  const refused = task({
    stage: "pending",
    refused: "Unavailable",
    confirmedVersion: null,
    confirmedTerms: null,
  });
  assert.equal(responseFacts(refused, "leader", now)[0].handlerId, "leader");
  const blocked = task({
    blocks: [
      {
        id: "block",
        authorId: "owner",
        helperId: "helper",
        reason: "Data missing",
        help: "Provide data",
        resolved: false,
        replies: [{ authorId: "helper", text: "Sent" }],
      },
    ],
    adjustmentRequests: [
      { id: "request", authorId: "owner", reason: "Extend", status: "pending" },
    ],
  });
  assert.deepEqual(
    responseFacts(blocked, "leader", now).map(({ reason, handlerId }) => ({
      reason,
      handlerId,
    })),
    [
      { reason: "feedback", handlerId: "owner" },
      { reason: "blocked", handlerId: "helper" },
      { reason: "requestAdjustment", handlerId: "leader" },
    ],
  );
});
test("closed tasks require no response, and invalid or absent times do not fabricate overdue facts", () => {
  for (const stage of ["done", "cancelled"] as const) {
    assert.equal(commitment(task({ stage })).group, "closed");
    assert.deepEqual(responseFacts(task({ stage }), "leader", now), []);
  }
  for (const feedbackBy of ["", "invalid-date"]) {
    assert.equal(
      responseFacts(
        task({ feedbackBy, confirmedTerms: null }),
        "leader",
        now,
      ).at(-1)!.overdue,
      false,
    );
  }
});

test("lifecycle nodes expose seven phases while blockers and completed checklists do not replace a phase", () => {
  for (const stage of ["draft", "approval", "approvalReturned"] as const)
    assert.equal(lifecycleState(task({ stage })), "preparing");
  assert.equal(
    lifecycleState(task({ stage: "pending", refused: "No" })),
    "pending",
  );
  assert.equal(lifecycleState(task()), "active");
  assert.equal(lifecycleState(task({ version: 2 })), "changed");
  assert.equal(lifecycleState(task({ stage: "reviewing" })), "review");
  assert.equal(lifecycleState(task({ stage: "done" })), "done");
  assert.equal(lifecycleState(task({ stage: "cancelled" })), "cancelled");
  assert.equal(
    lifecycleState(
      task({
        checklist: [{ id: "a", text: "Done", done: true }],
        blocks: [
          {
            id: "b",
            authorId: "owner",
            reason: "Blocked",
            helperId: "helper",
            help: "Help",
            replies: [],
            resolved: false,
          },
        ],
      }),
    ),
    "active",
  );
});
