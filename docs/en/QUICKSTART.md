# Local setup

[简体中文](../zh-CN/QUICKSTART.md)

## Environment

You need Node.js 24 LTS, npm, Docker Engine and Docker Compose. The normal application uses port `4310`, and PostgreSQL uses `55432`; both listen only on localhost.

Run the following commands from the repository root. Initialization does not clear existing tasks, and repeated `npm run db:seed` runs do not reset existing account passwords. Back up an existing workspace first, as described in [release checks](RELEASE-CHECK.md).

```sh
npm ci
docker compose up -d --wait db
npm run db:migrate
SEED_PASSWORD='OpenTask-Test-2026!' npm run db:seed
npm run build
npm start
```

In another terminal, from the same directory, run:

```sh
npm run worker
```

Open <http://127.0.0.1:4310/>. The API and worker are separate processes; both must run. `/health` checks only the API and database, and does not prove the worker is healthy.

## Demo accounts

Running the `npm run db:seed` command above in a new database creates these test accounts, all with initial password `OpenTask-Test-2026!`.

| Username | Display name         | Responsibility in the case                                                                  |
| -------- | -------------------- | ------------------------------------------------------------------------------------------- |
| leader   | Test Leader          | Creates projects, gives final creation approval, approves checklists and adjusts agreements |
| manager  | Test Project Manager | Project manager, requirements owner and implementation reviewer                             |
| member   | Test Member          | Implementation owner                                                                        |
| other    | Test Other Member    | Test-delivery owner and account for additional permission checks                            |
| admin    | Test Administrator   | Account administration; receives no automatic business approval authority                   |

The project manager is assigned by a project, rather than being a separate global account role. The initial interface is English. Use Language at the top to switch to Simplified Chinese; the choice survives refresh. Task content is not translated automatically.

## Using an isolated case environment

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

## Stopping and restarting

Press Ctrl+C in the API and worker terminals. To stop the database, run `docker compose stop db`. The database volume is `open-task-mvp_database`; stopping services does not delete data. Restart the database, API and worker using the same commands. `docker compose down -v` deletes the database volume and is not used for ordinary stops or case reruns.

## Common startup problems

| Symptom                                             | Check                                                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Login fails                                         | Correct database and password; repeated seeding does not reset existing accounts                                  |
| The page opens, but overdue reminders do not update | A worker is running against the same database                                                                     |
| Database errors after an update                     | Run `npm run db:migrate` before starting                                                                          |
| Address already in use                              | Keep existing services intact; the case runner fails immediately, so inspect the process using the port and retry |
| Standalone Chrome returns `ERR_ACCESS_DENIED`       | Use a browser that can access localhost or the Codex in-app browser, and record UI results separately             |

Next: [CSV export case](CASE-CSV-EXPORT.md).
