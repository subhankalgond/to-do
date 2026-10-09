import { useMemo, useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { InlineComposer } from "../components/tasks/QuickAdd";
import { TaskGroupedList, type TaskGroup } from "../components/tasks/TaskGroupedList";
import { EmptyState } from "../components/ui/EmptyState";
import { useData } from "../context/DataContext";
import { useUI } from "../context/UIContext";
import { useSettings } from "../context/SettingsContext";
import { byDueThenPriority, taskStats, todayTasks } from "../lib/taskQuery";
import { formatLongDate, formatShortDate, todayISO, weekDays } from "../lib/dates";
import { cn } from "../lib/cn";

export function TodayPage() {
  const { tasks } = useData();
  const { openQuickAdd, selectedTaskId } = useUI();
  const { prefs } = useSettings();
  const [showCompleted, setShowCompleted] = useState(false);

  const stats = useMemo(() => taskStats(tasks), [tasks]);
  const { overdue, dueToday, completedToday } = useMemo(() => todayTasks(tasks), [tasks]);

  const overdueSorted = useMemo(
    () => [...overdue].sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "") || byDueThenPriority(a, b)),
    [overdue],
  );
  const todaySorted = useMemo(() => [...dueToday].sort(byDueThenPriority), [dueToday]);
  const completedSorted = useMemo(
    () => [...completedToday].sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    [completedToday],
  );

  const today = todayISO();
  const week = useMemo(
    () =>
      weekDays(new Date(), prefs.weekStart === "mon" ? 1 : 0).map((date) => ({
        date,
        count: tasks.filter((task) => !task.completed && task.due_date === date).length,
        isToday: date === today,
      })),
    [tasks, prefs.weekStart, today],
  );

  const groups: TaskGroup[] = [
    { key: "overdue", label: "Overdue", meta: `${overdueSorted.length}`, tasks: overdueSorted },
    { key: "today", label: "Due today", meta: `${todaySorted.length}`, tasks: todaySorted },
    ...(showCompleted
      ? [{ key: "completed", label: "Completed today", meta: `${completedSorted.length}`, tasks: completedSorted }]
      : []),
  ];

  const lede = (() => {
    if (tasks.length === 0) {
      return "A clean page. Add the one thing that would make today count.";
    }
    if (stats.overdue > 0 && stats.dueTodayPending > 0) {
      return `${stats.overdue} task${stats.overdue === 1 ? " has" : "s have"} slipped past ${stats.overdue === 1 ? "its" : "their"} date and ${stats.dueTodayPending} ${stats.dueTodayPending === 1 ? "is" : "are"} due today. Work top to bottom.`;
    }
    if (stats.overdue > 0) {
      return `${stats.overdue} task${stats.overdue === 1 ? "" : "s"} overdue and nothing else on the calendar. Clear the backlog first.`;
    }
    if (stats.dueTodayPending === 0) {
      return "Nothing is due today. Use the space for the work that matters most.";
    }
    return `${stats.dueTodayPending} task${stats.dueTodayPending === 1 ? "" : "s"} due today, ordered by time and then by importance.`;
  })();

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow={formatLongDate().toUpperCase()}
        title="Make room for what matters."
        lede={lede}
        stats={[
          { value: stats.dueTodayPending, label: "Pending today" },
          { value: stats.completedToday, label: "Completed today" },
          ...(stats.overdue > 0 ? [{ value: stats.overdue, label: "Overdue", tone: "alert" as const }] : []),
        ]}
      />

      {/* Week strip — click a day to schedule something there */}
      <div className="border-b px-5 py-4 sm:px-8" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-stretch gap-1 overflow-x-auto no-scrollbar" role="group" aria-label="This week">
          {week.map((day) => (
            <button
              key={day.date}
              type="button"
              onClick={() => openQuickAdd({ due_date: day.date })}
              className={cn(
                "flex min-w-14 flex-col items-center gap-0.5 border px-2 py-1.5 transition-colors",
                day.isToday ? "" : "hover:bg-[var(--sunk)]",
              )}
              style={{
                borderColor: day.isToday ? "var(--olive)" : "transparent",
                background: day.isToday ? "var(--olive-wash)" : "transparent",
              }}
              aria-label={`Add a task due ${day.date}${day.count > 0 ? `, ${day.count} scheduled` : ""}`}
            >
              <span className="eyebrow" style={{ color: day.isToday ? "var(--olive-deep)" : undefined }}>
                {formatShortDate(new Date(`${day.date}T00:00:00`)).slice(0, 3)}
              </span>
              <span
                className="font-serif text-lg leading-none tabular-nums"
                style={{ color: day.isToday ? "var(--olive-deep)" : "var(--ink-soft)" }}
              >
                {Number(day.date.slice(8, 10))}
              </span>
              <span
                className="text-[10px] tabular-nums"
                style={{ color: day.count > 0 ? "var(--ink-soft)" : "transparent" }}
              >
                {day.count > 0 ? day.count : "·"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-0 sm:px-0">
        <InlineComposer placeholder="Add a task for today — try “Review deck tomorrow”" />

        <div className="px-5 sm:px-8">
          <TaskGroupedList
            groups={groups}
            selectedTaskId={selectedTaskId}
            reorderable={false}
            emptyState={
              <div className="pt-8">
                <EmptyState
                  eyebrow="The day is clear"
                  title="Nothing is waiting on you right now."
                  body="That is a finished sentence, not an oversight. If something surfaces, write it above and it will be here on every visit."
                  action={
                    <button type="button" className="btn" onClick={() => openQuickAdd({ due_date: today })}>
                      Add today’s first task
                    </button>
                  }
                />
              </div>
            }
          />

          {completedSorted.length > 0 ? (
            <div className="mt-6">
              <button
                type="button"
                className="eyebrow underline underline-offset-4"
                onClick={() => setShowCompleted((value) => !value)}
                aria-expanded={showCompleted}
              >
                {showCompleted ? "Hide" : "Show"} {completedSorted.length} completed today
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
