import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18n, useI18n } from "../../web/i18n.js";
import { TaskForm } from "../../web/Forms.js";
import { TimeFilterControls } from "../../web/TimeFilter.js";
import { defaultTimeFilter, type TimeFilter } from "../../shared/timeFilter.js";
import "../../web/style.css";

function Fixture() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({
    title: "Calendar fixture",
    plannedStart: "2026-10-16T04:00:39.123Z",
    deadline: "2026-10-31T10:00:00Z",
    acceptBy: "",
    feedbackBy: "",
    reviewBy: "",
    confirmBy: "",
  });
  const [project, setProject] = useState("");
  const [filter, setFilter] = useState<TimeFilter>({
    ...defaultTimeFilter,
    mode: "custom",
    start: "2026-10-01",
    end: "2026-10-31",
  });
  const [saved, setSaved] = useState("");
  return (
    <main style={{ maxWidth: 520, padding: 16, margin: "auto" }}>
      <button onClick={() => setOpen(true)}>Task form</button>
      <button onClick={() => setLang(lang === "en" ? "zh" : "en")}>
        Language
      </button>
      <button onClick={() => setProject(project ? "" : "project-a")}>
        Switch project
      </button>
      <TimeFilterControls
        value={filter}
        project={project}
        inherited={false}
        busy={false}
        onSave={async (value) => {
          if (value) {
            setFilter(value);
            setSaved(JSON.stringify(value));
          }
        }}
      />
      <output data-testid="saved">{saved}</output>
      {open && (
        <TaskForm
          spec={{
            title: "newTask",
            path: "/calendar-test",
            values,
            fields: [
              "title",
              "plannedStart",
              "deadline",
              "acceptBy",
              "feedbackBy",
              "reviewBy",
              "confirmBy",
            ],
          }}
          users={[]}
          projects={[]}
          onClose={() => setOpen(false)}
          onSaved={async (result) => {
            setValues(result);
            setSaved(JSON.stringify(result));
          }}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <I18n>
    <Fixture />
  </I18n>,
);
