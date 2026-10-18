import { describe, expect, it } from "vitest";
import { archiveExamTargetSchema, examTargetSchema } from "./schemas";

const validTarget = {
  id: null,
  examName: " PRF ",
  institution: "Polícia Rodoviária Federal",
  roleTitle: "Policial Rodoviário Federal",
  jurisdiction: "Federal",
  currentStage: "em_preparacao",
  priority: "media",
  examDate: null,
  applicationDeadline: null,
  officialUrl: "",
  notes: "",
  subjectIds: [],
  topicIds: [],
};

describe("exam target schemas", () => {
  it("normalizes metadata and accepts a valid target", () => {
    const parsed = examTargetSchema.parse(validTarget);
    expect(parsed.examName).toBe("PRF");
    expect(parsed.notes).toBeNull();
  });

  it("rejects non-HTTP source links and invalid date ordering", () => {
    expect(examTargetSchema.safeParse({ ...validTarget, officialUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(examTargetSchema.safeParse({ ...validTarget, examDate: "2026-10-18", applicationDeadline: "2026-10-19" }).success).toBe(false);
  });

  it("rejects duplicated associations and invalid archive IDs", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(examTargetSchema.safeParse({ ...validTarget, subjectIds: [id, id] }).success).toBe(false);
    expect(archiveExamTargetSchema.safeParse({ id: "invalid", archived: true }).success).toBe(false);
  });
});
