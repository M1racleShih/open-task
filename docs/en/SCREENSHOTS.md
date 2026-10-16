# Screenshots and check records

[简体中文](../zh-CN/SCREENSHOTS.md)

The illustrated guide uses **30 real browser captures from 2026-10-13 (Asia/Shanghai)**. They show OpenTask running locally, with English controls and English synthetic task content. Numbered borders are editorial annotations around the original pixels; no task status, result or control was redrawn.

## Where these images came from

| Item | Recorded value |
| --- | --- |
| Application | Working tree based on `b1ef2a2e0593cade0fc85f006d1b36e3963b8f67`, including application edits already present before this documentation work |
| Browser | Codex in-app browser, Chromium; independent Chrome returned `ERR_ACCESS_DENIED` for localhost |
| Environment | Isolated `open_task_docs_20261013` PostgreSQL database; API on loopback port 4322 plus a separate worker |
| Accounts | Five seeded local demo accounts; no real business records |
| How tasks were created | Browser forms and actions; no API/SQL task fixture insertion |
| Images | 30 original JPEGs plus 30 SVG presentations; desktop 1440×1000, phone 390×844, initial sign-in 945×1107 |
| Annotations | Crops and numeric callout positions in the [manifest](../assets/walkthrough/manifest.json) |

The login screenshot was taken at the browser's initial viewport; desktop/phone sizes were then used for layout checks. A crop highlights a form or task panel. The full raw JPEG remains available under each image in the generated site. Chinese and English editions share the same English captures.

## What actually ran

A real browser completed creation, approval return/edit/resubmission, two-level approval, direct issue, separate acceptance/start, checklists, formal progress, discussion, blocker help/reply/resolution, agreement request/adjustment/confirmation, prerequisite rejection, result return/resubmission/acceptance and parent review.

The same project continued through a follow-up's refusal, reassignment, rejected checklist, scope-changing checklist, adjustment-request closure, pending-result supersession, rename and cancellation. Navigation checks exercised search, project/status/custom time filters, saved project time preferences, graph controls, history/author filtering, project color, account disabling/re-enabling, language persistence, dark mode and mobile details.

Afterward, **seven read-only database assertions passed**: four core tasks Completed; C retained returned/accepted results; its three checklist items were saved; its blocker was resolved; E was Cancelled; E's result was Superseded; F remained a private draft. [Recorded state and event counts](../assets/walkthrough/result.json) contain no passwords or sessions. The browser's captured error log was empty.

| Local number | Tutorial label | Final state |
| --- | --- | --- |
| OT-1 | C · Implement CSV export | Completed; two submissions under agreement version 3 |
| OT-2 | A · Deliver CSV export v0.1 | Completed after its own review |
| OT-3 | B · Confirm export rules | Completed |
| OT-4 | D · Verify and prepare delivery notes | Completed |
| OT-5 | E · Assess CSV import for a later release | Cancelled; prior pending result retained as Superseded |
| OT-6 | F · Collect feedback for the next iteration | Private undated temporary draft |
| OT-7 | Refusal screenshot replay | Cancelled after capturing the issuer’s view |

The refusal image was replayed as OT-7 to capture the issuer’s own followup, rather than the former owner’s view. The numbers apply only to this database. On your own run, use titles and copied task URLs. The tutorial deliberately uses relative instructions for future dates instead of making the recorded October dates a requirement.

## What this run does not prove

The account creation and draft deletion forms were inspected and closed without submitting. Account seeds created the five demo users. Some graph constraints, parent-review exceptions, older-record pagination and account-transfer rules were read from the implementation; the per-feature records below identify these limits.

This run did not repeat backup/restore, load tests, security acceptance, idempotency races or scheduled worker recovery. It does not prove that a real CSV feature was implemented, that an external evidence URL is valid, or that the alpha is ready for production. Older [release case results](RELEASE-CASE-RESULT.md) and [candidate readiness](RELEASE-READINESS.md) retain their original dates and scope.

## Per-feature check records

These records preserve the 2026-10-13 rehearsal. A/B/C/D are the core CSV tasks, E is the import follow-up proposal and F is the private feedback draft. Browser means an action was submitted and its response observed; form-only checks were not submitted; implementation-based explanations are marked as code or reference. Editing documentation does not change this date or scope.

### Create and deliver

| Feature | Operation in the recorded case | Check record |
| --- | --- | --- |
| Private drafts, editing and temporary tasks | C is edited after an approval return; F stays undated and unassigned to a project. | Browser |
| Delete a draft | F: Delete draft opens its confirmation; Discard form leaves it intact. | Form only; deletion not submitted |
| Creation approval and return | C: manager returns it, member edits, manager approves, leader gives final approval. | Browser |
| Direct issue and reviewer defaults | A/B/D are issued by leader; C defaults to manager as reviewer. | Browser |
| Accept, start, accept-and-start | C uses two actions; A/B/D use the shortcut. | Browser |
| Unable to accept and reassign | E reports a capacity conflict; its replacement owner accepts anew. | Browser |
| Submit, return, resubmit, accept | C retains a returned result and an accepted result. | Browser; evidence-link field inspected, no fabricated links |
| Rename, cancel, terminal tasks | E is renamed and cancelled; completed work needs a new related follow-up. | Browser; no-reopen rule from code |

### Progress, checklists and help

| Feature | Operation in the recorded case | Check record |
| --- | --- | --- |
| Checklist proposals, approval and rejection | C gets three steps; E has an over-scoped proposal rejected. | Browser |
| Save checkmarks and keep result review separate | C refreshes at 3/3, 100%, while still In progress. | Browser + stored-state assertions |
| Formal progress and comments | C records current work, next step and next feedback, plus a separate discussion comment. | Browser |
| Blocker, helper reply and resolution | C asks manager to confirm empty-result headers and records the answer. | Browser + stored-state assertions |
| Request a change, respond and close | C requests encoding clarification; E receives a reasoned refusal to extend implementation scope. | Browser |
| Version differences, confirmation and submission guard | C attempts a result before confirmation and sees the server rejection. | Browser |
| Scope-changing checklist and pending-result supersession | E confirms a scope change; a later adjustment supersedes its pending result. | Browser + stored-state assertions |

### Task relations

| Feature | Operation in the recorded case | Check record |
| --- | --- | --- |
| Primary parent and independent parent review | A contains B/C/D and remains unfinished until its own result is accepted. | Browser |
| Prerequisites and review enforcement | C cannot pass before B; D needs C. Starting early is allowed. | Browser |
| Related tasks, remove links and graph rules | E links to C without a dependency. The guide covers removal, cycles, one parent and unfinished children. | Related link in browser; remaining constraints from code |

### Search, filters and pending actions

| Feature | Operation in the recorded case | Check record |
| --- | --- | --- |
| Tree, graph, details and task URLs | Open C by URL across roles and select the same record in different views. | Browser |
| Graph focus, zoom, locate and reset | Use Direct relations only, Fit view, Locate selected, Zoom in/out and Reset layout. | Browser; node drag/pan behavior from code |
| Search, project/status filters and ancestor context | Search C by title, or a task by its numeric number; the parent remains context rather than another match. | Browser |
| Global/project time filters, undated and earlier unfinished tasks | Save a custom range, refresh, reselect the project, then Follow global. Include undated and earlier unfinished work. | Browser; week/month boundary math from code |
| Action inbox, current handler and overdue followups | C hands approval, help, confirmation and review to the right person; leader sees team followups. | Browser for current followups; timed overdue/restart recovery not rerun |
| Task activity, team updates and older records | Read C’s history; filter team updates to Test Member. Load more retrieves older pages. | Browser; pagination contract from API/code |
| Panel controls and mobile layout | Use tree/graph/details views; phone-width task details retain the same record. | 390px browser check; resize behavior from code |

### Projects and accounts

| Feature | Operation in the recorded case | Check record |
| --- | --- | --- |
| Create project, manage people and color | The IssueLite project is created in a form and its color is changed. Only leader can replace its manager. | Browser; manager-transfer constraints from code |
| Sign in, switch users, sign out and private visibility | Five seeded accounts use real sessions; member’s draft F is absent from admin’s view. | Browser |
| Create accounts and choose roles | Inspect Accounts + as admin. Account roles differ from task assignments. | Form only; demo accounts created by seed |
| Disable and enable accounts | Disable/re-enable other after its responsibilities end; do not disable a leader or yourself. | Browser; transfer guards from code |
| English/Chinese and light/dark preferences | Switch language, refresh to check persistence, return to English; capture desktop and mobile dark mode. | Browser; all saved screenshots English |

### API, operation and documentation

| Feature | Operation in the recorded case | Check record |
| --- | --- | --- |
| HTTP API, sessions, CSRF, idempotency and concurrency | Use the API reference for request fields, versions, errors and cursor pagination and per-page limits. | Reference/code; previous API acceptance is separate |
| Database migrations, background worker, backup and restore | Keep API/worker on the same database; use release procedures before upgrading real data. | Setup used here; backup/load/security checks not rerun |
| Development checks and offline documentation | Build local HTML, maintain both languages and validate screenshot language. | Documentation build/tests and rendered checks |

## Browse additional views

The main tutorial places images next to the relevant action. These full-size captures provide additional context:

- [Task activity and field changes](../assets/walkthrough/en/32-task-activity.jpg).
- [Desktop task details in dark mode](../assets/walkthrough/en/36-dark-theme.jpg).
- [Complete English workspace](../assets/walkthrough/en/08-workspace.jpg).
- [Mobile task details in dark mode](../assets/walkthrough/en/37-mobile-detail.jpg).

## Refresh the documentation images

Follow the [documentation maintenance](MAINTAINING.md). New captures must come from the running app, use synthetic English content and preserve the original JPEG. Update both language editions and the manifest when the behavior changes. Running the annotation script regenerates presentation files; it does not replay the browser flow or constitute a new verification run.
