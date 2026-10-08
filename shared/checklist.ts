import type { ChecklistItem } from "./model.js";
/** Keep stable identities for unchanged lines, including insertion and removal. */
export function reconcileChecklist(
  lines: string[],
  old: ChecklistItem[],
  newId: () => string,
) {
  const used = new Set<string>();
  const matched = lines.map((text) => {
    const item = old.find((item) => item.text === text && !used.has(item.id));
    if (item) used.add(item.id);
    return item?.id;
  });
  return lines.map((text, index) => {
    let id = matched[index];
    if (!id && old[index] && !used.has(old[index].id)) {
      id = old[index].id;
      used.add(id);
    }
    return { id: id ?? newId(), text };
  });
}
