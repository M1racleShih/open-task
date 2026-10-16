import type { Task } from "../shared/model.js";
import { Markdown } from "./Markdown.js";
import { useI18n } from "./i18n.js";

export function TaskDescription({
  task,
}: {
  task: Pick<Task, "outcome" | "criteria" | "scope">;
}) {
  const { t } = useI18n();
  const longScope =
    task.scope.length > 600 || task.scope.split("\n").length > 8;
  return (
    <div className="task-description">
      {(["outcome", "criteria", "scope"] as const).map((field) =>
        field === "scope" && longScope ? (
          <details className="detail-section task-prose task-scope" key={field}>
            <summary>
              <h3>{t(field)}</h3>
              <span>{t("scopeExpand")}</span>
            </summary>
            <Markdown text={task[field]} />
          </details>
        ) : (
          <section className="detail-section task-prose" key={field}>
            <h3>{t(field)}</h3>
            <Markdown text={task[field]} />
          </section>
        ),
      )}
    </div>
  );
}
