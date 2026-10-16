// Run against a built local app seeded with disposable acceptance accounts:
// CHECKLIST_FORM_URL=http://127.0.0.1:4327 node --import tsx scripts/checklist-form-check.ts
import { chromium, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
const base = process.env.CHECKLIST_FORM_URL ?? "http://127.0.0.1:4327";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Use a local disposable acceptance server only.");
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const leader = await browser.newContext();
  const member = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  async function login(context: BrowserContext, username: string) {
    const response = await context.request.post(base + "/api/v1/sessions", {
      data: { username, password: "OpenTask-Test-2026!" },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }
  const l = await login(leader, "leader"),
    m = await login(member, "member");
  async function post(
    context: BrowserContext,
    csrf: string,
    path: string,
    data: unknown,
  ) {
    const response = await context.request.post(base + "/api/v1" + path, {
      headers: { "x-csrf-token": csrf, "idempotency-key": randomUUID() },
      data,
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  }
  const future = new Date(Date.now() + 86400000).toISOString();
  let task = await post(leader, l.csrf, "/tasks", {
    title: "[Checklist form acceptance] " + randomUUID().slice(0, 8),
    ownerId: m.user.id,
    reviewerId: l.user.id,
    projectId: null,
    outcome: "Verify form editing",
    scope: "Disposable test",
    criteria: "Checks pass",
    deadline: future,
    acceptBy: future,
    feedbackBy: future,
  });
  task = await post(leader, l.csrf, `/tasks/${task.id}/actions/issue`, {
    version: task.version,
  });
  task = await post(member, m.csrf, `/tasks/${task.id}/actions/acceptStart`, {
    version: task.version,
  });
  const page = await member.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/?task=" + task.id);
  await page
    .getByRole("button", { name: "Request checklist change", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const items = dialog.getByLabel("Checklist items (one per line)", {
    exact: true,
  });
  await expect(items).toHaveAttribute("rows", "10");
  await expect(dialog.getByLabel("Reason (optional)")).toHaveAttribute(
    "rows",
    "5",
  );
  await items.fill("Confirm requirements\nVerify delivery");
  const scope = dialog.getByRole("checkbox");
  await dialog.getByLabel("Reason (optional)").fill("Preserved explanation");
  await scope.check();
  await expect(dialog.getByLabel("Reason (required)")).toHaveValue(
    "Preserved explanation",
  );
  await scope.uncheck();
  await expect(dialog.getByLabel("Reason (optional)")).toHaveValue(
    "Preserved explanation",
  );
  await scope.check();
  await dialog.getByLabel("Reason (required)").fill("  \n ");
  await dialog.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "A reason or explanation is required.",
  );
  await scope.uncheck();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByLabel("Reason (optional)").fill("");
  const before = (await dialog.boundingBox())!;
  expect(before.width).toBe(760);
  const textWidth = (await items.boundingBox())!.width;
  await page.mouse.move(
    before.x + before.width - 3,
    before.y + before.height - 3,
  );
  await page.mouse.down();
  await page.mouse.move(
    before.x + before.width + 157,
    before.y + before.height + 77,
    { steps: 12 },
  );
  await page.mouse.up();
  const after = (await dialog.boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width + 80);
  expect(after.height).toBeGreaterThan(before.height + 30);
  expect((await items.boundingBox())!.width).toBeGreaterThan(textWidth + 80);
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/checklist-form-desktop.png" });
  await dialog.getByLabel("Language", { exact: true }).selectOption("zh");
  await expect(dialog.getByLabel("原因（选填）")).toBeVisible();
  await scope.check();
  await expect(dialog.getByLabel("原因（必填）")).toBeVisible();
  await scope.uncheck();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = (await dialog.boundingBox())!;
  expect(mobile.x).toBeGreaterThanOrEqual(0);
  expect(mobile.x + mobile.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const submit = dialog.getByRole("button", { name: "提交", exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "关闭", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "artifacts/checklist-form-mobile.png" });
  await page.setViewportSize({ width: 320, height: 568 });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  const narrow = (await dialog.boundingBox())!;
  expect(narrow.x).toBeGreaterThanOrEqual(0);
  expect(narrow.x + narrow.width).toBeLessThanOrEqual(320);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await submit.click();
  await expect(dialog).toBeHidden();
  const result = await member.request.get(base + `/api/v1/tasks/${task.id}`);
  expect((await result.json()).task.checklistRequests.at(-1).reason).toBe("");
  expect(errors).toEqual([]);
  console.log(
    "PASS: optional reason persisted; whitespace blocked; text preserved across toggles; bilingual labels; native horizontal/vertical resize; responsive mobile with reachable controls; no browser errors.",
  );
} finally {
  await browser.close();
}
