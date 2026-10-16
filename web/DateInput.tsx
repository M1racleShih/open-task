import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useI18n } from "./i18n.js";
import { dateInputText, parseDateInput } from "./dateValue.js";
import { CalendarPicker } from "./CalendarPicker.js";

// Keep app-localized text alongside the calendar; native datetime-local segments
// follow the OS locale and cannot guarantee our language or 24-hour format.
export function DateInput({
  label,
  value,
  onChange,
  dateOnly = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dateOnly?: boolean;
  required?: boolean;
}) {
  const { lang } = useI18n();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => ({
    source: value,
    text: dateInputText(value, dateOnly),
  }));
  const [open, setOpen] = useState(false);
  // External resets (e.g. switching project filters) also replace unfinished text.
  if (draft.source !== value) {
    setDraft({ source: value, text: dateInputText(value, dateOnly) });
  }
  const text =
    draft.source === value ? draft.text : dateInputText(value, dateOnly);
  const invalid = parseDateInput(text, dateOnly) === null;
  const hint = dateOnly
    ? "YYYY-MM-DD"
    : lang === "en"
      ? "YYYY-MM-DD HH:mm · 24-hour"
      : "年-月-日 时:分 · 24 小时";
  const error =
    lang === "en"
      ? `Enter a valid date as ${dateOnly ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm"}`
      : `请输入有效日期，格式为 ${dateOnly ? "年-月-日" : "年-月-日 时:分"}`;
  useEffect(() => {
    input.current?.setCustomValidity(invalid ? error : "");
  }, [invalid, error]);
  function change(next: string) {
    const parsed = parseDateInput(next, dateOnly);
    setDraft({ source: parsed === null ? value : parsed, text: next });
    input.current?.setCustomValidity(parsed === null ? error : "");
    if (parsed !== null) onChange(parsed);
  }
  return (
    <div className="date-input">
      <div className="date-input-row">
        <input
          ref={input}
          aria-label={label}
          aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ""}`}
          aria-invalid={invalid || undefined}
          lang={lang === "en" ? "en" : "zh-CN"}
          type="text"
          inputMode={dateOnly ? "numeric" : "text"}
          placeholder={hint}
          required={required}
          value={text}
          onChange={(e) => change(e.target.value.replace("T", " "))}
        />
        <button
          type="button"
          aria-label={`${lang === "en" ? "Choose date" : "选择日期"} · ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${id}-picker` : undefined}
          onClick={() => setOpen(true)}
        >
          <CalendarDays size={18} aria-hidden="true" />
        </button>
      </div>
      <small className="date-format" id={`${id}-hint`}>
        {hint}
      </small>
      {invalid && (
        <small className="date-error" id={`${id}-error`}>
          {error}
        </small>
      )}
      {open && (
        <CalendarPicker
          key={value}
          id={`${id}-picker`}
          label={label}
          text={invalid ? "" : text}
          dateOnly={dateOnly}
          onConfirm={(next) => {
            change(next);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}
