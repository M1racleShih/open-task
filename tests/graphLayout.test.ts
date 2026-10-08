import { test } from "node:test";
import assert from "node:assert/strict";
import {
  radialBranches,
  edgeEndpoints,
  labelCollision,
} from "../shared/graphLayout.js";

const tasks = Array.from({ length: 31 }, (_, i) => ({
  id: String(i + 46),
  number: i + 46,
}));
const links = [
  [54, 55],
  [65, 46],
  [49, 54],
  [61, 76],
  [69, 68],
  [67, 66],
  [52, 73],
  [69, 59],
  [70, 69],
  [47, 70],
  [61, 62],
  [61, 63],
  [51, 75],
  [49, 50],
  [56, 73],
  [69, 61],
].map(([a, b]) => ({ sourceId: String(a), targetId: String(b) }));
const cross = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

test("separate relationship branches stay radial, deterministic and do not cross in a forest", () => {
  const points = radialBranches(tasks, links);
  assert.deepEqual(points, radialBranches(tasks, links));
  assert.equal(new Set(points.map((p) => p.id)).size, tasks.length);
  const byId = new Map(points.map((p) => [p.id, p]));
  const lines = links.map((link) =>
    edgeEndpoints(byId.get(link.sourceId)!, byId.get(link.targetId)!),
  );
  for (let i = 0; i < lines.length; i++)
    for (let j = 0; j < i; j++) {
      const p = lines[i],
        q = lines[j];
      assert.ok(
        !(
          cross(p.start, p.end, q.start) * cross(p.start, p.end, q.end) < 0 &&
          cross(q.start, q.end, p.start) * cross(q.start, q.end, p.end) < 0
        ),
      );
    }
  assert.deepEqual(radialBranches([], []), []);
});

test("cyclic, parallel and out-of-scope relationships do not lose or duplicate nodes", () => {
  const cyclic = [
    ...links,
    { sourceId: "61", targetId: "47" },
    links[0],
    { sourceId: "missing", targetId: "61" },
  ];
  const points = radialBranches(tasks, cyclic);
  assert.equal(points.length, tasks.length);
  assert.ok(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.equal(cyclic.length, links.length + 3);
  const many = Array.from({ length: 400 }, (_, number) => ({
    id: String(number),
    number,
  }));
  assert.equal(radialBranches(many, []).length, 400);
});

test("relation endpoints leave the task label clear, including vertical and coincident nodes", () => {
  const horizontal = edgeEndpoints(
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 300, y: 0 },
  );
  assert.ok(Math.abs(horizontal.start.x - 110) < 1e-8);
  assert.ok(Math.abs(horizontal.end.x - 204) < 1e-8);
  const vertical = edgeEndpoints(
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 0, y: 200 },
  );
  assert.ok(Math.abs(vertical.start.y - 53) < 1e-8);
  assert.ok(Math.abs(vertical.end.y - 161) < 1e-8);
  const same = edgeEndpoints({ id: "a", x: 0, y: 0 }, { id: "b", x: 0, y: 0 });
  assert.ok(Number.isFinite(same.start.x));
});

test("rectangular collision separates full labels and respects a dragged node", () => {
  const fixed = { x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0 };
  const other = { x: 180, y: 0, vx: 0, vy: 0 };
  const force = labelCollision<typeof other>();
  force.initialize([fixed, other]);
  force();
  assert.equal(fixed.vx, 0);
  assert.ok(other.vx >= 40);
  const clear = { x: 400, y: 0, vx: 0, vy: 0 };
  force.initialize([fixed, clear]);
  force();
  assert.equal(clear.vx, 0);
});
