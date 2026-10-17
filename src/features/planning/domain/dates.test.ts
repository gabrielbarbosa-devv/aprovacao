import { describe, expect, it } from "vitest";
import { getWeekStart, isStudyDate } from "./dates";

describe("planning date helpers", () => {
  it("starts the calendar on Sunday and crosses month boundaries safely", () => {
    expect(getWeekStart("2026-10-18")).toBe("2026-10-18");
    expect(getWeekStart("2026-11-01")).toBe("2026-11-01");
    expect(getWeekStart("2026-11-02")).toBe("2026-11-01");
  });

  it("rejects impossible date-only values", () => {
    expect(isStudyDate("2026-02-29")).toBe(false);
    expect(isStudyDate("2024-02-29")).toBe(true);
  });
});
