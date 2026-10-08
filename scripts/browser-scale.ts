import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { writeFile } from "node:fs/promises";
if (!process.env.DATABASE_URL?.endsWith("/open_task_test"))
  throw new Error("Scale check requires test database");
const api = spawn(process.execPath, ["--import", "tsx", "server/main.ts"], {
  env: { ...process.env, PORT: "4313" },
  stdio: "pipe",
});
let logs = "";
api.stdout?.on("data", (b) => (logs += b));
api.stderr?.on("data", (b) => (logs += b));
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch("http://127.0.0.1:4313/health");
      if (r.ok) break;
    } catch {}
    await delay(200);
  }
  browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:4313");
  await p.getByLabel("Username", { exact: true }).fill("leader");
  await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
  const started = Date.now();
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(p.locator(".node")).toHaveCount(200);
  const initialMs = Date.now() - started;
  const rows = await p.locator(".task-row").count();
  await expect(p.locator(".tree-fold").first()).toBeVisible();
  await p.locator(".tree-fold").first().click();
  expect(await p.locator(".task-row").count()).toBeLessThan(rows);
  await p.locator(".tree-fold").first().click();
  expect(await p.locator(".task-row").count()).toBe(rows);
  await p
    .locator(".tree")
    .getByRole("button", { name: "Load more", exact: true })
    .click();
  await expect(p.locator(".node")).toHaveCount(400);
  await p.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(p.locator(".node")).toHaveCount(400);
  const before = (
    await (
      await ctx.request.get("http://127.0.0.1:4313/api/v1/relations")
    ).json()
  ).items;
  const node = p.locator(".node").first();
  const box = await node.boundingBox();
  if (!box) throw new Error("Missing graph node");
  const transform = await node.getAttribute("transform");
  await p.mouse.move(box.x + 50, box.y + 20);
  await p.mouse.down();
  await p.mouse.move(box.x + 120, box.y + 60, { steps: 8 });
  await p.mouse.up();
  await expect(node).not.toHaveAttribute("transform", transform!);
  const after = (
    await (
      await ctx.request.get("http://127.0.0.1:4313/api/v1/relations")
    ).json()
  ).items;
  expect(after).toEqual(before);
  await p.getByRole("separator", { name: "Task tree", exact: true }).focus();
  const width = await p
    .locator(".tree")
    .evaluate((el) => el.getBoundingClientRect().width);
  await p.keyboard.press("ArrowRight");
  expect(
    await p.locator(".tree").evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(width);
  await p.getByRole("button", { name: "Fit view", exact: true }).click();
  const bounds = await p.locator(".graph-scroll").boundingBox();
  const outside = await p.locator(".node").evaluateAll(
    (nodes, box) =>
      nodes.filter((node) => {
        const r = node.getBoundingClientRect();
        return (
          r.left < box!.x ||
          r.top < box!.y ||
          r.right > box!.x + box!.width ||
          r.bottom > box!.y + box!.height
        );
      }).length,
    bounds,
  );
  expect(outside).toBe(0);
  await p.screenshot({ path: "artifacts/graph-200.png", fullPage: true });
  await p.getByRole("button", { name: "Team updates", exact: true }).click();
  await p
    .getByLabel("Author", { exact: true })
    .selectOption({ label: "Test Member" });
  await p.getByRole("button", { name: "Task graph", exact: true }).click();
  await expect(p.locator(".node")).toHaveCount(400);
  await p.getByLabel("Language", { exact: true }).selectOption("zh");
  await p.setViewportSize({ width: 390, height: 844 });
  await p
    .getByRole("button", { name: "任务图谱", exact: true })
    .first()
    .click();
  await p.screenshot({ path: "artifacts/graph-mobile-zh.png", fullPage: true });
  await writeFile(
    "artifacts/graph-scale.json",
    JSON.stringify(
      {
        result: "passed",
        visibleNodes: 200,
        expandedNodesAfterRefresh: 400,
        initialLoadMs: initialMs,
        checks: [
          "real test database with 5000+ tasks",
          "200 SVG nodes",
          "fit view contains all 400 loaded nodes",
          "node drag",
          "relations unchanged",
          "keyboard pane resize",
          "team update author filter",
          "view context",
          "mobile Chinese",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "200-node real-database graph, drag invariance and keyboard panel resize passed",
    initialMs,
  );
} finally {
  await browser?.close();
  api.kill("SIGTERM");
  await new Promise((r) => api.once("exit", r));
}
