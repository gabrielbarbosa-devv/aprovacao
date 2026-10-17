import { describe, expect, it } from "vitest";
import { addStudyDays, formatStudyDate, getStudyDay } from "./study-day";

describe("study day helpers", () => {
  it("uses the account timezone when determining today", () => {
    const instant = new Date("2026-10-18T02:30:00.000Z");
    expect(getStudyDay("America/Sao_Paulo", instant)).toBe("2026-10-17");
    expect(getStudyDay("UTC", instant)).toBe("2026-10-18");
  });

  it("adds calendar days across month boundaries and formats them in Brazilian Portuguese", () => {
    const tomorrow = addStudyDays("2026-10-31", 1);
    expect(tomorrow).toBe("2026-11-01");
    expect(formatStudyDate(tomorrow, "short")).toContain("1 de novembro");
  });
});
