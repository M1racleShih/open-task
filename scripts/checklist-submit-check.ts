import { chromium, expect } from "@playwright/test";
import pg from "pg";
const db = new pg.Pool({
  connectionString:
    "postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_test",
});
const { rows } = await db.query(
  "SELECT data FROM tasks WHERE data->'checklist'->0->>'text'='Batch item' ORDER BY number DESC LIMIT 1",
);
await db.end();
const task = rows[0].data;
task.checklist.forEach((i: any) => (i.done = false));
const me = {
  id: task.ownerId,
  username: "member",
  name: "Member",
  roles: ["member"],
  active: true,
};
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  let writes = 0,
    fail = true;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    let data: any = { items: [], nextCursor: null };
    if (path === "/me") data = { user: me };
    else if (path === "/users") data = [me];
    else if (path === "/projects") data = [];
    else if (path === "/tasks") data = { items: [task], nextCursor: null };
    else if (path === `/tasks/${task.id}`)
      data = { task, relations: [], targets: [] };
    else if (path.endsWith("/actions/toggle")) {
      writes++;
      if (fail)
        return route.fulfill({
          status: 409,
          json: { error: { code: "versionConflict" } },
        });
      const body = route.request().postDataJSON();
      expect(body.changes).toHaveLength(2);
      for (const change of body.changes)
        task.checklist.find((i: any) => i.id === change.itemId).done =
          change.done;
      data = task;
    }
    await route.fulfill({ json: data });
  });
  await page.goto(`http://127.0.0.1:4310/?task=${task.id}`);
  const boxes = page.locator('.checklist-card input[type="checkbox"]');
  await expect(boxes).toHaveCount(2);
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  expect(writes).toBe(0);
  await expect(page.locator(".checklist-card progress")).toHaveAttribute(
    "value",
    "0",
  );
  await page
    .getByRole("button", { name: "Confirm submission", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(boxes.nth(0)).toBeChecked();
  await expect(boxes.nth(1)).toBeChecked();
  await expect(page.locator(".checklist-card progress")).toHaveAttribute(
    "value",
    "0",
  );
  fail = false;
  await page
    .getByRole("button", { name: "Confirm submission", exact: true })
    .click();
  await expect(page.locator(".checklist-card progress")).toHaveAttribute(
    "value",
    "2",
  );
  await expect(
    page.getByRole("button", { name: "Confirm submission", exact: true }),
  ).toBeDisabled();
  await boxes.nth(0).uncheck();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  let prompted = false;
  page.once("dialog", async (dialog) => {
    prompted = true;
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  expect(prompted).toBe(true);
  await expect(boxes.nth(0)).not.toBeChecked();
  console.log(
    "PASS: no write on tick; failed submission retains draft; batch retry updates progress; leaving prompts.",
  );
} finally {
  await browser.close();
}
