# Complete your first task

[简体中文](../zh-CN/FIRST-TASK.md)

Use a “Collect trial feedback” task to try creation, acceptance, progress, result submission and review. Complete [local setup](QUICKSTART.md) first, then allow about 10 minutes for this exercise. You will switch between three demo accounts; in a real team, each person performs their steps using their own account.

## 1. Create a project and task

Sign in as `leader` and click **New project**. Name it “OpenTask trial”, select **Test Project Manager** as manager and **Test Member** as a member, then submit.

Click **New task** and enter:

| Field | Trial content |
| --- | --- |
| Title | Collect trial feedback |
| Project | OpenTask trial |
| Owner | Test Member |
| Reviewer | Test Project Manager |
| Expected result | Write brief feedback on what felt easy or confusing during this trial. |
| Scope (optional) | Collect feedback only; do not change the product. |
| Acceptance criteria | At least two observations, each describing the action, experience and suggestion. |

Enter dates as `YYYY-MM-DD HH:mm` in Shanghai time. Set future **Accept by**, **Next feedback** and **Delivery deadline** times. For example, use tomorrow morning for acceptance, tomorrow afternoon for feedback and the following afternoon for delivery, all in Shanghai time. **Planned start** is optional; if set, it cannot be later than the delivery deadline.

Click **Submit** to save. The task is now **Draft**, visible only to its creator. Open it, scroll down inside the details panel, then choose **Issue task → Submit**.

The task should become **Awaiting acceptance**, waiting for Test Member. Copy its URL to reopen the same task in later steps. The leader issues this task directly; work proposed by a member first requires [creation approval](USER-GUIDE.md#task-workflow-from-creation-to-review).

## 2. Accept the task and record progress

Use **Account → Switch user** to sign in as `member`, with the same seeded password. Open the copied task URL, read its requirements, then choose **Accept and start → Submit**.

The task should become **In progress**. Its owner has agreed to carry out the task and started working.

Choose **Record progress**. Enter “Tried task creation and acceptance” as the current result, “Write two observations and submit them” as the next step, and set a future **Next feedback** time. Submit.

Refresh and check that the progress remains available. Use **Add comment** for discussion; comments do not replace formal progress or extend its deadline.

## 3. Submit the result

Still as `member`, choose **Submit result**. Write your two observations, each with an action, experience and suggestion. You can also use this simulated result for the exercise:

```text
Simulated trial feedback:
1. Accepting and starting the task changes its state to In progress, showing that the owner has started. Suggestion: keep this status cue.
2. Action buttons are below the task content; a first-time user needs to scroll to find them. Suggestion: make the action location more visible.
```

Set a future **Review by** time. Evidence links are optional: add HTTP(S) links when you have supporting material, or leave them empty for this exercise. After submission, the task should be **Awaiting review**, waiting for Test Project Manager.

## 4. Review the result

Switch to `manager` and open the same task. Check the result against the agreed two observations, each with an action, experience and suggestion. Choose **Accept result → Submit**.

The task should become **Completed**. Read the result in **Submissions** and check **Activity** to see who accepted the task, recorded progress, submitted it and reviewed it.

If the result does not meet the criteria, the reviewer can use **Return result**, describing what needs improvement and setting the next feedback time. The owner then improves and resubmits it. The [advanced case](CASE-CSV-EXPORT.md) shows that process.

## Continue with your own work

When you sign in for day-to-day work, open **Action inbox**, check **Assigned to me** and select an item to open its task. See the [user guide](USER-GUIDE.md) for search, filters and other controls.

To break down work, request a checklist. To coordinate several people, set parents and prerequisites or report blockers. The [advanced CSV export project](CASE-CSV-EXPORT.md) demonstrates these actions. A checklist at 100% still requires a result submission and review before the task completes.
