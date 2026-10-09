import { useMemo, useState } from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { cn } from "../lib/cn";
import { formatCreated } from "../lib/dates";
import type { SortMode, ThemePreference } from "../types";

export function SettingsPage() {
  const { profile, user, saveProfile, signOut, sendPasswordReset, deleteAccount } = useAuth();
  const { prefs, updatePreferences } = useSettings();
  const { tasks, projects, tags, status } = useData();
  const { notify } = useToast();

  const [name, setName] = useState(profile?.display_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const userEmail = user?.email ?? "";

  const hasLocalChanges = useMemo(
    () => (profile?.display_name ?? "") !== name.trim() && name.trim().length > 0,
    [profile, name],
  );

  const saveName = async () => {
    if (savingName) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("A display name can’t be empty.");
      return;
    }
    setSavingName(true);
    const result = await saveProfile({ display_name: trimmed });
    setSavingName(false);
    if (result.error) {
      setNameError(result.error);
      return;
    }
    setNameError(null);
    notify("Name saved.");
  };

  const exportData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      profile: profile
        ? {
            display_name: profile.display_name,
            created_at: profile.created_at,
            preferences: prefs,
          }
        : null,
      projects,
      tags,
      tasks: tasks.map(({ tags: taskTags, ...task }) => ({
        ...task,
        tag_names: taskTags.map((tag) => tag.name),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fieldnotes-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    notify("Export downloaded.");
  };

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="SETTINGS"
        title="How this reads to you."
        lede="Preferences apply immediately on this device and are saved to your account when you are signed in."
      />

      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        {/* Appearance */}
        <Section title="Appearance" description="FIELDNOTES reads like paper by day and charcoal by night.">
          <fieldset>
            <legend className="field-label">Theme</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "light", label: "Light", hint: "Warm ivory" },
                  { value: "dark", label: "Dark", hint: "Charcoal" },
                  { value: "system", label: "System", hint: "Follow device" },
                ] as Array<{ value: ThemePreference; label: string; hint: string }>
              ).map((option) => {
                const active = prefs.theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    className={cn("btn min-w-28 flex-col items-start gap-0.5 py-2")}
                    style={{
                      borderColor: active ? "var(--olive)" : "var(--line-strong)",
                      background: active ? "var(--olive-wash)" : "transparent",
                    }}
                    onClick={() => updatePreferences({ theme: option.value })}
                  >
                    <span style={{ color: active ? "var(--olive-deep)" : "var(--ink)" }}>{option.label}</span>
                    <span className="text-[11px] font-normal" style={{ color: "var(--muted)" }}>
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </Section>

        {/* Dates and time */}
        <Section title="Dates and time" description="Controls how dates, times and lists are presented.">
          <div className="grid gap-5 sm:grid-cols-3">
            <SelectSetting
              id="setting-time-format"
              label="Time format"
              value={prefs.timeFormat}
              onChange={(value) => updatePreferences({ timeFormat: value as "12h" | "24h" })}
              options={[
                { value: "12h", label: "9:30 PM" },
                { value: "24h", label: "21:30" },
              ]}
            />
            <SelectSetting
              id="setting-week-start"
              label="Week starts"
              value={prefs.weekStart}
              onChange={(value) => updatePreferences({ weekStart: value as "mon" | "sun" })}
              options={[
                { value: "mon", label: "Monday" },
                { value: "sun", label: "Sunday" },
              ]}
            />
            <SelectSetting
              id="setting-default-sort"
              label="Default sort"
              value={prefs.defaultSort}
              onChange={(value) => updatePreferences({ defaultSort: value as SortMode })}
              options={[
                { value: "manual", label: "Manual order" },
                { value: "due", label: "Due date" },
                { value: "priority", label: "Priority" },
                { value: "created", label: "Date created" },
                { value: "title", label: "Title" },
              ]}
            />
          </div>
        </Section>

        {/* Account */}
        <Section title="Account" description={profile ? `Member since ${formatCreated(profile.created_at)}.` : undefined}>
          <div className="grid gap-5">
            <div>
              <label className="field-label" htmlFor="settings-display-name">
                Display name
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="settings-display-name"
                  className="input max-w-xs"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (nameError) setNameError(null);
                  }}
                  aria-invalid={nameError ? true : undefined}
                  maxLength={80}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => void saveName()}
                  disabled={!hasLocalChanges || savingName}
                >
                  {savingName ? "Saving…" : "Save name"}
                </button>
              </div>
              {nameError ? (
                <p role="alert" className="mt-1.5 text-xs" style={{ color: "var(--terracotta-deep)" }}>
                  {nameError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => setRequestingReset(true)}>
                Send password reset
              </button>
              <button type="button" className="btn" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
            {resetSent ? (
              <p className="text-xs" role="status" style={{ color: "var(--muted)" }}>
                If that address has an account, a reset link is on its way.
              </p>
            ) : null}
          </div>
        </Section>

        {/* Data */}
        <Section
          title="Data"
          description="Your tasks, projects and tags live in your account. Nothing is stored on this device except your display preferences."
        >
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn" onClick={exportData} disabled={status === "loading"}>
              Export as JSON
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
              Delete account
            </button>
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
            {tasks.length} task{tasks.length === 1 ? "" : "s"}, {projects.length} project
            {projects.length === 1 ? "" : "s"}, {tags.length} tag{tags.length === 1 ? "" : "s"} currently stored.
          </p>
        </Section>

        <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--line)" }}>
          <p className="eyebrow">Fieldnotes · Editorial task management</p>
        </div>
      </div>

      <PasswordResetModal
        key={requestingReset ? "open" : "closed"}
        open={requestingReset}
        defaultEmail={userEmail}
        sending={sendingReset}
        onClose={() => setRequestingReset(false)}
        onSend={async (email) => {
          setSendingReset(true);
          const result = await sendPasswordReset(email);
          setSendingReset(false);
          if (result.error) return result.error;
          setRequestingReset(false);
          setResetSent(true);
          return null;
        }}
      />

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete your account?"
        description="This permanently removes your profile, tasks, projects and tags. It cannot be undone."
        footer={
          <>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmingDelete(false)}>
              Keep my account
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                const result = await deleteAccount();
                setDeleting(false);
                if (result.error) {
                  notify(result.error, { tone: "error" });
                  return;
                }
                setConfirmingDelete(false);
              }}
            >
              {deleting ? "Deleting…" : "Delete everything"}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Export your data first if you want a copy — after deletion it cannot be recovered, and every
          row tied to your account is removed from the database.
        </p>
      </Modal>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b py-8" style={{ borderColor: "var(--line)" }}>
      <h2 className="font-serif text-xl">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-prose text-sm" style={{ color: "var(--muted)" }}>
          {description}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SelectSetting({
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
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PasswordResetModal({
  open,
  defaultEmail,
  sending,
  onClose,
  onSend,
}: {
  open: boolean;
  defaultEmail: string;
  sending: boolean;
  onClose(): void;
  onSend(email: string): Promise<string | null>;
}) {
  // State hydrates at mount; the parent remounts via `key` when reopened.
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset your password"
      description="We’ll email a secure link to set a new one."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="reset-password-form"
            className="btn btn-solid"
            disabled={sending}
          >
            {sending ? "Sending…" : "Send link"}
          </button>
        </>
      }
    >
      <form
        id="reset-password-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (sending) return;
          if (!email.trim()) {
            setError("Enter the email for your account.");
            return;
          }
          const sendError = await onSend(email.trim());
          if (sendError) setError(sendError);
        }}
      >
        <label className="field-label" htmlFor="reset-password-email">
          Email
        </label>
        <input
          id="reset-password-email"
          type="email"
          className="input"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
          autoComplete="email"
          required
          autoFocus
        />
        {error ? (
          <p role="alert" className="mt-2 text-xs" style={{ color: "var(--terracotta-deep)" }}>
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
