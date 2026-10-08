import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4310/api/v1";
const actors: Record<string, any> = {};
for (const username of ["leader", "manager", "member"]) {
  const res = await fetch(base + "/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password: "OpenTask-Test-2026!" }),
  });
  actors[username] = {
    ...(await res.json()),
    cookie: res.headers.getSetCookie()[0].split(";")[0],
  };
}
async function api(who: string, path: string, body?: any) {
  const a = actors[who];
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie: a.cookie,
      "x-csrf-token": a.csrf,
      "idempotency-key": randomUUID(),
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}
const stamp = new Date().toISOString().slice(0, 16);
const project = await api("leader", "/projects", {
  name: "[验收示例 / UI acceptance] " + stamp,
  managerId: actors.manager.user.id,
  memberIds: [actors.member.user.id],
  color: "#8b78b5",
});
const future = new Date(Date.now() + 7 * 86400000).toISOString();
async function action(who: string, t: any, name: string, body = {}) {
  return api(who, `/tasks/${t.id}/actions/${name}`, {
    version: t.version,
    ...body,
  });
}
async function task(title: string) {
  let t = await api("leader", "/tasks", {
    title: "[验收示例] " + title,
    projectId: project.id,
    ownerId: actors.member.user.id,
    reviewerId: "",
    outcome:
      "真实 API 与数据库保存的界面验收示例 / Persisted UI acceptance example",
    criteria: "检查清单、关联、阻塞与成果；示例不代表真实业务进度。",
    deadline: future,
    acceptBy: future,
    feedbackBy: future,
  });
  t = await action("leader", t, "issue");
  return action("member", t, "acceptStart");
}
let working = await task("执行清单与阻塞 / Checklist & blocker");
working = await action("member", working, "requestChecklist", {
  items: [
    "确认需求 / Confirm requirements",
    "准备交付 / Prepare delivery",
    "复核结果 / Verify result",
  ].map((text) => ({ id: randomUUID(), text })),
  scopeChanged: false,
  reason: "验收示例：展示真实清单进度",
});
working = await action("leader", working, "approveChecklist", {
  requestId: working.checklistRequests.at(-1).id,
});
working = await action("member", working, "toggle", {
  itemId: working.checklist[0].id,
  expectedDone: false,
  done: true,
});
working = await action("member", working, "block", {
  helperId: actors.manager.user.id,
  reason: "验收示例：等待示例资料确认",
  help: "请确认演示资料完整性",
});
working = await action("manager", working, "replyBlock", {
  blockId: working.blocks[0].id,
  text: "验收示例：协助回复已保存，仍需任务负责人明确解除。",
});
let reviewing = await task("成果待验收 / Result awaiting review");
reviewing = await action("member", reviewing, "submitResult", {
  text: "验收示例成果：已整理界面验收说明。此任务保持待验收，可由 manager 检查通过或退回入口。",
  links: ["http://127.0.0.1:4310/?task=" + working.id],
  reviewBy: future,
});
await api("leader", `/tasks/${working.id}/relations`, {
  version: working.version,
  targetId: reviewing.id,
  kind: "related",
  reason: "验收示例：关联执行与成果任务",
});
const output = {
  project,
  working: {
    id: working.id,
    number: working.number,
    url: "http://127.0.0.1:4310/?task=" + working.id,
  },
  reviewing: {
    id: reviewing.id,
    number: reviewing.number,
    url: "http://127.0.0.1:4310/?task=" + reviewing.id,
  },
};
await writeFile(
  "artifacts/ui-polish-fixtures.json",
  JSON.stringify(output, null, 2),
);
console.log(JSON.stringify(output, null, 2));
