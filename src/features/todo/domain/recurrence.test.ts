import { describe, expect, it } from "vitest";
import { defaultTodoRecurrenceConfig, nextCompletionBasedDate, previewTodoOccurrences, todoRecurrenceConfigSchema } from "./recurrence";

const base = defaultTodoRecurrenceConfig("2026-10-22", "America/Sao_Paulo");

describe("To-Do recurrence calendar", () => {
  it("previews daily water reminders and business days", () => {
    expect(previewTodoOccurrences({ ...base, frequency: "daily", startsOn: "2026-10-22" })).toEqual(["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"]);
    expect(previewTodoOccurrences({ ...base, frequency: "weekdays", startsOn: "2026-10-22" })).toEqual(["2026-10-22", "2026-10-23", "2026-10-26", "2026-10-27", "2026-10-28"]);
  });

  it("supports selected weekdays and custom two-week rules", () => {
    expect(previewTodoOccurrences({ ...base, frequency: "weekly", interval: 1, weekdays: [1, 3, 5], startsOn: "2026-10-22" })).toEqual(["2026-10-23", "2026-10-26", "2026-10-28", "2026-10-30", "2026-11-02"]);
    expect(previewTodoOccurrences({ ...base, frequency: "custom", customUnit: "week", interval: 2, weekdays: [1], startsOn: "2026-10-19" })).toEqual(["2026-10-19", "2026-11-02", "2026-11-16", "2026-11-30", "2026-12-14"]);
  });

  it("skips nonexistent monthly dates without silently changing the selected day", () => {
    expect(previewTodoOccurrences({ ...base, frequency: "monthly", monthDay: 31, startsOn: "2026-01-31" })).toEqual(["2026-01-31", "2026-03-31", "2026-05-31", "2026-07-31", "2026-08-31"]);
    expect(previewTodoOccurrences({ ...base, frequency: "monthly", monthlyMode: "last_day", startsOn: "2026-02-01" })).toEqual(["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30"]);
  });

  it("handles yearly leap days, limits, and completion-based intervals", () => {
    expect(previewTodoOccurrences({ ...base, frequency: "yearly", annualMonth: 2, annualDay: 29, startsOn: "2024-02-29" })).toEqual(["2024-02-29", "2028-02-29", "2032-02-29", "2036-02-29", "2040-02-29"]);
    expect(previewTodoOccurrences({ ...base, frequency: "daily", interval: 1, maxOccurrences: 3 })).toHaveLength(3);
    expect(nextCompletionBasedDate({ ...base, frequency: "daily", interval: 2 }, "2026-10-22")).toBe("2026-10-24");
    expect(nextCompletionBasedDate({ ...base, frequency: "monthly", monthDay: 31 }, "2026-01-31")).toBe("2026-03-31");
    expect(nextCompletionBasedDate({ ...base, frequency: "yearly", annualMonth: 2, annualDay: 29 }, "2025-03-15")).toBe("2028-02-29");
  });

  it("rejects contradictory schedules and invalid time zones", () => {
    expect(todoRecurrenceConfigSchema.safeParse({ ...base, frequency: "weekly", weekdays: [1], scheduleBasis: "completion" }).success).toBe(false);
    expect(todoRecurrenceConfigSchema.safeParse({ ...base, scheduleBasis: "completion", frequency: "weekdays" }).success).toBe(false);
    expect(todoRecurrenceConfigSchema.safeParse({ ...base, timezone: "Mars/Olympus" }).success).toBe(false);
  });
});
