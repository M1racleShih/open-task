#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
diagram_dir="$repo_root/docs/assets/diagrams"

if ! command -v mmdc >/dev/null 2>&1; then
  echo "Missing mmdc. Use Mermaid CLI 11.12.0 to render documentation diagrams." >&2
  exit 1
fi

renderer_args=(-c "$diagram_dir/mermaid-config.json" -b transparent)
if [[ -n "${MERMAID_PUPPETEER_CONFIG:-}" ]]; then
  renderer_args+=(-p "$MERMAID_PUPPETEER_CONFIG")
fi

for locale in zh-CN en; do
  for source_file in "$diagram_dir/$locale"/*.mmd; do
    mmdc -i "$source_file" -o "${source_file%.mmd}.svg" "${renderer_args[@]}"
  done
done
