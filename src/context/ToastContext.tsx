import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastItem {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: ToastAction;
}

interface ToastContextValue {
  notify(message: string, options?: { tone?: ToastItem["tone"]; action?: ToastAction }): void;
  dismiss(id: number): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const DISMISS_MS = 6000;
const ERROR_DISMISS_MS = 10000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback<ToastContextValue["notify"]>(
    (message, options) => {
      const id = nextId.current++;
      const item: ToastItem = {
        id,
        message,
        tone: options?.tone ?? "info",
        action: options?.action,
      };
      setToasts((current) => [...current.slice(-2), item]);
      const timeout = setTimeout(() => dismiss(id), item.tone === "error" ? ERROR_DISMISS_MS : DISMISS_MS);
      timers.current.set(id, timeout);
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-start sm:px-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex max-w-[min(32rem,100%)] items-center gap-4 border px-4 py-3 text-sm"
            style={{
              background: "var(--raised)",
              borderColor:
                toast.tone === "error" ? "var(--terracotta)" : "var(--line-strong)",
              color: "var(--ink)",
            }}
          >
            <span className="leading-snug">{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                className="shrink-0 text-xs font-medium uppercase tracking-[0.12em] underline underline-offset-4"
                style={{ color: "var(--olive-deep)" }}
                onClick={() => {
                  void toast.action?.onClick();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              className="shrink-0 text-xs uppercase tracking-[0.12em]"
              style={{ color: "var(--muted)" }}
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
