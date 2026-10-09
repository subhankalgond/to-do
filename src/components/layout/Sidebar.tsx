import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useData } from "../../context/DataContext";
import { useUI } from "../../context/UIContext";
import { taskStats } from "../../lib/taskQuery";
import { Modal } from "../ui/Modal";
import { IconPlus } from "../ui/Icons";

interface SidebarProps {
  onNavigate?: () => void;
}

interface NavEntry {
  to: string;
  label: string;
  count?: number;
  end?: boolean;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { tasks, projects, createProject } = useData();
  const { openQuickAdd } = useUI();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const stats = useMemo(() => taskStats(tasks), [tasks]);

  const projectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (task.completed || !task.project_id) continue;
      counts.set(task.project_id, (counts.get(task.project_id) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  const entries: NavEntry[] = [
    { to: "/overview", label: "Overview" },
    { to: "/today", label: "Today", count: stats.dueTodayPending + stats.overdue },
    { to: "/upcoming", label: "Upcoming", count: stats.upcoming },
    { to: "/all", label: "All tasks", count: stats.totalActive },
    { to: "/completed", label: "Completed" },
    { to: "/someday", label: "Someday", count: stats.someday },
  ];

  return (
    <nav
      className="flex h-full w-full flex-col border-r"
      style={{ borderColor: "var(--line)", background: "var(--paper)" }}
      aria-label="Main navigation"
    >
      <div className="px-5 pt-6 pb-5">
        <NavLink to="/overview" className="block" onClick={onNavigate}>
          <span className="font-serif text-[19px] leading-none tracking-[0.2em] uppercase">
            Fieldnotes
          </span>
        </NavLink>
        <p className="eyebrow mt-2">A personal ledger</p>
      </div>

      <div className="px-4 pb-5">
        <button type="button" className="btn btn-solid w-full" onClick={() => openQuickAdd()}>
          <IconPlus />
          Add task
        </button>
        <p className="mt-2 text-center text-[11px] tracking-[0.1em]" style={{ color: "var(--muted)" }}>
          or press <kbd className="font-sans">N</kbd>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        <ul className="px-2">
          {entries.map((entry) => (
            <li key={entry.to}>
              <NavLink
                to={entry.to}
                end={entry.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm transition-colors",
                    isActive ? "font-medium" : "hover:bg-[var(--sunk)]",
                  )
                }
                style={({ isActive }) => ({
                  color: isActive ? "var(--ink)" : "var(--muted)",
                  boxShadow: isActive ? "inset 2px 0 0 var(--olive)" : undefined,
                })}
              >
                <span>{entry.label}</span>
                {entry.count ? (
                  <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                    {entry.count}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex items-center justify-between px-5">
          <span className="eyebrow">Projects</span>
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label="Create a new project"
            className="p-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--olive-deep)" }}
          >
            <IconPlus />
          </button>
        </div>

        <ul className="mt-1.5 px-2">
          {projects.length === 0 ? (
            <li className="px-3 py-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
              No projects yet.
            </li>
          ) : (
            projects.map((project) => (
              <li key={project.id}>
                <NavLink
                  to={`/projects/${project.id}`}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm transition-colors",
                      isActive ? "font-medium" : "hover:bg-[var(--sunk)]",
                    )
                  }
                  style={({ isActive }) => ({
                    color: isActive ? "var(--ink)" : "var(--muted)",
                    boxShadow: isActive ? "inset 2px 0 0 var(--olive)" : undefined,
                  })}
                >
                  <span className="truncate">{project.name}</span>
                  {projectCounts.get(project.id) ? (
                    <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                      {projectCounts.get(project.id)}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="border-t px-2 py-3" style={{ borderColor: "var(--line)" }}>
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn("block px-3 py-1.5 text-sm transition-colors", isActive ? "font-medium" : "hover:bg-[var(--sunk)]")
          }
          style={({ isActive }) => ({
            color: isActive ? "var(--ink)" : "var(--muted)",
            boxShadow: isActive ? "inset 2px 0 0 var(--olive)" : undefined,
          })}
        >
          Settings
        </NavLink>
      </div>

      <CreateProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (name, description) => {
          const result = await createProject(name, description);
          if (result.ok) {
            setCreating(false);
            navigate(`/projects/${result.data.id}`);
          }
          return result;
        }}
      />
    </nav>
  );
}

interface CreateResult {
  ok: boolean;
  error?: string;
}

function CreateProjectDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string | null) => Promise<CreateResult>;
}) {
  const { projects } = useData();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("A project needs a name.");
      return;
    }
    if (projects.some((project) => project.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("You already have a project with that name.");
      return;
    }
    setSaving(true);
    const result = await onCreate(trimmed, description.trim() || null);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn’t create that project.");
      return;
    }
    setName("");
    setDescription("");
    setError(null);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="New project"
      description="Projects group related tasks in their own view."
      footer={
        <>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              setError(null);
              onClose();
            }}
          >
            Cancel
          </button>
          <button type="submit" form="create-project-form" className="btn btn-solid" disabled={saving}>
            {saving ? "Creating…" : "Create project"}
          </button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="field-label" htmlFor="project-name">
            Name
          </label>
          <input
            id="project-name"
            className="input"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Field research"
            maxLength={80}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "project-name-error" : undefined}
            autoFocus
          />
          {error ? (
            <p id="project-name-error" role="alert" className="mt-1.5 text-xs" style={{ color: "var(--terracotta-deep)" }}>
              {error}
            </p>
          ) : null}
        </div>
        <div>
          <label className="field-label" htmlFor="project-description">
            Description <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            id="project-description"
            className="input"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this project for?"
            maxLength={500}
          />
        </div>
      </form>
    </Modal>
  );
}
