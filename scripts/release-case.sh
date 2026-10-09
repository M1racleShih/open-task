#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Fixed, disposable database. Never fall back to the normal application database.
export DATABASE_URL=postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_release_case
if ! docker compose exec -T db psql -U open_task -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='open_task_release_case'" | rg -q '^1$'; then
  docker compose exec -T db createdb -U open_task open_task_release_case
fi
npm run db:migrate
SEED_PASSWORD='OpenTask-Test-2026!' npm run db:seed
npm run build
npx tsx scripts/release-case.ts
bash scripts/release-case-restore.sh
