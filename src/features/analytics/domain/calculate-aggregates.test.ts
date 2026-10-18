import { describe, expect, it } from "vitest";
import { calculateAnalytics, sortSubjectPerformance } from "./calculate-aggregates";
import type { AnalyticsBatch, AnalyticsFilters, AnalyticsSession, AnalyticsSubject } from "./types";

const filters: AnalyticsFilters = { period: "30", from: "2026-10-01", to: "2026-10-30", subjectId: null, sortBy: "questions" };
const subjects: AnalyticsSubject[] = [
  { id: "portugues", name: "Português", archivedAt: null },
  { id: "penal", name: "Direito Penal", archivedAt: null },
];

function batch(overrides: Partial<AnalyticsBatch> = {}): AnalyticsBatch {
  return { id: "batch-1", studiedOn: "2026-10-17", subjectId: "portugues", questionCount: 20, correctCount: 15,
    durationMinutes: null, studySessionId: null, ...overrides };
}

function session(overrides: Partial<AnalyticsSession> = {}): AnalyticsSession {
  return { id: "session-1", studiedOn: "2026-10-17", subjectId: "portugues", questionCount: 20, correctCount: 15,
    durationMinutes: 60, hasReplacementBatch: false, ...overrides };
}

describe("performance analytics aggregation", () => {
  it("weights accuracy by question totals instead of averaging batch percentages", () => {
    const result = calculateAnalytics({ batches: [batch({ questionCount: 1, correctCount: 1 }), batch({ id: "batch-2", questionCount: 9, correctCount: 1 })], sessions: [], subjects, filters });
    expect(result.questionCount).toBe(10);
    expect(result.correctCount).toBe(2);
    expect(result.accuracy).toBe(20);
  });

  it("aggregates a 20/15 and 10/5 batch as 30 questions and 66.7%", () => {
    const result = calculateAnalytics({ batches: [batch(), batch({ id: "batch-2", questionCount: 10, correctCount: 5 })], sessions: [], subjects, filters });
    expect(result).toMatchObject({ questionCount: 30, correctCount: 20, accuracy: 66.7 });
  });

  it("recalculates edited and soft-deleted data without duplicating replacement sessions", () => {
    const replacementSession = session({ hasReplacementBatch: true });
    const edited = calculateAnalytics({ batches: [batch({ correctCount: 17 })], sessions: [replacementSession], subjects, filters });
    expect(edited).toMatchObject({ questionCount: 20, correctCount: 17, accuracy: 85 });

    const afterDelete = calculateAnalytics({ batches: [], sessions: [session({ correctCount: 17 })], subjects, filters });
    expect(afterDelete).toMatchObject({ questionCount: 20, correctCount: 17, accuracy: 85 });
  });

  it("matches the edit and delete acceptance totals for two real batches", () => {
    const initialBatches = [batch(), batch({ id: "batch-2", questionCount: 10, correctCount: 5 })];
    const edited = calculateAnalytics({ batches: [batch({ correctCount: 17 }), initialBatches[1]!], sessions: [], subjects, filters });
    expect(edited).toMatchObject({ questionCount: 30, correctCount: 22, accuracy: 73.3 });

    const afterSecondBatchDelete = calculateAnalytics({ batches: [batch({ correctCount: 17 })], sessions: [], subjects, filters });
    expect(afterSecondBatchDelete).toMatchObject({ questionCount: 20, correctCount: 17, accuracy: 85 });
  });

  it("does not count linked practice time twice and includes standalone practice time", () => {
    const result = calculateAnalytics({
      batches: [batch({ durationMinutes: 30, studySessionId: "session-1" }), batch({ id: "standalone", durationMinutes: 30 })],
      sessions: [session({ durationMinutes: 30 })], subjects, filters,
    });
    expect(result.studyMinutes).toBe(60);
  });

  it("filters the date range inclusively and by subject", () => {
    const result = calculateAnalytics({
      batches: [batch({ studiedOn: filters.from }), batch({ id: "last-day", studiedOn: filters.to, questionCount: 10, correctCount: 8 }),
        batch({ id: "outside", studiedOn: "2026-10-31" }), batch({ id: "other", subjectId: "penal" })],
      sessions: [], subjects, filters: { ...filters, subjectId: "portugues" },
    });
    expect(result.questionCount).toBe(30);
  });

  it("returns absent accuracy and study time for an empty denominator", () => {
    const result = calculateAnalytics({ batches: [], sessions: [], subjects, filters });
    expect(result).toMatchObject({ questionCount: 0, correctCount: 0, accuracy: null, studyMinutes: null });
    expect(result.trend.every((week) => week.accuracy === null)).toBe(true);
  });

  it("sorts subject rows by the chosen metric", () => {
    const rows = calculateAnalytics({ batches: [batch(), batch({ subjectId: "penal", questionCount: 5, correctCount: 4 })], sessions: [], subjects, filters }).subjects;
    expect(sortSubjectPerformance(rows, "accuracy").map((row) => row.id)).toEqual(["penal", "portugues"]);
  });
});
