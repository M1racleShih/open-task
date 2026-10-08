#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
backup="${1:?Usage: scripts/restore-check.sh backup.dump}"
restore_db="open_task_restore_$(date +%s)"
docker compose exec -T db createdb -U open_task "$restore_db"
time docker compose exec -T db pg_restore -U open_task -d "$restore_db" --exit-on-error < "$backup"
for table in users projects tasks events versions relations followups pgboss.job; do
  source_count=$(docker compose exec -T db psql -U open_task -d open_task -tAc "SELECT count(*) FROM $table")
  restored_count=$(docker compose exec -T db psql -U open_task -d "$restore_db" -tAc "SELECT count(*) FROM $table")
  printf '%s source=%s restored=%s\n' "$table" "$source_count" "$restored_count"
  test "$source_count" = "$restored_count"
  if test "$table" != pgboss.job; then
    source_hash=$(docker compose exec -T db psql -U open_task -d open_task -tAc "SELECT md5(string_agg(to_jsonb(x)::text, '' ORDER BY to_jsonb(x)::text)) FROM $table x")
    restored_hash=$(docker compose exec -T db psql -U open_task -d "$restore_db" -tAc "SELECT md5(string_agg(to_jsonb(x)::text, '' ORDER BY to_jsonb(x)::text)) FROM $table x")
    test "$source_hash" = "$restored_hash"
    printf '%s canonical content hash matches\n' "$table"
  fi
done
printf 'Isolated restored database: %s\n' "$restore_db"
printf 'External URLs and original text are backed up; remote files are not.\n'
