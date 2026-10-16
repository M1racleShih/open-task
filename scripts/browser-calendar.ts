/** Isolated UI contract test: real form/filter components, mocked API, no database. */
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({
  configFile: false,
  appType: "custom",
  root: root + "web",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, fs: { allow: [root] } },
});
server.middlewares.use("/calendar-test", async (_req, res, next) => {
  try {
    res.setHeader("Content-Type", "text/html");
    res.end(
      await server.transformIndexHtml(
        "/calendar-test",
        `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${root}tests/fixtures/calendar.tsx"></script></body></html>`,
      ),
    );
  } catch (error) {
    next(error);
  }
});
await server.listen();
const address = server.httpServer!.address();
if (!address || typeof address === "string")
  throw new Error("Missing server address");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
  env: { ...process.env, XDG_CONFIG_HOME: "/tmp/open-task-calendar-chrome" },
});
const output = root + "artifacts/calendar";
await mkdir(output, { recursive: true });
const checks: string[] = [];
try {
  for (const lang of ["en", "zh"] as const) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
    });
    await context.addInitScript(
      (language) => localStorage.setItem("open-task.language", language),
      lang,
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let requests: Record<string, string>[] = [];
    await page.route("**/api/v1/calendar-test", async (route) => {
      const data = route.request().postDataJSON();
      requests.push(data);
      await route.fulfill({ json: data });
    });
    await page.goto(`http://127.0.0.1:${address.port}/calendar-test`);
    const en = lang === "en";
    const plannedLabel = en ? "Planned start (optional)" : "计划开始（可选）";
    const deadlineLabel = en ? "Delivery deadline" : "交付期限";
    const acceptLabel = en ? "Accept by" : "接收期限";
    const choose = (label: string) =>
      page.getByRole("button", {
        name: `${en ? "Choose date" : "选择日期"} · ${label}`,
        exact: true,
      });
    const confirm = () =>
      page.getByRole("button", { name: en ? "Confirm" : "确认", exact: true });
    const cancel = () =>
      page.getByRole("button", { name: en ? "Cancel" : "取消", exact: true });
    const submit = () =>
      page.getByRole("button", { name: en ? "Submit" : "提交", exact: true });
    const picker = () => page.locator("dialog.calendar-picker");
    await expect(page.getByLabel(plannedLabel, { exact: true })).toHaveValue(
      "2026-10-16 12:00",
    );
    // Unedited instants retain their seconds and milliseconds.
    await submit().click();
    await expect(page.getByTestId("saved")).toContainText(
      "2026-10-16T04:00:39.123Z",
    );
    await page.getByRole("button", { name: "Task form", exact: true }).click();
    const planned = page.getByLabel(plannedLabel, { exact: true });
    await expect(page.locator(".modal .date-input")).toHaveCount(6);
    await planned.fill("2026-02-29 12:00");
    await expect(planned).toHaveAttribute("aria-invalid", "true");
    await submit().click();
    expect(requests.length).toBe(1);
    await planned.fill("2026-12-31T23:59");
    await choose(plannedLabel).click();
    await expect(
      picker().getByRole("button", { name: "2026-12-31", exact: true }),
    ).toBeFocused();
    await picker()
      .getByRole("button", { name: "2026-12-31", exact: true })
      .press("ArrowRight");
    await expect(
      picker().getByRole("button", { name: "2027-01-01", exact: true }),
    ).toBeFocused();
    await picker()
      .getByRole("button", { name: "2027-01-01", exact: true })
      .press("Enter");
    await confirm().click();
    await expect(planned).toHaveValue("2027-01-01 23:59");
    await expect(choose(plannedLabel)).toBeFocused();
    // Draft picker changes and Escape do not overwrite text or submit the form.
    await choose(plannedLabel).click();
    await page
      .getByLabel(en ? "Month" : "月份", { exact: true })
      .selectOption("1");
    await page.getByRole("button", { name: "2027-02-14", exact: true }).click();
    await cancel().click();
    await expect(planned).toHaveValue("2027-01-01 23:59");
    await choose(plannedLabel).click();
    await page.keyboard.press("Escape");
    await expect(picker()).toHaveCount(0);
    await expect(choose(plannedLabel)).toBeFocused();
    await choose(plannedLabel).click();
    await page.mouse.click(1, 1);
    await expect(picker()).toHaveCount(0);
    await expect(planned).toHaveValue("2027-01-01 23:59");
    // Empty datetime requires both an explicit date and complete time.
    await choose(acceptLabel).click();
    await expect(confirm()).toBeDisabled();
    await page.getByLabel(en ? "Year" : "年份", { exact: true }).fill("2028");
    await page
      .getByLabel(en ? "Month" : "月份", { exact: true })
      .selectOption("1");
    await page.getByRole("button", { name: "2028-02-29", exact: true }).click();
    await expect(confirm()).toBeDisabled();
    await page
      .getByLabel(en ? "Hour (24-hour)" : "小时（24 小时制）", { exact: true })
      .selectOption("08");
    await expect(confirm()).toBeDisabled();
    await page
      .getByLabel(en ? "Minute" : "分钟", { exact: true })
      .selectOption("05");
    await confirm().click();
    await expect(page.getByLabel(acceptLabel, { exact: true })).toHaveValue(
      "2028-02-29 08:05",
    );
    // Clear removes a value. Reopening does not fabricate a time.
    await choose(acceptLabel).click();
    await page
      .getByRole("button", { name: en ? "Clear" : "清空", exact: true })
      .click();
    await expect(page.getByLabel(acceptLabel, { exact: true })).toHaveValue("");
    await choose(acceptLabel).click();
    await expect(confirm()).toBeDisabled();
    await cancel().click();
    // Native dialog traps keyboard focus and fits a narrow mobile screen.
    await page.setViewportSize({ width: 375, height: 667 });
    expect(
      (await page.locator(".modal").boundingBox())!.width,
    ).toBeLessThanOrEqual(375);
    await choose(deadlineLabel).click();
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest("dialog.calendar-picker"),
        ),
      ).toBe(true);
    }
    const box = await picker().boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    await page.screenshot({ path: output + `/${lang}-mobile.png` });
    await cancel().click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await choose(deadlineLabel).click();
    await page.screenshot({ path: output + `/${lang}-desktop.png` });
    await cancel().click();
    await submit().click();
    await expect(page.locator(".modal")).toHaveCount(0);
    expect(requests.length).toBe(2);
    expect(requests[1].plannedStart).toBe("2027-01-01T15:59:00.000Z");
    expect(requests[1].acceptBy).toBe("");
    // Date-only filters share the calendar without a time selector.
    await page.locator(".time-filter summary").click();
    const fromLabel = en ? "From date" : "开始日期";
    const throughLabel = en ? "Through date" : "结束日期";
    await choose(fromLabel).click();
    await expect(picker().locator(".calendar-clock")).toHaveCount(0);
    await page.getByRole("button", { name: "2026-10-02", exact: true }).click();
    await confirm().click();
    await expect(page.getByLabel(fromLabel, { exact: true })).toHaveValue(
      "2026-10-02",
    );
    const end = page.getByLabel(throughLabel, { exact: true });
    await end.fill("2026-02-29");
    await page
      .getByRole("button", {
        name: en ? "Apply range" : "应用范围",
        exact: true,
      })
      .click();
    await expect(end).toHaveAttribute("aria-invalid", "true");
    await end.fill("");
    expect(
      await end.evaluate(
        (node: HTMLInputElement) => node.validity.valueMissing,
      ),
    ).toBe(true);
    await end.fill("2026-10-31");
    await page
      .getByRole("button", {
        name: en ? "Apply range" : "应用范围",
        exact: true,
      })
      .click();
    await expect(page.locator(".time-filter summary")).toContainText(
      "2026-10-02",
    );
    await end.fill("unfinished");
    await page
      .getByRole("button", { name: "Switch project", exact: true })
      .click();
    await expect(end).toHaveValue("2026-10-31");
    expect(errors).toEqual([]);
    checks.push(
      `${lang}: text/calendar sync, unchanged precision, validation, keyboard/year rollover, leap day, cancel/Escape/backdrop, focus restoration/trap, clear, mobile, filters and project reset`,
    );
    await context.close();
  }
  console.log(checks.join("\n"));
  console.log(
    "PASS: calendar browser contracts (English/Chinese, America/Los_Angeles system timezone)",
  );
} finally {
  await browser.close();
  await server.close();
}
