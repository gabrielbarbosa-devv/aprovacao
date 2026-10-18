import { describe, expect, it } from "vitest";
import { getQuestionResult, getQuestionStats, reconcileQuestionRecords, type QuestionBatch, type QuestionLogRecord, type StudySessionSummary } from "./types";

const session: StudySessionSummary = { id: "session-1", studiedOn: "2026-10-17", subjectId: "sub-1", topicId: "topic-1", questionCount: 20, correctCount: 15, durationMinutes: 60, deletedAt: null, createdAt: "2026-10-17T12:00:00Z" };
const batch: QuestionBatch = { id: "batch-1", operationKey: "op-1", studiedOn: "2026-10-17", subjectId: "sub-1", topicId: "topic-1", sourceType: "plataforma", sourceLabel: "QConcursos", examTargetId: null, studySessionId: session.id, questionCount: 20, correctCount: 15, durationMinutes: null, notes: null, replacesSessionTotals: true, createdAt: "2026-10-17T12:00:00Z" };
function log(id: string, questionCount: number, correctCount: number): QuestionLogRecord { return { id, kind: "batch", studiedOn: "2026-10-17", subjectId: "sub-1", subjectName: "Português", topicId: "topic-1", topicTitle: "Interpretação", sourceType: "plataforma", sourceLabel: "QConcursos", examTargetId: null, examTargetName: null, studySessionId: session.id, questionCount, correctCount, durationMinutes: null, notes: null, replacesSessionTotals: true, createdAt: "2026-10-17T12:00:00Z" }; }

describe("question metrics and legacy reconciliation", () => {
  it("calculates errors and accuracy without producing NaN for 0/0", () => {
    expect(getQuestionResult(20, 15)).toEqual({ mistakeCount: 5, accuracy: 75 });
    expect(getQuestionResult(20, 17)).toEqual({ mistakeCount: 3, accuracy: 85 });
    expect(getQuestionResult(0, 0).accuracy).toBeNull();
  });

  it("uses a replacement batch in place of the old session summary", () => {
    const records = reconcileQuestionRecords([batch], [session]);
    const summary = records.sessionSummaries.map((value) => ({ ...log(value.id, value.questionCount, value.correctCount), kind: "study_summary" as const }));
    expect(getQuestionStats([...summary, log(batch.id, batch.questionCount, batch.correctCount)])).toMatchObject({ questionCount: 20, correctCount: 15, mistakeCount: 5, accuracy: 75 });
    expect(records.sessionSummaries).toHaveLength(0);
  });

  it("keeps an explicitly additive batch in addition to a legacy summary", () => {
    const records = reconcileQuestionRecords([{ ...batch, replacesSessionTotals: false }], [session]);
    expect(records.sessionSummaries).toHaveLength(1);
    expect(getQuestionStats([log("legacy", session.questionCount, session.correctCount), log(batch.id, batch.questionCount, batch.correctCount)]).questionCount).toBe(40);
  });

  it("restores the legacy summary to metrics after a replacement is archived", () => {
    const records = reconcileQuestionRecords([], [session]);
    expect(records.sessionSummaries).toEqual([session]);
  });
});
