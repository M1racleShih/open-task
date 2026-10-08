import type { Task } from "../shared/model.js";
import { terminal } from "../shared/model.js";
import type { Client } from "./store.js";
export function reasons(t: Task, leaderId: string, now = Date.now()) {
  const result: { reason: string; handlerId: string; since: string }[] = [];
  const add = (reason: string, handlerId: string, since = t.updatedAt) => {
    if (handlerId) result.push({ reason, handlerId, since });
  };
  const overdue = (date: string | null) => date && Date.parse(date) < now;
  if (terminal(t) || t.stage === "draft") return result;
  if (t.stage === "approval") add("approval", t.approvalIds[t.approvalIndex]!);
  if (t.stage === "approvalReturned") add("approvalReturned", t.creatorId);
  for (const r of t.adjustmentRequests ?? [])
    if (r.status === "pending") add("requestAdjustment", leaderId);
  for (const r of t.checklistRequests)
    if (r.status === "pending") add("checklist", leaderId);
  if (t.stage === "pending") {
    if (t.refused) add("refused", t.issuerId!);
    else {
      add("accept", t.ownerId);
      if (overdue(t.acceptBy)) add("acceptOverdue", t.ownerId, t.acceptBy);
    }
  }
  const effective =
    t.confirmedVersion !== t.version && t.confirmedTerms ? t.confirmedTerms : t;
  if (t.stage === "accepted" || t.stage === "working") {
    add("feedback", t.ownerId);
    if (overdue(effective.feedbackBy))
      add("feedbackOverdue", t.ownerId, effective.feedbackBy);
  }
  if (
    ["accepted", "working"].includes(t.stage) &&
    t.confirmedVersion !== t.version
  ) {
    add("confirm", t.ownerId);
    if (overdue(t.confirmBy)) add("confirmOverdue", t.ownerId, t.confirmBy!);
  }
  if (t.stage === "reviewing") {
    add("review", t.reviewerId);
    if (overdue(t.reviewBy)) add("reviewOverdue", t.reviewerId, t.reviewBy);
  }
  if (
    ["pending", "accepted", "working", "reviewing"].includes(t.stage) &&
    overdue(effective.deadline)
  )
    add(
      "deliveryOverdue",
      t.stage === "reviewing" ? t.reviewerId : t.ownerId,
      effective.deadline,
    );
  for (const b of t.blocks)
    if (!b.resolved) add("blocked:" + b.id, b.helperId || t.ownerId);
  return result;
}
export async function syncFollowups(c: Client, t: Task, leaderId: string) {
  await c.query("UPDATE followups SET active=false WHERE task_id=$1", [t.id]);
  for (const r of reasons(t, leaderId))
    await c.query(
      "INSERT INTO followups(task_id,reason,version,handler_id,since,active) VALUES($1,$2,$3,$4,$5,true) ON CONFLICT(task_id,reason,version) DO UPDATE SET active=true,handler_id=excluded.handler_id",
      [t.id, r.reason, t.version, r.handlerId, r.since],
    );
}
