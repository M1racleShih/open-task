import { Markdown } from "./Markdown.js";
import { eventDiff } from "../shared/eventDiff.js";
import { fitPanels } from "../shared/panelLayout.js";
import { ProjectMenu, type ProjectMenuTarget } from "./ProjectMenu.js";
import { TaskIcon } from "./TaskIcon.js";
import { Graph } from "./Graph.js";
import {
  useEffect,
  useState,
  useRef,
  type FormEvent,
  type CSSProperties,
} from "react";
import {
  Bell,
  ClipboardList,
  Folder,
  Plus,
  RefreshCw,
  PanelBottom,
  Sun,
  Moon,
  GitGraph,
  ListTree,
  Activity,
  LogOut,
  Settings,
  ChevronDown,
} from "lucide-react";
import type { Task, User, Project, Relation, Event } from "../shared/model.js";
import { reconcileChecklist } from "../shared/checklist.js";
import { terminal } from "../shared/model.js";
import { api, ApiError, allPages, pagesUntil } from "./api.js";
import { useI18n, dateText } from "./i18n.js";
import { TaskForm, termFields, emptyTerms, type FormSpec } from "./Forms.js";
export function App() {
  const { t, lang, setLang } = useI18n();
  const [me, setMe] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  const [users, setUsers] = useState<User[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [tasks, setTasks] = useState<Task[]>([]),
    [events, setEvents] = useState<Event[]>([]),
    [notices, setNotices] = useState<any[]>([]),
    [relations, setRelations] = useState<Relation[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<Partial<Task>[]>([]);
  const [taskEventCursor, setTaskEventCursor] = useState<number | null>(null);
  const [projectMenu, setProjectMenu] = useState<ProjectMenuTarget | null>(
    null,
  );
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [contextTab, setContextTab] = useState("relations");
  const [detailTab, setDetailTab] = useState("overview");
  const [taskEvents, setTaskEvents] = useState<Event[]>([]);
  const [selected, setSelected] = useState(
      () => new URLSearchParams(location.search).get("task") ?? "",
    ),
    [detail, setDetail] = useState<Task | null>(null),
    [search, setSearch] = useState(""),
    [project, setProject] = useState(""),
    [actor, setActor] = useState(""),
    [tab, setTab] = useState("graph"),
    [bottom, setBottom] = useState(true),
    [bottomTab, setBottomTab] = useState("inbox"),
    [mobile, setMobile] = useState(
      new URLSearchParams(location.search).get("view") === "commitments"
        ? "workspace"
        : selected
          ? "details"
          : "tree",
    ),
    [collapsed, setCollapsed] = useState(false),
    [form, setForm] = useState<FormSpec | null>(null),
    [theme, setTheme] = useState(
      () => localStorage.getItem("open-task.theme") ?? "light",
    );
  const [checklistDraft, setChecklistDraft] = useState<{
    taskId: string;
    version: number;
    checklistVersion: number;
    changes: Record<string, { expectedDone: boolean; done: boolean }>;
  } | null>(null);
  const checklistDirty =
    !!checklistDraft && Object.keys(checklistDraft.changes).length > 0;
  useEffect(() => {
    if (!checklistDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [checklistDirty]);
  function discardChecklist() {
    if (busy && checklistDirty) return false;
    if (checklistDirty && !window.confirm(t("discardChecklist"))) return false;
    setChecklistDraft(null);
    return true;
  }
  const [viewport, setViewport] = useState(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  const [treeSize, setLeftWidth] = useState<number | null>(null),
    [detailSize, setRightWidth] = useState<number | null>(null),
    [inboxSize, setBottomHeight] = useState<number | null>(null);
  const [showTree, setShowTree] = useState(true),
    [showDetails, setShowDetails] = useState(true);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [layoutSize, setLayoutSize] = useState({
    width: innerWidth - 60,
    height: innerHeight - 90,
  });
  useEffect(() => {
    const resize = () =>
      setViewport({ width: innerWidth, height: innerHeight });
    window.addEventListener("resize", resize);
    const element = layoutRef.current;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setLayoutSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    if (element) observer.observe(element);
    return () => {
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, [me, ready]);
  const panelBudget = Math.max(
    0,
    layoutSize.width - (showTree ? 7 : 0) - (showDetails ? 7 : 0),
  );
  const { left: leftWidth, right: rightWidth } = fitPanels(
    showTree
      ? (treeSize ??
          Math.round(Math.min(430, Math.max(240, viewport.width * 0.2))))
      : 0,
    showDetails
      ? (detailSize ??
          Math.round(Math.min(650, Math.max(410, viewport.width * 0.28))))
      : 0,
    panelBudget,
  );
  const bottomBudget = Math.max(0, layoutSize.height - 7);
  const bottomHeight = Math.min(
    bottomBudget,
    inboxSize ??
      Math.round(Math.min(500, Math.max(180, layoutSize.height * 0.32))),
  );
  const [foldedProjects, setFoldedProjects] = useState<Set<string>>(
    () => new Set(),
  );
  const [folded, setFolded] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [allRelations, setAllRelations] = useState<Relation[]>([]);
  const [taskCursor, setTaskCursor] = useState<number | null>(null);
  const [eventCursor, setEventCursor] = useState<number | null>(null);
  const loadSequence = useRef(0);
  const leader = me?.roles.includes("leader");
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? "—";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("open-task.theme", theme);
  }, [theme]);
  useEffect(() => {
    api("/me")
      .then((x) => setMe(x.user))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  async function loadTaskHistory() {
    const r = await api(
      "/events?taskId=" + selected + "&limit=200&cursor=" + taskEventCursor,
    );
    setTaskEvents((x) => [...x, ...r.items]);
    setTaskEventCursor(r.nextCursor);
  }
  async function refresh() {
    if (!me) return;
    const sequence = ++loadSequence.current;
    try {
      const [us, ps, ts, ns, es, rs] = await Promise.all([
        api("/users"),
        api("/projects"),
        pagesUntil(
          "/tasks?limit=200&search=" +
            encodeURIComponent(search) +
            (project ? "&projectId=" + project : ""),
          Math.max(200, tasks.length),
        ),
        allPages("/followups"),
        api(
          "/events?limit=100" +
            (project ? "&projectId=" + project : "") +
            (actor ? "&actorId=" + actor : "") +
            "&search=" +
            encodeURIComponent(search),
        ),
        allPages("/relations?limit=1000"),
      ]);
      if (sequence !== loadSequence.current) return;
      setAllRelations(rs.items);
      setTaskCursor(ts.nextCursor);
      setEventCursor(es.nextCursor);
      setUsers(us);
      setProjects(ps);
      setTasks(ts.items);
      setNotices(ns.items);
      setEvents(es.items);
      if (selected) {
        const d = await api("/tasks/" + selected);
        if (sequence === loadSequence.current) {
          setDetail(d.task);
          setRelations(d.relations);
          setLinkedTasks(d.targets);
          const history = await pagesUntil(
            "/events?taskId=" + selected + "&limit=200",
            taskEvents[0]?.taskId === selected
              ? Math.max(200, taskEvents.length)
              : 200,
          );
          setTaskEvents(history.items);
          setTaskEventCursor(history.nextCursor);
        }
      }
      setError("");
    } catch (e) {
      setError((e as ApiError).code);
    }
  }
  useEffect(() => {
    void refresh();
  }, [me, selected, search, project, actor]);
  useEffect(() => {
    if (!me) return;
    const timer = setInterval(() => {
      void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [me, selected, search, project, actor]);
  function select(id: string) {
    if (id !== selected && !discardChecklist()) return;
    setSelectedProject(null);
    setSelected(id);
    const params = new URLSearchParams(location.search);
    params.set("task", id);
    history.replaceState(null, "", "?" + params.toString());
    setMobile("details");
  }
  function chooseTab(next: string) {
    setTab(next);
    const params = new URLSearchParams(location.search);
    params.delete("view");
    history.replaceState(
      null,
      "",
      location.pathname + (params.size ? "?" + params.toString() : ""),
    );
  }
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("view") !== "commitments") return;
    params.delete("view");
    history.replaceState(
      null,
      "",
      location.pathname + (params.size ? "?" + params.toString() : ""),
    );
  }, []);
  async function loadMoreTasks() {
    if (!taskCursor) return;
    const r = await api(
      "/tasks?limit=200&cursor=" +
        taskCursor +
        "&search=" +
        encodeURIComponent(search) +
        (project ? "&projectId=" + project : ""),
    );
    setTasks((items) => [...items, ...r.items]);
    setTaskCursor(r.nextCursor);
  }
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api("/sessions", "POST", { username, password });
      setMe(r.user);
      setPassword("");
      setError("");
    } catch (e) {
      setError((e as ApiError).code);
    } finally {
      setBusy(false);
    }
  }
  const language = (
    <select
      aria-label={t("language")}
      value={lang}
      onChange={(e) => setLang(e.target.value as "en" | "zh")}
    >
      <option value="en">English</option>
      <option value="zh">简体中文</option>
    </select>
  );
  function openAction(
    action: string,
    fields: string[] = [],
    extra: Record<string, any> = {},
  ) {
    if (!detail) return;
    const task = detail;
    const values: any = { version: task.version, ...extra };
    if (action === "edit" || action === "adjust")
      Object.assign(values, task, extra);
    setForm({
      title: action,
      path: `/tasks/${task.id}/actions/${action}`,
      values,
      fields,
      transform: (v) => {
        if (action === "edit" || action === "adjust")
          return {
            version: task.version,
            fields: Object.fromEntries(
              [...termFields, "reviewBy"].map((k) => [k, v[k]]),
            ),
            reason: v.reason,
            confirmBy: v.confirmBy,
          };
        if (action === "submitResult")
          return {
            ...v,
            links: (v.links ?? "")
              .split("\n")
              .map((s: string) => s.trim())
              .filter(Boolean),
          };
        if (action === "requestChecklist") {
          const lines = (v.items ?? "")
            .split("\n")
            .filter((s: string) => s.trim());
          return {
            ...v,
            items: reconcileChecklist(lines, task.checklist, () =>
              crypto.randomUUID(),
            ),
          };
        }
        return v;
      },
    });
  }
  function toggle(item: Task["checklist"][number]) {
    if (!detail || busy) return;
    setChecklistDraft((old) => {
      const draft =
        old?.taskId === detail.id
          ? old
          : {
              taskId: detail.id,
              version: detail.version,
              checklistVersion: detail.checklistVersion,
              changes: {},
            };
      const changes = { ...draft.changes };
      const previous = changes[item.id];
      const expectedDone = previous?.expectedDone ?? item.done;
      const done = !(previous?.done ?? item.done);
      if (done === expectedDone) delete changes[item.id];
      else changes[item.id] = { expectedDone, done };
      return Object.keys(changes).length ? { ...draft, changes } : null;
    });
  }
  async function submitChecklist() {
    if (!checklistDraft || !checklistDirty || busy) return;
    const draft = checklistDraft;
    setBusy(true);
    try {
      await api(
        `/tasks/${draft.taskId}/actions/toggle`,
        "POST",
        {
          version: draft.version,
          checklistVersion: draft.checklistVersion,
          changes: Object.entries(draft.changes).map(([itemId, change]) => ({
            itemId,
            ...change,
          })),
        },
        crypto.randomUUID(),
      );
      setChecklistDraft(null);
      await refresh();
    } catch (e) {
      setError((e as ApiError).code);
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <main className="login">
        <p>{t("loading")}</p>
      </main>
    );
  if (!me)
    return (
      <main className="login">
        <section>
          <div className="brand">
            <ClipboardList />
            <strong>Open Task</strong>
            {language}
          </div>
          <h1>{t("login")}</h1>
          <form onSubmit={login}>
            <label>
              {t("username")}
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label>
              {t("password")}
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {t(error)}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {t("login")}
            </button>
          </form>
        </section>
      </main>
    );
  const mine = detail?.ownerId === me.id;
  const actionable = detail && !terminal(detail);
  const activeNotices = notices.filter((n) => n.handlerId === me.id);
  const visible = tasks;
  function treeOrder(id: string) {
    const path = [];
    const seen = new Set<string>();
    while (!seen.has(id)) {
      seen.add(id);
      path.unshift(
        String(tasks.find((x) => x.id === id)?.number ?? 0).padStart(10, "0"),
      );
      const r = allRelations.find(
        (r) => r.kind === "parent" && r.sourceId === id,
      );
      if (!r) break;
      id = r.targetId;
    }
    return path.join("/");
  }
  function hiddenByParent(id: string) {
    const seen = new Set<string>();
    while (!seen.has(id)) {
      seen.add(id);
      const parent = allRelations.find(
        (r) => r.kind === "parent" && r.sourceId === id,
      );
      if (!parent) return false;
      if (folded.has(parent.targetId)) return true;
      id = parent.targetId;
    }
    return false;
  }
  function depth(id: string) {
    let n = 0;
    const seen = new Set<string>();
    while (!seen.has(id)) {
      seen.add(id);
      const r = allRelations.find(
        (r) => r.kind === "parent" && r.sourceId === id,
      );
      if (!r) break;
      id = r.targetId;
      n++;
    }
    return n;
  }
  const actionButton = (
    action: string,
    fields: string[] = [],
    extra: Record<string, any> = {},
  ) => (
    <button key={action} onClick={() => openAction(action, fields, extra)}>
      {t(action)}
    </button>
  );
  const timeline = (list: Event[]) =>
    list.length ? (
      list.map((e) => {
        const changes = eventDiff(e.before, e.after);
        return (
          <article
            className="event"
            key={e.id}
            style={{
              borderLeft: `4px solid ${["#7292c7", "#8ba884", "#b49ac8", "#b99b70"][e.taskId.charCodeAt(0) % 4]}`,
              paddingLeft: 10,
            }}
          >
            <small>
              {e.taskTitle ??
                tasks.find((task) => task.id === e.taskId)?.title ??
                t("tasks")}
            </small>
            <button className="event-heading" onClick={() => select(e.taskId)}>
              <Activity size={15} />
              <strong>{t(e.type)}</strong>
              <span>{name(e.actorId)}</span>
            </button>
            <time>{dateText(e.at, lang)}</time>
            {e.note && <p>{e.note}</p>}
            <details>
              <summary>{t("showDiff")}</summary>
              {changes.before === null && changes.after === null ? (
                <p>{t("noFieldChanges")}</p>
              ) : (
                <div className="diff">
                  <section>
                    <b>{t("before")}</b>
                    <Facts
                      value={changes.before}
                      users={users}
                      projects={projects}
                      tasks={tasks}
                    />
                  </section>
                  <section>
                    <b>{t("after")}</b>
                    <Facts
                      value={changes.after}
                      users={users}
                      projects={projects}
                      tasks={tasks}
                    />
                  </section>
                </div>
              )}
            </details>
          </article>
        );
      })
    ) : (
      <p className="empty">{t("empty")}</p>
    );
  const inbox = (
    <div>
      {["mine", ...(leader ? ["following"] : [])].map((group) => (
        <section key={group}>
          <h3>{t(group)}</h3>
          {Object.entries(
            Object.groupBy(
              notices.filter((n) =>
                group === "mine"
                  ? n.handlerId === me.id
                  : n.handlerId !== me.id,
              ),
              (n) => n.taskId,
            ),
          ).map(([id, ns]) => (
            <button className="notice" key={id} onClick={() => select(id)}>
              <ClipboardList size={16} />
              <span>
                <strong>{tasks.find((x) => x.id === id)?.title ?? id}</strong>
                {ns!.map((n) => (
                  <small key={n.reason}>
                    {t(n.reason)} · {name(n.handlerId)} ·{" "}
                    {dateText(n.since, lang)}
                  </small>
                ))}
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
  return (
    <div className="app">
      <header className="top">
        <ClipboardList size={20} />
        <strong>Open Task</strong>
        <span className="workspace-label">{t("tasks")}</span>
        <div className="spacer" />
        {language}
        <button
          title={t("theme")}
          aria-label={t("theme")}
          onClick={() => setTheme((x) => (x === "light" ? "dark" : "light"))}
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button
          className={
            "notification-button " + (activeNotices.length ? "has-pending" : "")
          }
          aria-label={t("inbox")}
          title={
            t("inbox") + ": " + new Set(activeNotices.map((n) => n.taskId)).size
          }
          popoverTarget="notification-popover"
        >
          <Bell size={21} />
          <span className="notification-count">
            {new Set(activeNotices.map((n) => n.taskId)).size}
          </span>
        </button>
        <div
          id="notification-popover"
          popover="auto"
          className="header-popover"
          aria-label={t("inbox")}
        >
          <h3>{t("inbox")}</h3>
          {activeNotices.length === 0 && <p className="muted">{t("empty")}</p>}
          {Object.entries(Object.groupBy(activeNotices, (n) => n.taskId)).map(
            ([id, ns]) => (
              <button
                className="notice"
                key={id}
                onClick={(event) => {
                  event.currentTarget
                    .closest<HTMLElement>("[popover]")
                    ?.hidePopover();
                  setShowDetails(true);
                  select(id);
                }}
              >
                <ClipboardList size={16} />
                <span>
                  <strong>
                    {tasks.find((x) => x.id === id)?.title ??
                      linkedTasks.find((x) => x.id === id)?.title ??
                      id}
                  </strong>
                  {ns!.map((n) => (
                    <small key={n.reason}>
                      {t(n.reason)} · {dateText(n.since, lang)}
                    </small>
                  ))}
                </span>
              </button>
            ),
          )}
          <button
            className="popover-action"
            onClick={(event) => {
              event.currentTarget
                .closest<HTMLElement>("[popover]")
                ?.hidePopover();
              setBottom(true);
              setBottomTab("inbox");
              setMobile("workspace");
            }}
          >
            {t("openInbox")}
          </button>
        </div>
        <button
          className="account-button"
          popoverTarget="account-popover"
          aria-label={t("account")}
        >
          {me.name}
          <ChevronDown size={14} />
        </button>
        <div
          id="account-popover"
          popover="auto"
          className="header-popover account-popover"
          aria-label={t("account")}
        >
          <h3>{me.name}</h3>
          <p>
            {t("username")}: {me.username}
          </p>
          <p>
            {t("roles")}: {me.roles.map((role) => t(role)).join(" · ")}
          </p>
          {["switchUser", "logout"].map((action) => (
            <button
              className="popover-action"
              key={action}
              onClick={async () => {
                try {
                  if (!discardChecklist()) return;
                  await api("/sessions", "DELETE");
                  location.replace(location.pathname);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              <LogOut size={16} />
              {t(action)}
            </button>
          ))}
        </div>
      </header>
      <nav className="mobile-tabs">
        {["tree", "workspace", "details"].map((x) => (
          <button
            className={mobile === x ? "selected" : ""}
            key={x}
            onClick={() => setMobile(x)}
          >
            {t(x === "workspace" ? "graph" : x)}
          </button>
        ))}
      </nav>
      {error && (
        <div className="error" role="alert">
          {t(error)}{" "}
          <button onClick={() => void refresh()}>{t("readLatest")}</button>
        </div>
      )}
      <div className="body-row">
        <nav className="activity-rail" aria-label={t("workspaceNavigation")}>
          <button
            aria-label={t("toggleTree")}
            aria-pressed={showTree}
            onClick={() => setShowTree((x) => !x)}
          >
            <ListTree size={20} />
          </button>
          <button
            aria-label={t("openGraph")}
            onClick={() => chooseTab("graph")}
          >
            <GitGraph size={20} />
          </button>
          <button
            aria-label={t("openUpdates")}
            onClick={() => chooseTab("updates")}
          >
            <Activity size={20} />
          </button>
          <button
            aria-label={t("openInbox")}
            onClick={() => {
              setBottom(true);
              setBottomTab("inbox");
            }}
          >
            <Bell size={20} />
          </button>
          <div className="spacer" />
          <button
            aria-label={t("toggleDetails")}
            aria-pressed={showDetails}
            onClick={() => setShowDetails((x) => !x)}
          >
            <ClipboardList size={20} />
          </button>
        </nav>
        <div
          ref={layoutRef}
          className="layout"
          style={{
            gridTemplateColumns: `${leftWidth}px ${showTree ? 7 : 0}px minmax(0,1fr) ${showDetails ? 7 : 0}px ${rightWidth}px`,
          }}
          data-mobile={mobile}
          data-tree-hidden={!showTree}
          data-details-hidden={!showDetails}
        >
          <aside className="tree panel">
            <header>
              <ListTree size={16} />
              <b>{t("tree")}</b>
              <div className="spacer" />
              <button aria-label={t("refresh")} onClick={() => void refresh()}>
                <RefreshCw size={15} />
              </button>
              <button
                aria-label={t("collapse")}
                onClick={() => {
                  setCollapsed((x) => !x);
                  setFoldedProjects(new Set());
                }}
              >
                <ChevronDown size={15} />
              </button>
            </header>
            <div className="tree-tools">
              <button
                onClick={() =>
                  setForm({
                    title: "newTask",
                    path: "/tasks",
                    values: {
                      ...emptyTerms,
                      projectId: selectedProject ?? (project || null),
                    },
                    fields: termFields,
                  })
                }
              >
                <Plus size={15} />
                {t("newTask")}
              </button>
              {leader && (
                <button
                  onClick={() =>
                    setForm({
                      title: "newProject",
                      path: "/projects",
                      values: {
                        name: "",
                        managerId: "",
                        memberIds: [],
                        color: "#7292c7",
                      },
                      fields: ["name", "managerId", "memberIds", "color"],
                    })
                  }
                >
                  <Folder size={15} />
                  {t("newProject")}
                </button>
              )}
            </div>
            <div className="filters">
              <input
                aria-label={t("search")}
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label={t("projectId")}
                value={project}
                onChange={(e) => {
                  setProject(e.target.value);
                  setSelectedProject(null);
                }}
              >
                <option value="">{t("allProjects")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="tree-scroll">
              {[
                ...projects,
                {
                  id: "",
                  name: t("temporary"),
                  managerId: "",
                  memberIds: [],
                  color: "#7292c7",
                },
              ]
                .filter((p) => !project || p.id === project)
                .map((p) => (
                  <section
                    key={p.id}
                    className="project-group"
                    style={
                      {
                        "--project-color": p.color ?? "#7292c7",
                      } as CSSProperties
                    }
                  >
                    <button
                      className="project-heading"
                      aria-haspopup={
                        p.id && (leader || p.managerId === me.id)
                          ? "menu"
                          : undefined
                      }
                      onContextMenu={(e) => {
                        if (!p.id || !(leader || p.managerId === me.id)) return;
                        e.preventDefault();
                        setProjectMenu({
                          project: p,
                          x: e.clientX,
                          y: e.clientY,
                          trigger: e.currentTarget,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (
                          (e.key === "ContextMenu" ||
                            (e.shiftKey && e.key === "F10")) &&
                          p.id &&
                          (leader || p.managerId === me.id)
                        ) {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setProjectMenu({
                            project: p,
                            x: rect.left,
                            y: rect.bottom,
                            trigger: e.currentTarget,
                          });
                        }
                      }}
                      aria-expanded={!collapsed && !foldedProjects.has(p.id)}
                      aria-pressed={selectedProject === p.id}
                      onClick={() => {
                        if (collapsed) {
                          setCollapsed(false);
                          setFoldedProjects(
                            new Set(
                              [
                                ...projects.map((project) => project.id),
                                "",
                              ].filter((id) => id !== p.id),
                            ),
                          );
                        } else
                          setFoldedProjects((old) => {
                            const next = new Set(old);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          });
                        if (!discardChecklist()) return;
                        setSelectedProject(p.id);
                        setSelected("");
                        setDetail(null);
                        setRelations([]);
                        setTaskEvents([]);
                        history.replaceState(null, "", location.pathname);
                        setMobile("tree");
                      }}
                    >
                      <ChevronDown size={13} className="project-chevron" />
                      <Folder size={17} />
                      <strong>{p.name}</strong>
                    </button>
                    <small className="project-facts" title={t("projectFacts")}>
                      {t("projectFacts")}:{" "}
                      {
                        visible.filter(
                          (x) =>
                            (x.projectId ?? "") === p.id && x.stage === "done",
                        ).length
                      }{" "}
                      /{" "}
                      {
                        visible.filter(
                          (x) =>
                            (x.projectId ?? "") === p.id &&
                            x.stage === "reviewing",
                        ).length
                      }{" "}
                      /{" "}
                      {
                        visible.filter(
                          (x) =>
                            (x.projectId ?? "") === p.id &&
                            x.blocks.some((b) => !b.resolved),
                        ).length
                      }
                    </small>
                    {!collapsed &&
                      !foldedProjects.has(p.id) &&
                      visible
                        .filter(
                          (x) =>
                            (x.projectId ?? "") === p.id &&
                            !hiddenByParent(x.id),
                        )
                        .sort((a, b) =>
                          treeOrder(a.id).localeCompare(treeOrder(b.id)),
                        )
                        .map((x) => (
                          <div
                            key={x.id}
                            className="tree-item"
                            data-depth={depth(x.id)}
                            style={{ paddingLeft: depth(x.id) * 22 }}
                          >
                            {allRelations.some(
                              (r) => r.kind === "parent" && r.targetId === x.id,
                            ) ? (
                              <button
                                className="tree-fold"
                                aria-label={t("collapse") + " " + x.title}
                                aria-expanded={!folded.has(x.id)}
                                onClick={() =>
                                  setFolded((old) => {
                                    const next = new Set(old);
                                    if (next.has(x.id)) next.delete(x.id);
                                    else next.add(x.id);
                                    return next;
                                  })
                                }
                              >
                                {folded.has(x.id) ? "›" : "⌄"}
                              </button>
                            ) : (
                              <span className="tree-fold-space" />
                            )}
                            <button
                              className={
                                "task-row " +
                                (selected === x.id ? "selected" : "")
                              }
                              onClick={() => select(x.id)}
                            >
                              <TaskIcon size={16} />
                              <span>
                                <strong>{x.title}</strong>
                                <small>
                                  OT-{x.number} · {t(x.stage)}
                                  {x.blocks.some((b) => !b.resolved)
                                    ? " · " + t("blocked")
                                    : ""}
                                </small>
                              </span>
                            </button>
                          </div>
                        ))}
                    {p.id && (leader || p.managerId === me.id) && (
                      <button
                        className="subtle"
                        onClick={() =>
                          setForm({
                            title: "manageProject",
                            path: "/projects/" + p.id,
                            method: "PATCH",
                            values: {
                              memberIds: p.memberIds,
                              managerId: p.managerId,
                              color: p.color ?? "#7292c7",
                            },
                            fields: leader
                              ? ["managerId", "memberIds", "color"]
                              : ["memberIds", "color"],
                          })
                        }
                      >
                        {t("manageProject")}
                      </button>
                    )}
                  </section>
                ))}
              {taskCursor && (
                <button onClick={() => void loadMoreTasks()}>
                  {t("loadMore")}
                </button>
              )}
            </div>
            {me.roles.includes("admin") && (
              <button
                onClick={() => {
                  chooseTab("accounts");
                  setMobile("workspace");
                }}
              >
                <Settings size={15} />
                {t("accounts")}
              </button>
            )}
          </aside>
          <Resize
            name={t("tree")}
            value={leftWidth}
            onChange={(n) => {
              setLeftWidth(n);
              if (showDetails)
                setRightWidth(Math.min(rightWidth, panelBudget - n));
            }}
            min={0}
            max={panelBudget}
          />
          <main className="center">
            <section className="panel workspace">
              <header>
                <button
                  className={tab === "graph" ? "selected" : ""}
                  onClick={() => chooseTab("graph")}
                >
                  <GitGraph size={16} />
                  {t("graph")}
                </button>
                <button
                  className={tab === "updates" ? "selected" : ""}
                  onClick={() => chooseTab("updates")}
                >
                  <Activity size={16} />
                  {t("updates")}
                </button>
                <div className="spacer" />
                <button
                  aria-label={t("bottom")}
                  onClick={() => setBottom((x) => !x)}
                >
                  <PanelBottom size={17} />
                </button>
              </header>
              <div className="graph-host" hidden={tab !== "graph"}>
                <Graph
                  key={project + "|" + search}
                  tasks={visible}
                  relations={allRelations}
                  selected={selected}
                  onSelect={(id) => {
                    setShowDetails(true);
                    select(id);
                  }}
                />
              </div>
              {tab === "graph" ? null : tab === "accounts" ? (
                <div className="scroll">
                  <button
                    onClick={() =>
                      setForm({
                        title: "accounts",
                        path: "/users",
                        values: {
                          username: "",
                          name: "",
                          password: "",
                          roles: ["member"],
                        },
                        fields: ["username", "name", "password", "roles"],
                      })
                    }
                  >
                    {t("accounts")} +
                  </button>
                  {users.map((u) => (
                    <article key={u.id}>
                      <b>{u.name}</b> · {u.username} ·{" "}
                      {u.roles.map(t).join(", ")}{" "}
                      <button
                        onClick={() =>
                          setForm({
                            title: u.active ? "disable" : "enable",
                            path: "/users/" + u.id,
                            method: "PATCH",
                            values: { active: !u.active },
                            fields: [],
                          })
                        }
                      >
                        {t(u.active ? "disable" : "enable")}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="scroll">
                  <select
                    aria-label={t("author")}
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                  >
                    <option value="">{t("author")}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  {timeline(events)}
                  {eventCursor && (
                    <button
                      onClick={async () => {
                        const r = await api(
                          "/events?cursor=" +
                            eventCursor +
                            (project ? "&projectId=" + project : "") +
                            (actor ? "&actorId=" + actor : "") +
                            "&search=" +
                            encodeURIComponent(search),
                        );
                        setEvents((x) => [...x, ...r.items]);
                        setEventCursor(r.nextCursor);
                      }}
                    >
                      {t("loadMore")}
                    </button>
                  )}
                </div>
              )}
            </section>
            {bottom && (
              <>
                <Resize
                  horizontal
                  name={t("inbox")}
                  value={bottomHeight}
                  onChange={setBottomHeight}
                  min={0}
                  max={bottomBudget}
                  reverse
                />
                <section
                  style={{ height: bottomHeight }}
                  className="panel bottom"
                >
                  <header>
                    {["inbox", "history", "relations"].map((x) => (
                      <button
                        key={x}
                        className={bottomTab === x ? "selected" : ""}
                        onClick={() => setBottomTab(x)}
                      >
                        {t(x)}
                      </button>
                    ))}
                    <div className="spacer" />
                    <button
                      aria-label={t("close")}
                      onClick={() => setBottom(false)}
                    >
                      ×
                    </button>
                  </header>
                  <div className="scroll">
                    {bottomTab === "inbox" ? (
                      inbox
                    ) : bottomTab === "history" ? (
                      <>
                        {timeline(taskEvents)}
                        {taskEventCursor && (
                          <button onClick={loadTaskHistory}>
                            {t("loadMore")}
                          </button>
                        )}
                      </>
                    ) : (
                      relations.map((r) => (
                        <p key={r.id}>
                          {t(r.kind)}{" "}
                          <button
                            onClick={() =>
                              select(
                                r.sourceId === selected
                                  ? r.targetId
                                  : r.sourceId,
                              )
                            }
                          >
                            {tasks.find(
                              (x) =>
                                x.id ===
                                (r.sourceId === selected
                                  ? r.targetId
                                  : r.sourceId),
                            )?.title ?? r.targetId}
                          </button>
                        </p>
                      ))
                    )}
                  </div>
                </section>
              </>
            )}
          </main>
          <Resize
            name={t("details")}
            value={rightWidth}
            onChange={(n) => {
              setRightWidth(n);
              if (showTree) setLeftWidth(Math.min(leftWidth, panelBudget - n));
            }}
            min={0}
            max={panelBudget}
            reverse
          />
          <aside className="panel details">
            <header>
              <TaskIcon size={16} />
              <b>{selectedProject !== null ? t("project") : t("details")}</b>
            </header>
            {detail ? (
              <div className="detail-scroll">
                <div className="task-meta">
                  OT-{detail.number} · {t("version")} {detail.version}
                  <span className={"status " + detail.stage}>
                    {t(detail.stage)}
                  </span>
                </div>
                <p className="muted detail-breadcrumb">
                  <Folder size={14} />{" "}
                  {projects.find((p) => p.id === detail.projectId)?.name ??
                    t("temporary")}
                </p>
                <h1>{detail.title}</h1>
                {notices.some((n) => n.taskId === detail.id) && (
                  <section className="warning detail-attention">
                    {notices
                      .filter((n) => n.taskId === detail.id)
                      .map((n) => (
                        <p key={n.reason}>
                          {t(n.reason)} · {name(n.handlerId)}
                        </p>
                      ))}
                  </section>
                )}
                <dl className="task-people">
                  <div className="meta-primary">
                    <dt>{t("ownerId")}</dt>
                    <dd>{name(detail.ownerId)}</dd>
                  </div>
                  <div>
                    <dt>{t("reviewerId")}</dt>
                    <dd>{name(detail.reviewerId)}</dd>
                  </div>
                  <div className="meta-waiting">
                    <dt>{t("waiting")}</dt>
                    <dd>
                      {[
                        ...new Set(
                          notices
                            .filter((n) => n.taskId === detail.id)
                            .map((n) => n.handlerId),
                        ),
                      ]
                        .map(name)
                        .join(" · ") ||
                        (detail.stage === "approval"
                          ? name(detail.approvalIds[detail.approvalIndex])
                          : detail.stage === "reviewing"
                            ? name(detail.reviewerId)
                            : !terminal(detail) && detail.stage !== "draft"
                              ? name(detail.ownerId)
                              : "—")}
                    </dd>
                  </div>
                </dl>
                <dl className="task-dates">
                  {[
                    "deadline",
                    "acceptBy",
                    "feedbackBy",
                    "reviewBy",
                    ...(detail.confirmBy ? ["confirmBy"] : []),
                  ].map((k) => (
                    <div
                      className={k === "deadline" ? "meta-deadline" : ""}
                      key={k}
                    >
                      <dt>{t(k)}</dt>
                      <dd>
                        {dateText(detail[k as keyof Task] as string, lang)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="muted">{t("timezone")}</p>
                <nav className="detail-tabs" aria-label={t("details")}>
                  <button
                    aria-pressed={detailTab === "overview"}
                    onClick={() => setDetailTab("overview")}
                  >
                    <ClipboardList size={15} />
                    {t("taskContent")}
                  </button>
                  <button
                    aria-pressed={detailTab === "activity"}
                    onClick={() => setDetailTab("activity")}
                  >
                    <Activity size={15} />
                    {t("history")}
                  </button>
                </nav>
                <div hidden={detailTab !== "overview"}>
                  <section
                    className="detail-section checklist-card"
                    style={
                      {
                        "--check-color":
                          projects.find((p) => p.id === detail.projectId)
                            ?.color ?? "#7292c7",
                      } as CSSProperties
                    }
                  >
                    <h3>
                      <ClipboardList size={16} /> {t("checklist")}{" "}
                      <small>
                        {detail.checklist.length
                          ? `${detail.checklist.filter((x) => x.done).length} / ${detail.checklist.length} · ${Math.round((detail.checklist.filter((x) => x.done).length / detail.checklist.length) * 100)}%`
                          : t("noChecklist")}
                      </small>
                    </h3>
                    {detail.checklist.length > 0 && (
                      <progress
                        aria-label={t("checklist")}
                        max={detail.checklist.length}
                        value={detail.checklist.filter((i) => i.done).length}
                      />
                    )}
                    {detail.checklist.map((i) => (
                      <label className="check" key={i.id}>
                        <input
                          type="checkbox"
                          checked={
                            checklistDraft?.taskId === detail.id
                              ? (checklistDraft.changes[i.id]?.done ?? i.done)
                              : i.done
                          }
                          disabled={!mine || !actionable || busy}
                          onChange={() => toggle(i)}
                        />
                        {i.text}
                      </label>
                    ))}
                    {mine && actionable && detail.checklist.length > 0 && (
                      <div>
                        <button
                          className="primary"
                          disabled={!checklistDirty || busy}
                          onClick={() => void submitChecklist()}
                        >
                          {t("submitChecklist")}
                        </button>
                        {checklistDirty && (
                          <p className="muted" role="status">
                            {t("checklistUnsaved")}
                          </p>
                        )}
                      </div>
                    )}
                    {mine &&
                      actionable &&
                      actionButton(
                        "requestChecklist",
                        ["items", "scopeChanged", "reason"],
                        {
                          items: detail.checklist.map((x) => x.text).join("\n"),
                          scopeChanged: false,
                        },
                      )}
                    <p className="muted">{t("checklistReviewHint")}</p>
                    {detail.checklistRequests.map((r) => (
                      <article key={r.id}>
                        <b>
                          {t("proposed")} · {t(r.status)}
                        </b>
                        <p>{r.items.map((x) => x.text).join(" · ")}</p>
                        <p>{r.reason}</p>
                        {leader && r.status === "pending" && (
                          <div className="actions">
                            {actionButton(
                              "approveChecklist",
                              r.scopeChanged ? ["confirmBy"] : [],
                              { requestId: r.id },
                            )}
                            {actionButton("rejectChecklist", ["reason"], {
                              requestId: r.id,
                            })}
                          </div>
                        )}
                      </article>
                    ))}
                  </section>
                  <section className="detail-section outcome-card">
                    <h3>
                      {t("outcome")} · {t("criteria")}
                    </h3>
                    {["outcome", "criteria", "scope"].map((k) => (
                      <div className="outcome-field" key={k}>
                        <h4>{t(k)}</h4>
                        <Markdown text={detail[k as keyof Task] as string} />
                      </div>
                    ))}
                  </section>
                  {detail.latestProgress && (
                    <section className="detail-section">
                      <h3>{t("progress")}</h3>
                      <p>{detail.latestProgress.text}</p>
                      <h3>{t("next")}</h3>
                      <p>{detail.latestProgress.next}</p>
                      <small>{dateText(detail.latestProgress.at, lang)}</small>
                    </section>
                  )}
                  {detail.confirmedVersion !== null &&
                    detail.confirmedVersion !== detail.version && (
                      <section className="warning">
                        <h3>{t("confirm")}</h3>
                        <details open>
                          <summary>{t("versions")}</summary>
                          <div className="diff">
                            <Facts
                              value={detail.confirmedTerms}
                              users={users}
                              projects={projects}
                              tasks={tasks}
                            />
                            <Facts
                              value={detail}
                              users={users}
                              projects={projects}
                              tasks={tasks}
                            />
                          </div>
                        </details>
                      </section>
                    )}
                  <section className="detail-section context-card">
                    <h3>{t("taskContext")}</h3>
                    <nav className="context-tabs" aria-label={t("taskContext")}>
                      {["relations", "blocks", "submissions"].map((key) => (
                        <button
                          key={key}
                          aria-pressed={contextTab === key}
                          onClick={() => setContextTab(key)}
                        >
                          {t(key)}{" "}
                          <span>
                            {key === "relations"
                              ? relations.length
                              : key === "blocks"
                                ? detail.blocks.length
                                : detail.submissions.length}
                          </span>
                        </button>
                      ))}
                    </nav>
                    <div hidden={contextTab !== "relations"}>
                      {!relations.length && (
                        <p className="empty">{t("noRelations")}</p>
                      )}
                      {(leader ||
                        (detail.stage === "draft" &&
                          detail.creatorId === me.id)) && (
                        <button
                          onClick={() =>
                            setForm({
                              title: "addRelation",
                              path: `/tasks/${detail.id}/relations`,
                              values: {
                                version: detail.version,
                                targetId: "",
                                kind: "related",
                                reason: "",
                              },
                              fields: ["targetId", "kind", "reason"],
                            })
                          }
                        >
                          {t("addRelation")}
                        </button>
                      )}
                      {relations.map((r) => {
                        const other = linkedTasks.find(
                          (x) =>
                            x.id ===
                            (r.sourceId === detail.id
                              ? r.targetId
                              : r.sourceId),
                        );
                        return (
                          <p key={r.id}>
                            {t(r.kind)} ·{" "}
                            <button
                              onClick={() => select(other?.id ?? r.targetId)}
                            >
                              {other?.title ?? r.targetId}
                            </button>{" "}
                            · {t(other?.stage ?? "empty")}
                            {(leader ||
                              (detail.stage === "draft" &&
                                detail.creatorId === me.id)) && (
                              <button
                                onClick={() =>
                                  setForm({
                                    title: "removeRelation",
                                    path: `/tasks/${detail.id}/relations`,
                                    values: {
                                      version: detail.version,
                                      targetId:
                                        r.sourceId === detail.id
                                          ? r.targetId
                                          : r.sourceId,
                                      kind: r.kind,
                                      reason: "",
                                      remove: true,
                                    },
                                    fields: ["reason"],
                                  })
                                }
                              >
                                {t("remove")}
                              </button>
                            )}
                          </p>
                        );
                      })}
                      {relations.some(
                        (r) =>
                          r.kind === "dependency" &&
                          r.sourceId === detail.id &&
                          linkedTasks.find((x) => x.id === r.targetId)
                            ?.stage !== "done",
                      ) && <p className="warning">{t("prerequisites")}</p>}
                      {relations.some(
                        (r) =>
                          r.kind === "parent" &&
                          r.targetId === detail.id &&
                          linkedTasks.find((x) => x.id === r.sourceId)
                            ?.stage !== "done",
                      ) && <p className="warning">{t("incompleteChildren")}</p>}
                    </div>
                    <div hidden={contextTab !== "blocks"}>
                      {!detail.blocks.length && (
                        <p className="empty">{t("noBlocks")}</p>
                      )}
                      {detail.blocks.map((b) => (
                        <article key={b.id}>
                          <b>{b.reason}</b>
                          <p>
                            {b.help} · {name(b.helperId)} ·{" "}
                            {b.resolved ? "✓" : t("blocked")}
                          </p>
                          {b.replies.map((r, i) => (
                            <p key={i}>
                              {name(r.authorId)}: {r.text}
                            </p>
                          ))}
                          {!b.resolved && actionable && (
                            <div className="actions">
                              {b.helperId === me.id &&
                                actionButton("replyBlock", ["text"], {
                                  blockId: b.id,
                                })}
                              {mine &&
                                actionButton("resolveBlock", ["reason"], {
                                  blockId: b.id,
                                })}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                    <div hidden={contextTab !== "submissions"}>
                      {!detail.submissions.length && (
                        <p className="empty">{t("noSubmissions")}</p>
                      )}
                      {detail.submissions.map((s) => (
                        <article key={s.id}>
                          <small>
                            {t("version")} {s.version} · {t(s.status)}
                          </small>
                          <p>{s.text}</p>
                          {s.links.map((l) => (
                            <p key={l}>
                              <a href={l} target="_blank" rel="noreferrer">
                                {l}
                              </a>
                            </p>
                          ))}
                          {s.reason && <p>{s.reason}</p>}
                        </article>
                      ))}
                    </div>
                  </section>
                  {!!detail.adjustmentRequests?.length && (
                    <section className="detail-section">
                      {detail.adjustmentRequests?.map((r) => (
                        <article key={r.id}>
                          <b>
                            {t("requestAdjustment")} · {t(r.status)}
                          </b>
                          <p>
                            {name(r.authorId)}: {r.reason}
                          </p>
                          {leader &&
                            r.status === "pending" &&
                            actionButton("resolveAdjustment", ["reason"], {
                              requestId: r.id,
                            })}
                        </article>
                      ))}
                    </section>
                  )}
                  {actionable && (
                    <section className="actions">
                      {["draft", "approvalReturned"].includes(detail.stage) &&
                        detail.creatorId === me.id && (
                          <>
                            {actionButton("edit", termFields)}
                            {detail.stage === "draft" && (
                              <button
                                onClick={() =>
                                  setForm({
                                    title: "deleteDraft",
                                    path: "/tasks/" + detail.id,
                                    method: "DELETE",
                                    values: {},
                                    fields: [],
                                  })
                                }
                              >
                                {t("deleteDraft")}
                              </button>
                            )}
                            {actionButton(leader ? "issue" : "submitApproval")}
                          </>
                        )}
                      {detail.stage === "approval" &&
                        detail.approvalIds[detail.approvalIndex] === me.id && (
                          <>
                            {actionButton("approve")}
                            {actionButton("returnApproval", ["reason"])}
                          </>
                        )}
                      {mine &&
                        detail.stage === "pending" &&
                        !detail.refused && (
                          <>
                            {actionButton("accept")}
                            {actionButton("acceptStart")}
                            {actionButton("refuse", ["reason"])}
                          </>
                        )}
                      {mine &&
                        detail.stage === "accepted" &&
                        actionButton("start")}
                      {mine &&
                        ["accepted", "working"].includes(detail.stage) && (
                          <>
                            {actionButton("progress", [
                              "text",
                              "next",
                              "feedbackBy",
                            ])}
                            {detail.confirmedVersion !== detail.version &&
                              actionButton("confirm")}
                          </>
                        )}
                      {mine &&
                        detail.stage === "working" &&
                        actionButton("submitResult", [
                          "text",
                          "links",
                          "reviewBy",
                        ])}
                      {detail.stage === "reviewing" &&
                        detail.reviewerId === me.id && (
                          <>
                            {actionButton("pass", ["reason"], {
                              submissionId: detail.submissions.at(-1)?.id,
                            })}
                            {actionButton(
                              "returnResult",
                              ["reason", "feedbackBy"],
                              { submissionId: detail.submissions.at(-1)?.id },
                            )}
                          </>
                        )}
                      {actionButton("comment", ["text"])}
                      {["pending", "accepted", "working", "reviewing"].includes(
                        detail.stage,
                      ) &&
                        !leader &&
                        actionButton("requestAdjustment", ["reason"])}
                      {["pending", "accepted", "working", "reviewing"].includes(
                        detail.stage,
                      ) &&
                        actionButton("block", ["reason", "help", "helperId"])}
                      {leader &&
                        [
                          "pending",
                          "accepted",
                          "working",
                          "reviewing",
                        ].includes(detail.stage) &&
                        actionButton("adjust", [
                          ...termFields,
                          "reviewBy",
                          "confirmBy",
                          "reason",
                        ])}
                      {leader &&
                        actionButton("title", ["title"], {
                          title: detail.title,
                        })}
                      {leader && actionButton("cancel", ["reason"])}
                    </section>
                  )}
                </div>
                <section
                  className="detail-section"
                  hidden={detailTab !== "activity"}
                >
                  <h3>{t("history")}</h3>
                  {timeline(taskEvents)}
                  {taskEventCursor && (
                    <button onClick={loadTaskHistory}>{t("loadMore")}</button>
                  )}
                </section>
              </div>
            ) : selectedProject !== null ? (
              <div className="detail-scroll project-summary">
                <h1>
                  {projects.find((p) => p.id === selectedProject)?.name ??
                    t("temporary")}
                </h1>
                <p>{t("projectSelectedHint")}</p>
                <dl>
                  <dt>{t("managerId")}</dt>
                  <dd>
                    {name(
                      projects.find((p) => p.id === selectedProject)
                        ?.managerId ?? "",
                    )}
                  </dd>
                </dl>
              </div>
            ) : (
              <p className="empty">{t("selectTask")}</p>
            )}
          </aside>
        </div>
      </div>
      <footer className="statusbar">
        <span>{t("timezone")}</span>
        <span>
          {tasks.length} · {t("countsOnly")}
        </span>
      </footer>
      {projectMenu && (
        <ProjectMenu
          target={projectMenu}
          onClose={() => setProjectMenu(null)}
          onColor={() =>
            setForm({
              title: "color",
              path: "/projects/" + projectMenu.project.id,
              method: "PATCH",
              values: {
                color:
                  projects.find((p) => p.id === projectMenu.project.id)
                    ?.color ?? projectMenu.project.color,
              },
              fields: ["color"],
            })
          }
        />
      )}
      {form && (
        <TaskForm
          key={form.path + form.title}
          spec={form}
          users={users}
          projects={projects}
          onClose={() => {
            if (form?.method === "DELETE") {
              setSelected("");
              setDetail(null);
              setError("");
              history.replaceState(null, "", location.pathname);
            }
            setForm(null);
          }}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
function Facts({
  value,
  users,
  projects,
  tasks,
}: {
  value: unknown;
  users: User[];
  projects: Project[];
  tasks: Task[];
}) {
  const { t, lang } = useI18n();
  const refs = [
    ...users,
    ...projects,
    ...tasks.map((task) => ({
      id: task.id,
      name: `OT-${task.number} · ${task.title}`,
    })),
  ];
  function render(v: unknown, key = ""): React.ReactNode {
    if (v === null || v === undefined || v === "") return <span>—</span>;
    if (Array.isArray(v))
      return v.length ? (
        <div>
          {v.map((item, index) => (
            <div className="fact-item" key={index}>
              {render(item, key)}
            </div>
          ))}
        </div>
      ) : (
        <span>—</span>
      );
    if (typeof v === "object")
      return (
        <div>
          {Object.entries(v)
            .filter(([k]) => k !== "id")
            .map(([k, item]) => (
              <section className="fact-field" key={k}>
                <small>{t(k)}</small>
                {render(item, k)}
              </section>
            ))}
        </div>
      );
    if (typeof v === "boolean") return <span>{v ? "☑" : "☐"}</span>;
    if (typeof v === "string") {
      if (
        /^(deadline|acceptBy|feedbackBy|reviewBy|confirmBy|at|createdAt|lastFeedbackAt)$/.test(
          key,
        )
      )
        return <span>{dateText(v, lang)}</span>;
      if (key.endsWith("Id") || key.endsWith("Ids"))
        return <span>{refs.find((x) => x.id === v)?.name ?? v}</span>;
      if (["stage", "kind", "status"].includes(key)) return <span>{t(v)}</span>;
      return <Markdown text={v} />;
    }
    return <span>{String(v)}</span>;
  }
  return <div className="facts">{render(value)}</div>;
}

function Resize({
  name,
  value,
  onChange,
  min,
  max,
  horizontal = false,
  reverse = false,
}: {
  name: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  horizontal?: boolean;
  reverse?: boolean;
}) {
  const start = useRef<{ p: number; v: number } | null>(null);
  const change = (delta: number) =>
    onChange(Math.max(min, Math.min(max, delta)));
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={name}
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className={"resize " + (horizontal ? "horizontal" : "")}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { p: horizontal ? e.clientY : e.clientX, v: value };
      }}
      onPointerMove={(e) => {
        if (start.current)
          change(
            start.current.v +
              ((horizontal ? e.clientY : e.clientX) - start.current.p) *
                (reverse ? -1 : 1),
          );
      }}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      onLostPointerCapture={() => (start.current = null)}
      onKeyDown={(e) => {
        if (
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
        ) {
          e.preventDefault();
          change(
            value +
              (["ArrowRight", "ArrowDown"].includes(e.key) ? 10 : -10) *
                (reverse ? -1 : 1),
          );
        }
      }}
    />
  );
}
