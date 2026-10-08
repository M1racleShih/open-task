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
const errors: string[] = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(fixture.working.url);
await p.getByLabel("Username", { exact: true }).fill("leader");
await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
await p.getByRole("button", { name: "Sign in", exact: true }).click();
await p.getByLabel("Project", { exact: true }).selectOption(fixture.project.id);
await p.locator(".node").first().waitFor();
const relationsBefore = await (
  await ctx.request.get("http://127.0.0.1:4310/api/v1/relations")
).json();
const world = p.locator("[data-graph-world]");
const matrix = () =>
  world.evaluate((e) => {
    const m = (
      e as unknown as SVGGraphicsElement
    ).transform.baseVal.consolidate()!.matrix;
    return { x: m.e, y: m.f, z: m.a };
  });
const canvas = p.locator(".graph-scroll");
for (const [dx, dy] of [
  [80, 0],
  [-100, 0],
  [0, 80],
  [0, -100],
]) {
  const box = (await canvas.boundingBox())!;
  const before = await matrix();
  await p.mouse.move(box.x + 10, box.y + 10);
  await p.mouse.down();
  await p.mouse.move(box.x + 10 + dx, box.y + 10 + dy, { steps: 10 });
  await p.mouse.up();
  const after = await matrix();
  expect(after.x - before.x).toBeCloseTo(dx);
  expect(after.y - before.y).toBeCloseTo(dy);
}
const box = (await canvas.boundingBox())!;
const mx = Math.floor(box.x + box.width * 0.64) - box.x,
  my = Math.floor(box.y + box.height * 0.43) - box.y;
const before = await matrix();
await p.mouse.move(box.x + mx, box.y + my);
await p.mouse.wheel(0, -240);
await expect.poll(async () => (await matrix()).z).toBeGreaterThan(before.z);
const after = await matrix();
expect((mx - before.x) / before.z).toBeCloseTo((mx - after.x) / after.z, 3);
expect((my - before.y) / before.z).toBeCloseTo((my - after.y) / after.z, 3);
await p.getByRole("button", { name: "Fit view", exact: true }).click();
const fitted = (await canvas.boundingBox())!;
for (const node of await p.locator(".node").all()) {
  const n = (await node.boundingBox())!;
  expect(n.x).toBeGreaterThanOrEqual(fitted.x);
  expect(n.y).toBeGreaterThanOrEqual(fitted.y);
  expect(n.x + n.width).toBeLessThanOrEqual(fitted.x + fitted.width);
  expect(n.y + n.height).toBeLessThanOrEqual(fitted.y + fitted.height);
}
await p.getByRole("button", { name: "Locate selected", exact: true }).click();
const selected = p.locator(`[data-node-id="${fixture.working.id}"]`);
const selectedBox = (await selected.boundingBox())!;
expect(selectedBox.x).toBeGreaterThan(fitted.x - 100);
// Resize the actual inspector splitter; dragging nodes must use the new screen CTM.
const splitter = p.getByRole("separator", {
  name: "Task details",
  exact: true,
});
await splitter.focus();
await p.keyboard.press("ArrowLeft");
await p.getByRole("button", { name: "Fit view", exact: true }).click();
const nbox = (await selected.boundingBox())!;
await p.mouse.move(nbox.x + 70, nbox.y + 25);
await p.mouse.down();
await p.mouse.move(nbox.x + 90, nbox.y + 45, { steps: 10 });
await p.mouse.up();
expect(
  await (
    await ctx.request.get("http://127.0.0.1:4310/api/v1/relations")
  ).json(),
).toEqual(relationsBefore);
await expect(p.locator(".checklist-card progress")).toHaveAttribute(
  "value",
  "1",
);
await expect(p.locator(".checklist-card progress")).toHaveAttribute("max", "3");
await expect(p.locator(".checklist-card h3")).toContainText("33%");
await p
  .locator(".context-tabs")
  .getByRole("button", { name: /Blockers/ })
  .click();
await expect(p.locator(".context-card")).toContainText("等待示例资料确认");
await p.screenshot({ path: "artifacts/ui-polish-light.png", fullPage: true });
await p.getByLabel("Switch theme", { exact: true }).click();
await p.screenshot({ path: "artifacts/ui-polish-dark.png", fullPage: true });
await p
  .getByRole("button", { name: fixture.project.name, exact: true })
  .click();
await expect(p.locator(".project-heading[aria-pressed=true]")).toHaveCount(1);
await expect(p.locator(".task-row.selected")).toHaveCount(0);
await p.getByRole("button", { name: "New task", exact: true }).click();
const dialog = p.getByRole("dialog");
await expect(dialog.getByLabel("Project", { exact: true })).toHaveValue(
  fixture.project.id,
);
await dialog
  .getByLabel("Owner", { exact: true })
  .selectOption({ label: "Test Member" });
await expect(dialog.getByLabel("Reviewer", { exact: true })).toHaveValue(
  fixture.project.managerId,
);
await dialog
  .getByLabel("Delivery deadline", { exact: true })
  .fill("2026-11-09 14:35");
await dialog.getByLabel("Language", { exact: true }).selectOption("zh");
await expect(dialog.getByLabel("交付期限", { exact: true })).toHaveValue(
  "2026-11-09 14:35",
);
await dialog.getByLabel("语言", { exact: true }).selectOption("en");
await expect(
  dialog.getByLabel("Delivery deadline", { exact: true }),
).toHaveValue("2026-11-09 14:35");
await expect(
  dialog.getByLabel("Delivery deadline", { exact: true }),
).toHaveAttribute("placeholder", /YYYY-MM-DD/);
await p.screenshot({ path: "artifacts/ui-polish-date-en.png", fullPage: true });
await dialog.getByRole("button", { name: "Close", exact: true }).click();
await p.getByLabel("Project", { exact: true }).selectOption(fixture.project.id);
await p
  .getByRole("button", { name: "Manage project members", exact: true })
  .click();
await p.getByLabel("Project color", { exact: true }).fill("#5e91ad");
await p
  .getByRole("dialog")
  .getByRole("button", { name: "Submit", exact: true })
  .click();
await p.getByRole("dialog").waitFor({ state: "hidden" });
await p.reload();
await p.getByLabel("Project", { exact: true }).selectOption(fixture.project.id);
await expect(
  p
    .locator(".project-group")
    .filter({
      has: p.getByRole("button", { name: fixture.project.name, exact: true }),
    }),
).toHaveAttribute("style", /5e91ad/);
await p.goto(fixture.reviewing.url);
await expect(p.locator(".status")).toHaveText("Awaiting review");
await p
  .locator(".context-tabs")
  .getByRole("button", { name: /Submissions/ })
  .click();
await expect(p.locator(".context-card a")).toHaveAttribute(
  "href",
  fixture.working.url,
);
await p.screenshot({
  path: "artifacts/ui-polish-submission.png",
  fullPage: true,
});
await p.setViewportSize({ width: 390, height: 844 });
await p.screenshot({ path: "artifacts/ui-polish-mobile.png", fullPage: true });
expect(
  await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
).toBe(true);
await p.setViewportSize({ width: 1440, height: 1000 });
await p.getByRole("button", { name: "Team updates", exact: true }).click();
await expect(p.locator(".event").first()).toHaveCSS("border-left-width", "4px");
expect(errors).toEqual([]);
await writeFile(
  "artifacts/ui-polish-browser.json",
  JSON.stringify(
    {
      result: "passed",
      pan: "four directions",
      wheel: "pointer anchored",
      fit: "all loaded nodes",
      relationsUnchanged: true,
      panelResize: true,
      checklist: "1/3 · 33%",
      projectSelection: true,
      colorReload: true,
      dateLanguagePreservation: true,
      responsive: true,
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
