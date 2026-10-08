import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:4310");
await p.getByLabel("Username", { exact: true }).fill("leader");
await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
await p.getByRole("button", { name: "Sign in", exact: true }).click();
await p.getByRole("button", { name: "New task", exact: true }).waitFor();
const before = (
  await (await ctx.request.get("http://127.0.0.1:4310/api/v1/relations")).json()
).items;
const rel = before.find((r: any) => r.kind === "parent");
const task = (
  await (
    await ctx.request.get("http://127.0.0.1:4310/api/v1/tasks/" + rel.sourceId)
  ).json()
).task;
await p.getByLabel("Project", { exact: true }).selectOption(task.projectId);
const node = p.locator(`[data-node-id="${rel.sourceId}"]`),
  neighbor = p.locator(`[data-node-id="${rel.targetId}"]`);
await node.waitFor();
await node.scrollIntoViewIfNeeded();
const neighborBefore = await neighbor.getAttribute("transform");
const box = (await node.boundingBox())!;
await p.mouse.move(box.x + 100, box.y + 30);
await p.mouse.down();
await p.mouse.move(box.x + 175, box.y + 90, { steps: 20 });
await p.waitForTimeout(250);
const neighborDuring = await neighbor.getAttribute("transform");
expect(neighborDuring).not.toBe(neighborBefore);
await p.mouse.up();
const samples = await node.evaluate(async (el) => {
  const out: { t: number; x: number; y: number }[] = [];
  for (let i = 0; i < 180; i++) {
    await new Promise(requestAnimationFrame);
    const matrix = (
      el as unknown as SVGGraphicsElement
    ).transform.baseVal.consolidate()!.matrix;
    out.push({ t: performance.now(), x: matrix.e, y: matrix.f });
  }
  return out;
});
const motion = samples
  .slice(1)
  .map((x, i) => Math.hypot(x.x - samples[i].x, x.y - samples[i].y));
const early = motion.slice(0, 30).reduce((a, b) => a + b, 0),
  late = motion.slice(-30).reduce((a, b) => a + b, 0);
expect(early).toBeGreaterThan(0.1);
expect(late).toBeLessThan(Math.max(0.1, early * 0.1));
const settled = await node.getAttribute("transform");
await p.getByRole("button", { name: "Team updates", exact: true }).click();
await p.getByRole("button", { name: "Task graph", exact: true }).click();
expect(await node.getAttribute("transform")).toBe(settled);
const after = (
  await (await ctx.request.get("http://127.0.0.1:4310/api/v1/relations")).json()
).items;
expect(after).toEqual(before);
await p.getByRole("button", { name: "Toggle task tree", exact: true }).click();
await expect(p.locator(".tree")).toBeHidden();
await p.getByRole("button", { name: "Toggle task tree", exact: true }).click();
await expect(p.locator(".tree")).toBeVisible();
await p.screenshot({ path: "artifacts/damped-graph.png", fullPage: true });
await writeFile(
  "artifacts/graph-physics.json",
  JSON.stringify(
    {
      result: "passed",
      connectedNodeMoved: neighborBefore !== neighborDuring,
      earlyMotion: early,
      lateMotion: late,
      frames: samples.length,
      averageFrameMs: (samples.at(-1)!.t - samples[0].t) / 179,
      relationsUnchanged: true,
      layoutSurvivesTabSwitch: true,
      treeToggle: true,
    },
    null,
    2,
  ),
);
console.log(
  "Damped spring drag: connected node follows; release motion decays; business relations unchanged; layout survives tabs.",
);
await browser.close();
