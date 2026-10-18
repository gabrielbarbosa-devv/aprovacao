import { describe, expect, it } from "vitest";
import { completeReviewSchema, snoozeReviewSchema } from "./schemas";

const reviewId = "9c11b5e7-e980-4c97-98ef-e9d0e8ac8600";

describe("review workflow inputs", () => {
  it("accepts a completed external review with optional results", () => {
    expect(completeReviewSchema.safeParse({
      reviewId, reviewedOn: "2026-10-18", difficulty: 5, scheduleReinforcement: true,
      questionCount: 20, correctCount: 14, notes: "Rever inferência textual",
    }).success).toBe(true);
    expect(completeReviewSchema.safeParse({
      reviewId, reviewedOn: "2026-10-18", difficulty: 1, scheduleReinforcement: false,
      questionCount: null, correctCount: null, notes: null,
    }).success).toBe(true);
  });

  it("rejects impossible counts and one-sided optional results", () => {
    expect(completeReviewSchema.safeParse({
      reviewId, reviewedOn: "2026-10-18", difficulty: 3, scheduleReinforcement: false,
      questionCount: 4, correctCount: 5, notes: null,
    }).success).toBe(false);
    expect(completeReviewSchema.safeParse({
      reviewId, reviewedOn: "2026-10-18", difficulty: 3, scheduleReinforcement: false,
      questionCount: 4, correctCount: null, notes: null,
    }).success).toBe(false);
  });

  it("requires a valid task and a date to snooze", () => {
    expect(snoozeReviewSchema.safeParse({ reviewId, newDueOn: "2026-10-20", reason: "Compromisso" }).success).toBe(true);
    expect(snoozeReviewSchema.safeParse({ reviewId: "invalid", newDueOn: "20/10/2026", reason: null }).success).toBe(false);
  });
});
