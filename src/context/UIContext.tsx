import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import type { NewTaskInput } from "../types";

interface QuickAddState {
  open: boolean;
  defaults: NewTaskInput | null;
}

interface UIContextValue {
  quickAdd: QuickAddState;
  openQuickAdd(defaults?: NewTaskInput): void;
  closeQuickAdd(): void;
  selectedTaskId: string | null;
  selectTask(id: string | null): void;
  navOpen: boolean;
  setNavOpen(open: boolean): void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside <UIProvider>");
  return ctx;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [quickAdd, setQuickAdd] = useState<QuickAddState>({ open: false, defaults: null });
  const [navOpen, setNavOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");

  const openQuickAdd = useCallback((defaults?: NewTaskInput) => {
    setQuickAdd({ open: true, defaults: defaults ?? null });
  }, []);

  const closeQuickAdd = useCallback(() => {
    setQuickAdd({ open: false, defaults: null });
  }, []);

  const selectTask = useCallback(
    (id: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (id) next.set("task", id);
          else next.delete("task");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const value = useMemo<UIContextValue>(
    () => ({ quickAdd, openQuickAdd, closeQuickAdd, selectedTaskId, selectTask, navOpen, setNavOpen }),
    [quickAdd, openQuickAdd, closeQuickAdd, selectedTaskId, selectTask, navOpen],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}
