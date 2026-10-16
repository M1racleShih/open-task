# Development and checks

[简体中文](../zh-CN/DEVELOPMENT.md)

Start with [local setup](QUICKSTART.md). The application uses React and Vite, a Fastify API, PostgreSQL and a separate pg-boss worker. `ui-previews/` contains the earlier demo used to agree on UI requirements.

## Build and database checks

From the repository root, with the Compose database running:

```sh
npm run typecheck
npm run build
bash scripts/test-db.sh
```

`test-db.sh` creates `open_task_test` if needed, runs migrations, seeds test accounts and runs the test suite. It uses synthetic fixtures and includes a deliberate database-trigger failure to check transaction rollback.

Keep this database for testing; do not put real work in it or point integration tests at production data. Test accounts use `OpenTask-Test-2026!`; seeding does not reset existing passwords.

## Prepare an isolated database for the tutorial

With the Compose database running, create this database **once**. An “already exists” message means it is already available; keep it and continue with migration. These commands do not clear the normal workspace.

```sh
docker compose exec -T db createdb -U open_task open_task_walkthrough
export DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_walkthrough'
npm run db:migrate
SEED_PASSWORD='OpenTask-Test-2026!' npm run db:seed
npm run build
PORT=4322 npm start
```

In a second terminal:

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_walkthrough' npm run worker
```

Open <http://127.0.0.1:4322/> and follow the case. Both processes must use this same database. Task numbers are assigned locally; use titles and URLs rather than expecting the screenshot's OT numbers. On a repeat run, use a new project name or continue your existing example. Replace the tutorial's screenshot dates with future dates. If port 4322 is occupied, use another free port and its matching URL.

## Run the automated case and view its results

To keep examples out of your normal workspace, first make sure PostgreSQL is running and port `4318` is free, then run:

```sh
npm run case:check
```

This command uses the fixed `open_task_release_case` database and automatically migrates it, initializes data, builds the app and runs the API case. It temporarily starts the API and worker on `4318` and closes these processes when finished, so an existing `4310` workspace is unaffected. On failure, inspect the terminal output or `artifacts/release-case/<run>/failure.json`.

Each run adds a synthetic project with a random identifier and deletes no previous data. When the API case passes it prints `Release case passed: 13 checks`, after which the command verifies the case database backup and isolated restore. Only a final exit code of 0 means the complete check passed. The raw API report is at `artifacts/release-case/<run>/result.json`; the latest successful API report is at `artifacts/release-case/latest.json`. `latest.json` only proves the API case passed, not the restore step that follows; use the terminal restore output. Follow the [case tutorial](CASE-CSV-EXPORT.md) separately for the interface.

To view a saved case, run these commands in two terminals:

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_release_case' PORT=4319 npm start
```

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_release_case' npm run worker
```

Open <http://127.0.0.1:4319/> and log in with the same test accounts. Replace port `4318` with `4319` in report task links. Task numbers in the normal and case databases are independent.

## Browser checks

These scripts require Chrome at `/usr/bin/google-chrome` and local test accounts with the seeded password:

```sh
npx tsx scripts/browser-check.ts
npx tsx scripts/browser-workflow.ts
```

Both target the running app at `http://127.0.0.1:4310` and create labeled test records in whichever database that app uses. They do not select an isolated database automatically. Run them only against a workspace intended for acceptance checks. Screenshots and run outputs go under `artifacts/`.

### Task stage feedback check with mock API

```sh
npx tsx --test tests/stageFeedback.test.ts
npx tsx scripts/browser-stage-feedback.ts
```

The browser script starts a mock-only Vite preview on `127.0.0.1:4351`, intercepts every API request and closes the preview when finished; it never connects to a database. `STAGE_TEST_URL` can instead point to an already running local preview. It verifies server-confirmed action receipts, failed reads/actions, polling deduplication, task/account switching, slow responses, bounded event attribution, filter removal, checklist drafts, stable live announcements and the English/Chinese light/dark layout matrix at 1440, 820 and 390 pixels. Chrome is required at `/usr/bin/google-chrome`. Synthetic screenshots and results are saved to `artifacts/stage-feedback/`.

### Time-filter check in an isolated database

After `bash scripts/test-db.sh` and `npm run build`, start the test API:

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_test' PORT=4316 npm start
```

In a second terminal:

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_test' npx tsx scripts/browser-time-filter.ts
```

The script requires `DATABASE_URL` to end in `/open_task_test`. Its default browser URL is `http://127.0.0.1:4316`; `TIME_TEST_URL` can select another isolated service. Keep the URL and database pointed at the same test environment. Records are labeled, and screenshots/results go to `artifacts/time-filter/`. Stop the temporary API with Ctrl+C when finished.

If standalone Chrome cannot access localhost, use a browser that can reach the isolated service and record the checks performed. A manual browser run is not evidence that the scripted assertions passed.

## Load test

Run the database checks first to create integration fixtures, then make sure port `4312` is free:

```sh
DATABASE_URL='postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task_test' npx tsx scripts/performance.ts
```

The script requires the `open_task_test` database, starts a separate API on `4312`, replaces its earlier performance tasks with 5,000 labeled fixtures and uses 30 test users.

By default it runs for five minutes; `PERF_SECONDS` changes the duration. It exercises task lists, details and comments. Results go to `artifacts/performance.json`. Treat the result as evidence for that machine, dataset and workload.

## Documentation checks

```sh
npm run docs:build
npx tsx --test tests/docs.test.ts
```

This builds offline HTML in `artifacts/docs/` and validates page pairs, local links and diagram sources. Maintain both language editions together. See [documentation maintenance](MAINTAINING.md) for synchronization rules, preview and diagram rendering.

## Backup and repository layout

For backup, isolated restore and upgrades, follow [release checks](RELEASE-CHECK.md). For authentication, write headers and request fields, use [API v1](API.md).

Application code lives in `server/`, `shared/` and `web/`; tests and operational scripts live in `tests/` and `scripts/`. The `docs/` directory contains usage, development and release documentation, and `ui-previews/` contains the earlier UI demos.

The Compose project is `open-task-mvp`; ports `4173` and `4174` belong to separate UI demos. On hosts with a read-only default npm cache, `.npmrc` selects `/tmp/open-task-npm`.

## Maintain the illustrated walkthrough

The [capture record](SCREENSHOTS.md) separates real browser operations from form-only and code-backed coverage. Keep raw screenshots, crop/callout coordinates and language registration in `docs/assets/`. Regenerate annotations with `npx tsx scripts/annotate-doc-screenshots.ts`, then rebuild and inspect both editions at desktop and phone widths. This command does not replay the app. See [documentation maintenance](MAINTAINING.md) for the full workflow.
