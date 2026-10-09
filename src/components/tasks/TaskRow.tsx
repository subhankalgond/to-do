import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";
import { formatDue, formatTime, todayISO, addDaysISO } from "../../lib/dates";
import { useData } from "../../context/DataContext";
import { useUI } from "../../context/UIContext";
import { useSettings } from "../../context/SettingsContext";
import type { Priority, TaskWithTags } from "../../types";
import { PRIORITY_LABEL } from "../../types";
import { TaskCheckbox } from "./TaskCheckbox";
import { PriorityMark } from "./PriorityMark";
import { Dropdown, type DropdownItem } from "../ui/Dropdown";
import { IconGrip } from "../ui/Icons";

export interface TaskRowProps {
  task: TaskWithTags;
  index: number;
  total: number;
  selected: boolean;
  reorderable: boolean;
  showProject?: boolean;
  showTags?: boolean;
  onMove(from: number, to: number): void;
  // drag-and-drop coordination from the parent list
  isDraggedOver?: boolean;
  onDragStart(index: number): void;
  onDragEnter(index: number): void;
  onDrop(index: number): void;
  onDragEnd(): void;
}

export function TaskRow({
  task,
  index,
  total,
  selected,
  reorderable,
  showProject = true,
  showTags = true,
  onMove,
  isDraggedOver = false,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}: TaskRowProps) {
  const { updateTask, setCompleted, deleteTask, projects } = useData();
  const { selectTask } = useUI();
  const { prefs } = useSettings();
  const [dragReady, setDragReady] = useState(false);

  // Releasing the mouse anywhere cancels the pending drag.
  useEffect(() => {
    if (!dragReady) return;
    const cancel = () => setDragReady(false);
    window.addEventListener("mouseup", cancel);
    return () => window.removeEventListener("mouseup", cancel);
  }, [dragReady]);

  const project = useMemo(
    () => projects.find((item) => item.id === task.project_id) ?? null,
    [projects, task.project_id],
  );

  const overdue = Boolean(task.due_date && task.due_date < todayISO() && !task.completed);
  const dueLabel = task.due_date ? formatDue(task.due_date) : null;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!reorderable || !event.altKey) return;
    if (event.key === "ArrowUp" && index > 0) {
      event.preventDefault();
      onMove(index, index - 1);
    } else if (event.key === "ArrowDown" && index < total - 1) {
      event.preventDefault();
      onMove(index, index + 1);
    }
  };

  const menuItems: DropdownItem[] = [
    { kind: "action", label: "Open details", onSelect: () => selectTask(task.id) },
    ...(reorderable
      ? ([
          { kind: "action", label: "Move up", disabled: index === 0, onSelect: () => onMove(index, index - 1) },
          {
            kind: "action",
            label: "Move down",
            disabled: index === total - 1,
            onSelect: () => onMove(index, index + 1),
          },
        ] as DropdownItem[])
      : []),
    { kind: "divider" },
    { kind: "label", label: "Priority" },
    ...(["high", "medium", "low"] as Priority[]).map<DropdownItem>((level) => ({
      kind: "action",
      label: `${PRIORITY_LABEL[level]}${task.priority === level ? " ·" : ""}`,
      onSelect: () => void updateTask(task.id, { priority: level }),
    })),
    { kind: "divider" },
    { kind: "label", label: "Due date" },
    {
      kind: "action",
      label: `Today${task.due_date === todayISO() ? " ·" : ""}`,
      onSelect: () => void updateTask(task.id, { due_date: todayISO(), due_time: task.due_time }),
    },
    {
      kind: "action",
      label: `Tomorrow${task.due_date === addDaysISO(todayISO(), 1) ? " ·" : ""}`,
      onSelect: () => void updateTask(task.id, { due_date: addDaysISO(todayISO(), 1), due_time: task.due_time }),
    },
    {
      kind: "action",
      label: `No date${task.due_date === null ? " ·" : ""}`,
      onSelect: () => void updateTask(task.id, { due_date: null, due_time: null }),
    },
    ...(projects.length > 0
      ? ([
          { kind: "divider" },
          { kind: "label", label: "Move to project" },
          {
            kind: "action",
            label: `No project${task.project_id === null ? " ·" : ""}`,
            onSelect: () => void updateTask(task.id, { project_id: null }),
          },
          ...projects.map<DropdownItem>((item) => ({
            kind: "action",
            label: `${item.name}${task.project_id === item.id ? " ·" : ""}`,
            onSelect: () => void updateTask(task.id, { project_id: item.id }),
          })),
        ] as DropdownItem[])
      : []),
    { kind: "divider" },
    { kind: "action", label: "Delete task", tone: "danger", onSelect: () => void deleteTask(task) },
  ];

  return (
    <li
      className={cn("group border-b transition-colors", dragReady && "cursor-grab")}
      style={{
        borderColor: "var(--line)",
        background: isDraggedOver
          ? "var(--olive-wash)"
          : selected
            ? "var(--olive-wash)"
            : "transparent",
        boxShadow: selected ? "inset 2px 0 0 var(--olive)" : undefined,
      }}
      draggable={reorderable && dragReady}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
        onDragStart(index);
      }}
      onDragOver={(event) => {
        if (!reorderable) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragEnter(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(index);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start gap-3 px-4 py-3 sm:px-6">
        {reorderable ? (
          <span
            className="mt-1 hidden shrink-0 cursor-grab items-center opacity-0 transition-opacity group-hover:opacity-100 sm:flex"
            style={{ color: "var(--muted)" }}
            aria-hidden="true"
            onMouseDown={() => setDragReady(true)}
            onMouseUp={() => setDragReady(false)}
          >
            <IconGrip />
          </span>
        ) : null}

        <TaskCheckbox
          completed={task.completed}
          title={task.title}
          onToggle={() => void setCompleted(task.id, !task.completed)}
        />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => selectTask(task.id)}
            onKeyDown={handleKeyDown}
            className="block w-full text-left"
            aria-label={`Open details for “${task.title}”`}
          >
            <span
              className={cn(
                "text-[15px] leading-snug",
                task.completed && "line-through",
              )}
              style={{
                color: task.completed ? "var(--completed-text)" : "var(--ink)",
              }}
            >
              {task.title}
            </span>
          </button>

          {task.description ? (
            <p
              className="mt-0.5 line-clamp-1 text-[13px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {task.description}
            </p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.08em] uppercase">
            {dueLabel ? (
              <span
                style={{ color: overdue ? "var(--terracotta-deep)" : "var(--muted)" }}
              >
                {dueLabel}
                {task.due_time ? ` · ${formatTime(task.due_time, prefs.timeFormat)}` : ""}
              </span>
            ) : task.due_time ? (
              <span style={{ color: "var(--muted)" }}>
                {formatTime(task.due_time, prefs.timeFormat)}
              </span>
            ) : null}

            {showProject && project ? (
              <span style={{ color: "var(--olive-deep)" }}>{project.name}</span>
            ) : null}

            {showTags && task.tags.length > 0 ? (
              <span style={{ color: "var(--muted)" }}>
                {task.tags.map((tag) => `#${tag.name}`).join(" ")}
              </span>
            ) : null}

            <PriorityMark priority={task.priority} />
          </div>
        </div>

        <Dropdown
          items={menuItems}
          ariaLabel={`Actions for “${task.title}”`}
          triggerClassName="opacity-60 group-hover:opacity-100"
        />
      </div>
    </li>
  );
}
