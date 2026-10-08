export type Role = "admin" | "leader" | "member";
export type User = {
  id: string;
  username: string;
  name: string;
  roles: Role[];
  active: boolean;
};
export type Project = {
  id: string;
  name: string;
  managerId: string;
  color: string;
  memberIds: string[];
};
export type Stage =
  | "draft"
  | "approval"
  | "approvalReturned"
  | "pending"
  | "accepted"
  | "working"
  | "reviewing"
  | "done"
  | "cancelled";
export type Terms = {
  title: string;
  outcome: string;
  scope: string;
  criteria: string;
  ownerId: string;
  reviewerId: string;
  projectId: string | null;
  deadline: string;
  acceptBy: string;
  feedbackBy: string;
  reviewBy: string;
};
export type ChecklistItem = { id: string; text: string; done: boolean };
export type Task = Terms & {
  id: string;
  number: number;
  creatorId: string;
  issuerId: string | null;
  stage: Stage;
  version: number;
  revision: number;
  confirmedVersion: number | null;
  confirmedTerms: Terms | null;
  confirmBy: string | null;
  approvalIds: string[];
  approvalIndex: number;
  refused: string | null;
  lastFeedbackAt: string | null;
  latestProgress?: {
    text: string;
    next: string;
    at: string;
    feedbackBy: string;
  };
  adjustmentRequests?: {
    id: string;
    authorId: string;
    reason: string;
    status: "pending" | "resolved";
  }[];
  checklistVersion: number;
  checklist: ChecklistItem[];
  checklistRequests: {
    id: string;
    baseVersion: number;
    items: { id: string; text: string }[];
    scopeChanged: boolean;
    authorId: string;
    status: "pending" | "approved" | "rejected";
    reason: string;
  }[];
  blocks: {
    id: string;
    authorId: string;
    helperId: string;
    reason: string;
    help: string;
    resolved: boolean;
    replies: { authorId: string; text: string }[];
  }[];
  submissions: {
    id: string;
    version: number;
    text: string;
    links: string[];
    at: string;
    status: "pending" | "returned" | "accepted" | "superseded";
    reason?: string;
  }[];
  createdAt: string;
  updatedAt: string;
};
export type Relation = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: "parent" | "dependency" | "related";
};
export type Event = {
  taskTitle?: string;
  taskNumber?: number;
  id: number;
  taskId: string;
  actorId: string;
  type: string;
  version: number;
  before: unknown;
  after: unknown;
  note: string;
  at: string;
};
export const terminal = (t: Task) =>
  t.stage === "done" || t.stage === "cancelled";
export const terms = (t: Terms): Terms => ({
  title: t.title,
  outcome: t.outcome,
  scope: t.scope,
  criteria: t.criteria,
  ownerId: t.ownerId,
  reviewerId: t.reviewerId,
  projectId: t.projectId,
  deadline: t.deadline,
  acceptBy: t.acceptBy,
  feedbackBy: t.feedbackBy,
  reviewBy: t.reviewBy,
});
