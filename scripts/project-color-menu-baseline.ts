import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
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
  await p.goto("http://127.0.0.1:4310");
  await p.getByLabel("Username", { exact: true }).fill("leader");
  await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  const heading = p.locator(".project-heading").first();
  await heading.waitFor();
  await p.mouse.move(1000, 10);
  const normal = await heading.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );
  await heading.hover();
  const hovered = await heading.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );
  await heading.click();
  const selected = await heading.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );
  await writeFile(
    "artifacts/project-color-menu-before.json",
    JSON.stringify({ normal, hovered, selected }, null, 2),
  );
  console.log({ normal, hovered, selected });
} finally {
  await browser.close();
}
