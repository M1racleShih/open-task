/** Reproducible real-component checks. All /api traffic is intercepted; no DB. */
import { chromium, expect, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { lifecycleState } from "../shared/commitment.js";
import type { Event, Task, User } from "../shared/model.js";
import {
  demoTask,
  demoUsers,
  demoProject,
} from "../tests/fixtures/stageFeedback.js";
const base = process.env.STAGE_TEST_URL ?? "http://127.0.0.1:4351";
const output = "artifacts/stage-feedback";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
});
let preview: ViteDevServer | undefined;
const errors: string[] = [];
const checks: string[] = [];
type Gate = { wait: Promise<void>; release: () => void };
function gate(): Gate {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
}
let tasks = [
  demoTask(),
  demoTask({
    id: "mock-other",
    number: 102,
    title: "Demo: verify another task",
  }),
];
let events: Event[] = [];
let account: User | null = demoUsers[0];
let actionError = "";
let readError = false;
let historyError = false;
let actionGate: Gate | null = null;
let historyGate: Gate | null = null;
let detailGate: Gate | null = null;
let actionRequests = 0;
let detailRequests = 0;
let eventRequests = 0;
function mutate(
  patch: Partial<Task>,
  index = 0,
  actorId = demoUsers[1].id,
  type = "submitResult",
) {
  const before = structuredClone(tasks[index]);
  tasks[index] = {
    ...tasks[index],
    ...patch,
    revision: tasks[index].revision + 1,
    updatedAt: "2030-01-01T00:00:00Z",
  };
  events.unshift({
    id: (events[0]?.id ?? 0) + 1,
    taskId: before.id,
    actorId,
    type,
    version: tasks[index].version,
    before,
    after: structuredClone(tasks[index]),
    note: "Demo change",
    at: "2026-10-16T11:23:00Z",
  });
}
async function prepare(page: Page) {
  page.setDefaultTimeout(10000);
  page.on("dialog", (dialog) => dialog.accept());
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error("PAGE ERROR", error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") console.error("CONSOLE", message.text());
  });
  page.on("requestfailed", (request) =>
    console.error("REQUEST", request.url(), request.failure()?.errorText),
  );
  await page.clock.install();
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    let body: unknown;
    if (path === "/me") body = { user: account, csrf: "mock-csrf" };
    else if (path === "/sessions") {
      if (request.method() === "DELETE") account = null;
      else
        account = demoUsers.find(
          (u) => u.username === request.postDataJSON().username,
        )!;
      body = { user: account, csrf: "mock-csrf" };
    } else if (path === "/time-preferences")
      body = {
        global: {
          mode: "all",
          start: "",
          end: "",
          includeEarlier: false,
          includeUnscheduled: false,
        },
        projects: {},
      };
    else if (path === "/users")
      body = [
        {
          id: "mock-inactive-leader",
          username: "aardvark",
          name: "Inactive leader (demo)",
          roles: ["leader"],
          active: false,
        },
        ...demoUsers,
      ];
    else if (path === "/projects") body = [demoProject];
    else if (path === "/tasks") {
      const items = tasks.filter(
        (task) =>
          (!url.searchParams.get("stage") ||
            task.stage === url.searchParams.get("stage")) &&
          (!url.searchParams.get("search") ||
            task.title
              .toLowerCase()
              .includes(url.searchParams.get("search")!.toLowerCase())),
      );
      body = {
        items,
        context: [],
        nextCursor: null,
        total: items.length,
        counts: {
          [demoProject.id]: {
            total: items.length,
            done: 0,
            reviewing: 0,
            blocked: 0,
          },
        },
      };
    } else if (path.includes("/actions/")) {
      actionRequests++;
      const action = path.split("/").at(-1)!;
      const pending = actionGate;
      if (pending) await pending.wait;
      if (actionError) {
        await route.fulfill({
          status: 409,
          json: { error: { code: actionError } },
        });
        return;
      }
      const index = tasks.findIndex((task) => path.includes(task.id + "/"));
      const patch: Partial<Task> =
        action === "issue"
          ? { stage: "pending" }
          : action === "accept"
            ? { stage: "accepted" }
            : action === "start"
              ? { stage: "working" }
              : action === "submitResult"
                ? {
                    stage: "reviewing",
                    submissions: [
                      {
                        id: "submission",
                        version: tasks[index].version,
                        text: "Demo result",
                        links: [],
                        at: "2026-10-16T11:23:00Z",
                        status: "pending",
                      },
                    ],
                  }
                : action === "pass"
                  ? { stage: "done" }
                  : action === "returnResult"
                    ? { stage: "working" }
                    : action === "approve"
                      ? { stage: "approval", approvalIndex: 1 }
                      : action === "refuse"
                        ? { refused: "Demo unavailable" }
                        : action === "acceptStart"
                          ? { stage: "working" }
                          : action === "cancel"
                            ? { stage: "cancelled" }
                            : {};
      mutate(patch, index, account!.id, action);
      body = tasks[index];
    } else if (path.startsWith("/tasks/")) {
      detailRequests++;
      const task = structuredClone(
        tasks.find((task) => path.endsWith(task.id))!,
      );
      const pending = detailGate;
      if (pending) await pending.wait;
      if (readError) {
        await route.fulfill({
          status: 503,
          json: { error: { code: "serverError" } },
        });
        return;
      }
      body = { task, relations: [], targets: [] };
    } else if (path === "/events") {
      eventRequests++;
      const pending = historyGate;
      const selected = url.searchParams.get("taskId");
      if (selected && pending) await pending.wait;
      if (selected && historyError) {
        await route.fulfill({
          status: 503,
          json: { error: { code: "serverError" } },
        });
        return;
      }
      const matching = events.filter(
        (event) =>
          (!selected || event.taskId === selected) &&
          (!url.searchParams.get("cursor") ||
            event.id < Number(url.searchParams.get("cursor"))),
      );
      const limit = Number(url.searchParams.get("limit") ?? 100);
      body = {
        items: matching.slice(0, limit),
        nextCursor: matching.length > limit ? matching[limit - 1].id : null,
      };
    } else if (["/followups", "/relations"].includes(path))
      body = { items: [], nextCursor: null };
    else
      throw new Error("Unexpected mock API: " + request.method() + " " + path);
    await route.fulfill({ json: body });
  });
}
const notice = (page: Page) => page.locator(".stage-notice");
const visibleNotice = (page: Page) => page.locator(".stage-announcement");
async function refresh(page: Page) {
  const count = detailRequests;
  await page
    .getByRole("button", { name: /^(Refresh|刷新)$/, exact: true })
    .click();
  await expect.poll(() => detailRequests).toBeGreaterThan(count);
}
async function poll(page: Page) {
  const count = detailRequests;
  await page.clock.runFor(15010);
  await expect.poll(() => detailRequests).toBeGreaterThan(count);
}
async function open(page: Page) {
  await page.goto(base + "/?task=" + tasks[0].id);
  try {
    await expect(page.locator(".details h1")).toHaveText(tasks[0].title);
  } catch (error) {
    console.error(await page.locator("body").innerText());
    await page.screenshot({ path: output + "/failure.png", fullPage: true });
    throw error;
  }
}
async function submit(page: Page, action: string) {
  await page.getByRole("button", { name: action, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const text = page.getByRole("dialog").locator("textarea").first();
  if (await text.count()) await text.fill("Synthetic reviewable result");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit", exact: true })
    .click();
}
async function stateIcon(page: Page) {
  const icon = page.locator(".task-meta .task-state-icon");
  const phase = lifecycleState(tasks[0]);
  await expect(icon).toHaveAttribute("data-lifecycle", phase);
  const colors = await icon.evaluate((element, phase) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--life-${phase})`;
    element.append(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      expected,
      radius: style.borderRadius,
      badgeBackground: getComputedStyle(element.closest(".status")!)
        .backgroundColor,
      handlerShadow: getComputedStyle(document.querySelector(".meta-waiting")!)
        .boxShadow,
    };
  }, phase);
  expect(colors.background).toBe(colors.expected);
  expect(colors.radius).toBe("50%");
  expect(colors.badgeBackground).toBe("rgba(0, 0, 0, 0)");
  expect(colors.handlerShadow).toBe("none");
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const rect = await notice(page).boundingBox();
  expect(rect!.y).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(
    (await page.viewportSize())!.width,
  );
}
try {
  if (!process.env.STAGE_TEST_URL) {
    preview = await createServer({
      configFile: false,
      root: fileURLToPath(new URL("../web", import.meta.url)),
      plugins: [react()],
      server: { host: "127.0.0.1", port: 4351, strictPort: true },
    });
    await preview.listen();
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await prepare(page);
  await open(page);
  await poll(page);
  await expect(notice(page)).toHaveCount(0);
  await expect(page.locator(".stage-live")).toHaveText("");
  await stateIcon(page);
  const liveRegion = await page.locator(".stage-live").elementHandle();
  checks.push("Initial load and unchanged 15-second poll stay quiet");

  // Local failure cannot produce a receipt or close the form.
  actionError = "versionConflict";
  await submit(page, "Submit result");
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("dialog").locator("textarea").first(),
  ).toHaveValue("Synthetic reviewable result");
  await expect(notice(page)).toHaveCount(0);
  await expect(page.locator(".task-meta .status")).toHaveText("In progress");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  actionError = "";
  checks.push(
    "Version conflict keeps action form and entered values; no success receipt",
  );

  // A successful action is immediately applied even if the following GET fails.
  readError = true;
  await submit(page, "Submit result");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(visibleNotice(page)).toContainText("Result submitted");
  await expect(visibleNotice(page)).toContainText("Awaiting review");
  await expect(visibleNotice(page)).toContainText("Alex (demo)");
  await expect(page.locator(".task-meta .status")).toHaveText(
    "Awaiting review",
  );
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Confirmed actions remain saved",
  );
  await expect(
    page.getByRole("button", { name: "Accept result", exact: true }),
  ).toBeVisible();
  expect(
    await liveRegion!.evaluate(
      (element) => element === document.querySelector(".stage-live"),
    ),
  ).toBe(true);
  readError = false;
  await refresh(page);
  await expect(visibleNotice(page)).toContainText("Result submitted");
  await page
    .getByRole("button", { name: "Close stage feedback", exact: true })
    .click();
  await poll(page);
  await expect(notice(page)).toHaveCount(0);
  checks.push(
    "Confirmed Task applied before failed refresh; receipt retained, then dismissal and own poll deduplicate",
  );

  await submit(page, "Accept result");
  await expect(visibleNotice(page)).toContainText("Review passed");
  await expect(visibleNotice(page)).toContainText("Closed; no next handler");
  await expect(page.locator(".meta-waiting dd")).toHaveText("—");
  await stateIcon(page);
  checks.push("Review completion receipt has no execution handler");

  // Reset by navigation gives a fresh baseline, then external transition and draft preservation.
  tasks[0] = demoTask();
  events = [];
  await open(page);
  await page.getByLabel("Stage", { exact: true }).selectOption("working");
  await page.getByRole("checkbox", { name: /^Check the demo note/ }).check();
  await page.getByLabel("Search title or task number", { exact: true }).focus();
  await page.evaluate(() => {
    const target = document.querySelector(".stage-live")!;
    const updates: string[] = [];
    (window as unknown as { stageAnnouncements: string[] }).stageAnnouncements =
      updates;
    new MutationObserver(() => updates.push(target.textContent ?? "")).observe(
      target,
      { childList: true, subtree: true, characterData: true },
    );
  });
  mutate({ stage: "reviewing" });
  await poll(page);
  await expect(visibleNotice(page)).toContainText("Task stage changed");
  await expect(notice(page).locator(".stage-event")).toContainText(
    "Sam (demo)",
  );
  await expect(notice(page).locator("time")).toHaveAttribute(
    "datetime",
    "2026-10-16T11:23:00Z",
  );
  await expect(visibleNotice(page)).toContainText(
    "Removed from current results",
  );
  await expect(page.locator(".details h1")).toHaveText(tasks[0].title);
  await expect(page.getByLabel("Stage", { exact: true })).toHaveValue(
    "working",
  );
  await expect(
    page.getByRole("checkbox", { name: /^Check the demo note/ }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Search title or task number", { exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: output + "/desktop-remote-filter-draft.png",
    fullPage: true,
  });
  checks.push(
    "Remote poll uses real event actor/time, explains filter removal, preserves details, draft, filter and keyboard focus",
  );
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { stageAnnouncements: string[] })
          .stageAnnouncements.length,
    ),
  ).toBe(1);
  const liveText = await page.locator(".stage-live").textContent();
  await poll(page);
  expect(await page.locator(".stage-live").textContent()).toBe(liveText);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { stageAnnouncements: string[] })
          .stageAnnouncements.length,
    ),
  ).toBe(1);
  checks.push(
    "Stable initially-empty live region survives receipts; metadata completion and unchanged polls cause no additional live text mutations",
  );
  await page
    .getByRole("button", { name: "Close stage feedback", exact: true })
    .click();
  await poll(page);
  await expect(notice(page)).toHaveCount(0);

  // Already outside this stage filter: no claim that it was just removed.
  mutate({ stage: "done" });
  await poll(page);
  await expect(visibleNotice(page)).toContainText("Task stage changed");
  await expect(visibleNotice(page)).not.toContainText(
    "Removed from current results",
  );
  checks.push(
    "Already excluded task never claims newly removed; unchanged polls do not announce again",
  );

  tasks[0] = demoTask();
  events = [];
  await open(page);
  mutate({ stage: "reviewing" });
  await poll(page);
  await expect(visibleNotice(page)).not.toContainText(
    "Removed from current results",
  );
  await page.getByLabel("Stage", { exact: true }).selectOption("working");
  await expect(page.locator(".details .warning[role=status]")).toContainText(
    "Outside current results",
  );
  await expect(visibleNotice(page)).not.toContainText(
    "Removed from current results",
  );
  checks.push(
    "Changing a filter after a transition cannot retroactively claim stage-caused removal",
  );

  // Preserve the history pagination boundary; deeper events degrade honestly.
  await page.goto(base + "/?task=" + tasks[0].id);
  await expect(page.locator(".details h1")).toHaveText(tasks[0].title);
  mutate({ stage: "working" });
  for (let i = 0; i < 210; i++) mutate({}, 0, demoUsers[2].id, "comment");
  await poll(page);
  await expect(notice(page).locator(".stage-event")).toContainText(
    "not verified",
  );
  await expect(notice(page).locator("time")).toHaveCount(0);
  checks.push(
    "Transition beyond 200 later comments degrades honestly without automatically loading all history or using updatedAt",
  );

  // Metadata unavailable; later changes only present latest verified event.
  historyError = true;
  mutate({ stage: "reviewing" });
  await poll(page);
  await expect(notice(page).locator(".stage-event")).toContainText(
    "not verified",
  );
  await expect(notice(page).locator("time")).toHaveCount(0);
  historyError = false;
  historyGate = gate();
  mutate({ stage: "working" });
  await refresh(page);
  await expect(visibleNotice(page)).toContainText("In progress");
  mutate({ stage: "cancelled" }, 0, demoUsers[2].id, "cancel");
  const delayedHistory = historyGate;
  historyGate = null;
  await refresh(page);
  await expect(visibleNotice(page)).toContainText("Cancelled");
  await expect(notice(page).locator(".stage-event")).toContainText(
    "Jules (demo)",
  );
  delayedHistory.release();
  await expect(visibleNotice(page)).toContainText("Cancelled");
  await expect(notice(page).locator(".stage-event")).toContainText(
    "Jules (demo)",
  );
  checks.push(
    "Missing history degrades honestly; slow older history cannot replace newer transition metadata",
  );

  // Select another task while a task read is in flight.
  detailGate = gate();
  const oldRead = detailGate;
  await refresh(page);
  await page
    .getByRole("button", { name: /OT-102/ })
    .first()
    .click();
  detailGate = null;
  oldRead.release();
  await expect(page.locator(".details h1")).toHaveText(tasks[1].title);
  await expect(notice(page)).toHaveCount(0);
  checks.push("Task selection invalidates slow former-task data and feedback");

  // Slow POST: close the form, switch tasks, then acknowledge. Old action must not select its task again.
  tasks[0] = demoTask();
  await open(page);
  actionGate = gate();
  const oldAction = actionGate;
  await submit(page, "Submit result");
  await expect.poll(() => actionRequests).toBeGreaterThan(3);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("button", { name: /OT-102/ })
    .first()
    .click();
  await expect(page.locator(".details h1")).toHaveText(tasks[1].title);
  actionGate = null;
  oldAction.release();
  await poll(page);
  await expect(page.locator(".details h1")).toHaveText(tasks[1].title);
  await expect(notice(page)).toHaveCount(0);
  checks.push(
    "Slow successful action cannot change another selected task, reopen a form or show its receipt there",
  );

  for (const [initial, action, headline, target] of [
    ["draft", "Issue task", "Task issued", "pending"],
    ["pending", "Accept task", "Task accepted", "accepted"],
    ["pending", "Accept and start", "Task accepted and started", "working"],
    ["accepted", "Start work", "Work started", "working"],
    ["reviewing", "Return result", "Result returned", "working"],
    ["working", "Cancel task", "Task cancelled", "cancelled"],
  ] as const) {
    tasks[0] = demoTask({ stage: initial });
    events = [];
    await open(page);
    await stateIcon(page);
    await submit(page, action);
    await expect(visibleNotice(page)).toContainText(headline);
    await stateIcon(page);
    await expect(page.locator(".task-meta .status")).toHaveClass(
      new RegExp(target),
    );
    await expect(visibleNotice(page)).toContainText(
      target === "cancelled" ? "Closed; no next handler" : "Alex (demo)",
    );
  }
  checks.push(
    "Issue, accept, accept-and-start, start, return-result and cancel each have specific business receipts and correct next responses",
  );

  // Same-stage special receipts.
  tasks[0] = demoTask({ stage: "approval" });
  events = [];
  await open(page);
  await submit(page, "Approve creation");
  await expect(visibleNotice(page)).toContainText("This approval step passed");
  await expect(visibleNotice(page)).toContainText("Jules (demo)");
  await expect(visibleNotice(page).locator(".status")).toHaveCount(1);
  tasks[0] = demoTask({ stage: "pending" });
  await open(page);
  await submit(page, "Unable to accept");
  await expect(visibleNotice(page)).toContainText("issuer to follow up");
  await expect(visibleNotice(page).locator(".status")).toHaveCount(1);
  checks.push(
    "Multilevel approval and refusal receipts identify next responsibility without same-stage arrows",
  );

  mutate({ ownerId: demoUsers[2].id, version: 2, refused: null });
  await poll(page);
  await expect(notice(page)).toHaveCount(0);
  await expect(page.locator(".meta-waiting dd")).toHaveText("Jules (demo)");
  checks.push(
    "Same-stage reassignment quietly closes stale receipt; current next handler follows live responseFacts",
  );

  // Real account switch invalidates an in-flight read and establishes a new baseline.
  detailGate = gate();
  const accountRead = detailGate;
  await refresh(page);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Switch user", exact: true }).click();
  detailGate = null;
  accountRead.release();
  await page.getByLabel("Username", { exact: true }).fill("sam");
  await page.getByLabel("Password", { exact: true }).fill("mock-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Account", exact: true }),
  ).toContainText("Sam (demo)");
  await expect(notice(page)).toHaveCount(0);
  await page.locator(".tree .task-row").filter({ hasText: "OT-101" }).click();
  await expect(page.locator(".details h1")).toHaveText(tasks[0].title);
  await poll(page);
  await expect(notice(page)).toHaveCount(0);
  checks.push(
    "Account switch and first polling baseline never replay another account's receipt",
  );

  // Both languages/themes/viewports, panels hidden and focused, history reachable with keyboard.
  mutate({
    stage: "working",
    checklistRequests: [
      {
        id: "mock-request",
        baseVersion: 1,
        items: [],
        scopeChanged: false,
        authorId: demoUsers[2].id,
        status: "pending",
        reason: "Demo checklist review",
      },
    ],
  });
  await poll(page);
  await expect(visibleNotice(page)).toContainText("Alex (demo)");
  await expect(visibleNotice(page)).not.toContainText("Inactive leader (demo)");
  checks.push(
    "Pending checklist response resolves the active leader even when an inactive leader sorts first",
  );
  for (const lang of ["en", "zh"]) {
    await page.getByLabel(/Language|语言/, { exact: true }).selectOption(lang);
    for (const theme of ["light", "dark"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: /Switch theme|切换主题/, exact: true })
          .click();
      for (const width of [1440, 820, 390]) {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 1000,
        });
        await expect(notice(page)).toBeVisible();
        await noOverflow(page);
        await stateIcon(page);
        if (width === 1440) {
          await page
            .getByRole("button", {
              name: /Focus details|聚焦详情/,
              exact: true,
            })
            .click();
          await expect(notice(page)).toBeVisible();
          await page.screenshot({
            path: `${output}/focused-${lang}-${theme}.png`,
            fullPage: true,
          });
          await page
            .getByRole("button", {
              name: /Restore layout|恢复布局/,
              exact: true,
            })
            .click();
          await page
            .getByRole("button", {
              name: /Hide center workspace|折叠中间工作区/,
              exact: true,
            })
            .click();
          await expect(notice(page)).toBeVisible();
          await page
            .getByRole("button", {
              name: /Toggle center workspace|开关中间工作区/,
              exact: true,
            })
            .click();
        }
        if (width === 390) {
          for (let i = 0; i < 3; i++) {
            await page.locator(".mobile-tabs button").nth(i).click();
            await expect(notice(page)).toBeVisible();
            await noOverflow(page);
          }
        }
        await page.screenshot({
          path: `${output}/${width}-${lang}-${theme}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "聚焦详情", exact: true }).click();
  await page.getByRole("button", { name: "查看任务动态", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".detail-tabs button[aria-pressed=true]"),
  ).toContainText("动态");
  await expect(
    page.getByRole("button", { name: "恢复布局", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".center")).toBeHidden();
  checks.push("Viewing task activity while focused preserves focus layout");
  await expect(
    page.getByRole("button", { name: "查看任务动态", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "关闭阶段提示", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(notice(page)).toHaveCount(0);
  checks.push(
    "1440/820/390px, English/Chinese, light/dark, focus/collapsed/mobile tabs; keyboard history and dismissal, no overflow or focus theft",
  );
  checks.push(
    "State icons reuse the seven established theme colors as circular backgrounds, with text labels and no status/handler box highlight",
  );
  await context.close();
  expect(errors).toEqual([]);
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      {
        result: "passed",
        api: "mock only",
        database: "none",
        checks,
        errors,
        eventRequests,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ result: "passed", checks, errors }, null, 2));
} finally {
  await browser.close();
  await preview?.close();
}
