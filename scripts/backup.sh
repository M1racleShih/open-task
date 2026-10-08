#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/open-task-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T db pg_dump -U open_task -d open_task -Fc > "$file"
echo "$file"
