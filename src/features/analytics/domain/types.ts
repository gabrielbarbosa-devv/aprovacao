export type AnalyticsPeriod = "7" | "30" | "90" | "custom";
export type AnalyticsSort = "questions" | "correct" | "accuracy";

export type AnalyticsFilters = {
  period: AnalyticsPeriod;
  from: string;
  to: string;
  subjectId: string | null;
  sortBy: AnalyticsSort;
};

export type AnalyticsSubject = {
  id: string;
  name: string;
  archivedAt: string | null;
};

export type AnalyticsBatch = {
  id: string;
  studiedOn: string;
  subjectId: string;
  questionCount: number;
  correctCount: number;
  durationMinutes: number | null;
  studySessionId: string | null;
};

export type AnalyticsSession = {
  id: string;
  studiedOn: string;
  subjectId: string;
  questionCount: number;
  correctCount: number;
  durationMinutes: number;
  hasReplacementBatch: boolean;
};

export type WeeklyAccuracy = {
  weekStart: string;
  label: string;
  correctCount: number;
  questionCount: number;
  accuracy: number | null;
};

export type SubjectPerformance = {
  id: string;
  name: string;
  questionCount: number;
  correctCount: number;
  accuracy: number | null;
};

export type AnalyticsSummary = {
  questionCount: number;
  correctCount: number;
  accuracy: number | null;
  studyMinutes: number | null;
  trend: WeeklyAccuracy[];
  subjects: SubjectPerformance[];
};
