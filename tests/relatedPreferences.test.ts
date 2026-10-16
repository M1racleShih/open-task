import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultRelatedPreferences,
  readRelatedPreferences,
  writeRelatedPreferences,
} from "../web/relatedPreferences.js";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
const memberId = "a60a3dc9-40ed-4ff8-844a-7531a2eca507";
test("Related preferences preserve mode, member and empty scopes, isolated by signed-in account", () => {
  const store = storage();
  const selected = { active: true, memberId, scopes: [] };
  writeRelatedPreferences(store, "viewer-a", selected);
  assert.deepEqual(readRelatedPreferences(store, "viewer-a"), selected);
  assert.deepEqual(
    readRelatedPreferences(store, "viewer-b"),
    defaultRelatedPreferences,
  );
  writeRelatedPreferences(store, "viewer-a", { ...selected, active: false });
  assert.deepEqual(readRelatedPreferences(store, "viewer-a"), {
    ...selected,
    active: false,
  });
});
test("Related preferences reject malformed storage and normalize valid selections", () => {
  const from = (value: string) =>
    readRelatedPreferences({ getItem: () => value }, "viewer");
  for (const invalid of ["invalid JSON", "null", "42", '"string"']) {
    assert.deepEqual(from(invalid), defaultRelatedPreferences);
  }
  assert.deepEqual(
    from(
      JSON.stringify({
        active: "true",
        memberId: "invalid",
        scopes: ["unknown"],
      }),
    ),
    defaultRelatedPreferences,
  );
  assert.deepEqual(
    from(
      JSON.stringify({
        active: true,
        memberId: memberId.toUpperCase(),
        scopes: ["created", "owned", "owned"],
      }),
    ),
    { active: true, memberId, scopes: ["owned", "created"] },
  );
});
test("Unavailable browser storage does not prevent task filtering", () => {
  const blocked = {
    getItem() {
      throw new Error("Storage unavailable");
    },
    setItem() {
      throw new Error("Storage unavailable");
    },
  };
  assert.deepEqual(
    readRelatedPreferences(blocked, "viewer"),
    defaultRelatedPreferences,
  );
  assert.doesNotThrow(() =>
    writeRelatedPreferences(blocked, "viewer", defaultRelatedPreferences),
  );
});
