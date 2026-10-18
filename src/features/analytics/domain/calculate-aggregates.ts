import type {
  AnalyticsBatch,
  AnalyticsFilters,
  AnalyticsSession,
  AnalyticsSubject,
  AnalyticsSummary,
  SubjectPerformance,
  WeeklyAccuracy,
} from "./types.ts";

type QuestionRecord = {
  studiedOn: string;
  subjectId: string;
  questionCount: number;
  correctCount: number;
};

export function calculateAnalytics(input: {
  batches: AnalyticsBatch[];
  sessions: AnalyticsSession[];
  subjects: AnalyticsSubject[];
  filters: AnalyticsFilters;
}): AnalyticsSummary {
  const { batches, sessions, subjects, filters } = input;
  const batchQuestions: QuestionRecord[] = batches.map((batch) => ({
    studiedOn: batch.studiedOn,
    subjectId: batch.subjectId,
    questionCount: batch.questionCount,
    correctCount: batch.correctCount,
  }));
  const legacySessionQuestions: QuestionRecord[] = sessions
    .filter((session) => !session.hasReplacementBatch && session.questionCount > 0)
    .map((session) => ({
      studiedOn: session.studiedOn,
      subjectId: session.subjectId,
      questionCount: session.questionCount,
      correctCount: session.correctCount,
    }));

  const records = [...batchQuestions, ...legacySessionQuestions].filter((record) =>
    isWithinRange(record.studiedOn, filters.from, filters.to)
    && (!filters.subjectId || record.subjectId === filters.subjectId)
  );
  const questionCount = records.reduce((total, record) => total + record.questionCount, 0);
  const correctCount = records.reduce((total, record) => total + record.correctCount, 0);
  const accuracy = questionCount === 0 ? null : roundOneDecimal(correctCount / questionCount * 100);

  const relevantSessions = sessions.filter((session) =>
    isWithinRange(session.studiedOn, filters.from, filters.to)
    && (!filters.subjectId || filters.subjectId === session.subjectId)
  );
  const standaloneBatchMinutes = batches
    .filter((batch) => isWithinRange(batch.studiedOn, filters.from, filters.to)
      && batch.studySessionId === null
      && (!filters.subjectId || filters.subjectId === batch.subjectId))
    .reduce((total, batch) => total + (batch.durationMinutes ?? 0), 0);
  const studyMinutes = relevantSessions.reduce((total, session) => total + session.durationMinutes, 0)
    + standaloneBatchMinutes;

  return {
    questionCount,
    correctCount,
    accuracy,
    studyMinutes: studyMinutes > 0 ? studyMinutes : null,
    trend: buildWeeklyAccuracy(records, filters.from, filters.to),
    subjects: buildSubjectPerformance(records, subjects),
  };
}

function buildWeeklyAccuracy(records: QuestionRecord[], from: string, to: string): WeeklyAccuracy[] {
  const byWeek = new Map<string, { correctCount: number; questionCount: number }>();
  for (const record of records) {
    const weekStart = getWeekStart(record.studiedOn);
    const value = byWeek.get(weekStart) ?? { correctCount: 0, questionCount: 0 };
    value.correctCount += record.correctCount;
    value.questionCount += record.questionCount;
    byWeek.set(weekStart, value);
  }

  const firstWeek = getWeekStart(from);
  const lastWeek = getWeekStart(to);
  const weeks: WeeklyAccuracy[] = [];
  for (let week = firstWeek; week <= lastWeek; week = addDays(week, 7)) {
    const value = byWeek.get(week) ?? { correctCount: 0, questionCount: 0 };
    weeks.push({
      weekStart: week,
      label: formatWeekLabel(week),
      correctCount: value.correctCount,
      questionCount: value.questionCount,
      accuracy: value.questionCount === 0 ? null : roundOneDecimal(value.correctCount / value.questionCount * 100),
    });
  }
  return weeks;
}

function buildSubjectPerformance(records: QuestionRecord[], subjects: AnalyticsSubject[]): SubjectPerformance[] {
  const names = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const bySubject = new Map<string, { questionCount: number; correctCount: number }>();
  for (const record of records) {
    const value = bySubject.get(record.subjectId) ?? { questionCount: 0, correctCount: 0 };
    value.questionCount += record.questionCount;
    value.correctCount += record.correctCount;
    bySubject.set(record.subjectId, value);
  }
  return [...bySubject.entries()]
    .map(([id, value]) => ({
      id,
      name: names.get(id) ?? "Matéria arquivada",
      questionCount: value.questionCount,
      correctCount: value.correctCount,
      accuracy: value.questionCount === 0 ? null : roundOneDecimal(value.correctCount / value.questionCount * 100),
    }))
    .sort((a, b) => b.questionCount - a.questionCount || a.name.localeCompare(b.name, "pt-BR"));
}

function isWithinRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

function getWeekStart(day: string): string {
  const date = parseDay(day);
  const dayOfWeek = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return formatDay(date);
}

function addDays(day: string, amount: number): string {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDay(date);
}

function parseDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string): string {
  const date = parseDay(weekStart);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function sortSubjectPerformance(
  values: SubjectPerformance[],
  sortBy: "questions" | "correct" | "accuracy",
): SubjectPerformance[] {
  const sortValue = (subject: SubjectPerformance): number => {
    if (sortBy === "correct") return subject.correctCount;
    if (sortBy === "accuracy") return subject.accuracy ?? -1;
    return subject.questionCount;
  };
  return [...values].sort((a, b) => sortValue(b) - sortValue(a) || a.name.localeCompare(b.name, "pt-BR"));
}
