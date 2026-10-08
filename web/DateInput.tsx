import { useState } from "react";
import { useI18n } from "./i18n.js";

// Native datetime-local segments follow the OS locale, ignoring the app language.
// Keep an explicit, locale-independent numeric format and the original instant.
export function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { lang } = useI18n();
  const [text, setText] = useState(() => {
    if (!value) return "";
    const instant = Date.parse(value);
    // Keep a malformed legacy draft editable rather than crashing the form.
    return Number.isFinite(instant)
      ? new Date(instant + 8 * 3600000)
          .toISOString()
          .slice(0, 16)
          .replace("T", " ")
      : value;
  });
  const hint =
    lang === "en" ? "YYYY-MM-DD HH:mm · 24-hour" : "年-月-日 时:分 · 24 小时";
  return (
    <>
      <input
        aria-label={label}
        lang={lang === "en" ? "en" : "zh-CN"}
        type="text"
        inputMode="text"
        placeholder={hint}
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace("T", " ");
          setText(next);
          let valid = !next;
          if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(next)) {
            const date = new Date(next.replace(" ", "T") + ":00+08:00");
            valid =
              Number.isFinite(date.getTime()) &&
              new Date(date.getTime() + 8 * 3600000)
                .toISOString()
                .slice(0, 16)
                .replace("T", " ") === next;
            if (valid) onChange(date.toISOString());
          }
          if (!next) onChange("");
          e.target.setCustomValidity(
            valid
              ? ""
              : lang === "en"
                ? "Enter a valid date as YYYY-MM-DD HH:mm"
                : "请输入有效日期，格式为 年-月-日 时:分",
          );
        }}
      />
      <small className="date-format">{hint}</small>
    </>
  );
}
