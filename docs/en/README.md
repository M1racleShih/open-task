# OpenTask documentation

[简体中文](../zh-CN/README.md)

Use OpenTask to create and assign tasks, record progress, submit results and review them. Each task keeps its requirements, owner, pending actions and operation history together. The latest tagged prerelease is **0.1.2-alpha**, for one team running locally. These guides also cover subsequent improvements merged into `mvp`; [release notes](RELEASE-NOTES.md) identify which version includes each change.

## First visit

1. **[Install locally and sign in](QUICKSTART.md)**: start the app from source and enter the workspace with demo accounts.
2. **[Complete your first task](FIRST-TASK.md)**: create a task, switch to its owner to accept and work on it, then submit a result to its reviewer. Allow about 10 minutes for this exercise after installation.
3. **[Look up controls and rules](USER-GUIDE.md)**: find the action inbox, progress, task relations or account management when you need them.

For multi-person approval, blockers, requirement changes and returned results, continue with the [advanced CSV export project](CASE-CSV-EXPORT.md). The full case takes about 45–60 minutes and can be completed in sections.

[![OpenTask English interface: task tree and Gantt schedule with prerequisite arrows](../assets/updates/2026-10-16/workspace-current-en.jpg)](../assets/updates/2026-10-16/workspace-current-en.jpg)

Returning after an update? Read [what changed](RELEASE-NOTES.md) for Gantt planning, calendar inputs, member filters, Markdown editing, checklist saving and panel layouts. The screenshot shows the integrated source based on `mvp` at `143e9e7` with synthetic English tasks.

## Find a day-to-day operation

| You want to… | Read |
| --- | --- |
| See actions assigned to you and team updates | [Action inbox and history](USER-GUIDE.md#check-the-action-inbox-and-operation-history) |
| Accept tasks, report progress, submit or review results | [Task workflow](USER-GUIDE.md#task-workflow-from-creation-to-review) |
| Change requirements or reassign a task | [Change requirements and confirm the new version](USER-GUIDE.md#change-requirements-and-confirm-the-new-version) |
| Read the delivery schedule | [Gantt chart](USER-GUIDE.md#read-the-delivery-schedule) |
| Set parents and prerequisites | [Task relations](USER-GUIDE.md#set-task-relations-and-use-the-graph) |
| Find work owned, created or reviewed by a member | [Member filters](USER-GUIDE.md#filter-tasks-by-member) |
| Search and filter by project and time | [Search and filters](USER-GUIDE.md#search-and-filter-by-project-status-and-time) |
| Find answers about permissions, checklists, progress, delivery and dates | [Everyday collaboration Q&A](FAQ.md) |
| Find an explanation of a feature | [Features and controls](FEATURES.md) |

## Installation, development and maintenance

| You want to… | Read |
| --- | --- |
| Install, restart or troubleshoot startup | [Local setup](QUICKSTART.md) |
| Change code, run tests or prepare an isolated walkthrough database | [Development](DEVELOPMENT.md) |
| Connect an HTTP client | [API v1](API.md) |
| Back up, restore or check a candidate release | [Release checks](RELEASE-CHECK.md) |
| Build offline docs or update translations, screenshots and diagrams | [Documentation maintenance](MAINTAINING.md) |
| Understand version scope and licensing | [Release notes](RELEASE-NOTES.md) · [Third-party notices](THIRD-PARTY-NOTICES.md) |
| Read historical verification results | [Screenshots and check records](SCREENSHOTS.md) · [Historical case report](RELEASE-CASE-RESULT.md) · [Candidate check results](RELEASE-READINESS.md) |

## Before trying it

This version is for trying a single team's workflow on your own machine. Submitted tasks are visible to the whole team; project membership does not isolate data. External identity login, file uploads, outbound messaging and AI Agent integration are unavailable. Evidence is stored as links.

Task acceptance, checklist approval, requirement-change confirmation and result review each require the appropriate person to act. Try one small project to assess whether these steps help your team clarify requirements, handle changes and follow results. Workflow overhead, long-term usability and sustained capacity still need real-team trials.

Dates use Asia/Shanghai. Changing interface language translates controls; task content stays as entered. See [release notes](RELEASE-NOTES.md) for further limits.
