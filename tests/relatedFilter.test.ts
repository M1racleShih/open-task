import { test } from "node:test";
import assert from "node:assert/strict";
import { relatedMatch, relatedScopes } from "../shared/relatedFilter.js";
import { taskQuerySchema } from "../server/timeFilter.js";
import { describeAPI } from "../server/openapi.js";

test("Related selection distinguishes all from empty and matches responsibilities independent of stage", () => {
  const base = {
    ownerId: "other",
    creatorId: "other",
    issuerId: null,
    reviewerId: "other",
    approvalIds: ["other", "me"],
  };
  assert(relatedMatch(base, "me", null));
  assert(!relatedMatch(base, "me", []));
  assert(relatedMatch(base, "me", ["reviewing"]));
  assert(!relatedMatch(base, "me", ["owned", "created"]));
  assert(relatedMatch({ ...base, ownerId: "me" }, "me", ["owned"]));
  assert(relatedMatch({ ...base, creatorId: "me" }, "me", ["created"]));
  assert(relatedMatch({ ...base, issuerId: "me" }, "me", ["created"]));
  assert(
    relatedMatch({ ...base, approvalIds: [], reviewerId: "me" }, "me", [
      "reviewing",
    ]),
  );
  assert(!relatedMatch(base, "unrelated", relatedScopes));
});

test("Related query validates a bounded selection and documents it on both collection routes", () => {
  assert.equal(taskQuerySchema.parse({}).relatedUserId, undefined);
  assert(!taskQuerySchema.safeParse({ relatedUserId: "invalid" }).success);
  assert.equal(
    taskQuerySchema.parse({
      relatedUserId: "A60A3DC9-40ED-4FF8-844A-7531A2ECA507",
    }).relatedUserId,
    "a60a3dc9-40ed-4ff8-844a-7531a2eca507",
  );
  assert.equal(taskQuerySchema.parse({}).related, undefined);
  assert.deepEqual(taskQuerySchema.parse({ related: "" }).related, []);
  assert.deepEqual(
    taskQuerySchema.parse({ related: relatedScopes.join(",") }).related,
    relatedScopes,
  );
  for (const related of [
    "invalid",
    "owned,",
    "owned,created,reviewing,owned",
    ["owned"],
  ]) {
    assert(!taskQuerySchema.safeParse({ related }).success);
  }
  const doc = {
    paths: { "/api/v1/tasks": { get: {} }, "/api/v1/events": { get: {} } },
  };
  describeAPI(doc);
  for (const route of Object.values(doc.paths)) {
    assert(
      (route.get as any).parameters.some(
        (p: any) => p.name === "relatedUserId" && p.schema.format === "uuid",
      ),
    );
    assert(
      (route.get as any).parameters.some(
        (p: any) => p.name === "related" && p.in === "query",
      ),
    );
  }
});
