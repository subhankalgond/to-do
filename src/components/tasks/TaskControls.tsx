import { useData } from "../../context/DataContext";
import { useSettings } from "../../context/SettingsContext";
import { EMPTY_FILTERS, type SortMode, type TaskFilters } from "../../types";
import { hasActiveFilters } from "../../lib/taskQuery";
import { IconSearch } from "../ui/Icons";
import { cn } from "../../lib/cn";

interface TaskControlsProps {
  filters: TaskFilters;
  onFiltersChange(filters: TaskFilters): void;
  sort: SortMode;
  onSortChange(mode: SortMode): void;
  showProject?: boolean;
  showStatus?: boolean;
  showDate?: boolean;
  resultCount: number;
  totalCount: number;
  compact?: boolean;
}

const SORT_LABELS: Array<{ value: SortMode; label: string }> = [
  { value: "manual", label: "Manual order" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title" },
];

export function TaskControls({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  showProject = true,
  showStatus = true,
  showDate = true,
  resultCount,
  totalCount,
  compact = false,
}: TaskControlsProps) {
  const { projects, tags } = useData();
  const { prefs, updatePreferences } = useSettings();
  const active = hasActiveFilters(filters);

  const set = (patch: Partial<TaskFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="border-b px-5 py-4 sm:px-8" style={{ borderColor: "var(--line)" }}>
      <div className={cn("flex flex-wrap items-end gap-3", compact && "gap-2")}>
        {/* Search */}
        <div className="relative min-w-56 flex-1">
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>
          <span
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
            aria-hidden="true"
          >
            <IconSearch />
          </span>
          <input
            id="task-search"
            type="search"
            className="input pl-9"
            placeholder="Search titles and notes…"
            value={filters.query}
            onChange={(event) => set({ query: event.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {showStatus ? (
            <SelectField
              id="filter-status"
              label="Status"
              value={filters.status}
              onChange={(value) => set({ status: value as TaskFilters["status"] })}
              options={[
                { value: "all", label: "Any status" },
                { value: "active", label: "Open" },
                { value: "completed", label: "Completed" },
              ]}
            />
          ) : null}

          <SelectField
            id="filter-priority"
            label="Priority"
            value={filters.priority}
            onChange={(value) => set({ priority: value as TaskFilters["priority"] })}
            options={[
              { value: "all", label: "Any priority" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />

          {showDate ? (
            <SelectField
              id="filter-date"
              label="Date"
              value={filters.dateScope}
              onChange={(value) => set({ dateScope: value as TaskFilters["dateScope"] })}
              options={[
                { value: "any", label: "Any date" },
                { value: "overdue", label: "Overdue" },
                { value: "today", label: "Due today" },
                { value: "upcoming", label: "Upcoming" },
                { value: "someday", label: "No date" },
              ]}
            />
          ) : null}

          {showProject ? (
            <SelectField
              id="filter-project"
              label="Project"
              value={filters.projectId}
              onChange={(value) => set({ projectId: value as TaskFilters["projectId"] })}
              options={[
                { value: "all", label: "All projects" },
                { value: "none", label: "No project" },
                ...projects.map((project) => ({ value: project.id, label: project.name })),
              ]}
            />
          ) : null}

          <SelectField
            id="filter-tag"
            label="Tag"
            value={filters.tagId}
            onChange={(value) => set({ tagId: value })}
            options={[
              { value: "all", label: "Any tag" },
              ...tags.map((tag) => ({ value: tag.id, label: `#${tag.name}` })),
            ]}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Showing <span className="tabular-nums">{resultCount}</span> of{" "}
          <span className="tabular-nums">{totalCount}</span> tasks
          {active ? (
            <button
              type="button"
              className="ml-3 underline underline-offset-2"
              style={{ color: "var(--olive-deep)" }}
              onClick={() => onFiltersChange({ ...EMPTY_FILTERS })}
            >
              Clear filters
            </button>
          ) : null}
        </p>

        <div className="flex items-center gap-2">
          <label htmlFor="sort-mode" className="eyebrow">
            Sort
          </label>
          <select
            id="sort-mode"
            className="input w-auto min-h-8 py-1 text-xs"
            value={sort}
            onChange={(event) => {
              const mode = event.target.value as SortMode;
              onSortChange(mode);
              if (mode !== prefs.defaultSort) updatePreferences({ defaultSort: mode });
            }}
          >
            {SORT_LABELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
  options: Array<{ value: string; label: string }>;
}) {
  const changed = value !== options[0].value;
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        className={cn("input w-auto min-h-9 py-1 text-xs")}
        style={changed ? { borderColor: "var(--olive)" } : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
