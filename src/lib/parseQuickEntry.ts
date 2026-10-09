import { addDaysISO, todayISO } from "./dates";
import type { Priority } from "../types";

export interface QuickEntryParse {
  /** The task title — unchanged from the input when no shortcut was confident. */
  title: string;
  dueDate: string | null;
  priority: Priority | null;
  /** True when a trailing shortcut was recognised and stripped from the title. */
  parsed: boolean;
}

/** JS getDay() number (0 = Sunday) for each weekday name/alias. */
const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

/** ISO date of the weekday `target` on/after `fromISO`, honouring strictness. */
function weekdayISO(target: number, now: Date, excludeToday: boolean): string {
  const today = todayISO(now);
  const current = now.getDay();
  let delta = (target - current + 7) % 7;
  if (delta === 0 && excludeToday) delta = 7;
  return addDaysISO(today, delta);
}

const DATE_PATTERNS: Array<{
  regex: RegExp;
  resolve: (m: RegExpMatchArray, now: Date) => string | null;
}> = [
  {
    regex: /^(tonight|today|tod|tomorrow|tmr|tmrw)$/i,
    resolve: (m, now) => {
      const word = m[1].toLowerCase();
      const isToday = word === "tonight" || word === "today" || word === "tod";
      return addDaysISO(todayISO(now), isToday ? 0 : 1);
    },
  },
  {
    regex: /^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)$/i,
    resolve: (m, now) => {
      const target = WEEKDAYS[m[1].toLowerCase()];
      return target === undefined ? null : weekdayISO(target, now, true);
    },
  },
  {
    regex: /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)$/i,
    resolve: (m, now) => {
      const target = WEEKDAYS[m[1].toLowerCase()];
      return target === undefined ? null : weekdayISO(target, now, false);
    },
  },
  {
    regex: /^in\s+(\d{1,3})\s+(day|days|week|weeks)$/i,
    resolve: (m, now) => {
      const n = Number(m[1]);
      const days = m[2].toLowerCase().startsWith("week") ? n * 7 : n;
      return addDaysISO(todayISO(now), days);
    },
  },
];

/**
 * Parses conservative natural-language shortcuts from a quick-entry string.
 *
 * Only unambiguous trailing phrases are recognised. When nothing confident is
 * found — or stripping would leave an empty title — the entire input is kept as
 * the title, so user text is never silently rewritten.
 */
export function parseQuickEntry(raw: string, now: Date = new Date()): QuickEntryParse {
  const input = raw.trim().replace(/\s+/g, " ");
  if (!input) return { title: "", dueDate: null, priority: null, parsed: false };

  let title = input;
  let priority: Priority | null = null;
  let dueDate: string | null = null;
  let parsed = false;

  // Trailing priority marks: "!" medium, "!!" high.
  const priorityMatch = title.match(/\s(!{1,2})$/);
  if (priorityMatch && priorityMatch.index !== undefined) {
    const stripped = title.slice(0, priorityMatch.index).trim();
    if (stripped) {
      priority = priorityMatch[1] === "!!" ? "high" : "medium";
      title = stripped;
      parsed = true;
    }
  }

  // Trailing date phrase: "Submit report tomorrow" / "Pay rent in 2 weeks".
  const words = title.split(" ");
  const candidates: string[] = [];
  if (words.length >= 3) candidates.push(words.slice(-3).join(" "));
  if (words.length >= 2) candidates.push(words.slice(-2).join(" "));
  candidates.push(words[words.length - 1]);

  for (const pattern of DATE_PATTERNS) {
    let matched: { candidate: string; match: RegExpMatchArray } | null = null;
    for (const candidate of candidates) {
      const match = candidate.match(pattern.regex);
      if (match) {
        matched = { candidate, match };
        break;
      }
    }
    if (!matched) continue;

    const resolved = pattern.resolve(matched.match, now);
    if (!resolved) continue;
    const remainder = title.slice(0, title.length - matched.candidate.length).trim();
    if (!remainder) continue; // never reduce the title to nothing
    title = remainder;
    dueDate = resolved;
    parsed = true;
    break;
  }

  return { title, dueDate, priority, parsed };
}
