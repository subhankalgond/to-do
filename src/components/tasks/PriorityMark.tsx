import type { Priority } from "../../types";
import { cn } from "../../lib/cn";

export function PriorityMark({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn("priority-mark", `priority-${priority}`, className)}>
      {priority}
    </span>
  );
}
