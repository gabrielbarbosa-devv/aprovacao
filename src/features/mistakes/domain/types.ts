import type { MistakeEntryInput } from "@/features/mistakes/domain/schemas";

export type MistakeReason = MistakeEntryInput["reason"];
export type MistakeStatus = MistakeEntryInput["status"];

export type MistakeEntry = {
  id: string;
  subjectId: string;
  topicId: string | null;
  questionBatchId: string | null;
  reason: MistakeReason;
  thought: string;
  correctRule: string;
  nextStep: string | null;
  externalReference: string | null;
  status: MistakeStatus;
  createdAt: string;
  updatedAt: string;
};

export type MistakeSubjectOption = { id: string; name: string; archivedAt: string | null };
export type MistakeTopicOption = { id: string; subjectId: string; title: string; archivedAt: string | null };
export type MistakeBatchOption = {
  id: string;
  studiedOn: string;
  subjectId: string;
  topicId: string | null;
  subjectName: string;
  topicTitle: string | null;
  sourceLabel: string;
  deletedAt: string | null;
};

export type MistakeListRecord = MistakeEntry & {
  subjectName: string;
  topicTitle: string | null;
  batch: MistakeBatchOption | null;
};

export type MistakesPageData = {
  email: string;
  timezone: string;
  entries: MistakeListRecord[];
  subjects: MistakeSubjectOption[];
  topics: MistakeTopicOption[];
  batches: MistakeBatchOption[];
};

export type MistakeActionResult = { ok: true; id: string; status: "created" | "updated" | "exists" } | { ok: false; message: string };

export type MistakeFilters = {
  status: MistakeStatus | "all";
  subjectId: string;
  topicId: string;
  reason: MistakeReason | "all";
  query: string;
};

export function filterMistakeEntries(entries: MistakeListRecord[], filters: MistakeFilters): MistakeListRecord[] {
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");
  return entries.filter((entry) => {
    if (filters.status !== "all" && entry.status !== filters.status) return false;
    if (filters.subjectId !== "all" && entry.subjectId !== filters.subjectId) return false;
    if (filters.topicId !== "all" && entry.topicId !== filters.topicId) return false;
    if (filters.reason !== "all" && entry.reason !== filters.reason) return false;
    if (!query) return true;
    return [entry.subjectName, entry.topicTitle ?? "", entry.thought, entry.correctRule, entry.nextStep ?? "", entry.externalReference ?? "", entry.batch?.sourceLabel ?? ""]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(query));
  });
}

export function getMistakeReasonLabel(reason: MistakeReason): string {
  const labels: Record<MistakeReason, string> = {
    conteudo: "Conteúdo",
    interpretacao: "Interpretação",
    desatencao: "Desatenção",
    tempo: "Tempo",
    confusao_regra: "Confusão de regra",
    outro: "Outro",
  };
  return labels[reason];
}

export function getMistakeStatusLabel(status: MistakeStatus): string {
  const labels: Record<MistakeStatus, string> = {
    needs_review: "Precisa revisar",
    in_review: "Em revisão",
    understood: "Compreendido",
  };
  return labels[status];
}
