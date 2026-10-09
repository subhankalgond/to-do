import { IconCheck } from "../ui/Icons";

interface TaskCheckboxProps {
  completed: boolean;
  title: string;
  onToggle: () => void;
  disabled?: boolean;
}

/** Square completion control; label announces the task and the action. */
export function TaskCheckbox({ completed, title, onToggle, disabled }: TaskCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={completed}
      aria-label={completed ? `Reopen “${title}”` : `Complete “${title}”`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center border transition-colors disabled:opacity-50"
      style={{
        borderColor: completed ? "var(--olive)" : "var(--line-strong)",
        background: completed ? "var(--olive)" : "transparent",
        color: "var(--on-accent)",
      }}
    >
      {completed ? <IconCheck size={11} /> : null}
    </button>
  );
}
