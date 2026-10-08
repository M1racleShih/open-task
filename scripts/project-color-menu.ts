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
  await p.locator(".project-heading").first().waitFor();
  const me = await (
    await ctx.request.get("http://127.0.0.1:4310/api/v1/me")
  ).json();
  const response = await ctx.request.post(
    "http://127.0.0.1:4310/api/v1/projects",
    {
      headers: {
        "X-CSRF-Token": me.csrf,
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: {
        name: "[验收示例] Project context menu " + Date.now(),
        managerId: me.user.id,
        memberIds: [],
        color: "#bb66aa",
      },
    },
  );
  expect(response.status()).toBe(200);
  const project = await response.json();
  await p.reload();
  await p.getByLabel("Project", { exact: true }).selectOption(project.id);
  const heading = p.getByRole("button", { name: project.name, exact: true });
  await heading.waitFor();
  await expect(p.locator(".project-color-button")).toHaveCount(0);
  await heading.click({ button: "right" });
  await expect(p.getByRole("menu")).toBeVisible();
  await expect(
    p.getByRole("menuitem", { name: "Project color", exact: true }),
  ).toBeFocused();
  await p.screenshot({
    path: "artifacts/project-color-context-light.png",
    fullPage: true,
  });
  await p.keyboard.press("Escape");
  await expect(p.getByRole("menu")).toHaveCount(0);
  await expect(heading).toBeFocused();
  await p.keyboard.press("Shift+F10");
  await p.getByRole("menuitem", { name: "Project color", exact: true }).click();
  const d = p.getByRole("dialog");
  await d.getByLabel("Project color", { exact: true }).fill("#51a090");
  await d.getByRole("button", { name: "Submit", exact: true }).click();
  await d.waitFor({ state: "hidden" });
  const checks = [];
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await p.getByLabel("Switch theme", { exact: true }).click();
    await p.mouse.move(1100, 15);
    const base = await heading.evaluate(
      (e) => getComputedStyle(e).backgroundColor,
    );
    await heading.hover();
    expect(
      await heading.evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe(base);
    await heading.click();
    expect(
      await heading.evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe(base);
    await heading.click();
    expect(
      await heading.evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe(base);
    const saved = (
      await (
        await ctx.request.get("http://127.0.0.1:4310/api/v1/projects")
      ).json()
    ).find((x: any) => x.id === project.id);
    expect(saved.color).toBe("#51a090");
    checks.push({ theme, background: base, color: saved.color });
  }
  await heading.click({ button: "right" });
  await p.screenshot({
    path: "artifacts/project-color-context-dark.png",
    fullPage: true,
  });
  await p.locator(".top strong").click();
  await expect(p.getByRole("menu")).toHaveCount(0);
  await p.reload();
  await p.getByLabel("Project", { exact: true }).selectOption(project.id);
  await heading.click({ button: "right" });
  await p.getByRole("menuitem", { name: "Project color", exact: true }).click();
  await expect(d.getByLabel("Project color", { exact: true })).toHaveValue(
    "#51a090",
  );
  await d.getByRole("button", { name: "Close", exact: true }).click();
  const other = await browser.newContext();
  const page = await other.newPage();
  await page.goto("http://127.0.0.1:4310");
  await page.getByLabel("Username", { exact: true }).fill("other");
  await page
    .getByLabel("Password", { exact: true })
    .fill("OpenTask-Test-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Project", { exact: true }).selectOption(project.id);
  const restricted = page.getByRole("button", {
    name: project.name,
    exact: true,
  });
  await expect(restricted).not.toHaveAttribute("aria-haspopup", "menu");
  await restricted.click({ button: "right" });
  await expect(page.getByRole("menu")).toHaveCount(0);
  await writeFile(
    "artifacts/project-color-menu.json",
    JSON.stringify(
      {
        result: "passed",
        keyboardAndDismiss: true,
        noStandaloneColorRow: true,
        projectId: project.id,
        checks,
        reloadPersistence: true,
        permissionsPreserved: true,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
