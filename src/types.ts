export type Priority = "high" | "medium" | "low";

export type SortMode = "manual" | "due" | "priority" | "created" | "title";

export type ThemePreference = "light" | "dark" | "system";

export interface UserPreferences {
  theme: ThemePreference;
  timeFormat: "12h" | "24h";
  weekStart: "mon" | "sun";
  defaultSort: SortMode;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  timeFormat: "12h",
  weekStart: "mon",
  defaultSort: "manual",
};

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
  preferences: UserPreferences | null;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  project_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface TaskTagRow {
  task_id: string;
  tag_id: string;
  user_id: string;
}

/** Task with derived, client-side tag data. */
export interface TaskWithTags extends Task {
  tags: Tag[];
}

export interface NewTaskInput {
  /** Optional so views can pass partial defaults into the composer. */
  title?: string;
  description?: string | null;
  priority?: Priority;
  due_date?: string | null;
  due_time?: string | null;
  project_id?: string | null;
}

export type DateScope =
  | "any"
  | "overdue"
  | "today"
  | "upcoming"
  | "someday";

export interface TaskFilters {
  query: string;
  status: "all" | "active" | "completed";
  priority: Priority | "all";
  projectId: string | "all" | "none";
  dateScope: DateScope;
  tagId: string | "all";
}

export const EMPTY_FILTERS: TaskFilters = {
  query: "",
  status: "all",
  priority: "all",
  projectId: "all",
  dateScope: "any",
  tagId: "all",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
