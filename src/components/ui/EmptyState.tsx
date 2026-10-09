import type { ReactNode } from "react";

interface EmptyStateProps {
  eyebrow?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ eyebrow, title, body, action }: EmptyStateProps) {
  return (
    <div className="border-t pt-8 pb-4" style={{ borderColor: "var(--line)" }}>
      {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
      <p className="font-serif text-2xl leading-snug text-balance" style={{ color: "var(--ink-soft)" }}>
        {title}
      </p>
      {body ? (
        <p className="mt-2 max-w-prose text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
