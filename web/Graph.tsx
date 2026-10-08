import { useEffect, useRef, useState, useId } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import {
  radialBranches,
  labelCollision,
  edgeEndpoints,
} from "../shared/graphLayout.js";
import type { Task, Relation } from "../shared/model.js";
import "./graph-status.css";
import { TaskIcon } from "./TaskIcon.js";
import { lifecycleState, lifecycleStates } from "../shared/commitment.js";
import { useI18n } from "./i18n.js";
type Node = SimulationNodeDatum & {
  id: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
};
export function Graph({
  tasks,
  relations,
  selected,
  onSelect,
}: {
  tasks: Task[];
  relations: Relation[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const graphId = useId();
  const arrowId = graphId + "-arrow";
  const clipId = graphId + "-label";
  const extent = { left: 100, right: 115, top: 45, bottom: 60 };
  const [nodes, setNodes] = useState<Node[]>([]),
    [view, setView] = useState({ x: 0, y: 0, zoom: 1 }),
    [focused, setFocused] = useState(false),
    [reset, setReset] = useState(0);
  const simulation = useRef<Simulation<Node, undefined> | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  const reduced = useRef(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const drag = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    vx: number;
    vy: number;
  } | null>(null);
  const pan = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(700);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) setCanvasWidth(Math.max(420, Math.round(width)));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const topology =
    tasks.map((t) => t.id).join(",") +
    "|" +
    relations.map((r) => r.id).join(",");
  useEffect(() => {
    const previous = new Map(
      simulation.current?.nodes().map((n) => [n.id, n]) ?? [],
    );
    // A narrower project/filter must not inherit off-screen coordinates from
    // the larger workspace. Preserve positions when adding pages or resizing.
    if (
      [...previous.keys()].some((id) => !tasks.some((task) => task.id === id))
    )
      previous.clear();
    simulation.current?.stop();
    const seeded = radialBranches(tasks, relations);
    const next: Node[] = seeded.map((seed) => {
      const old = previous.get(seed.id);
      const x = old?.x ?? seed.x,
        y = old?.y ?? seed.y;
      return {
        id: seed.id,
        x,
        y,
        anchorX: old?.anchorX ?? seed.x,
        anchorY: old?.anchorY ?? seed.y,
      };
    });
    const ids = new Set(next.map((n) => n.id));
    const links = relations
      .filter((r) => ids.has(r.sourceId) && ids.has(r.targetId))
      .map((r) => ({ source: r.sourceId, target: r.targetId, kind: r.kind }));
    const sim = forceSimulation(next)
      .force(
        "links",
        forceLink<Node, any>(links)
          .id((n) => n.id)
          .distance(235)
          .strength(0.06),
      )
      .force("charge", forceManyBody<Node>().strength(-100).distanceMax(400))
      .force("collision", labelCollision<Node>())
      .force("x", forceX<Node>((n) => n.anchorX).strength(0.08))
      .force("y", forceY<Node>((n) => n.anchorY).strength(0.08))
      .velocityDecay(0.36)
      .alphaDecay(0.055)
      .alphaMin(0.002)
      .stop();
    const publish = () => setNodes([...next]);
    // Settle the initial layout before painting; only user interaction starts motion.
    if (!next.some((n) => previous.has(n.id))) {
      sim.tick(200);
      const el = container.current;
      if (el && next.length) {
        const left = Math.min(...next.map((n) => n.x - extent.left)),
          right = Math.max(...next.map((n) => n.x + extent.right));
        const top = Math.min(...next.map((n) => n.y - extent.top)),
          bottom = Math.max(...next.map((n) => n.y + extent.bottom));
        const zoom = Math.max(
          0.001,
          Math.min(
            1,
            (el.clientWidth - 40) / (right - left),
            (el.clientHeight - 40) / (bottom - top),
          ),
        );
        setView({
          zoom,
          x: (el.clientWidth - (left + right) * zoom) / 2,
          y: (el.clientHeight - (top + bottom) * zoom) / 2,
        });
      }
    }
    publish();
    sim.on("tick", publish);
    simulation.current = sim;
    return () => {
      sim.stop();
    };
  }, [topology, reset, canvasWidth]);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const viewTasks =
    focused && selected
      ? tasks.filter(
          (task) =>
            task.id === selected ||
            relations.some(
              (r) =>
                (r.sourceId === selected && r.targetId === task.id) ||
                (r.targetId === selected && r.sourceId === task.id),
            ),
        )
      : tasks;
  const viewIds = new Set(viewTasks.map((t) => t.id));
  const point = (clientX: number, clientY: number) => {
    const p = new DOMPoint(clientX, clientY);
    return p.matrixTransform(world.current!.getScreenCTM()!.inverse());
  };
  const release = () => {
    if (drag.current) {
      const n = byId.get(drag.current.id);
      if (n) {
        n.fx = null;
        n.fy = null;
        n.anchorX = n.x;
        n.anchorY = n.y;
        n.vx = Math.max(-6, Math.min(6, drag.current.vx * 0.18));
        n.vy = Math.max(-6, Math.min(6, drag.current.vy * 0.18));
      }
      simulation.current?.alphaTarget(0);
      if (reduced.current) simulation.current?.stop();
      else simulation.current?.alpha(0.24).restart();
    }
    drag.current = null;
    pan.current = null;
  };
  const zoomAt = (factor: number, x: number, y: number) => {
    setView((v) => {
      const zoom = Math.max(0.001, Math.min(4, v.zoom * factor));
      return {
        x: x - ((x - v.x) * zoom) / v.zoom,
        y: y - ((y - v.y) * zoom) / v.zoom,
        zoom,
      };
    });
  };
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const delta =
        e.deltaY *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
      zoomAt(
        Math.exp(-delta * 0.0015),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const centerZoom = (factor: number) =>
    zoomAt(
      factor,
      (container.current?.clientWidth ?? 700) / 2,
      (container.current?.clientHeight ?? 600) / 2,
    );
  const locate = () => {
    const n = byId.get(selected),
      el = container.current;
    if (n && el)
      setView((v) => ({
        ...v,
        x: el.clientWidth / 2 - n.x * v.zoom,
        y: el.clientHeight / 2 - n.y * v.zoom,
      }));
  };
  const fit = () => {
    const visible = nodes.filter((n) => viewIds.has(n.id)),
      el = container.current;
    if (!visible.length || !el) return;
    const left = Math.min(...visible.map((n) => n.x - extent.left)),
      right = Math.max(...visible.map((n) => n.x + extent.right));
    const top = Math.min(...visible.map((n) => n.y - extent.top)),
      bottom = Math.max(...visible.map((n) => n.y + extent.bottom));
    const zoom = Math.max(
      0.001,
      Math.min(
        1.5,
        (el.clientWidth - 40) / (right - left),
        (el.clientHeight - 40) / (bottom - top),
      ),
    );
    setView({
      zoom,
      x: (el.clientWidth - (left + right) * zoom) / 2,
      y: (el.clientHeight - (top + bottom) * zoom) / 2,
    });
  };
  return (
    <div className="graph state-graph">
      <div
        className="graph-state-legend"
        aria-label={t("lifecycleAll")}
        title={t("lifecycleBlocked")}
      >
        {lifecycleStates.map((state) => (
          <span key={state} data-lifecycle={state}>
            <i />
            {t("lifecycle_" + state)}
          </span>
        ))}
      </div>
      <div className="graph-tools">
        <button aria-label={t("zoomIn")} onClick={() => centerZoom(1.2)}>
          +
        </button>
        <button aria-label={t("zoomOut")} onClick={() => centerZoom(1 / 1.2)}>
          −
        </button>
        <button
          onClick={() => {
            simulation.current?.stop();
            simulation.current = null;
            setReset((n) => n + 1);
            setView({ x: 0, y: 0, zoom: 1 });
          }}
        >
          {t("resetLayout")}
        </button>
        <button aria-pressed={focused} onClick={() => setFocused((x) => !x)}>
          {t("focus")}
        </button>
        <button onClick={fit}>{t("fit")}</button>
        <button disabled={!selected} onClick={locate}>
          {t("locate")}
        </button>
        <small>{t("layoutOnly")}</small>
      </div>
      <div className="graph-scroll" ref={container}>
        <svg
          ref={svg}
          width="100%"
          height="100%"
          onPointerDown={(e) => {
            if (e.button === 0 && container.current) {
              e.currentTarget.setPointerCapture(e.pointerId);
              pan.current = {
                x: e.clientX,
                y: e.clientY,
                left: view.x,
                top: view.y,
              };
            }
          }}
          onPointerMove={(e) => {
            if (pan.current && container.current) {
              const start = pan.current;
              setView((v) => ({
                ...v,
                x: start.left + e.clientX - start.x,
                y: start.top + e.clientY - start.y,
              }));
              return;
            }
            if (!drag.current) return;
            const n = byId.get(drag.current.id);
            if (!n) return;
            const p = point(e.clientX, e.clientY);
            const x = p.x - drag.current.offsetX,
              y = p.y - drag.current.offsetY;
            drag.current.vx = x - (n.fx ?? n.x);
            drag.current.vy = y - (n.fy ?? n.y);
            n.fx = x;
            n.fy = y;
            n.x = x;
            n.y = y;
            if (reduced.current) {
              simulation.current?.tick(1);
              setNodes([...simulation.current!.nodes()]);
            } else simulation.current?.alphaTarget(0.18).restart();
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="-44" y="-20" width="139" height="58" />
            </clipPath>
            <marker
              id={arrowId}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0 0 L6 3 L0 6" fill="none" stroke="currentColor" />
            </marker>
          </defs>
          <g
            ref={world}
            data-graph-world
            transform={`translate(${view.x},${view.y}) scale(${view.zoom})`}
          >
            {relations
              .filter(
                (r) =>
                  viewIds.has(r.sourceId) &&
                  viewIds.has(r.targetId) &&
                  byId.has(r.sourceId) &&
                  byId.has(r.targetId),
              )
              .map((r) => {
                const { start, end } = edgeEndpoints(
                  byId.get(r.targetId)!,
                  byId.get(r.sourceId)!,
                );
                return (
                  <line
                    key={r.id}
                    data-relation-id={r.id}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    className={"edge " + r.kind}
                    markerEnd={
                      r.kind === "dependency" ? `url(#${arrowId})` : undefined
                    }
                  />
                );
              })}

            {viewTasks.map((task) => {
              const n = byId.get(task.id);
              if (!n) return null;
              return (
                <g
                  key={task.id}
                  data-node-id={task.id}
                  data-lifecycle={lifecycleState(task)}
                  role="button"
                  tabIndex={0}
                  aria-label={`OT-${task.number} · ${task.title} · ${t("lifecycle_" + lifecycleState(task))}`}
                  className={"node " + (selected === task.id ? "selected" : "")}
                  transform={`translate(${n.x},${n.y})`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(task.id);
                      return;
                    }
                    if (
                      [
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      n.x +=
                        e.key === "ArrowLeft"
                          ? -20
                          : e.key === "ArrowRight"
                            ? 20
                            : 0;
                      n.y +=
                        e.key === "ArrowUp"
                          ? -20
                          : e.key === "ArrowDown"
                            ? 20
                            : 0;
                      n.anchorX = n.x;
                      n.anchorY = n.y;
                      setNodes([...nodes]);
                      if (!reduced.current)
                        simulation.current?.alpha(0.2).restart();
                    }
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const p = point(e.clientX, e.clientY);
                    drag.current = {
                      id: n.id,
                      offsetX: p.x - n.x,
                      offsetY: p.y - n.y,
                      vx: 0,
                      vy: 0,
                    };
                    n.fx = n.x;
                    n.fy = n.y;
                    onSelect(task.id);
                    if (!reduced.current)
                      simulation.current?.alphaTarget(0.18).restart();
                  }}
                >
                  <title>
                    {task.title}
                    {` · ${t("lifecycle_" + lifecycleState(task))}`}
                  </title>
                  <rect
                    className="task-node-frame"
                    data-blocked={
                      (task.blocks.some((block) => !block.resolved) &&
                        !["done", "cancelled"].includes(task.stage)) ||
                      undefined
                    }
                    x="-88"
                    y="-31"
                    width="190"
                    height="76"
                    rx="8"
                  />
                  <g transform="translate(-75,-19)">
                    <TaskIcon size={24} />
                  </g>
                  <text x="-44" y="0" clipPath={`url(#${clipId})`}>
                    {task.title.length > 19
                      ? task.title.slice(0, 19) + "…"
                      : task.title}
                  </text>
                  <text
                    className="node-status"
                    x="-44"
                    y="22"
                    clipPath={`url(#${clipId})`}
                  >
                    OT-{task.number} · {t("lifecycle_" + lifecycleState(task))}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {!tasks.length && <p className="empty">{t("empty")}</p>}
      </div>
    </div>
  );
}
