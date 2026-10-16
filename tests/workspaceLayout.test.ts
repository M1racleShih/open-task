import assert from "node:assert/strict";
import { test } from "node:test";
import { localPreferences } from "../shared/storage.js";
import {
  defaultPanels,
  panelPreferenceKey,
  readPanels,
  visiblePanels,
  workspaceColumns,
  writePanels,
} from "../shared/workspaceLayout.js";

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
test("panel preferences round-trip per account, including all panels hidden", () => {
  const storage = memory();
  const first = {
    ...defaultPanels(true),
    tree: false,
    workspace: false,
    details: false,
    treeSize: 321,
    detailSize: 517,
    bottom: true,
    inboxSize: 240,
  };
  writePanels("account/a", first, storage);
  assert.deepEqual(readPanels("account/a", true, storage), first);
  assert.deepEqual(readPanels("account/b", true, storage), defaultPanels(true));
  assert.notEqual(
    panelPreferenceKey("account/a"),
    panelPreferenceKey("account%2Fa"),
  );
});
test("temporary focus never changes the saved layout or widths", () => {
  const storage = memory();
  const original = {
    ...defaultPanels(true),
    workspace: false,
    treeSize: 310,
    detailSize: 540,
  };
  writePanels("a", original, storage);
  assert.deepEqual(visiblePanels(original, true), {
    ...original,
    tree: false,
    workspace: false,
    details: true,
  });
  assert.deepEqual(visiblePanels(original, false), original);
  assert.deepEqual(readPanels("a", true, storage), original);
});
test("malformed, unsupported and partial saved preferences use validated defaults", () => {
  const storage = memory();
  for (const saved of [
    "invalid json",
    "null",
    "[]",
    '{"version":2,"tree":false}',
  ]) {
    storage.setItem(panelPreferenceKey("a"), saved);
    assert.deepEqual(readPanels("a", true, storage), defaultPanels(true));
  }
  storage.setItem(
    panelPreferenceKey("a"),
    JSON.stringify({
      version: 1,
      tree: false,
      details: "false",
      treeSize: -2,
      detailSize: 0,
      inboxSize: 100000,
    }),
  );
  assert.deepEqual(readPanels("a", true, storage), {
    ...defaultPanels(true),
    tree: false,
    inboxSize: 10000,
  });
});
test("unavailable storage cannot prevent layout, theme or language controls", () => {
  const unavailable = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  assert.deepEqual(readPanels("a", true, unavailable), defaultPanels(true));
  assert.doesNotThrow(() => writePanels("a", defaultPanels(), unavailable));
  // Node has no usable browser localStorage; access must still be guarded.
  assert.doesNotThrow(() => localPreferences.getItem("theme"));
  assert.doesNotThrow(() => localPreferences.setItem("language", "en"));
});
test("hiding center gives details the remaining space; all visibility combinations fit", () => {
  const open = workspaceColumns(
    1400,
    { tree: true, workspace: true, details: true },
    280,
    410,
  );
  const hidden = workspaceColumns(
    1400,
    { tree: true, workspace: false, details: true },
    280,
    410,
  );
  assert.equal(hidden.right, 1113);
  assert(hidden.right > open.right);
  assert.equal(hidden.detailDivider, false);
  const focused = workspaceColumns(
    1400,
    { tree: false, workspace: false, details: true },
    280,
    410,
  );
  assert.equal(focused.right, 1400);
  for (const width of [0, 300, 720, 1400])
    for (const tree of [false, true])
      for (const workspace of [false, true])
        for (const details of [false, true]) {
          const columns = workspaceColumns(
            width,
            { tree, workspace, details },
            1000,
            2000,
          );
          assert(columns.left >= 0 && columns.right >= 0);
          assert(columns.left + columns.right <= width);
          if (workspace && width > 20)
            assert(columns.left + columns.right < width - 14);
        }
});
