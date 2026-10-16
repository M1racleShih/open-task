/** Real App + ChecklistCard against an isolated in-memory API. No database or credentials. */
import { chromium, expect, type Page } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Task, User } from "../shared/model.js";
import { defaultTimeFilter } from "../shared/timeFilter.js";
import { translate } from "../web/i18n.js";

const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL("../web", import.meta.url)),
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4343, strictPort: true },
});
await server.listen();
const output = new URL("../artifacts/checklist/", import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
  env: { ...process.env, XDG_CONFIG_HOME: "/tmp/open-task-checklist-chrome" },
});
const checks: string[] = [];
const owner: User = {
  id: randomUUID(),
  username: "demo-owner",
  name: "Demo owner",
  roles: ["member"],
  active: true,
};
const reviewer: User = {
  id: randomUUID(),
  username: "demo-leader",
  name: "Demo leader",
  roles: ["leader"],
  active: true,
};
function makeTask(number: number): Task {
  return {
    id: randomUUID(),
    number,
    title: `Demo checklist ${number}`,
    creatorId: reviewer.id,
    issuerId: reviewer.id,
    ownerId: owner.id,
    reviewerId: reviewer.id,
    projectId: null,
    stage: "working",
    version: 1,
    revision: 1,
    confirmedVersion: 1,
    confirmedTerms: null,
    confirmBy: null,
    approvalIds: [],
    approvalIndex: 0,
    refused: null,
    lastFeedbackAt: null,
    outcome: "Synthetic checklist interaction demo",
    scope: "Mock data only",
    criteria: "Saved progress and local checks are distinct",
    deadline: "2026-12-01T10:00:00Z",
    acceptBy: "2026-11-01T10:00:00Z",
    feedbackBy: "2026-11-02T10:00:00Z",
    reviewBy: "2026-12-02T10:00:00Z",
    checklistVersion: 1,
    checklist: [
      {
        id: randomUUID(),
        text: "Verify sample export / 验证模拟导出",
        done: false,
      },
      {
        id: randomUUID(),
        text: "Document sample delivery / 记录模拟交付",
        done: false,
      },
    ],
    checklistRequests: [
      {
        id: randomUUID(),
        baseVersion: 1,
        items: [
          { id: randomUUID(), text: "Pending sample item / 待审批模拟项目" },
        ],
        scopeChanged: false,
        authorId: owner.id,
        status: "pending",
        reason: "Pending reason / 待审批原因",
      },
      {
        id: randomUUID(),
        baseVersion: 1,
        items: [
          { id: randomUUID(), text: "Approved sample item / 已批准模拟项目" },
        ],
        scopeChanged: false,
        authorId: owner.id,
        status: "approved",
        reason: "Approved reason / 已批准原因",
      },
      {
        id: randomUUID(),
        baseVersion: 1,
        items: [
          { id: randomUUID(), text: "Returned sample item / 已退回模拟项目" },
        ],
        scopeChanged: true,
        authorId: owner.id,
        status: "rejected",
        reason: "Returned reason\nSecond line / 已退回原因第二行",
      },
    ],
    blocks: [],
    submissions: [],
    createdAt: "2026-10-16T08:00:00Z",
    updatedAt: "2026-10-16T08:00:00Z",
  };
}
async function setup(page: Page, user = owner) {
  const tasks = [makeTask(1), makeTask(2)];
  let writes = 0,
    reads = 0,
    error = "",
    holdSave: (() => void) | null = null;
  let saveGate: Promise<void> | null = null;
  let holdRead: (() => void) | null = null;
  let readGate: Promise<void> | null = null;
  let heldReadStarted = false;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    let data: unknown = { items: [], nextCursor: null };
    if (path === "/me") data = { user };
    else if (path === "/users") data = [owner, reviewer];
    else if (path === "/time-preferences")
      data = { global: defaultTimeFilter, projects: {} };
    else if (path === "/projects") data = [];
    else if (path === "/tasks")
      data = {
        items: tasks,
        nextCursor: null,
        total: tasks.length,
        counts: {},
      };
    else {
      const task = tasks.find((task) => path.startsWith(`/tasks/${task.id}`));
      if (task && path.endsWith("/actions/toggle")) {
        writes++;
        const body = request.postDataJSON();
        expect(body.version).toBe(1);
        expect(body.checklistVersion).toBe(1);
        expect(request.headers()["idempotency-key"]).toBeTruthy();
        if (saveGate) await saveGate;
        if (error)
          return route.fulfill({
            status: error === "versionConflict" ? 409 : 500,
            json: { error: { code: error } },
          });
        for (const change of body.changes) {
          const item = task.checklist.find(
            (item) => item.id === change.itemId,
          )!;
          expect(change.expectedDone).toBe(item.done);
          item.done = change.done;
        }
        task.revision++;
        data = task;
      } else if (task && path.includes("/actions/")) {
        const action = path.split("/").at(-1);
        const body = request.postDataJSON();
        if (action === "requestChecklist") {
          expect(body.items.length).toBeGreaterThan(0);
          task.checklistRequests.push({
            id: randomUUID(),
            baseVersion: task.checklistVersion,
            items: body.items,
            scopeChanged: body.scopeChanged,
            reason: body.reason ?? "",
            authorId: user.id,
            status: "pending",
          });
        } else {
          const pending = task.checklistRequests.find(
            (request) => request.id === body.requestId,
          )!;
          expect(pending.status).toBe("pending");
          pending.status =
            action === "approveChecklist" ? "approved" : "rejected";
          if (action === "approveChecklist") {
            task.checklist = pending.items.map((item) => ({
              ...item,
              done: false,
            }));
            task.checklistVersion++;
          } else expect(body.reason).toBeTruthy();
        }
        data = task;
      } else if (task) {
        reads++;
        // Snapshot before the gate to simulate an older auto-refresh response.
        data = structuredClone({ task, relations: [], targets: [] });
        if (readGate) {
          heldReadStarted = true;
          await readGate;
        }
      }
    }
    await route.fulfill({ json: data });
  });
  await page.clock.install();
  await page.goto(`http://127.0.0.1:4343/?task=${tasks[0].id}`);
  await expect(page.locator(".checklist-card input")).toHaveCount(2);
  return {
    tasks,
    writes: () => writes,
    reads: () => reads,
    setError: (code: string) => {
      error = code;
    },
    holdSave: () => {
      saveGate = new Promise<void>((resolve) => {
        holdSave = resolve;
      });
    },
    releaseSave: () => {
      holdSave?.();
      saveGate = null;
    },
    holdRead: () => {
      heldReadStarted = false;
      readGate = new Promise<void>((resolve) => {
        holdRead = resolve;
      });
    },
    heldReadStarted: () => heldReadStarted,
    releaseRead: () => {
      holdRead?.();
      readGate = null;
    },
  };
}
try {
  for (const lang of ["en", "zh"] as const) {
    const t = (key: string) => translate(key, lang);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(
      (language) => localStorage.setItem("open-task.language", language),
      lang,
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const mock = await setup(page);
    const card = page.locator(".checklist-card");
    const boxes = card.getByRole("checkbox");
    const save = card.getByRole("button", {
      name: t("submitChecklist"),
      exact: true,
    });
    const undo = card.getByRole("button", {
      name: t("checklistUndo"),
      exact: true,
    });
    const progress = card.getByRole("progressbar");
    await expect(save).toBeDisabled();
    await expect(
      card.locator(".checklist-pending .checklist-request-status").first(),
    ).toHaveText(t("checklistPendingStatus"));
    await expect(card.locator(".checklist-pending")).toContainText(
      "Pending reason",
    );
    const history = card.locator(".checklist-history");
    await expect(history).not.toHaveAttribute("open", "");
    await history.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(history).toHaveAttribute("open", "");
    await expect(history).toContainText("Approved sample item");
    await expect(history).toContainText("Returned reason\nSecond line");
    await history.locator("summary").click();
    await boxes.nth(0).focus();
    await page.keyboard.press("Space");
    await boxes.nth(1).check();
    await expect(card.locator(".checklist-save-status")).toHaveText(
      t("checklistUnsaved").replace("{count}", "2"),
    );
    await expect(card.locator(".checklist-item-dirty")).toHaveCount(2);
    expect(mock.writes()).toBe(0);
    await expect(progress).toHaveAttribute("value", "0");
    await card.evaluate((element) =>
      element.scrollIntoView({ block: "start" }),
    );
    await page.screenshot({
      path: `${output}${lang}-unsaved-desktop.png`,
      fullPage: true,
    });
    await undo.click();
    await expect(boxes.nth(0)).not.toBeChecked();
    expect(mock.writes()).toBe(0);
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    // Real 15-second interval accelerated with Playwright's supported clock.
    const oldReads = mock.reads();
    await page.clock.runFor(15010);
    await expect.poll(mock.reads).toBeGreaterThan(oldReads);
    await expect(boxes.nth(0)).toBeChecked();
    await expect(progress).toHaveAttribute("value", "0");
    // Leave warning preserves draft when cancelled, discards only after confirmation.
    let prompted = false;
    page.once("dialog", async (dialog) => {
      prompted = true;
      await dialog.dismiss();
    });
    await page
      .locator(".task-row")
      .filter({ hasText: mock.tasks[1].title })
      .click();
    expect(prompted).toBe(true);
    await expect(boxes.nth(0)).toBeChecked();
    let refreshPrompt = false;
    page.once("dialog", async (dialog) => {
      refreshPrompt = dialog.type() === "beforeunload";
      await dialog.dismiss();
    });
    await page.reload({ timeout: 2000 }).catch(() => {});
    expect(refreshPrompt).toBe(true);
    await expect(boxes.nth(0)).toBeChecked();
    for (const code of ["serverError", "versionConflict"]) {
      mock.setError(code);
      await save.click();
      await expect(card.getByRole("alert")).toContainText(
        t(
          code === "versionConflict"
            ? "checklistSaveConflict"
            : "checklistSaveFailure",
        ),
      );
      await expect(boxes.nth(0)).toBeChecked();
      await expect(progress).toHaveAttribute("value", "0");
    }
    await card.evaluate((element) =>
      element.scrollIntoView({ block: "start" }),
    );
    await page.screenshot({
      path: `${output}${lang}-conflict-desktop.png`,
      fullPage: true,
    });
    // Save lock prevents duplicates; old auto-refresh cannot reset acknowledged progress.
    mock.setError("");
    mock.holdSave();
    const writes = mock.writes();
    await save.click();
    await expect(save).toBeDisabled();
    await save.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    expect(mock.writes()).toBe(writes + 1);
    mock.holdRead();
    await page.clock.runFor(15010);
    await expect.poll(mock.heldReadStarted).toBe(true);
    mock.releaseSave();
    await expect(progress).toHaveAttribute("value", "2");
    await expect(card.locator(".checklist-save-status")).toHaveText(
      t("checklistSaveSuccess"),
    );
    mock.releaseRead();
    await expect(save).toBeDisabled();
    await expect(progress).toHaveAttribute("value", "2");
    await expect(page.locator(".task-meta .status")).toHaveText(t("working"));
    // Deferred post-save refresh may finish after switching; it must not affect B's new draft.
    await boxes.nth(0).uncheck();
    mock.holdSave();
    mock.holdRead();
    await save.click();
    mock.releaseSave();
    await expect(progress).toHaveAttribute("value", "1");
    await page
      .locator(".task-row")
      .filter({ hasText: mock.tasks[1].title })
      .click();
    mock.releaseRead();
    await expect(page.locator(".details h1")).toHaveText(mock.tasks[1].title);
    await expect(boxes.nth(0)).toBeEnabled();
    await boxes.nth(0).check();
    await expect(card.locator(".checklist-save-status")).toHaveText(
      t("checklistUnsaved").replace("{count}", "1"),
    );
    await expect(progress).toHaveAttribute("value", "0");
    await expect(card.getByRole("alert")).toHaveCount(0);
    // Content request remains the existing form and protocol.
    await undo.click();
    await card
      .getByRole("button", { name: t("requestChecklist"), exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel(t("items"), { exact: true })
      .fill("New synthetic checklist item");
    await dialog
      .getByRole("button", { name: t("submit"), exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(card.locator(".checklist-pending")).toContainText(
      "New synthetic checklist item",
    );
    await boxes.nth(0).check();
    await expect(progress).toHaveAttribute("value", "0");
    // Screenshots and overflow check for desktop, narrow window and 390px phone in both themes.
    for (const width of [1440, 900, 390]) {
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 1000,
        });
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
          localStorage.setItem("open-task.theme", value);
        }, theme);
        await card.evaluate((element) =>
          element.scrollIntoView({ block: "start" }),
        );
        await expect(card).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(
          await card.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `${output}${lang}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    }
    expect(errors).toEqual([]);
    checks.push(
      `${lang}: keyboard, undo/no request, batch/duplicate lock, failure/conflict preservation, 15s refresh, beforeunload/task warning, stale refresh, task switch/new draft, content request, 100% still working, 1440/900/390 light/dark, no overflow or page errors`,
    );
    await context.close();
  }
  // Leader approvals/returns and terminal/non-owner permissions use the real form actions.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const mock = await setup(page, reviewer);
  const card = page.locator(".checklist-card");
  await expect(card.getByRole("checkbox").nth(0)).toBeDisabled();
  await expect(
    card.getByRole("button", { name: "Save checked progress", exact: true }),
  ).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Request checklist edit", exact: true }),
  ).toHaveCount(0);
  await card
    .getByRole("button", { name: "Reject checklist", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Reason", { exact: true })
    .fill("Synthetic return reason");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit", exact: true })
    .click();
  await expect(card.locator(".checklist-pending")).toHaveCount(0);
  // Reset the mock to a pending request and refresh to exercise approval.
  mock.tasks[0].checklistRequests[0].status = "pending";
  await page.reload();
  await card
    .getByRole("button", { name: "Approve checklist", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit", exact: true })
    .click();
  await expect(card.getByRole("checkbox")).toHaveCount(1);
  await expect(card).toContainText("Pending sample item");
  mock.tasks[0].stage = "done";
  await page.reload();
  await expect(card.getByRole("checkbox").nth(0)).toBeDisabled();
  await context.close();
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const terminal = await setup(ownerPage);
  terminal.tasks[0].stage = "done";
  await ownerPage.reload();
  await expect(
    ownerPage.locator(".checklist-card").getByRole("checkbox").nth(0),
  ).toBeDisabled();
  await expect(
    ownerPage
      .locator(".checklist-card")
      .getByRole("button", { name: "Request checklist edit", exact: true }),
  ).toHaveCount(0);
  await ownerContext.close();
  checks.push(
    "Leader approve/return form protocols, read-only non-owner and terminal owner permissions",
  );
  await writeFile(
    output + "results.json",
    JSON.stringify({ mockOnly: true, checks }, null, 2) + "\n",
  );
  console.log("PASS", ...checks);
} finally {
  await browser.close();
  await server.close();
}
