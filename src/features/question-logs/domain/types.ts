import type { QuestionBatchInput } from "@/features/question-logs/domain/schemas";

export type QuestionSourceType = QuestionBatchInput["sourceType"];

export type QuestionBatch = {
  id: string;
  operationKey: string;
  studiedOn: string;
  subjectId: string;
  topicId: string | null;
  sourceType: QuestionSourceType;
  sourceLabel: string;
  examTargetId: string | null;
  studySessionId: string | null;
  questionCount: number;
  correctCount: number;
  durationMinutes: number | null;
  notes: string | null;
  replacesSessionTotals: boolean;
  createdAt: string;
};

export type StudySessionSummary = {
  id: string;
  studiedOn: string;
  subjectId: string;
  topicId: string;
  questionCount: number;
  correctCount: number;
  durationMinutes: number;
  deletedAt: string | null;
  createdAt: string;
};

export type QuestionLogRecord = {
  id: string;
  kind: "batch" | "study_summary";
  studiedOn: string;
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicTitle: string | null;
  sourceType: QuestionSourceType | "registro_estudo";
  sourceLabel: string;
  examTargetId: string | null;
  examTargetName: string | null;
  studySessionId: string | null;
  questionCount: number;
  correctCount: number;
  durationMinutes: number | null;
  notes: string | null;
  replacesSessionTotals: boolean;
  createdAt: string;
};

export type QuestionSubjectOption = { id: string; name: string; archivedAt: string | null };
export type QuestionTopicOption = { id: string; title: string; subjectId: string; archivedAt: string | null };
export type QuestionExamOption = { id: string; name: string; institution: string; archivedAt: string | null; subjectIds: string[]; topicIds: string[] };
export type QuestionSessionOption = StudySessionSummary & { subjectName: string; topicTitle: string };

export type QuestionLogsPageData = {
  email: string;
  today: string;
  batches: QuestionBatch[];
  records: QuestionLogRecord[];
  subjects: QuestionSubjectOption[];
  topics: QuestionTopicOption[];
  examTargets: QuestionExamOption[];
  studySessions: QuestionSessionOption[];
};

export type QuestionActionResult = { ok: true; id: string; status: "created" | "updated" | "exists" } | { ok: false; message: string };

export type QuestionStats = { questionCount: number; correctCount: number; mistakeCount: number; accuracy: number | null };

export function getQuestionStats(records: QuestionLogRecord[]): QuestionStats {
  const questionCount = records.reduce((total, record) => total + record.questionCount, 0);
  const correctCount = records.reduce((total, record) => total + record.correctCount, 0);
  return { questionCount, correctCount, mistakeCount: questionCount - correctCount, accuracy: questionCount === 0 ? null : Math.round(correctCount / questionCount * 1000) / 10 };
}

export function getQuestionResult(questionCount: number, correctCount: number): { mistakeCount: number; accuracy: number | null } {
  if (!Number.isSafeInteger(questionCount) || !Number.isSafeInteger(correctCount) || questionCount <= 0 || correctCount < 0 || correctCount > questionCount) {
    return { mistakeCount: 0, accuracy: null };
  }
  return { mistakeCount: questionCount - correctCount, accuracy: Math.round(correctCount / questionCount * 1000) / 10 };
}

/** Session summaries are the legacy baseline; a linked replacement batch supersedes one, additive batches do not. */
export function reconcileQuestionRecords(batches: QuestionBatch[], sessions: StudySessionSummary[]): { batches: QuestionBatch[]; sessionSummaries: StudySessionSummary[] } {
  const activeBatches = batches;
  const replacedSessions = new Set(activeBatches.filter((batch) => batch.replacesSessionTotals && batch.studySessionId).map((batch) => batch.studySessionId));
  const sessionSummaries = sessions.filter((session) => session.deletedAt === null && session.questionCount > 0 && !replacedSessions.has(session.id));
  return { batches: activeBatches, sessionSummaries };
}
