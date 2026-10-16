import { defaultReviewer } from "../shared/assignments.js";
import { DateInput } from "./DateInput.js";
import { MarkdownEditor } from "./MarkdownEditor.js";
import "./taskDescription.css";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Task, User, Project } from "../shared/model.js";
import { useI18n } from "./i18n.js";
import { api, ApiError } from "./api.js";
import { randomUUID } from "./uuid.js";
export type FormSpec = {
  title: string;
  taskBefore?: Task;
  path: string;
  method?: string;
  values: Record<string, any>;
  fields: string[];
  transform?: (values: Record<string, any>) => unknown;
};
// Calendar and Markdown controls contain buttons; retain wrapping labels only
// for ordinary fields so captions focus a single control.
function FormField({
  label,
  separate,
  children,
}: {
  label: string;
  separate: boolean;
  children: ReactNode;
}) {
  const Field = separate ? "div" : "label";
  return (
    <Field className="form-field">
      <span>{label}</span>
      {children}
    </Field>
  );
}

export function TaskForm({
  spec,
  users,
  projects,
  onClose,
  onSaved,
  onPendingChange,
}: {
  spec: FormSpec;
  users: User[];
  projects: Project[];
  onClose: () => void;
  onSaved: (result: any) => Promise<void>;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { t, lang, setLang } = useI18n();
  const [values, setValues] = useState(spec.values);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [key] = useState(() => randomUUID());
  const checklistRequest = spec.title === "requestChecklist";
  const reasonRequired = checklistRequest && values.scopeChanged === true;
  const fieldLabel = (field: string) =>
    field === "reason" && checklistRequest
      ? t(reasonRequired ? "requiredReason" : "optionalReason")
      : t(field);
  const set = (k: string, v: any) =>
    setValues((x) => {
      const next = { ...x, [k]: v };
      if (
        (k === "ownerId" || k === "projectId") &&
        spec.fields.includes("reviewerId")
      )
        next.reviewerId = defaultReviewer(
          next.ownerId,
          next.projectId,
          users,
          projects,
        );
      return next;
    });
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (reasonRequired && !values.reason?.trim()) {
      setError(new ApiError("reasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    let result: any;
    onPendingChange?.(true);
    try {
      result = await api(
        spec.path,
        spec.method ?? "POST",
        spec.transform ? spec.transform(values) : values,
        key,
      );
    } catch (e) {
      setError(e as ApiError);
      setBusy(false);
      onPendingChange?.(false);
      return;
    }
    setBusy(false);
    onPendingChange?.(false);
    await onSaved(result);
    onClose();
  }
  return (
    <div className="modal-shade">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
      >
        <header>
          <h2 id="form-title">{t(spec.title)}</h2>
          <select
            className="dialog-language"
            aria-label={t("language")}
            value={lang}
            onChange={(e) => setLang(e.target.value as "en" | "zh")}
          >
            <option value="en">English</option>
            <option value="zh">简体中文</option>
          </select>
          <button onClick={onClose} aria-label={t("close")}>
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <p className="muted">{t("timezone")}</p>
          {spec.title === "newTask" && <p>{t("privateDraft")}</p>}
          {spec.fields.map((k) => (
            <FormField
              key={k}
              label={fieldLabel(k)}
              separate={[
                "outcome",
                "criteria",
                "scope",
                "plannedStart",
                "deadline",
                "acceptBy",
                "feedbackBy",
                "reviewBy",
                "confirmBy",
              ].includes(k)}
            >
              {[
                "ownerId",
                "reviewerId",
                "managerId",
                "helperId",
                "actorId",
              ].includes(k) ? (
                <select
                  aria-label={t(k)}
                  value={values[k] ?? ""}
                  onChange={(e) => set(k, e.target.value)}
                >
                  <option value="">
                    {t(k === "reviewerId" ? "defaultReviewer" : "noDefault")}
                  </option>
                  {users
                    .filter(
                      (u) =>
                        u.active &&
                        (k !== "reviewerId" ||
                          u.id !== values.ownerId ||
                          u.roles.includes("leader")),
                    )
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              ) : k === "projectId" ? (
                <select
                  aria-label={t(k)}
                  value={values[k] ?? ""}
                  onChange={(e) => set(k, e.target.value || null)}
                >
                  <option value="">{t("temporary")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : k === "targetId" ? (
                <TaskTarget
                  value={values[k] ?? ""}
                  onChange={(v) => set(k, v)}
                />
              ) : k === "kind" ? (
                <select
                  aria-label={t(k)}
                  value={values[k]}
                  onChange={(e) => set(k, e.target.value)}
                >
                  {["parent", "dependency", "related"].map((x) => (
                    <option key={x} value={x}>
                      {t(x)}
                    </option>
                  ))}
                </select>
              ) : k === "scopeChanged" ? (
                <input
                  aria-label={t(k)}
                  type="checkbox"
                  checked={values[k] ?? false}
                  onChange={(e) => {
                    set(k, e.target.checked);
                    if (error?.code === "reasonRequired") setError(null);
                  }}
                />
              ) : k === "memberIds" || k === "roles" ? (
                <select
                  aria-label={t(k)}
                  multiple
                  value={values[k] ?? []}
                  onChange={(e) =>
                    set(
                      k,
                      [...e.target.selectedOptions].map((x) => x.value),
                    )
                  }
                >
                  {(k === "roles"
                    ? ["admin", "leader", "member"].map((id) => ({
                        id,
                        name: t(id),
                      }))
                    : users.filter((u) => u.active)
                  ).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : [
                  "plannedStart",
                  "deadline",
                  "acceptBy",
                  "feedbackBy",
                  "reviewBy",
                  "confirmBy",
                ].includes(k) ? (
                <DateInput
                  label={t(k)}
                  value={values[k] ?? ""}
                  onChange={(v) => set(k, v)}
                />
              ) : k === "color" ? (
                <input
                  type="color"
                  aria-label={t(k)}
                  value={values[k] ?? "#7292c7"}
                  onChange={(e) => set(k, e.target.value)}
                />
              ) : [
                  "title",
                  "name",
                  "username",
                  "password",
                  "targetId",
                ].includes(k) ? (
                <input
                  aria-label={t(k)}
                  type={k === "password" ? "password" : "text"}
                  value={values[k] ?? ""}
                  onChange={(e) => set(k, e.target.value)}
                  autoComplete={k === "password" ? "new-password" : "off"}
                />
              ) : ["outcome", "criteria", "scope"].includes(k) ? (
                <MarkdownEditor
                  label={fieldLabel(k)}
                  value={values[k] ?? ""}
                  onChange={(value) => set(k, value)}
                />
              ) : (
                <textarea
                  aria-label={fieldLabel(k)}
                  required={k === "reason" && reasonRequired}
                  rows={k === "items" ? 10 : 5}
                  value={values[k] ?? ""}
                  onChange={(e) => set(k, e.target.value)}
                />
              )}
            </FormField>
          ))}
          {error && (
            <p role="alert" className="error">
              {t(error.code)}{" "}
              {error.requestId && (
                <small>
                  {t("requestId")}: {error.requestId}
                </small>
              )}
            </p>
          )}
          <footer>
            <button type="button" onClick={onClose}>
              {t("cancelForm")}
            </button>
            <button className="primary" disabled={busy}>
              {t(busy ? "loading" : "submit")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
export const termFields = [
  "title",
  "projectId",
  "ownerId",
  "reviewerId",
  "outcome",
  "scope",
  "criteria",
  "plannedStart",
  "deadline",
  "acceptBy",
  "feedbackBy",
];
export const emptyTerms = {
  title: "",
  projectId: null,
  ownerId: "",
  reviewerId: "",
  outcome: "",
  scope: "",
  criteria: "",
  plannedStart: "",
  deadline: "",
  acceptBy: "",
  feedbackBy: "",
  reviewBy: "",
};

function TaskTarget({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState(""),
    [options, setOptions] = useState<Task[]>([]);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(
      () =>
        api("/tasks?limit=100&search=" + encodeURIComponent(query)).then(
          (r) => {
            if (current) setOptions(r.items);
          },
        ),
      150,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <span className="task-picker">
      <input
        aria-label={t("search")}
        placeholder={t("search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        aria-label={t("targetId")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t("noDefault")}</option>
        {options.map((task) => (
          <option key={task.id} value={task.id}>
            OT-{task.number} · {task.title}
          </option>
        ))}
      </select>
    </span>
  );
}
