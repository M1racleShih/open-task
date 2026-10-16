# OpenTask everyday collaboration Q&A

[简体中文](../zh-CN/FAQ.md)

This handbook is for members, project managers and team leaders. It answers common questions about permissions, task creation, checklists, progress, delivery, review and dates in the current single-team alpha. All dates use Shanghai time.

Before acting, check the task's owner, reviewer, status and waiting handler. **Checking off steps, recording progress, submitting a result and accepting a result are separate actions. A task is complete only after its result is accepted.**

The workspace image is from October 16, 2026; the remaining illustrations reuse the English walkthrough screenshots from October 13 to locate controls and fields. Their tasks and dates are example data, not current work. Current controls follow merged `mvp`; see [release notes](RELEASE-NOTES.md) for version scope and image provenance, and [Screenshots and check records](SCREENSHOTS.md) for the older captures. For a first exercise, start with [Your first task](FIRST-TASK.md).

## 1 Interface entry points

### Q1 Where should I start each day

Open **Action inbox** from the top bell or sidebar and check **Assigned to me**. Select an item, then read **Status, Owner, Reviewer and Waiting for** at the top of its details. Team leaders also have **Following team** for team follow-ups.

On desktop, the task tree is on the left and the center workspace opens with a Gantt chart; **Task graph** remains available in its tabs. Select a task in the tree or either view to open its details, then scroll inside that panel to reach its content and actions. On a phone, first switch to **Task details**.

[![English workspace with a task tree and Gantt delivery schedule](../assets/updates/2026-10-16/workspace-current-en.jpg)](../assets/updates/2026-10-16/workspace-current-en.jpg)

### Q2 Why can I not see a particular action button

Actions depend on your identity and the task's stage. For example, only the task owner can record formal progress, and only its assigned reviewer can accept a result.

Check your signed-in account, whether you are the owner or reviewer, and the current stage. Scroll inside the details panel. If someone recently changed the task or agreement, refresh and read the changes before acting. Refresh does not save an unsubmitted form or checklist changes.

## 2 Account roles and project responsibilities

### Q3 Can a member create a project

No. Only an account with the **leader** role can create projects. Being a project manager, or having only the admin role, does not grant this permission.

The team leader clicks **New project** above the task tree, enters the name, selects the project manager, members and color, then submits. Ordinary members do not see this button and cannot create projects through the API either.

### Q4 Is manager a global role or a project responsibility

**A manager is assigned to a particular project, not a global account role.** The account roles are admin, leader and member. Each project has one manager.

One person can manage project A while participating as a member in project B, or manage several projects. Project managers maintain their project's membership and color and handle its task creation approvals. They can review a task only when assigned as that task's reviewer. The demonstration username `manager` is not a global role.

### Q5 Can a member become project manager after tasks have been created

Yes. The team leader expands the project, opens **Manage project members**, chooses an active account in **Project manager**, and submits. Each project has one manager, so this replaces the previous manager.

![Project settings for manager, members and color](../assets/walkthrough/en/33-project-settings.svg)

Existing tasks do not always prevent a change, but either of these conditions does:

- A task in the project is currently in creation approval.
- The outgoing manager owns or reviews a non-draft, unfinished task in that project.

Resolve approvals or have the team leader transfer the relevant task responsibilities through **Adjust agreement** before changing managers. The change does not automatically replace existing task owners, reviewers or history. To assign someone a single task, change its owner rather than its project manager.

### Q6 Can members see other team members' progress

Yes. Submitted tasks are visible to the whole team, including their content, checklists, formal progress, submissions and activity. The viewer need not be listed as a project member.

Other people's private drafts are hidden. Once submitted for approval, a task remains team-visible even if returned for editing. Project membership organizes collaboration; it does not isolate data. Viewing a task does not authorize updating its progress or reviewing it on someone else's behalf.

### Q7 How do I view a person's updates or a task's history

Open **Activity** for one task, or **Team updates** for team changes and filter by **Author**. Use **Load more** when available to read older records.

To find a person's responsibilities, use **By member** and choose **Related member**; combine owner, creator/issuer and approval/review scopes. **Author** filters who performed an operation, while [member filtering](USER-GUIDE.md#filter-tasks-by-member) filters who is responsible for a task.

Share a task by copying its URL with `?task=<UUID>`. Other team accounts still need the usual viewing permission; a link does not expose a private draft. Team updates follow the current task filters, while the selected task's activity retains its complete history.

## 3 From creation to acceptance

### Q8 Why is a newly created task still a draft

**Submit** in the **New task** form saves a private draft; it does not send it for approval or issue it. A draft can omit dates and use **Temporary tasks** before it belongs to a project.

Fill in the expected result, acceptance criteria, owner, reviewer, acceptance deadline, delivery deadline and next feedback time. Members then use **Submit for approval**. A team leader can use **Issue task** for their own draft. Approval or direct issue leads to awaiting acceptance; the owner must still accept it.

### Q9 How is creation approval different from task acceptance

Approval authorizes the work. Acceptance records the assigned person's agreement to take responsibility. These are separate decisions.

A member's project task usually goes first to the project manager, then to the team leader for final approval. A manager creating work in their own project goes directly to the leader; when manager and leader are the same person, there is one approval step. Temporary tasks go to the team leader.

At **Awaiting acceptance**, the owner can choose **Accept task**, then **Start work**, or use **Accept and start** together.

### Q10 What if the assignment is unsuitable or I cannot accept it on time

While awaiting acceptance, use **Unable to accept** and explain the schedule, scope or resource constraint. The task stays awaiting acceptance for the issuer to handle. It is not automatically cancelled or reassigned.

After acceptance, participants can use **Request agreement change** to propose changes to scope, people or dates. The team leader decides whether to adjust the agreement. A comment or blocker report does not change it.

## 4 Checklists and text formatting

### Q11 How should I write a checklist

Write one concrete action per item, with a clear way to tell when it is done. The checklist describes how to proceed; acceptance criteria describe what makes the result acceptable. Avoid vague labels such as “development,” “testing” or “keep improving.”

For a task to export current filtered results as CSV, enter:

```text
Confirm exported columns, order and empty-value rules
Implement CSV generation using the current filters
Verify Chinese text, commas, quotes and line breaks
Verify that empty results retain the agreed headers
Prepare test results and usage notes for the submission
```

Work with its own owner, deadline or independent review is better represented as a child task. Do not quietly add requirements outside the agreed scope.

### Q12 How do I propose a checklist and save completed items

The task owner opens **Request checklist edit** in the checklist area (called **Request checklist change** in the older screenshot):

1. Enter the items in **Checklist items (one per line)**. Write the content directly, without `- [ ]`.
2. A reason is optional if the agreement stays the same. Select **Changes scope or acceptance criteria** and provide a reason if the proposal changes that agreement.
3. Submit for the team leader to **Approve checklist** or **Reject checklist**. The current checklist stays unchanged until approval.
4. Once approved, the owner checks completed items and clicks **Save checked progress**. Check the success message and saved count before refreshing; **Undo unsaved checks** discards only the unsaved marks. The older screenshot calls the save control **Confirm submission**.

A later proposal starts with the existing items. Retain the ones still needed and edit the entire proposed list. Approving a scope-changing checklist creates a new agreement version for the owner to confirm.

![Checklist proposal with items, scope change and reason](../assets/walkthrough/en/09-checklist-request.svg)

### Q13 Why is a task not complete when its checklist reaches 100 percent

The checklist counts execution steps; it does not replace result submission and review. The owner must still **Submit result**, and the reviewer must **Accept result** to complete the task. Task counts in projects and the graph are not percentages of accepted delivery either.

### Q14 How do I insert a Markdown hyperlink and which fields support it

In Markdown-rendered task text and formal progress, use:

```markdown
Encoding checks are complete; see the [test report](https://example.com/report).
Next, add edge cases from the [API documentation](https://example.com/api).
```

The syntax is `[display text](URL)`. Replace example addresses with real team resources. OpenTask does not grant access to external documents.

The expected result, acceptance criteria and scope editors also provide **Bold**, **List**, **Link** and **Edit / Preview** controls. Preview the description before submitting; its checkboxes do not change execution progress.

**Checklist items currently render as plain text.** Do not rely on Markdown links or `- [ ]` inside an item to create a clickable link or checkbox. Put supporting links in the expected result, progress or result description instead. In the result form's **Evidence links**, enter one plain HTTP(S) URL per line, without Markdown wrapping.

## 5 Formal progress and result delivery

### Q15 What is the difference between updating progress and delivering a result

| Aspect | Record progress | Submit result |
| --- | --- | --- |
| Purpose | Explain current results and next steps | Offer the deliverable for review against the criteria |
| Actor | Task owner | Task owner |
| Available stage | Accepted or in progress | In progress, with the current agreement confirmed |
| Form fields | Current result / message, next step, next feedback | Result description, optional evidence links, review deadline |
| Outcome | Keeps the stage and updates feedback arrangements | Moves to awaiting review by the assigned reviewer |

“Export implementation is ready; encoding checks are underway and I will report tomorrow afternoon” is progress. “The agreed feature and tests are ready; here are the result and test report for acceptance” is delivery.

### Q16 How do I record progress and how much should I write

As owner, open an accepted or in-progress task, click **Record progress** below the details, complete the three fields and click **Submit**:

| Field | Example |
| --- | --- |
| Current result / message | Export using the current filters is implemented. Chinese text, comma and quote cases pass; the empty-result case still needs clarification. |
| Next step | Confirm the empty-result header rule with the project manager, finish the cases and prepare the test report. |
| Next feedback | Choose a future time when you can provide a clear update, for example `2026-10-16 15:00`. |

Describe observed results and remaining issues rather than only “working on it.” Replace an expired example date with a real future time. Recording progress does not change an accepted task to in progress; starting work still requires its own action.

![Formal progress form with current result, next step and next feedback](../assets/walkthrough/en/15-formal-progress.svg)

### Q17 Does each progress update overwrite the previous one

**Details show the latest update; history appends every submission.** The recent-progress area updates to the latest result, next step and submission time, and the task's next feedback time also changes.

Earlier content remains in **Activity**, and team updates record the action. You do not need to copy the entire previous history into each update. Use activity to review the process and recent progress to understand the current situation.

### Q18 Can comments, checklist ticks or blocker reports replace formal progress

No. Comments support discussion, checklists record completed steps, and blockers ask for specific help. None replaces formal progress or automatically postpones feedback or delivery deadlines.

Use **Report blocker** to describe the reason, requested help and helper. The helper replies under **Connections & delivery → Blockers**; the owner uses **Resolve blocker** when resolved. Request an agreement change separately if a deadline must change.

### Q19 How do delivery, review and rework work

1. The owner checks that the task is in progress and the current agreement version is confirmed.
2. Click **Submit result**, enter the description, optional evidence links (one HTTP(S) URL per line) and **Review by**, then submit. This version supports evidence links, not direct file uploads.
3. The task moves to **Awaiting review**. The reviewer reads the result under **Connections & delivery → Submissions** and compares it with the acceptance criteria.
4. **Accept result** completes the task. **Return result** requires the gap and next feedback time and sends the task back to in progress.
5. The owner makes corrections and resubmits. Earlier results and return reasons remain; a new task is not needed for the same rework cycle.

![Result form with description, evidence links and review deadline](../assets/walkthrough/en/17-submit-result.svg)

Read **Reviewer** in the details rather than assuming it is the creator or project manager. A member-owned project task defaults to its project manager; a manager-owned task defaults to the team leader. Another eligible reviewer may be selected. Only a team leader can review their own task.

## 6 Dates and agreement changes

### Q20 Which dates matter

| Interface field | Meaning | When to enter or update it |
| --- | --- | --- |
| Planned start, optional | Intended start of execution | At creation or adjustment; no later than delivery deadline |
| Accept by | Latest time for the owner to accept | Before approval submission or issue |
| Next feedback | Latest time to report progress again | Before approval submission or issue, then with progress; also rescheduled when a result is returned |
| Delivery deadline | Agreed deadline for delivery | Before approval submission or issue; change through an agreement adjustment |
| Review by | Latest time for the reviewer to judge this result | On result submission |
| Confirm adjustment by | Latest time for the owner to confirm the new agreement | On agreement adjustment or approval of a scope-changing checklist |

Planned start does not automatically start work. Creation, changes, progress submissions, result submissions and review actions are timestamped by the system.

### Q21 How should I choose and format the next feedback time

Choose a future time you can meet: the latest time you will report again, not necessarily when the work will finish. Base it on the next step's size and risk. Even without a final result, report what is known, what is blocked and what happens next.

Date/time inputs use Shanghai time (UTC+8), 24-hour format, as `YYYY-MM-DD HH:mm`. You can type the value or use **Choose date** beside the field. Date-only time-filter ranges use `YYYY-MM-DD`.

```text
2026-10-16 15:00
```

Use one space between date and time, two digits for month, day, hour and minute, and no seconds or timezone suffix. Do not enter “tomorrow afternoon.” Replace the example with a real future date. Dates and evidence URLs use their field formats, not Markdown.

### Q22 Do deadlines automatically change the task's status

No. Reaching a planned start or deadline does not automatically start, accept, complete or cancel a task. Overdue acceptance, feedback, review, confirmation and delivery create follow-ups in the applicable stages for the responsible person to handle. Keep the background worker running to refresh time-triggered reminders.

**Submitting a result does not complete the delivery process.** While awaiting review, passing the delivery deadline can still create a delivery-overdue item for the reviewer. A result submission alone does not guarantee that a task cannot become overdue. See [Startup troubleshooting](QUICKSTART.md#common-startup-problems) if reminders are not updating.

### Q23 What should happen when requirements, owners or dates change

A participant without the leader role uses **Request agreement change** to explain the proposed change and reason. The team leader uses **Adjust agreement**, including a reason and confirmation deadline, or responds and closes the request without changing the agreement.

The owner reads the before-and-after comparison in **Agreement changes**, then selects **Confirm this version**. Results cannot be submitted until the current version is confirmed. A new owner must accept the task again. Adjusting an agreement while awaiting review preserves the previous pending submission as **Superseded**, returns the task to in progress and requires work under the new agreement.

## 7 Relationships and common problems

### Q24 Do unfinished prerequisites or child tasks affect this task

A **prerequisite** must be completed before the dependent task's result can be accepted. It does not automatically prevent the dependent task from starting early. Cancelling the prerequisite does not satisfy the dependency.

A **parent-child relationship** organizes work. Completing children does not automatically complete the parent; the parent needs its own submission and review. Accepting a parent with unfinished children requires a reason.

Inspect relationships under **Connections & delivery → Relations**. An ordinary related-task link provides context without changing stages, dates or acceptance conditions.

### Q25 What should I do about missing tasks, conflicts or mistakes

| Symptom | Action |
| --- | --- |
| Task missing from tree, Gantt or graph | Check member, search, project, stage and time filters, or open its task URL. Filters do not alter permissions or hide inbox items. |
| Checklist ticks lost after refresh | Click Save checked progress and check its success message before refreshing. Re-enter changes that were not saved. |
| Cannot submit a result | Check that you are the owner, the task is in progress and the current agreement is confirmed. |
| Cannot accept a result | Check that you are the reviewer and prerequisites are completed; give a reason for unfinished child tasks when reviewing a parent. |
| Version conflict | Refresh and read others' changes before deciding what to resubmit, rather than overwriting a new agreement. |
| Mistake in an unsubmitted draft | The creator uses Edit draft, or Delete draft to abandon it. Closing the form does not delete a task. |
| More work after a task has ended | Completed and cancelled tasks cannot reopen; create a related follow-up task. |

To stop unfinished work, the team leader uses **Cancel task** with a reason. Checking every item or writing “done” in progress does not replace a formal ending.

## Related documents

- [User guide](USER-GUIDE.md): controls, permissions and stage rules by feature.
- [Your first task](FIRST-TASK.md): a short creation-to-review exercise.
- [Advanced walkthrough](CASE-CSV-EXPORT.md): approvals, checklists, blockers, changes, dependencies and rework.
- [Features and controls](FEATURES.md): feature index.
- [API v1](API.md): fields, permissions and errors.
