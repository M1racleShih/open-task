/** Synthetic prose only; the real TaskForm posts to a mocked API in the browser check. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18n, useI18n } from "../../web/i18n.js";
import { TaskForm } from "../../web/Forms.js";
import { TaskDescription } from "../../web/TaskDescription.js";
import "../../web/style.css";
import "../../web/taskDescription.css";

const prose = `# Delivery brief · 模拟交付\n\n**Readable results** with [reference](https://example.com).\nPlain text line one\n普通文字第二行\n\n## Review points\n\n- First item\n- 第二项\n  - Nested detail\n\n> A quote with context.\n\n| Check | Expected result |\n| --- | --- |\n| Narrow screen | ${"long-column-content-".repeat(15)} |\n\n\`inline code\`\n\n\`\`\`txt\n${"unbroken-code-".repeat(35)}\n\`\`\`\n\n- [x] Read-only Markdown checkbox\n\n<script>window.UNSAFE=true</script>\n\n[unsafe](javascript:alert%281%29)\n\n![external image](https://invalid.example/tracker.png)`;
function Fixture() {
  const { t, lang, setLang } = useI18n();
  const [task, setTask] = useState({
    outcome: prose,
    criteria:
      "## Ready for review\r\n\r\n**All criteria must be met.**\r\n\r\n1. Preserve source\r\n2. Keep ordinary line breaks\r\n3. Do not change checklist progress",
    scope: ("模拟工作范围：" + "wide-prose-".repeat(12) + "\n").repeat(12),
  });
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  return (
    <main style={{ maxWidth: wide ? 1180 : 420, margin: "auto", padding: 16 }}>
      <header>
        <h1>Markdown · Synthetic UI check</h1>
        <button onClick={() => setOpen(true)}>{t("edit")}</button>
        <button onClick={() => setWide(!wide)}>Width</button>
        <button onClick={() => setLang(lang === "en" ? "zh" : "en")}>
          Language
        </button>
        <button
          onClick={() => {
            document.documentElement.dataset.theme =
              document.documentElement.dataset.theme === "dark"
                ? "light"
                : "dark";
          }}
        >
          Theme
        </button>
      </header>
      <TaskDescription task={task} />
      <output data-testid="saved" hidden>
        {JSON.stringify(task)}
      </output>
      {open && (
        <TaskForm
          spec={{
            title: "edit",
            path: "/markdown-test",
            values: task,
            fields: ["outcome", "criteria", "scope"],
          }}
          users={[]}
          projects={[]}
          onClose={() => setOpen(false)}
          onSaved={async (result) => setTask(result)}
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
