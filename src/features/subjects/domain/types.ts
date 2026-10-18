export type SubjectColorToken = "blue" | "green" | "violet" | "orange" | "rose";

export type SubjectTopic = {
  id: string;
  title: string;
  status: "nao_iniciado" | "em_andamento" | "concluido";
};

export type Subject = {
  id: string;
  name: string;
  colorToken: SubjectColorToken | null;
  sortOrder: number;
  archivedAt: string | null;
  topics: SubjectTopic[];
  futureBlockCount: number;
};

export type SubjectsPageData = {
  email: string;
  subjects: Subject[];
};

export type SubjectActionResult =
  | { ok: true }
  | { ok: false; message: string };
