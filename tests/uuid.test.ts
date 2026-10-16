import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { randomUUID } from "../web/uuid.js";
import { registerHooks } from "node:module";

// Node SSR checks behavior; Vite and browser checks cover the imported styles.
const styles = registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith(".css")
      ? { format: "module", source: "export {};", shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { TaskForm } = await import("../web/Forms.js");
styles.deregister();

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("UUID uses the native API when available", (t) => {
  const expected = "12345678-1234-4123-8123-123456789abc";
  t.mock.method(globalThis.crypto, "randomUUID", () => expected);
  assert.equal(randomUUID(), expected);
});

test("LAN HTTP fallback generates distinct RFC 4122 v4 UUIDs", (t) => {
  t.mock.property(globalThis.crypto, "randomUUID", undefined);
  const ids = Array.from({ length: 1000 }, () => randomUUID());
  for (const id of ids) assert.match(id, uuidV4);
  assert.equal(new Set(ids).size, ids.length);
});

test("HTTP fallback sets version and variant bits and preserves random bytes", (t) => {
  t.mock.property(globalThis.crypto, "randomUUID", undefined);
  t.mock.method(globalThis.crypto, "getRandomValues", (bytes: Uint8Array) => {
    bytes.fill(0xff);
    return bytes;
  });
  assert.equal(randomUUID(), "ffffffff-ffff-4fff-bfff-ffffffffffff");
});

test("task and project creation forms render without crypto.randomUUID", (t) => {
  t.mock.property(globalThis.crypto, "randomUUID", undefined);
  for (const title of ["newTask", "newProject"]) {
    const html = renderToStaticMarkup(
      createElement(TaskForm, {
        spec: { title, path: "/unused", values: {}, fields: ["name"] },
        users: [],
        projects: [],
        onClose: () => {},
        onSaved: async () => {},
      }),
    );
    assert(html.includes('role="dialog"'));
    assert(html.includes(title));
  }
});
