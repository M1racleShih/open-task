import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const demo = await context.newPage();
await demo.goto("http://127.0.0.1:4174/frappe.html");
await demo.screenshot({
  path: "artifacts/reference-demo-light.png",
  fullPage: true,
});
const p = await context.newPage();
await p.goto("http://127.0.0.1:4310");
await p.getByLabel("Username", { exact: true }).fill("leader");
await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
await p.getByRole("button", { name: "Sign in", exact: true }).click();
await p.getByRole("button", { name: "New task", exact: true }).waitFor();
const response = await context.request.get(
  "http://127.0.0.1:4310/api/v1/relations",
);
const relation = (await response.json()).items.find(
  (r: any) => r.kind === "parent",
);
const detail = (
  await (
    await context.request.get(
      "http://127.0.0.1:4310/api/v1/tasks/" + relation.targetId,
    )
  ).json()
).task;
await p.goto("http://127.0.0.1:4310/?task=" + detail.id);
await p.getByLabel("Project", { exact: true }).selectOption(detail.projectId);
await p.locator(".node").first().waitFor();
await expect(p.locator(".checklist-card")).toBeVisible();
await expect(p.locator(".outcome-card")).toBeVisible();
await expect(p.locator(".outcome-card")).toContainText("Acceptance criteria");
await p.locator(".detail-tabs").getByRole("button", { name: "Activity", exact: true }).click();
await expect(p.locator(".checklist-card")).toBeHidden();
await p.locator(".detail-tabs").getByRole("button", { name: "Task content", exact: true }).click();
await expect(p.locator(".checklist-card")).toBeVisible();
await p.screenshot({
  path: "artifacts/production-ide-light.png",
  fullPage: true,
});
await p.getByLabel("Switch theme", { exact: true }).click();
await p.screenshot({
  path: "artifacts/production-ide-dark.png",
  fullPage: true,
});
const taskList = (await (await context.request.get("http://127.0.0.1:4310/api/v1/tasks")).json()).items;
const withChecklist = taskList.find((task: any) => task.checklist?.length > 0);
if (!withChecklist) throw new Error("Real checklist fixture required for inspector verification");
await p.goto("http://127.0.0.1:4310/?task=" + withChecklist.id);
await expect(p.locator(".checklist-card input[type=checkbox]")).toHaveCount(withChecklist.checklist.length);
await expect(p.locator(".checklist-card progress")).toHaveAttribute("max", String(withChecklist.checklist.length));
await p.screenshot({path: "artifacts/production-checklist-card.png", fullPage: true});
await browser.close();
console.log(
  "Reference demo and production IDE captured at identical 1440×1000 viewport.",
);
