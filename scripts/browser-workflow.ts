import { chromium, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const pages: Record<string, Page> = {};
const contexts = [];
const title = "Browser workflow " + randomUUID().slice(0, 8);
const project = "Browser project " + randomUUID().slice(0, 8);
for (const who of ["leader", "manager", "member"]) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(ctx);
  const p = await ctx.newPage();
  pages[who] = p;
  await p.goto("http://127.0.0.1:4310");
  await p.getByLabel("Username", { exact: true }).fill(who);
  await p.getByLabel("Password", { exact: true }).fill("OpenTask-Test-2026!");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.getByRole("button", { name: "New task", exact: true }).waitFor();
}
const leader = pages.leader,
  manager = pages.manager,
  member = pages.member;
const submit = async (p: Page) => {
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Submit", exact: true })
    .click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
};
const action = async (p: Page, name: string) => {
  await p.getByRole("button", { name, exact: true }).click();
};
await action(leader, "New project");
await leader.getByLabel("Name", { exact: true }).fill(project);
await leader
  .getByLabel("Project manager", { exact: true })
  .selectOption({ label: "Test Project Manager" });
await leader
  .getByLabel("Project members", { exact: true })
  .selectOption([{ label: "Test Member" }]);
await submit(leader);
await member.reload();
await action(member, "New task");
await member.getByLabel("Title", { exact: true }).fill(title);
await member
  .getByRole("dialog")
  .getByLabel("Project", { exact: true })
  .selectOption({ label: project });
await member
  .getByLabel("Owner", { exact: true })
  .selectOption({ label: "Test Member" });
await member
  .getByLabel("Expected result", { exact: true })
  .fill("A real three-role browser result");
await member
  .getByLabel("Acceptance criteria", { exact: true })
  .fill("The reviewer verifies this result");
for (const label of ["Delivery deadline", "Accept by", "Next feedback"])
  await member.getByLabel(label, { exact: true }).fill("2026-10-10T12:00");
await submit(member);
await member.getByRole("button").filter({ hasText: title }).first().click();
await action(member, "Submit for approval");
await submit(member);
const url = member.url();
await manager.goto(url);
await action(manager, "Approve creation");
await submit(manager);
await expect(manager.locator(".status")).toHaveText("Creation approval");
await leader.goto(url);
await action(leader, "Approve creation");
await submit(leader);
await member.reload();
await action(member, "Accept and start");
await submit(member);
await action(member, "Record progress");
await member
  .getByLabel("Current result / message", { exact: true })
  .fill("First result from browser");
await member.getByLabel("Next step", { exact: true }).fill("Submit for review");
await member
  .getByLabel("Next feedback", { exact: true })
  .fill("2026-10-10T13:00");
await submit(member);
await action(member, "Submit result");
await member
  .getByLabel("Current result / message", { exact: true })
  .fill("First submission");
await member.getByLabel("Review by", { exact: true }).fill("2026-10-10T15:00");
await submit(member);
await manager.reload();
await action(manager, "Return result");
await manager.getByLabel("Reason", { exact: true }).fill("Please add evidence");
await manager
  .getByLabel("Next feedback", { exact: true })
  .fill("2026-10-10T14:00");
await submit(manager);
await member.reload();
await action(member, "Submit result");
await member
  .getByLabel("Current result / message", { exact: true })
  .fill("Second submission with evidence");
await member
  .getByLabel("Evidence links (one per line)", { exact: true })
  .fill("https://example.org/evidence");
await member.getByLabel("Review by", { exact: true }).fill("2026-10-10T16:00");
await submit(member);
await manager.reload();
await action(manager, "Accept result");
await submit(manager);
await expect(manager.locator(".status")).toHaveText("Completed");
await manager.screenshot({
  path: "artifacts/browser-completed.png",
  fullPage: true,
});
await manager.getByLabel("Switch theme", { exact: true }).click();
await manager.screenshot({
  path: "artifacts/browser-dark.png",
  fullPage: true,
});
await manager.getByLabel("Language", { exact: true }).selectOption("zh");
const state = await manager.context().storageState();
await manager.context().close();
const reopened = await browser.newContext({
  storageState: state,
  viewport: { width: 390, height: 844 },
});
const p = await reopened.newPage();
await p.goto(url);
await expect(
  p.getByRole("heading", { name: title, exact: true }),
).toBeVisible();
await expect(p.locator(".status")).toHaveText("已完成");
await p.screenshot({
  path: "artifacts/browser-reopened-mobile.png",
  fullPage: true,
});
console.log(
  JSON.stringify({
    result: "passed",
    title,
    url,
    checks: [
      "three-role UI workflow",
      "two approval stages",
      "progress",
      "return and resubmit",
      "review completion",
      "theme",
      "Chinese browser-context reopen",
      "mobile deep link",
    ],
  }),
);
await browser.close();
