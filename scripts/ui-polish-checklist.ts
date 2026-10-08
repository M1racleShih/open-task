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
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const p = await ctx.newPage();
  await p.goto(fixture.working.url);
  await p.getByLabel("Username", { exact: true }).fill("member");
  await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  const checks = p.locator(".checklist-card input[type=checkbox]");
  await expect(checks).toHaveCount(3);
  for (const index of [1, 2]) {
    if (await checks.nth(index).isChecked()) {
      await checks.nth(index).click();
      await expect(checks.nth(index)).not.toBeChecked();
    }
  }
  await expect(p.locator(".checklist-card progress")).toHaveAttribute(
    "value",
    "1",
  );
  await checks.nth(1).click();
  await expect(checks.nth(1)).toBeChecked();
  await expect(p.locator(".checklist-card progress")).toHaveAttribute(
    "value",
    "2",
  );
  await checks.nth(2).click();
  await expect(checks.nth(2)).toBeChecked();
  await expect(p.locator(".checklist-card h3")).toContainText("100%");
  await expect(p.locator(".status")).toHaveText("In progress");
  const data = await (
    await ctx.request.get(
      "http://127.0.0.1:4310/api/v1/tasks/" + fixture.working.id,
    )
  ).json();
  expect(data.task.stage).toBe("working");
  expect(data.task.blocks[0].resolved).toBe(false);
  await checks.nth(2).click();
  await expect(checks.nth(2)).not.toBeChecked();
  await expect(p.locator(".checklist-card progress")).toHaveAttribute(
    "value",
    "2",
  );
  await checks.nth(1).click();
  await expect(checks.nth(1)).not.toBeChecked();
  await expect(p.locator(".checklist-card progress")).toHaveAttribute(
    "value",
    "1",
  );
  await p
    .locator(".context-tabs")
    .getByRole("button", { name: /Blockers/ })
    .click();
  await expect(
    p.getByRole("button", { name: "Resolve blocker", exact: true }),
  ).toBeVisible();
  await writeFile(
    "artifacts/ui-polish-checklist.json",
    JSON.stringify(
      {
        result: "passed",
        counts: [1, 2, 3, 2, 1],
        allDoneStillWorking: true,
        blockNotResolved: true,
        ownerResolveControl: true,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
