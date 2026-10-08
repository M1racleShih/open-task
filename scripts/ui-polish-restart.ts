import { writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = "http://127.0.0.1:4310/api/v1";
const login = await fetch(base + "/sessions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "leader", password: "OpenTask-Test-2026!" }),
});
const cookie = login.headers.getSetCookie()[0].split(";")[0];
const fixture = JSON.parse(
  await readFile("artifacts/ui-polish-fixtures.json", "utf8"),
);
const get = async (path: string) =>
  (await fetch(base + path, { headers: { cookie } })).json();
const projects = await get("/projects");
const data = {
  project: projects.find((p: any) => p.id === fixture.project.id),
  working: await get("/tasks/" + fixture.working.id),
  reviewing: await get("/tasks/" + fixture.reviewing.id),
};
const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
if (process.argv.includes("--before")) {
  await writeFile(
    "artifacts/ui-polish-before-restart.json",
    JSON.stringify({ hash, data }, null, 2),
  );
  console.log(
    "Recorded persisted project, both tasks, submissions and relationships",
  );
} else {
  const previous = JSON.parse(
    await readFile("artifacts/ui-polish-before-restart.json", "utf8"),
  );
  if (previous.hash !== hash)
    throw Error("Persisted fixture changed across application restart");
  await writeFile(
    "artifacts/ui-polish-restart.json",
    JSON.stringify(
      {
        result: "passed",
        hash,
        color: data.project.color,
        workingStage: data.working.task.stage,
        reviewingStage: data.reviewing.task.stage,
      },
      null,
      2,
    ),
  );
  console.log(
    "Application restart: persisted project color, tasks, checklist, blocker, submissions and relations unchanged",
  );
}
