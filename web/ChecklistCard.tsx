import { ClipboardList } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { ChecklistItem, Task } from "../shared/model.js";
import { useI18n } from "./i18n.js";
import "./checklist.css";

export type ChecklistFeedback = {
  taskId: string;
  status: "saving" | "saved" | "error";
  code?: string;
};
type Request = Task["checklistRequests"][number];

export function ChecklistCard({
  task,
  color,
  editable,
  leader,
  busy,
  changes,
  feedback,
  onToggle,
  onSave,
  onUndo,
  onRequest,
  requestActions,
}: {
  task: Task;
  color: string;
  editable: boolean;
  leader: boolean;
  busy: boolean;
  changes: Record<string, { expectedDone: boolean; done: boolean }>;
  feedback: ChecklistFeedback | null;
  onToggle: (item: ChecklistItem) => void;
  onSave: () => void;
  onUndo: () => void;
  onRequest: () => void;
  requestActions: (request: Request) => ReactNode;
}) {
  const { t } = useI18n();
  const count = Object.keys(changes).length;
  const savedCount = task.checklist.filter((item) => item.done).length;
  const pending = task.checklistRequests.filter(
    (request) => request.status === "pending",
  );
  const history = task.checklistRequests.filter(
    (request) => request.status !== "pending",
  );
  const requestRecord = (request: Request) => (
    <article className="checklist-request" key={request.id}>
      <b>
        {t("proposed")} ·{" "}
        <span className={"checklist-request-status " + request.status}>
          {t(
            request.status === "rejected"
              ? "checklistRejected"
              : request.status === "pending"
                ? "checklistPendingStatus"
                : request.status,
          )}
        </span>
      </b>
      {request.items.length ? (
        <ul>
          {request.items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t("noChecklist")}</p>
      )}
      <p className="checklist-request-reason">
        <strong>{t("reason")}: </strong>
        {request.reason || t("checklistNoReason")}
      </p>
      <p className="muted">
        {t("scopeChanged")}: {t(String(request.scopeChanged))}
      </p>
      {leader && request.status === "pending" && (
        <div className="actions">{requestActions(request)}</div>
      )}
    </article>
  );
  return (
    <section
      className="detail-section checklist-card"
      aria-label={t("checklist")}
      style={{ "--check-color": color } as CSSProperties}
    >
      <div className="checklist-heading">
        <h3>
          <ClipboardList size={16} aria-hidden="true" />
          {t("checklist")}
        </h3>
        {editable && (
          <button
            className="checklist-modify"
            disabled={busy}
            onClick={onRequest}
          >
            {t("requestChecklist")}
          </button>
        )}
      </div>
      <div className="checklist-statistics">
        <span>{t("checklistSavedProgress")}</span>
        <strong>
          {task.checklist.length
            ? `${savedCount} / ${task.checklist.length} · ${Math.round((savedCount / task.checklist.length) * 100)}%`
            : t("noChecklist")}
        </strong>
      </div>
      {task.checklist.length > 0 && (
        <progress
          aria-label={t("checklistSavedProgress")}
          max={task.checklist.length}
          value={savedCount}
        />
      )}
      {task.checklist.map((item) => (
        <label
          className={
            "check" + (changes[item.id] ? " checklist-item-dirty" : "")
          }
          key={item.id}
        >
          <input
            type="checkbox"
            checked={changes[item.id]?.done ?? item.done}
            disabled={!editable || busy}
            onChange={() => onToggle(item)}
          />
          <span className="checklist-item-text">{item.text}</span>
          {changes[item.id] && (
            <small className="checklist-unsaved-mark">
              {t("checklistItemUnsaved")}
            </small>
          )}
        </label>
      ))}
      {(task.checklist.length > 0 || count > 0) && (
        <div className="checklist-savebar">
          <div
            className="checklist-save-status"
            role="status"
            aria-live="polite"
          >
            {feedback?.status === "saving"
              ? t("checklistSaving")
              : count
                ? t("checklistUnsaved").replace("{count}", String(count))
                : feedback?.status === "saved"
                  ? t("checklistSaveSuccess")
                  : t("checklistSaved")}
          </div>
          {(editable || count > 0) && (
            <div className="checklist-save-actions">
              {count > 0 && (
                <button disabled={busy} onClick={onUndo}>
                  {t("checklistUndo")}
                </button>
              )}
              {editable && (
                <button
                  className="primary"
                  disabled={!count || busy}
                  onClick={onSave}
                >
                  {t("submitChecklist")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {feedback?.status === "error" && (
        <p className="checklist-feedback-error" role="alert">
          {t(
            feedback.code === "versionConflict" ||
              feedback.code === "checklistConflict"
              ? "checklistSaveConflict"
              : "checklistSaveFailure",
          )}{" "}
          {feedback.code !== "versionConflict" &&
          feedback.code !== "checklistConflict"
            ? t(feedback.code ?? "serverError")
            : ""}
        </p>
      )}
      <p className="muted checklist-review-hint">{t("checklistReviewHint")}</p>
      {pending.length > 0 && (
        <section
          className="checklist-pending"
          aria-label={t("checklistPending")}
        >
          <h4>
            {t("checklistPending")} <span>{pending.length}</span>
          </h4>
          {pending.map(requestRecord)}
        </section>
      )}
      {history.length > 0 && (
        <details className="checklist-history">
          <summary>
            {t("checklistHistory")} ({history.length})
          </summary>
          {history.map(requestRecord)}
        </details>
      )}
    </section>
  );
}
