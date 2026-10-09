import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { QuickAddModal } from "../tasks/QuickAdd";
import { TaskDetails } from "../tasks/TaskDetails";
import { useUI } from "../../context/UIContext";
import { useData } from "../../context/DataContext";
import { IconClose, IconMenu, IconPlus } from "../ui/Icons";

/** Full application workspace: navigation, main view, details panel. */
export function AppShell() {
  const { selectedTaskId, selectTask, navOpen, setNavOpen, openQuickAdd } = useUI();
  const { status, error, retry } = useData();
  const location = useLocation();

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, setNavOpen]);

  // Global keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openQuickAdd();
      } else if (event.key === "Escape" && selectedTaskId) {
        selectTask(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openQuickAdd, selectTask, selectedTaskId]);

  // Reset main scroll position when navigating between views.
  useEffect(() => {
    const main = document.getElementById("main-content");
    main?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:border focus:bg-raised focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: "var(--backdrop)" }}
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 left-0 w-[17.5rem] max-w-[85vw] bg-paper"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <button
              type="button"
              className="absolute top-4 right-3 z-10 p-2"
              onClick={() => setNavOpen(false)}
              aria-label="Close navigation"
              style={{ color: "var(--muted)" }}
            >
              <IconClose />
            </button>
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center justify-between gap-3 border-b px-4 py-3 lg:hidden"
          style={{ borderColor: "var(--line)" }}
        >
          <button
            type="button"
            className="p-1.5 -ml-1.5"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            style={{ color: "var(--ink-soft)" }}
          >
            <IconMenu />
          </button>
          <span className="font-serif text-[15px] tracking-[0.2em] uppercase">Fieldnotes</span>
          <button
            type="button"
            className="btn btn-solid"
            onClick={() => openQuickAdd()}
            aria-label="Add task"
          >
            <IconPlus />
            <span className="hidden sm:inline">Add</span>
          </button>
        </header>

        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto">
          {status === "loading" ? (
            <LoadingView />
          ) : status === "error" ? (
            <ErrorView message={error ?? "Something went wrong."} onRetry={retry} />
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Details panel: side column on wide screens, overlay below xl */}
      {selectedTaskId ? (
        <aside
          className="fixed inset-0 z-40 bg-paper xl:static xl:z-auto xl:w-[23rem] xl:shrink-0 xl:border-l"
          style={{ borderColor: "var(--line)" }}
          aria-label="Task details"
        >
          <TaskDetails taskId={selectedTaskId} />
        </aside>
      ) : null}

      <QuickAddModal />
    </div>
  );
}

function LoadingView() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8" role="status" aria-live="polite">
      <p className="eyebrow">Loading</p>
      <div className="mt-6 space-y-6" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="border-t pt-4" style={{ borderColor: "var(--line)" }}>
            <div className="h-3 w-1/3" style={{ background: "var(--sunk)" }} />
            <div className="mt-3 h-3 w-2/3" style={{ background: "var(--sunk)" }} />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading your workspace…</span>
    </div>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="eyebrow" style={{ color: "var(--terracotta-deep)" }}>
        Connection problem
      </p>
      <h1 className="mt-3 font-serif text-3xl leading-tight">{message}</h1>
      <p className="mt-3 max-w-prose text-sm" style={{ color: "var(--muted)" }}>
        Your data is safe. Check your connection and try again — nothing was lost.
      </p>
      <button type="button" className="btn btn-solid mt-6" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
