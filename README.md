# FIELDNOTES

An editorial task manager for deliberate daily work. FIELDNOTES pairs a
print-inspired reading experience — Newsreader serif headlines, IBM Plex Sans
metadata, warm ivory paper, hairline rules — with a complete task system:
projects, tags, priorities, due dates, natural-language quick entry, manual
ordering, search, filters, light/dark themes, and multi-user accounts backed by
PostgreSQL row-level security.

---

## Stack

| Layer      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Frontend   | React 19 · TypeScript · Vite · Tailwind CSS v4            |
| Routing    | React Router (SPA, `?task=` selection state)              |
| Dates      | date-fns                                                  |
| Backend    | Supabase — PostgreSQL, Auth, Row Level Security           |
| Tests      | Vitest + Testing Library (47 tests)                       |
| Deploy     | Vercel (static build + SPA fallback)                      |

No drag-and-drop dependency: ordering uses native HTML5 drag events plus a
keyboard path (Alt + ↑/↓ on a task, or "Move up/down" in its menu), persisted
via fractional `sort_order` values.

---

## Features

- **Views** — Overview digest, Today (overdue → due today → completed today,
  week strip), Upcoming (grouped by day), All Tasks (search/filter/sort),
  Completed history, Someday, per-project pages, Settings.
- **Tasks** — create (modal or inline composer), edit (autosaving title/notes),
  complete/reopen, delete with undo toast, three priorities, due date + time.
- **Quick entry** — trailing natural language: `tomorrow`, `tonight`, weekdays,
  `next friday`, `in 3 days`, `in 2 weeks`; `!`/`!!` for medium/high priority.
  Unrecognised input is kept verbatim as the title — never silently rewritten.
- **Projects** — create, rename, delete with explicit task reassignment flow.
- **Tags** — per-user, case-insensitive, attach/remove on tasks, tag filter.
- **Ordering** — manual (drag or keyboard), due date, priority, created, title.
  Manual order persists through the database.
- **Themes** — light (ivory/ink/olive) and dark (charcoal, not an inversion),
  persisted locally and to your profile; follows the system by default.
- **Auth** — email sign-up/sign-in, session restore, password reset email,
  account deletion (cascades all owned rows at the database level).
- **Accessibility** — semantic landmarks, labelled controls, focus-trapped
  dialogs, visible focus rings, `aria-live` status announcements, priority
  never encoded by colour alone, reduced-motion support.

---

## Local development

### 1. Install

```bash
npm install
```

### 2. Configure Supabase

Create a free project at [supabase.com](https://supabase.com), then:

```bash
cp .env.example .env.local
```

Fill in `.env.local` from **Project Settings → API**:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-ANON-KEY
```

Only the publishable **anon** key belongs in the client. Never place the
service-role key in `.env*` files — it bypasses RLS entirely.

### 3. Apply the database migration

Option A — CLI (recommended):

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push
```

Option B — dashboard: open **SQL Editor**, paste the contents of
[supabase/migrations/20261009000001_init.sql](supabase/migrations/20261009000001_init.sql),
and run it. The migration creates the tables, indexes, triggers, RLS policies,
and the `delete_account()` function.

### 4. Configure authentication URLs

In the Supabase dashboard (**Authentication → URL Configuration**):

- **Site URL**: `http://localhost:5173` (and your production URL later)
- Add `http://localhost:5173/**` and `https://YOUR-DOMAIN/**` to Redirect URLs.

Password-reset emails point at `${origin}/signin?reset=1`.

### 5. Run

```bash
npm run dev        # http://localhost:5173
```

---

## Scripts

| Command             | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Vite dev server                          |
| `npm run build`     | Typecheck + production build (`dist/`)   |
| `npm run preview`   | Serve the production build locally       |
| `npm run typecheck` | `tsc -b` only                            |
| `npm run lint`      | ESLint                                   |
| `npm test`          | Vitest (unit + component tests)          |

---

## Deployment (Vercel)

1. Push this repository to GitHub/GitLab.
2. In Vercel, **Add New → Project** and import the repo. The included
   [vercel.json](vercel.json) sets the Vite framework, SPA rewrite, asset
   caching, and baseline security headers — no extra configuration needed.
3. Add the environment variables (Production **and** Preview):

   | Variable                  | Value                          |
   | ------------------------- | ------------------------------ |
   | `VITE_SUPABASE_URL`       | your Supabase project URL      |
   | `VITE_SUPABASE_ANON_KEY`  | your publishable anon key      |

4. Deploy, then add the production domain to Supabase **Site URL** and
   **Redirect URLs** so sign-ups and password resets redirect correctly.

### Pre-deploy checklist

- [ ] `npm run build` succeeds (typecheck included)
- [ ] `npm test` green
- [ ] Migration applied to the production database
- [ ] Redirect URLs include the production domain
- [ ] No `.env.local` committed (it is git-ignored); only `.env.example` ships
- [ ] RLS enabled on every table (the migration does this — verify in the
      dashboard that each table shows "RLS enabled" with the policies below)

### Security model

Every table carries `enable row level security` with policies of the form
`auth.uid() = user_id`, so the database itself enforces that a session can only
read and write its own rows — the frontend's filters are a convenience, not the
defence. `delete_account()` is a `security definer` function restricted to
`authenticated` users that removes the auth user; owned data cascades via
foreign keys. Input is constrained at both ends: client-side validation plus
`check` constraints (`title ≤ 300 chars`, priority enum, per-user unique tag
names) in PostgreSQL.

---

## Project structure

```
src/
  components/
    layout/    AppShell, Sidebar, PageHeader
    tasks/     TaskRow, TaskGroupedList, TaskDetails, QuickAdd,
               TaskControls, TaskCheckbox, PriorityMark
    ui/        Modal (focus trap), Dropdown, Icons, EmptyState
  context/     AuthContext, DataContext, SettingsContext, ToastContext, UIContext
  lib/         supabase client, dates, parseQuickEntry, taskQuery, reorder
  pages/       Auth, Overview, Today, Upcoming, AllTasks, Completed,
               Someday, Projects, Project, Settings
supabase/
  migrations/  20261009000001_init.sql
```

---

## Testing

`npm test` runs 47 Vitest tests covering the quick-entry parser (including the
never-rewrite-user-text guarantees), date helpers, stats/filter/sort/group
selectors, reorder computation, and the Today page component (grouping, live
stats, completion, composer parsing, empty submission guard). The RLS policies
above are declarative SQL verified against Supabase in production; see the
migration file for the exact policy definitions to review.

## Notes

- No task data is ever stored outside your Supabase project; local storage
  holds only the theme/preferences cache and the auth session.
- Network failures surface as toasts or full-page error states with a retry —
  optimistic edits roll back on failure, and a success message is only shown
  after the database confirms.
