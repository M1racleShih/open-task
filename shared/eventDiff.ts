const bookkeeping = new Set(["revision", "updatedAt"]);
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => equal(v, b[i]))
    );
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every((k) => Object.hasOwn(y, k) && equal(x[k], y[k]))
  );
}
/** Display actual business changes without rewriting the immutable audit snapshots. */
export function eventDiff(
  before: unknown,
  after: unknown,
): { before: unknown; after: unknown } {
  if (equal(before, after)) return { before: null, after: null };
  if (Array.isArray(before) && Array.isArray(after)) {
    const identified = [...before, ...after].every(
      (x) => x && typeof x === "object" && typeof x.id === "string",
    );
    if (identified)
      return {
        before: before.filter(
          (x) => !after.some((y) => y.id === x.id && equal(x, y)),
        ),
        after: after.filter(
          (x) => !before.some((y) => y.id === x.id && equal(x, y)),
        ),
      };
  }
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const a = before as Record<string, unknown>,
      b = after as Record<string, unknown>;
    const old: Record<string, unknown> = {},
      next: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (bookkeeping.has(key) || equal(a[key], b[key])) continue;
      const diff = eventDiff(a[key], b[key]);
      old[key] = diff.before ?? null;
      next[key] = diff.after ?? null;
    }
    return Object.keys(old).length
      ? { before: old, after: next }
      : { before: null, after: null };
  }
  return { before: before ?? null, after: after ?? null };
}
