#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Only this synthetic database is dumped. Never use the normal app database.
source_db=open_task_release_case
restore_db="open_task_case_restore_$(date +%s)_$$"
mkdir -p artifacts/release-case
backup=$(mktemp /tmp/open-task-case-backup.XXXXXX)
created=false
cleanup() {
  rm -f "$backup"
  if "$created"; then
    docker compose exec -T db dropdb -U open_task "$restore_db"
  fi
}
trap cleanup EXIT
docker compose exec -T db pg_dump -U open_task -d "$source_db" -Fc > "$backup"
docker compose exec -T db createdb -U open_task "$restore_db"
created=true
docker compose exec -T db pg_restore -U open_task -d "$restore_db" --exit-on-error < "$backup"
# Run after the case worker has stopped and with no browser mutations in flight.
bash scripts/verify-restored-db.sh "$source_db" "$restore_db"
printf 'Case backup restored and verified; temporary backup and own restore database cleaned up.\n'
