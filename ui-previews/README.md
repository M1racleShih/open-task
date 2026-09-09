# open-task UI previews

Current candidate: [Task IDE](http://127.0.0.1:4174/frappe.html). The user explicitly requested an IDE workflow: task explorer on the left, relationship graph in the center, inspector on the right, and a collapsible bottom panel. Implementation details await review.

## Open

From this directory, run `python3 -m http.server 4174 --bind 127.0.0.1`, then open the URL above. Reuse an existing server on that port if it already serves this directory.

## Try

- Expand or collapse the task hierarchy; search by title, owner, or ID. Explorer buttons open task/project creation form previews, refresh the view, or collapse all branches. Creation previews do not save new data.
- Select a tree item, graph node, pending item, or relationship to open the same inspector.
- Switch between project and global graphs; drag nodes to pull connected neighbors with damped settling and live straight edges, pan the canvas, zoom, fit moved nodes, locate selection, focus direct relationships, or restore the original layout. All graph nodes use the same task icon.
- Open **团队更新** (Team updates) in the center tabs or activity rail. Filter by project/member, search updates, and select a row to inspect its before/after changes. Each colored lane connects updates of the same task; it does not imply Git branches or merges. Task actions appear immediately in this feed and the task activity panels.
- Hide or show tree, inspector, and bottom panel. Drag separators or use their arrow keys to resize.
- Inspect pending actions, current-task activity, and typed relationships in the bottom panel.
- Update checklist states, approve or return a submission, accept a task, or record a follow-up. Progress does not automatically approve a task or clear a blocker.
- Switch light / Frappé dark themes. On narrow screens, switch among tree, workspace (graph or team updates), and detail views.

The palette restores the pre-Studio cool light theme and Frappé dark. A shared mist-blue/slate-blue frame fills the outer edge and 7px panel gaps; the main panels have 10px corners. The frame colors are candidates for review. Functional icons are local Lucide SVGs; see [asset notices](ATTRIBUTION.md). The supplied Obsidian and VS Code screenshots informed layout and interaction, not copied assets or source.

## Verification and limits

Checked 2157×1035 and 1440×960 layouts, 1024×768, 390×844, and shrinking resized panels down to 961×768 without clipping the inspector. Verified synchronized selection, status/progress updates, follow-up activity, relationship navigation, tree search/collapse, bottom-panel resizing, zoom, actual canvas panning, pane resizing by keyboard, theme switching, and mobile return. `node --check frappe.js` passes. New screenshots use the `screenshots/ide-frame-` and `screenshots/ide-history-` prefixes. Verified 22 baseline history events, project/member/search filters, event detail, all five task-action record paths (22→27), and mobile return. Browser error logs were empty.

All task data is fictional and in-memory; refreshing resets actions, while theme choice is saved locally. Initial graph positions are arranged for this sample. Dragging uses local springs, short-range repulsion, a light positional anchor, and damping; reduced-motion preferences omit release inertia. This is not a general-purpose automatic layout engine or a large-graph performance claim. Manual node positions persist per graph view until restoring layout or reloading the page; dragging does not change task hierarchy or dependencies. Zooming out scales labels with the canvas. No backend, real messaging, tree drag-and-drop reparenting, or real task editing is included.

## History

The A/B/C/D comparison and earlier screenshots remain as rejected visual history. Studio was also rejected. They do not describe the current design.
