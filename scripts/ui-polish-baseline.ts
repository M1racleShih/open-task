import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const b = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const p = await b.newPage({
  locale: "zh-CN",
  viewport: { width: 1440, height: 1000 },
});
await p.goto("http://127.0.0.1:4310");
await p.getByLabel("Username", { exact: true }).fill("leader");
await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
await p.getByRole("button", { name: "Sign in", exact: true }).click();
await p.locator(".node").first().waitFor();
const s = p.locator(".graph-scroll");
const before = await s.evaluate((e) => ({
  left: e.scrollLeft,
  top: e.scrollTop,
  width: e.clientWidth,
  scrollWidth: e.scrollWidth,
}));
const box = (await s.boundingBox())!;
await p.mouse.move(box.x + 12, box.y + 12);
await p.mouse.down();
await p.mouse.move(box.x + 92, box.y + 92, { steps: 10 });
await p.mouse.up();
const after = await s.evaluate((e) => ({
  left: e.scrollLeft,
  top: e.scrollTop,
}));
const w = await p.locator(".graph-scroll svg").getAttribute("width");
await p.mouse.wheel(0, -300);
await p.screenshot({ path: "artifacts/ui-polish-before.png" });
await p.getByRole("button", { name: "New task", exact: true }).click();
await p.screenshot({ path: "artifacts/ui-polish-date-before.png" });
writeFileSync(
  "artifacts/ui-polish-baseline.json",
  JSON.stringify(
    {
      before,
      after,
      widthBefore: w,
      widthAfter: await p.locator(".graph-scroll svg").getAttribute("width"),
      dateType: await p
        .getByLabel("Delivery deadline", { exact: true })
        .getAttribute("type"),
    },
    null,
    2,
  ),
);
await b.close();
