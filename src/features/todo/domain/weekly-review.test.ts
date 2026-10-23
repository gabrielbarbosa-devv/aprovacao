import { describe, expect, it } from "vitest";
import { isMondayKey, plannedWeekDays, weeklyReviewStart } from "./weekly-review";

describe("weekly review periods", () => {
  it("uses a stable Monday key for any day in the same week", () => {
    expect(weeklyReviewStart(new Date(2026, 9, 19, 15))).toBe("2026-10-19");
    expect(weeklyReviewStart(new Date(2026, 9, 25, 10))).toBe("2026-10-19");
  });

  it("plans seven distinct dates in the following week", () => {
    expect(plannedWeekDays("2026-10-19").map(({ key }) => key)).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
  });

  it("accepts only actual Monday dates", () => {
    expect(isMondayKey("2026-10-19")).toBe(true);
    expect(isMondayKey("2026-10-20")).toBe(false);
    expect(isMondayKey("2026-02-30")).toBe(false);
  });
});
