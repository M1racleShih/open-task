#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
backup="${1:?Usage: scripts/restore-check.sh backup.dump}"
restore_db="open_task_restore_$(date +%s)_$$"
docker compose exec -T db createdb -U open_task "$restore_db"
time docker compose exec -T db pg_restore -U open_task -d "$restore_db" --exit-on-error < "$backup"
bash scripts/verify-restored-db.sh open_task "$restore_db"
printf 'Isolated restored database: %s\n' "$restore_db"
printf 'External URLs and original text are backed up; remote files are not.\n'
