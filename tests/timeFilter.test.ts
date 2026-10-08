import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultTimeFilter,
  effectiveTimeFilter,
  timeRange,
  timeMatch,
  validDay,
} from "../shared/timeFilter.js";
import { terms, type Task } from "../shared/model.js";
import { agreementChanges } from "../shared/commitment.js";
const custom = {
  ...defaultTimeFilter,
  mode: "custom" as const,
  start: "2026-10-01",
  end: "2026-10-31",
};
test("AC-70/71: Shanghai natural days, relative month rollover, Monday week and fixed custom dates", () => {
  assert.deepEqual(timeRange(custom), {
    start: "2026-10-01",
    end: "2026-10-31",
    from: "2026-09-30T16:00:00.000Z",
    until: "2026-10-31T16:00:00.000Z",
  });
  const month = { ...defaultTimeFilter, mode: "month" as const };
  assert.equal(
    timeRange(month, new Date("2026-10-31T15:59:59Z"))?.start,
    "2026-10-01",
  );
  assert.equal(
    timeRange(month, new Date("2026-10-31T16:00:00Z"))?.start,
    "2026-11-01",
  );
  assert.equal(timeRange(custom, new Date("2026-11-30"))?.start, "2026-10-01");
  assert.equal(
    timeRange({ ...month, mode: "week" }, new Date("2026-10-11T10:00:00Z"))
      ?.start,
    "2026-10-05",
  );
  for (const value of ["2026-02-29", "2026-13-01", "invalid"])
    assert.equal(validDay(value), false);
  assert.throws(() => timeRange({ ...custom, start: "2026-11-01" }));
});
test("AC-66/69/70/73: no title inference, interval overlap, single deadline, optional dates and nonterminal earlier tasks", () => {
  const task = {
    stage: "working" as const,
    deadline: "2026-10-31T23:59:59+08:00",
  };
  assert.equal(timeMatch(task, custom), "match");
  assert.equal(
    timeMatch({ ...task, deadline: "2026-11-01T00:00:00+08:00" }, custom),
    null,
  );
  assert.equal(
    timeMatch(
      {
        ...task,
        plannedStart: "2026-09-20T00:00:00+08:00",
        deadline: "2026-10-10T10:00:00+08:00",
        stage: "done",
      },
      custom,
    ),
    "match",
  );
  assert.equal(timeMatch({ ...task, deadline: "" }, custom), null);
  assert.equal(
    timeMatch(
      { ...task, deadline: "" },
      { ...custom, includeUnscheduled: true },
    ),
    "match",
  );
  for (const stage of ["working", "done", "cancelled"] as const)
    assert.equal(
      timeMatch(
        { ...task, deadline: "2026-09-30T15:59:59Z", stage },
        { ...custom, includeEarlier: true },
      ),
      stage === "working" ? "earlier" : null,
    );
});
test("AC-67/68: project override uses its own range and follows the current global after removal", () => {
  const september = { ...custom, start: "2026-09-01", end: "2026-09-30" };
  const prefs = { global: custom, projects: { a: september } };
  assert.equal(effectiveTimeFilter(prefs, ""), custom);
  assert.equal(effectiveTimeFilter(prefs, "a"), september);
  assert.equal(effectiveTimeFilter(prefs, "b"), custom);
  assert.equal(effectiveTimeFilter({ ...prefs, projects: {} }, "a"), custom);
});
test("AC-74: old snapshots normalize missing start, while a new start participates in differences", () => {
  const legacy = { title: "old", deadline: "2026-10-10T10:00:00Z" } as Task;
  const task = {
    ...legacy,
    version: 2,
    confirmedVersion: 1,
    confirmedTerms: { ...legacy },
    plannedStart: "",
  } as Task;
  assert.equal(terms(legacy).plannedStart, "");
  assert.deepEqual(agreementChanges(task), []);
  task.plannedStart = "2026-10-01T10:00:00Z";
  assert.deepEqual(agreementChanges(task), ["plannedStart"]);
});
