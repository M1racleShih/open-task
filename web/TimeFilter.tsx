import { useEffect, useState } from "react";
import type { TimeFilter } from "../shared/timeFilter.js";
import { timeRange } from "../shared/timeFilter.js";
import { useI18n } from "./i18n.js";

export function TimeFilterControls({
  value,
  project,
  inherited,
  busy,
  onSave,
}: {
  value: TimeFilter;
  project: string;
  inherited: boolean;
  busy: boolean;
  onSave: (value: TimeFilter | null) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value, project]);
  const [invalid, setInvalid] = useState(false);
  const range = timeRange(value);
  return (
    <details className="time-filter">
      <summary>
        {t(
          project
            ? inherited
              ? "timeInherited"
              : "timeOverride"
            : "timeGlobal",
        )}
        : {t("time_" + value.mode)}
        {range ? ` · ${range.start} — ${range.end}` : ""}
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            timeRange(draft);
          } catch {
            setInvalid(true);
            return;
          }
          setInvalid(false);
          await onSave(draft);
        }}
      >
        <label>
          {t("timeRange")}
          <select
            aria-label={t("timeRange")}
            value={draft.mode}
            onChange={(e) => {
              setInvalid(false);
              setDraft((x) => ({
                ...x,
                mode: e.target.value as TimeFilter["mode"],
              }));
            }}
          >
            {["all", "week", "month", "custom"].map((mode) => (
              <option key={mode} value={mode}>
                {t("time_" + mode)}
              </option>
            ))}
          </select>
        </label>
        {draft.mode === "custom" && (
          <div className="range-dates">
            <label>
              {t("rangeStart")}
              <input
                type="text"
                inputMode="numeric"
                placeholder="YYYY-MM-DD"
                pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
                required
                aria-label={t("rangeStart")}
                value={draft.start}
                onChange={(e) =>
                  setDraft((x) => ({ ...x, start: e.target.value }))
                }
              />
            </label>
            <label>
              {t("rangeEnd")}
              <input
                type="text"
                inputMode="numeric"
                placeholder="YYYY-MM-DD"
                pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
                required
                aria-label={t("rangeEnd")}
                value={draft.end}
                onChange={(e) =>
                  setDraft((x) => ({ ...x, end: e.target.value }))
                }
              />
            </label>
          </div>
        )}
        <label className="check-option">
          <input
            type="checkbox"
            checked={draft.includeUnscheduled}
            onChange={(e) =>
              setDraft((x) => ({ ...x, includeUnscheduled: e.target.checked }))
            }
          />
          {t("includeUnscheduled")}
        </label>
        <label className="check-option">
          <input
            type="checkbox"
            checked={draft.includeEarlier}
            onChange={(e) =>
              setDraft((x) => ({ ...x, includeEarlier: e.target.checked }))
            }
          />
          {t("includeEarlier")}
        </label>
        {invalid && (
          <p className="error" role="alert">
            {t("invalidTimeRange")}
          </p>
        )}
        <div className="time-actions">
          <button disabled={busy}>{t("applyTime")}</button>
          {project && !inherited && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSave(null)}
            >
              {t("followGlobal")}
            </button>
          )}
        </div>
        <small>{t("timePlanHint")}</small>
      </form>
    </details>
  );
}
