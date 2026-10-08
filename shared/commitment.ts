import type { Task, Terms } from "./model.js";
import { terminal } from "./model.js";

export type CommitmentGroup =
  "waiting" | "active" | "changed" | "review" | "closed";
export type ResponseFact = {
  reason: string;
  handlerId: string;
  due: string | null;
  overdue: boolean;
};

/** A named assignee is not evidence that a version has been accepted. */
export function commitment(task: Task) {
  const hasPromise =
    task.confirmedVersion !== null && task.confirmedTerms !== null;
  const current = hasPromise && task.confirmedVersion === task.version;
  const needsConfirmation =
    ["accepted", "working"].includes(task.stage) && !current;
  const effective: Terms = hasPromise && !current ? task.confirmedTerms! : task;
  const group: CommitmentGroup = terminal(task)
    ? "closed"
    : task.stage === "reviewing"
      ? "review"
      : needsConfirmation
        ? "changed"
        : ["accepted", "working"].includes(task.stage)
          ? "active"
          : "waiting";
  return { hasPromise, current, needsConfirmation, effective, group };
}

/** Display the response obligations; viewing this projection changes no facts. */
export function responseFacts(task: Task, leaderId: string, now = Date.now()) {
  const result: ResponseFact[] = [];
  const { effective, needsConfirmation } = commitment(task);
  const add = (reason: string, handlerId: string, due: string | null = null) =>
    result.push({
      reason,
      handlerId,
      due: due || null,
      overdue:
        !!due && Number.isFinite(Date.parse(due)) && Date.parse(due) < now,
    });
  if (terminal(task)) return result;
  if (task.stage === "draft") add("promisePrepare", task.creatorId);
  if (task.stage === "approval")
    add("approval", task.approvalIds[task.approvalIndex] ?? "");
  if (task.stage === "approvalReturned")
    add("approvalReturned", task.creatorId);
  if (task.stage === "pending")
    task.refused
      ? add("refused", task.issuerId ?? "")
      : add("accept", task.ownerId, task.acceptBy);
  if (needsConfirmation) add("confirm", task.ownerId, task.confirmBy);
  if (["accepted", "working"].includes(task.stage))
    add("feedback", task.ownerId, effective.feedbackBy);
  if (task.stage === "reviewing") add("review", task.reviewerId, task.reviewBy);
  for (const block of task.blocks)
    if (!block.resolved) add("blocked", block.helperId || task.ownerId);
  if (task.checklistRequests.some((request) => request.status === "pending"))
    add("checklist", leaderId);
  if (task.adjustmentRequests?.some((request) => request.status === "pending"))
    add("requestAdjustment", leaderId);
  return result;
}

export const agreementFields = [
  "ownerId",
  "reviewerId",
  "outcome",
  "scope",
  "criteria",
  "plannedStart",
  "deadline",
  "acceptBy",
  "feedbackBy",
  "reviewBy",
] as const;

export function agreementChanges(task: Task) {
  if (!task.confirmedTerms || task.confirmedVersion === task.version) return [];
  return agreementFields.filter(
    (field) => (task.confirmedTerms![field] ?? "") !== (task[field] ?? ""),
  );
}

export const lifecycleStates = [
  "preparing",
  "pending",
  "active",
  "changed",
  "review",
  "done",
  "cancelled",
] as const;
export type LifecycleState = (typeof lifecycleStates)[number];

/** Seven visual phases; blockers remain an independent warning, not a phase. */
export function lifecycleState(task: Task): LifecycleState {
  if (task.stage === "done" || task.stage === "cancelled") return task.stage;
  if (task.stage === "reviewing") return "review";
  if (task.stage === "pending") return "pending";
  if (["accepted", "working"].includes(task.stage))
    return commitment(task).needsConfirmation ? "changed" : "active";
  return "preparing";
}
