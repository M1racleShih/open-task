import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const fixture = JSON.parse(
  await readFile("artifacts/ui-polish-fixtures.json", "utf8"),
);
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
  locale: "zh-CN",
  viewport: { width: 1440, height: 1000 },
});
const p = await ctx.newPage();
await p.goto(fixture.working.url);
await p.getByLabel("Username", { exact: true }).fill("manager");
await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
await p.getByRole("button", { name: "Sign in", exact: true }).click();
await p.locator(".checklist-card").waitFor();
await p.getByLabel("Project", { exact: true }).selectOption(fixture.project.id);
await p.getByRole("button", { name: "Fit view", exact: true }).click();
await p.screenshot({
  path: "artifacts/ui-polish-details-light.png",
  fullPage: true,
});
await p.getByLabel("Switch theme", { exact: true }).click();
await p.screenshot({
  path: "artifacts/ui-polish-details-dark.png",
  fullPage: true,
});
const split = p.getByRole("separator", { name: "Task details", exact: true });
const sb = (await split.boundingBox())!;
await p.mouse.move(sb.x + 3, sb.y + 200);
await p.mouse.down();
await p.mouse.move(sb.x - 200, sb.y + 200, { steps: 12 });
await p.mouse.up();
const cols = await p
  .locator(".task-people")
  .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);
expect(cols).toBe(3);
await p.screenshot({
  path: "artifacts/ui-polish-details-wide.png",
  fullPage: true,
});
await p
  .locator(".context-tabs")
  .getByRole("button", { name: /Blockers/ })
  .click();
await expect(
  p.getByRole("button", { name: "Reply to blocker", exact: true }),
).toBeVisible();
const notices = await (
  await ctx.request.get("http://127.0.0.1:4310/api/v1/followups")
).json();
await expect(p.locator(".notification-button")).toHaveClass(/has-pending/);
await p
  .getByRole("button", { name: "Action inbox", exact: true })
  .first()
  .click();
expect(
  await (
    await ctx.request.get("http://127.0.0.1:4310/api/v1/followups")
  ).json(),
).toEqual(notices);
await p.goto(fixture.reviewing.url);
await p
  .locator(".context-tabs")
  .getByRole("button", { name: /Submissions/ })
  .click();
await expect(
  p.getByRole("button", { name: "Accept result", exact: true }),
).toBeVisible();
await expect(
  p.getByRole("button", { name: "Return result", exact: true }),
).toBeVisible();
await p.getByLabel("Project", { exact: true }).selectOption(fixture.project.id);
await p
  .getByRole("button", { name: fixture.project.name, exact: true })
  .click();
await p.getByRole("button", { name: "New task", exact: true }).click();
const d = p.getByRole("dialog");
const title = "[验收示例] Date and project persistence " + Date.now();
await d.getByLabel("Title", { exact: true }).fill(title);
await d
  .getByLabel("Owner", { exact: true })
  .selectOption({ label: "Test Member" });
await d
  .getByLabel("Delivery deadline", { exact: true })
  .fill("2026-02-30 10:00");
expect(
  await d
    .getByLabel("Delivery deadline", { exact: true })
    .evaluate((e) => (e as HTMLInputElement).checkValidity()),
).toBe(false);
await d
  .getByLabel("Delivery deadline", { exact: true })
  .fill("2026-12-01 10:35");
await d.getByLabel("Language", { exact: true }).selectOption("zh");
await expect(d.getByLabel("交付期限", { exact: true })).toHaveValue(
  "2026-12-01 10:35",
);
await d.getByLabel("语言", { exact: true }).selectOption("en");
const response = p.waitForResponse(
  (r) => r.url().endsWith("/api/v1/tasks") && r.request().method() === "POST",
);
await d.getByRole("button", { name: "Submit", exact: true }).click();
const created = await (await response).json();
expect(created.projectId).toBe(fixture.project.id);
expect(created.reviewerId).toBe(fixture.project.managerId);
expect(created.deadline).toBe("2026-12-01T02:35:00.000Z");
await p.goto("http://127.0.0.1:4310/?task=" + created.id);
await expect(p.locator(".checklist-card progress")).toHaveCount(0);
await p
  .locator(".context-tabs")
  .getByRole("button", { name: /Relations/ })
  .click();
await expect(p.locator(".context-card")).toContainText(
  "No task connections yet.",
);
await p.setViewportSize({ width: 390, height: 844 });
await p.locator(".detail-scroll").evaluate((e) => {
  e.scrollTop = 0;
});
await p.screenshot({
  path: "artifacts/ui-polish-details-mobile-en.png",
  fullPage: true,
});
expect(
  await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
).toBe(true);
await p.getByLabel("Language", { exact: true }).selectOption("zh");
await p.screenshot({
  path: "artifacts/ui-polish-details-mobile-zh.png",
  fullPage: true,
});
const session = await ctx.storageState();
const reopened = await browser.newContext({
  storageState: session,
  viewport: { width: 1440, height: 1000 },
});
const next = await reopened.newPage();
await next.goto(fixture.working.url);
await next.locator(".checklist-card").waitFor();
expect(
  (
    await (
      await reopened.request.get("http://127.0.0.1:4310/api/v1/projects")
    ).json()
  ).find((x: any) => x.id === fixture.project.id).color,
).toBe("#5e91ad");
await writeFile(
  "artifacts/ui-polish-details.json",
  JSON.stringify(
    {
      result: "passed",
      wideColumns: cols,
      notificationsUnchanged: true,
      helperAndReviewControls: true,
      invalidDateRejected: true,
      dateInstant: created.deadline,
      projectContextSaved: true,
      emptyChecklist: true,
      emptyRelations: true,
      reopenedColor: true,
      draft: created.id,
    },
    null,
    2,
  ),
);
await browser.close();
