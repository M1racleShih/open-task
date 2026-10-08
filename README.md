# Open Task

A local, single-team task workspace with creation approval, explicit acceptance, progress, checklist approval, version confirmation and result review. The React task IDE uses the Fastify API and PostgreSQL; `ui-previews/` is a separate requirements demo.

## Requirements and local start

Node.js 24 LTS, npm, Docker Engine and Compose. Ports 4310 and 55432 must be available. These commands do not modify existing services:

```sh
npm ci
docker compose up -d --wait db
npm run db:migrate
SEED_PASSWORD='OpenTask-Test-2026!' npm run db:seed
npm run build
npm start
```

In a second terminal in this directory:

```sh
npm run worker
```

Open http://127.0.0.1:4310. The app binds to loopback only. The independent database volume is `open-task-mvp_database`. Stop the API and worker with Ctrl+C; stop PostgreSQL with `docker compose stop db`. Do not use `down -v` unless deliberately deleting all application data. Restart with the same commands without recreating the volume. Migration and account seeding are repeatable; seeding does not reset existing passwords.

Local acceptance accounts (explicit test identities):

| Username | Role |
| --- | --- |
| admin | Account administrator; no business approval privileges |
| leader | Team leader |
| manager | Member; designate as project manager when creating a project |
| member | Member / task owner |
| other | Additional member for visibility and authorization checks |

With the seed command above, the initial password is `OpenTask-Test-2026!`. These are local test credentials. No public registration, directory login, outbound messaging, uploads, model or Agent integration is included.

## Working through the lifecycle

1. As leader, create a project, choose `manager` as project manager and add members.
2. As member, create a draft, choose the project and owner, enter expected result, criteria and explicit acceptance, feedback and delivery times. Submit for approval. All non-draft tasks are visible to the team.
3. As manager, approve creation. The task still waits for leader. As leader, approve to issue.
4. As owner, accept and start; record formal progress and the next feedback time. Comments do not count as progress. Checklist content changes require leader approval; ordinary check marks do not.
5. Submit a written result and optional HTTP(S) links with an explicit review time. The designated reviewer returns with a reason and next feedback time, or accepts. Returned work continues in the same task.
6. Leader agreement changes require owner confirmation. Reassignment returns to acceptance. Completed/cancelled tasks are not reopened; create related follow-up tasks.

Times are entered and displayed in Asia/Shanghai. English is the initial language regardless of browser locale; language and theme preferences persist in this browser. User-authored text is never translated. Forms preserve input on failed requests. Refresh and read a changed version before retrying a stale operation.

## Development and checks

```sh
npm run typecheck
npm run build
scripts/test-db.sh
npx tsx scripts/browser-check.ts
npx tsx scripts/browser-workflow.ts
```

`test-db.sh` uses a separate `open_task_test` database and explicit synthetic fixtures. Integration tests include an actual database trigger failure; never point them at production data. Browser scripts operate through the running local application and preserve their explicitly labeled acceptance records. They require Chrome at `/usr/bin/google-chrome`. Screenshots and detailed run outputs go in `artifacts/`.

To run the five-minute, 30-user local load test after integration fixtures:

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_test' npx tsx scripts/performance.ts
```

The performance script starts a separate API on 4312 and creates 5,000 explicitly labeled test tasks. It never connects to the acceptance database by default. Results: `artifacts/performance.json`.

## Backup and isolated restore

```sh
scripts/backup.sh
scripts/restore-check.sh backups/<backup-file>.dump
```

Backups contain PostgreSQL business data and pg-boss jobs, including account password hashes. Keep them private. The restore script creates a new isolated database and reports row-count comparisons. It does not overwrite the active database. External evidence URLs and original submission text are backed up; the remote files themselves are not.

For exact comparisons, stop application writes and the worker while taking and checking the backup. Before upgrades, create a backup, apply migrations, build and restart the API and worker. Check `/health` and the worker's `worker_health` row; pg-boss job failure details remain in PostgreSQL.

## API contract

The same-origin API is under `/api/v1`. Sessions use an HttpOnly SameSite=Strict cookie; mutation calls also require the session's `X-CSRF-Token`. All business writes require an `Idempotency-Key` unique to the logical operation. Retrying the same payload with the same key returns the original result. Task actions carry the viewed `version`; results also carry `submissionId`, and checklist toggles carry `expectedDone`.

Lists use bounded cursor pagination. Task/event responses are `{items,nextCursor}`. Errors are `{error:{code,requestId,details}}` with 401/403/404/409/422/429/500 statuses. The frontend translates stable error codes. `/api/v1/openapi.json` is available after login. See `docs/API.md` for request shapes and [verification history](../open-task-specs/reviews/mvp/VERIFICATION.md) for evidence and outstanding work.

## UI reference and icon licenses

See [UI comparison](../open-task-specs/reviews/mvp/UI-COMPARISON.md) for the formal task IDE versus the approved preview, and [third-party notices](docs/THIRD-PARTY-NOTICES.md) for Lucide ISC / Feather MIT permissions. The complete icon license is included in the built application at `/lucide-LICENSE.txt`.

## Latest UI fixes and ready-to-open examples

The local UI polish delivery, test evidence and known limits are in [UI polish report](../open-task-specs/reviews/mvp/UI-POLISH.md). Open [OT-38 checklist/blocker example](http://127.0.0.1:4310/?task=58c649c9-740c-433f-9134-f7725a6b4b4e) or [OT-39 result-review example](http://127.0.0.1:4310/?task=0c3421bc-4f74-4742-9d09-880caa6167f0). These are explicitly marked API-persisted acceptance examples. Apply the additive project-color migration with `npm run db:migrate` before restarting updated code. Dates now accept `YYYY-MM-DD HH:mm` in Shanghai time, with localized format hints.

## Documentation ownership

This repository keeps setup, development, API and distribution-license documentation. Product specifications and historical review/acceptance reports live in [open-task-specs](../open-task-specs/README.md), with an [MVP report index](../open-task-specs/reviews/mvp/README.md). Cross-repository links assume sibling checkouts; the specifications repository is not required to build or run the app. Scripts, artifacts and backups remain here.

On hosts with a read-only default npm cache, `.npmrc` uses `/tmp/open-task-npm`. The Compose project is `open-task-mvp`; ports 4173/4174 belong to separate UI demos, not the application.

## Task plans and time filters

The task tree filter offers All time / This week / This month / Custom range with optional unscheduled and earlier unfinished tasks. All-project views use your global range. Selecting a project initially follows global; applying a range creates a personal project override, and Follow global removes it. Preferences persist per account in PostgreSQL, while theme/language remain browser preferences. The tree, graph, match counts and team activity share the task match; reminders and selected task history remain complete. Task creation leaves planned dates empty and out-of-range details remain viewable.

Apply `npm run db:migrate` before starting the updated API (adds only user time preferences; existing task JSON and history need no backfill). Follow the existing backup/build/restart procedure above for the main local database. Task dates add optional `plannedStart` and reuse `deadline`; both use existing agreement confirmation. See [API contract](docs/API.md).

For an isolated browser run, after `scripts/test-db.sh` and `npm run build`, start the API with `DATABASE_URL=postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_test PORT=4316 npm start`, then run `DATABASE_URL=postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_test npx tsx scripts/browser-time-filter.ts`. `TIME_TEST_URL` may select a different isolated port. The script requires the isolated database guard, labels fixture records, and writes screenshots/results under `artifacts/time-filter`. In environments where standalone Chrome cannot access localhost, use the Codex browser against the isolated service and record that verification separately.
