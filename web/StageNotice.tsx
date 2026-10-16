import type { StageFeedback } from "../shared/stageFeedback.js";
import type { User } from "../shared/model.js";
import { responseFacts } from "../shared/commitment.js";
import { dateText, useI18n } from "./i18n.js";
import "./stageNotice.css";

function content(
  feedback: StageFeedback,
  users: User[],
  t: (key: string) => string,
) {
  const { task } = feedback;
  const name = (id: string) =>
    users.find((user) => user.id === id)?.name ?? t("unknownHandler");
  const facts = responseFacts(
    task,
    users.find((user) => user.active && user.roles.includes("leader"))?.id ?? "",
  );
  const actionTitles: Record<string, string> = {
    accept: "resultAccept",
    acceptStart: "resultAcceptStart",
    start: "resultStart",
    issue: "resultIssue",
    submitApproval: "resultSubmitApproval",
    approve: "resultApprove",
    returnApproval: "resultReturnApproval",
    refuse: "resultRefuse",
    confirm: "resultConfirm",
    submitResult: "resultSubmitResult",
    pass: "resultPass",
    returnResult: "resultReturn",
    cancel: "resultCancel",
    adjust: "resultAdjust",
  };
  const headline =
    feedback.kind === "local"
      ? (actionTitles[feedback.action ?? ""] ?? "actionConfirmed")
      : "stageChanged";
  const next = facts.length
    ? t("nextHandlers") +
      ": " +
      facts
        .map((fact) => t(fact.reason) + " · " + name(fact.handlerId))
        .join("; ")
    : t("noNextHandler");
  return { headline, name, next };
}

/** Mounted once for the workspace. Event metadata is deliberately excluded so
 * attribution arriving later cannot announce the same transition a second time. */
export function StageAnnouncement({
  feedback,
  users,
}: {
  feedback: StageFeedback | null;
  users: User[];
}) {
  const { t } = useI18n();
  const message = feedback ? content(feedback, users, t) : null;
  return (
    <span
      className="sr-only stage-live"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {feedback && message
        ? `${t(message.headline)} · OT-${feedback.task.number} · ${feedback.task.title} · ${feedback.before.stage !== feedback.task.stage ? t(feedback.before.stage) + " → " : ""}${t(feedback.task.stage)} · ${message.next}`
        : ""}
    </span>
  );
}

export function StageNotice({
  feedback,
  users,
  removedReasons,
  onClose,
  onHistory,
}: {
  feedback: StageFeedback;
  users: User[];
  removedReasons: string[];
  onClose: () => void;
  onHistory: () => void;
}) {
  const { t, lang } = useI18n();
  const { task, before, event } = feedback;
  const { headline, name, next } = content(feedback, users, t);
  const from = event ? (event.before as typeof task).stage : before.stage;
  return (
    <section className="stage-notice" aria-label={t("stageFeedback")}>
      <div className="stage-notice-content">
        <div className="stage-announcement">
          <strong>{t(headline)}</strong>
          <span>
            OT-{task.number} · {task.title}
          </span>
          <span className="stage-transition">
            {from !== task.stage && (
              <>
                <span className={"status " + from}>{t(from)}</span>
                <span aria-hidden="true"> → </span>
              </>
            )}
            <span className={"status " + task.stage}>{t(task.stage)}</span>
            {feedback.kind === "local" && from === task.stage && (
              <span>
                {t(
                  feedback.action === "approve"
                    ? "approvalStepConfirmed"
                    : feedback.action === "refuse"
                      ? "refusalConfirmed"
                      : "agreementConfirmed",
                )}
              </span>
            )}
          </span>
          <span>{next}</span>
          {removedReasons.length > 0 && (
            <span>
              {t("removedFromResults")}: {removedReasons.map(t).join(" · ")}
            </span>
          )}
        </div>
        {feedback.kind === "remote" && (
          <small className="muted stage-event">
            {event ? (
              <>
                {name(event.actorId)} ·{" "}
                <time dateTime={event.at}>{dateText(event.at, lang)}</time>
              </>
            ) : (
              t("stageMetadataUnavailable")
            )}
          </small>
        )}
      </div>
      <div className="stage-notice-actions">
        <button onClick={onHistory}>{t("viewTaskActivity")}</button>
        <button onClick={onClose} aria-label={t("closeStageFeedback")}>
          ×
        </button>
      </div>
    </section>
  );
}
