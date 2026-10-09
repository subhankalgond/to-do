import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { TaskGroupedList, type TaskGroup } from "../components/tasks/TaskGroupedList";
import { EmptyState } from "../components/ui/EmptyState";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { projectCompletion, taskStats } from "../lib/taskQuery";
import { todayISO } from "../lib/dates";

/** Overview: a real digest of what is due, what is next, and where projects stand. */
export function OverviewPage() {
  const { tasks, projects } = useData();
  const { selectedTaskId, openQuickAdd } = useUI();

  const stats = useMemo(() => taskStats(tasks), [tasks]);
  const today = todayISO();

  const groups: TaskGroup[] = useMemo(() => {
    const overdue = tasks
      .filter((task) => !task.completed && task.due_date && task.due_date < today)
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    const todayTasks = tasks
      .filter((task) => !task.completed && task.due_date === today)
      .sort((a, b) => (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99"));
    const nextTasks = tasks
      .filter((task) => !task.completed && task.due_date && task.due_date > today)
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
      .slice(0, 8);

    const list: TaskGroup[] = [];
    if (overdue.length) list.push({ key: "overdue", label: "Overdue", meta: `${overdue.length}`, tasks: overdue });
    if (todayTasks.length) list.push({ key: "today", label: "Today", meta: `${todayTasks.length}`, tasks: todayTasks });
    if (nextTasks.length)
      list.push({
        key: "next",
        label: "Next up",
        meta: `${nextTasks.length}`,
        tasks: nextTasks,
      });
    return list;
  }, [tasks, today]);

  const progress = useMemo(
    () =>
      projects
        .map((project) => ({ project, ...projectCompletion(tasks, project.id) }))
        .filter((entry) => entry.total > 0)
        .sort((a, b) => b.percent - a.percent),
    [projects, tasks],
  );

  const empty = groups.length === 0;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="OVERVIEW"
        title="The state of the ledger."
        lede={
          empty && projects.length === 0
            ? "Nothing has been written yet. Add a task or create a project to begin."
            : "A digest of the work in front of you — what is late, what is due, and how the projects are tracking."
        }
        stats={[
          { value: stats.totalActive, label: "Open tasks" },
          { value: stats.dueTodayPending + stats.overdue, label: "Needs attention" },
          ...(stats.overdue > 0 ? [{ value: stats.overdue, label: "Overdue", tone: "alert" as const }] : []),
          { value: stats.completedToday, label: "Done today" },
        ]}
      />

      <div className="px-5 sm:px-8">
        <TaskGroupedList
          groups={groups}
          selectedTaskId={selectedTaskId}
          reorderable={false}
          emptyState={
            <div className="pt-8">
              <EmptyState
                eyebrow="Nothing scheduled"
                title="No tasks are due in the days ahead."
                body="When you take something on, it will appear here in date order."
                action={
                  <button type="button" className="btn" onClick={() => openQuickAdd()}>
                    Add a task
                  </button>
                }
              />
            </div>
          }
        />

        {progress.length > 0 ? (
          <section className="mt-12">
            <header className="flex items-baseline justify-between border-b pb-2" style={{ borderColor: "var(--line-strong)" }}>
              <h2 className="eyebrow eyebrow-ink">Projects</h2>
              <span className="eyebrow">{progress.length} active</span>
            </header>
            <ul>
              {progress.map(({ project, total, completed, percent }) => (
                <li key={project.id} className="border-b" style={{ borderColor: "var(--line)" }}>
                  <Link
                    to={`/projects/${project.id}`}
                    className="flex items-center justify-between gap-6 py-3.5 transition-colors hover:bg-[var(--sunk)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px]">{project.name}</span>
                      {project.description ? (
                        <span className="block truncate text-[13px]" style={{ color: "var(--muted)" }}>
                          {project.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                        {completed}/{total}
                      </span>
                      <span className="h-px w-20" style={{ background: "var(--line)" }} aria-hidden="true">
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
          </section>
        ) : null}
      </div>
    </div>
  );
}
