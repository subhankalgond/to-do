import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { InlineComposer } from "../components/tasks/QuickAdd";
import { TaskControls } from "../components/tasks/TaskControls";
import { TaskGroupedList, type TaskGroup } from "../components/tasks/TaskGroupedList";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Dropdown } from "../components/ui/Dropdown";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { useSettings } from "../context/SettingsContext";
import { EMPTY_FILTERS, type SortMode, type TaskFilters } from "../types";
import { filterTasks, projectCompletion, sortTasks } from "../lib/taskQuery";
import { formatCreated } from "../lib/dates";

/** Individual project view: its tasks, description, and completion summary. */
export function ProjectPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { tasks, projects, updateProject, deleteProject } = useData();
  const { selectedTaskId } = useUI();
  const { prefs } = useSettings();

  const [filters, setFilters] = useState<TaskFilters>({ ...EMPTY_FILTERS, projectId });
  const [sort, setSort] = useState<SortMode>(prefs.defaultSort);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const project = projects.find((item) => item.id === projectId) ?? null;
  const projectTasks = useMemo(
    () => tasks.filter((task) => task.project_id === projectId),
    [tasks, projectId],
  );
  const completion = useMemo(() => projectCompletion(tasks, projectId), [tasks, projectId]);

  const filtered = useMemo(
    () => filterTasks(projectTasks, { ...filters, projectId: "all" }),
    [projectTasks, filters],
  );
  const sorted = useMemo(() => sortTasks(filtered, sort), [filtered, sort]);
  const groups: TaskGroup[] = useMemo(() => [{ key: "project", tasks: sorted }], [sorted]);

  if (!project) {
    return (
      <div className="px-5 py-16 sm:px-8">
        <p className="eyebrow">Not found</p>
        <h1 className="mt-3 font-serif text-3xl">This project doesn’t exist.</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
          It may have been deleted, or it belongs to another account.
        </p>
        <button type="button" className="btn mt-6" onClick={() => navigate("/projects")}>
          Back to projects
        </button>
      </div>
    );
  }

  const active = filters.query.trim() !== "" || filters.priority !== "all" || filters.status !== "all" || filters.tagId !== "all";

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow={`PROJECT · CREATED ${formatCreated(project.created_at).toUpperCase()}`}
        title={project.name}
        lede={project.description ?? "Tasks collected in this list."}
        stats={[
          { value: completion.total, label: "Tasks" },
          { value: completion.total - completion.completed, label: "Open" },
          { value: `${completion.percent}%`, label: "Complete" },
        ]}
        actions={
          <Dropdown
            ariaLabel={`Actions for ${project.name}`}
            triggerVariant="bordered"
            triggerClassName="w-auto px-3 h-9 text-xs tracking-[0.1em] uppercase"
            trigger="Manage"
            items={[
              { kind: "action", label: "Rename project", onSelect: () => setRenaming(true) },
              { kind: "action", label: "Delete project", tone: "danger", onSelect: () => setDeleting(true) },
            ]}
          />
        }
      />

      <InlineComposer
        placeholder={`Add a task to ${project.name}…`}
        defaults={{ project_id: project.id }}
      />

      <TaskControls
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        showProject={false}
        showDate={false}
        resultCount={sorted.length}
        totalCount={projectTasks.length}
      />

      <div className="px-5 sm:px-8">
        <TaskGroupedList
          groups={groups}
          selectedTaskId={selectedTaskId}
          reorderable={sort === "manual" && sorted.length > 1}
          emptyState={
            <div className="pt-8">
              <EmptyState
                eyebrow={active ? "No matches" : "An empty project"}
                title={active ? "No tasks match those filters." : `Nothing in ${project.name} yet.`}
                body={
                  active
                    ? "Clear the filters to see every task in this project."
                    : "Add a task above and it will belong to this project from the moment it is written."
                }
                action={
                  active ? (
                    <button type="button" className="btn" onClick={() => setFilters({ ...EMPTY_FILTERS, projectId })}>
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            </div>
          }
        />
      </div>

      <RenameProjectModal
        open={renaming}
        project={project}
        onClose={() => setRenaming(false)}
        onSave={async (name, description) => {
          const result = await updateProject(project.id, { name, description });
          if (result.ok) setRenaming(false);
          return result;
        }}
      />

      <DeleteProjectModal
        open={deleting}
        project={project}
        taskCount={completion.total}
        otherProjects={projects.filter((item) => item.id !== project.id)}
        onClose={() => setDeleting(false)}
        onConfirm={async (reassignTo) => {
          const result = await deleteProject(project.id, reassignTo);
          if (result.ok) navigate("/projects");
          return result;
        }}
      />
    </div>
  );
}

function RenameProjectModal({
  open,
  project,
  onClose,
  onSave,
}: {
  open: boolean;
  project: { id: string; name: string; description: string | null };
  onClose(): void;
  onSave(name: string, description: string | null): Promise<{ ok: boolean; error?: string }>;
}) {
  const { projects } = useData();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
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
    if (
      projects.some(
        (item) => item.id !== project.id && item.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setError("You already have a project with that name.");
      return;
    }
    setSaving(true);
    const result = await onSave(trimmed, description.trim() || null);
    setSaving(false);
    if (!result.ok) setError(result.error ?? "Couldn’t save that project.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rename project"
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="rename-project-form" className="btn btn-solid" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="rename-project-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="field-label" htmlFor="rename-project-name">
            Name
          </label>
          <input
            id="rename-project-name"
            className="input"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
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
          <label className="field-label" htmlFor="rename-project-description">
            Description
          </label>
          <textarea
            id="rename-project-description"
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

function DeleteProjectModal({
  open,
  project,
  taskCount,
  otherProjects,
  onClose,
  onConfirm,
}: {
  open: boolean;
  project: { id: string; name: string };
  taskCount: number;
  otherProjects: Array<{ id: string; name: string }>;
  onClose(): void;
  onConfirm(reassignTo: string | null): Promise<{ ok: boolean; error?: string }>;
}) {
  const [choice, setChoice] = useState<string>("unassigned");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const result = await onConfirm(choice === "unassigned" ? null : choice);
    setSaving(false);
    if (!result.ok) setError(result.error ?? "Couldn’t delete that project.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Delete “${project.name}”?`}
      description={
        taskCount === 0
          ? "This project has no tasks, so nothing else will change."
          : "Your tasks will not be deleted. Choose where they should go."
      }
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="delete-project-form" className="btn btn-danger" disabled={saving}>
            {saving ? "Deleting…" : "Delete project"}
          </button>
        </>
      }
    >
      <form id="delete-project-form" onSubmit={submit} className="space-y-4">
        {taskCount > 0 ? (
          <fieldset>
            <legend className="field-label">
              Move {taskCount} task{taskCount === 1 ? "" : "s"} to
            </legend>
            <div className="space-y-2">
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="reassign"
                  value="unassigned"
                  checked={choice === "unassigned"}
                  onChange={() => setChoice("unassigned")}
                />
                No project (they move to the unassigned list)
              </label>
              {otherProjects.map((item) => (
                <label key={item.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="reassign"
                    value={item.id}
                    checked={choice === item.id}
                    onChange={() => setChoice(item.id)}
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs" style={{ color: "var(--terracotta-deep)" }}>
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
