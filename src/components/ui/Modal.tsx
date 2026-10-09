import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Optional extra class for the dialog panel. */
  paneClassName?: string;
}

export function Modal({ open, onClose, title, description, children, footer, paneClassName }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
    const preferred = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    (preferred ?? focusables()[0] ?? dialogRef.current)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusables();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-0" style={{ background: "var(--backdrop)" }} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-h-[90dvh] overflow-y-auto border bg-paper sm:max-w-lg",
          paneClassName,
        )}
        style={{ borderColor: "var(--line-strong)" }}
      >
        <div className="flex items-start justify-between gap-6 border-b px-6 pt-6 pb-4 sm:px-8" style={{ borderColor: "var(--line)" }}>
          <div>
            <h2 id="modal-title" className="font-serif text-2xl leading-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="-mr-2 -mt-1 p-2 text-sm"
            style={{ color: "var(--muted)" }}
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-6 sm:px-8">{children}</div>
        {footer ? (
          <div
            className="flex flex-wrap items-center justify-end gap-3 border-t px-6 py-4 sm:px-8"
            style={{ borderColor: "var(--line)" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
