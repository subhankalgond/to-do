import { useMemo, useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { TaskGroupedList, type TaskGroup } from "../components/tasks/TaskGroupedList";
import { EmptyState } from "../components/ui/EmptyState";
import { IconSearch } from "../components/ui/Icons";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { matchesQuery } from "../lib/taskQuery";
import { formatDayLabel, formatLongDateFromISO } from "../lib/dates";
import type { TaskWithTags } from "../types";

/** History of completed tasks, grouped by the day they were finished. */
export function CompletedPage() {
  const { tasks } = useData();
  const { selectedTaskId } = useUI();
  const [query, setQuery] = useState("");

  const completed = useMemo(() => {
    const list = tasks.filter(
      (task) => task.completed && matchesQuery(task, query),
    );
    return list.sort((a, b) =>
      (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at),
    );
  }, [tasks, query]);

  const groups = useMemo(() => {
    const byDate = new Map<string, TaskWithTags[]>();
    for (const task of completed) {
      const key = (task.completed_at ?? task.updated_at).slice(0, 10);
      const list = byDate.get(key);
      if (list) list.push(task);
      else byDate.set(key, [task]);
    }
    return Array.from(byDate.entries()).map<TaskGroup>(([date, list]) => ({
      key: date,
      label: formatDayLabel(date),
      meta: formatLongDateFromISO(date),
      tasks: list,
    }));
  }, [completed]);

  const totalCompleted = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="COMPLETED"
        title="The record of what got done."
        lede={
          totalCompleted === 0
            ? "Nothing has been crossed off yet. Completed tasks stay here as a quiet history — reopen any of them with one click."
            : `${totalCompleted} task${totalCompleted === 1 ? "" : "s"} completed. Tick a task again to reopen it.`
        }
        stats={[{ value: totalCompleted, label: "Completed" }]}
      />

      <div className="border-b px-5 py-4 sm:px-8" style={{ borderColor: "var(--line)" }}>
        <div className="relative max-w-md">
          <label htmlFor="completed-search" className="sr-only">
            Search completed tasks
          </label>
          <span
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
            aria-hidden="true"
          >
            <IconSearch />
          </span>
          <input
            id="completed-search"
            type="search"
            className="input pl-9"
            placeholder="Search completed tasks…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="px-5 sm:px-8">
        <TaskGroupedList
          groups={groups}
          selectedTaskId={selectedTaskId}
          reorderable={false}
          showProject
          emptyState={
            <div className="pt-8">
              <EmptyState
                eyebrow={query ? "No matches" : "Nothing yet"}
                title={
                  query
                    ? "No completed tasks match that search."
                    : "Completed tasks collect here."
                }
                body={
                  query
                    ? "Try a different word, or clear the search to see the full history."
                    : "Finish a task anywhere in FIELDNOTES and it will be filed here with the date it was done — still reopenable."
                }
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
