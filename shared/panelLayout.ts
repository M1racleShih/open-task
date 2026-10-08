export function fitPanels(left: number, right: number, available: number) {
  const budget = Math.max(0, available);
  const a = Math.max(0, left),
    b = Math.max(0, right);
  const scale = a + b > budget ? budget / (a + b) : 1;
  return { left: a * scale, right: b * scale };
}
