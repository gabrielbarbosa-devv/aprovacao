import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ReviewTask } from "@/features/reviews/domain/types";

type Client = SupabaseClient<Database>;
type TaskRow = Database["public"]["Tables"]["review_tasks"]["Row"];

const taskFields = "id, user_id, study_session_id, topic_id, review_kind, interval_days, due_on, initial_due_on, status, completed_at, difficulty, notes, parent_review_id, reviewed_on, review_question_count, review_correct_count, review_notes, created_at, updated_at";

export type EnrichedReviewTask = ReviewTask;

async function enrichTasks(client: Client, userId: string, tasks: TaskRow[]): Promise<EnrichedReviewTask[]> {
  if (tasks.length === 0) return [];
  const topicIds = [...new Set(tasks.map((task) => task.topic_id))];
  const sessionIds = [...new Set(tasks.map((task) => task.study_session_id))];
  const [{ data: topics, error: topicsError }, { data: sessions, error: sessionsError }] = await Promise.all([
    client.from("topics").select("id, subject_id, title, notes, source_url").eq("user_id", userId).in("id", topicIds),
    client.from("study_sessions").select("id, topic_id, studied_on, duration_minutes, question_count, correct_count, notes").eq("user_id", userId).in("id", sessionIds).is("deleted_at", null),
  ]);
  if (topicsError || sessionsError) throw new Error("Não foi possível carregar os dados das revisões.");

  const subjectIds = [...new Set((topics ?? []).map((topic) => topic.subject_id))];
  const { data: subjects, error: subjectsError } = subjectIds.length
    ? await client.from("subjects").select("id, name").eq("user_id", userId).in("id", subjectIds)
    : { data: [], error: null };
  if (subjectsError) throw new Error("Não foi possível carregar as matérias das revisões.");

  const topicById = new Map((topics ?? []).map((topic) => [topic.id, topic]));
  const sessionById = new Map((sessions ?? []).map((session) => [session.id, session]));
  const subjectById = new Map((subjects ?? []).map((subject) => [subject.id, subject.name]));

  return tasks.flatMap((task) => {
    const topic = topicById.get(task.topic_id);
    const session = sessionById.get(task.study_session_id);
    const subject = topic ? subjectById.get(topic.subject_id) : undefined;
    if (!topic || !session || !subject || session.topic_id !== topic.id) return [];
    return [{
      id: task.id,
      sessionId: session.id,
      subject,
      topic: topic.title,
      topicNotes: topic.notes,
      sourceUrl: topic.source_url,
      studiedOn: session.studied_on,
      studyDurationMinutes: session.duration_minutes,
      studyQuestionCount: session.question_count,
      studyCorrectCount: session.correct_count,
      studyNotes: session.notes,
      kind: task.review_kind === "reinforcement" ? "reinforcement" as const : "standard" as const,
      intervalDays: task.interval_days,
      dueOn: task.due_on,
      initialDueOn: task.initial_due_on,
      status: task.status === "completed" ? "completed" as const : "pending" as const,
      completedAt: task.completed_at,
      outcome: task.reviewed_on ? {
        reviewedOn: task.reviewed_on,
        difficulty: task.difficulty,
        questionCount: task.review_question_count,
        correctCount: task.review_correct_count,
        notes: task.review_notes,
      } : null,
    }];
  });
}

export async function getDueReviewSummary(client: Client, userId: string, studyDay: string) {
  const { data, count, error } = await client.from("review_tasks")
    .select(taskFields, { count: "exact" }).eq("user_id", userId).eq("status", "pending")
    .lte("due_on", studyDay).order("due_on", { ascending: true }).order("created_at", { ascending: true }).limit(4);
  if (error) throw new Error("Não foi possível carregar as revisões pendentes.");
  return { total: count ?? 0, items: await enrichTasks(client, userId, data ?? []) };
}

export async function getReviewTasksForBoard(client: Client, userId: string, studyDay: string) {
  const [due, upcoming, completed] = await Promise.all([
    client.from("review_tasks").select(taskFields).eq("user_id", userId).eq("status", "pending")
      .lte("due_on", studyDay).order("due_on", { ascending: true }).order("created_at", { ascending: true }).limit(500),
    client.from("review_tasks").select(taskFields).eq("user_id", userId).eq("status", "pending")
      .gt("due_on", studyDay).order("due_on", { ascending: true }).order("created_at", { ascending: true }).limit(500),
    client.from("review_tasks").select(taskFields).eq("user_id", userId).eq("status", "completed")
      .order("reviewed_on", { ascending: false }).order("completed_at", { ascending: false }).limit(500),
  ]);
  if (due.error || upcoming.error || completed.error) throw new Error("Não foi possível carregar suas revisões.");
  const buckets = await Promise.all([
    enrichTasks(client, userId, due.data ?? []),
    enrichTasks(client, userId, upcoming.data ?? []),
    enrichTasks(client, userId, completed.data ?? []),
  ]);
  return { due: buckets[0] ?? [], upcoming: buckets[1] ?? [], completed: buckets[2] ?? [] };
}
