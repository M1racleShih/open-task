import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Project } from "../shared/model.js";
import { useI18n } from "./i18n.js";
export type ProjectMenuTarget = {
  project: Project;
  x: number;
  y: number;
  trigger: HTMLButtonElement;
};
export function ProjectMenu({
  target,
  onClose,
  onColor,
}: {
  target: ProjectMenuTarget;
  onClose: () => void;
  onColor: () => void;
}) {
  const { t } = useI18n();
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menu.current?.querySelector("button")?.focus();
    const dismiss = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [target, onClose]);
  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={target.project.name}
      className="project-context-menu"
      style={{
        left: Math.max(8, Math.min(target.x, innerWidth - 228)),
        top: Math.max(8, Math.min(target.y, innerHeight - 60)),
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          onClose();
          target.trigger.focus();
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          menu.current?.querySelector("button")?.focus();
        }
      }}
    >
      <button
        role="menuitem"
        onClick={() => {
          onClose();
          target.trigger.focus();
          onColor();
        }}
      >
        <span
          className="color-swatch"
          style={{ background: target.project.color }}
          aria-hidden="true"
        />
        {t("color")}
      </button>
    </div>,
    document.body,
  );
}
