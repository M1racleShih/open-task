import { terms, type Task, type User } from "../../shared/model.js";
export const demoUsers: User[] = [
  {
    id: "mock-alex",
    name: "Alex (demo)",
    username: "alex",
    active: true,
    roles: ["leader"],
  },
  {
    id: "mock-sam",
    name: "Sam (demo)",
    username: "sam",
    active: true,
    roles: ["member"],
  },
  {
    id: "mock-jules",
    name: "Jules (demo)",
    username: "jules",
    active: true,
    roles: ["member"],
  },
];
export const demoProject = {
  id: "mock-project",
  name: "Demo release",
  color: "#365fac",
  managerId: demoUsers[0].id,
  memberIds: demoUsers.map((u) => u.id),
};
export function demoTask(patch: Partial<Task> = {}): Task {
  const task: Task = {
    id: "mock-task",
    number: 101,
    title: "Demo: prepare launch notes",
    outcome: "A reviewable demo release note",
    scope: "Synthetic data only",
    criteria: "Read and review the demo note",
    ownerId: demoUsers[0].id,
    reviewerId: demoUsers[0].id,
    creatorId: demoUsers[0].id,
    issuerId: demoUsers[0].id,
    projectId: demoProject.id,
    stage: "working",
    version: 1,
    revision: 1,
    plannedStart: "2026-10-12T01:00:00Z",
    deadline: "2026-10-31T10:00:00Z",
    acceptBy: "2026-10-15T10:00:00Z",
    feedbackBy: "2026-10-31T10:00:00Z",
    reviewBy: "2026-11-02T10:00:00Z",
    confirmBy: null,
    confirmedVersion: 1,
    confirmedTerms: null,
    approvalIds: [demoUsers[0].id, demoUsers[2].id],
    approvalIndex: 0,
    refused: null,
    lastFeedbackAt: null,
    checklistVersion: 1,
    checklist: [{ id: "item-a", text: "Check the demo note", done: false }],
    checklistRequests: [],
    blocks: [],
    submissions: [],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-10T00:00:00Z",
    ...patch,
  };
  task.confirmedTerms = terms(task);
  return task;
}
