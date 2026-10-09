import { describe, expect, it } from "vitest";
import { computeMove, insertSortOrder, renumber } from "./reorder";
import type { Task } from "../types";

function makeTask(id: string, sort_order: number): Task {
  return {
    id,
    user_id: "u",
    title: id,
    description: null,
    completed: false,
    priority: "low",
    due_date: null,
    due_time: null,
    project_id: null,
    sort_order,
    created_at: "2026-10-01T00:00:00+00:00",
    updated_at: "2026-10-01T00:00:00+00:00",
    completed_at: null,
  };
}

describe("insertSortOrder", () => {
  it("places between neighbours when a gap exists", () => {
    expect(insertSortOrder(1, 2)).toBe(1.5);
    expect(insertSortOrder(null, 5)).toBe(4);
    expect(insertSortOrder(5, null)).toBe(6);
    expect(insertSortOrder(null, null)).toBe(0);
  });

  it("returns null when neighbours have no gap", () => {
    expect(insertSortOrder(2, 2)).toBeNull();
    expect(insertSortOrder(1, 1)).toBeNull();
  });
});

describe("computeMove", () => {
  const scope = [makeTask("a", 0), makeTask("b", 1), makeTask("c", 2), makeTask("d", 3)];

  it("computes a fractional order when moving down", () => {
    const updates = computeMove(["a", "b", "c", "d"], 0, 2, scope);
    expect(updates).toEqual([{ id: "a", sort_order: 2.5 }]);
  });

  it("computes a fractional order when moving up", () => {
    const updates = computeMove(["a", "b", "c", "d"], 3, 1, scope);
    expect(updates).toEqual([{ id: "d", sort_order: 0.5 }]);
  });

  it("returns nothing when the index does not change", () => {
    expect(computeMove(["a", "b"], 1, 1, scope)).toEqual([]);
    expect(computeMove(["a", "b"], 5, 0, scope)).toEqual([]);
  });

  it("renumbers the scope when there is no numeric gap", () => {
    const tight = [makeTask("a", 1), makeTask("b", 1), makeTask("c", 1)];
    const updates = computeMove(["a", "b", "c"], 0, 1, tight);
    expect(updates).toEqual([
      { id: "b", sort_order: 0 },
      { id: "a", sort_order: 1 },
      { id: "c", sort_order: 2 },
    ]);
  });

  it("keeps out-of-view tasks after the visible ones when renumbering", () => {
    const tight = [
      makeTask("a", 0),
      makeTask("b", 0),
      makeTask("c", 0),
      makeTask("hidden", 0),
    ];
    const updates = computeMove(["a", "b", "c"], 0, 1, tight);
    expect(updates.map((u) => u.id)).toEqual(["b", "a", "c", "hidden"]);
    expect(updates.map((u) => u.sort_order)).toEqual([0, 1, 2, 3]);
  });
});

describe("renumber", () => {
  it("assigns contiguous integers", () => {
    expect(renumber([makeTask("x", 5), makeTask("y", 9)])).toEqual([
      { id: "x", sort_order: 0 },
      { id: "y", sort_order: 1 },
    ]);
  });
});
