import { useMemo, useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { InlineComposer } from "../components/tasks/QuickAdd";
import { TaskControls } from "../components/tasks/TaskControls";
import { TaskGroupedList, type TaskGroup } from "../components/tasks/TaskGroupedList";
import { EmptyState } from "../components/ui/EmptyState";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { useSettings } from "../context/SettingsContext";
import { EMPTY_FILTERS, type SortMode, type TaskFilters } from "../types";
import { filterTasks, sortTasks } from "../lib/taskQuery";

/** Someday: tasks with no deadline, freely orderable. */
export function SomedayPage() {
  const { tasks } = useData();
  const { selectedTaskId } = useUI();
  const { prefs } = useSettings();
  const [filters, setFilters] = useState<TaskFilters>({
    ...EMPTY_FILTERS,
    dateScope: "someday",
  });
  const [sort, setSort] = useState<SortMode>(prefs.defaultSort);

  const someday = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  const filtered = useMemo(() => filterTasks(someday, filters), [someday, filters]);
  const sorted = useMemo(() => sortTasks(filtered, sort), [filtered, sort]);

  const groups: TaskGroup[] = useMemo(() => [{ key: "someday", tasks: sorted }], [sorted]);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="SOMEDAY"
        title="Kept without a deadline."
        lede={`${someday.filter((task) => !task.due_date).length} task${
          someday.filter((task) => !task.due_date).length === 1 ? "" : "s"
        } waiting for a date. Nothing here is late — assign a due date from the task menu whenever it becomes real.`}
        stats={[
          { value: someday.filter((task) => !task.due_date).length, label: "Undated" },
          { value: sorted.length, label: "In this view" },
        ]}
      />

      <InlineComposer
        placeholder="Park an idea — “Learn letterpress”"
        defaults={{ due_date: null }}
        label="Add an undated task"
      />

      <TaskControls
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        showDate={false}
        showProject={false}
        resultCount={sorted.length}
        totalCount={someday.length}
      />

      <div className="px-5 sm:px-8">
        <TaskGroupedList
          groups={groups}
          selectedTaskId={selectedTaskId}
          reorderable={sort === "manual" && sorted.length > 1}
          emptyState={
            <div className="pt-8">
              <EmptyState
                eyebrow="Nothing parked"
                title="No undated tasks are waiting."
                body="Anything you add here stays untitled by the calendar until you give it a date."
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
