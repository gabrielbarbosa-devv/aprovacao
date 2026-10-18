import { describe, expect, it } from "vitest";
import { createSubjectSchema, reorderSubjectsSchema, subjectNameSchema, updateSubjectFocusSchema } from "./schemas";

describe("subject schemas", () => {
  it("normalizes spacing before the subject is persisted", () => {
    expect(subjectNameSchema.parse("  Direito   Penal  ")).toBe("Direito Penal");
  });

  it("rejects empty names and unsupported color tokens", () => {
    expect(createSubjectSchema.safeParse({ name: "   ", colorToken: "blue" }).success).toBe(false);
    expect(createSubjectSchema.safeParse({ name: "Português", colorToken: "teal" }).success).toBe(false);
  });

  it("accepts a valid subject and an optional color", () => {
    expect(createSubjectSchema.parse({ name: " Português ", colorToken: null })).toEqual({ name: "Português", colorToken: null });
  });

  it("accepts a non-empty reorder list and rejects duplicate IDs", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(reorderSubjectsSchema.safeParse([id]).success).toBe(true);
    expect(reorderSubjectsSchema.safeParse([id, id]).success).toBe(false);
  });

  it("accepts only an explicit focus choice for a valid subject", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(updateSubjectFocusSchema.parse({ id, isFocus: true })).toEqual({ id, isFocus: true });
    expect(updateSubjectFocusSchema.safeParse({ id, isFocus: "true" }).success).toBe(false);
    expect(updateSubjectFocusSchema.safeParse({ id: "subject-1", isFocus: false }).success).toBe(false);
  });
});
