import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  type Client,
  task,
  relations,
  event,
  save,
  isLeader,
  requireLeader,
} from "./store.js";
import type { User, Relation } from "../shared/model.js";
import { ensure } from "./errors.js";
export async function changeRelation(c: Client, u: User, id: string, b: any) {
  const t = await task(c, id, u);
  ensure(
    isLeader(u) || (t.stage === "draft" && t.creatorId === u.id),
    "forbidden",
    403,
  );
  ensure(b.version === t.version, "versionConflict", 409);
  ensure(typeof b.reason === "string" && b.reason.trim(), "reasonRequired");
  const target = await task(c, z.string().uuid().parse(b.targetId), u);
  ensure(id !== target.id, "relationCycle", 409);
  ensure(
    t.stage === "draft" || target.stage !== "draft",
    "privateRelation",
    409,
  );
  const kind = z.enum(["parent", "dependency", "related"]).parse(b.kind);
  let rs = await relations(c);
  let sourceId = id,
    targetId = target.id;
  if (kind === "related" && sourceId > targetId)
    [sourceId, targetId] = [targetId, sourceId];
  const existing = rs.find(
    (r) =>
      ((r.sourceId === sourceId && r.targetId === targetId) ||
        (b.remove &&
          isLeader(u) &&
          r.sourceId === targetId &&
          r.targetId === sourceId)) &&
      r.kind === kind,
  );
  if (b.remove) {
    ensure(existing, "notFound", 404);
    if (kind === "dependency") requireLeader(u);
    await c.query("DELETE FROM relations WHERE id=$1", [existing.id]);
  } else {
    ensure(!existing, "duplicateRelation", 409);
    ensure(
      kind !== "parent" ||
        !rs.some((r) => r.kind === "parent" && r.sourceId === sourceId),
      "oneParent",
      409,
    );
    const added = { id: randomUUID(), sourceId, targetId, kind };
    rs = [...rs, added];
    const reaches = (a: string, b: string, k: string) => {
      const seen = new Set<string>();
      const queue = [a];
      while (queue.length) {
        const n = queue.pop()!;
        if (n === b) return true;
        if (seen.has(n)) continue;
        seen.add(n);
        for (const r of rs)
          if (r.kind === k && r.sourceId === n) queue.push(r.targetId);
      }
      return false;
    };
    for (const k of ["parent", "dependency"])
      for (const r of rs.filter((r) => r.kind === k))
        ensure(!reaches(r.targetId, r.sourceId, k), "relationCycle", 409);
    for (const r of rs.filter((r) => r.kind === "dependency"))
      ensure(
        !reaches(r.sourceId, r.targetId, "parent") &&
          !reaches(r.targetId, r.sourceId, "parent"),
        "hierarchyDependency",
        409,
      );
    if (kind === "dependency") ensure(t.stage !== "done", "terminal", 409);
    await c.query(
      "INSERT INTO relations(id,source_id,target_id,kind) VALUES($1,$2,$3,$4)",
      [added.id, sourceId, targetId, kind],
    );
  }
  await event(
    c,
    t,
    u,
    b.remove ? "removeRelation" : "addRelation",
    existing ?? null,
    b,
    b.reason,
  );
  await save(c, t);
  return t;
}
