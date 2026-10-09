import { useState, type ReactNode } from "react";
import { useData } from "../../context/DataContext";
import type { TaskWithTags } from "../../types";
import { TaskRow } from "./TaskRow";

export interface TaskGroup {
  key: string;
  label?: string;
  meta?: string;
  tasks: TaskWithTags[];
}

interface TaskGroupedListProps {
  groups: TaskGroup[];
  selectedTaskId: string | null;
  reorderable?: boolean;
  showProject?: boolean;
  showTags?: boolean;
  emptyState?: ReactNode;
}

export function TaskGroupedList({
  groups,
  selectedTaskId,
  reorderable = false,
  showProject = true,
  showTags = true,
  emptyState,
}: TaskGroupedListProps) {
  const { moveTask, tasks: allTasks } = useData();
  const [announcement, setAnnouncement] = useState("");
  const nonEmpty = groups.filter((group) => group.tasks.length > 0);

  if (nonEmpty.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const flatIds = nonEmpty.flatMap((group) => group.tasks.map((task) => task.id));
  // Precomputed start offset of each group within the flat ordering.
  const groupOffsets = nonEmpty.reduce<number[]>((acc, _group, index) => {
    acc.push(index === 0 ? 0 : acc[index - 1] + nonEmpty[index - 1].tasks.length);
    return acc;
  }, []);

  const handleMove = async (fromFlat: number, toFlat: number) => {
    if (fromFlat === toFlat || toFlat < 0 || toFlat >= flatIds.length) return;
    const result = await moveTask(flatIds, fromFlat, toFlat, allTasks);
    if (result.ok) {
      setAnnouncement(`Moved to position ${toFlat + 1} of ${flatIds.length}.`);
    }
  };

  return (
    <div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {nonEmpty.map((group, groupIndex) => (
        <GroupSection
          key={group.key}
          group={group}
          offset={groupOffsets[groupIndex] ?? 0}
          selectedTaskId={selectedTaskId}
          reorderable={reorderable}
          showProject={showProject}
          showTags={showTags}
          onMove={handleMove}
        />
      ))}
    </div>
  );
}

interface GroupSectionProps {
  group: TaskGroup;
  offset: number;
  selectedTaskId: string | null;
  reorderable: boolean;
  showProject: boolean;
  showTags: boolean;
  onMove(fromFlat: number, toFlat: number): void;
}

function GroupSection({
  group,
  offset,
  selectedTaskId,
  reorderable,
  showProject,
  showTags,
  onMove,
}: GroupSectionProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const endDrag = () => {
    setDragFrom(null);
    setDragOver(null);
  };

  return (
    <section className="pt-8 first:pt-4">
      {group.label ? (
        <header
          className="flex items-baseline justify-between gap-4 border-b pb-2"
          style={{ borderColor: "var(--line-strong)" }}
        >
          <h2 className="eyebrow eyebrow-ink">{group.label}</h2>
          {group.meta ? <span className="eyebrow">{group.meta}</span> : null}
        </header>
      ) : null}

      <ul style={{ borderTop: group.label ? "none" : "1px solid var(--line-strong)" }}>
        {group.tasks.map((task, index) => (
          <TaskRow
            key={task.id}
            task={task}
            index={index}
            total={group.tasks.length}
            selected={task.id === selectedTaskId}
            reorderable={reorderable}
            showProject={showProject}
            showTags={showTags}
            isDraggedOver={dragOver === index && dragFrom !== null && dragFrom !== index}
            onMove={(from, to) => onMove(offset + from, offset + to)}
            onDragStart={(from) => setDragFrom(from)}
            onDragEnter={(over) => {
              setDragOver(over);
            }}
            onDrop={(to) => {
              if (dragFrom !== null && dragFrom !== to) {
                onMove(offset + dragFrom, offset + to);
              }
              endDrag();
            }}
            onDragEnd={endDrag}
          />
        ))}
      </ul>
    </section>
  );
}
