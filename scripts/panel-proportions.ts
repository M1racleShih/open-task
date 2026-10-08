import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const p = await browser.newPage({ viewport: { width: 2116, height: 1109 } });
  await p.goto(
    "http://127.0.0.1:4310/?task=58c649c9-740c-433f-9134-f7725a6b4b4e",
  );
  await p.getByLabel("Username", { exact: true }).fill("leader");
  await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.locator(".checklist-card").waitFor();
  const measure = () =>
    p.evaluate(() =>
      Object.fromEntries(
        ["tree", "details", "bottom", "center"].map((c) => {
          const r = document.querySelector("." + c)!.getBoundingClientRect();
          return [c, { width: r.width, height: r.height }];
        }),
      ),
    );
  const wide = await measure();
  expect(wide.tree.width).toBeCloseTo(423, 0);
  expect(wide.details.width).toBeCloseTo(592, 0);
  expect(wide.bottom.height / wide.center.height).toBeGreaterThan(0.3);
  expect(wide.bottom.height / wide.center.height).toBeLessThan(0.34);
  await p.screenshot({
    path: "artifacts/panel-proportions-wide.png",
    fullPage: true,
  });
  await p.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    p.getByRole("separator", { name: "Task tree", exact: true }),
  ).toHaveAttribute("aria-valuenow", "288");
  const compact = await measure();
  expect(compact.tree.width).toBeCloseTo(288, 0);
  await p.getByRole("separator", { name: "Task tree", exact: true }).focus();
  await p.keyboard.press("ArrowRight");
  await expect(
    p.getByRole("separator", { name: "Task tree", exact: true }),
  ).toHaveAttribute("aria-valuenow", "298");
  await p.setViewportSize({ width: 1600, height: 1000 });
  await expect(
    p.getByRole("separator", { name: "Task tree", exact: true }),
  ).toHaveAttribute("aria-valuenow", "298");
  await p.setViewportSize({ width: 390, height: 844 });
  expect(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await p.screenshot({
    path: "artifacts/panel-proportions-mobile.png",
    fullPage: true,
  });
  await writeFile(
    "artifacts/panel-proportions.json",
    JSON.stringify(
      {
        result: "passed",
        wide,
        compact,
        manualResizePreserved: true,
        mobileNoOverflow: true,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
