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

## Release case

```sh
npm run case:check
```

The Compose database must be running and port `4318` must be free. This command uses `open_task_release_case`, starts a temporary API and worker, and verifies 13 API assertion groups followed by backup and isolated restore. Each run adds a labeled synthetic project; previous case data remains. Only the final exit code of 0 means the whole command passed. Interface acceptance is a separate check. See [local setup](QUICKSTART.md) for viewing saved cases and the [verification report](RELEASE-CASE-RESULT.md) for recorded evidence.

## Browser checks

These scripts require Chrome at `/usr/bin/google-chrome` and local test accounts with the seeded password:

```sh
npx tsx scripts/browser-check.ts
npx tsx scripts/browser-workflow.ts
```

Both target the running app at `http://127.0.0.1:4310` and create labeled test records in whichever database that app uses. They do not select an isolated database automatically. Run them only against a workspace intended for acceptance checks. Screenshots and run outputs go under `artifacts/`.

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
```

This builds offline HTML in `artifacts/docs/` and validates page pairs, local links and diagram sources. Maintain both language editions together. See the [documentation entry](../README.md) for synchronization rules and the [English documentation home](README.md) for preview and diagram-rendering commands.

## Backup and repository layout

For backup, isolated restore and upgrades, follow [release checks](RELEASE-CHECK.md). For authentication, write headers and request fields, use [API v1](API.md).

Application code lives in `server/`, `shared/` and `web/`; tests and operational scripts live in `tests/` and `scripts/`. The `docs/` directory contains usage, development and release documentation, and `ui-previews/` contains the earlier UI demos.

The Compose project is `open-task-mvp`; ports `4173` and `4174` belong to separate UI demos. On hosts with a read-only default npm cache, `.npmrc` selects `/tmp/open-task-npm`.
