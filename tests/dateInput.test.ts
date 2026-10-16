import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateInputText,
  parseDateInput,
  moveDay,
  moveMonth,
  shanghaiToday,
} from "../web/dateValue.js";

test("date input validates real days and 24-hour minutes without date normalization", () => {
  for (const text of [
    "2026-02-29 12:00",
    "2026-04-31 12:00",
    "0000-01-01 12:00",
    "2026-10-16 24:00",
    "2026-10-16 23:60",
    "2026-10-16 1:00",
    "2026-10-16",
    "2026-10-16 12:00:01",
    "old invalid input",
  ])
    assert.equal(parseDateInput(text), null, text);
  assert.equal(parseDateInput(""), "");
  assert.equal(parseDateInput("2028-02-29 00:00"), "2028-02-28T16:00:00.000Z");
  assert.equal(parseDateInput("2026-10-16 23:59"), "2026-10-16T15:59:00.000Z");
  assert.equal(parseDateInput("2028-02-29", true), "2028-02-29");
  assert.equal(parseDateInput("2026-02-29", true), null);
  assert.equal(parseDateInput("2026-10-16 12:00", true), null);
  assert.equal(parseDateInput("", true), "");
});

test("Shanghai input presentation and calendar today ignore the machine timezone", () => {
  assert.equal(dateInputText("2026-12-31T18:05:39.123Z"), "2027-01-01 02:05");
  assert.equal(dateInputText("old invalid input"), "old invalid input");
  assert.equal(dateInputText(""), "");
  assert.equal(dateInputText("2028-02-29", true), "2028-02-29");
  assert.equal(shanghaiToday(new Date("2026-10-16T16:00:00Z")), "2026-10-17");
});

test("keyboard calendar navigation clamps month ends, crosses years and respects four-digit bounds", () => {
  assert.equal(moveMonth("2026-01-31", 1), "2026-02-28");
  assert.equal(moveMonth("2028-01-31", 1), "2028-02-29");
  assert.equal(moveMonth("2028-02-29", 12), "2029-02-28");
  assert.equal(moveMonth("2026-12-31", 1), "2027-01-31");
  assert.equal(moveMonth("0001-01-01", -1), "0001-01-01");
  assert.equal(moveMonth("9999-12-31", 1), "9999-12-31");
  assert.equal(moveDay("2026-12-31", 1), "2027-01-01");
  assert.equal(moveDay("2028-03-01", -1), "2028-02-29");
  assert.equal(moveDay("0001-01-01", -1), "0001-01-01");
  assert.equal(moveDay("9999-12-31", 1), "9999-12-31");
});
