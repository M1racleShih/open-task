import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calendarDay,
  DAY_MS,
  ganttRange,
  ganttRows,
  ganttTicks,
  taskSchedule,
} from "../shared/gantt.js";
import type { Task, Project, Relation } from "../shared/model.js";

const task = (fields: Partial<Task> = {}): Task => ({
  id: "task",
  number: 1,
  title: "A delivery",
  outcome: "",
  scope: "",
  criteria: "",
  ownerId: "owner",
  reviewerId: "reviewer",
  creatorId: "leader",
  issuerId: "leader",
  projectId: "project",
  stage: "working",
  version: 1,
  revision: 1,
  plannedStart: "2026-10-12T01:00:00Z",
  deadline: "2026-10-31T10:00:00Z",
  acceptBy: "",
  feedbackBy: "",
  reviewBy: "",
  confirmBy: null,
  confirmedVersion: 1,
  confirmedTerms: null,
  approvalIds: [],
  approvalIndex: 0,
  refused: null,
  lastFeedbackAt: null,
  checklistVersion: 1,
  checklist: [],
  checklistRequests: [],
  blocks: [],
  submissions: [],
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-10T00:00:00Z",
  ...fields,
});
const project: Project = {
  id: "project",
  name: "Project",
  color: "#365fac",
  managerId: "leader",
  memberIds: [],
};

test("Gantt uses Shanghai calendar days across UTC midnight and year boundaries", () => {
  assert.equal(
    calendarDay("2026-10-15T16:00:00Z"),
    calendarDay("2026-10-16T23:59:00+08:00"),
  );
  assert.equal(
    calendarDay("2026-10-15T15:59:00Z")! + 1,
    calendarDay("2026-10-15T16:00:00Z"),
  );
  assert.equal(
    calendarDay("2026-12-31T16:00:00Z"),
    calendarDay("2027-01-01T00:00:00+08:00"),
  );
  assert.equal(calendarDay("invalid"), null);
});

test("missing, invalid and reversed starts never become invented task durations", () => {
  for (const plannedStart of [
    undefined,
    "",
    "invalid",
    "2026-11-01T01:00:00Z",
    "2026-10-31T11:00:00Z",
  ]) {
    const result = taskSchedule(task({ plannedStart }));
    assert.equal(result.start, null);
    assert.equal(result.kind, "deadline");
  }
  assert.equal(taskSchedule(task({ deadline: "" })).kind, "unscheduled");
  assert.equal(taskSchedule(task({ deadline: "invalid" })).kind, "unscheduled");
  const sameDay = taskSchedule(task({ plannedStart: "2026-10-31T01:00:00Z" }));
  assert.equal(sameDay.kind, "range");
  assert.equal(sameDay.start, sameDay.end);
});

test("overdue follows accepted terms and lifecycle without changing the displayed proposal", () => {
  const original = task({ deadline: "2026-10-14T10:00:00Z" });
  const changed = task({
    version: 2,
    confirmedVersion: 1,
    confirmedTerms: original,
  });
  const now = Date.parse("2026-10-16T00:00:00Z");
  const result = taskSchedule(changed, now);
  assert.equal(result.end, calendarDay(changed.deadline));
  assert.equal(result.effectiveDeadline, original.deadline);
  assert.equal(result.overdue, true);
  assert.equal(
    taskSchedule(task({ stage: "reviewing", deadline: original.deadline }), now)
      .overdue,
    true,
  );
  for (const stage of [
    "draft",
    "approval",
    "approvalReturned",
    "done",
    "cancelled",
  ] as const) {
    assert.equal(
      taskSchedule(task({ stage, deadline: original.deadline }), now).overdue,
      false,
      stage,
    );
  }
  assert.equal(
    taskSchedule(
      task({ deadline: original.deadline }),
      Date.parse(original.deadline),
    ).overdue,
    false,
  );
});

test("Gantt groups child-to-parent relations in order without mutating input or hiding orphans", () => {
  const child = task({ id: "child", number: 1 });
  const parent = task({ id: "parent", number: 3 });
  const orphan = task({ id: "orphan", number: 2 });
  const temporary = task({ id: "temporary-task", projectId: null });
  const tasks = [child, parent, orphan, temporary];
  const relations: Relation[] = [
    { id: "r1", sourceId: "child", targetId: "parent", kind: "parent" },
    { id: "r2", sourceId: "orphan", targetId: "filtered", kind: "parent" },
  ];
  const rows = ganttRows(tasks, [project], relations, new Set());
  assert.deepEqual(
    rows.filter((r) => r.kind === "task").map((r) => [r.id, r.depth]),
    [
      ["orphan", 0],
      ["parent", 0],
      ["child", 1],
      ["temporary-task", 0],
    ],
  );
  assert.deepEqual(
    tasks.map((t) => t.id),
    ["child", "parent", "orphan", "temporary-task"],
  );
  assert.equal(
    ganttRows(tasks, [project], relations, new Set([project.id])).filter(
      (r) => r.kind === "task",
    ).length,
    1,
  );
});

test("cross-project parents and legacy cycles still show every task exactly once", () => {
  const tasks = [
    task({ id: "a" }),
    task({ id: "b" }),
    task({ id: "c", projectId: "missing" }),
  ];
  const relations: Relation[] = [
    { id: "r1", sourceId: "a", targetId: "b", kind: "parent" },
    { id: "r2", sourceId: "b", targetId: "a", kind: "parent" },
    { id: "r3", sourceId: "c", targetId: "a", kind: "parent" },
  ];
  const rows = ganttRows(tasks, [project], relations, new Set()).filter(
    (r) => r.kind === "task",
  );
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((r) => r.id)).size, 3);
  assert.equal(rows.find((r) => r.id === "c")?.depth, 0);
});

test("timeline covers latest plan and today while ignoring unusable schedule dates", () => {
  const today = calendarDay("2026-10-16T00:00:00+08:00")!;
  const result = ganttRange(
    [task(), task({ plannedStart: "invalid", deadline: "" })],
    today,
  );
  assert(result.start <= calendarDay(task().plannedStart!)!);
  assert(result.end >= calendarDay(task().deadline)!);
  assert(result.start <= today && result.end >= today);
  assert(ganttRange([], today).days >= 14);
});

test("axis ticks are continuous through leap days, months and long plans with bounded labels", () => {
  const start = calendarDay("2028-02-28T00:00:00+08:00")!;
  const end = start + 4;
  assert.equal(ganttTicks(start, end, 44).ticks.length, 5);
  for (const width of [44, 22, 7, 0.1]) {
    const longEnd = start + 365 * 500;
    const result = ganttTicks(start, longEnd, width);
    assert(result.ticks.length <= 201);
    assert.equal(result.ticks[0].start, start);
    assert.equal(result.ticks.at(-1)?.end, longEnd + 1);
    for (let i = 1; i < result.ticks.length; i++)
      assert.equal(result.ticks[i].start, result.ticks[i - 1].end);
  }
  assert.equal(
    new Date(start * DAY_MS).toISOString().slice(0, 10),
    "2028-02-28",
  );
});
