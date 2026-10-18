export type TopicStatus = "nao_iniciado" | "em_andamento" | "revisando" | "dominado" | "concluido";
export type TopicPriority = "baixa" | "media" | "alta";

export type StudyTopic = {
  id: string;
  subjectId: string;
  title: string;
  status: TopicStatus;
  priority: TopicPriority;
  sortOrder: number;
  notes: string | null;
  sourceUrl: string | null;
  estimatedMinutes: number | null;
  archivedAt: string | null;
  openStudyBlockCount: number;
};

export type SubjectTopicsPageData = {
  email: string;
  subject: { id: string; name: string };
  topics: StudyTopic[];
};

export type TopicActionResult = { ok: true } | { ok: false; message: string };
