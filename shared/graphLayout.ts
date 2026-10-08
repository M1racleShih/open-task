export type GraphPoint = { id: string; x: number; y: number };
type Link = { sourceId: string; targetId: string };
const frame = { left: -96, right: 110, top: -39, bottom: 53 };

/** Seed connected branches together, packing separate components around them. */
export function radialBranches(
  tasks: { id: string; number: number }[],
  links: Link[],
): GraphPoint[] {
  const numbers = new Map(tasks.map((t) => [t.id, t.number]));
  const neighbors = new Map(tasks.map((t) => [t.id, new Set<string>()]));
  for (const link of links) {
    if (
      !neighbors.has(link.sourceId) ||
      !neighbors.has(link.targetId) ||
      link.sourceId === link.targetId
    )
      continue;
    neighbors.get(link.sourceId)!.add(link.targetId);
    neighbors.get(link.targetId)!.add(link.sourceId);
  }
  const unseen = new Set(neighbors.keys());
  const components: string[][] = [];
  while (unseen.size) {
    const first = unseen.values().next().value!;
    unseen.delete(first);
    const component = [first];
    for (let i = 0; i < component.length; i++)
      for (const next of neighbors.get(component[i])!)
        if (unseen.delete(next)) component.push(next);
    components.push(component);
  }
  components.sort(
    (a, b) => b.length - a.length || numbers.get(a[0])! - numbers.get(b[0])!,
  );
  const result: GraphPoint[] = [];
  const occupied: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[] = [];
  for (const component of components) {
    const root = [...component].sort(
      (a, b) =>
        neighbors.get(b)!.size - neighbors.get(a)!.size ||
        numbers.get(a)! - numbers.get(b)!,
    )[0];
    const children = new Map<string, string[]>();
    const visited = new Set([root]);
    const queue = [root];
    for (let i = 0; i < queue.length; i++) {
      const kids = [...neighbors.get(queue[i])!]
        .filter((id) => !visited.has(id))
        .sort((a, b) => numbers.get(a)! - numbers.get(b)!);
      children.set(queue[i], kids);
      for (const id of kids) {
        visited.add(id);
        queue.push(id);
      }
    }
    const leaves = new Map<string, number>();
    for (const id of [...queue].reverse())
      leaves.set(
        id,
        Math.max(
          1,
          children.get(id)!.reduce((sum, kid) => sum + leaves.get(kid)!, 0),
        ),
      );
    const points: GraphPoint[] = [];
    const place = (id: string, depth: number, start: number, end: number) => {
      const angle = (start + end) / 2;
      points.push({
        id,
        x: Math.cos(angle) * depth * 240,
        y: Math.sin(angle) * depth * 170,
      });
      let cursor = start;
      for (const kid of children.get(id)!) {
        const stop =
          cursor + ((end - start) * leaves.get(kid)!) / leaves.get(id)!;
        place(kid, depth + 1, cursor, stop);
        cursor = stop;
      }
    };
    place(root, 0, -Math.PI / 2, Math.PI * 1.5);
    const bounds = {
      left: Math.min(...points.map((p) => p.x + frame.left)),
      right: Math.max(...points.map((p) => p.x + frame.right)),
      top: Math.min(...points.map((p) => p.y + frame.top)),
      bottom: Math.max(...points.map((p) => p.y + frame.bottom)),
    };
    let offset = { x: 0, y: 0 };
    if (occupied.length) {
      // Search concentric shells rather than a rectangular grid.
      search: for (let radius = 120; radius < 20000; radius += 90) {
        const slots = Math.ceil((2 * Math.PI * radius) / 90);
        for (let i = 0; i < slots; i++) {
          const angle = (i * 2 * Math.PI) / slots + Math.PI / 7;
          const x = Math.cos(angle) * radius,
            y = Math.sin(angle) * radius * 0.8;
          if (
            occupied.every(
              (b) =>
                bounds.right + x + 50 < b.left ||
                bounds.left + x - 50 > b.right ||
                bounds.bottom + y + 50 < b.top ||
                bounds.top + y - 50 > b.bottom,
            )
          ) {
            offset = { x, y };
            break search;
          }
        }
      }
    }
    occupied.push({
      left: bounds.left + offset.x,
      right: bounds.right + offset.x,
      top: bounds.top + offset.y,
      bottom: bounds.bottom + offset.y,
    });
    result.push(
      ...points.map((p) => ({ ...p, x: p.x + offset.x, y: p.y + offset.y })),
    );
  }
  return result;
}

/** Rectangular label collision, including a small readable gap. */
export function labelCollision<
  N extends {
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  },
>() {
  let nodes: N[] = [];
  const force = () => {
    for (let i = 0; i < nodes.length; i++)
      for (let j = 0; j < i; j++) {
        const a = nodes[i],
          b = nodes[j];
        const dx = (a.x ?? 0) + (a.vx ?? 0) - (b.x ?? 0) - (b.vx ?? 0);
        const dy = (a.y ?? 0) + (a.vy ?? 0) - (b.y ?? 0) - (b.vy ?? 0);
        const ox = 220 - Math.abs(dx),
          oy = 106 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        const aFree = a.fx == null && a.fy == null,
          bFree = b.fx == null && b.fy == null;
        if (!aFree && !bFree) continue;
        const share = aFree && bFree ? 0.5 : 1;
        if (ox < oy) {
          const push = (dx >= 0 ? 1 : -1) * ox * share;
          if (aFree) a.vx = (a.vx ?? 0) + push;
          if (bFree) b.vx = (b.vx ?? 0) - push;
        } else {
          const push = (dy >= 0 ? 1 : -1) * oy * share;
          if (aFree) a.vy = (a.vy ?? 0) + push;
          if (bFree) b.vy = (b.vy ?? 0) - push;
        }
      }
  };
  force.initialize = (next: N[]) => {
    nodes = next;
  };
  return force;
}

/** Stop at the outside of the label instead of drawing through its text. */
export function edgeEndpoints(source: GraphPoint, target: GraphPoint) {
  const exit = (from: GraphPoint, to: GraphPoint) => {
    const dx = to.x - from.x,
      dy = to.y - from.y;
    const tx = dx > 0 ? frame.right / dx : dx < 0 ? frame.left / dx : Infinity;
    const ty = dy > 0 ? frame.bottom / dy : dy < 0 ? frame.top / dy : Infinity;
    const scale = Math.min(tx, ty, 0.48);
    return { x: from.x + dx * scale, y: from.y + dy * scale };
  };
  return { start: exit(source, target), end: exit(target, source) };
}
