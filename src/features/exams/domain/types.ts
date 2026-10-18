export type ExamStage = "em_preparacao" | "edital_publicado" | "inscricao_aberta" | "prova_realizada";
export type ExamPriority = "alta" | "media" | "baixa";

export type ExamTopic = { id: string; title: string; status: string; subjectId: string; archivedAt: string | null };
export type ExamSubject = { id: string; name: string; archivedAt: string | null };
export type ExamSubjectLink = { id: string; name: string; archivedAt: string | null; importance: string | null };

export type ExamTarget = {
  id: string;
  examName: string;
  institution: string;
  roleTitle: string;
  jurisdiction: string;
  currentStage: ExamStage;
  priority: ExamPriority;
  examDate: string | null;
  applicationDeadline: string | null;
  officialUrl: string | null;
  notes: string | null;
  archivedAt: string | null;
  subjectIds: string[];
  topicIds: string[];
  subjects: ExamSubjectLink[];
  topics: ExamTopic[];
};

export type ExamPageData = { email: string; targets: ExamTarget[]; subjects: ExamSubject[]; topics: ExamTopic[] };
export type ExamActionResult = { ok: true; id?: string } | { ok: false; message: string };

export type TopicCoverage = { configured: false } | { configured: true; mastered: number; total: number };

export function getTopicCoverage(topics: ExamTopic[]): TopicCoverage {
  if (topics.length === 0) return { configured: false };
  return { configured: true, mastered: topics.filter((topic) => topic.status === "dominado").length, total: topics.length };
}
