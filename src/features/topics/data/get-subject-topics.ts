import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { topicsRepository } from "@/features/topics/data/topics-repository";
import type { StudyTopic, SubjectTopicsPageData, TopicPriority, TopicStatus } from "@/features/topics/domain/types";

export async function getSubjectTopicsPageData(subjectId: string): Promise<SubjectTopicsPageData> {
  const { user, supabase } = await requireUser();
  const { data: subject, error: subjectError } = await topicsRepository.getActiveSubject(supabase, user.id, subjectId);
  if (subjectError) throw new Error("Não foi possível carregar a matéria.");
  if (!subject) notFound();

  const topicResult = await topicsRepository.getSubjectTopics(supabase, user.id, subject.id);
  const blocksResult = await topicsRepository.getOpenBlocksForUser(supabase, user.id, (topicResult.data ?? []).map((topic) => topic.id));
  if (topicResult.error || blocksResult.error) throw new Error("Não foi possível carregar os tópicos desta matéria.");

  const openBlockCount = new Map<string, number>();
  for (const block of blocksResult.data ?? []) openBlockCount.set(block.topic_id, (openBlockCount.get(block.topic_id) ?? 0) + 1);
  const topics: StudyTopic[] = (topicResult.data ?? []).map((topic) => ({
    id: topic.id,
    subjectId: topic.subject_id,
    title: topic.title,
    status: normalizeStatus(topic.status),
    priority: normalizePriority(topic.priority),
    sortOrder: topic.sort_order,
    notes: topic.notes,
    sourceUrl: topic.source_url,
    estimatedMinutes: topic.estimated_minutes,
    archivedAt: topic.archived_at,
    openStudyBlockCount: openBlockCount.get(topic.id) ?? 0,
  }));
  return { email: user.email ?? "", subject, topics };
}

function normalizeStatus(status: string): TopicStatus {
  if (status === "em_andamento" || status === "revisando" || status === "dominado" || status === "concluido") return status;
  return "nao_iniciado";
}

function normalizePriority(priority: string): TopicPriority {
  if (priority === "baixa" || priority === "alta") return priority;
  return "media";
}
