import type { ReactNode } from "react";

export interface PageStat {
  value: number | string;
  label: string;
  tone?: "default" | "alert";
}

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  lede?: string;
  stats?: PageStat[];
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, lede, stats, actions }: PageHeaderProps) {
  return (
    <header className="border-b px-5 pt-10 pb-6 sm:px-8 sm:pt-14" style={{ borderColor: "var(--line)" }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="eyebrow">{eyebrow}</p>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      <h1 className="mt-4 max-w-3xl font-serif text-[2.35rem] leading-[1.06] tracking-[-0.015em] text-balance sm:text-5xl">
        {title}
      </h1>

      {lede ? (
        <p className="mt-4 max-w-xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          {lede}
        </p>
      ) : null}

      {stats && stats.length > 0 ? (
        <ul className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
          {stats.map((stat) => (
            <li key={stat.label}>
              <span
                className="block font-serif text-[1.7rem] leading-none tabular-nums"
                style={{ color: stat.tone === "alert" ? "var(--terracotta-deep)" : "var(--ink)" }}
              >
                {stat.value}
              </span>
              <span className="eyebrow mt-1.5 block">{stat.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
