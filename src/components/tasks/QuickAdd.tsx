import { useRef, useState, type FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { useUI } from "../../context/UIContext";
import { useData } from "../../context/DataContext";
import { useToast } from "../../context/ToastContext";
import { parseQuickEntry } from "../../lib/parseQuickEntry";
import { formatDayLabel } from "../../lib/dates";
import type { NewTaskInput, Priority } from "../../types";
import { IconPlus } from "../ui/Icons";

function parseHint(text: string): string | null {
  const parsed = parseQuickEntry(text);
  if (!parsed.parsed) return null;
  const parts: string[] = [];
  if (parsed.dueDate) parts.push(formatDayLabel(parsed.dueDate));
  if (parsed.priority) parts.push(`${parsed.priority} priority`);
  return parts.length > 0 ? `→ ${parts.join(" · ")}` : null;
}

/** Wrapper that mounts a fresh form each time the dialog opens. */
export function QuickAddModal() {
  const { quickAdd, closeQuickAdd } = useUI();

  return (
    <Modal
      open={quickAdd.open}
      onClose={closeQuickAdd}
      title="New task"
      description="Type naturally — trailing date words are recognised."
      paneClassName="max-w-xl"
    >
      {quickAdd.open ? <QuickAddForm defaults={quickAdd.defaults ?? {}} onDone={closeQuickAdd} /> : null}
    </Modal>
  );
}

function QuickAddForm({ defaults, onDone }: { defaults: NewTaskInput; onDone(): void }) {
  const { createTask, projects } = useData();
  const { notify } = useToast();

  // State hydrates at mount, so reopening always starts from the given defaults.
  const [title, setTitle] = useState(defaults.title ?? "");
  const [description, setDescription] = useState(defaults.description ?? "");
  const [date, setDate] = useState(defaults.due_date ?? "");
  const [time, setTime] = useState(defaults.due_time ?? "");
  const [priority, setPriority] = useState<Priority>(defaults.priority ?? "low");
  const [projectId, setProjectId] = useState(defaults.project_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const hint = parseHint(title);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return; // guard against double submission

    const parsed = parseQuickEntry(title);
    if (!parsed.title.trim()) {
      setError("A task needs a title.");
      titleRef.current?.focus();
      return;
    }

    setSaving(true);
    const input: NewTaskInput = {
      title: parsed.title,
      description: description.trim() || null,
      due_date: date || parsed.dueDate,
      due_time: time || null,
      priority: priority !== "low" ? priority : (parsed.priority ?? "low"),
      project_id: projectId || null,
    };

    const result = await createTask(input);

    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }
    notify(`Added “${result.data.title}”.`);
    onDone();
  };

  return (
    <form id="quick-add-form" onSubmit={submit} className="space-y-5">
      <div>
        <label className="field-label" htmlFor="quick-add-title">
          Task
        </label>
        <input
          ref={titleRef}
          id="quick-add-title"
          data-autofocus
          className="input"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Submit report tomorrow"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "quick-add-error" : hint ? "quick-add-hint" : undefined}
          maxLength={300}
          autoComplete="off"
        />
        <p id="quick-add-hint" className="mt-1.5 min-h-4 text-xs" style={{ color: "var(--olive-deep)" }}>
          {hint}
        </p>
        {error ? (
          <p id="quick-add-error" role="alert" className="mt-1 text-xs" style={{ color: "var(--terracotta-deep)" }}>
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="quick-add-date">
            Due date
          </label>
          <input
            id="quick-add-date"
            type="date"
            className="input"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="quick-add-time">
            Due time
          </label>
          <input
            id="quick-add-time"
            type="time"
            className="input"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="quick-add-priority">
            Priority
          </label>
          <select
            id="quick-add-priority"
            className="input"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="quick-add-project">
            Project
          </label>
          <select
            id="quick-add-project"
            className="input"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="quick-add-description">
          Notes <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          id="quick-add-description"
          className="input"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Context, links, next steps…"
          maxLength={5000}
        />
      </div>

      <div
        className="-mx-6 -mb-6 flex items-center justify-end gap-3 border-t px-6 py-4 sm:-mx-8 sm:px-8"
        style={{ borderColor: "var(--line)" }}
      >
        <button type="button" className="btn btn-quiet" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-solid" disabled={saving}>
          {saving ? "Adding…" : "Add task"}
        </button>
      </div>
    </form>
  );
}

interface InlineComposerProps {
  placeholder?: string;
  defaults?: NewTaskInput;
  label?: string;
}

/** Single-field composer used inline on list pages. */
export function InlineComposer({ placeholder, defaults, label = "Quick add" }: InlineComposerProps) {
  const { createTask } = useData();
  const { notify } = useToast();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hint = parseHint(value);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const parsed = parseQuickEntry(value);
    if (!parsed.title.trim()) {
      setError("A task needs a title.");
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    const result = await createTask({
      title: parsed.title,
      due_date: defaults?.due_date ?? parsed.dueDate,
      due_time: defaults?.due_time ?? null,
      priority: defaults?.priority ?? (parsed.priority ?? "low"),
      project_id: defaults?.project_id ?? null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setValue("");
    setError(null);
    notify(`Added “${result.data.title}”.`);
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={submit}
      className="border-b"
      style={{ borderColor: "var(--line)" }}
      aria-label={label}
    >
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <span style={{ color: "var(--olive-deep)" }} aria-hidden="true">
          <IconPlus />
        </span>
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          placeholder={placeholder ?? "Add a task — try “Call Ana tomorrow”"}
          aria-label="Task title"
          aria-invalid={error ? true : undefined}
          maxLength={300}
          autoComplete="off"
        />
        <span className="hidden text-xs sm:block" style={{ color: "var(--olive-deep)" }}>
          {hint}
        </span>
        <button type="submit" className="btn btn-solid" disabled={saving || !value.trim()}>
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="px-4 pb-3 text-xs sm:px-6" style={{ color: "var(--terracotta-deep)" }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
