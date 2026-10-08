import { test } from "node:test";
import assert from "node:assert/strict";
import { reasons } from "../server/followups.js";
import type { Task } from "../shared/model.js";
const past = new Date(Date.now() - 100000).toISOString(),
  future = new Date(Date.now() + 100000).toISOString();
const base = {
  stage: "working",
  ownerId: "owner",
  reviewerId: "reviewer",
  issuerId: "leader",
  version: 2,
  confirmedVersion: 2,
  feedbackBy: past,
  deadline: future,
  updatedAt: past,
  checklistRequests: [],
  blocks: [],
  confirmedTerms: null,
} as unknown as Task;
test("AC-12/13/14/44/45/46: due facts are stable, reviewing changes handler, terminal removes all", () => {
  assert.ok(
    reasons(base, "leader").some((r) => r.reason === "feedbackOverdue"),
  );
  assert.deepEqual(reasons(base, "leader"), reasons(base, "leader"));
  const review = {
    ...base,
    stage: "reviewing",
    reviewBy: past,
    deadline: past,
  } as Task;
  assert.ok(
    !reasons(review, "leader").some((r) => r.reason === "feedbackOverdue"),
  );
  assert.equal(
    reasons(review, "leader").find((r) => r.reason === "deliveryOverdue")
      ?.handlerId,
    "reviewer",
  );
  assert.ok(
    reasons(review, "leader").some((r) => r.reason === "reviewOverdue"),
  );
  assert.deepEqual(reasons({ ...base, stage: "done" }, "leader"), []);
  assert.deepEqual(reasons({ ...base, stage: "cancelled" }, "leader"), []);
});
test("AC-10/12: unconfirmed postponement still checks confirmed dates", () => {
  const t = {
    ...base,
    version: 3,
    feedbackBy: future,
    deadline: future,
    confirmedTerms: { feedbackBy: past, deadline: past },
    confirmBy: past,
  } as Task;
  const rs = reasons(t, "leader");
  assert.ok(rs.some((r) => r.reason === "feedbackOverdue"));
  assert.ok(rs.some((r) => r.reason === "deliveryOverdue"));
  assert.ok(rs.some((r) => r.reason === "confirmOverdue"));
});
