import { test } from "node:test";
import assert from "node:assert/strict";
import { messages, translate } from "../web/i18n.js";
test("AC-51/52/53: each centralized message has both languages and dynamic blocked reasons translate", () => {
  for (const [key, value] of Object.entries(messages)) {
    assert.equal(value.length, 2, key);
    assert.ok(value[0].trim(), key);
    assert.ok(value[1].trim(), key);
  }
  assert.equal(translate("blocked:uuid", "zh"), messages.blocked[1]);
});
import { reconcileChecklist } from "../shared/checklist.js";
test("AC-38 UI: inserting a checklist line preserves retained item identities", () => {
  const old = [
    { id: "a", text: "A", done: true },
    { id: "b", text: "B", done: false },
  ];
  assert.deepEqual(
    reconcileChecklist(["New", "A", "B"], old, () => "new").map((x) => x.id),
    ["new", "a", "b"],
  );
  assert.deepEqual(
    reconcileChecklist(["B"], old, () => "new").map((x) => x.id),
    ["b"],
  );
});
