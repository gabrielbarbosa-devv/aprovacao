import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import type { MistakeEntry, MistakeReason, MistakeStatus, MistakesPageData } from "@/features/mistakes/domain/types";

export async function getMistakesPageData(): Promise<MistakesPageData> {
  const { user, supabase } = await requireUser();
  const [entryResult, subjectResult, topicResult, batchResult, settingsResult] = await Promise.all([
    supabase.from("mistake_entries").select("id, subject_id, topic_id, question_batch_id, reason, thought, correct_rule, next_step, external_reference, status, created_at, updated_at")
      .eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("subjects").select("id, name, archived_at").eq("user_id", user.id).order("sort_order", { ascending: true }),
    supabase.from("topics").select("id, title, subject_id, archived_at").eq("user_id", user.id).order("sort_order", { ascending: true }),
    supabase.from("question_batches").select("id, studied_on, subject_id, topic_id, source_label, deleted_at")
      .eq("user_id", user.id).order("studied_on", { ascending: false }),
    supabase.from("user_settings").select("timezone").eq("user_id", user.id).maybeSingle(),
  ]);

  if (entryResult.error || subjectResult.error || topicResult.error || batchResult.error || settingsResult.error) {
    throw new Error("Não foi possível carregar seu caderno de erros.");
  }

  const subjects = (subjectResult.data ?? []).map((subject) => ({ id: subject.id, name: subject.name, archivedAt: subject.archived_at }));
  const topics = (topicResult.data ?? []).map((topic) => ({ id: topic.id, title: topic.title, subjectId: topic.subject_id, archivedAt: topic.archived_at }));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const batches = (batchResult.data ?? []).map((batch) => {
    const subject = subjectById.get(batch.subject_id);
    const topic = batch.topic_id ? topicById.get(batch.topic_id) : undefined;
    return {
      id: batch.id,
      studiedOn: batch.studied_on,
      subjectId: batch.subject_id,
      topicId: batch.topic_id,
      subjectName: subject?.name ?? "Matéria indisponível",
      topicTitle: topic?.title ?? null,
      sourceLabel: batch.source_label,
      deletedAt: batch.deleted_at,
    };
  });
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const entries: MistakePageEntry[] = (entryResult.data ?? []).flatMap((row) => {
    const subject = subjectById.get(row.subject_id);
    if (!subject) return [];
    const topic = row.topic_id ? topicById.get(row.topic_id) : undefined;
    const batch = row.question_batch_id ? batchById.get(row.question_batch_id) ?? null : null;
    const entry: MistakeEntry = {
      id: row.id,
      subjectId: row.subject_id,
      topicId: row.topic_id,
      questionBatchId: row.question_batch_id,
      reason: parseReason(row.reason),
      thought: row.thought,
      correctRule: row.correct_rule,
      nextStep: row.next_step,
      externalReference: row.external_reference,
      status: parseStatus(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    return [{ ...entry, subjectName: subject.name, topicTitle: topic?.title ?? null, batch }];
  });

  return {
    email: user.email ?? "",
    timezone: settingsResult.data?.timezone ?? "America/Sao_Paulo",
    entries,
    subjects,
    topics,
    batches,
  };
}

type MistakePageEntry = MistakesPageData["entries"][number];

function parseReason(value: string): MistakeReason {
  if (value === "interpretacao" || value === "desatencao" || value === "tempo" || value === "confusao_regra" || value === "outro") return value;
  return "conteudo";
}

function parseStatus(value: string): MistakeStatus {
  if (value === "in_review" || value === "understood") return value;
  return "needs_review";
}
