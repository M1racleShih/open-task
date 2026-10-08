import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  locale: "zh-CN",
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:4310");
await page.getByRole("heading", { name: "Sign in" }).waitFor();
await page.getByLabel("Username", { exact: true }).fill("leader");
await page.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.getByRole("button", { name: "New task", exact: true }).waitFor();
await page.screenshot({ path: "artifacts/workspace-en.png", fullPage: true });
await page.getByLabel("Language", { exact: true }).selectOption("zh");
await page.getByRole("button", { name: "新建任务", exact: true }).waitFor();
await page.reload();
await page.getByRole("button", { name: "新建任务", exact: true }).waitFor();
await page.screenshot({ path: "artifacts/workspace-zh.png", fullPage: true });
await page.getByRole("button", { name: "新建任务", exact: true }).click();
await page.getByLabel("标题", { exact: true }).fill("Browser 验收 task");
await page
  .getByRole("dialog")
  .getByRole("button", { name: "提交", exact: true })
  .click();
await page.getByRole("dialog").waitFor({ state: "hidden" });
await page
  .getByRole("button")
  .filter({ hasText: "Browser 验收 task" })
  .first()
  .click();
await page
  .getByRole("heading", { name: "Browser 验收 task", exact: true })
  .waitFor();
await page.getByRole("button", { name: "下发任务", exact: true }).click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: "提交", exact: true })
  .click();
await page.getByRole("alert").waitFor();
await page.screenshot({ path: "artifacts/validation-zh.png", fullPage: true });
await page
  .getByRole("dialog")
  .getByRole("button", { name: "关闭", exact: true })
  .click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "artifacts/mobile-zh.png", fullPage: true });
await page.getByLabel("语言", { exact: true }).selectOption("en");
await page.getByRole("button", { name: "Task details", exact: true }).waitFor();
await page.reload();
await page
  .getByRole("heading", { name: "Browser 验收 task", exact: true })
  .waitFor();
await page.screenshot({ path: "artifacts/mobile-en.png", fullPage: true });
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "Browser: default English with Chinese browser locale; login; both language directions and reload; persisted draft; real required-field failure; mobile direct task link; no page errors.",
);
await browser.close();
