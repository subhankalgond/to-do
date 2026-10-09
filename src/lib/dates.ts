import { addDays, format, parseISO, startOfWeek } from "date-fns";

export type TimeFormat = "12h" | "24h";

/** Local-timezone ISO calendar date, yyyy-MM-dd (never UTC-shifted). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  return parseISO(iso);
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function addDaysISO(iso: string, days: number): string {
  return toISODate(addDays(parseISODate(iso), days));
}

export function isOverdueISO(dueDate: string, now: Date = new Date()): boolean {
  return dueDate < todayISO(now);
}

export function isTodayISO(dueDate: string, now: Date = new Date()): boolean {
  return dueDate === todayISO(now);
}

/** "Today" | "Tomorrow" | "Yesterday" | "Fri, 10 Oct" (+ year when needed). */
export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const today = todayISO(now);
  if (iso === today) return "Today";
  if (iso === addDaysISO(today, 1)) return "Tomorrow";
  if (iso === addDaysISO(today, -1)) return "Yesterday";
  const date = parseISODate(iso);
  const sameYear = format(date, "yyyy") === format(now, "yyyy");
  return format(date, sameYear ? "EEE, d MMM" : "EEE, d MMM yyyy");
}

/** Long editorial date for headers: "Friday, 9 October 2026". */
export function formatLongDate(date: Date = new Date()): string {
  return format(date, "EEEE, d MMMM yyyy");
}

/** Compact uppercase metadata date: "FRI 9 OCT". */
export function formatShortDate(date: Date = new Date()): string {
  return format(date, "EEE d MMM").toUpperCase();
}

export function formatTime(
  time: string | null,
  timeFormat: TimeFormat = "12h",
): string {
  if (!time) return "";
  const [hRaw, mRaw] = time.split(":");
  const h = Number(hRaw);
  if (Number.isNaN(h)) return "";
  if (timeFormat === "24h") return `${String(h).padStart(2, "0")}:${mRaw}`;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mRaw} ${suffix}`;
}

/** Human due label for a task, e.g. "Today", "Overdue · Thu, 8 Oct". */
export function formatDue(
  dueDate: string | null,
  now: Date = new Date(),
): string | null {
  if (!dueDate) return null;
  const label = formatDayLabel(dueDate, now);
  return isOverdueISO(dueDate, now) ? `Overdue · ${label}` : label;
}

export function formatLongDateFromISO(iso: string): string {
  return format(parseISODate(iso), "EEEE, d MMMM yyyy");
}

/** ISO dates (Mon..Sun) for the week containing `now`. */
export function weekDays(
  now: Date = new Date(),
  weekStartsOn: 0 | 1 = 1,
): string[] {
  const start = startOfWeek(now, { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(start, i)));
}

/** "Created 2 Sep 2026" style timestamp. */
export function formatCreated(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy");
}

export function formatTimestamp(iso: string, timeFormat: TimeFormat = "12h"): string {
  const date = parseISO(iso);
  const day = format(date, "d MMM yyyy");
  const time = format(date, "HH:mm");
  return timeFormat === "24h" ? `${day} · ${time}` : `${day} · ${formatTime(time, "12h")}`;
}
