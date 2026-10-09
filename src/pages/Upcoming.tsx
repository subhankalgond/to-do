import { useMemo, useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { InlineComposer } from "../components/tasks/QuickAdd";
import { TaskGroupedList, type TaskGroup } from "../components/tasks/TaskGroupedList";
import { EmptyState } from "../components/ui/EmptyState";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { taskStats } from "../lib/taskQuery";
import { formatDayLabel, formatLongDateFromISO, todayISO } from "../lib/dates";
import type { TaskWithTags } from "../types";

/** Agenda view of everything scheduled ahead, grouped by date. */
export function UpcomingPage() {
  const { tasks } = useData();
  const { selectedTaskId, openQuickAdd } = useUI();
  const [limit, setLimit] = useState(21);
  const today = todayISO();

  const stats = useMemo(() => taskStats(tasks), [tasks]);

  const upcoming = useMemo(
    () =>
      tasks
        .filter((task) => !task.completed && task.due_date && task.due_date > today)
        .sort(
          (a, b) =>
            (a.due_date ?? "").localeCompare(b.due_date ?? "") ||
            (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99") ||
            a.sort_order - b.sort_order,
        ),
    [tasks, today],
  );

  const visible = upcoming.slice(0, limit);

  const groups = useMemo(() => {
    const byDate = new Map<string, TaskWithTags[]>();
    for (const task of visible) {
      const key = task.due_date as string;
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
  }, [visible]);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="UPCOMING"
        title="The days ahead."
        lede={
          upcoming.length === 0
            ? "Nothing is scheduled beyond today. When it is, it will be waiting here in date order."
            : `${upcoming.length} task${upcoming.length === 1 ? "" : "s"} scheduled ahead, grouped by the day they are due.`
        }
        stats={[
          { value: upcoming.length, label: "Scheduled" },
          { value: stats.upcoming, label: "Due after today" },
        ]}
      />

      <InlineComposer placeholder="Schedule something — try “Renew passport in 2 weeks”" />

      <div className="px-5 sm:px-8">
        <TaskGroupedList
          groups={groups}
          selectedTaskId={selectedTaskId}
          reorderable={false}
          emptyState={
            <div className="pt-8">
              <EmptyState
                eyebrow="An open calendar"
                title="The horizon is clear."
                body="Tasks with a future date appear here, grouped by day, so you can see the shape of the week before it arrives."
                action={
                  <button type="button" className="btn" onClick={() => openQuickAdd()}>
                    Schedule a task
                  </button>
                }
              />
            </div>
          }
        />

        {upcoming.length > visible.length ? (
          <div className="mt-8">
            <button
              type="button"
              className="btn"
              onClick={() => setLimit((value) => value + 30)}
            >
              Show {Math.min(30, upcoming.length - visible.length)} more
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
