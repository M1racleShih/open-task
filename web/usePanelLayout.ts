import { useEffect, useRef, useState, type SetStateAction } from "react";
import {
  defaultPanels,
  readPanels,
  visiblePanels,
  writePanels,
  type PanelPreferences,
} from "../shared/workspaceLayout.js";

type Session = {
  accountId: string | null;
  panels: PanelPreferences;
  focused: boolean;
};
export function usePanelLayout(
  accountId: string | null,
  initialDetails: boolean,
) {
  const initial = useRef(initialDetails);
  const [session, setSession] = useState<Session>(() => ({
    accountId,
    panels: accountId
      ? readPanels(accountId, initial.current)
      : defaultPanels(initial.current),
    focused: false,
  }));
  // Reset before committing children on an account change. Never paint or save
  // the previous account's layout (or overwrite a saved layout with defaults).
  if (session.accountId !== accountId) {
    setSession({
      accountId,
      panels: accountId
        ? readPanels(accountId, initial.current)
        : defaultPanels(initial.current),
      focused: false,
    });
  }
  useEffect(() => {
    if (accountId && session.accountId === accountId)
      writePanels(accountId, session.panels);
  }, [accountId, session.accountId, session.panels]);
  const current =
    session.accountId === accountId
      ? session
      : { accountId, panels: defaultPanels(initial.current), focused: false };
  const visible = visiblePanels(current.panels, current.focused);
  function setter<K extends keyof PanelPreferences>(
    key: K,
    leavesFocus = false,
  ) {
    return (value: SetStateAction<PanelPreferences[K]>) => {
      setSession((old) => {
        const base = old.accountId === accountId ? old : current;
        const effective = visiblePanels(base.panels, base.focused);
        const previous = leavesFocus ? effective[key] : base.panels[key];
        const next =
          typeof value === "function"
            ? (value as (value: PanelPreferences[K]) => PanelPreferences[K])(
                previous as PanelPreferences[K],
              )
            : value;
        return {
          ...base,
          focused: leavesFocus ? false : base.focused,
          panels: { ...base.panels, [key]: next },
        };
      });
    };
  }
  return {
    showTree: visible.tree,
    showWorkspace: visible.workspace,
    showDetails: visible.details,
    bottom: current.panels.bottom,
    treeSize: current.panels.treeSize,
    detailSize: current.panels.detailSize,
    inboxSize: current.panels.inboxSize,
    focused: current.focused,
    setShowTree: setter("tree", true),
    setShowWorkspace: setter("workspace", true),
    setShowDetails: setter("details", true),
    setBottom: setter("bottom"),
    setLeftWidth: setter("treeSize"),
    setRightWidth: setter("detailSize"),
    setBottomHeight: setter("inboxSize"),
    toggleFocus: () => setSession((old) => ({ ...old, focused: !old.focused })),
  };
}
