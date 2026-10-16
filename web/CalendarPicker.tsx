import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { validDay } from "../shared/timeFilter.js";
import {
  moveDay,
  moveMonth,
  parseDateInput,
  shanghaiToday,
} from "./dateValue.js";
import { useI18n } from "./i18n.js";

export function CalendarPicker({
  id,
  label,
  text,
  dateOnly,
  onConfirm,
  onCancel,
}: {
  id: string;
  label: string;
  text: string;
  dateOnly: boolean;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}) {
  const { lang } = useI18n();
  const en = lang === "en";
  const locale = en ? "en-GB" : "zh-CN";
  const dialog = useRef<HTMLDialogElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const initial = validDay(text.slice(0, 10)) ? text.slice(0, 10) : "";
  const [selected, setSelected] = useState(initial);
  const [focusDay, setFocusDay] = useState(initial || shanghaiToday());
  const [time, setTime] = useState(text.slice(11, 16));
  const month = focusDay.slice(0, 7);
  const first = month + "-01";
  const offset = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7;
  const monthEnd = new Date(first + "T00:00:00Z");
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0);
  const last = monthEnd.getUTCDate();
  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, i, 1)),
    ),
  );
  const weekdays = en
    ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
    : ["一", "二", "三", "四", "五", "六", "日"];
  const next = selected ? selected + (dateOnly ? "" : " " + time) : "";
  const canConfirm = !!selected && parseDateInput(next, dateOnly) !== null;
  useLayoutEffect(() => {
    const node = dialog.current!;
    node.showModal();
    grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
    return () => node.close();
  }, []);
  function focus(nextDay: string) {
    setFocusDay(nextDay);
    requestAnimationFrame(() =>
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${nextDay}"]`)
        ?.focus(),
    );
  }
  function navigate(e: KeyboardEvent, day: string) {
    const delta: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let nextDay: string;
    if (e.key in delta) nextDay = moveDay(day, delta[e.key]);
    else if (e.key === "PageUp" || e.key === "PageDown")
      nextDay = moveMonth(day, e.key === "PageUp" ? -1 : 1);
    else if (e.key === "Home" || e.key === "End") {
      const weekday = (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7;
      nextDay = moveDay(day, e.key === "Home" ? -weekday : 6 - weekday);
    } else return;
    e.preventDefault();
    focus(nextDay);
  }
  return createPortal(
    <dialog
      ref={dialog}
      id={id}
      className="calendar-picker"
      aria-labelledby={`${id}-title`}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            "button, input, select",
          ),
        ).filter(
          (node) => node.tabIndex >= 0 && !node.hasAttribute("disabled"),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (
          (e.shiftKey && document.activeElement === first) ||
          (!e.shiftKey && document.activeElement === last)
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          onCancel();
      }}
    >
      <h3 id={`${id}-title`}>{label}</h3>
      <p className="date-format">
        {dateOnly
          ? "YYYY-MM-DD"
          : en
            ? "Asia/Shanghai · 24-hour"
            : "上海时区 · 24 小时制"}
      </p>
      <div className="calendar-month">
        <button
          type="button"
          aria-label={en ? "Previous month" : "上个月"}
          disabled={month === "0001-01"}
          onClick={() => setFocusDay(moveMonth(focusDay, -1))}
        >
          ‹
        </button>
        <select
          aria-label={en ? "Month" : "月份"}
          value={Number(focusDay.slice(5, 7)) - 1}
          onChange={(e) =>
            setFocusDay(
              moveMonth(
                focusDay,
                Number(e.target.value) - Number(focusDay.slice(5, 7)) + 1,
              ),
            )
          }
        >
          {months.map((name, i) => (
            <option key={i} value={i}>
              {name}
            </option>
          ))}
        </select>
        <input
          aria-label={en ? "Year" : "年份"}
          type="number"
          min="1"
          max="9999"
          value={Number(focusDay.slice(0, 4))}
          onChange={(e) => {
            const year = Number(e.target.value);
            if (Number.isInteger(year) && year >= 1 && year <= 9999)
              setFocusDay(
                moveMonth(focusDay, (year - Number(focusDay.slice(0, 4))) * 12),
              );
          }}
        />
        <button
          type="button"
          aria-label={en ? "Next month" : "下个月"}
          disabled={month === "9999-12"}
          onClick={() => setFocusDay(moveMonth(focusDay, 1))}
        >
          ›
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        ref={grid}
        className="calendar-days"
        role="group"
        aria-label={en ? "Days" : "日期"}
      >
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: last }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              type="button"
              key={day}
              data-day={day}
              aria-label={day}
              aria-pressed={selected === day}
              aria-current={day === shanghaiToday() ? "date" : undefined}
              tabIndex={day === focusDay ? 0 : -1}
              onKeyDown={(e) => navigate(e, day)}
              onClick={() => {
                setSelected(day);
                setFocusDay(day);
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {!dateOnly && (
        <div className="calendar-time">
          <span>{en ? "Time (24-hour)" : "时间（24 小时制）"}</span>
          <div className="calendar-clock">
            <select
              aria-label={en ? "Hour (24-hour)" : "小时（24 小时制）"}
              value={time.split(":")[0] || ""}
              onChange={(e) =>
                setTime(`${e.target.value}:${time.split(":")[1] || ""}`)
              }
            >
              <option value="">HH</option>
              {Array.from({ length: 24 }, (_, i) =>
                String(i).padStart(2, "0"),
              ).map((hour) => (
                <option key={hour}>{hour}</option>
              ))}
            </select>
            <span aria-hidden="true">:</span>
            <select
              aria-label={en ? "Minute" : "分钟"}
              value={time.split(":")[1] || ""}
              onChange={(e) =>
                setTime(`${time.split(":")[0] || ""}:${e.target.value}`)
              }
            >
              <option value="">mm</option>
              {Array.from({ length: 60 }, (_, i) =>
                String(i).padStart(2, "0"),
              ).map((minute) => (
                <option key={minute}>{minute}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      <p className="calendar-preview" aria-live="polite">
        {selected || (en ? "Choose a date" : "请选择日期")}
        {!dateOnly && selected ? ` ${time || "HH:mm"}` : ""}
      </p>
      <div className="calendar-actions">
        <button type="button" onClick={() => onConfirm("")}>
          {en ? "Clear" : "清空"}
        </button>
        <button type="button" onClick={onCancel}>
          {en ? "Cancel" : "取消"}
        </button>
        <button
          type="button"
          className="primary"
          disabled={!canConfirm}
          onClick={() => {
            if (canConfirm) onConfirm(next);
          }}
        >
          {en ? "Confirm" : "确认"}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
