import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ToastProvider } from "./context/ToastContext";
import { DataProvider } from "./context/DataContext";
import { UIProvider } from "./context/UIContext";
import { AppShell } from "./components/layout/AppShell";
import { SignInPage, SignUpPage } from "./pages/Auth";
import { OverviewPage } from "./pages/Overview";
import { TodayPage } from "./pages/Today";
import { UpcomingPage } from "./pages/Upcoming";
import { AllTasksPage } from "./pages/AllTasks";
import { CompletedPage } from "./pages/Completed";
import { SomedayPage } from "./pages/Someday";
import { ProjectsPage } from "./pages/Projects";
import { ProjectPage } from "./pages/Project";
import { SettingsPage } from "./pages/Settings";

function FullPageMessage({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight">{title}</h1>
        {body ? (
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            {body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Blocks app routes until a session exists; sends visitors to sign-in. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <FullPageMessage
        eyebrow="Fieldnotes"
        title="Opening your ledger…"
        body="Restoring your session."
      />
    );
  }
  if (status === "signedout") {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Sends signed-in users away from the auth pages. */
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") {
    return <FullPageMessage eyebrow="Fieldnotes" title="One moment…" />;
  }
  if (status === "signedin") {
    return <Navigate to="/today" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/signin"
        element={
          <RedirectIfAuthed>
            <SignInPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthed>
            <SignUpPage />
          </RedirectIfAuthed>
        }
      />

      <Route
        element={
          <RequireAuth>
            <UIProvider>
              <DataProvider>
                <AppShell />
              </DataProvider>
            </UIProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="upcoming" element={<UpcomingPage />} />
        <Route path="all" element={<AllTasksPage />} />
        <Route path="completed" element={<CompletedPage />} />
        <Route path="someday" element={<SomedayPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <AppRoutes />
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
