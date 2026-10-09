<p align="center">
  <img src="web/public/brand/opentask-cat-logo.png" width="180" alt="OpenTask cat logo">
</p>

# OpenTask

English · [简体中文](README.zh-CN.md)

OpenTask helps a team agree on what to deliver, confirm who will do it, and review the result. Each task keeps its agreement, progress, changes and review decisions together, so the team can see what was promised and what happened.

The current release candidate is **0.1.0-alpha**, a local, single-team MVP with an English and Simplified Chinese interface. See the [release notes](docs/en/RELEASE-NOTES.md).

## What you can do

| Capability          | How it helps                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Agree on work       | Define the expected result, acceptance criteria, owner, reviewer and deadlines; get creation approval from the responsible people. |
| Follow execution    | Use approved checklists, formal progress updates and blocker requests; followups show who needs to act next.                       |
| Review delivery     | Submit results and evidence links, accept or return them, and retain earlier submissions and review reasons.                       |
| Understand the work | Use the project tree and task graph for parent/child, prerequisite and related tasks; filter by project, status, search and time.  |

Language and light/dark theme choices persist in the browser. Task content is not translated automatically. Dates are entered and displayed in **Asia/Shanghai** time.

## Design philosophy in practice

These rules explain how OpenTask handles responsibility, changes and delivery:

- **The owner accepts the work.** Assigning someone a CSV export task leaves it awaiting acceptance. The owner reads the expected result and deadlines before accepting; creation approval and the owner's commitment are separate decisions.
- **The reviewer decides when it is complete.** Checking every execution step helps track work. To finish, the owner submits a result and the reviewer accepts it against the agreed criteria.
- **The owner confirms changes.** If the team leader changes the scope or deadline, the owner confirms the new version. A replacement owner must accept the task again.
- **Keep rework in the same task.** If the reviewer returns a result, the owner improves and resubmits in the same task. Earlier submissions and return reasons remain available to both people.
- **Parents group work; prerequisites constrain review.** A parent groups smaller tasks. A prerequisite means another task's result must be accepted before this result can be accepted; it does not prevent work from starting early. Completing child tasks does not automatically complete their parent.
- **Follow-up work gets a new task.** Completed and cancelled tasks cannot reopen. Later fixes become new tasks related to the original, preserving the earlier delivery decision.

See the [user guide](docs/en/USER-GUIDE.md) for approval routes, roles and the full lifecycle.

## Quick start

You need **Node.js 24 LTS**, npm, Docker Engine and Docker Compose. Ports `4310` (app) and `55432` (PostgreSQL) must be free; both services listen only on localhost. For an existing workspace, [back up before updating](docs/en/RELEASE-CHECK.md).

From the repository root:

```sh
npm ci
docker compose up -d --wait db
npm run db:migrate
SEED_PASSWORD='OpenTask-Test-2026!' npm run db:seed
npm run build
npm start
```

In a second terminal, from the same directory:

```sh
npm run worker
```

Open <http://127.0.0.1:4310/>. **Keep both the API and worker running.** The worker handles background jobs, including overdue reminders.

The seed command creates these local test accounts in a new database, with initial password **`OpenTask-Test-2026!`**:

| Username  | Responsibility                                                          |
| --------- | ----------------------------------------------------------------------- |
| `leader`  | Team leader; creates projects and gives final creation approval.        |
| `manager` | Member; can be assigned as a project's manager.                         |
| `member`  | Member; can own and execute tasks.                                      |
| `other`   | Additional member for collaboration and permission checks.              |
| `admin`   | Account administrator; this role grants no business approval authority. |

Migration and seeding are repeatable. Seeding does not reset existing passwords. The interface starts in English; use **Language** to switch to Simplified Chinese.

Stop the API and worker with Ctrl+C, then run `docker compose stop db` to stop PostgreSQL. Data stays in the `open-task-mvp_database` volume. **`docker compose down -v` deletes that data.** See [local setup](docs/en/QUICKSTART.md) for restarts, troubleshooting and an isolated case environment.

## Documentation

The full documentation is available in [English](docs/en/README.md) and [简体中文](docs/zh-CN/README.md). Each page links to its counterpart.

| Read                                                                                               | Covers                                                               |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [User guide](docs/en/USER-GUIDE.md)                                                                | Roles, approval, execution, changes, review and task relations.      |
| [CSV export case](docs/en/CASE-CSV-EXPORT.md)                                                      | A complete delivery with synthetic accounts and tasks.               |
| [Development](docs/en/DEVELOPMENT.md)                                                              | Build commands, database tests, browser checks and load testing.     |
| [API v1](docs/en/API.md)                                                                           | Sessions, write requirements, endpoints and time filters.            |
| [Release checks](docs/en/RELEASE-CHECK.md) · [Verification report](docs/en/RELEASE-CASE-RESULT.md) | Backup and recovery, recorded checks, evidence and remaining limits. |

Build the bilingual documentation as offline HTML:

```sh
npm run docs:build
```

Output: `artifacts/docs/index.html`. See the [documentation entry](docs/README.md) for preview and maintenance instructions.

## Development

The app uses React and Vite, a Fastify API, PostgreSQL and a separate pg-boss worker. `ui-previews/` contains the earlier requirements demo.

```sh
npm run typecheck
npm run build
bash scripts/test-db.sh
```

The database checks use synthetic fixtures in `open_task_test`. With the Compose database running, `npm run case:check` verifies the API lifecycle and backup/restore in `open_task_release_case`. Follow the [development guide](docs/en/DEVELOPMENT.md) for the scope and prerequisites of each check.

## Current scope and licenses

This version supports one team running locally. Non-draft tasks are visible to the whole team; project membership does not make them private. External identity or directory login, file uploads, outbound messaging, and model or Agent integration are not included. Approval overhead, long-term usability and capacity still need trial use in real teams.

Product specifications and historical reviews live in the separate [open-task-specs repository](../open-task-specs/README.md). That link assumes sibling checkouts; the specifications repository is not required to build or run OpenTask.

OpenTask is licensed under [Apache-2.0](LICENSE). [Third-party notices](docs/en/THIRD-PARTY-NOTICES.md) cover the separate Lucide ISC and Feather MIT icon licenses; the complete Lucide license is also distributed with the app at `/lucide-LICENSE.txt`.
