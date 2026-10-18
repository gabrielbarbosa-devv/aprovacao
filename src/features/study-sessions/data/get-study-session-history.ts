import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import type { StudySessionRecord } from "@/features/study-sessions/domain/types";

export async function getStudySessionHistory(limit = 10): Promise<StudySessionRecord[]> {
  const { user, supabase } = await requireUser();
  const { data: sessions, error } = await supabase.from("study_sessions")
    .select("id, block_id, topic_id, studied_on, duration_minutes, question_count, correct_count, notes")
    .eq("user_id", user.id).is("deleted_at", null).order("studied_on", { ascending: false })
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error("Não foi possível carregar seu histórico de estudos.");
  if (!sessions?.length) return [];

  const topicIds = [...new Set(sessions.map((session) => session.topic_id))];
  const [{ data: topics, error: topicsError }, { data: tasks, error: tasksError }] = await Promise.all([
    supabase.from("topics").select("id, subject_id, title").eq("user_id", user.id).in("id", topicIds),
    supabase.from("review_tasks").select("study_session_id, due_on").eq("user_id", user.id)
      .eq("review_kind", "standard").in("study_session_id", sessions.map((session) => session.id))
      .order("interval_days", { ascending: true }),
  ]);
  if (topicsError || tasksError) throw new Error("Não foi possível carregar os detalhes do histórico.");
  const subjectIds = [...new Set((topics ?? []).map((topic) => topic.subject_id))];
  const { data: subjects, error: subjectsError } = subjectIds.length
    ? await supabase.from("subjects").select("id, name").eq("user_id", user.id).in("id", subjectIds)
    : { data: [], error: null };
  if (subjectsError) throw new Error("Não foi possível carregar as matérias do histórico.");

  const subjectById = new Map((subjects ?? []).map((subject) => [subject.id, subject.name]));
  const topicById = new Map((topics ?? []).map((topic) => [topic.id, topic]));
  const datesBySession = new Map<string, string[]>();
  for (const task of tasks ?? []) {
    const dates = datesBySession.get(task.study_session_id) ?? [];
    dates.push(task.due_on);
    datesBySession.set(task.study_session_id, dates);
  }
  return sessions.flatMap((session) => {
    const topic = topicById.get(session.topic_id);
    const subject = topic ? subjectById.get(topic.subject_id) : undefined;
    return topic && subject ? [{
      id: session.id, blockId: session.block_id, topicId: session.topic_id, subject, topic: topic.title,
      studiedOn: session.studied_on, durationMinutes: session.duration_minutes,
      questionCount: session.question_count, correctCount: session.correct_count,
      notes: session.notes, reviewDates: datesBySession.get(session.id) ?? [],
    }] : [];
  });
}
