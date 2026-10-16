import { useId, useLayoutEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown.js";
import { useI18n } from "./i18n.js";
import {
  editMarkdown,
  formatMarkdown,
  sourceOffset,
  textareaText,
  type MarkdownTool,
} from "./markdownEditing.js";

export function MarkdownEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<{
    start: number;
    end: number;
    direction: "forward" | "backward" | "none";
  }>({ start: 0, end: 0, direction: "none" });
  const pendingSelection = useRef(false);
  const [preview, setPreview] = useState(false);
  useLayoutEffect(() => {
    if (!preview && pendingSelection.current && input.current) {
      input.current.focus();
      input.current.setSelectionRange(
        selection.current.start,
        selection.current.end,
        selection.current.direction,
      );
      pendingSelection.current = false;
    }
  });
  function format(tool: MarkdownTool) {
    const result = formatMarkdown(
      value,
      sourceOffset(
        value,
        input.current?.selectionStart ?? selection.current.start,
      ),
      sourceOffset(value, input.current?.selectionEnd ?? selection.current.end),
      tool,
    );
    selection.current = {
      start: textareaText(result.text.slice(0, result.start)).length,
      end: textareaText(result.text.slice(0, result.end)).length,
      direction:
        tool === "link"
          ? "forward"
          : (input.current?.selectionDirection ?? "none"),
    };
    pendingSelection.current = true;
    onChange(result.text);
  }
  return (
    <div className="markdown-editor">
      <div className="markdown-editor-bar">
        <div
          className="markdown-editor-modes"
          role="group"
          aria-label={`${t("markdownMode")} · ${label}`}
        >
          <button
            type="button"
            aria-pressed={!preview}
            onClick={() => {
              if (preview) {
                pendingSelection.current = true;
                setPreview(false);
              } else input.current?.focus();
            }}
          >
            {t("markdownEdit")}
          </button>
          <button
            type="button"
            aria-pressed={preview}
            onClick={() => {
              if (!preview && input.current)
                selection.current = {
                  start: input.current.selectionStart,
                  end: input.current.selectionEnd,
                  direction: input.current.selectionDirection,
                };
              setPreview(true);
            }}
          >
            {t("markdownPreview")}
          </button>
        </div>
        {!preview && (
          <div role="group" aria-label={`${t("markdownFormat")} · ${label}`}>
            {(["bold", "list", "link"] as const).map((tool) => (
              <button
                type="button"
                key={tool}
                onClick={() => format(tool)}
                title={t(`markdown${tool}Hint`)}
              >
                {t(`markdown${tool}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      <textarea
        ref={input}
        aria-label={label}
        aria-describedby={`${id}-hint`}
        hidden={preview}
        rows={7}
        value={textareaText(value)}
        onChange={(e) => onChange(editMarkdown(value, e.target.value))}
        onKeyDown={(e) => {
          if (
            !(e.ctrlKey || e.metaKey) ||
            e.altKey ||
            e.nativeEvent.isComposing
          )
            return;
          const key = e.key.toLowerCase();
          const tool =
            key === "b" && !e.shiftKey
              ? "bold"
              : key === "k" && !e.shiftKey
                ? "link"
                : e.shiftKey && (key === "8" || key === "*")
                  ? "list"
                  : null;
          if (tool) {
            e.preventDefault();
            format(tool);
          }
        }}
      />
      {preview && (
        <div
          className="markdown-editor-preview task-prose"
          role="region"
          aria-label={`${t("markdownPreview")} · ${label}`}
        >
          <Markdown text={value} />
        </div>
      )}
      <small id={`${id}-hint`}>{t("markdownHint")}</small>
    </div>
  );
}
