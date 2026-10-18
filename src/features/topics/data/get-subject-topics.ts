import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { topicsRepository } from "@/features/topics/data/topics-repository";
import { parseStudyGuide } from "@/features/topics/domain/study-guide";
import type { StudyTopic, SubjectTopicsPageData, TopicPriority, TopicStatus } from "@/features/topics/domain/types";

export async function getSubjectTopicsPageData(subjectId: string): Promise<SubjectTopicsPageData> {
  const { user, supabase } = await requireUser();
  const { data: subject, error: subjectError } = await topicsRepository.getActiveSubject(supabase, user.id, subjectId);
  if (subjectError) throw new Error("Não foi possível carregar a matéria.");
  if (!subject) notFound();

  const [topicResult, moduleResult] = await Promise.all([
    topicsRepository.getSubjectTopics(supabase, user.id, subject.id),
    topicsRepository.getSubjectModules(supabase, user.id, subject.id),
  ]);
  if (topicResult.error || moduleResult.error) throw new Error("Não foi possível carregar os tópicos desta matéria.");
  const rawTopics = topicResult.data ?? [];
  const [blocksResult, guideResult, examTopicResult] = await Promise.all([
    topicsRepository.getOpenBlocksForUser(supabase, user.id, rawTopics.map((topic) => topic.id)),
    topicsRepository.getStudyGuides(supabase, user.id, rawTopics.map((topic) => topic.id)),
    topicsRepository.getExamTopicLinks(supabase, user.id, rawTopics.map((topic) => topic.id)),
  ]);
  if (blocksResult.error || guideResult.error || examTopicResult.error) throw new Error("Não foi possível carregar o conteúdo de estudo desta matéria.");

  const examTopicLinks = examTopicResult.data ?? [];
  const examTargetResult = await topicsRepository.getExamTargetNames(
    supabase,
    user.id,
    [...new Set(examTopicLinks.map((link) => link.exam_target_id))],
  );
  if (examTargetResult.error) throw new Error("Não foi possível carregar os concursos relacionados a esta matéria.");
  const examTargetById = new Map((examTargetResult.data ?? []).map((target) => [target.id, {
    id: target.id,
    name: target.exam_name,
    archivedAt: target.archived_at,
  }]));
  const examTargetsByTopic = new Map<string, Array<{ id: string; name: string; archivedAt: string | null }>>();
  for (const link of examTopicLinks) {
    const target = examTargetById.get(link.exam_target_id);
    if (!target) continue;
    const linkedTargets = examTargetsByTopic.get(link.topic_id) ?? [];
    linkedTargets.push(target);
    examTargetsByTopic.set(link.topic_id, linkedTargets);
  }

  const modules = (moduleResult.data ?? []).map((module) => ({
    id: module.id,
    title: module.title,
    description: module.description,
    sortOrder: module.sort_order,
  }));
  const modulesById = new Map(modules.map((module) => [module.id, module]));

  const openBlockCount = new Map<string, number>();
  const plannedStudyDate = new Map<string, string>();
  for (const block of blocksResult.data ?? []) openBlockCount.set(block.topic_id, (openBlockCount.get(block.topic_id) ?? 0) + 1);
  for (const block of [...(blocksResult.data ?? [])].sort((a, b) => a.planned_date.localeCompare(b.planned_date) || a.sort_order - b.sort_order)) {
    if (!plannedStudyDate.has(block.topic_id)) plannedStudyDate.set(block.topic_id, block.planned_date);
  }
  const guidesByTopic = new Map((guideResult.data ?? []).map((guide) => [guide.topic_id, parseStudyGuide(guide.content, guide.source_evidence, guide.legacy_notes)]));
  const topics: StudyTopic[] = rawTopics.map((topic) => ({
    id: topic.id,
    subjectId: topic.subject_id,
    moduleId: topic.module_id,
    moduleTitle: topic.module_id ? modulesById.get(topic.module_id)?.title ?? null : null,
    title: topic.title,
    status: normalizeStatus(topic.status),
    priority: normalizePriority(topic.priority),
    sortOrder: topic.sort_order,
    notes: topic.notes,
    sourceUrl: topic.source_url,
    estimatedMinutes: topic.estimated_minutes,
    archivedAt: topic.archived_at,
    openStudyBlockCount: openBlockCount.get(topic.id) ?? 0,
    plannedStudyDate: plannedStudyDate.get(topic.id) ?? null,
    studyGuide: guidesByTopic.get(topic.id) ?? null,
    relatedExamTargets: examTargetsByTopic.get(topic.id) ?? [],
  }));
  const activeTopics = topics.filter((topic) => topic.archivedAt === null);
  const activeTopicIds = new Set(activeTopics.map((topic) => topic.id));
  const firstPlannedBlock = [...(blocksResult.data ?? [])].sort((a, b) =>
    a.planned_date.localeCompare(b.planned_date) || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  ).find((block) => activeTopicIds.has(block.topic_id));
  const moduleOrder = new Map(modules.map((module) => [module.id, module.sortOrder]));
  const pedagogicalTopics = [...activeTopics].sort((a, b) =>
    (moduleOrder.get(a.moduleId ?? "") ?? Number.MAX_SAFE_INTEGER) - (moduleOrder.get(b.moduleId ?? "") ?? Number.MAX_SAFE_INTEGER)
    || a.sortOrder - b.sortOrder,
  );
  const nextTopicId = firstPlannedBlock?.topic_id ?? pedagogicalTopics.find((topic) => topic.status !== "concluido" && topic.status !== "dominado")?.id ?? null;
  return { email: user.email ?? "", subject, modules, topics, nextTopicId };
}

function normalizeStatus(status: string): TopicStatus {
  if (status === "em_andamento" || status === "revisando" || status === "dominado" || status === "concluido") return status;
  return "nao_iniciado";
}

function normalizePriority(priority: string): TopicPriority {
  if (priority === "baixa" || priority === "alta") return priority;
  return "media";
}
