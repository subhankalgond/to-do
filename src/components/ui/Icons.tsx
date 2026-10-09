interface IconProps {
  size?: number;
  className?: string;
}

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    focusable: false as const,
  };
}

export function IconPlus({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function IconSearch({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.2 10.2 13.5 13.5" />
    </svg>
  );
}

export function IconCheck({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={1.9}>
      <path d="M3 8.4 6.4 12 13 4.6" />
    </svg>
  );
}

export function IconMenu({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    </svg>
  );
}

export function IconClose({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function IconGrip({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={1.6}>
      <path d="M6 3.5h.01M6 8h.01M6 12.5h.01M10 3.5h.01M10 8h.01M10 12.5h.01" />
    </svg>
  );
}

export function IconChevronDown({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 6.5 8 10.5l4-4" />
    </svg>
  );
}
