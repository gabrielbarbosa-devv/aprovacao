export type TopicStatus = "nao_iniciado" | "em_andamento" | "revisando" | "dominado" | "concluido";
export type TopicPriority = "baixa" | "media" | "alta";

export type StudyGuide = {
  objective: string | null;
  studyPoints: string[];
  examStyle: { board: string | null; description: string | null; evidenceType: string | null } | null;
  pitfalls: string[];
  examples: Array<{ statement: string; answer: string; explanation: string; original: boolean | null }>;
  practice: { firstQuestions: number | null; platform: string | null; filters: string[]; videoSearch: string | null; activeRecall: string | null } | null;
  incidence: { status: string | null; measuredPercent: number | null; measuredSample: number | null } | null;
  officialSources: Array<{ exam: string; reference: string | null; url: string }>;
  coverageNote: string | null;
  legacyNotes: string | null;
};

export type SubjectModule = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

export type StudyTopic = {
  id: string;
  subjectId: string;
  moduleId: string | null;
  moduleTitle: string | null;
  title: string;
  status: TopicStatus;
  priority: TopicPriority;
  sortOrder: number;
  notes: string | null;
  sourceUrl: string | null;
  estimatedMinutes: number | null;
  archivedAt: string | null;
  openStudyBlockCount: number;
  plannedStudyDate: string | null;
  studyGuide: StudyGuide | null;
};

export type SubjectTopicsPageData = {
  email: string;
  subject: { id: string; name: string };
  modules: SubjectModule[];
  topics: StudyTopic[];
  nextTopicId: string | null;
};

export type TopicActionResult = { ok: true } | { ok: false; message: string };
