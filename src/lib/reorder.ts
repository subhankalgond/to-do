import type { Task } from "../types";

export interface SortOrderUpdate {
  id: string;
  sort_order: number;
}

/**
 * Computes a sort order for a task moved between `before` and `after`
 * neighbours. Returns null when no numeric gap remains, in which case the
 * caller should renumber the surrounding group and retry.
 */
export function insertSortOrder(
  before: number | null,
  after: number | null,
): number | null {
  if (before === null && after === null) return 0;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  if (after - before < 1e-6) return null;
  return before + (after - before) / 2;
}

/** Renumbers a group of tasks into contiguous integers, keeping their order. */
export function renumber(group: Task[]): SortOrderUpdate[] {
  return group.map((task, index) => ({ id: task.id, sort_order: index }));
}

/**
 * Given the currently visible ordering (ids in display order) and a move of the
 * task at `fromIndex` to `toIndex`, returns the minimal set of sort_order
 * updates to persist. `scope` should hold the user's full task set: manual
 * ordering is a single global sequence, so neighbours outside the visible set
 * are always in the same numeric space.
 */
export function computeMove(
  visibleIds: string[],
  fromIndex: number,
  toIndex: number,
  scope: Task[],
): SortOrderUpdate[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= visibleIds.length) {
    return [];
  }

  const orderById = new Map(scope.map((task) => [task.id, task.sort_order]));
  const movedId = visibleIds[fromIndex];

  const nextIds = [...visibleIds];
  nextIds.splice(fromIndex, 1);
  nextIds.splice(toIndex, 0, movedId);

  const beforeId = toIndex > 0 ? nextIds[toIndex - 1] : null;
  const afterId = toIndex < nextIds.length - 1 ? nextIds[toIndex + 1] : null;

  const before = beforeId ? (orderById.get(beforeId) ?? null) : null;
  const after = afterId ? (orderById.get(afterId) ?? null) : null;
  const value = insertSortOrder(before, after);

  if (value !== null) {
    const current = orderById.get(movedId);
    if (current === value) return [];
    return [{ id: movedId, sort_order: value }];
  }

  // No gap: renumber the whole scope following the new visible order, keeping
  // any out-of-view tasks at the end in their existing relative order.
  const orderedScope: Task[] = [];
  const byId = new Map(scope.map((task) => [task.id, task]));
  for (const id of nextIds) {
    const task = byId.get(id);
    if (task) orderedScope.push(task);
  }
  const remaining = scope
    .filter((task) => !nextIds.includes(task.id))
    .sort((a, b) => a.sort_order - b.sort_order);
  orderedScope.push(...remaining);

  return renumber(orderedScope);
}

/** Sort comparator matching the "manual" mode with a stable tiebreak. */
export function compareManual(a: Task, b: Task): number {
  return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
}
