import type { DateScope, Priority, SortMode, Task, TaskFilters, TaskWithTags } from "../types";
import { isOverdueISO, isTodayISO, todayISO } from "./dates";

export interface TaskStats {
  dueTodayPending: number;
  completedToday: number;
  overdue: number;
  upcoming: number;
  someday: number;
  totalActive: number;
}

/** Counts derived strictly from real task data and the current date. */
export function taskStats(tasks: Task[], now: Date = new Date()): TaskStats {
  const today = todayISO(now);
  const stats: TaskStats = {
    dueTodayPending: 0,
    completedToday: 0,
    overdue: 0,
    upcoming: 0,
    someday: 0,
    totalActive: 0,
  };

  for (const task of tasks) {
    const completedToday =
      task.completed &&
      task.completed_at !== null &&
      task.completed_at.slice(0, 10) === today;
    if (completedToday) stats.completedToday += 1;

    if (task.completed) continue;
    stats.totalActive += 1;

    if (!task.due_date) {
      stats.someday += 1;
    } else if (isOverdueISO(task.due_date, now)) {
      stats.overdue += 1;
    } else if (isTodayISO(task.due_date, now)) {
      stats.dueTodayPending += 1;
    } else {
      stats.upcoming += 1;
    }
  }

  return stats;
}

/** Tasks shown on the Today page: overdue, due today, completed today. */
export function todayTasks<T extends Task>(tasks: T[], now: Date = new Date()): {
  overdue: T[];
  dueToday: T[];
  completedToday: T[];
} {
  const overdue: T[] = [];
  const dueToday: T[] = [];
  const completedToday: T[] = [];

  for (const task of tasks) {
    if (task.completed) {
      if (task.completed_at && task.completed_at.slice(0, 10) === todayISO(now)) {
        completedToday.push(task);
      }
      continue;
    }
    if (task.due_date && isOverdueISO(task.due_date, now)) overdue.push(task);
    else if (task.due_date && isTodayISO(task.due_date, now)) dueToday.push(task);
  }

  return { overdue, dueToday, completedToday };
}

export function matchesQuery(task: Task, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const haystack = `${task.title}\n${task.description ?? ""}`.toLowerCase();
  return query.split(/\s+/).every((word) => haystack.includes(word));
}

function matchesDateScope(task: Task, scope: DateScope, now: Date): boolean {
  if (scope === "any") return true;
  if (scope === "someday") return !task.due_date;
  if (!task.due_date) return false;
  if (scope === "overdue") return isOverdueISO(task.due_date, now);
  if (scope === "today") return isTodayISO(task.due_date, now);
  return isTodayISO(task.due_date, now) === false && !isOverdueISO(task.due_date, now);
}

export function filterTasks(
  tasks: TaskWithTags[],
  filters: TaskFilters,
  now: Date = new Date(),
): TaskWithTags[] {
  return tasks.filter((task) => {
    if (!matchesQuery(task, filters.query)) return false;
    if (filters.status === "active" && task.completed) return false;
    if (filters.status === "completed" && !task.completed) return false;
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (filters.projectId === "none" && task.project_id !== null) return false;
    if (filters.projectId !== "all" && filters.projectId !== "none" && task.project_id !== filters.projectId) {
      return false;
    }
    if (filters.tagId !== "all" && !task.tags.some((tag) => tag.id === filters.tagId)) return false;
    if (!matchesDateScope(task, filters.dateScope, now)) return false;
    return true;
  });
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.projectId !== "all" ||
    filters.dateScope !== "any" ||
    filters.tagId !== "all"
  );
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const NULL_LAST = (a: string | null, b: string | null): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return 0;
};

export function sortTasks<T extends Task>(tasks: T[], mode: SortMode): T[] {
  const list = [...tasks];
  switch (mode) {
    case "manual":
      return list.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    case "due":
      return list.sort((a, b) => {
        const byDate = NULL_LAST(a.due_date, b.due_date);
        if (byDate !== 0) return byDate;
        const dateCmp = (a.due_date ?? "").localeCompare(b.due_date ?? "");
        if (dateCmp !== 0) return dateCmp;
        const byTime = NULL_LAST(a.due_time, b.due_time);
        if (byTime !== 0) return byTime;
        const timeCmp = (a.due_time ?? "").localeCompare(b.due_time ?? "");
        if (timeCmp !== 0) return timeCmp;
        return a.sort_order - b.sort_order;
      });
    case "priority":
      return list.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99") ||
          a.sort_order - b.sort_order,
      );
    case "created":
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  }
}

/** Sort comparator used for Today's pending sections (overdue first, then time). */
export function byDueThenPriority(a: Task, b: Task): number {
  const timeA = a.due_time ?? "99:99";
  const timeB = b.due_time ?? "99:99";
  if (timeA !== timeB) return timeA.localeCompare(timeB);
  const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (rank !== 0) return rank;
  return a.sort_order - b.sort_order;
}

export function projectCompletion(
  tasks: Task[],
  projectId: string,
): { total: number; completed: number; percent: number } {
  const inProject = tasks.filter((task) => task.project_id === projectId);
  const completed = inProject.filter((task) => task.completed).length;
  const total = inProject.length;
  return { total, completed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}
