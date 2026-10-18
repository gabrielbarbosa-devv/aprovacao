import { describe, expect, it } from "vitest";
import { resolveAnalyticsFilters } from "./filters";

const subjectIds = new Set(["subject-1"]);

describe("analytics URL filters", () => {
  it("defaults to the last 30 inclusive local study dates", () => {
    expect(resolveAnalyticsFilters({}, "2026-10-17", subjectIds).filters).toMatchObject({ period: "30", from: "2026-09-18", to: "2026-10-17" });
  });

  it("supports preset periods and preserves only a valid owner subject", () => {
    expect(resolveAnalyticsFilters({ period: "7", subject: "subject-1", sort: "correct" }, "2026-10-17", subjectIds).filters)
      .toMatchObject({ period: "7", from: "2026-10-11", subjectId: "subject-1", sortBy: "correct" });
    expect(resolveAnalyticsFilters({ subject: "not-owned" }, "2026-10-17", subjectIds).filters.subjectId).toBeNull();
  });

  it("accepts inclusive custom ranges and resets invalid dates to a safe 30-day range", () => {
    expect(resolveAnalyticsFilters({ period: "custom", from: "2026-10-01", to: "2026-10-17" }, "2026-10-17", subjectIds))
      .toMatchObject({ filters: { from: "2026-10-01", to: "2026-10-17" }, invalidCustomRange: false });
    expect(resolveAnalyticsFilters({ period: "custom", from: "2026-02-31", to: "2026-10-17" }, "2026-10-17", subjectIds))
      .toMatchObject({ filters: { from: "2026-09-18", to: "2026-10-17" }, invalidCustomRange: true });
  });
});
