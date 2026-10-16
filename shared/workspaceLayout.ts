import { fitPanels } from "./panelLayout.js";
import { localPreferences } from "./storage.js";

export type DesktopPanel = "tree" | "workspace" | "details";
export type PanelPreferences = {
  version: 1;
  tree: boolean;
  workspace: boolean;
  details: boolean;
  bottom: boolean;
  treeSize: number | null;
  detailSize: number | null;
  inboxSize: number | null;
};
export const defaultPanels = (details = false): PanelPreferences => ({
  version: 1,
  tree: true,
  workspace: true,
  details,
  bottom: false,
  treeSize: null,
  detailSize: null,
  inboxSize: null,
});
export const panelPreferenceKey = (accountId: string) =>
  "open-task.panels.v1." + encodeURIComponent(accountId);

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export function readPanels(
  accountId: string,
  details = false,
  storage: Storage = localPreferences,
): PanelPreferences {
  const defaults = defaultPanels(details);
  try {
    const saved = JSON.parse(
      storage.getItem(panelPreferenceKey(accountId)) ?? "null",
    );
    if (!saved || saved.version !== 1) return defaults;
    for (const key of ["tree", "workspace", "details", "bottom"] as const)
      if (typeof saved[key] === "boolean") defaults[key] = saved[key];
    for (const key of ["treeSize", "detailSize", "inboxSize"] as const)
      if (
        typeof saved[key] === "number" &&
        Number.isFinite(saved[key]) &&
        saved[key] >= 120
      )
        defaults[key] = Math.min(10000, saved[key]);
    return defaults;
  } catch {
    return defaults;
  }
}
export function writePanels(
  accountId: string,
  panels: PanelPreferences,
  storage: Storage = localPreferences,
) {
  try {
    storage.setItem(panelPreferenceKey(accountId), JSON.stringify(panels));
  } catch {
    // The current account's in-memory layout is still authoritative.
  }
}
export function visiblePanels(panels: PanelPreferences, focused: boolean) {
  return focused
    ? { ...panels, tree: false, workspace: false, details: true }
    : panels;
}

export function workspaceColumns(
  width: number,
  visible: Pick<PanelPreferences, DesktopPanel>,
  treeSize: number,
  detailSize: number,
) {
  const { tree, workspace, details } = visible;
  const treeDivider = tree && (workspace || details);
  const detailDivider = workspace && details;
  const available = Math.max(
    0,
    width - (treeDivider ? 7 : 0) - (detailDivider ? 7 : 0),
  );
  // Reserve a readable center (or detail) at narrow desktop widths.
  const budget = Math.max(
    0,
    available - (workspace || details ? Math.min(280, available * 0.3) : 0),
  );
  const fitted = fitPanels(
    tree ? treeSize : 0,
    workspace && details ? detailSize : 0,
    budget,
  );
  const left = tree && !workspace && !details ? available : fitted.left;
  const right = details ? (workspace ? fitted.right : available - left) : 0;
  return {
    left,
    right,
    budget,
    treeDivider,
    detailDivider,
    columns: `${left}px ${treeDivider ? 7 : 0}px ${workspace ? "minmax(0,1fr)" : "0px"} ${detailDivider ? 7 : 0}px ${right}px`,
  };
}
