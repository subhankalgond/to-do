import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  formatDayLabel,
  formatDue,
  formatTime,
  isOverdueISO,
  toISODate,
  weekDays,
} from "./dates";

const now = new Date(2026, 9, 7, 14, 30); // Wednesday, 7 October 2026

describe("date helpers", () => {
  it("formats local ISO dates without UTC shifting", () => {
    expect(toISODate(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(toISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("adds days across month boundaries", () => {
    expect(addDaysISO("2026-10-30", 5)).toBe("2026-11-04");
  });

  it("detects overdue dates against the current date", () => {
    expect(isOverdueISO("2026-10-06", now)).toBe(true);
    expect(isOverdueISO("2026-10-07", now)).toBe(false);
    expect(isOverdueISO("2026-10-08", now)).toBe(false);
  });

  it("labels relative days", () => {
    expect(formatDayLabel("2026-10-07", now)).toBe("Today");
    expect(formatDayLabel("2026-10-08", now)).toBe("Tomorrow");
    expect(formatDayLabel("2026-10-06", now)).toBe("Yesterday");
    expect(formatDayLabel("2026-10-09", now)).toBe("Fri, 9 Oct");
    expect(formatDayLabel("2027-01-15", now)).toBe("Fri, 15 Jan 2027");
  });

  it("marks overdue dates in due labels", () => {
    expect(formatDue("2026-10-06", now)).toBe("Overdue · Yesterday");
    expect(formatDue("2026-10-05", now)).toBe("Overdue · Mon, 5 Oct");
    expect(formatDue("2026-10-07", now)).toBe("Today");
    expect(formatDue(null, now)).toBeNull();
  });

  it("formats times in 12h and 24h", () => {
    expect(formatTime("09:30", "12h")).toBe("9:30 AM");
    expect(formatTime("14:05", "12h")).toBe("2:05 PM");
    expect(formatTime("00:15", "12h")).toBe("12:15 AM");
    expect(formatTime("12:00", "12h")).toBe("12:00 PM");
    expect(formatTime("14:05", "24h")).toBe("14:05");
    expect(formatTime(null)).toBe("");
  });

  it("builds a week starting on the configured day", () => {
    expect(weekDays(now, 1)[0]).toBe("2026-10-05"); // Monday
    expect(weekDays(now, 0)[0]).toBe("2026-10-04"); // Sunday
    expect(weekDays(now, 1)).toHaveLength(7);
  });
});
