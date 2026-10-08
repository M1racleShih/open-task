import {
  chromium,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
if (!process.env.DATABASE_URL?.endsWith("/open_task_test"))
  throw new Error("Use isolated open_task_test only");
const base = process.env.TIME_TEST_URL ?? "http://127.0.0.1:4316";
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
  env: { ...process.env, XDG_CONFIG_HOME: "/tmp/open-task-browser-config" },
});
const contexts: BrowserContext[] = [];
const errors: string[] = [];
const prefix = "Time browser " + randomUUID().slice(0, 8);
const checks: string[] = [];
const output = "artifacts/time-filter";
await mkdir(output, { recursive: true });
async function session(username: string) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "en-US",
  });
  contexts.push(ctx);
  const login = await ctx.request.post(base + "/api/v1/sessions", {
    data: { username, password: "OpenTask-Test-2026!" },
  });
  expect(login.status()).toBe(200);
  const { csrf, user } = await login.json();
  const mutate = async (path: string, data: any, method = "POST") => {
    const response = await ctx.request.fetch(base + "/api/v1" + path, {
      method,
      data,
      headers: { "X-CSRF-Token": csrf, "Idempotency-Key": randomUUID() },
    });
    expect(response.status(), await response.text()).toBe(200);
    return response.json();
  };
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return { ctx, page, mutate, user };
}
async function openFilter(page: Page) {
  const details = page.locator(".time-filter");
  if (!(await details.evaluate((e) => e.hasAttribute("open"))))
    await details.locator("summary").click();
}
async function range(page: Page, start: string, end: string, language = "en") {
  await openFilter(page);
  await page
    .getByLabel(language === "en" ? "Time range" : "时间范围", { exact: true })
    .selectOption("custom");
  await page
    .getByLabel(language === "en" ? "From date" : "开始日期", { exact: true })
    .fill(start);
  await page
    .getByLabel(language === "en" ? "Through date" : "结束日期", {
      exact: true,
    })
    .fill(end);
  await page
    .getByRole("button", {
      name: language === "en" ? "Apply range" : "应用范围",
      exact: true,
    })
    .click();
  await expect(page.locator(".time-filter summary")).toContainText(start);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
try {
  const leader = await session("leader"),
    member = await session("member");
  const identities = await (
    await leader.ctx.request.get(base + "/api/v1/users")
  ).json();
  const owner = identities.find((u: any) => u.username === "member").id;
  const global = {
    mode: "all",
    start: "",
    end: "",
    includeUnscheduled: false,
    includeEarlier: false,
  };
  await leader.mutate(
    "/time-preferences",
    { scope: "global", filter: global },
    "PUT",
  );
  await member.mutate(
    "/time-preferences",
    { scope: "global", filter: global },
    "PUT",
  );
  const a = await leader.mutate("/projects", {
    name: prefix + " A",
    managerId: leader.user.id,
    memberIds: [owner],
  });
  const b = await leader.mutate("/projects", {
    name: prefix + " B",
    managerId: leader.user.id,
    memberIds: [owner],
  });
  const common = {
    outcome: "Review schedule",
    scope: "Browser fixture",
    criteria: "Verify behavior",
    ownerId: owner,
    reviewerId: leader.user.id,
    acceptBy: "2027-01-01T00:00:00Z",
    feedbackBy: "2027-01-02T00:00:00Z",
    reviewBy: "",
  };
  async function issued(
    title: string,
    projectId: string,
    plannedStart: string,
    deadline: string,
  ) {
    let task = await leader.mutate("/tasks", {
      ...common,
      title: prefix + " " + title,
      projectId,
      plannedStart,
      deadline,
    });
    task = await leader.mutate(`/tasks/${task.id}/actions/issue`, {
      version: task.version,
    });
    return task;
  }
  const parent = await issued(
    "Ancestor",
    b.id,
    "",
    "2026-09-10T12:00:00+08:00",
  );
  const cross = await issued(
    "Cross month",
    a.id,
    "2026-09-20T00:00:00+08:00",
    "2026-10-10T12:00:00+08:00",
  );
  const october = await issued(
    "October",
    a.id,
    "",
    "2026-10-31T23:59:59+08:00",
  );
  const september = await issued(
    "September",
    a.id,
    "",
    "2026-09-20T12:00:00+08:00",
  );
  await issued("November", a.id, "", "2026-11-01T00:00:00+08:00");
  await leader.mutate(`/tasks/${cross.id}/relations`, {
    version: cross.version,
    targetId: parent.id,
    kind: "parent",
    reason: "Context",
  });
  await leader.page.goto(base);
  await leader.page
    .getByLabel("Search title or task number", { exact: true })
    .fill(prefix);
  await range(leader.page, "2026-10-01", "2026-10-31");
  await expect(leader.page.locator(".task-row")).toHaveCount(3);
  await expect(leader.page.locator(".filters")).toContainText(
    "2 · Matching tasks",
  );
  await expect(leader.page.locator(".context-task")).toContainText(
    "Ancestor context",
  );
  await expect(leader.page.locator("[data-node-id]")).toHaveCount(3);
  await expect(leader.page.locator("[data-view-source='context']")).toHaveCount(
    1,
  );
  checks.push(
    "Global Shanghai October: cross-month + last-day match; ancestor marked; counts and graph agree",
  );
  await leader.page
    .getByRole("button", { name: "Team updates", exact: true })
    .click();
  await expect(leader.page.locator(".event").first()).toBeVisible();
  const eventText = await leader.page.locator(".event").allTextContents();
  expect(
    eventText.every(
      (text) => text.includes("Cross month") || text.includes("October"),
    ),
  ).toBe(true);
  await leader.page
    .getByRole("button", { name: "Task graph", exact: true })
    .click();
  await leader.page.getByLabel("Project", { exact: true }).selectOption(a.id);
  await expect(leader.page.locator(".time-filter summary")).toContainText(
    "Following global",
  );
  await range(leader.page, "2026-09-01", "2026-09-30");
  await expect(leader.page.locator(".time-filter summary")).toContainText(
    "Custom project time",
  );
  await expect(leader.page.locator(".task-row")).toHaveCount(3); // Cross-month, September, ancestor
  await expect(
    leader.page.locator(".task-row").filter({ hasText: "October" }),
  ).toHaveCount(0);
  await leader.page.getByLabel("Project", { exact: true }).selectOption("");
  await expect(leader.page.locator(".time-filter summary")).toContainText(
    "2026-10-01",
  );
  await range(leader.page, "2026-11-01", "2026-11-30");
  await expect(leader.page.locator(".task-row")).toHaveCount(1);
  await leader.page.getByLabel("Project", { exact: true }).selectOption(a.id);
  await expect(leader.page.locator(".time-filter summary")).toContainText(
    "2026-09-01",
  );
  await openFilter(leader.page);
  await leader.page
    .getByRole("button", { name: "Follow global", exact: true })
    .click();
  await expect(leader.page.locator(".time-filter summary")).toContainText(
    "Following global",
  );
  await expect(leader.page.locator(".time-filter summary")).toContainText(
    "2026-11-01",
  );
  await leader.page.reload();
  await expect(leader.page.locator(".time-filter summary")).toContainText(
    "2026-11-01",
  );
  checks.push(
    "Project override independent of global; cross-project ancestor; restore inheritance; preference survives reload",
  );
  await member.page.goto(base);
  await expect(member.page.locator(".time-filter summary")).toContainText(
    "All time",
  );
  await member.page
    .getByLabel("Search title or task number", { exact: true })
    .fill(prefix);
  await range(member.page, "2026-10-01", "2026-10-31");
  await expect(member.page.locator(".task-row")).toHaveCount(3);
  const notificationCount = await member.page
    .locator(".notification-count")
    .textContent();
  await range(member.page, "2026-12-01", "2026-12-31");
  await expect(member.page.locator(".task-row")).toHaveCount(0);
  expect(await member.page.locator(".notification-count").textContent()).toBe(
    notificationCount,
  );
  await member.page
    .getByRole("button", { name: "Action inbox", exact: true })
    .first()
    .click();
  await expect(member.page.locator("#notification-popover")).toBeVisible();
  await member.page
    .locator("#notification-popover .notice")
    .filter({ hasText: prefix + " October" })
    .click();
  await expect(member.page.locator(".details")).toContainText(
    prefix + " October",
  );
  await expect(member.page.locator(".details")).toContainText(
    "outside the current results",
  );
  await member.page
    .locator(".detail-tabs")
    .getByRole("button", { name: "Activity", exact: true })
    .click();
  await expect(member.page.locator(".details .event")).toHaveCount(2);
  checks.push(
    "Different account starts with its own preference; notices unaffected; out-of-range notice opens detail and full history",
  );
  await member.page
    .getByRole("button", { name: "New task", exact: true })
    .click();
  await expect(
    member.page.getByLabel("Planned start (optional)", { exact: true }),
  ).toHaveValue("");
  await expect(
    member.page.getByLabel("Delivery deadline", { exact: true }),
  ).toHaveValue("");
  const draftTitle = prefix + " New unscheduled";
  await member.page.getByLabel("Title", { exact: true }).fill(draftTitle);
  await member.page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit", exact: true })
    .click();
  await expect(member.page.getByRole("dialog")).toHaveCount(0);
  await expect(member.page.locator(".details")).toContainText(draftTitle);
  await expect(member.page.locator(".details")).toContainText(
    "outside the current results",
  );
  await openFilter(member.page);
  await member.page
    .getByLabel("Include tasks without a deadline", { exact: true })
    .check();
  await member.page
    .getByRole("button", { name: "Apply range", exact: true })
    .click();
  await expect(member.page.locator(".task-row")).toHaveCount(1);
  await member.page
    .getByLabel("Include earlier unfinished tasks", { exact: true })
    .check();
  await member.page
    .getByRole("button", { name: "Apply range", exact: true })
    .click();
  await expect(member.page.locator(".task-row")).toHaveCount(6);
  await expect(
    member.page.locator(".task-row").filter({ hasText: "Earlier unfinished" }),
  ).toHaveCount(5);
  checks.push(
    "Creation leaves both dates empty; saved out-of-range draft stays selected; unscheduled and earlier flags update tree and graph",
  );
  await member.page.getByLabel("Language", { exact: true }).selectOption("zh");
  await expect(member.page.locator(".time-filter summary")).toContainText(
    "全局时间",
  );
  await expect(member.page.locator(".filters")).toContainText("匹配任务");
  await noOverflow(member.page);
  await member.page.screenshot({
    path: output + "/desktop-zh.png",
    fullPage: true,
  });
  await member.page
    .getByRole("button", { name: "切换主题", exact: true })
    .click();
  await member.page.screenshot({
    path: output + "/desktop-dark.png",
    fullPage: true,
  });
  await member.page.setViewportSize({ width: 390, height: 844 });
  await member.page
    .locator(".mobile-tabs")
    .getByRole("button", { name: "任务树", exact: true })
    .click();
  await noOverflow(member.page);
  await expect(
    member.page.getByRole("button", { name: "应用范围", exact: true }),
  ).toBeVisible();
  await member.page.screenshot({
    path: output + "/mobile-zh.png",
    fullPage: true,
  });
  await member.page.getByLabel("语言", { exact: true }).selectOption("en");
  await noOverflow(member.page);
  await member.page.screenshot({
    path: output + "/mobile-en.png",
    fullPage: true,
  });
  checks.push(
    "English/Chinese, light/dark and 390px filter controls usable without page overflow",
  );
  expect(errors).toEqual([]);
  await writeFile(
    output + "/results.json",
    JSON.stringify({ base, prefix, checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  for (const ctx of contexts) await ctx.close();
  await browser.close();
}
