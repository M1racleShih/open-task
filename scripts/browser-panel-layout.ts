/** UI-only regression fixture. Every API request is intercepted; no database or real user data. */
import { chromium, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import {
  defaultPanels,
  panelPreferenceKey,
} from "../shared/workspaceLayout.js";
import type { Task, User } from "../shared/model.js";
const base = process.env.PANEL_TEST_URL ?? "http://127.0.0.1:4341";
const output = "artifacts/panel-layout";
await mkdir(output, { recursive: true });
const users: User[] = [
  {
    id: "mock-alex",
    name: "Alex (demo)",
    username: "alex",
    active: true,
    roles: ["leader"],
  },
  {
    id: "mock-sam",
    name: "Sam (demo)",
    username: "sam",
    active: true,
    roles: ["member"],
  },
];
const task: Task = {
  id: "mock-task",
  number: 101,
  title: "Demo: prepare launch notes",
  outcome: "A reviewable demo release note",
  scope: "Simulated data for panel layout verification",
  criteria: "Read and review the demo note",
  ownerId: users[1].id,
  reviewerId: users[0].id,
  creatorId: users[0].id,
  issuerId: users[0].id,
  projectId: "mock-project",
  stage: "working",
  version: 1,
  revision: 1,
  plannedStart: "2026-10-12T01:00:00Z",
  deadline: "2026-10-31T10:00:00Z",
  acceptBy: "2026-10-15T10:00:00Z",
  feedbackBy: "2026-10-31T10:00:00Z",
  reviewBy: "2026-11-02T10:00:00Z",
  confirmBy: null,
  confirmedVersion: 1,
  confirmedTerms: null,
  approvalIds: [],
  approvalIndex: 0,
  refused: null,
  lastFeedbackAt: null,
  checklistVersion: 1,
  checklist: [],
  checklistRequests: [],
  blocks: [],
  submissions: [],
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-10T00:00:00Z",
};
const project = {
  id: "mock-project",
  name: "Demo release",
  color: "#365fac",
  managerId: users[0].id,
  memberIds: [users[1].id],
};
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
});
const checks: string[] = [];
// Keep locator errors bounded so the script reports the failing interaction promptly.
const errors: string[] = [];
let account: User | null = users[0];
async function prepare(page: Page) {
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error("BROWSER", m.text());
  });
  page.on("requestfailed", (r) =>
    console.error("REQUEST FAILED", r.url(), r.failure()?.errorText),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    let body: unknown;
    if (path === "/me") body = { user: account, csrf: "mock-csrf" };
    else if (path === "/sessions") {
      if (request.method() === "DELETE") account = null;
      else
        account = users.find(
          (user) => user.username === request.postDataJSON().username,
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
    else if (path === "/users") body = users;
    else if (path === "/projects") body = [project];
    else if (path === "/tasks")
      body = {
        items: [task],
        context: [],
        nextCursor: null,
        total: 1,
        counts: {
          [project.id]: { total: 1, done: 0, reviewing: 0, blocked: 0 },
        },
      };
    else if (path === "/tasks/" + task.id)
      body = { task, relations: [], targets: [] };
    else if (["/followups", "/events", "/relations"].includes(path))
      body = { items: [], nextCursor: null };
    else
      throw new Error(
        "Unexpected mock API request: " + request.method() + " " + path,
      );
    await route.fulfill({ json: body });
  });
}
const dimensions = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      ["tree", "center", "details"].map((name) => [
        name,
        document.querySelector("." + name)!.getBoundingClientRect().width,
      ]),
    ),
  );
const noOverflow = async (page: Page) => {
  try {
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  } catch (error) {
    await page.screenshot({
      path: output + "/overflow-failure.png",
      fullPage: true,
    });
    console.error(
      await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        columns: document.querySelector(".layout")?.getAttribute("style"),
        outside: [
          ...document.querySelectorAll(
            ".top, .body-row, .layout, .tree, .center, .details, .panel > header, .focus-details",
          ),
        ].map((el) => ({
          name: el.className,
          x: el.getBoundingClientRect().x,
          width: el.getBoundingClientRect().width,
          scrollWidth: el.scrollWidth,
        })),
      })),
    );
    throw error;
  }
};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await prepare(page);
  const saved = {
    ...defaultPanels(true),
    treeSize: 310,
    detailSize: 490,
    bottom: true,
    inboxSize: 220,
  };
  await page.addInitScript(
    ({ key, panels }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(panels));
    },
    { key: panelPreferenceKey(users[0].id), panels: saved },
  );
  await page.goto(base + "/?task=" + task.id);
  await expect(page.locator(".details h1")).toHaveText(task.title);
  await expect(
    page.getByRole("separator", { name: "Task tree", exact: true }),
  ).toHaveAttribute("aria-valuenow", "310");
  expect((await dimensions(page)).details).toBe(490);
  checks.push(
    "Saved account layout restored before a default layout can overwrite it",
  );
  await page
    .getByLabel("Search title or task number", { exact: true })
    .fill("Demo");
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page.getByRole("separator", { name: "Task tree", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  const before = await dimensions(page);
  expect(before.tree).toBe(320);
  await page.locator(".gantt-scroll").evaluate((el) => {
    el.scrollLeft = 100;
  });
  const ganttScroll = await page
    .locator(".gantt-scroll")
    .evaluate((el) => el.scrollLeft);
  const gantt = await page.locator(".gantt").elementHandle();
  const detail = await page.locator(".detail-scroll").elementHandle();
  await page
    .getByRole("button", { name: "Hide center workspace", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".center")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Toggle center workspace", exact: true }),
  ).toBeFocused();
  expect((await dimensions(page)).details).toBeGreaterThan(
    before.details + 300,
  );
  await page.screenshot({
    path: output + "/desktop-center-hidden-en-light.png",
    fullPage: true,
  });
  await page.keyboard.press("Space");
  await expect(page.locator(".center")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Week", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await gantt!.evaluate((el) => el === document.querySelector(".gantt")),
  ).toBe(true);
  expect(
    await detail!.evaluate(
      (el) => el === document.querySelector(".detail-scroll"),
    ),
  ).toBe(true);
  expect(await dimensions(page)).toEqual(before);
  expect(
    await page.locator(".gantt-scroll").evaluate((el) => el.scrollLeft),
  ).toBe(ganttScroll);
  await expect(page.locator(".details h1")).toHaveText(task.title);
  checks.push(
    "Center hide expands details; keyboard restore keeps Gantt DOM, scale, search and detail DOM",
  );
  await page
    .getByRole("button", { name: "Focus details", exact: true })
    .click();
  await expect(page.locator(".tree")).toBeHidden();
  await expect(page.locator(".center")).toBeHidden();
  expect((await dimensions(page)).details).toBeGreaterThan(1300);
  await page.screenshot({
    path: output + "/desktop-focused-en-light.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Restore layout", exact: true })
    .click();
  expect(await dimensions(page)).toEqual(before);
  await expect(
    page.getByLabel("Search title or task number", { exact: true }),
  ).toHaveValue("Demo");
  await page
    .getByRole("button", { name: "Hide center workspace", exact: true })
    .click();
  const collapsed = await dimensions(page);
  await page
    .getByRole("button", { name: "Focus details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore layout", exact: true })
    .click();
  expect(await dimensions(page)).toEqual(collapsed);
  await page
    .getByRole("button", { name: "Focus details", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".details h1")).toHaveText(task.title);
  await expect(
    page.getByRole("button", { name: "Focus details", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".center")).toBeHidden();
  expect((await dimensions(page)).tree).toBe(320);
  checks.push(
    "Focus restores exact prior widths and hidden center; refresh exits focus to saved layout",
  );
  await page
    .getByRole("button", { name: "Open task graph", exact: true })
    .click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const graph = await page
    .locator(".graph-scroll svg > g")
    .first()
    .elementHandle();
  const transform = await graph!.getAttribute("transform");
  await page
    .getByRole("button", { name: "Hide center workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle center workspace", exact: true })
    .click();
  expect(
    await graph!.evaluate(
      (el) => el === document.querySelector(".graph-scroll svg > g"),
    ),
  ).toBe(true);
  expect(await graph!.getAttribute("transform")).toBe(transform);
  await page
    .getByRole("button", { name: "Open team updates", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hide center workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle task tree", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle task details", exact: true })
    .click();
  await expect(page.locator(".panels-empty")).toBeVisible();
  await page.screenshot({
    path: output + "/desktop-all-hidden-en-light.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".panels-empty")).toBeVisible();
  for (const name of [
    "Toggle task tree",
    "Toggle center workspace",
    "Toggle task details",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.locator(".tree")).toBeVisible();
  await expect(page.locator(".center")).toBeVisible();
  await expect(page.locator(".details")).toBeVisible();
  checks.push(
    "Graph DOM and zoom preserved; whole updates center hides; all-hidden state survives reload with reachable recovery controls",
  );
  // Actual account menu logout/login path; no real sessions leave the mock router.
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Switch user", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("sam");
  await page.getByLabel("Password", { exact: true }).fill("demo-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".tree")).toBeVisible();
  await expect(page.locator(".details")).toBeHidden();
  await page
    .getByRole("button", { name: "Toggle task tree", exact: true })
    .click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Switch user", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("alex");
  await page.getByLabel("Password", { exact: true }).fill("demo-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".tree")).toBeVisible();
  expect((await dimensions(page)).tree).toBe(320);
  await expect(page.locator(".details")).toBeVisible();
  checks.push(
    "Switch user through real account menu restores each account's isolated layout",
  );
  await page.goto(base + "/?task=" + task.id);
  await expect(page.locator(".details h1")).toHaveText(task.title);
  for (const lang of ["en", "zh"]) {
    await page.getByLabel(/Language|语言/, { exact: true }).selectOption(lang);
    for (const theme of ["light", "dark"]) {
      const actual = await page.locator("html").getAttribute("data-theme");
      if ((actual ?? "light") !== theme)
        await page
          .getByRole("button", { name: /Switch theme|切换主题/, exact: true })
          .click();
      for (const width of [1440, 820, 761, 390]) {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 1000,
        });
        if (width === 390) {
          for (const tab of ["tree", "workspace", "details"]) {
            const label = {
              tree: lang === "en" ? "Task tree" : "任务树",
              workspace: lang === "en" ? "Workspace" : "工作区",
              details: lang === "en" ? "Task details" : "任务详情",
            }[tab];
            await page
              .locator(".mobile-tabs")
              .getByRole("button", { name: label, exact: true })
              .click();
            await expect(
              page.locator(tab === "workspace" ? ".center" : "." + tab),
            ).toBeVisible();
            await noOverflow(page);
          }
        } else {
          await noOverflow(page);
          const focus = page.getByRole("button", {
            name: lang === "en" ? "Focus details" : "聚焦详情",
            exact: true,
          });
          await focus.click();
          await page
            .getByRole("button", {
              name: lang === "en" ? "Restore layout" : "恢复布局",
              exact: true,
            })
            .click();
        }
        await page.screenshot({
          path: `${output}/${width}-${lang}-${theme}.png`,
          fullPage: true,
        });
      }
    }
  }
  checks.push(
    "1440px desktop, 820px and 761px narrow desktop, 390px three mobile tabs; both languages and both themes, no page overflow",
  );
  // Hidden desktop panels must not hide the matching mobile tab.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: /Toggle task tree|开关任务目录/, exact: true })
    .click();
  await page
    .getByRole("button", {
      name: /Toggle center workspace|开关中间工作区/,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: /Toggle task details|开关任务详情/,
      exact: true,
    })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ["tree", "workspace", "details"]) {
    const index = ["tree", "workspace", "details"].indexOf(tab);
    await page.locator(".mobile-tabs button").nth(index).click();
    await expect(
      page.locator(tab === "workspace" ? ".center" : "." + tab),
    ).toBeVisible();
    await noOverflow(page);
  }
  checks.push("Mobile tabs stay usable with every desktop panel hidden");
  await context.close();
  account = users[0];
  const denied = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const blocked = await denied.newPage();
  await prepare(blocked);
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    }),
  );
  await blocked.goto(base + "/?task=" + task.id);
  await expect(blocked.locator(".details h1")).toHaveText(task.title);
  await blocked
    .getByRole("button", { name: "Hide center workspace", exact: true })
    .click();
  await blocked
    .getByRole("button", { name: "Focus details", exact: true })
    .click();
  await blocked
    .getByRole("button", { name: "Restore layout", exact: true })
    .click();
  await expect(blocked.locator(".center")).toBeHidden();
  await blocked
    .getByRole("button", { name: "Toggle center workspace", exact: true })
    .click();
  await blocked
    .getByRole("button", { name: "Switch theme", exact: true })
    .click();
  await blocked.getByLabel("Language", { exact: true }).selectOption("zh");
  await expect(
    blocked.getByRole("button", { name: "聚焦详情", exact: true }),
  ).toBeVisible();
  checks.push(
    "Denied localStorage getter: App loads, collapse/focus/restore/theme/language all work in memory",
  );
  await denied.close();
  expect(errors).toEqual([]);
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      { result: "passed", mockApi: true, database: "none", checks, errors },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ result: "passed", checks, errors }, null, 2));
} finally {
  await browser.close();
}
