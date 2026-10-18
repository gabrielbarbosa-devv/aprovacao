import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import { getStudyDay, addStudyDays } from "@/lib/date/study-day";
import { getPlanningData } from "@/features/planning/data/get-planning-data";
import { recommendReinforcement, type TopicAttempt } from "@/features/reinforcement/domain/recommendations";

export async function getReinforcementData() {
  const { user, supabase } = await requireUser();
  const { data: settings, error: settingsError } = await supabase.from("user_settings")
    .select("timezone, daily_goal_minutes").eq("user_id", user.id).maybeSingle();
  if (settingsError) throw new Error("Não foi possível carregar as configurações do plano de reforço.");
  const timezone = settings?.timezone ?? "America/Sao_Paulo";
  const today = getStudyDay(timezone);
  const from = addStudyDays(today, -29);

  const [subjectsResult, topicsResult, batchResult, sessionResult, flagsResult, examResult, planning] = await Promise.all([
    supabase.from("subjects").select("id, name, archived_at").eq("user_id", user.id),
    supabase.from("topics").select("id, subject_id, title, archived_at").eq("user_id", user.id),
    supabase.from("question_batches").select("topic_id, question_count, correct_count, studied_on, study_session_id, replaces_session_totals")
      .eq("user_id", user.id).is("deleted_at", null).not("topic_id", "is", null).gte("studied_on", from).lte("studied_on", today),
    supabase.from("study_sessions").select("id, topic_id, studied_on, question_count, correct_count, replacements:question_batches!question_batches_study_session_id_user_id_fkey(id, replaces_session_totals, deleted_at)")
      .eq("user_id", user.id).is("deleted_at", null).gt("question_count", 0).gte("studied_on", from).lte("studied_on", today),
    supabase.from("mistake_entries").select("topic_id").eq("user_id", user.id).is("deleted_at", null).eq("status", "needs_review").not("topic_id", "is", null),
    supabase.from("exam_targets").select("id, exam_date").eq("user_id", user.id).is("archived_at", null).gte("exam_date", today).lte("exam_date", addStudyDays(today, 30)),
    getPlanningData(today),
  ]);
  if (subjectsResult.error || topicsResult.error || batchResult.error || sessionResult.error || flagsResult.error || examResult.error) {
    throw new Error("Não foi possível carregar seus registros para sugerir reforços.");
  }

  const subjects = subjectsResult.data ?? [];
  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const topics = (topicsResult.data ?? []).filter((topic) => topic.archived_at === null && subjectNames.has(topic.subject_id));
  const topicNames = new Map(topics.map((topic) => [topic.id, { topic: topic.title, subject: subjectNames.get(topic.subject_id) ?? "Matéria" }]));
  const sums = new Map<string, { questions: number; correct: number }>();
  const accumulate = (topicId: string, questions: number, correct: number) => {
    const sum = sums.get(topicId) ?? { questions: 0, correct: 0 };
    sum.questions += questions;
    sum.correct += correct;
    sums.set(topicId, sum);
  };

  for (const batch of batchResult.data ?? []) {
    if (batch.topic_id) accumulate(batch.topic_id, batch.question_count, batch.correct_count);
  }
  for (const session of sessionResult.data ?? []) {
    const replaced = session.replacements.some((batch) => batch.deleted_at === null && batch.replaces_session_totals);
    if (!replaced && topicNames.has(session.topic_id)) accumulate(session.topic_id, session.question_count, session.correct_count);
  }

  const flaggedTopicIds = new Set((flagsResult.data ?? []).flatMap((entry) => entry.topic_id ? [entry.topic_id] : []));
  const attempts: TopicAttempt[] = [...sums].flatMap(([topicId, sum]) => {
    const names = topicNames.get(topicId);
    return names ? [{ topicId, ...names, ...sum }] : [];
  });
  for (const topicId of flaggedTopicIds) {
    const names = topicNames.get(topicId);
    if (names && !sums.has(topicId)) attempts.push({ topicId, ...names, questions: 0, correct: 0 });
  }

  const recommendations = recommendReinforcement(attempts, flaggedTopicIds);
  const examIds = (examResult.data ?? []).map((exam) => exam.id);
  const [examSubjectsResult, examTopicsResult] = examIds.length ? await Promise.all([
    supabase.from("exam_subjects").select("exam_target_id, subject_id").eq("user_id", user.id).in("exam_target_id", examIds),
    supabase.from("exam_topics").select("exam_target_id, topic_id").eq("user_id", user.id).in("exam_target_id", examIds),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (examSubjectsResult.error || examTopicsResult.error) throw new Error("Não foi possível validar os próximos concursos do seu planejamento.");
  const protectedTopicIds = new Set((examTopicsResult.data ?? []).map((link) => link.topic_id));
  const protectedSubjectIds = new Set((examSubjectsResult.data ?? []).map((link) => link.subject_id));
  const plannerBlocks = planning.blocks.map((block) => ({
    id: block.id, topicId: block.topicId, subject: block.subject, topic: block.topic,
    date: block.plannedDate, minutes: block.plannedMinutes, startTime: block.plannedStartTime,
    status: block.status, pinned: block.pinned, updatedAt: block.updatedAt,
    protectedByExam: protectedTopicIds.has(block.topicId) || [...protectedSubjectIds].some((subjectId) => topicsResult.data?.some((topic) => topic.id === block.topicId && topic.subject_id === subjectId)),
  }));
  return {
    email: user.email ?? "", today, from, dailyGoalMinutes: settings?.daily_goal_minutes ?? 240,
    recommendations, plannerBlocks,
    hasQuestionHistory: attempts.some((attempt) => attempt.questions > 0),
    protectedBlockCount: plannerBlocks.filter((block) => block.protectedByExam).length,
  };
}
