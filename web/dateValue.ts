import { validDay } from "../shared/timeFilter.js";

/** Format instants in Shanghai, independently of the browser's system timezone. */
export function dateInputText(value: string, dateOnly = false) {
  if (!value || dateOnly) return value;
  const instant = Date.parse(value);
  return Number.isFinite(instant)
    ? new Date(instant + 8 * 3600000)
        .toISOString()
        .slice(0, 16)
        .replace("T", " ")
    : value;
}

/** null means invalid/incomplete; an empty string means an explicitly cleared value. */
export function parseDateInput(text: string, dateOnly = false): string | null {
  if (!text) return "";
  if (dateOnly) return validDay(text) ? text : null;
  if (
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text) ||
    !validDay(text.slice(0, 10))
  )
    return null;
  const instant = Date.parse(text.replace(" ", "T") + ":00+08:00");
  if (!Number.isFinite(instant)) return null;
  const value = new Date(instant).toISOString();
  return dateInputText(value) === text ? value : null;
}

export function shanghaiToday(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}

export function moveDay(day: string, days: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  const next = date.toISOString().slice(0, 10);
  return validDay(next) ? next : day;
}

/** Preserve the day where possible, clamping e.g. January 31 to February 28. */
export function moveMonth(day: string, months: number) {
  const date = new Date(day + "T00:00:00Z");
  const wanted = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months + 1);
  date.setUTCDate(0);
  date.setUTCDate(Math.min(wanted, date.getUTCDate()));
  const next = date.toISOString().slice(0, 10);
  return validDay(next) ? next : day;
}
