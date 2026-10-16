import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  editMarkdown,
  formatMarkdown,
  sourceOffset,
  textareaText,
} from "../web/markdownEditing.js";
import { TaskDescription } from "../web/TaskDescription.js";
import { Markdown } from "../web/Markdown.js";

test("formatting preserves unselected text and uses UTF-16 offsets for Unicode", () => {
  const text = "前🙂selected\n尾 ";
  const result = formatMarkdown(text, 3, 11, "bold");
  assert.equal(result.text, "前🙂**selected**\n尾 ");
  assert.equal(result.text.slice(result.start, result.end), "selected");
  assert.deepEqual(formatMarkdown("ab", 1, 1, "bold"), {
    text: "a****b",
    start: 3,
    end: 3,
  });
});
test("link selects only its editable URL, retaining label and surrounding text", () => {
  const result = formatMarkdown("a 标签 z", 2, 4, "link");
  assert.equal(result.text, "a [标签](https://) z");
  assert.equal(result.text.slice(result.start, result.end), "https://");
  assert.equal(formatMarkdown("", 0, 0, "link").text, "[](https://)");
});

test("textarea normalization never rewrites existing CRLF when editing or formatting", () => {
  const source = "one\r\n二🙂\r\nlast ";
  assert.equal(editMarkdown(source, textareaText(source)), source);
  assert.equal(
    editMarkdown(source, "one\n二🙂!\nlast "),
    "one\r\n二🙂!\r\nlast ",
  );
  assert.equal(
    editMarkdown(source, "one\nnew\n二🙂\nlast "),
    "one\r\nnew\r\n二🙂\r\nlast ",
  );
  const start = sourceOffset(source, 4),
    end = sourceOffset(source, 7);
  assert.equal(
    formatMarkdown(source, start, end, "bold").text,
    "one\r\n**二🙂**\r\nlast ",
  );
});
test("lists operate on selected lines without consuming following lines or CRLF", () => {
  assert.deepEqual(formatMarkdown("one\ntwo\nthree", 0, 8, "list"), {
    text: "- one\n- two\nthree",
    start: 2,
    end: 12,
  });
  assert.deepEqual(formatMarkdown("one\ntwo", 5, 5, "list"), {
    text: "one\n- two",
    start: 7,
    end: 7,
  });
  assert.equal(
    formatMarkdown("a\r\nb\r\nend", 0, 6, "list").text,
    "- a\r\n- b\r\nend",
  );
  assert.equal(formatMarkdown("\nnext", 0, 0, "list").text, "- \nnext");
});
test("only long scope can collapse; result and acceptance criteria always render in full", () => {
  const render = (scope: string) =>
    renderToStaticMarkup(
      createElement(TaskDescription, {
        task: { outcome: "Result\nfull", criteria: "- [x] Read only", scope },
      }),
    );
  const short = render("Short scope");
  assert.equal((short.match(/<section/g) ?? []).length, 3);
  assert(!short.includes("<details"));
  const long = render("Long scope ".repeat(70));
  assert.equal((long.match(/<section/g) ?? []).length, 2);
  assert(
    long.includes('<details class="detail-section task-prose task-scope">'),
  );
  assert(long.includes("Result\nfull"));
  assert(long.includes('type="checkbox" disabled="" checked=""'));
});
test("task prose keeps raw HTML, unsafe URLs and remote images inert", () => {
  const html = renderToStaticMarkup(
    createElement(Markdown, {
      text: "<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29)\n\n[bad](data:text/html,hello)\n\n![remote](https://invalid.example/tracker)\n\n- [ ] prose checkbox",
    }),
  );
  assert(!/<img|href="(?:javascript|data):/.test(html));
  assert(html.includes("&lt;img"));
  assert(html.includes('type="checkbox" disabled=""'));
});
