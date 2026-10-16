import { defaultReviewer } from "../shared/assignments.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Task, User, Terms } from "../shared/model.js";
import { terms, terminal } from "../shared/model.js";
import { ensure } from "./errors.js";
import {
  type Client,
  users,
  projects,
  task,
  save,
  event,
  isLeader,
  requireLeader,
  relations,
} from "./store.js";
import { syncFollowups } from "./followups.js";
const text = z.string().trim().max(20000);
export const fields = z.object({
  title: text.min(1).max(300),
  outcome: text,
  scope: text,
  criteria: text,
  ownerId: z.string(),
  reviewerId: z.string(),
  projectId: z.string().uuid().nullable(),
  plannedStart: z.string().max(100).default(""),
  deadline: z.string().max(100),
  acceptBy: z.string(),
  feedbackBy: z.string(),
  reviewBy: z.string(),
});
const date = (v: unknown) =>
  ensure(
    typeof v === "string" && !!v && Number.isFinite(Date.parse(v)),
    "dateRequired",
  );
const note = (v: unknown) => {
  ensure(
    typeof v === "string" && v.trim().length > 0 && v.length <= 20000,
    "reasonRequired",
  );
  return v.trim();
};
async function context(c: Client) {
  const all = await users(c);
  const ps = await projects(c);
  const leader = all.find((u) => u.active && isLeader(u));
  ensure(leader, "leaderRequired");
  return { all, ps, leader };
}
async function validateAssignments(c: Client, t: Terms, required = false) {
  if (t.plannedStart) date(t.plannedStart);
  if (t.deadline) date(t.deadline);
  ensure(
    !t.plannedStart ||
      !t.deadline ||
      Date.parse(t.plannedStart) <= Date.parse(t.deadline),
    "startAfterDeadline",
  );
  const { all, ps } = await context(c);
  ensure(
    !t.projectId || ps.some((p) => p.id === t.projectId),
    "projectRequired",
  );
  const owner = all.find((u) => u.id === t.ownerId && u.active);
  ensure((!t.ownerId && !required) || owner, "memberRequired");
  if (!t.reviewerId && owner)
    t.reviewerId = defaultReviewer(owner.id, t.projectId, all, ps);
  ensure(
    (!t.reviewerId && !required) ||
      all.some((u) => u.id === t.reviewerId && u.active),
    "memberRequired",
  );
  if (owner)
    ensure(t.ownerId !== t.reviewerId || isLeader(owner), "selfReview");
}
async function validate(c: Client, t: Terms) {
  ensure(t.title && t.outcome && t.criteria, "required");
  await validateAssignments(c, t, true);
  date(t.deadline);
  date(t.acceptBy);
  date(t.feedbackBy);
}
async function publicRelations(c: Client, t: Task) {
  const result = await c.query(
    "SELECT 1 FROM relations r JOIN tasks other ON other.id=CASE WHEN r.source_id=$1 THEN r.target_id ELSE r.source_id END WHERE (r.source_id=$1 OR r.target_id=$1) AND other.stage='draft' LIMIT 1",
    [t.id],
  );
  ensure(!result.rowCount, "privateRelation", 409);
}
async function version(c: Client, t: Task) {
  await c.query(
    "INSERT INTO versions(task_id,version,terms) VALUES($1,$2,$3)",
    [t.id, t.version, terms(t)],
  );
}
async function route(c: Client, t: Task) {
  const { ps, all, leader } = await context(c);
  const creator = all.find((u) => u.id === t.creatorId)!;
  const p = ps.find((p) => p.id === t.projectId);
  t.approvalIds =
    p &&
    p.managerId !== creator.id &&
    p.managerId !== leader.id &&
    !isLeader(creator)
      ? [p.managerId, leader.id]
      : [leader.id];
  t.approvalIndex = 0;
}
function owner(t: Task, u: User) {
  ensure(t.ownerId === u.id, "forbidden", 403);
}
function stage(t: Task, ...allowed: string[]) {
  ensure(allowed.includes(t.stage), "invalidStage", 409);
}
function current(t: Task, b: any) {
  ensure(b.version === t.version, "versionConflict", 409);
}
export async function createTask(c: Client, u: User, body: unknown) {
  const parsed = fields
    .partial()
    .extend({ title: text.min(1).max(300) })
    .parse(body);
  const now = new Date().toISOString();
  const t: Task = {
    outcome: "",
    scope: "",
    criteria: "",
    ownerId: "",
    reviewerId: "",
    projectId: null,
    plannedStart: "",
    deadline: "",
    acceptBy: "",
    feedbackBy: "",
    reviewBy: "",
    ...parsed,
    id: randomUUID(),
    number: 0,
    creatorId: u.id,
    issuerId: null,
    stage: "draft",
    version: 1,
    revision: 0,
    confirmedVersion: null,
    confirmedTerms: null,
    confirmBy: null,
    approvalIds: [],
    approvalIndex: 0,
    refused: null,
    lastFeedbackAt: null,
    checklistVersion: 1,
    checklist: [],
    checklistRequests: [],
    blocks: [],
    submissions: [],
    createdAt: now,
    updatedAt: now,
  };
  await validateAssignments(c, t);
  const r = await c.query(
    "INSERT INTO tasks(id,creator_id,stage,project_id,data) VALUES($1,$2,$3,$4,$5) RETURNING number",
    [t.id, u.id, t.stage, t.projectId, t],
  );
  t.number = r.rows[0].number;
  await save(c, t);
  await version(c, t);
  await event(c, t, u, "created", null, terms(t));
  return t;
}
export async function action(
  c: Client,
  u: User,
  id: string,
  action: string,
  b: any,
): Promise<Task> {
  const t = await task(c, id, u);
  const before = structuredClone(t);
  const { leader } = await context(c);
  await syncFollowups(c, t, leader.id);
  // The graph lock serializes relation changes with acceptance decisions.
  ensure(!terminal(t), "terminal", 409);
  current(t, b);
  switch (action) {
    case "edit": {
      ensure(t.creatorId === u.id || isLeader(u), "forbidden", 403);
      stage(t, "draft", "approval", "approvalReturned");
      Object.assign(
        t,
        fields.parse({ plannedStart: t.plannedStart ?? "", ...b.fields }),
      );
      await validateAssignments(c, t);
      t.version++;
      if (t.stage === "approval") {
        t.stage = "approvalReturned";
        t.approvalIds = [];
      }
      await version(c, t);
      break;
    }
    case "submitApproval": {
      ensure(t.creatorId === u.id, "forbidden", 403);
      stage(t, "draft", "approvalReturned");
      await validate(c, t);
      await publicRelations(c, t);
      await route(c, t);
      t.stage = "approval";
      break;
    }
    case "issue": {
      requireLeader(u);
      stage(t, "draft", "approvalReturned");
      ensure(t.creatorId === u.id, "forbidden", 403);
      await validate(c, t);
      await publicRelations(c, t);
      t.stage = "pending";
      t.issuerId = u.id;
      break;
    }
    case "approve": {
      stage(t, "approval");
      ensure(t.approvalIds[t.approvalIndex] === u.id, "forbidden", 403);
      await validate(c, t);
      t.approvalIndex++;
      if (t.approvalIndex === t.approvalIds.length) {
        requireLeader(u);
        t.stage = "pending";
        t.issuerId = u.id;
      }
      break;
    }
    case "returnApproval": {
      stage(t, "approval");
      ensure(t.approvalIds[t.approvalIndex] === u.id, "forbidden", 403);
      note(b.reason);
      t.stage = "approvalReturned";
      break;
    }
    case "accept":
    case "acceptStart": {
      owner(t, u);
      stage(t, "pending");
      ensure(!t.refused, "invalidStage", 409);
      t.confirmedVersion = t.version;
      t.confirmedTerms = terms(t);
      t.stage = action === "accept" ? "accepted" : "working";
      break;
    }
    case "refuse": {
      owner(t, u);
      stage(t, "pending");
      ensure(!t.refused, "invalidStage", 409);
      t.refused = note(b.reason);
      break;
    }
    case "start": {
      owner(t, u);
      stage(t, "accepted");
      ensure(t.confirmedVersion === t.version, "confirmationRequired", 409);
      t.stage = "working";
      break;
    }
    case "progress": {
      owner(t, u);
      stage(t, "accepted", "working");
      note(b.text);
      note(b.next);
      date(b.feedbackBy);
      t.lastFeedbackAt = new Date().toISOString();
      t.latestProgress = {
        text: b.text,
        next: b.next,
        at: t.lastFeedbackAt,
        feedbackBy: b.feedbackBy,
      };
      t.feedbackBy = b.feedbackBy;
      if (t.confirmedTerms) t.confirmedTerms.feedbackBy = b.feedbackBy;
      break;
    }
    case "requestAdjustment": {
      stage(t, "pending", "accepted", "working", "reviewing");
      (t.adjustmentRequests ??= []).push({
        id: randomUUID(),
        authorId: u.id,
        reason: note(b.reason),
        status: "pending",
      });
      break;
    }
    case "resolveAdjustment": {
      requireLeader(u);
      note(b.reason);
      const request = t.adjustmentRequests?.find(
        (r) => r.id === b.requestId && r.status === "pending",
      );
      ensure(request, "notFound", 404);
      request.status = "resolved";
      break;
    }
    case "comment": {
      note(b.text);
      break;
    }
    case "block": {
      stage(t, "pending", "accepted", "working", "reviewing");
      note(b.reason);
      note(b.help);
      ensure(
        (await users(c)).some((x) => x.id === b.helperId && x.active),
        "memberRequired",
      );
      t.blocks.push({
        id: randomUUID(),
        authorId: u.id,
        helperId: b.helperId,
        reason: b.reason,
        help: b.help,
        resolved: false,
        replies: [],
      });
      break;
    }
    case "replyBlock": {
      const block = t.blocks.find((x) => x.id === b.blockId && !x.resolved);
      ensure(block, "notFound", 404);
      ensure(block.helperId === u.id, "forbidden", 403);
      block.replies.push({ authorId: u.id, text: note(b.text) });
      break;
    }
    case "resolveBlock": {
      owner(t, u);
      const block = t.blocks.find((x) => x.id === b.blockId && !x.resolved);
      ensure(block, "notFound", 404);
      note(b.reason);
      block.resolved = true;
      break;
    }
    case "submitResult": {
      owner(t, u);
      stage(t, "working");
      ensure(t.confirmedVersion === t.version, "confirmationRequired", 409);
      note(b.text);
      date(b.reviewBy);
      const links = z
        .array(
          z
            .string()
            .url()
            .refine((s) => /^https?:\/\//.test(s)),
        )
        .max(30)
        .parse(b.links ?? []);
      t.submissions.push({
        id: randomUUID(),
        version: t.version,
        text: b.text,
        links,
        at: new Date().toISOString(),
        status: "pending",
      });
      t.reviewBy = b.reviewBy;
      t.stage = "reviewing";
      break;
    }
    case "pass":
    case "returnResult": {
      stage(t, "reviewing");
      ensure(t.reviewerId === u.id, "forbidden", 403);
      ensure(t.ownerId !== u.id || isLeader(u), "selfReview");
      const submission = t.submissions.at(-1)!;
      ensure(
        submission.id === b.submissionId &&
          submission.status === "pending" &&
          submission.version === t.version,
        "versionConflict",
        409,
      );
      if (action === "pass") {
        const rs = await relations(c);
        for (const r of rs.filter(
          (r) => r.kind === "dependency" && r.sourceId === id,
        )) {
          const target = await task(c, r.targetId, u);
          ensure(target.stage === "done", "dependencyIncomplete", 409);
        }
        for (const r of rs.filter(
          (r) => r.kind === "parent" && r.targetId === id,
        )) {
          const child = await task(c, r.sourceId, u);
          if (child.stage !== "done") note(b.reason);
        }
        submission.status = "accepted";
        t.stage = "done";
      } else {
        submission.status = "returned";
        note(b.reason);
        date(b.feedbackBy);
        t.feedbackBy = b.feedbackBy;
        if (t.confirmedTerms) t.confirmedTerms.feedbackBy = b.feedbackBy;
        t.stage = "working";
      }
      submission.reason = b.reason ?? "";
      break;
    }
    case "cancel": {
      requireLeader(u);
      note(b.reason);
      t.stage = "cancelled";
      break;
    }
    case "adjust": {
      requireLeader(u);
      stage(t, "pending", "accepted", "working", "reviewing");
      note(b.reason);
      const oldOwner = t.ownerId;
      const next = fields.parse({
        plannedStart: t.plannedStart ?? "",
        ...b.fields,
      });
      await validate(c, next);
      date(b.confirmBy);
      Object.assign(t, next);
      t.version++;
      t.confirmBy = b.confirmBy;
      t.refused = null;
      for (const r of t.adjustmentRequests ?? []) r.status = "resolved";
      if (oldOwner !== t.ownerId) {
        t.stage = "pending";
        t.confirmedVersion = null;
        t.confirmedTerms = null;
      } else if (t.stage === "reviewing") t.stage = "working";
      const sub = t.submissions.at(-1);
      if (sub?.status === "pending") sub.status = "superseded";
      await version(c, t);
      break;
    }
    case "title": {
      requireLeader(u);
      t.title = z.string().trim().min(1).max(300).parse(b.title);
      break;
    }
    case "confirm": {
      owner(t, u);
      stage(t, "accepted", "working");
      ensure(t.confirmedVersion !== t.version, "invalidStage", 409);
      t.confirmedVersion = t.version;
      t.confirmedTerms = terms(t);
      break;
    }
    case "toggle": {
      owner(t, u);
      stage(t, "pending", "accepted", "working", "reviewing");
      const changes = z
        .array(
          z.object({
            itemId: z.string().uuid(),
            expectedDone: z.boolean(),
            done: z.boolean(),
          }),
        )
        .min(1)
        .max(200)
        .parse(b.changes ?? [b]);
      ensure(
        new Set(changes.map((x) => x.itemId)).size === changes.length,
        "invalid",
      );
      if (b.changes !== undefined)
        ensure(
          b.checklistVersion === t.checklistVersion,
          "versionConflict",
          409,
        );
      const updates = changes.map((change) => {
        const item = t.checklist.find((x) => x.id === change.itemId);
        ensure(item, "notFound", 404);
        ensure(item.done === change.expectedDone, "versionConflict", 409);
        return { item, done: change.done };
      });
      for (const { item, done } of updates) item.done = done;
      break;
    }
    case "requestChecklist": {
      owner(t, u);
      stage(t, "pending", "accepted", "working", "reviewing");
      const items = z
        .array(z.object({ id: z.string().uuid(), text: text.min(1) }))
        .max(200)
        .parse(b.items);
      ensure(new Set(items.map((x) => x.id)).size === items.length, "invalid");
      const scopeChanged = z.boolean().parse(b.scopeChanged);
      const reason = scopeChanged
        ? note(b.reason)
        : z.string().max(20000).default("").parse(b.reason).trim();
      t.checklistRequests.push({
        id: randomUUID(),
        baseVersion: t.checklistVersion,
        items,
        scopeChanged,
        authorId: u.id,
        status: "pending",
        reason,
      });
      break;
    }
    case "approveChecklist":
    case "rejectChecklist": {
      requireLeader(u);
      const r = t.checklistRequests.find(
        (x) => x.id === b.requestId && x.status === "pending",
      );
      ensure(r, "notFound", 404);
      if (action === "rejectChecklist") {
        r.status = "rejected";
        note(b.reason);
        break;
      }
      ensure(r.baseVersion === t.checklistVersion, "checklistConflict", 409);
      t.checklist = r.items.map((x) => ({
        ...x,
        done: t.checklist.find((i) => i.id === x.id)?.done ?? false,
      }));
      t.checklistVersion++;
      r.status = "approved";
      if (r.scopeChanged) {
        date(b.confirmBy);
        t.confirmBy = b.confirmBy;
        t.version++;
        if (t.stage === "reviewing") {
          t.stage = "working";
          t.submissions.at(-1)!.status = "superseded";
        }
        await version(c, t);
      }
      break;
    }
    default:
      ensure(false, "unknownAction", 404);
  }
  await save(c, t);
  await event(c, t, u, action, before, t, b.reason ?? b.text ?? "");
  await syncFollowups(c, t, leader.id);
  return t;
}
