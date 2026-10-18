import { describe, expect, it } from "vitest";
import { filterMistakeEntries, type MistakeListRecord } from "./types";

const records: MistakeListRecord[] = [
  { id: "1", subjectId: "subject-1", topicId: "topic-1", questionBatchId: null, reason: "interpretacao", thought: "Confundi a inferência", correctRule: "A resposta deve estar no texto", nextStep: null, externalReference: null, status: "needs_review", createdAt: "2026-10-15T12:00:00Z", updatedAt: "2026-10-15T12:00:00Z", subjectName: "Português", topicTitle: "Inferência", batch: null },
  { id: "2", subjectId: "subject-2", topicId: null, questionBatchId: null, reason: "tempo", thought: "Demorei no cálculo", correctRule: "Usar estimativa", nextStep: null, externalReference: null, status: "understood", createdAt: "2026-10-16T12:00:00Z", updatedAt: "2026-10-16T12:00:00Z", subjectName: "Matemática", topicTitle: null, batch: null },
];

describe("mistake notebook filters", () => {
  it("filters status, subject, topic, reason and note text", () => {
    expect(filterMistakeEntries(records, { status: "needs_review", subjectId: "subject-1", topicId: "topic-1", reason: "interpretacao", query: "inferência" }).map(({ id }) => id)).toEqual(["1"]);
    expect(filterMistakeEntries(records, { status: "all", subjectId: "all", topicId: "all", reason: "tempo", query: "estimativa" }).map(({ id }) => id)).toEqual(["2"]);
  });

  it("returns no matches instead of fabricated content", () => {
    expect(filterMistakeEntries(records, { status: "in_review", subjectId: "all", topicId: "all", reason: "all", query: "" })).toEqual([]);
  });
});
