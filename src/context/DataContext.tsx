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
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { errorMessage, isSessionError, requireClient, supabase } from "../lib/supabase";
import { computeMove } from "../lib/reorder";
import type {
  NewTaskInput,
  Project,
  Tag,
  Task,
  TaskTagRow,
  TaskWithTags,
} from "../types";

export type LoadStatus = "loading" | "ready" | "error";

/** Operation result: `data` is required when the operation returns a value. */
export type OpResult<T = void> =
  | ([T] extends [void] ? { ok: true; data?: void } : { ok: true; data: T })
  | { ok: false; error: string };

interface DataState {
  status: LoadStatus;
  error: string | null;
  rawTasks: Task[];
  projects: Project[];
  tags: Tag[];
  taskTags: TaskTagRow[];
}

const EMPTY_STATE: DataState = {
  status: "loading",
  error: null,
  rawTasks: [],
  projects: [],
  tags: [],
  taskTags: [],
};

interface DataContextValue {
  status: LoadStatus;
  error: string | null;
  tasks: TaskWithTags[];
  projects: Project[];
  tags: Tag[];
  retry(): void;
  createTask(input: NewTaskInput): Promise<OpResult<Task>>;
  updateTask(id: string, patch: Partial<Task>): Promise<OpResult>;
  setCompleted(id: string, completed: boolean): Promise<OpResult>;
  deleteTask(task: TaskWithTags): Promise<OpResult>;
  restoreTask(task: Task, tagIds: string[]): Promise<OpResult>;
  moveTask(visibleIds: string[], fromIndex: number, toIndex: number, scope: Task[]): Promise<OpResult>;
  createProject(name: string, description: string | null): Promise<OpResult<Project>>;
  updateProject(id: string, patch: Partial<Project>): Promise<OpResult>;
  deleteProject(id: string, reassignTo: string | null): Promise<OpResult>;
  createTag(name: string): Promise<OpResult<Tag>>;
  renameTag(id: string, name: string): Promise<OpResult>;
  deleteTag(id: string): Promise<OpResult>;
  addTagToTask(taskId: string, name: string): Promise<OpResult<Tag | null>>;
  removeTagFromTask(taskId: string, tagId: string): Promise<OpResult>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}

function stripDerived(task: Task | TaskWithTags): Task {
  const { tags: _tags, ...rest } = task as TaskWithTags;
  return rest;
}

function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user, handleSessionExpired } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState<DataState>(EMPTY_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  // deleteTask (defined before restoreTask) reaches the latest implementation
  // through this ref, avoiding a use-before-declaration cycle.
  const restoreTaskRef = useRef<(task: Task, tagIds: string[]) => Promise<OpResult>>(
    async () => ({ ok: false, error: "Not ready yet." }),
  );

  const fail = useCallback(
    (error: unknown, fallback: string): string => {
      if (isSessionError(error)) {
        handleSessionExpired();
        return "Your session has expired. Please sign in again.";
      }
      return errorMessage(error, fallback);
    },
    [handleSessionExpired],
  );

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!supabase) return;
      if (showSpinner) setState((current) => ({ ...current, status: "loading", error: null }));
      try {
        const client = requireClient();
        const [tasksRes, projectsRes, tagsRes, linksRes] = await Promise.all([
          client.from("tasks").select("*"),
          client.from("projects").select("*"),
          client.from("tags").select("*"),
          client.from("task_tags").select("task_id, tag_id, user_id"),
        ]);
        const firstError =
          tasksRes.error ?? projectsRes.error ?? tagsRes.error ?? linksRes.error;
        if (firstError) throw firstError;
        setState({
          status: "ready",
          error: null,
          rawTasks: (tasksRes.data as Task[]) ?? [],
          projects: (projectsRes.data as Project[]) ?? [],
          tags: (tagsRes.data as Tag[]) ?? [],
          taskTags: (linksRes.data as TaskTagRow[]) ?? [],
        });
      } catch (error) {
        setState((current) => ({
          ...current,
          status: "error",
          error: fail(error, "Couldn’t load your workspace."),
        }));
      }
    },
    [fail],
  );

  useEffect(() => {
    if (authStatus === "signedin" && user) {
      void load(true);
    } else if (authStatus === "signedout") {
      setState(EMPTY_STATE);
    }
  }, [authStatus, user, load]);

  const tagsByTask = useMemo(() => {
    const map = new Map<string, Tag[]>();
    const tagById = new Map(state.tags.map((tag) => [tag.id, tag]));
    for (const link of state.taskTags) {
      const tag = tagById.get(link.tag_id);
      if (!tag) continue;
      const list = map.get(link.task_id);
      if (list) list.push(tag);
      else map.set(link.task_id, [tag]);
    }
    return map;
  }, [state.tags, state.taskTags]);

  const tasks = useMemo<TaskWithTags[]>(
    () =>
      state.rawTasks.map((task) => ({
        ...task,
        tags: tagsByTask.get(task.id) ?? [],
      })),
    [state.rawTasks, tagsByTask],
  );

  const retry = useCallback(() => {
    void load(true);
  }, [load]);

  /* ---------------------------------------------------------------- tasks */

  const createTask = useCallback(
    async (input: NewTaskInput): Promise<OpResult<Task>> => {
      const title = input.title?.trim();
      if (!title) return { ok: false, error: "A task needs a title." };
      if (!user) return { ok: false, error: "You need to sign in to do that." };

      const sameScope = stateRef.current.rawTasks;
      const nextOrder =
        sameScope.length === 0
          ? 0
          : Math.max(...sameScope.map((task) => task.sort_order)) + 1;

      const row = {
        user_id: user.id,
        title,
        description: input.description?.trim() || null,
        priority: input.priority ?? "low",
        due_date: input.due_date ?? null,
        due_time: input.due_time ?? null,
        project_id: input.project_id ?? null,
        sort_order: nextOrder,
      };

      try {
        const client = requireClient();
        const { data, error } = await client.from("tasks").insert(row).select("*").single();
        if (error) throw error;
        const task = data as Task;
        setState((current) => ({ ...current, rawTasks: [...current.rawTasks, task] }));
        return { ok: true, data: task };
      } catch (error) {
        const message = fail(error, "Couldn’t create that task.");
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [user, fail, notify],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>): Promise<OpResult> => {
      const snapshot = stateRef.current.rawTasks;
      setState((current) => ({
        ...current,
        rawTasks: current.rawTasks.map((task) =>
          task.id === id ? { ...task, ...patch } : task,
        ),
      }));
      try {
        const client = requireClient();
        const { data, error } = await client
          .from("tasks")
          .update(patch)
          .eq("id", id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("That task no longer exists or isn’t yours.");
        return { ok: true };
      } catch (error) {
        const message = fail(error, "Couldn’t save that change.");
        setState((current) => ({ ...current, rawTasks: snapshot }));
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [fail, notify],
  );

  const setCompleted = useCallback(
    (id: string, completed: boolean) =>
      updateTask(id, {
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      }),
    [updateTask],
  );

  const deleteTask = useCallback(
    async (task: TaskWithTags): Promise<OpResult> => {
      const snapshotTasks = stateRef.current.rawTasks;
      const snapshotLinks = stateRef.current.taskTags;
      const links = snapshotLinks.filter((link) => link.task_id === task.id);

      setState((current) => ({
        ...current,
        rawTasks: current.rawTasks.filter((item) => item.id !== task.id),
        taskTags: current.taskTags.filter((link) => link.task_id !== task.id),
      }));

      try {
        const client = requireClient();
        const { error } = await client.from("tasks").delete().eq("id", task.id);
        if (error) throw error;

        notify(`Deleted “${task.title.length > 40 ? `${task.title.slice(0, 40)}…` : task.title}”.`, {
          action: {
            label: "Undo",
            onClick: async () => {
              const result = await restoreTaskRef.current?.(task, links.map((l) => l.tag_id));
              if (result?.ok) notify("Task restored.");
            },
          },
        });
        return { ok: true };
      } catch (error) {
        const message = fail(error, "Couldn’t delete that task.");
        setState((current) => ({ ...current, rawTasks: snapshotTasks, taskTags: snapshotLinks }));
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [fail, notify],
  );

  const restoreTask = useCallback(
    async (task: Task, tagIds: string[]): Promise<OpResult> => {
      try {
        const client = requireClient();
        const { error } = await client.from("tasks").insert(stripDerived(task));
        if (error) throw error;
        if (tagIds.length > 0) {
          const rows = tagIds.map((tagId) => ({
            user_id: task.user_id,
            task_id: task.id,
            tag_id: tagId,
          }));
          const { error: linkError } = await client
            .from("task_tags")
            .insert(rows)
            .select("task_id");
          // A duplicate link (conflict) is harmless; anything else is a failure.
          if (linkError && !/duplicate/i.test(linkError.message)) throw linkError;
        }
        setState((current) => ({
          ...current,
          rawTasks: [...current.rawTasks, task],
          taskTags: [
            ...current.taskTags,
            ...tagIds.map((tagId) => ({ user_id: task.user_id, task_id: task.id, tag_id: tagId })),
          ],
        }));
        return { ok: true };
      } catch (error) {
        const message = fail(error, "Couldn’t restore that task.");
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [fail, notify],
  );

  // Keep the ref pointed at the current restoreTask implementation.
  useEffect(() => {
    restoreTaskRef.current = restoreTask;
  }, [restoreTask]);

  const moveTask = useCallback(
    async (visibleIds: string[], fromIndex: number, toIndex: number, scope: Task[]): Promise<OpResult> => {
      const updates = computeMove(visibleIds, fromIndex, toIndex, scope);
      if (updates.length === 0) return { ok: true };

      const snapshot = stateRef.current.rawTasks;
      const orderById = new Map(updates.map((update) => [update.id, update.sort_order]));
      setState((current) => ({
        ...current,
        rawTasks: current.rawTasks.map((task) =>
          orderById.has(task.id)
            ? { ...task, sort_order: orderById.get(task.id) as number }
            : task,
        ),
      }));

      try {
        const client = requireClient();
        const { error } = await client.from("tasks").upsert(
          updates.map((update) => ({
            id: update.id,
            user_id: user?.id,
            sort_order: update.sort_order,
          })),
          { onConflict: "id" },
        );
        if (error) throw error;
        return { ok: true };
      } catch (error) {
        const message = fail(error, "Couldn’t save the new order.");
        setState((current) => ({ ...current, rawTasks: snapshot }));
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [user, fail, notify],
  );

  /* -------------------------------------------------------------- projects */

  const createProject = useCallback(
    async (name: string, description: string | null): Promise<OpResult<Project>> => {
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, error: "A project needs a name." };
      if (!user) return { ok: false, error: "You need to sign in to do that." };
      try {
        const client = requireClient();
        const { data, error } = await client
          .from("projects")
          .insert({ user_id: user.id, name: trimmed, description: description?.trim() || null })
          .select("*")
          .single();
        if (error) throw error;
        const project = data as Project;
        setState((current) => ({ ...current, projects: [...current.projects, project] }));
        return { ok: true, data: project };
      } catch (error) {
        const message = fail(error, "Couldn’t create that project.");
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [user, fail, notify],
  );

  const updateProject = useCallback(
    async (id: string, patch: Partial<Project>): Promise<OpResult> => {
      const snapshot = stateRef.current.projects;
      setState((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === id ? { ...project, ...patch } : project,
        ),
      }));
      try {
        const client = requireClient();
        const { data, error } = await client
          .from("projects")
          .update(patch)
          .eq("id", id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("That project no longer exists or isn’t yours.");
        return { ok: true };
      } catch (error) {
        const message = fail(error, "Couldn’t save that project.");
        setState((current) => ({ ...current, projects: snapshot }));
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [fail, notify],
  );

  const deleteProject = useCallback(
    async (id: string, reassignTo: string | null): Promise<OpResult> => {
      const snapshotProjects = stateRef.current.projects;
      const snapshotTasks = stateRef.current.rawTasks;

      try {
        const client = requireClient();
        // 1. Move this project's tasks somewhere safe before removing it.
        const { error: moveError } = await client
          .from("tasks")
          .update({ project_id: reassignTo })
          .eq("project_id", id);
        if (moveError) throw moveError;

        // 2. Only then remove the project itself.
        const { error } = await client.from("projects").delete().eq("id", id);
        if (error) throw error;

        setState((current) => ({
          ...current,
          projects: current.projects.filter((project) => project.id !== id),
          rawTasks: current.rawTasks.map((task) =>
            task.project_id === id ? { ...task, project_id: reassignTo } : task,
          ),
        }));
        return { ok: true };
      } catch (error) {
        const message = fail(error, "Couldn’t delete that project.");
        setState((current) => ({
          ...current,
          projects: snapshotProjects,
          rawTasks: snapshotTasks,
        }));
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [fail, notify],
  );

  /* ------------------------------------------------------------------ tags */

  const createTag = useCallback(
    async (name: string): Promise<OpResult<Tag>> => {
      const trimmed = normalizeTagName(name);
      if (!trimmed) return { ok: false, error: "A tag needs a name." };
      if (!user) return { ok: false, error: "You need to sign in to do that." };

      const existing = stateRef.current.tags.find(
        (tag) => tag.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return { ok: true, data: existing };

      try {
        const client = requireClient();
        const { data, error } = await client
          .from("tags")
          .insert({ user_id: user.id, name: trimmed })
          .select("*")
          .single();
        if (error) throw error;
        const tag = data as Tag;
        setState((current) => ({ ...current, tags: [...current.tags, tag] }));
        return { ok: true, data: tag };
      } catch (error) {
        const message = fail(error, "Couldn’t create that tag.");
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [user, fail, notify],
  );

  const renameTag = useCallback(
    async (id: string, name: string): Promise<OpResult> => {
      const trimmed = normalizeTagName(name);
      if (!trimmed) return { ok: false, error: "A tag needs a name." };
      const snapshot = stateRef.current.tags;
      setState((current) => ({
        ...current,
        tags: current.tags.map((tag) => (tag.id === id ? { ...tag, name: trimmed } : tag)),
      }));
      try {
        const client = requireClient();
        const { data, error } = await client
          .from("tags")
          .update({ name: trimmed })
          .eq("id", id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("That tag no longer exists or isn’t yours.");
        return { ok: true };
      } catch (error) {
        const message = fail(error, "Couldn’t rename that tag.");
        setState((current) => ({ ...current, tags: snapshot }));
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [fail, notify],
  );

  const deleteTag = useCallback(
    async (id: string): Promise<OpResult> => {
      const snapshotTags = stateRef.current.tags;
      const snapshotLinks = stateRef.current.taskTags;
      setState((current) => ({
        ...current,
        tags: current.tags.filter((tag) => tag.id !== id),
        taskTags: current.taskTags.filter((link) => link.tag_id !== id),
      }));
      try {
        const client = requireClient();
        // Links cascade at the database level, but delete them explicitly first.
        const { error: linkError } = await client.from("task_tags").delete().eq("tag_id", id);
        if (linkError) throw linkError;
        const { error } = await client.from("tags").delete().eq("id", id);
        if (error) throw error;
        return { ok: true };
      } catch (error) {
        const message = fail(error, "Couldn’t delete that tag.");
        setState((current) => ({ ...current, tags: snapshotTags, taskTags: snapshotLinks }));
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [fail, notify],
  );

  const addTagToTask = useCallback(
    async (taskId: string, name: string): Promise<OpResult<Tag | null>> => {
      const trimmed = normalizeTagName(name);
      if (!trimmed) return { ok: false, error: "A tag needs a name." };

      const created = await createTag(trimmed);
      if (!created.ok) return created;
      const tag = created.data;

      if (stateRef.current.taskTags.some((link) => link.task_id === taskId && link.tag_id === tag.id)) {
        return { ok: true, data: tag }; // already linked
      }

      const snapshot = stateRef.current.taskTags;
      const ownerId = stateRef.current.rawTasks.find((task) => task.id === taskId)?.user_id;
      if (!ownerId) return { ok: false, error: "That task no longer exists." };
      const link: TaskTagRow = { user_id: ownerId, task_id: taskId, tag_id: tag.id };

      setState((current) => ({ ...current, taskTags: [...current.taskTags, link] }));
      try {
        const client = requireClient();
        const { error } = await client.from("task_tags").insert(link);
        if (error && !/duplicate/i.test(error.message)) throw error;
        return { ok: true, data: tag };
      } catch (error) {
        const message = fail(error, "Couldn’t add that tag.");
        setState((current) => ({ ...current, taskTags: snapshot }));
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [createTag, fail, notify],
  );

  const removeTagFromTask = useCallback(
    async (taskId: string, tagId: string): Promise<OpResult> => {
      const snapshot = stateRef.current.taskTags;
      setState((current) => ({
        ...current,
        taskTags: current.taskTags.filter(
          (link) => !(link.task_id === taskId && link.tag_id === tagId),
        ),
      }));
      try {
        const client = requireClient();
        const { error } = await client
          .from("task_tags")
          .delete()
          .eq("task_id", taskId)
          .eq("tag_id", tagId);
        if (error) throw error;
        return { ok: true };
      } catch (error) {
        const message = fail(error, "Couldn’t remove that tag.");
        setState((current) => ({ ...current, taskTags: snapshot }));
        notify(message, { tone: "error" });
        return { ok: false, error: message };
      }
    },
    [fail, notify],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      status: state.status,
      error: state.error,
      tasks,
      projects: state.projects,
      tags: state.tags,
      retry,
      createTask,
      updateTask,
      setCompleted,
      deleteTask,
      restoreTask,
      moveTask,
      createProject,
      updateProject,
      deleteProject,
      createTag,
      renameTag,
      deleteTag,
      addTagToTask,
      removeTagFromTask,
    }),
    [
      state.status,
      state.error,
      state.projects,
      state.tags,
      tasks,
      retry,
      createTask,
      updateTask,
      setCompleted,
      deleteTask,
      restoreTask,
      moveTask,
      createProject,
      updateProject,
      deleteProject,
      createTag,
      renameTag,
      deleteTag,
      addTagToTask,
      removeTagFromTask,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
