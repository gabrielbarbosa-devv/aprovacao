import { describe, expect, it } from "vitest";
import { questionBatchSchema } from "./schemas";

const base = {
  id: null,
  operationKey: "fd315db1-66ce-41c2-8714-8fcb27a8815c",
  studiedOn: "2026-10-17",
  subjectId: "fd315db1-66ce-41c2-8714-8fcb27a8815c",
  topicId: null,
  sourceType: "plataforma",
  sourceLabel: "QConcursos",
  examTargetId: null,
  studySessionId: null,
  questionCount: 20,
  correctCount: 15,
  durationMinutes: null,
  notes: "",
  replacesSessionTotals: false,
};

describe("question batch validation", () => {
  it("accepts a complete external practice record", () => {
    expect(questionBatchSchema.parse(base).correctCount).toBe(15);
  });

  it("rejects more correct answers than attempted questions", () => {
    expect(questionBatchSchema.safeParse({ ...base, correctCount: 21 }).success).toBe(false);
  });

  it("requires an existing study session before replacing its summary", () => {
    expect(questionBatchSchema.safeParse({ ...base, replacesSessionTotals: true }).success).toBe(false);
    expect(questionBatchSchema.safeParse({ ...base, studySessionId: "fd315db1-66ce-41c2-8714-8fcb27a8815c", replacesSessionTotals: true }).success).toBe(true);
  });
});
