import { responseFacts } from "./commitment.js";
import type { Event, Stage, Task } from "./model.js";

export type StageFeedback = {
  id: number;
  kind: "local" | "remote";
  before: Task;
  task: Task;
  action?: string;
  event?: Event;
};

/** In-memory baseline for one selected task in one account. Dismissal does not
 * reset it; acknowledgements and reads use the same monotonic revision fence. */
export class StageBaseline {
  current: Task | null = null;
  private serial = 0;
  observe(task: Task, action?: string) {
    const before = this.current;
    if (before && (before.id !== task.id || task.revision < before.revision))
      return { applied: false, feedback: null };
    this.current = task;
    const changed = before && before.stage !== task.stage;
    const receipt = action && ["approve", "refuse", "confirm"].includes(action);
    const feedback: StageFeedback | null =
      before && (changed || receipt)
        ? {
            id: ++this.serial,
            kind: action ? "local" : "remote",
            before,
            task,
            action,
          }
        : null;
    return { applied: true, feedback };
  }
}

const stages: Stage[] = [
  "draft",
  "approval",
  "approvalReturned",
  "pending",
  "accepted",
  "working",
  "reviewing",
  "done",
  "cancelled",
];
function snapshot(value: unknown, taskId: string): value is Task {
  const task = value as Task | null;
  return (
    !!task &&
    task.id === taskId &&
    stages.includes(task.stage) &&
    Number.isInteger(task.revision) &&
    task.revision >= 0
  );
}

export function feedbackObsolete(feedback: StageFeedback, task: Task) {
  if (feedback.task.id !== task.id || task.revision <= feedback.task.revision)
    return false;
  const obligations = (task: Task) =>
    responseFacts(task, "").map(({ reason, handlerId }) => [reason, handlerId]);
  return (
    feedback.task.stage !== task.stage ||
    feedback.task.title !== task.title ||
    JSON.stringify(obligations(feedback.task)) !==
      JSON.stringify(obligations(task))
  );
}

/** Only full task-event snapshots can establish who changed this stage and
 * when. Call with the latest unfiltered selected-task history page(s). Missing
 * transitions outside that read boundary deliberately get no attribution. Never infer
 * a transition timestamp from Task.updatedAt or the time a poll completed. */
export function stageEvent(feedback: StageFeedback, events: Event[]) {
  const { before, task } = feedback;
  const transitions = events
    .filter(
      (event) =>
        event.taskId === task.id &&
        snapshot(event.before, task.id) &&
        snapshot(event.after, task.id) &&
        event.before.stage !== event.after.stage &&
        event.after.revision === event.before.revision + 1 &&
        event.after.revision > before.revision &&
        event.after.revision <= task.revision,
    )
    .sort((a, b) => (b.after as Task).revision - (a.after as Task).revision);
  const latest = transitions[0];
  if (
    !latest ||
    (latest.after as Task).stage !== task.stage ||
    !latest.actorId ||
    !Number.isFinite(Date.parse(latest.at))
  )
    return undefined;
  return latest;
}
