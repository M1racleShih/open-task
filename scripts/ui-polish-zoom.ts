import { chromium, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
const profile = await mkdtemp("/tmp/open-task-zoom-");
await mkdir(profile + "/Default");
await writeFile(
  profile + "/Default/Preferences",
  JSON.stringify({
    partition: { default_zoom_level: Math.log(1.25) / Math.log(1.2) },
  }),
);
const ctx = await chromium.launchPersistentContext(profile, {
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  viewport: null,
  args: ["--no-sandbox", "--window-size=1440,1000"],
});
try {
  const fixture = JSON.parse(
    await readFile("artifacts/ui-polish-fixtures.json", "utf8"),
  );
  const p = await ctx.newPage();
  await p.goto("chrome://settings/appearance");
  await p.locator("#zoomLevel").selectOption("1.25");
  await p.goto(fixture.working.url);
  await p.getByLabel("Username", { exact: true }).fill("manager");
  await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.locator(".checklist-card").waitFor();
  const metrics = await p.evaluate(() => ({
    dpr: devicePixelRatio,
    width: innerWidth,
    height: innerHeight,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(metrics.dpr).toBeCloseTo(1.25, 2);
  expect(metrics.overflow).toBe(false);
  await p
    .getByLabel("Project", { exact: true })
    .selectOption(fixture.project.id);
  await p.getByRole("button", { name: "Fit view", exact: true }).click();
  await p.locator(".detail-scroll").evaluate((e) => {
    e.scrollTop = 0;
  });
  await p.screenshot({
    path: "artifacts/ui-polish-browser-zoom125.png",
    fullPage: true,
  });
  await writeFile(
    "artifacts/ui-polish-zoom.json",
    JSON.stringify(
      { result: "passed", browserZoom: "125%", ...metrics },
      null,
      2,
    ),
  );
  console.log(metrics);
} finally {
  await ctx.close();
  await rm(profile, { recursive: true, force: true });
}
