import { describe, expect, it } from "vitest";
import { getAccuracy, getMistakeCount, studySessionSchema } from "./schemas";
import { addStudyDays } from "../../../lib/date/study-day";

describe("study session results", () => {
  it("calculates 15 correct answers out of 20 and five mistakes", () => {
    expect(getAccuracy(20, 15)).toBe(75);
    expect(getMistakeCount(20, 15)).toBe(5);
  });

  it("does not show accuracy when no questions were recorded", () => {
    expect(getAccuracy(0, 0)).toBeNull();
  });

  it("rejects negative values and more correct answers than questions", () => {
    const base = { sessionId: null, operationKey: "fd315db1-66ce-41c2-8714-8fcb27a8815c", blockId: null, topicId: "fd315db1-66ce-41c2-8714-8fcb27a8815c", studiedOn: "2026-10-18", durationMinutes: 30, questionCount: 10, correctCount: 11, notes: "" };
    expect(studySessionSchema.safeParse(base).success).toBe(false);
    expect(studySessionSchema.safeParse({ ...base, questionCount: -1, correctCount: 0 }).success).toBe(false);
  });

  it("schedules review offsets across the end of the year", () => {
    expect([1, 7, 30].map((offset) => addStudyDays("2026-12-25", offset))).toEqual([
      "2026-12-26", "2027-01-01", "2027-01-24",
    ]);
  });
});
