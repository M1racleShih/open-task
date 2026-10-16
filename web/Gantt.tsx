import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Flag,
  Focus,
  Link2,
  LocateFixed,
  TriangleAlert,
} from "lucide-react";
import type { Task, Project, Relation, User } from "../shared/model.js";
import { lifecycleState } from "../shared/commitment.js";
import {
  calendarDay,
  DAY_MS,
  ganttRange,
  ganttRows,
  ganttTicks,
  taskSchedule,
} from "../shared/gantt.js";
import { dateText, useI18n } from "./i18n.js";
import "./graph-status.css";
import "./gantt.css";

const ROW_HEIGHT = 48;
const GROUP_HEIGHT = 34;
type Scale = "fit" | "day" | "week" | "month";

export function Gantt({
  tasks,
  projects,
  relations,
  users,
  selected,
  onSelect,
}: {
  tasks: Task[];
  projects: Project[];
  relations: Relation[];
  users: User[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const [scale, setScale] = useState<Scale>("fit");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [dependencies, setDependencies] = useState(false);
  const [width, setWidth] = useState(700);
  const [now, setNow] = useState(Date.now);
  const scroll = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const arrowId = useId();
  const today = calendarDay(now)!;
  const labelWidth = width < 480 ? 176 : 242;
  const plannedRange = useMemo(() => ganttRange(tasks, today), [tasks, today]);
  const rows = useMemo(
    () => ganttRows(tasks, projects, relations, collapsed),
    [tasks, projects, relations, collapsed],
  );
  const schedules = useMemo(
    () => new Map(tasks.map((task) => [task.id, taskSchedule(task, now)])),
    [tasks, now],
  );
  const names = new Map(users.map((user) => [user.id, user.name]));
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const dayWidth = Math.min(
    100_000 / plannedRange.days,
    scale === "fit"
      ? Math.max(0.25, (width - labelWidth - 2) / plannedRange.days)
      : { day: 44, week: 22, month: 7 }[scale],
  );
  const days =
    scale === "fit"
      ? plannedRange.days
      : Math.max(
          plannedRange.days,
          Math.ceil((width - labelWidth - 2) / dayWidth),
        );
  const range = {
    start: plannedRange.start,
    end: plannedRange.start + days - 1,
    days,
  };
  const timelineWidth = Math.max(1, range.days * dayWidth);
  const { unit, ticks } = ganttTicks(range.start, range.end, dayWidth);
  const months = ganttTicks(range.start, range.end, 0).ticks;
  // The upper rail uses months on ordinary plans and years on very long plans.
  const upperTicks =
    range.days < 1500 ? ganttTicks(range.start, range.end, 2).ticks : months;
  const locale = lang === "zh" ? "zh-CN" : "en-GB";
  const formatDay = (day: number, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
      new Date(day * DAY_MS),
    );
  const shortDate = (day: number) =>
    formatDay(day, { month: "numeric", day: "numeric" });
  const position = (day: number) => (day - range.start) * dayWidth;
  let height = 0;
  const rowPositions = new Map<string, { y: number; task: Task }>();
  for (const row of rows) {
    if (row.kind === "task")
      rowPositions.set(row.id, { y: height + ROW_HEIGHT / 2, task: row.task });
    height += row.kind === "project" ? GROUP_HEIGHT : ROW_HEIGHT;
  }
  const rangeCount = [...schedules.values()].filter(
    (s) => s.kind === "range",
  ).length;
  const deadlineCount = [...schedules.values()].filter(
    (s) => s.kind === "deadline",
  ).length;
  const overdueCount = [...schedules.values()].filter((s) => s.overdue).length;
  const weekends: number[] = [];
  if (dayWidth >= 6 && range.days <= 2100) {
    const weekday = new Date(range.start * DAY_MS).getUTCDay();
    const firstSaturday = range.start + ((6 - weekday + 7) % 7);
    for (let day = firstSaturday - 7; day <= range.end; day += 7)
      weekends.push(day);
  }

  const hasTasks = tasks.length > 0;
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const available = scroll.current?.clientWidth ?? entry.contentRect.width;
      if (available > 0) setWidth(available);
    });
    if (root.current) observer.observe(root.current);
    if (scroll.current) observer.observe(scroll.current);
    return () => observer.disconnect();
  }, [hasTasks]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  function locate(day: number) {
    const element = scroll.current;
    if (!element) return;
    element.scrollTo({
      left: Math.max(0, position(day) - (element.clientWidth - labelWidth) / 2),
      behavior: "auto",
    });
  }
  function locateSelected() {
    const task = taskMap.get(selected);
    if (!task) return;
    const id =
      task.projectId && projects.some((p) => p.id === task.projectId)
        ? task.projectId
        : "temporary";
    if (collapsed.has(id)) {
      setCollapsed((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
    // Wait for an expanded group to commit before reading its row.
    requestAnimationFrame(() => {
      const row = root.current?.querySelector<HTMLElement>(
        `[data-task-row="${CSS.escape(task.id)}"]`,
      );
      const schedule = schedules.get(task.id)!;
      locate(schedule.start ?? schedule.end ?? today);
      if (row && scroll.current)
        scroll.current.scrollTop = Math.max(
          0,
          row.offsetTop - scroll.current.clientHeight / 2,
        );
    });
  }

  const selectedInResults = taskMap.has(selected);
  useEffect(() => {
    if (selectedInResults) locateSelected();
  }, [selected, selectedInResults]);

  return (
    <div className="gantt state-graph" ref={root} aria-label={t("gantt")}>
      <div className="gantt-toolbar">
        <div className="gantt-heading">
          <CalendarDays size={17} />
          <strong>{t("ganttSchedule")}</strong>
          <span>
            {tasks.length} {t("tasks")}
          </span>
        </div>
        <div className="gantt-actions">
          <div
            className="gantt-scale"
            role="group"
            aria-label={t("ganttScale")}
          >
            {(["fit", "day", "week", "month"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={scale === value}
                onClick={() => setScale(value)}
              >
                {t("gantt_" + value)}
              </button>
            ))}
          </div>
          <button onClick={() => locate(today)} title={t("ganttToday")}>
            <LocateFixed size={14} />
            {t("ganttToday")}
          </button>
          <button
            onClick={locateSelected}
            disabled={!taskMap.has(selected)}
            aria-label={t("locate")}
            title={t("locate")}
          >
            <Focus size={16} />
          </button>
          <button
            aria-pressed={dependencies}
            onClick={() => setDependencies((value) => !value)}
            title={t("ganttDependencyHint")}
          >
            <Link2 size={14} />
            {t("dependency")}
          </button>
        </div>
      </div>
      <div className="gantt-summary">
        <span>
          {formatDay(range.start, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}{" "}
          — {shortDate(range.end)}
        </span>
        <span>
          {rangeCount} {t("ganttRanges")}
          <i />
          {deadlineCount} {t("ganttDeadlines")}
        </span>
        {overdueCount > 0 && (
          <span className="gantt-overdue-summary">
            <TriangleAlert size={12} />
            {overdueCount} {t("deliveryOverdue")}
          </span>
        )}
      </div>
      {tasks.length === 0 ? (
        <div className="gantt-empty">
          <CalendarDays size={34} />
          <strong>{t("promiseEmpty")}</strong>
          <span>{t("promiseEmptyNote")}</span>
        </div>
      ) : (
        <div
          className="gantt-scroll"
          ref={scroll}
          tabIndex={0}
          role="region"
          aria-label={t("ganttTimeline")}
        >
          <div
            className="gantt-board"
            style={
              {
                width: labelWidth + timelineWidth,
                "--gantt-label-width": `${labelWidth}px`,
                "--gantt-day-width": `${dayWidth}px`,
              } as CSSProperties
            }
          >
            <div className="gantt-axis">
              <div className="gantt-axis-label">
                <span>{t("ganttTaskOwner")}</span>
                <small>{t("ganttCurrentPlan")}</small>
              </div>
              <div className="gantt-dates">
                <div className="gantt-months">
                  {upperTicks.map((tick) => (
                    <span
                      key={tick.start}
                      style={{
                        left: position(tick.start),
                        width: (tick.end - tick.start) * dayWidth,
                      }}
                    >
                      {formatDay(
                        tick.start,
                        range.days < 1500
                          ? { year: "numeric", month: "long" }
                          : { year: "numeric" },
                      )}
                    </span>
                  ))}
                </div>
                <div className="gantt-ticks">
                  {ticks.map((tick) => (
                    <span
                      key={tick.start}
                      data-today={tick.start <= today && tick.end > today}
                      style={{
                        left: position(tick.start),
                        width: (tick.end - tick.start) * dayWidth,
                      }}
                    >
                      {formatDay(
                        tick.start,
                        unit === "year"
                          ? { year: "numeric" }
                          : unit === "month"
                            ? { month: "short" }
                            : { month: "numeric", day: "numeric" },
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="gantt-rows">
              <div
                className="gantt-calendar"
                aria-hidden="true"
                style={{ left: labelWidth, width: timelineWidth }}
              >
                {weekends.map((day) => (
                  <div
                    className="gantt-weekend"
                    key={day}
                    style={{
                      left: Math.max(0, position(day)),
                      width: Math.max(
                        0,
                        Math.min(position(day + 2), timelineWidth) -
                          Math.max(0, position(day)),
                      ),
                    }}
                  />
                ))}
                <div
                  className="gantt-today-line"
                  style={{ left: position(today) + dayWidth / 2 }}
                >
                  <span>{t("ganttToday")}</span>
                </div>
              </div>
              {rows.map((row) => {
                if (row.kind === "project")
                  return (
                    <div className="gantt-project-row" key={row.id}>
                      <button
                        className="gantt-project-label"
                        aria-expanded={!collapsed.has(row.id)}
                        onClick={() =>
                          setCollapsed((previous) => {
                            const next = new Set(previous);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          })
                        }
                      >
                        {collapsed.has(row.id) ? (
                          <ChevronRight size={13} />
                        ) : (
                          <ChevronDown size={13} />
                        )}
                        <i
                          style={{
                            background: row.project?.color ?? "#78849b",
                          }}
                        />
                        <strong>{row.project?.name ?? t("temporary")}</strong>
                        <span>{row.count}</span>
                      </button>
                      <div className="gantt-project-lane" />
                    </div>
                  );
                const task = row.task;
                const schedule = schedules.get(task.id)!;
                const state = lifecycleState(task);
                const blocked = task.blocks.some((block) => !block.resolved);
                const owner = names.get(task.ownerId) ?? "—";
                const selectedRow = selected === task.id;
                const start = schedule.start ?? schedule.end;
                const x =
                  start === null
                    ? 12
                    : position(start) +
                      (schedule.kind === "deadline" ? dayWidth / 2 : 0);
                const barWidth =
                  schedule.kind === "range"
                    ? (schedule.end! - schedule.start! + 1) * dayWidth
                    : 0;
                const title = [
                  `OT-${task.number} · ${task.title}`,
                  `${t("ownerId")}: ${owner}`,
                  t(task.stage),
                  `${t("plannedStart")}: ${dateText(task.plannedStart ?? "", lang)}`,
                  `${t("deadline")}: ${dateText(task.deadline, lang)}`,
                  schedule.overdue
                    ? `${t("deliveryOverdue")}: ${dateText(schedule.effectiveDeadline, lang)}`
                    : "",
                  blocked ? t("blocked") : "",
                  state === "changed" ? t("lifecycle_changed") : "",
                  task.viewSource
                    ? t(
                        task.viewSource === "context"
                          ? "ancestorContext"
                          : "earlierTask",
                      )
                    : "",
                ]
                  .filter(Boolean)
                  .join("\n");
                return (
                  <div
                    className="gantt-task-row"
                    data-task-row={task.id}
                    data-lifecycle={state}
                    data-selected={selectedRow}
                    key={row.id}
                  >
                    <button
                      className="gantt-task-label"
                      onClick={() => onSelect(task.id)}
                      aria-pressed={selectedRow}
                      title={title}
                      style={{ paddingLeft: 12 + Math.min(row.depth, 8) * 12 }}
                    >
                      <span className="gantt-task-number">
                        {row.depth > 0 ? "↳ " : ""}OT-{task.number}
                      </span>
                      <span className="gantt-task-copy">
                        <strong>{task.title}</strong>
                        <small>
                          <span className="gantt-owner">{owner}</span>
                          <span className="gantt-phase-dot" />
                          {t(
                            state === "changed"
                              ? "lifecycle_changed"
                              : task.stage,
                          )}
                          {task.viewSource && (
                            <span className="gantt-context">
                              {" "}
                              ·{" "}
                              {t(
                                task.viewSource === "context"
                                  ? "ancestorContext"
                                  : "earlierTask",
                              )}
                            </span>
                          )}
                        </small>
                      </span>
                      {(blocked || schedule.overdue) && (
                        <TriangleAlert
                          size={13}
                          className="gantt-warning"
                          aria-label={t(
                            blocked ? "blocked" : "deliveryOverdue",
                          )}
                        />
                      )}
                    </button>
                    <div className="gantt-lane">
                      <button
                        className={`gantt-item gantt-item-${schedule.kind}`}
                        style={{
                          left: x,
                          ...(schedule.kind === "range"
                            ? { width: Math.max(4, barWidth) }
                            : {}),
                        }}
                        data-overdue={schedule.overdue}
                        data-blocked={blocked}
                        title={title}
                        aria-label={`${t("ganttTaskSchedule")} OT-${task.number} · ${task.title} · ${t(task.stage)} · ${owner} · ${schedule.kind === "unscheduled" ? t("ganttUnscheduled") : dateText(task.deadline, lang)}`}
                        aria-pressed={selectedRow}
                        onClick={() => onSelect(task.id)}
                      >
                        {schedule.kind === "range" ? (
                          <>
                            <span className="gantt-bar-caption">
                              {barWidth > 80 ? task.title : ""}
                            </span>
                            <span className="gantt-bar-end" />
                          </>
                        ) : schedule.kind === "deadline" ? (
                          <>
                            <Flag size={13} />
                            <span>
                              {t("ganttDeadlineOnly")}{" "}
                              {shortDate(schedule.end!)}
                            </span>
                          </>
                        ) : (
                          <span>{t("ganttUnscheduled")}</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              {dependencies && (
                <svg
                  className="gantt-dependencies"
                  style={{ left: labelWidth }}
                  width={timelineWidth}
                  height={height}
                  aria-label={t("ganttDependencyHint")}
                >
                  <defs>
                    <marker
                      id={arrowId}
                      markerWidth="6"
                      markerHeight="6"
                      refX="5"
                      refY="3"
                      orient="auto"
                    >
                      <path d="M0 0L6 3L0 6Z" fill="currentColor" />
                    </marker>
                  </defs>
                  {relations
                    .filter((relation) => relation.kind === "dependency")
                    .map((relation) => {
                      const prerequisite = rowPositions.get(relation.targetId);
                      const dependent = rowPositions.get(relation.sourceId);
                      const from = schedules.get(relation.targetId)?.end;
                      const to = schedules.get(relation.sourceId)?.end;
                      if (
                        !prerequisite ||
                        !dependent ||
                        from == null ||
                        to == null
                      )
                        return null;
                      const x1 =
                        position(from) +
                        dayWidth *
                          (schedules.get(relation.targetId)?.kind === "deadline"
                            ? 0.5
                            : 1);
                      const x2 =
                        position(to) +
                        dayWidth *
                          (schedules.get(relation.sourceId)?.kind === "deadline"
                            ? 0.5
                            : 1);
                      const elbow = Math.min(
                        timelineWidth - 3,
                        Math.max(x1, x2) + 15,
                      );
                      return (
                        <path
                          key={relation.id}
                          d={`M${x1},${prerequisite.y} H${elbow} V${dependent.y} H${x2}`}
                          markerEnd={`url(#${arrowId})`}
                          data-highlighted={
                            relation.sourceId === selected ||
                            relation.targetId === selected
                          }
                        >
                          <title>
                            {prerequisite.task.title} → {dependent.task.title} ·{" "}
                            {t("ganttDependencyHint")}
                          </title>
                        </path>
                      );
                    })}
                </svg>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="gantt-footer">
        <span>
          <i className="gantt-legend-bar" />
          {t("ganttPlannedRange")}
        </span>
        <span>
          <Flag size={12} />
          {t("ganttDeadlineOnly")}
        </span>
        <span className="gantt-footer-note">
          {t(dependencies ? "ganttDependencyHint" : "ganttPlanHint")}
        </span>
      </div>
    </div>
  );
}
