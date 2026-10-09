#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Read-only comparison shared by normal-workspace and synthetic-case restores.
# Stop source writes and workers before taking the backup and comparing it.
source_db="${1:?Usage: verify-restored-db.sh source_database restored_database}"
restore_db="${2:?Usage: verify-restored-db.sh source_database restored_database}"
[[ "$source_db" =~ ^[a-z][a-z0-9_]*$ && "$restore_db" =~ ^[a-z][a-z0-9_]*$ ]]
[[ "$source_db" != "$restore_db" ]]
for table in users sessions projects tasks events versions relations idempotency followups worker_health time_preferences pgboss.job; do
  query="SELECT count(*)::text || ':' || COALESCE(md5(string_agg(to_jsonb(x)::text, '' ORDER BY to_jsonb(x)::text)),'empty') FROM $table x"
  source_hash=$(docker compose exec -T db psql -v ON_ERROR_STOP=1 -U open_task -d "$source_db" -tAc "$query")
  restored_hash=$(docker compose exec -T db psql -v ON_ERROR_STOP=1 -U open_task -d "$restore_db" -tAc "$query")
  if [[ "$source_hash" != "$restored_hash" ]]; then
    printf 'Restore mismatch: %s\n' "$table" >&2
    exit 1
  fi
  # Never print restored account/session contents or password hashes.
  printf '%s row count and canonical content match\n' "$table"
done
