# Local setup

[简体中文](../zh-CN/QUICKSTART.md)

Install once, keep two terminals running, then sign in and [complete your first task](FIRST-TASK.md). If you already have a workspace, [prepare an isolated tutorial database](DEVELOPMENT.md#prepare-an-isolated-database-for-the-tutorial) to keep examples out of it.

## Environment

You need Node.js 24 LTS, npm, Docker Engine and Docker Compose. The normal application uses port `4310`, and PostgreSQL uses `55432`; both listen only on localhost.

If you have not obtained the source, run:

```sh
git clone https://github.com/M1racleShih/open-task.git
cd open-task
```

If you already have it, enter the repository root and run: Initialization does not clear existing tasks, and repeated `npm run db:seed` runs do not reset existing account passwords. Back up an existing workspace first, as described in [release checks](RELEASE-CHECK.md).

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

| Username | Display name         | Main purpose                                                                  |
| -------- | -------------------- | ------------------------------------------------------------------------------------------- |
| leader   | Test Leader          | Creates projects, gives final creation approval, approves checklists and adjusts agreements |
| manager  | Test Project Manager | Assign as manager when creating the example project; can own or review tasks                             |
| member   | Test Member          | Ordinary member; can own or review tasks                                                                        |
| other    | Test Other Member    | Another ordinary member for multi-person exercises                            |
| admin    | Test Administrator   | Account administration; receives no automatic business approval authority                   |

The project manager is assigned by a project, rather than being a separate global account role. The initial interface is English. Use Language at the top to switch to Simplified Chinese; the choice survives refresh. Task content is not translated automatically.

## Your first successful sign-in

![English sign-in page with the username and Sign in button marked](../assets/walkthrough/en/01-sign-in.svg)

Use **① Username** `leader` and password `OpenTask-Test-2026!`, then **② Sign in**. You should see the task tree, graph and an empty details panel. **New project** is available to this account. If it is missing, check **Account** to see who is signed in.

Next, [complete your first task](FIRST-TASK.md) to try creation, acceptance, progress and review.

## Stopping and restarting

Press Ctrl+C in the API and worker terminals. To stop the database, run `docker compose stop db`. The database volume is `open-task-mvp_database`; stopping services does not delete data. Restart the database, API and worker using the same commands. `docker compose down -v` deletes the database volume and is not used for ordinary stops or case reruns.

## Common startup problems

| Symptom                                             | Check                                                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Login fails                                         | Correct database and password; repeated seeding does not reset existing accounts                                  |
| The page opens, but overdue reminders do not update | A worker is running against the same database                                                                     |
| Database errors after an update                     | Run `npm run db:migrate` before starting                                                                          |
| Address already in use                              | Find the process using the port; stop it if no longer needed or choose a free port. Keep services you still need running |

Next: [complete your first task](FIRST-TASK.md).
