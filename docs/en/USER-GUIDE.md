# User guide: find the next action

[简体中文](../zh-CN/USER-GUIDE.md)

Start with [your first task](FIRST-TASK.md). Use this page to look up day-to-day controls and rules. The [advanced case](CASE-CSV-EXPORT.md) covers multi-person approval, changes and returned results. Screenshots below show the English interface.

For common questions about roles, checklists, progress versus delivery and date formats, see [Everyday collaboration Q&A](FAQ.md).

Workspace controls below follow the latest merged `mvp` (`143e9e7`). See [release notes](RELEASE-NOTES.md) for tagged-version scope. Earlier walkthrough captures retain their original interface and date.

## Check the action inbox and operation history

Open **Action inbox** using the bell or side navigation. **Assigned to me** contains your required responses; a leader also sees **Following team**. Click an item to open its task. Creation approval, acceptance, checklist approval, version confirmation, progress, helper replies and result review each go to the appropriate handler. Overdue dates add overdue followups.

Time filters do not hide followups. A quiet filtered graph does not mean there is nothing to handle. If reminders stop updating, see [startup troubleshooting](QUICKSTART.md#common-startup-problems).

For “what happened?”, open the task's **Activity**. For “what changed across the team?”, open **Team updates** and filter by **Author**. **Load more** fetches older available records where shown.

![Team updates filtered to operations by Test Member](../assets/walkthrough/en/31-team-updates.svg)

After a workflow action, a feedback banner identifies the task, resulting stage and next handlers. Colored stage icons retain text labels. Detected teammate stage changes can show the actor and event time when the corresponding history record is available; missing metadata is not inferred. Use the banner’s activity control to inspect the task history. Closing the banner dismisses the message without undoing the action.

Events retain who acted, when, the version, notes and field changes. Results stay in **Submissions** with Returned, Accepted or Superseded labels, so the operation timeline and delivered artifacts can be read separately.

## Read a task before acting

Select a task in the tree, Gantt chart or graph. At the top of its details, read **Status**, **Owner**, **Reviewer** and **Waiting for**, then its expected result, acceptance criteria and dates. Scroll inside the right panel to reach the actions below its content. Buttons depend on your role and the task's stage.

**Task content** holds the agreement, checklist, latest progress and **Connections & delivery** tabs: **Relations**, **Blockers**, **Submissions**. **Activity** holds the task's operation history and field differences. The bottom panel also provides Action inbox, Activity and Relations shortcuts.

Expected result, acceptance criteria and scope appear in separate Markdown sections. A long scope starts collapsed and can be expanded. When creating or adjusting an agreement, use **Edit / Preview** to inspect the text before submitting. **Bold**, **List** and **Link** format selected text; their keyboard shortcuts are shown in the editor. Preview checkboxes are for reading and do not update the execution checklist.

Copy the URL with `?task=<UUID>` to reopen or share the selected task with another team account. Private-draft permissions still apply. Refresh reads current server state; it does not save an unsubmitted form or checklist.

## Know who can decide

| Person | Responsibility |
| --- | --- |
| Team leader | Create projects, issue tasks, give final creation approval, approve checklists, adjust agreements and cancel unfinished tasks |
| Project manager | Maintain project membership and color; handle project creation approvals; review tasks when assigned as reviewer |
| Task owner | Accept the task, start work, save progress/checklist completion and submit results |
| Reviewer | Accept or return the submitted result against the agreed criteria |
| Administrator | Create and enable/disable accounts; this role grants no automatic business approval authority |

The creator, owner and reviewer can differ. A member's project task defaults to the project manager as reviewer; a project manager's task defaults to the team leader. You can explicitly choose another valid active reviewer. Only a leader may review their own task. The owner need not be on the project's member list.

A draft is private to its creator. Once submitted, a task is team-visible, including after creation approval is returned. Project membership is not a privacy boundary.

## Task workflow from creation to review

![Task lifecycle from drafting through approval, acceptance, execution and result review](../assets/diagrams/en/task-lifecycle.svg)

| You want to… | Control and resulting behavior |
| --- | --- |
| Capture an idea | **New task → Submit** saves a private draft. Choose **Temporary tasks** when no project is appropriate; dates can wait in a draft. |
| Refine or discard a draft | **Edit draft** changes its agreement. **Delete draft → Submit** deletes only your unsubmitted draft; inspect carefully before confirming. **Discard form** merely closes a form. |
| Propose work | **Submit for approval** makes it team-visible. The handler can **Approve creation** or **Return for editing** with a reason. Edit a returned task and resubmit it. |
| Issue your own draft as leader | **Issue task** skips creation approval and awaits the owner's acceptance. |
| Accept the task and start work | **Accept task**, then **Start work**; or use **Accept and start** together. |
| Decline a task | **Unable to accept** requires a reason. The task stays Awaiting acceptance for the issuer to resolve, adjust or cancel. |
| Deliver | **Submit result** records text, optional HTTP(S) evidence links and a review deadline. |
| Review | **Accept result** completes the task. **Return result** requires a gap/reason and next feedback time, and returns it to In progress. |
| Stop unfinished work | The leader uses **Cancel task** with a reason. Completed and cancelled tasks cannot reopen. Create related follow-up work instead. |

Before approval submission or issue, provide expected result, acceptance criteria, valid owner/reviewer, delivery deadline, acceptance deadline and next feedback time. Planned start is optional and cannot be later than the delivery deadline. Dates use Asia/Shanghai.

For a date field, type `YYYY-MM-DD HH:mm` in 24-hour format or open **Choose date** beside it to use the calendar. Time-filter ranges use date-only `YYYY-MM-DD` values. Calendar selection and typed dates use the same Shanghai date rules.

![An ordinary member's project task passes through the project manager and then team leader](../assets/diagrams/en/creation-approval.svg)

The diagram shows an ordinary member creating project work. A project manager creating work in their own project goes directly to the leader. If the project manager is the leader, there is only one approval level. Approval and owner acceptance remain separate decisions.

## Keep execution, discussion and feedback clear

| Record | Use it for | What it does not do |
| --- | --- | --- |
| Execution checklist | Agreed steps and saved completion marks | A 100% checklist does not complete the task |
| Record progress | Current result, next step and next feedback time | It is not a final result submission |
| Add comment | Discussion and clarification | It does not satisfy or extend formal feedback |
| Blocker | A reason, requested help and named helper | It does not automatically extend delivery dates |

Use **Request checklist edit** to propose items. A reason is optional when the agreed scope and criteria stay the same. If you mark **Changes scope or acceptance criteria**, a reason is required; approval also requires a confirmation deadline and creates a new agreement version for the owner to confirm. The leader can **Approve checklist** or **Reject checklist**; the active checklist stays unchanged until approval. Pending proposals are separate from the collapsible **Checklist change records**.

**Saved progress** shows what the server has stored. Changing a checkmark adds an **Unsaved** marker and enables **Save checked progress**; the saved count stays unchanged until saving succeeds. **Undo unsaved checks** restores the saved values. Saving, success and error messages appear beside the controls; a failed save keeps the unsaved checks for correction or retry. Earlier walkthrough images call the request and save controls **Request checklist change** and **Confirm submission**.

[![English checklist card showing saved progress at 2 of 4, save feedback and separate change records](../assets/updates/2026-10-16/checklist-progress-en.jpg)](../assets/updates/2026-10-16/checklist-progress-en.jpg)

**Record progress** renders both the current result and next step as Markdown. For help, choose **Report blocker**; the helper replies under **Connections & delivery → Blockers**, and the owner uses **Resolve blocker**. [Walkthrough steps 5–8](CASE-CSV-EXPORT.md#5-accept-the-task-and-request-a-checklist) show the full exchange.

## Change requirements and confirm the new version

Any non-leader participant can **Request agreement change**. The leader may **Adjust agreement**, giving a reason and confirmation deadline, or **Close adjustment request with response** without changing the agreement.

![Requirement changes retain the previously accepted agreement; the owner confirms the new version, or a replacement owner accepts](../assets/diagrams/en/terms-confirmation.svg)

Read the before/after values under **Agreement changes**, then **Confirm this version**. Before submitting a final result, the owner must confirm the current agreement version. A reassigned task returns to Awaiting acceptance; its new owner accepts again. An adjustment while Awaiting review supersedes the pending submission and returns the task to In progress.

![The follow-up proposal's previous result is retained as Superseded after an adjustment](../assets/walkthrough/en/25-superseded-result.svg)

The leader's **Title** action corrects a label without making a new agreement version. Use **Adjust agreement** for a substantive expectation, person or date change. [The import follow-up](CASE-CSV-EXPORT.md#13-adjust-and-cancel-a-follow-up-task) demonstrates reassignment, checklist rejection, scope change, request closure, supersession and cancellation.

## Read the delivery schedule

The workspace opens on **Gantt chart**. Switch between it, **Task graph** and **Team updates** using the center tabs or side navigation. Selecting a task in the tree or timeline opens the same task details.

Use **Overview**, **Day**, **Week** or **Month** to change the scale; **Today** and **Locate selected** move to the corresponding dates. Project headings collapse or expand their rows. A task with a planned start and deadline has a range bar; one with only a deadline has a deadline marker; an undated task is **Not scheduled**. Colors reflect lifecycle state, with separate overdue and unresolved-blocker indicators.

[![English Gantt workspace with planned task ranges and prerequisite arrows](../assets/updates/2026-10-16/workspace-current-en.jpg)](../assets/updates/2026-10-16/workspace-current-en.jpg)

Enable **Prerequisite** to show arrows from prerequisite results to dependent tasks. These are result-acceptance conditions: work may start before the prerequisite completes. The chart displays plan dates, and checklist completion still requires result review. To change an issued task's dates, use the agreement-adjustment process; dragging a timeline bar does not reschedule it.

## Set task relations and use the graph

In **Connections & delivery → Relations → Add relation**, search by title or number, select a target and type, and give a reason.

| Relation | Choose from | Consequence |
| --- | --- | --- |
| Primary parent | From the child, choose its parent task | Groups the child under that parent; children never complete the parent automatically |
| Prerequisite | From the dependent task, choose the task providing the needed result | The dependent result cannot pass review before that prerequisite is Completed |
| Related task | Either task → the other | Records context without changing status, dates or review eligibility |

A task has at most one primary parent. Parent and dependency cycles are rejected; tasks in the same ancestor/descendant chain cannot also depend on one another. Cancelling a prerequisite does not satisfy it. To accept a parent while children remain unfinished, the reviewer must explain why.

The leader can maintain issued-task relations. A creator can maintain their own draft relations, with prerequisite removal reserved for the leader. Use **Remove relation** beside the correct link and provide a reason. A relation edit does not delete either task.

In the graph, use **Zoom in/out**, **Fit view**, **Locate selected**, **Direct relations only** and **Reset layout**. Drag nodes to arrange them, or drag the canvas to pan. Solid parent lines, directed prerequisite lines and related links describe different relationships; the tutorial diagram's result acceptance order should not be mistaken for the graph's dependent-to-prerequisite arrow direction.

## Filter tasks by member

Choose **By member**, then select **Related member**. **Me** selects your own responsibilities. Expand the relationship summary and combine **Owned**, **Created or issued** and **Approval or review**. A task matching any selected scope appears once; clearing all scopes produces no matches. **All tasks** exits relationship filtering while retaining your member and scope choices for reuse.

[![English By member filter with Test Other Member selected and all three relationship scopes](../assets/updates/2026-10-16/member-filter-en.jpg)](../assets/updates/2026-10-16/member-filter-en.jpg)

The mode, chosen member and scopes are remembered per signed-in account in this browser. Refreshing or signing in again restores them; if browser storage is unavailable, filtering works without that memory. Selecting someone else does not grant access to their private drafts.

The selection works together with project, status, search and time across the tree, Gantt, graph and team activity. Approval/review scopes include responsibilities at every workflow stage. Visible parents may appear as context without increasing the match count. Followups stay available, and a selected task outside the result set retains its details and history.

## Search and filter by project, status and time

Search by title or the numeric part of a task number (for `OT-3`, enter `3` without `OT-`), select a **Project** and **Stage**, then open the time control. **All time**, **This week**, **This month** and **Custom range** filter by the task's planned start and delivery deadline, using Shanghai dates. Weeks start Monday; custom end dates are inclusive.

![Project, status and personal time range are separate filters](../assets/walkthrough/en/28-time-filter.svg)

**① Project + ② Stage + ③ time range** filter the tree, Gantt, graph, matching count and team updates together, alongside any member filter. Select a range and click **Apply range**; merely editing the controls does not save it.

**All projects** uses your global preference. Projects initially use the global settings. Applying a range inside a project saves separate filter settings for it. **Follow global** removes those separate settings so the project uses the global filter again. The preference is stored per account. After refreshing, select the project again to see its saved range.

**Include tasks without a deadline** shows undated drafts within the selected date range. **Include earlier unfinished tasks** keeps overdue unfinished work in view. A selected task outside the filters still shows its full details/history. Parent tasks you have permission to view can appear to explain the hierarchy; they do not increase the matching count.

![Searching Implement CSV export retains its parent as context without counting it as a second match](../assets/walkthrough/en/29-search-context.svg)

The task tree can collapse/expand. Desktop panel separators resize the tree, details and bottom panel. Use side navigation to toggle the tree, center workspace and details independently, and **Toggle bottom panel** for the lower panel. Visibility and sizes are remembered per account in this browser. **Focus details** temporarily expands the task; **Restore layout** brings back the previous arrangement. On small screens, use **Task tree / Workspace / Task details**; Workspace contains the Gantt and graph tabs.

## Maintain the project and accounts

The top **Account** menu shows your account and roles. During a demo, **Switch user** ends the current session so you can sign in as another account. Use **Sign out** when finished. Save unsubmitted forms and checklist changes before switching or signing out.

As the leader or project manager, select **Manage project members** beneath the project. Both can update members/color; only the leader can change its manager. Transfer outstanding responsibilities before attempting a manager replacement. The project context menu also provides a color shortcut.

![Project settings: 1 manager, 2 members, 3 project color](../assets/walkthrough/en/33-project-settings.svg)

As `admin`, choose **Accounts → Accounts +** to enter username, display name, password and roles. A password must have at least 12 characters.

![Administrator account creation form with username and roles marked](../assets/walkthrough/en/35-new-account.svg)

Use **Disable account** or **Enable account** on the intended account. Disabling requires outstanding owner/reviewer/issuer/approval responsibilities and project management to be transferred first; a leader account or your own account cannot be disabled this way. Changing active status revokes that user's existing sessions.

## Change language, theme and mobile view

The top **Language** selector changes controls between English and Simplified Chinese; it does not translate task text. **Switch theme** changes light/dark appearance. These choices stay in this browser; time preferences stay with the account.

![English mobile task details in dark mode](../assets/walkthrough/en/37-mobile-detail.svg)

At phone width, choose **Task details** and scroll within the panel. You still read the same task and history.

## Recover from an unexpected result

| Symptom | Next action |
| --- | --- |
| A button is missing | Check your account, Owner/Reviewer/Waiting for and task stage; scroll inside the details panel |
| A new task is still Draft | Use Submit for approval, or Issue task as the leader |
| Checklist marks disappeared | Save them with Save checked progress before refreshing; check for success beside the checklist |
| A result cannot be submitted | Confirm the current agreement; refresh and reread after a version conflict |
| A result cannot pass review | Finish its prerequisites; explain unfinished children if accepting a parent |
| A changed task is not in the tree | Clear search/status/time filters; open its direct URL to inspect it |
| The form reports an error | Read the message; input is retained. Correct the stated cause, then retry |
| A login or reminder fails | Follow [startup troubleshooting](QUICKSTART.md#common-startup-problems) |

For integration contracts use [API v1](API.md); for feature explanations use [features and controls](FEATURES.md).
