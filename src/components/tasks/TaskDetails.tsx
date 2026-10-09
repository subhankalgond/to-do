import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../../context/DataContext";
import { useUI } from "../../context/UIContext";
import { useSettings } from "../../context/SettingsContext";
import { cn } from "../../lib/cn";
import { formatCreated, formatTimestamp } from "../../lib/dates";
import type { Priority, TaskWithTags } from "../../types";
import { PRIORITY_LABEL } from "../../types";
import { TaskCheckbox } from "./TaskCheckbox";
import { PriorityMark } from "./PriorityMark";
import { IconClose, IconPlus } from "../ui/Icons";

/**
 * Detail panel for the selected task. Title and notes autosave (debounced) and
 * flush on blur, so navigating away never loses an edit; select-like fields
 * save immediately with rollback handled by DataContext.
 */
export function TaskDetails({ taskId }: { taskId: string }) {
  const { tasks } = useData();
  const task = useMemo(() => tasks.find((item) => item.id === taskId) ?? null, [tasks, taskId]);

  return (
    <div className="flex h-full flex-col">
      {task ? <TaskDetailsBody key={task.id} task={task} /> : <TaskDetailsEmpty />}
    </div>
  );
}

function TaskDetailsEmpty() {
  const { selectTask } = useUI();
  return (
    <>
      <PanelHeader onClose={() => selectTask(null)} title="Details" />
      <div className="px-6 py-8">
        <p className="eyebrow mb-3">No task selected</p>
        <p className="font-serif text-xl leading-snug" style={{ color: "var(--ink-soft)" }}>
          Choose a task to inspect its dates, notes, project and tags.
        </p>
      </div>
    </>
  );
}

function TaskDetailsBody({ task }: { task: TaskWithTags }) {
  const { projects, tags, updateTask, setCompleted, deleteTask, addTagToTask, removeTagFromTask } = useData();
  const { selectTask } = useUI();
  const { prefs } = useSettings();

  // Drafts hydrate at mount; switching tasks remounts via `key`.
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const flushRef = useRef<() => void>(() => undefined);

  // Debounced autosave for title + notes.
  useEffect(() => {
    const titleChanged = title !== task.title;
    const descChanged = description !== (task.description ?? "");
    if (!titleChanged && !descChanged) return;

    const timer = window.setTimeout(() => {
      if (!title.trim()) {
        setTitleError("A task needs a title.");
        return;
      }
      void updateTask(task.id, {
        title: title.trim(),
        description: description.trim() || null,
      });
    }, 700);

    flushRef.current = () => {
      window.clearTimeout(timer);
      if (
        title.trim() &&
        (title.trim() !== task.title || description.trim() !== (task.description ?? ""))
      ) {
        void updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || null,
        });
      }
    };

    return () => window.clearTimeout(timer);
  }, [title, description, task, updateTask]);

  // Flush pending edits when the panel unmounts (e.g. selection changes).
  useEffect(() => {
    return () => flushRef.current();
  }, []);

  const existingTagNames = new Set(task.tags.map((tag) => tag.name.toLowerCase()));

  const commitTitle = () => {
    if (!title.trim()) {
      setTitleError("A task needs a title.");
      setTitle(task.title);
      return;
    }
    setTitleError(null);
    flushRef.current();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteTask(task);
    setDeleting(false);
    if (result.ok) selectTask(null);
  };

  return (
    <>
      <PanelHeader onClose={() => selectTask(null)} title="Details" task={task} />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Completion + title */}
        <div className="flex items-start gap-3">
          <TaskCheckbox
            completed={task.completed}
            title={task.title}
            onToggle={() => void setCompleted(task.id, !task.completed)}
          />
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="task-detail-title">
              Task title
            </label>
            <textarea
              id="task-detail-title"
              className={cn("w-full resize-none border bg-transparent px-0 py-0 font-serif text-xl leading-snug")}
              style={{
                borderColor: titleError ? "var(--terracotta)" : "transparent",
                color: task.completed ? "var(--completed-text)" : "var(--ink)",
              }}
              rows={Math.min(4, Math.max(1, Math.ceil(title.length / 26)))}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (titleError) setTitleError(null);
              }}
              onBlur={commitTitle}
              aria-invalid={titleError ? true : undefined}
              maxLength={300}
            />
            {titleError ? (
              <p role="alert" className="mt-1 text-xs" style={{ color: "var(--terracotta-deep)" }}>
                {titleError}
              </p>
            ) : null}
          </div>
        </div>

        {/* Status line */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] tracking-[0.08em] uppercase" style={{ color: "var(--muted)" }}>
          <PriorityMark priority={task.priority} />
          <span>·</span>
          <span>{task.completed ? "Completed" : "Open"}</span>
          {task.completed && task.completed_at ? (
            <>
              <span>·</span>
              <span>{formatTimestamp(task.completed_at, prefs.timeFormat)}</span>
            </>
          ) : null}
        </div>

        <hr className="my-6" style={{ borderColor: "var(--line)" }} />

        {/* Notes */}
        <div>
          <label className="field-label" htmlFor="task-detail-notes">
            Notes
          </label>
          <textarea
            id="task-detail-notes"
            className="input"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => flushRef.current()}
            placeholder="Add context, links or next steps…"
            maxLength={5000}
          />
        </div>

        {/* Dates */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="task-detail-date">
              Due date
            </label>
            <input
              id="task-detail-date"
              type="date"
              className="input"
              value={task.due_date ?? ""}
              onChange={(event) =>
                void updateTask(task.id, {
                  due_date: event.target.value || null,
                  due_time: event.target.value ? task.due_time : null,
                })
              }
            />
            {task.due_date ? (
              <button
                type="button"
                className="mt-1.5 text-xs underline underline-offset-2"
                style={{ color: "var(--muted)" }}
                onClick={() => void updateTask(task.id, { due_date: null, due_time: null })}
              >
                Clear date
              </button>
            ) : null}
          </div>
          <div>
            <label className="field-label" htmlFor="task-detail-time">
              Due time
            </label>
            <input
              id="task-detail-time"
              type="time"
              className="input"
              value={task.due_time ?? ""}
              onChange={(event) =>
                void updateTask(task.id, { due_time: event.target.value || null })
              }
              disabled={!task.due_date}
              aria-describedby={!task.due_date ? "task-detail-time-hint" : undefined}
            />
            {!task.due_date ? (
              <p id="task-detail-time-hint" className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
                Set a date first.
              </p>
            ) : null}
          </div>
        </div>

        {/* Priority */}
        <div className="mt-5">
          <span className="field-label" id="task-detail-priority-label">
            Priority
          </span>
          <div className="flex" role="group" aria-labelledby="task-detail-priority-label">
            {(["high", "medium", "low"] as Priority[]).map((level) => {
              const active = task.priority === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={active}
                  className={cn("btn -ml-px flex-1 text-xs")}
                  style={{
                    borderColor: active ? "var(--olive)" : "var(--line-strong)",
                    background: active ? "var(--olive-wash)" : "transparent",
                    color: active ? "var(--olive-deep)" : "var(--muted)",
                  }}
                  onClick={() => void updateTask(task.id, { priority: level })}
                >
                  {PRIORITY_LABEL[level]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Project */}
        <div className="mt-5">
          <label className="field-label" htmlFor="task-detail-project">
            Project
          </label>
          <select
            id="task-detail-project"
            className="input"
            value={task.project_id ?? ""}
            onChange={(event) =>
              void updateTask(task.id, { project_id: event.target.value || null })
            }
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div className="mt-5">
          <label className="field-label" htmlFor="task-detail-tag">
            Tags
          </label>
          {task.tags.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <li key={tag.id}>
                  <span
                    className="inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] tracking-[0.08em] uppercase"
                    style={{ borderColor: "var(--line-strong)", color: "var(--ink-soft)" }}
                  >
                    #{tag.name}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag.name}`}
                      className="hover:opacity-70"
                      onClick={() => void removeTagFromTask(task.id, tag.id)}
                    >
                      <IconClose size={10} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              id="task-detail-tag"
              className="input"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder={tags.length > 0 ? "Add a tag…" : "Type a tag and press Enter"}
              maxLength={40}
              autoComplete="off"
              onKeyDown={async (event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const name = tagInput.trim();
                if (!name) return;
                if (existingTagNames.has(name.toLowerCase())) {
                  setTagInput("");
                  return;
                }
                const result = await addTagToTask(task.id, name);
                if (result.ok) setTagInput("");
              }}
            />
            <button
              type="button"
              className="btn"
              aria-label="Add tag"
              disabled={!tagInput.trim()}
              onClick={async () => {
                const name = tagInput.trim();
                if (!name) return;
                if (existingTagNames.has(name.toLowerCase())) {
                  setTagInput("");
                  return;
                }
                const result = await addTagToTask(task.id, name);
                if (result.ok) setTagInput("");
              }}
            >
              <IconPlus />
            </button>
          </div>
          {tags.length > 0 && tagInput.trim() ? (
            <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
              {tags
                .filter(
                  (tag) =>
                    tag.name.toLowerCase().includes(tagInput.trim().toLowerCase()) &&
                    !existingTagNames.has(tag.name.toLowerCase()),
                )
                .slice(0, 5)
                .map((tag) => `#${tag.name}`)
                .join("  ")}
            </p>
          ) : null}
        </div>

        <hr className="my-6" style={{ borderColor: "var(--line)" }} />

        {/* Metadata */}
        <dl className="space-y-2 text-xs" style={{ color: "var(--muted)" }}>
          <div className="flex justify-between gap-4">
            <dt className="eyebrow">Created</dt>
            <dd>{formatCreated(task.created_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="eyebrow">Last edited</dt>
            <dd>{formatTimestamp(task.updated_at, prefs.timeFormat)}</dd>
          </div>
        </dl>

        {/* Danger zone */}
        <div className="mt-6 pb-4">
          <button type="button" className="btn btn-danger w-full" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete task"}
          </button>
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Deletion can be undone from the notification that follows.
          </p>
        </div>
      </div>
    </>
  );
}

function PanelHeader({
  onClose,
  title,
  task,
}: {
  onClose: () => void;
  title: string;
  task?: TaskWithTags;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 border-b px-6 py-4"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="min-w-0">
        <p className="eyebrow">{title}</p>
        {task ? (
          <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
            {task.project_id ? "In a project · " : ""}
            {task.due_date ? `due ${task.due_date}` : "no due date"}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-2"
        aria-label="Close task details"
        style={{ color: "var(--muted)" }}
      >
        <IconClose />
      </button>
    </div>
  );
}
