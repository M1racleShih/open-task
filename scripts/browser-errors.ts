import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:4310");
await p.getByLabel("Username", { exact: true }).fill("leader");
await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
await p.getByRole("button", { name: "Sign in", exact: true }).click();
await p.getByRole("button", { name: "New task", exact: true }).click();
const title = "Failure test " + randomUUID().slice(0, 8);
await p.getByLabel("Title", { exact: true }).fill(title);
await p
  .getByRole("dialog")
  .getByLabel("Language", { exact: true })
  .selectOption("zh");
await expect(
  p.getByRole("dialog").getByLabel("标题", { exact: true }),
).toHaveValue(title);
await p
  .getByRole("dialog")
  .getByLabel("语言", { exact: true })
  .selectOption("en");
await expect(
  p.getByRole("dialog").getByLabel("Title", { exact: true }),
).toHaveValue(title);
await p.route("**/api/v1/tasks", (route) =>
  route.request().method() === "POST"
    ? route.abort("failed")
    : route.continue(),
);
await p
  .getByRole("dialog")
  .getByRole("button", { name: "Submit", exact: true })
  .click();
await expect(p.getByRole("alert")).toContainText("Connection failed");
await expect(p.getByLabel("Title", { exact: true })).toHaveValue(title);
await p.screenshot({
  path: "artifacts/browser-network-failure.png",
  fullPage: true,
});
await p.unroute("**/api/v1/tasks");
await p
  .getByRole("dialog")
  .getByRole("button", { name: "Submit", exact: true })
  .dblclick();
await p.getByRole("dialog").waitFor({ state: "hidden" });
await p.getByRole("button").filter({ hasText: title }).first().click();
await p.getByRole("button", { name: "Edit draft", exact: true }).click();
await p
  .getByRole("dialog")
  .getByLabel("Title", { exact: true })
  .fill(title + " retained");
const me = await (
  await ctx.request.get("http://127.0.0.1:4310/api/v1/me")
).json();
const id = new URL(p.url()).searchParams.get("task");
const current = (
  await (
    await ctx.request.get("http://127.0.0.1:4310/api/v1/tasks/" + id)
  ).json()
).task;
const response = await ctx.request.post(
  `http://127.0.0.1:4310/api/v1/tasks/${id}/actions/edit`,
  {
    headers: { "X-CSRF-Token": me.csrf, "Idempotency-Key": randomUUID() },
    data: {
      version: current.version,
      fields: { ...current, title: title + " newer" },
    },
  },
);
expect(response.ok()).toBeTruthy();
await p
  .getByRole("dialog")
  .getByRole("button", { name: "Submit", exact: true })
  .click();
await expect(p.getByRole("alert")).toContainText("version has changed");
await expect(
  p.getByRole("dialog").getByLabel("Title", { exact: true }),
).toHaveValue(title + " retained");
await p.screenshot({
  path: "artifacts/browser-version-conflict.png",
  fullPage: true,
});
const list = await (
  await ctx.request.get(
    "http://127.0.0.1:4310/api/v1/tasks?search=" + encodeURIComponent(title),
  )
).json();
expect(list.items).toHaveLength(1);
console.log(
  "Browser network failure preserves input; retry/double click creates one task; stale form rejects and retains typed changes.",
);
await browser.close();
