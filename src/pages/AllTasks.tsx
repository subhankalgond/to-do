import { useMemo, useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { TaskControls } from "../components/tasks/TaskControls";
import { TaskGroupedList, type TaskGroup } from "../components/tasks/TaskGroupedList";
import { EmptyState } from "../components/ui/EmptyState";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { useSettings } from "../context/SettingsContext";
import { EMPTY_FILTERS, type SortMode, type TaskFilters } from "../types";
import { filterTasks, hasActiveFilters, sortTasks, taskStats } from "../lib/taskQuery";

/** Complete task list with search, filters, sorting and manual ordering. */
export function AllTasksPage() {
  const { tasks } = useData();
  const { selectedTaskId, openQuickAdd } = useUI();
  const { prefs } = useSettings();
  const [filters, setFilters] = useState<TaskFilters>({ ...EMPTY_FILTERS });
  const [sort, setSort] = useState<SortMode>(prefs.defaultSort);

  const stats = useMemo(() => taskStats(tasks), [tasks]);

  const filtered = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);
  const sorted = useMemo(() => sortTasks(filtered, sort), [filtered, sort]);

  const groups: TaskGroup[] = useMemo(
    () => [{ key: "all", tasks: sorted }],
    [sorted],
  );

  const active = hasActiveFilters(filters);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="ALL TASKS"
        title="Everything on the record."
        lede={`${tasks.length} task${tasks.length === 1 ? "" : "s"} in the ledger. Search, filter and sort — the order you choose is remembered.`}
        stats={[
          { value: stats.totalActive, label: "Open" },
          { value: stats.completedToday, label: "Done today" },
          { value: tasks.length - stats.totalActive, label: "Completed" },
        ]}
      />

      <TaskControls
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        resultCount={sorted.length}
        totalCount={tasks.length}
      />

      <div className="px-5 sm:px-8">
        <TaskGroupedList
          groups={groups}
          selectedTaskId={selectedTaskId}
          reorderable={sort === "manual" && sorted.length > 1}
          emptyState={
            <div className="pt-8">
              <EmptyState
                eyebrow={active ? "No matches" : "An empty ledger"}
                title={
                  active
                    ? "No tasks match those filters."
                    : "You haven’t written anything down yet."
                }
                body={
                  active
                    ? "Loosen or clear the filters to see everything again."
                    : "Every task you create lands here, searchable and sortable, until you complete it."
                }
                action={
                  active ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setFilters({ ...EMPTY_FILTERS })}
                    >
                      Clear filters
                    </button>
                  ) : (
                    <button type="button" className="btn" onClick={() => openQuickAdd()}>
                      Add your first task
                    </button>
                  )
                }
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
