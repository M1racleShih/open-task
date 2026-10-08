import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../web/Markdown.js";
import { eventDiff } from "../shared/eventDiff.js";
import { fitPanels } from "../shared/panelLayout.js";
test("activity isolates a checklist toggle and ignores unchanged task prose", () => {
  const before = {
    scope: "same long scope",
    stage: "pending",
    revision: 1,
    updatedAt: "old",
    checklist: [
      { id: "a", text: "first", done: false },
      { id: "b", text: "second", done: false },
    ],
  };
  const after = {
    ...before,
    revision: 2,
    updatedAt: "new",
    checklist: [{ id: "a", text: "first", done: true }, before.checklist[1]],
  };
  assert.deepEqual(eventDiff(before, after), {
    before: { checklist: [before.checklist[0]] },
    after: { checklist: [after.checklist[0]] },
  });
  assert.deepEqual(before.checklist[0].done, false);
});
test("activity includes state, added and removed fields, and compares object keys independent of order", () => {
  assert.deepEqual(
    eventDiff(
      { stage: "draft", issuerId: null },
      { issuerId: "leader", stage: "pending" },
    ),
    {
      before: { stage: "draft", issuerId: null },
      after: { stage: "pending", issuerId: "leader" },
    },
  );
  assert.deepEqual(eventDiff({ x: 1, y: 2 }, { y: 2, x: 1 }), {
    before: null,
    after: null,
  });
  assert.deepEqual(eventDiff({ text: "removed" }, { note: "new" }), {
    before: { text: "removed", note: null },
    after: { text: null, note: "new" },
  });
});
test("panels use available space rather than fixed 430/650px caps", () => {
  assert.deepEqual(fitPanels(100, 1000, 1200), { left: 100, right: 1000 });
  assert.deepEqual(fitPanels(0, 1200, 1200), { left: 0, right: 1200 });
  assert.deepEqual(fitPanels(400, 800, 600), { left: 200, right: 400 });
  assert.deepEqual(fitPanels(400, 800, 0), { left: 0, right: 0 });
});
test("Markdown renders plain text, GFM tables/lists/code while refusing executable markup and URLs", () => {
  const render = (text: string) =>
    renderToStaticMarkup(createElement(Markdown, { text }));
  const html = render(
    "# 标题\n\n**粗体**\n\n- 第一项\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n`code`",
  );
  for (const tag of ["<h1>", "<strong>", "<ul>", "<table>", "<code>"])
    assert(html.includes(tag), tag);
  assert(render("普通文字\n第二行").includes("普通文字\n第二行"));
  const malicious = render(
    "<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n![remote](https://example.com/pixel.png)",
  );
  assert(!malicious.includes("<script>"));
  assert(!malicious.includes('href="javascript:'));
  assert(!malicious.includes("<img"));
});
test("comment-like events with only bookkeeping changes do not show duplicate snapshots", () => {
  assert.deepEqual(
    eventDiff(
      { stage: "pending", revision: 2, updatedAt: "a" },
      { stage: "pending", revision: 3, updatedAt: "b" },
    ),
    { before: null, after: null },
  );
});
