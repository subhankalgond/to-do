import { describe, expect, it } from "vitest";
import {
  byDueThenPriority,
  filterTasks,
  hasActiveFilters,
  matchesQuery,
  projectCompletion,
  sortTasks,
  taskStats,
  todayTasks,
} from "./taskQuery";
import { EMPTY_FILTERS, type Task, type TaskWithTags } from "../types";

const now = new Date(2026, 9, 7, 14, 30); // Wednesday, 7 October 2026

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "user-1",
    title: "Task",
    description: null,
    completed: false,
    priority: "medium",
    due_date: null,
    due_time: null,
    project_id: null,
    sort_order: 0,
    created_at: "2026-10-01T09:00:00+00:00",
    updated_at: "2026-10-01T09:00:00+00:00",
    completed_at: null,
    ...overrides,
  };
}

function withTags(task: Task, tagIds: string[] = []): TaskWithTags {
  return {
    ...task,
    tags: tagIds.map((id) => ({ id, user_id: "user-1", name: id, created_at: "" })),
  };
}

describe("taskStats", () => {
  const tasks: Task[] = [
    makeTask({ id: "a", due_date: "2026-10-07", due_time: "10:00" }),
    makeTask({ id: "b", due_date: "2026-10-06" }), // overdue
    makeTask({ id: "c", due_date: "2026-10-06", completed: true, completed_at: "2026-10-06T08:00:00+00:00" }), // overdue, completed yesterday
    makeTask({ id: "d" }), // someday
    makeTask({ id: "e", due_date: "2026-10-12" }), // upcoming
    makeTask({
      id: "f",
      completed: true,
      due_date: "2026-10-07",
      completed_at: "2026-10-07T08:00:00+00:00",
    }),
    makeTask({
      id: "g",
      completed: true,
      completed_at: "2026-10-05T08:00:00+00:00",
    }),
  ];

  it("counts real pending, completed and overdue tasks", () => {
    const stats = taskStats(tasks, now);
    expect(stats.dueTodayPending).toBe(1);
    expect(stats.overdue).toBe(1);
    expect(stats.completedToday).toBe(1);
    expect(stats.someday).toBe(1);
    expect(stats.upcoming).toBe(1);
    expect(stats.totalActive).toBe(4);
  });

  it("returns zeroes for an empty database", () => {
    expect(taskStats([], now)).toEqual({
      dueTodayPending: 0,
      completedToday: 0,
      overdue: 0,
      upcoming: 0,
      someday: 0,
      totalActive: 0,
    });
  });
});

describe("todayTasks", () => {
  it("splits tasks into overdue, due today and completed today", () => {
    const result = todayTasks(
      [
        makeTask({ id: "overdue", due_date: "2026-10-01" }),
        makeTask({ id: "today", due_date: "2026-10-07" }),
        makeTask({
          id: "done",
          completed: true,
          completed_at: "2026-10-07T09:00:00+00:00",
        }),
        makeTask({ id: "someday" }),
      ],
      now,
    );
    expect(result.overdue.map((t) => t.id)).toEqual(["overdue"]);
    expect(result.dueToday.map((t) => t.id)).toEqual(["today"]);
    expect(result.completedToday.map((t) => t.id)).toEqual(["done"]);
  });
});

describe("filtering", () => {
  const tasks = [
    withTags(makeTask({ id: "1", title: "Write essay", description: "draft intro" }), ["t1"]),
    withTags(makeTask({ id: "2", title: "Buy groceries", priority: "high", due_date: "2026-10-06" })),
    withTags(makeTask({ id: "3", title: "Plan trip", completed: true, due_date: "2026-10-20" })),
    withTags(makeTask({ id: "4", title: "No deadline idea", project_id: "p1" }), ["t2"]),
  ];

  it("searches title and description", () => {
    expect(matchesQuery(tasks[0], "essay")).toBe(true);
    expect(matchesQuery(tasks[0], "draft intro")).toBe(true);
    expect(matchesQuery(tasks[0], "intro draft")).toBe(true); // every word, any order
    expect(matchesQuery(tasks[0], "missing")).toBe(false);
    expect(matchesQuery(tasks[0], "")).toBe(true);
  });

  it("filters by status, priority, project, date scope and tag", () => {
    expect(
      filterTasks(tasks, { ...EMPTY_FILTERS, status: "active" }, now).map((t) => t.id),
    ).toEqual(["1", "2", "4"]);
    expect(
      filterTasks(tasks, { ...EMPTY_FILTERS, status: "completed" }, now).map((t) => t.id),
    ).toEqual(["3"]);
    expect(
      filterTasks(tasks, { ...EMPTY_FILTERS, priority: "high" }, now).map((t) => t.id),
    ).toEqual(["2"]);
    expect(
      filterTasks(tasks, { ...EMPTY_FILTERS, projectId: "none" }, now).map((t) => t.id),
    ).toEqual(["1", "2", "3"]);
    expect(
      filterTasks(tasks, { ...EMPTY_FILTERS, projectId: "p1" }, now).map((t) => t.id),
    ).toEqual(["4"]);
    expect(
      filterTasks(tasks, { ...EMPTY_FILTERS, dateScope: "overdue" }, now).map((t) => t.id),
    ).toEqual(["2"]);
    expect(
      filterTasks(tasks, { ...EMPTY_FILTERS, dateScope: "upcoming" }, now).map((t) => t.id),
    ).toEqual(["3"]);
    expect(
      filterTasks(tasks, { ...EMPTY_FILTERS, dateScope: "someday" }, now).map((t) => t.id),
    ).toEqual(["1", "4"]);
    expect(
      filterTasks(tasks, { ...EMPTY_FILTERS, tagId: "t1" }, now).map((t) => t.id),
    ).toEqual(["1"]);
    expect(
      filterTasks(
        tasks,
        { ...EMPTY_FILTERS, query: "trip", status: "completed" },
        now,
      ).map((t) => t.id),
    ).toEqual(["3"]);
  });

  it("reports active filters and clears them", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: "x" })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, status: "active" })).toBe(true);
  });
});

describe("sorting", () => {
  const a = makeTask({ id: "a", title: "Alpha", due_date: "2026-10-09", priority: "low", sort_order: 2, created_at: "2026-10-02T00:00:00+00:00" });
  const b = makeTask({ id: "b", title: "Bravo", due_date: null, priority: "high", sort_order: 1, created_at: "2026-10-03T00:00:00+00:00" });
  const c = makeTask({ id: "c", title: "Charlie", due_date: "2026-10-05", priority: "medium", sort_order: 3, created_at: "2026-10-01T00:00:00+00:00" });

  it("sorts by manual order", () => {
    expect(sortTasks([c, a, b], "manual").map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by due date with undated tasks last", () => {
    expect(sortTasks([b, a, c], "due").map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by priority then due date", () => {
    expect(sortTasks([a, c, b], "priority").map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by creation date newest first and by title", () => {
    expect(sortTasks([a, c, b], "created").map((t) => t.id)).toEqual(["b", "a", "c"]);
    expect(sortTasks([c, a, b], "title").map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("orders today's pending list by time then priority", () => {
    const list = [
      makeTask({ id: "late", due_time: "17:00", priority: "high" }),
      makeTask({ id: "early", due_time: "09:00", priority: "low" }),
      makeTask({ id: "notime", due_time: null, priority: "medium" }),
    ];
    expect([...list].sort(byDueThenPriority).map((t) => t.id)).toEqual([
      "early",
      "late",
      "notime",
    ]);
  });
});

describe("projectCompletion", () => {
  it("computes completion from real task data", () => {
    const tasks = [
      makeTask({ id: "1", project_id: "p", completed: true }),
      makeTask({ id: "2", project_id: "p" }),
      makeTask({ id: "3", project_id: "q" }),
    ];
    expect(projectCompletion(tasks, "p")).toEqual({ total: 2, completed: 1, percent: 50 });
    expect(projectCompletion(tasks, "missing")).toEqual({ total: 0, completed: 0, percent: 0 });
  });
});
