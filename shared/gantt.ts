import type { Task, Project, Relation } from "./model.js";
import { commitment } from "./commitment.js";

export const DAY_MS = 86_400_000;
const SHANGHAI_OFFSET = 8 * 3_600_000;

/** Integer Shanghai calendar days keep layout independent of the browser timezone. */
export function calendarDay(value: string | number) {
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(timestamp)
    ? Math.floor((timestamp + SHANGHAI_OFFSET) / DAY_MS)
    : null;
}

export function taskSchedule(task: Task, now = Date.now()) {
  const end = calendarDay(task.deadline);
  const plannedStart = calendarDay(task.plannedStart ?? "");
  const start =
    end !== null &&
    plannedStart !== null &&
    Date.parse(task.plannedStart!) <= Date.parse(task.deadline)
      ? plannedStart
      : null;
  const effectiveDeadline = commitment(task).effective.deadline;
  return {
    start,
    end,
    kind: end === null ? "unscheduled" : start === null ? "deadline" : "range",
    // Match the existing delivery obligation, including unconfirmed adjustments.
    overdue:
      ["pending", "accepted", "working", "reviewing"].includes(task.stage) &&
      Date.parse(effectiveDeadline) < now,
    effectiveDeadline,
  } as const;
}

export function ganttRange(tasks: Task[], today: number) {
  let start = today - 3;
  let end = today + 10;
  for (const task of tasks) {
    const schedule = taskSchedule(task);
    if (schedule.end === null) continue;
    start = Math.min(start, (schedule.start ?? schedule.end) - 2);
    end = Math.max(end, schedule.end + 2);
  }
  return { start, end, days: end - start + 1 };
}

export type GanttRow =
  | { kind: "project"; id: string; project: Project | null; count: number }
  | { kind: "task"; id: string; task: Task; depth: number };

/** A relation's source is the child; missing/filtered parents become roots. */
export function ganttRows(
  tasks: Task[],
  projects: Project[],
  relations: Relation[],
  collapsed: ReadonlySet<string>,
): GanttRow[] {
  const rows: GanttRow[] = [];
  const parents = new Map(
    relations
      .filter((r) => r.kind === "parent")
      .map((r) => [r.sourceId, r.targetId]),
  );
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const id =
      task.projectId && projectMap.has(task.projectId)
        ? task.projectId
        : "temporary";
    const group = groups.get(id) ?? [];
    group.push(task);
    groups.set(id, group);
  }
  const ordered = [...projects.map((project) => project.id), "temporary"];
  for (const id of ordered) {
    const group = groups.get(id);
    if (!group?.length) continue;
    rows.push({
      kind: "project",
      id,
      project: projectMap.get(id) ?? null,
      count: group.length,
    });
    if (collapsed.has(id)) continue;
    const sorted = [...group].sort((a, b) => a.number - b.number);
    const ids = new Set(group.map((task) => task.id));
    const children = new Map<string, Task[]>();
    for (const task of sorted) {
      const parent = parents.get(task.id);
      if (!parent || !ids.has(parent)) continue;
      const siblings = children.get(parent) ?? [];
      siblings.push(task);
      children.set(parent, siblings);
    }
    const visited = new Set<string>();
    const visit = (task: Task, depth: number) => {
      if (visited.has(task.id)) return;
      visited.add(task.id);
      rows.push({ kind: "task", id: task.id, task, depth });
      for (const child of children.get(task.id) ?? []) visit(child, depth + 1);
    };
    for (const task of sorted) {
      if (!ids.has(parents.get(task.id) ?? "")) visit(task, 0);
    }
    // Defensive fallback for legacy inconsistent relation data.
    for (const task of sorted) visit(task, 0);
  }
  return rows;
}

export type GanttTick = { start: number; end: number };
export function ganttTicks(start: number, end: number, pixelsPerDay: number) {
  const span = end - start + 1;
  const unit =
    pixelsPerDay >= 28 && span <= 300
      ? "day"
      : pixelsPerDay >= 7 && span <= 2100
        ? "week"
        : pixelsPerDay * 30 >= 48 && span <= 9000
          ? "month"
          : "year";
  const ticks: GanttTick[] = [];
  let cursor = start;
  while (cursor <= end) {
    const date = new Date(cursor * DAY_MS);
    let next: number;
    if (unit === "day") next = cursor + 1;
    else if (unit === "week")
      next = cursor + (7 - ((date.getUTCDay() + 6) % 7));
    else if (unit === "month")
      next =
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / DAY_MS;
    else
      next =
        Date.UTC(
          date.getUTCFullYear() + Math.max(1, Math.ceil(span / (365 * 200))),
          0,
          1,
        ) / DAY_MS;
    ticks.push({ start: cursor, end: Math.min(end + 1, next) });
    cursor = next;
  }
  return { unit, ticks };
}
