import { chromium, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

if (!process.env.DATABASE_URL?.endsWith("/open_task_test"))
  throw new Error("Use isolated open_task_test only");
const base = process.env.RELATED_TEST_URL ?? "http://127.0.0.1:4319";
const output = "artifacts/related-filter";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
  env: { ...process.env, XDG_CONFIG_HOME: "/tmp/open-task-related-browser" },
});
const contexts: BrowserContext[] = [];
const errors: string[] = [];
const checks: string[] = [];
async function session(username: string) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(ctx);
  const login = await ctx.request.post(base + "/api/v1/sessions", {
    data: { username, password: "OpenTask-Test-2026!" },
  });
  expect(login.status()).toBe(200);
  const { csrf, user } = await login.json();
  async function mutate(path: string, data: unknown, method = "POST") {
    const r = await ctx.request.fetch(base + "/api/v1" + path, {
      method,
      data,
      headers: { "X-CSRF-Token": csrf, "Idempotency-Key": randomUUID() },
    });
    expect(r.status(), await r.text()).toBe(200);
    return r.json();
  }
  return { ctx, user, mutate };
}
try {
  const leader = await session("leader"),
    member = await session("member");
  const users = await (
    await leader.ctx.request.get(base + "/api/v1/users")
  ).json();
  const other = users.find((u: any) => u.username === "other");
  const project = await leader.mutate("/projects", {
    name: "Personal task focus " + randomUUID().slice(0, 6),
    managerId: leader.user.id,
    memberIds: [member.user.id, other.id],
  });
  const fields = {
    outcome: "Deliver a reviewable result",
    scope: "Relationship filter browser fixture",
    criteria: "Verify responsibilities",
    projectId: project.id,
    plannedStart: "2026-10-01T00:00:00+08:00",
    deadline: "2027-01-01T00:00:00+08:00",
    acceptBy: "2027-01-01T00:00:00+08:00",
    feedbackBy: "2027-01-02T00:00:00+08:00",
    reviewerId: leader.user.id,
    reviewBy: "",
  };
  async function issued(title: string, ownerId: string) {
    const t = await leader.mutate("/tasks", { ...fields, title, ownerId });
    return leader.mutate(`/tasks/${t.id}/actions/issue`, {
      version: t.version,
    });
  }
  const parent = await issued("Coordinate release readiness", other.id);
  const owned = await issued("Prepare delivery evidence", member.user.id);
  await leader.mutate(`/tasks/${owned.id}/relations`, {
    version: owned.version,
    kind: "parent",
    targetId: parent.id,
    reason: "Release workstream",
  });
  await member.mutate("/tasks", {
    ...fields,
    title: "Draft next iteration plan",
    ownerId: member.user.id,
  });
  await issued("Review operational handover", other.id);
  // A published proposal also belongs to the member through its creator relationship.
  const proposal = await member.mutate("/tasks", {
    ...fields,
    title: "Propose deployment checklist",
    ownerId: other.id,
  });
  await member.mutate(`/tasks/${proposal.id}/actions/submitApproval`, {
    version: proposal.version,
  });
  await member.mutate(
    "/time-preferences",
    {
      scope: "global",
      filter: {
        mode: "all",
        start: "",
        end: "",
        includeEarlier: false,
        includeUnscheduled: false,
      },
    },
    "PUT",
  );
  const page = await member.ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(base);
  await page.getByLabel("Project", { exact: true }).selectOption(project.id);
  const count = page.locator(".filters > small");
  await expect(count).toHaveText("5 · Matching tasks");
  await page.getByRole("button", { name: "By member", exact: true }).click();
  await expect(count).toHaveText("3 · Matching tasks");
  await page.locator(".related-filter summary").click();
  await expect(page.locator(".related-filter input:checked")).toHaveCount(3);
  await page.getByLabel("Created or issued", { exact: true }).uncheck();
  await page.getByLabel("Approval or review", { exact: true }).uncheck();
  await expect(count).toHaveText("2 · Matching tasks");
  await expect(page.locator(".related-filter summary")).toHaveText(
    "Me · Owned",
  );
  await expect(page.locator(".task-row.context-task")).toContainText(
    parent.title,
  );
  await expect(page.locator(".gantt [data-task-row]")).toHaveCount(3);
  checks.push(
    "default scopes, OR union, deduplication, owned selection, ancestor context and Gantt synchronization",
  );
  await page.locator(".task-row").filter({ hasText: owned.title }).click();
  await page.getByLabel("Owned", { exact: true }).uncheck();
  await expect(count).toHaveText("0 · Matching tasks");
  await expect(page.locator(".task-row")).toHaveCount(0);
  await expect(page.locator(".gantt [data-task-row]")).toHaveCount(0);
  await expect(
    page.getByText(
      "This task is outside the current results. Its details and history remain available.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "All tasks", exact: true }).click();
  await expect(count).toHaveText("5 · Matching tasks");
  await page.getByRole("button", { name: "By member", exact: true }).click();
  await expect(count).toHaveText("0 · Matching tasks");
  checks.push(
    "empty selection, explicit All tasks exit, retained selection and out-of-filter details",
  );
  await page.locator(".related-filter summary").click();
  await page.getByLabel("Created or issued", { exact: true }).check();
  await expect(count).toHaveText("2 · Matching tasks");
  await page
    .getByRole("button", { name: "Open task graph", exact: true })
    .click();
  await expect(page.locator(".graph-host .node")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Open team updates", exact: true })
    .click();
  await expect(page.locator(".workspace .scroll")).toContainText(
    "Propose deployment checklist",
  );
  await expect(page.locator(".workspace .scroll")).not.toContainText(
    owned.title,
  );
  checks.push(
    "created/issued scope, graph and aggregate history synchronization",
  );
  await page
    .getByRole("button", { name: "Open Gantt chart", exact: true })
    .click();
  await page.getByLabel("Owned", { exact: true }).check();
  await expect(count).toHaveText("3 · Matching tasks");
  await page
    .getByLabel("Search title or task number", { exact: true })
    .fill("Prepare delivery");
  await expect(count).toHaveText("1 · Matching tasks");
  await page.getByLabel("Stage", { exact: true }).selectOption("done");
  await expect(count).toHaveText("0 · Matching tasks");
  await page.getByLabel("Stage", { exact: true }).selectOption("");
  await page
    .getByLabel("Search title or task number", { exact: true })
    .fill("");
  await expect(count).toHaveText("3 · Matching tasks");
  checks.push("project, search and stage composition");
  await page.locator(".related-filter summary").focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".related-filter details")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Owned", { exact: true })).toBeVisible();
  await page.getByLabel("Owned", { exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(count).toHaveText("2 · Matching tasks");
  await page.keyboard.press("Space");
  await expect(count).toHaveText("3 · Matching tasks");
  checks.push("keyboard disclosure and checkbox interaction");
  expect(
    await page
      .locator(".related-filter fieldset label")
      .first()
      .evaluate((el) => getComputedStyle(el).flexDirection),
  ).toBe("row");
  // Switching members keeps scopes and all existing filters, across every linked view.
  await page
    .getByLabel("Related member", { exact: true })
    .selectOption(other.id);
  await expect(count).toHaveText("3 · Matching tasks");
  await expect(page.locator(".related-filter summary")).toContainText(
    other.name,
  );
  await expect(page.locator(".gantt [data-task-row]")).toHaveCount(3);
  await expect(
    page.locator(".task-row").filter({ hasText: owned.title }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open task graph", exact: true })
    .click();
  await expect(page.locator(".graph-host .node")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Open team updates", exact: true })
    .click();
  await expect(page.locator(".workspace .scroll")).toContainText(
    "Review operational handover",
  );
  await expect(page.locator(".workspace .scroll")).not.toContainText(
    owned.title,
  );
  await page.getByRole("button", { name: "All tasks", exact: true }).click();
  await expect(count).toHaveText("5 · Matching tasks");
  await page.getByRole("button", { name: "By member", exact: true }).click();
  await expect(page.getByLabel("Related member", { exact: true })).toHaveValue(
    other.id,
  );
  await expect(count).toHaveText("3 · Matching tasks");
  await page
    .getByRole("button", { name: "Open Gantt chart", exact: true })
    .click();
  await page.locator(".related-filter summary").click();
  checks.push(
    "other-member selection, retained member/scopes and synchronized Gantt/graph/activity",
  );
  await page.screenshot({ path: output + "/related-en.png", fullPage: true });
  await page.getByLabel("Language", { exact: true }).selectOption("zh");
  await expect(
    page.getByRole("button", { name: "按成员", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("负责的", { exact: true })).toBeChecked();
  await page.screenshot({ path: output + "/related-zh.png", fullPage: true });
  await page.getByRole("button", { name: "切换主题", exact: true }).click();
  await page.screenshot({ path: output + "/related-dark.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "任务树", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "按成员", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: output + "/related-mobile.png",
    fullPage: true,
  });
  checks.push(
    "English/Chinese, light/dark and 390px mobile without page overflow",
  );
  expect(errors).toEqual([]);
  await writeFile(
    output + "/result.json",
    JSON.stringify({ checks, errors, projectId: project.id }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors, output }, null, 2));
} finally {
  await Promise.all(contexts.map((ctx) => ctx.close()));
  await browser.close();
}
