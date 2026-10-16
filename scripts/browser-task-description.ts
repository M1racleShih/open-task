/** Real description/editor/form components with synthetic text and a mocked API. No DB. */
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = root + "artifacts/task-description";
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  appType: "custom",
  root: root + "web",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4342,
    strictPort: true,
    fs: { allow: [root] },
  },
});
server.middlewares.use("/description-test", async (_req, res, next) => {
  try {
    res.setHeader("Content-Type", "text/html");
    res.end(
      await server.transformIndexHtml(
        "/description-test",
        `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${root}tests/fixtures/task-description.tsx"></script></body></html>`,
      ),
    );
  } catch (error) {
    next(error);
  }
});
await server.listen();
let browser;
const checks: string[] = [];
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
    env: {
      ...process.env,
      XDG_CONFIG_HOME: "/tmp/open-task-description-chrome",
    },
  });
  for (const lang of ["en", "zh"] as const) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(
      (language) => localStorage.setItem("open-task.language", language),
      lang,
    );
    const page = await context.newPage();
    const errors: string[] = [];
    const remoteRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("invalid.example"))
        remoteRequests.push(request.url());
    });
    let requests: Record<string, string>[] = [];
    await page.route("**/api/v1/markdown-test", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ json: requests.at(-1) });
    });
    await page.goto("http://127.0.0.1:4342/description-test");
    const en = lang === "en";
    const outcome = en ? "Expected result" : "预期结果";
    const edit = en ? "Edit draft" : "修改草稿";
    const preview = en ? "Preview" : "预览";
    const editMode = en ? "Edit" : "编辑";
    const submit = en ? "Submit" : "提交";
    const source = JSON.parse((await page.getByTestId("saved").textContent())!);
    // Read layout matrix, including narrow and wide inspector equivalents.
    for (const width of [1440, 860, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (value) => (document.documentElement.dataset.theme = value),
          theme,
        );
        for (const wide of [false, true]) {
          if (wide)
            await page
              .getByRole("button", { name: "Width", exact: true })
              .click();
          const scope = page.locator(".task-scope");
          await expect(scope).not.toHaveAttribute("open", "");
          await scope.locator("summary").focus();
          await page.keyboard.press("Enter");
          await expect(scope).toHaveAttribute("open", "");
          await expect(
            page.locator('.task-description input[type="checkbox"]'),
          ).toBeDisabled();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          expect(
            await page
              .locator(".task-prose .markdown")
              .first()
              .evaluate((el) => el.getBoundingClientRect().width),
          ).toBeLessThanOrEqual(800);
          expect(
            await page
              .locator(".task-description .markdown pre")
              .evaluate((el) => el.scrollWidth > el.clientWidth),
          ).toBe(true);
          await page.screenshot({
            path: `${output}/${lang}-${theme}-${width}-${wide ? "wide" : "narrow"}.png`,
            fullPage: true,
          });
          await scope.locator("summary").press("Enter");
          if (wide)
            await page
              .getByRole("button", { name: "Width", exact: true })
              .click();
          checks.push(
            `${lang}/${theme}/${width}/${wide ? "wide" : "narrow"}: readable prose, local overflow, keyboard scope, disabled checkbox`,
          );
        }
      }
    }
    // Preview and untouched submit preserve exact source, including newlines and malicious text.
    await page.getByRole("button", { name: edit, exact: true }).click();
    let editor = page.locator(".markdown-editor").first();
    let input = page.getByRole("textbox", { name: outcome, exact: true });
    await expect(input).toHaveValue(source.outcome);
    // CRLF source uses normalized DOM offsets without rewriting stored line endings.
    const criteria = page.getByRole("textbox", {
      name: en ? "Acceptance criteria" : "验收标准",
      exact: true,
    });
    const normalizedCriteria = source.criteria.replace(/\r\n/g, "\n");
    const selectionStart = normalizedCriteria.indexOf("Preserve source");
    await criteria.focus();
    await criteria.evaluate(
      (el: HTMLTextAreaElement, start) =>
        el.setSelectionRange(start, start + "Preserve source".length),
      selectionStart,
    );
    await criteria.press("Meta+b");
    await expect(criteria).toHaveValue(
      normalizedCriteria.replace("Preserve source", "**Preserve source**"),
    );
    expect(
      await criteria.evaluate((el: HTMLTextAreaElement) =>
        el.value.slice(el.selectionStart, el.selectionEnd),
      ),
    ).toBe("Preserve source");
    await criteria.fill(normalizedCriteria);
    await input.focus();
    await input.evaluate((el: HTMLTextAreaElement) =>
      el.setSelectionRange(3, 15, "backward"),
    );
    await editor.getByRole("button", { name: preview, exact: true }).click();
    await expect(editor.locator("textarea")).toBeHidden();
    await expect(editor.locator("input[type=checkbox]")).toBeDisabled();
    await page.screenshot({
      path: `${output}/${lang}-mobile-editor-preview.png`,
      fullPage: true,
    });
    await editor.getByRole("button", { name: editMode, exact: true }).click();
    await expect(input).toBeFocused();
    expect(
      await input.evaluate((el: HTMLTextAreaElement) => [
        el.selectionStart,
        el.selectionEnd,
      ]),
    ).toEqual([3, 15]);
    expect(
      await input.evaluate((el: HTMLTextAreaElement) => el.selectionDirection),
    ).toBe("backward");
    await expect(input).toHaveValue(source.outcome);
    await page.getByRole("button", { name: submit, exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(requests[0]).toEqual(source);
    await page.getByRole("button", { name: edit, exact: true }).click();
    editor = page.locator(".markdown-editor").first();
    input = page.getByRole("textbox", { name: outcome, exact: true });
    const raw = "前🙂 selected\nsecond line\n尾 ";
    await input.fill(raw);
    await input.evaluate((el: HTMLTextAreaElement) =>
      el.setSelectionRange(4, 12),
    );
    // Pointer command preserves selection after toolbar takes focus.
    await editor
      .getByRole("button", { name: en ? "Bold" : "加粗", exact: true })
      .click();
    await expect(input).toHaveValue("前🙂 **selected**\nsecond line\n尾 ");
    expect(
      await input.evaluate((el: HTMLTextAreaElement) =>
        el.value.slice(el.selectionStart, el.selectionEnd),
      ),
    ).toBe("selected");
    await input.press("Control+k");
    expect(
      await input.evaluate((el: HTMLTextAreaElement) =>
        el.value.slice(el.selectionStart, el.selectionEnd),
      ),
    ).toBe("https://");
    await page.keyboard.insertText("https://example.com/review");
    const linked =
      "前🙂 **[selected](https://example.com/review)**\nsecond line\n尾 ";
    await expect(input).toHaveValue(linked);
    await input.fill("one\ntwo\nthree");
    await input.evaluate((el: HTMLTextAreaElement) =>
      el.setSelectionRange(0, 8),
    );
    await input.press("Control+Shift+8");
    await expect(input).toHaveValue("- one\n- two\nthree");
    // A keyboard-focused toolbar command applies at the caret without submitting.
    await input.evaluate((el: HTMLTextAreaElement) =>
      el.setSelectionRange(el.value.length, el.value.length),
    );
    await editor
      .getByRole("button", { name: en ? "Bold" : "加粗", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(input).toHaveValue("- one\n- two\nthree****");
    expect(requests.length).toBe(1);
    const final =
      "# Heading\n\n**Intentional Markdown**\n普通换行\nNext line\n\n- [ ] only prose\n\n尾 ";
    await input.fill(final);
    for (const width of [1440, 860, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (value) => (document.documentElement.dataset.theme = value),
          theme,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await input.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${output}/${lang}-${theme}-${width}-editor.png`,
        });
      }
    }
    await page.getByRole("button", { name: submit, exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(requests[1]).toEqual({ ...source, outcome: final });
    await page.getByRole("button", { name: edit, exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: outcome, exact: true }),
    ).toHaveValue(final);
    expect(remoteRequests).toEqual([]);
    expect(await page.evaluate(() => (window as any).UNSAFE)).toBeUndefined();
    expect(errors).toEqual([]);
    checks.push(
      `${lang}: selected text/caret, pointer and keyboard formatting, preview selection, untouched/exact save and reopen; no image requests or executable markup; no page errors`,
    );
    await context.close();
  }
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      { database: "none; mocked /api/v1/markdown-test", checks },
      null,
      2,
    ),
  );
  console.log(
    `PASS ${checks.length} checks; screenshots and results: ${output}`,
  );
} finally {
  await browser?.close();
  await server.close();
}
