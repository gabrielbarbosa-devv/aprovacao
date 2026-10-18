import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import type { ExamPageData, ExamStage, ExamPriority } from "@/features/exams/domain/types";

export async function getExamTargetsPageData(): Promise<ExamPageData> {
  const { user, supabase } = await requireUser();
  const [targetResult, subjectResult, topicResult, subjectLinkResult, topicLinkResult] = await Promise.all([
    supabase.from("exam_targets").select("id, exam_name, institution, role_title, jurisdiction, current_stage, priority, exam_date, application_deadline, official_url, notes, archived_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("subjects").select("id, name, archived_at").eq("user_id", user.id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("topics").select("id, title, status, subject_id, archived_at").eq("user_id", user.id).order("sort_order", { ascending: true }),
    supabase.from("exam_subjects").select("id, exam_target_id, subject_id, importance").eq("user_id", user.id),
    supabase.from("exam_topics").select("id, exam_target_id, topic_id").eq("user_id", user.id),
  ]);
  if (targetResult.error || subjectResult.error || topicResult.error || subjectLinkResult.error || topicLinkResult.error) {
    throw new Error("Não foi possível carregar seus concursos.");
  }

  const subjects = (subjectResult.data ?? []).map((subject) => ({ id: subject.id, name: subject.name, archivedAt: subject.archived_at }));
  const topics = (topicResult.data ?? []).map((topic) => ({ id: topic.id, title: topic.title, status: topic.status, subjectId: topic.subject_id, archivedAt: topic.archived_at }));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const subjectsByTarget = new Map<string, typeof subjectLinkResult.data>();
  const topicsByTarget = new Map<string, typeof topicLinkResult.data>();
  for (const link of subjectLinkResult.data ?? []) {
    const group = subjectsByTarget.get(link.exam_target_id) ?? [];
    group.push(link);
    subjectsByTarget.set(link.exam_target_id, group);
  }
  for (const link of topicLinkResult.data ?? []) {
    const group = topicsByTarget.get(link.exam_target_id) ?? [];
    group.push(link);
    topicsByTarget.set(link.exam_target_id, group);
  }

  return {
    email: user.email ?? "",
    subjects,
    topics,
    targets: (targetResult.data ?? []).map((target) => {
      const subjectLinks = subjectsByTarget.get(target.id) ?? [];
      const topicLinks = topicsByTarget.get(target.id) ?? [];
      return {
        id: target.id,
        examName: target.exam_name,
        institution: target.institution,
        roleTitle: target.role_title,
        jurisdiction: target.jurisdiction,
        currentStage: normalizeStage(target.current_stage),
        priority: normalizePriority(target.priority),
        examDate: target.exam_date,
        applicationDeadline: target.application_deadline,
        officialUrl: target.official_url,
        notes: target.notes,
        archivedAt: target.archived_at,
        subjectIds: subjectLinks.map((link) => link.subject_id),
        topicIds: topicLinks.map((link) => link.topic_id),
        subjects: subjectLinks.flatMap((link) => {
          const subject = subjectById.get(link.subject_id);
          return subject ? [{ ...subject, importance: link.importance }] : [];
        }),
        topics: topicLinks.flatMap((link) => {
          const topic = topicById.get(link.topic_id);
          return topic ? [topic] : [];
        }),
      };
    }),
  };
}

function normalizeStage(value: string): ExamStage {
  if (value === "edital_publicado" || value === "inscricao_aberta" || value === "prova_realizada") return value;
  return "em_preparacao";
}

function normalizePriority(value: string): ExamPriority {
  if (value === "alta" || value === "baixa") return value;
  return "media";
}
