import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { useData, type OpResult } from "../context/DataContext";
import { projectCompletion } from "../lib/taskQuery";
import { formatCreated } from "../lib/dates";
import type { Project } from "../types";

/** Project index: every list with its real completion summary. */
export function ProjectsPage() {
  const { tasks, projects, createProject } = useData();
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () =>
      projects
        .map((project) => ({ project, ...projectCompletion(tasks, project.id) }))
        .sort((a, b) => a.project.name.localeCompare(b.project.name)),
    [projects, tasks],
  );

  const unassigned = useMemo(
    () => tasks.filter((task) => task.project_id === null && !task.completed).length,
    [tasks],
  );

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="PROJECTS"
        title="Lists, kept in order."
        lede={
          projects.length === 0
            ? "Projects gather related tasks into their own view with their own completion record."
            : `${projects.length} project${projects.length === 1 ? "" : "s"} on file, plus ${unassigned} task${unassigned === 1 ? "" : "s"} waiting outside any list.`
        }
        actions={
          <button type="button" className="btn btn-solid" onClick={() => setCreating(true)}>
            New project
          </button>
        }
      />

      <div className="px-5 sm:px-8">
        {rows.length === 0 ? (
          <div className="pt-8">
            <EmptyState
              eyebrow="No projects yet"
              title="Start a list for work that belongs together."
              body="A project is a named collection of tasks — it can be renamed, reassigned and removed without ever losing its tasks."
              action={
                <button type="button" className="btn" onClick={() => setCreating(true)}>
                  Create your first project
                </button>
              }
            />
          </div>
        ) : (
          <ul className="pt-2">
            {rows.map(({ project, total, completed, percent }) => (
              <li key={project.id} className="border-b" style={{ borderColor: "var(--line)" }}>
                <Link
                  to={`/projects/${project.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 py-5 transition-colors hover:bg-[var(--sunk)]"
                >
                  <span className="min-w-0">
                    <span className="block font-serif text-xl leading-tight">{project.name}</span>
                    {project.description ? (
                      <span className="mt-1 block max-w-prose text-[13px]" style={{ color: "var(--muted)" }}>
                        {project.description}
                      </span>
                    ) : null}
                    <span className="eyebrow mt-1.5 block">Created {formatCreated(project.created_at)}</span>
                  </span>
                  <span className="flex items-center gap-5">
                    <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                      {completed}/{total} done
                    </span>
                    <span className="h-px w-24" style={{ background: "var(--line)" }} aria-hidden="true">
                      <span className="block h-px" style={{ width: `${percent}%`, background: "var(--olive)" }} />
                    </span>
                    <span className="w-10 text-right text-xs tabular-nums" style={{ color: "var(--ink-soft)" }}>
                      {percent}%
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NewProjectModal open={creating} onClose={() => setCreating(false)} onCreate={createProject} />
    </div>
  );
}

function NewProjectModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose(): void;
  onCreate(name: string, description: string | null): Promise<OpResult<Project>>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("A project needs a name.");
      return;
    }
    setSaving(true);
    const result = await onCreate(name.trim(), description.trim() || null);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setDescription("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      description="Give related tasks a home of their own."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-project-form" className="btn btn-solid" disabled={saving}>
            {saving ? "Creating…" : "Create project"}
          </button>
        </>
      }
    >
      <form id="new-project-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="field-label" htmlFor="projects-new-name">
            Name
          </label>
          <input
            id="projects-new-name"
            className="input"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Field research"
            maxLength={80}
            aria-invalid={error ? true : undefined}
            autoFocus
          />
          {error ? (
            <p role="alert" className="mt-1.5 text-xs" style={{ color: "var(--terracotta-deep)" }}>
              {error}
            </p>
          ) : null}
        </div>
        <div>
          <label className="field-label" htmlFor="projects-new-description">
            Description <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            id="projects-new-description"
            className="input"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
          />
        </div>
      </form>
    </Modal>
  );
}
