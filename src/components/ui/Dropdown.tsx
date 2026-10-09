import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export type DropdownItem =
  | { kind: "action"; label: string; onSelect: () => void; disabled?: boolean; tone?: "default" | "danger" }
  | { kind: "label"; label: string }
  | { kind: "divider" };

interface DropdownProps {
  items: DropdownItem[];
  /** Accessible name for the trigger button (use when rendering an icon). */
  ariaLabel?: string;
  /** Visible trigger content; defaults to a ⋯ glyph. */
  trigger?: ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
  triggerVariant?: "quiet" | "bordered";
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}

export function Dropdown({
  items,
  ariaLabel,
  trigger,
  align = "right",
  triggerClassName,
  triggerVariant = "quiet",
  buttonProps,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
    first?.focus();
  }, [open]);

  const focusItem = (delta: number) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = (index + delta + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        {...buttonProps}
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center text-sm leading-none transition-colors",
          triggerVariant === "quiet"
            ? "border border-transparent hover:border-[var(--line)]"
            : "border",
          triggerClassName,
        )}
        style={{ color: "var(--muted)", borderColor: triggerVariant === "bordered" ? "var(--line-strong)" : undefined }}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger ?? <span aria-hidden="true">⋯</span>}
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          className={cn(
            "absolute z-40 mt-1 min-w-52 border py-1",
            align === "right" ? "right-0" : "left-0",
          )}
          style={{ background: "var(--raised)", borderColor: "var(--line-strong)" }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              focusItem(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              focusItem(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              focusItem(-Infinity);
            } else if (event.key === "Tab") {
              setOpen(false);
            }
          }}
        >
          {items.map((item, index) => {
            if (item.kind === "divider") {
              return (
                <div
                  key={`divider-${index}`}
                  role="separator"
                  className="my-1 border-t"
                  style={{ borderColor: "var(--line)" }}
                />
              );
            }
            if (item.kind === "label") {
              return (
                <div
                  key={`label-${index}`}
                  className="px-3 pt-2 pb-1 text-[10.5px] font-medium tracking-[0.14em] uppercase"
                  style={{ color: "var(--muted)" }}
                >
                  {item.label}
                </div>
              );
            }
            return (
              <button
                key={`action-${index}`}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className="block w-full px-3 py-1.5 text-left text-sm disabled:opacity-40"
                style={{ color: item.tone === "danger" ? "var(--terracotta-deep)" : "var(--ink)" }}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
