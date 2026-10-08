import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const fixture = JSON.parse(
  await readFile("artifacts/ui-polish-fixtures.json", "utf8"),
);
const b = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const ctx = await b.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1000 },
  });
  const p = await ctx.newPage();
  await p.goto(fixture.working.url);
  await p.getByLabel("Username", { exact: true }).fill("leader");
  await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.locator(".node").first().waitFor();
  await expect(p.locator(".project-heading").first()).toHaveCSS(
    "justify-content",
    "flex-start",
  );
  await p
    .getByLabel("Project", { exact: true })
    .selectOption(fixture.project.id);
  await p
    .getByRole("button", { name: fixture.project.name, exact: true })
    .click({ button: "right" });
  await p.getByRole("menuitem", { name: "Project color", exact: true }).click();
  await expect(
    p.getByRole("dialog").getByLabel("Project color", { exact: true }),
  ).toHaveValue("#5e91ad");
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const heading = p.getByRole("button", {
    name: fixture.project.name,
    exact: true,
  });
  const count = await p.locator(".task-row").count();
  await heading.click();
  await expect(p.locator(".task-row")).toHaveCount(0);
  await expect(heading).toHaveAttribute("aria-expanded", "false");
  await heading.click();
  await expect(p.locator(".task-row")).toHaveCount(count);
  await p
    .locator(".task-row")
    .filter({ hasText: "Checklist & blocker" })
    .click();
  const before = await (
    await ctx.request.get("http://127.0.0.1:4310/api/v1/relations")
  ).json();
  const node = p.locator(`[data-node-id="${fixture.working.id}"]`);
  await node.waitFor();
  for (let i = 0; i < 12; i++)
    await p.getByRole("button", { name: "Zoom out", exact: true }).click();
  const samples = [];
  for (const side of [-1, 1, 1]) {
    await p
      .getByRole("button", { name: "Locate selected", exact: true })
      .click();
    const nb = (await node.boundingBox())!;
    const cb = (await p.locator(".graph-scroll").boundingBox())!;
    const startX = Math.round(nb.x + nb.width / 2),
      startY = Math.round(nb.y + nb.height / 2);
    const endX = Math.round(cb.x + cb.width / 2 + side * 200),
      endY = Math.round(cb.y + cb.height / 2 + side * 150);
    const z = await p
      .locator("[data-graph-world]")
      .evaluate(
        (e) =>
          (e as unknown as SVGGraphicsElement).transform.baseVal.consolidate()!
            .matrix.a,
      );
    await p.mouse.move(startX, startY);
    await p.mouse.down();
    const prev = await node.evaluate((e) => {
      const m = (
        e as unknown as SVGGraphicsElement
      ).transform.baseVal.consolidate()!.matrix;
      return { x: m.e, y: m.f };
    });
    await p.mouse.move(endX, endY, { steps: 12 });
    const next = await node.evaluate((e) => {
      const m = (
        e as unknown as SVGGraphicsElement
      ).transform.baseVal.consolidate()!.matrix;
      return { x: m.e, y: m.f };
    });
    expect(Math.abs(next.x - prev.x - (endX - startX) / z)).toBeLessThan(2);
    expect(Math.abs(next.y - prev.y - (endY - startY) / z)).toBeLessThan(2);
    samples.push(next);
    await p.mouse.up();
  }
  expect(samples[0].x).toBeLessThan(-1000);
  expect(samples[2].x).toBeGreaterThan(1000);
  expect(
    await (
      await ctx.request.get("http://127.0.0.1:4310/api/v1/relations")
    ).json(),
  ).toEqual(before);
  await p.getByRole("button", { name: "Reset layout", exact: true }).click();
  await p.getByLabel("Project", { exact: true }).selectOption("");
  await p.locator(".node").nth(10).waitFor();
  await p.getByRole("button", { name: "Reset layout", exact: true }).click();
  await p.screenshot({
    path: "artifacts/ui-tree-radial-light.png",
    fullPage: true,
  });
  await p.getByLabel("Switch theme", { exact: true }).click();
  await p.screenshot({
    path: "artifacts/ui-tree-radial-dark.png",
    fullPage: true,
  });
  await writeFile(
    "artifacts/ui-tree-radial.json",
    JSON.stringify(
      {
        result: "passed",
        leftAligned: true,
        colorEntry: true,
        unboundedDrag: samples,
        relationsUnchanged: true,
      },
      null,
      2,
    ),
  );
} finally {
  await b.close();
}
