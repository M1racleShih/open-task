import type { Task } from "../shared/model.js";
import { lifecycleState } from "../shared/commitment.js";
import { TaskIcon } from "./TaskIcon.js";
import { useI18n } from "./i18n.js";
import "./graph-status.css";
import "./taskStage.css";

/** Keep the established seven-phase palette consistent with graph and Gantt. */
export function TaskStage({
  task,
  previous = false,
}: {
  task: Task;
  previous?: boolean;
}) {
  const { t } = useI18n();
  const phase = lifecycleState(task);
  return (
    <span
      className={
        "status task-stage " +
        task.stage +
        (previous ? " task-stage-previous" : "")
      }
    >
      <span
        className="task-state-icon"
        data-lifecycle={phase}
        title={t("lifecycle_" + phase)}
        aria-hidden="true"
      >
        <TaskIcon size={previous ? 13 : 16} />
      </span>
      {t(task.stage)}
    </span>
  );
}
