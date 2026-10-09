# UI reference and asset notices

## Catppuccin

The second preview uses the Catppuccin Frappé palette (base `#303446`, mantle `#292c3c`, crust `#232634`, text `#c6d0f5`, blue `#8caaee`, green `#a6d189`, yellow `#e5c890`, red `#e78284`, mauve `#ca9ee6`, teal `#81c8be`).

Source: https://github.com/catppuccin/catppuccin

MIT notice retained in `licenses/Catppuccin.txt`.

## Lucide

The UI uses local Lucide SVG icons, sourced from https://github.com/lucide-icons/lucide/tree/main/icons on 2026-09-09. All use the same outline family; CSS masks apply the interface's semantic colors. The ISC and included Feather MIT notices are retained in `licenses/Lucide.txt`.

## Vikunja

Visual reference: https://vikunja.io/ and its official dark task-overview screenshot. Borrowed organizational ideas: project navigation, compact task rows, contextual metadata, textual color labels. The UI implementation is original to this preview. No Vikunja source code, logo, or screenshot is bundled in the preview.

Repository: https://github.com/go-vikunja/vikunja

The repository describes its main license as AGPL-3.0-or-later and desktop code as GPL-3.0-or-later. These are recorded as reference provenance, not a claim that copying its code has no obligations. Future direct code reuse must be evaluated under the relevant license.

## Obsidian and VS Code interaction references

The IDE panel structure, rounded panels and colored frame draw inspiration from Obsidian and VS Code. The graph interaction also references the documented forces at https://help.obsidian.md/plugins/graph (center, repel, link force, and link distance). The drag simulation is original prototype code. No Obsidian or VS Code source, brand assets, or screenshots are bundled. The task-history lanes borrow the chronological reading convention of Git Graph, without implementing or claiming Git branches/merges.

The Lucide `history` and `arrow-right` icons were obtained from the official `lucide-static` npm package, version 0.468.0, via jsDelivr; the existing Lucide notices apply.
