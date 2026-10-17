import { describe, expect, it } from "vitest";
import { startBlockSchema, starterPlanSchema } from "./schemas";

describe("today action input", () => {
  it("accepts an ISO calendar date for the explicitly selected starter plan", () => {
    expect(starterPlanSchema.safeParse({ startDate: "2026-11-01" }).success).toBe(true);
  });

  it("rejects malformed dates and block identifiers before the database call", () => {
    expect(starterPlanSchema.safeParse({ startDate: "31/11/2026" }).success).toBe(false);
    expect(startBlockSchema.safeParse({ blockId: "not-a-uuid" }).success).toBe(false);
  });
});
