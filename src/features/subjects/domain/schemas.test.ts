import { describe, expect, it } from "vitest";
import { createSubjectSchema, subjectNameSchema } from "./schemas";

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
});
