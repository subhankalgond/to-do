import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TodayPage } from "./Today";
import type { Task, TaskWithTags } from "../types";
import { todayISO, addDaysISO } from "../lib/dates";

const handles = vi.hoisted(() => ({
  openQuickAdd: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  setCompleted: vi.fn(),
  deleteTask: vi.fn(),
  moveTask: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("../context/DataContext", () => ({
  useData: () => ({
    tasks: currentTasks,
    projects: [],
    tags: [],
    status: "ready",
    error: null,
    retry: vi.fn(),
    createTask: handles.createTask,
    updateTask: handles.updateTask,
    setCompleted: handles.setCompleted,
    deleteTask: handles.deleteTask,
    moveTask: handles.moveTask,
  }),
}));

vi.mock("../context/UIContext", () => ({
  useUI: () => ({
    openQuickAdd: handles.openQuickAdd,
    selectedTaskId: null,
    selectTask: vi.fn(),
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ notify: handles.notify, dismiss: vi.fn() }),
}));

vi.mock("../context/SettingsContext", () => ({
  useSettings: () => ({
    prefs: {
      theme: "light",
      timeFormat: "12h",
      weekStart: "mon",
      defaultSort: "manual",
    },
    ready: true,
    updatePreferences: vi.fn(),
  }),
}));

let currentTasks: TaskWithTags[] = [];

function makeTask(overrides: Partial<Task>): TaskWithTags {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "user-1",
    title: "Task",
    description: null,
    completed: false,
    priority: "medium",
    due_date: null,
    due_time: null,
    project_id: null,
    sort_order: 0,
    created_at: "2026-10-07T08:00:00+00:00",
    updated_at: "2026-10-07T08:00:00+00:00",
    completed_at: null,
    tags: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  currentTasks = [];
  vi.clearAllMocks();
});

describe("TodayPage", () => {
  it("shows the editorial header and an empty state with no tasks", () => {
    renderPage();
    expect(screen.getByText("Make room for what matters.")).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing is waiting on you right now/i),
    ).toBeInTheDocument();
  });

  it("renders overdue and today groups from real task data", () => {
    const today = todayISO();
    currentTasks = [
      makeTask({ id: "late", title: "Overdue chore", due_date: addDaysISO(today, -2) }),
      makeTask({ id: "now", title: "Due today item", due_date: today, due_time: "09:00" }),
      makeTask({ id: "future", title: "Later item", due_date: addDaysISO(today, 3) }),
    ];
    renderPage();

    // Group headings (the stat label uses a different element class).
    expect(screen.getByRole("heading", { name: "Overdue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Due today" })).toBeInTheDocument();
    expect(screen.getByText("Overdue chore")).toBeInTheDocument();
    expect(screen.getByText("Due today item")).toBeInTheDocument();
    // Future task stays off the Today page.
    expect(screen.queryByText("Later item")).not.toBeInTheDocument();
  });

  it("computes header stats from actual data, including the overdue alert", () => {
    const today = todayISO();
    currentTasks = [
      makeTask({ id: "a", due_date: today }),
      makeTask({ id: "b", due_date: addDaysISO(today, -1) }),
      makeTask({
        id: "c",
        completed: true,
        completed_at: `${today}T10:00:00+00:00`,
      }),
    ];
    renderPage();

    // Stats strip: read the value next to each label.
    const statFor = (label: string, selector?: string) => {
      const labelEl = screen.getByText(label, selector ? { selector } : undefined);
      return labelEl.parentElement?.querySelector("span");
    };
    expect(statFor("Pending today")).toHaveTextContent("1");
    expect(statFor("Completed today")).toHaveTextContent("1");
    expect(statFor("Overdue", "span.eyebrow")).toHaveTextContent("1");
  });

  it("completing a task calls setCompleted with the flipped flag", () => {
    currentTasks = [makeTask({ id: "t1", title: "Callable", due_date: todayISO() })];
    handles.setCompleted.mockResolvedValue({ ok: true });
    renderPage();

    fireEvent.click(screen.getByRole("checkbox", { name: /Complete “Callable”/ }));
    expect(handles.setCompleted).toHaveBeenCalledWith("t1", true);
  });

  it("the inline composer parses natural language before submitting", () => {
    handles.createTask.mockResolvedValue({
      ok: true,
      data: { title: "Submit report" },
    });
    renderPage();

    const input = screen.getByLabelText("Task title");
    fireEvent.change(input, { target: { value: "Submit report tomorrow" } });
    fireEvent.submit(input.closest("form")!);

    expect(handles.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Submit report",
        due_date: addDaysISO(todayISO(), 1),
      }),
    );
  });

  it("does not submit an empty composer entry", () => {
    renderPage();
    const input = screen.getByLabelText("Task title");
    fireEvent.submit(input.closest("form")!);
    expect(handles.createTask).not.toHaveBeenCalled();
  });

  it("opens quick add from the week strip", () => {
    renderPage();
    const dayButton = screen.getAllByRole("button", { name: /Add a task due/i })[0];
    fireEvent.click(dayButton);
    expect(handles.openQuickAdd).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: expect.any(String) }),
    );
  });
});
