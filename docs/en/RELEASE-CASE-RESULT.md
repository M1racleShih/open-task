# Synthetic development project verification report

[简体中文](../zh-CN/RELEASE-CASE-RESULT.md)

Verification date: 2026-10-09 (Shanghai time). The candidate was the workspace based on `c51e608e3faf01e7a7d022699b317b7a11283811`, including the case scripts, user documentation, HTML generator and dependency patches evaluated in this report. These are not verification results for that historical commit alone.

This report preserves the historical results of run `629cde03` and its accompanying interface walkthroughs. See the [candidate readiness report](RELEASE-READINESS.md) for later candidate verification; increases in test count or comparison coverage do not update this report.

## Conclusion

The recorded candidate passed local single-team MVP functionality, persistence and dependency checks and can serve as a candidate for local demos and source delivery. The four-task synthetic development project completed approval, execution, blocker collaboration, change confirmation and result review, and checked prerequisite restrictions. The three-role UI walkthrough also completed return, resubmission and final acceptance.

This conclusion applies only to the recorded local environment and synthetic data. Public deployment, production use, real development efficiency and sustained capacity are outside its scope. The case verifies task collaboration, not the implementation of a real CSV feature.

## Environment and results

| Check                        | Result and evidence                                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation                 | Node 24.18.0 / npm 11.8.0; `npm ci` succeeded after the dependency upgrades                                                                                                                                                          |
| Type checking                | `npm run typecheck` exited 0                                                                                                                                                                                          |
| Production build             | `npm run build` exited 0; Vite 8.2.2                                                                                                                                                                                  |
| Unit and database regression | `scripts/test-db.sh`: 48 passed, 0 failed, 0 skipped                                                                                                                                                                  |
| HTTP case                    | `npm run case:check`: 13 assertion groups passed, run `629cde03`; all four tasks were done                                                                                                                            |
| Case backup and restore      | The same case command restored into a new database and nine tables matched in row count and content hashes; temporary backup and restore database were removed                                                        |
| Browser                      | A task creation and result review using three roles completed on a newly started instance after the dependency upgrades                                                      |
| Dependency audit             | After the dependency upgrades, `npm audit --omit=dev`: 0 known vulnerabilities                                                                                                                                                            |
| New script formatting        | Two TypeScript scripts passed Prettier; two Bash scripts passed `bash -n`                                                                                                                                             |
| Documentation rendering      | The recorded `docs:build` generated eight pages and checked 24 local references; three tutorial screenshots loaded, desktop and 390px layouts had no page-wide horizontal overflow, and browser error logs were empty |

HTTP API report: [result JSON](../assets/release-case/api-result.json). Full case and backup/restore output: [run log](../assets/release-case/api-run.txt). These files contain only synthetic project information, account display information and test results, without session cookies or password hashes.

## Automated case coverage

The four-task project is `[模拟验收 629cde03] IssueLite CSV 导出`. Its task numbers apply only to the case database: A delivery summary OT-7, B export rules OT-8, C implementation OT-6 and D test delivery OT-9. Three child tasks belong to A; C depends on B, and D depends on C.

The 13 assertion groups cover:

1. Five independent HTTP sessions log in; credentials stay out of the report.
2. Ordinary members cannot create projects; writes without CSRF are rejected.
3. Private drafts are hidden from other members; default reviewer assignment is correct; idempotent retries create only the same task.
4. Project-manager approval still waits for the team leader; admin cannot approve instead; submitted tasks are team-visible.
5. Four tasks, three parent/child relations and two prerequisites persist.
6. Task acceptance and checklist requests produce the right followups; the current checklist remains unchanged until approval.
7. Adjustments retain the prior commitment; old versions conflict; unconfirmed versions cannot submit results, and confirmation permits continuation.
8. Blocker reports, helper followups, replies and resolution work; comments do not postpone formal feedback.
9. Formal progress retains the next step; a 100% checklist does not complete the task automatically.
10. Non-reviewers are rejected, unfinished prerequisites block acceptance, and returns retain submissions and reasons.
11. Resubmission passes after prerequisite acceptance; old submission IDs are rejected; both submission records remain.
12. Children do not complete the parent automatically; after explicit acceptance all four tasks complete with no active followups; terminal states cannot reopen.
13. Operation history is complete; tasks and sessions survive API restart; the worker consumes downtime queues, produces a new heartbeat after restart and retains consistent data.

The runner starts its own API on fixed loopback port `4318` and cannot target an existing workspace. Both the database URL and actual database name are checked against `open_task_release_case`. Business actions use HTTP writes; database queries assert persistence and worker behavior.

## Interface walkthrough coverage

The initial walkthrough created `[模拟UI验收] IssueLite CSV 导出` and implementation task OT-5 through real forms in the isolated case database. After the dependency upgrades, a new instance on `4321` created OT-10 `[模拟UI复核] 实现 CSV 导出` in the same synthetic project and repeated:

```text
member creates draft → submits for approval
manager approves creation → still waits for leader
leader approves creation → awaits member acceptance
member accepts and starts → requests three checklist items
leader approves checklist → adjusts agreement
member confirms version 2 → records progress → checklist 3/3
member submits result v1 → manager returns it with next feedback time
member submits result v2 → manager accepts result
switch to Chinese → refresh → Completed, both submissions retained
```

Task link after the dependency upgrades: [OT-10](http://127.0.0.1:4321/?task=ff691604-bb31-4d92-8ac4-848ab9731367). It works only on this machine with the corresponding case database and service running; the tutorial does not depend on a fixed UUID. The collected browser error log returned an empty list.

This additional UI walkthrough primarily verified C's interaction path. B/D/A's complete lifecycle, blocker collaboration, unauthorized actions and prerequisite rejection were covered by the automated API case. Those API checks were not listed as full UI acceptance.

The original verification screenshots below use Chinese controls and retain project and task text as entered. They are linked as historical evidence; translating this report does not change or repeat the recorded checks.

- [Completed task after the dependency upgrades — original Chinese interface](../assets/release-case/completed.jpg).
- [Parent/child and prerequisite relations in the four-task automated case — original Chinese interface](../assets/release-case/graph.jpg).

## Dependency issues found and fixed during release checks

The initial production audit reported one high and three moderate findings; this was not a business-flow failure. Only direct Fastify and affected transitive dependencies were updated, preserving other dependencies and business behavior.

| Dependency      | Previous version | Fixed version | Change                                                                              |
| --------------- | ---------------- | ------------- | ----------------------------------------------------------------------------------- |
| fastify         | 5.12.3           | 5.12.5        | Direct patch; HTTP/2 trailer DoS advisory                                           |
| brace-expansion | 5.0.9            | 5.0.12        | Transitive patch; recursion and expansion DoS advisory                              |
| fast-uri        | 3.1.7 / 4.1.4    | 3.1.8 / 4.1.5 | Separate patches for both branches; URI normalization and mailto parsing advisories |
| ip-address      | 10.7.0           | 10.7.1        | Transitive patch; address-family detection and excessively long input advisories    |

Transitive dependencies use `package.json` overrides, with the two fast-uri version families pinned separately. The lockfile was updated and checked with `npm ci`. Continue auditing future updates; pinned versions are not a permanent security guarantee. After the upgrades, all 48 tests, the complete API case, backup/restore and the browser workflow using three roles were rerun and passed.

## Verification scope and release boundaries

Permissions, private drafts, CSRF, versions and submission IDs were checked with actual assertions. Existing regression tests also cover login, account disabling, logout, concurrent relations, transaction rollback, time preferences and rejection of executable Markdown content. A dependency audit checks current advisories and is not an independent penetration test.

The API and database bind locally, with test accounts for local cases. Session cookies, same-origin checks and startup retain the local HTTP design. This verification did not extend listening scope or change external identity or reverse-proxy policy.

Case recovery verifies a synthetic database. Before upgrading a real existing workspace, verify its actual backup using [release checks](RELEASE-CHECK.md). Load tests were not rerun; cross-machine access, attachment uploads, external notifications and long-term real-team use were not verified. See [release notes](RELEASE-NOTES.md) for distribution and licensing, and [third-party notices](THIRD-PARTY-NOTICES.md) for asset licenses.

Markdown is the documentation source; HTML can be rebuilt with `npm run docs:build`.
