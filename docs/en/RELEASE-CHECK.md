# Local MVP release checks

[简体中文](../zh-CN/RELEASE-CHECK.md)

The release target here is that other developers can obtain the code, initialize and run single-team OpenTask locally, and complete a synthetic delivery using the documentation. Public hosting, production deployment and real-team acceptance require separate verification.

## Check order for each candidate

From the repository root, run:

```sh
npm ci
npm run typecheck
npm run build
bash scripts/test-db.sh
npm run case:check
npm audit --omit=dev
npm run docs:build
```

`test-db.sh` uses the fixed `open_task_test` database and deliberately injects one transaction write failure there to check rollback. `Injected integration write failure` in its logs is part of that rollback check, and the final result should have 0 failures. Never point integration tests at a normal or production database. The case command (`npm run case:check`) uses `open_task_release_case` separately and does not clean up existing case projects.

After type checks and builds pass, check operations in the interface. In the [case tutorial](CASE-CSV-EXPORT.md), complete at least task C (Implement CSV export) using member, project manager and leader accounts. Check creation approval, checklist approval, agreement confirmation, formal progress, return, resubmission, completion and retained history after refresh. If standalone Chrome is available, you can also run the existing browser scripts. Some are fixed to `4310` and save test tasks; first confirm their target workspace.

## Acceptance conditions

| Check                           | Required result                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Installation                    | `npm ci` succeeds under Node 24 with a complete lockfile                                                             |
| Build                           | typecheck and production build exit 0                                                                                |
| Business rules and transactions | All existing tests pass without skips; permission and database failures leave no partial writes                      |
| Delivery                        | All four API case tasks complete and all 13 assertion groups pass                                                    |
| Interface                       | The three-role interface workflow passes; results and language selection survive refresh                                            |
| Data and queued work after restart                 | Consistent data after API/worker restart; queued work resumes after downtime                                         |
| Case restore                    | Backup restores into a new database and all 12 tables match in row count and content                                  |
| Dependency security             | No unresolved production audit findings; a network failure is recorded as unverified, not passed                     |
| Documentation                   | Markdown links, screenshots and HTML render correctly; roles, button labels and commands match the current version   |
| Recovery                        | Backup and isolated restore have been rehearsed before releasing or upgrading an existing workspace, with evidence retained |

Record the date, candidate commit and uncommitted changes, command output, case run ID, screenshots and limitations in the verification report. Fix failures, then rerun affected checks; a historical report is not a current-version result.

## Backup, upgrade and recovery

The existing normal-application database tools are:

```sh
bash scripts/backup.sh
bash scripts/restore-check.sh backups/<actual-backup-file>.dump
```

Their source database is fixed to `open_task`; they do not follow `DATABASE_URL` automatically. Do not use them to claim case-database verification. For precise comparisons, first pause application writes and the worker. Both restore scripts use the same read-only comparator for all 11 application tables and `pgboss.job`, including time preferences, sessions and idempotency records. A content mismatch fails even when row counts match. The normal restore database is retained for inspection. The restore script creates a new isolated database without overwriting the original. Backups contain business data, account password hashes and pg-boss jobs; keep them as private operational material rather than publishing them with documentation. They preserve submission text and external evidence URLs, but not the remote files those URLs point to. Job failure details remain in PostgreSQL.

At the end, `case:check` calls `scripts/release-case-restore.sh`. It backs up only the synthetic case database, restores it into a new temporary database, compares row counts and content for 12 tables (a content difference fails the check), and then removes the temporary database and backup. While `case:check` runs, do not write to the case database and do not start additional workers. This restore verifies the case database only; before upgrading a normal existing workspace, still verify that workspace's actual backup as described above.

Upgrade a normal existing workspace in this order: stop writes and back up → retain the old code version → install dependencies → migrate → build → restart API and worker → check `/health`, worker heartbeat and an actual task. Migrations are currently additive, but recovery must still be rehearsed; deleting volumes or databases is not the default rollback procedure.

Check worker heartbeat:

```sh
docker compose exec -T db psql -U open_task -d open_task -c "SELECT name, checked_at, error FROM worker_health;"
```

`followups.checked_at` should keep advancing. A normal sweep runs every 15 seconds, and `error` should be empty. API health is not a substitute for this check.

## Release contents and scope

Release materials include source code, `package.json` and lockfile, database migrations, README, the `docs/` user documentation, third-party licenses and runnable case scripts. HTML can be rebuilt from Markdown. Do not treat all test logs, session material or database backups in `artifacts/` as public release attachments.

The current `private: true` prevents direct `npm publish`. This candidate is for source or local-installation delivery and does not change npm distribution policy. The project release process determines version numbers, official channels and deployment operations.

Network boundaries: the API and database bind to loopback; sessions are designed for local HTTP, and server writes also validate a same-origin Origin. This case did not verify public HTTPS, reverse proxies, cross-host access or external identity integration. Changing the listen address to an external one does not complete public verification; these items still need their own tests.

See the [verification report](RELEASE-CASE-RESULT.md) for the recorded evidence.

## Alpha candidate handoff

Version metadata and the intended tag are `0.1.0-alpha` and `v0.1.0-alpha`. The project license is [Apache-2.0](../../LICENSE); keep separate third-party notices. Review the [release notes](RELEASE-NOTES.md) and [current candidate evidence](RELEASE-READINESS.md). Before merging, commit all required code, lockfile, scripts, docs and brand assets. Verify a clean source copy with `npm ci` and the checks above. After merging, ensure the release tag resolves to that same verified tree and mark the release as a prerelease. Merge, push, tagging and publication are explicit release operations.
