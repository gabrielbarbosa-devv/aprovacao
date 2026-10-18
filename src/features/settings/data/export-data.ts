import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

type PageResult<T> = { data: T[] | null; error: { message: string } | null };
type PageReader<T> = (from: number, to: number) => PromiseLike<PageResult<T>>;
const PAGE_SIZE = 1000;

async function readAllPages<T>(readPage: PageReader<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await readPage(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Falha ao ler um dos conjuntos da exportação.");
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function ownerTablePages<T>(
  readPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  return readAllPages(readPage);
}

export type PersonalDataExport = {
  metadata: {
    schemaVersion: "1.0.0";
    exportedAt: string;
    formats: {
      studyDates: { format: "YYYY-MM-DD"; description: string };
      timestamps: { format: "ISO 8601 UTC"; description: string };
      references: string;
      nullValues: string;
      softDeletedRows: string;
      questionCounts: string;
    };
  };
  data: {
    userSettings: Tables<"user_settings"> | null;
    subjects: Tables<"subjects">[];
    topics: Tables<"topics">[];
    studyBlocks: Tables<"study_blocks">[];
    studySessions: Tables<"study_sessions">[];
    questionBatches: Tables<"question_batches">[];
    mistakeEntries: Tables<"mistake_entries">[];
    reviewTasks: Tables<"review_tasks">[];
    reviewEvents: Tables<"review_events">[];
    examTargets: Tables<"exam_targets">[];
    examSubjects: Tables<"exam_subjects">[];
    examTopics: Tables<"exam_topics">[];
  };
};

export async function getPersonalDataExport(supabase: SupabaseClient<Database>, userId: string): Promise<PersonalDataExport> {
  const [settingsResult, subjects, topics, studyBlocks, studySessions, questionBatches, mistakeEntries, reviewTasks, reviewEvents, examTargets, examSubjects, examTopics] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    ownerTablePages((from, to) => supabase.from("subjects").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("topics").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("study_blocks").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("study_sessions").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("question_batches").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("mistake_entries").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("review_tasks").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("review_events").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("exam_targets").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("exam_subjects").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("exam_topics").select("*").eq("user_id", userId).order("id").range(from, to)),
  ]);
  if (settingsResult.error) throw new Error("Falha ao ler suas preferências.");

  return {
    metadata: {
      schemaVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      formats: {
        studyDates: { format: "YYYY-MM-DD", description: "Data de estudo no calendário local configurado na conta, sem conversão para UTC." },
        timestamps: { format: "ISO 8601 UTC", description: "Carimbos de criação e atualização mantêm o instante UTC." },
        references: "IDs são UUIDs estáveis e referenciam registros de coleções deste arquivo, como subject_id, topic_id e study_session_id.",
        nullValues: "null significa que o campo não possui valor ou relação associada.",
        softDeletedRows: "Registros com deleted_at preenchido são incluídos e marcados; não foram apagados fisicamente.",
        questionCounts: "As contagens são por registro. Ao agregar sessões e lotes vinculados, considere replaces_session_totals para não duplicar questões.",
      },
    },
    data: { userSettings: settingsResult.data, subjects, topics, studyBlocks, studySessions, questionBatches, mistakeEntries, reviewTasks, reviewEvents, examTargets, examSubjects, examTopics },
  };
}

export type QuestionBatchExportRow = {
  id: string;
  studiedOn: string;
  subjectId: string;
  subject: string;
  topicId: string | null;
  topic: string | null;
  sourceType: string;
  sourceLabel: string;
  examTargetId: string | null;
  studySessionId: string | null;
  questionCount: number;
  correctCount: number;
  mistakeCount: number;
  durationMinutes: number | null;
  notes: string | null;
  replacesSessionTotals: boolean;
  deletedAt: string | null;
  createdAt: string;
};

export async function getQuestionBatchExport(supabase: SupabaseClient<Database>, userId: string): Promise<QuestionBatchExportRow[]> {
  const [batches, subjects, topics] = await Promise.all([
    ownerTablePages((from, to) => supabase.from("question_batches").select("*").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("subjects").select("id, name").eq("user_id", userId).order("id").range(from, to)),
    ownerTablePages((from, to) => supabase.from("topics").select("id, title").eq("user_id", userId).order("id").range(from, to)),
  ]);
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const topicById = new Map(topics.map((topic) => [topic.id, topic.title]));
  return batches.map((batch) => ({
    id: batch.id, studiedOn: batch.studied_on, subjectId: batch.subject_id, subject: subjectById.get(batch.subject_id) ?? "Matéria não disponível",
    topicId: batch.topic_id, topic: batch.topic_id ? topicById.get(batch.topic_id) ?? "Tópico não disponível" : null,
    sourceType: batch.source_type, sourceLabel: batch.source_label, examTargetId: batch.exam_target_id,
    studySessionId: batch.study_session_id, questionCount: batch.question_count, correctCount: batch.correct_count,
    mistakeCount: batch.question_count - batch.correct_count, durationMinutes: batch.duration_minutes, notes: batch.notes,
    replacesSessionTotals: batch.replaces_session_totals, deletedAt: batch.deleted_at, createdAt: batch.created_at,
  })).sort((a, b) => a.studiedOn.localeCompare(b.studiedOn) || a.id.localeCompare(b.id));
}
