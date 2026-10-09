import { describe, expect, it } from "vitest";
import { parseQuickEntry } from "./parseQuickEntry";
import { addDaysISO, todayISO } from "./dates";

// Fixed reference date: Wednesday, 7 October 2026 (local time).
const now = new Date(2026, 9, 7, 14, 30);

describe("parseQuickEntry", () => {
  it("returns the whole input as the title when nothing is recognised", () => {
    const result = parseQuickEntry("Prepare the quarterly board deck", now);
    expect(result.title).toBe("Prepare the quarterly board deck");
    expect(result.dueDate).toBeNull();
    expect(result.priority).toBeNull();
    expect(result.parsed).toBe(false);
  });

  it("parses a trailing 'tomorrow' and strips it from the title", () => {
    const result = parseQuickEntry("Submit report tomorrow", now);
    expect(result.title).toBe("Submit report");
    expect(result.dueDate).toBe(addDaysISO(todayISO(now), 1));
    expect(result.parsed).toBe(true);
  });

  it("parses 'today'", () => {
    const result = parseQuickEntry("Water the plants today", now);
    expect(result.title).toBe("Water the plants");
    expect(result.dueDate).toBe(todayISO(now));
  });

  it("never reduces the title to an empty string", () => {
    const result = parseQuickEntry("tomorrow", now);
    expect(result.title).toBe("tomorrow");
    expect(result.dueDate).toBeNull();
    expect(result.parsed).toBe(false);
  });

  it("keeps weekday words that are not trailing", () => {
    const result = parseQuickEntry("Call the Monday printer", now);
    expect(result.title).toBe("Call the Monday printer");
    expect(result.dueDate).toBeNull();
  });

  it("resolves a trailing weekday to its next occurrence", () => {
    // now is Wednesday → "friday" is 2026-10-09
    expect(parseQuickEntry("Send newsletter friday", now).dueDate).toBe("2026-10-09");
    // "monday" is next Monday, 2026-10-12
    expect(parseQuickEntry("Review budget monday", now).dueDate).toBe("2026-10-12");
  });

  it("resolves 'next <weekday>' including the today case as +7 days", () => {
    const monday = new Date(2026, 9, 5, 9, 0);
    expect(parseQuickEntry("Standup next monday", monday).dueDate).toBe("2026-10-12");
    expect(parseQuickEntry("Standup monday", monday).dueDate).toBe("2026-10-05");
  });

  it("parses 'in N days' and 'in N weeks'", () => {
    expect(parseQuickEntry("File taxes in 3 days", now).dueDate).toBe("2026-10-10");
    expect(parseQuickEntry("Renew passport in 2 weeks", now).dueDate).toBe("2026-10-21");
  });

  it("parses trailing priority marks", () => {
    expect(parseQuickEntry("Fix outage !!", now)).toEqual({
      title: "Fix outage",
      dueDate: null,
      priority: "high",
      parsed: true,
    });
    expect(parseQuickEntry("Fix login bug !", now).priority).toBe("medium");
  });

  it("parses date and priority together", () => {
    const result = parseQuickEntry("Ship release tomorrow !!", now);
    expect(result.title).toBe("Ship release");
    expect(result.dueDate).toBe(addDaysISO(todayISO(now), 1));
    expect(result.priority).toBe("high");
  });

  it("does not treat a bare exclamation as a priority", () => {
    const result = parseQuickEntry("Wow!", now);
    expect(result.title).toBe("Wow!");
    expect(result.priority).toBeNull();
  });

  it("handles empty and whitespace input", () => {
    expect(parseQuickEntry("   ", now).title).toBe("");
    expect(parseQuickEntry("", now).parsed).toBe(false);
  });

  it("collapses repeated whitespace", () => {
    expect(parseQuickEntry("Buy   milk   tomorrow", now).title).toBe("Buy milk");
  });
});
