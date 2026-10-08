import type { Task } from "./model.js";

export type TimeFilter = {
  mode: "all" | "week" | "month" | "custom";
  start: string;
  end: string;
  includeUnscheduled: boolean;
  includeEarlier: boolean;
};
export type TimePreferences = {
  global: TimeFilter;
  projects: Record<string, TimeFilter>;
};
export const defaultTimeFilter: TimeFilter = {
  mode: "all",
  start: "",
  end: "",
  includeUnscheduled: false,
  includeEarlier: false,
};
export function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
const dayText = (date: Date) => date.toISOString().slice(0, 10);
export function timeRange(filter: TimeFilter, now = new Date()) {
  if (filter.mode === "all") return null;
  const today = new Date(
    dayText(new Date(now.getTime() + 8 * 3600000)) + "T00:00:00Z",
  );
  let start = filter.start,
    end = filter.end;
  if (filter.mode === "month") {
    start = dayText(
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
    );
    end = dayText(
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)),
    );
  } else if (filter.mode === "week") {
    today.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
    start = dayText(today);
    today.setUTCDate(today.getUTCDate() + 6);
    end = dayText(today);
  }
  if (!validDay(start) || !validDay(end) || start > end)
    throw new Error("invalidTimeRange");
  const from = new Date(start + "T00:00:00+08:00").toISOString();
  const until = new Date(
    Date.parse(end + "T00:00:00+08:00") + 86400000,
  ).toISOString();
  return { start, end, from, until };
}
/** Latest plan only; actual completion and title text never affect matching. */
export function timeMatch(
  task: Pick<Task, "plannedStart" | "deadline" | "stage">,
  filter: TimeFilter,
  now = new Date(),
): "match" | "earlier" | null {
  const range = timeRange(filter, now);
  if (!range) return "match";
  const end = Date.parse(task.deadline);
  if (!Number.isFinite(end)) return filter.includeUnscheduled ? "match" : null;
  const start = Date.parse(task.plannedStart || task.deadline);
  if (end >= Date.parse(range.from) && start < Date.parse(range.until))
    return "match";
  if (
    filter.includeEarlier &&
    end < Date.parse(range.from) &&
    !["done", "cancelled"].includes(task.stage)
  )
    return "earlier";
  return null;
}
export function effectiveTimeFilter(
  preferences: TimePreferences,
  project: string,
) {
  return (project && preferences.projects[project]) || preferences.global;
}
export function timeQuery(filter: TimeFilter) {
  return new URLSearchParams({
    time: filter.mode,
    start: filter.start,
    end: filter.end,
    includeUnscheduled: String(filter.includeUnscheduled),
    includeEarlier: String(filter.includeEarlier),
  }).toString();
}
