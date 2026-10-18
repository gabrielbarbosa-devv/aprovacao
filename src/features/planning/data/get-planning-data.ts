import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import { getStudyDay } from "@/lib/date/study-day";
import { getWeekStart, isStudyDate } from "@/features/planning/domain/dates";
import type { PlanningBlock, PlanningData, PlanningTopicOption } from "@/features/planning/domain/types";

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_DAILY_GOAL_MINUTES = 240;

export async function getPlanningData(requestedWeek?: string): Promise<PlanningData> {
  const { user, supabase } = await requireUser();
  const { data: settings, error: settingsError } = await supabase
    .from("user_settings").select("timezone, daily_goal_minutes").eq("user_id", user.id).maybeSingle();
  if (settingsError) throw new Error("Não foi possível carregar suas configurações de planejamento.");

  const timeZone = settings?.timezone ?? DEFAULT_TIME_ZONE;
  const today = getStudyDay(timeZone);
  const weekStart = getWeekStart(requestedWeek && isStudyDate(requestedWeek) ? requestedWeek : today);

  const [{ data: rawBlocks, error: blocksError }, { data: rawTopics, error: topicsError }, { data: rawSubjects, error: subjectsError }] = await Promise.all([
    supabase.from("study_blocks").select("id, topic_id, planned_date, planned_minutes, planned_start_time, moved_from_date, pinned, sort_order, status")
      .eq("user_id", user.id).order("planned_date", { ascending: true }).order("sort_order", { ascending: true }),
    supabase.from("topics").select("id, subject_id, title, archived_at").eq("user_id", user.id).order("sort_order", { ascending: true }),
    supabase.from("subjects").select("id, name, archived_at").eq("user_id", user.id).order("sort_order", { ascending: true }),
  ]);
  if (blocksError || topicsError || subjectsError) throw new Error("Não foi possível carregar seu planejamento.");

  const blockIds = (rawBlocks ?? []).map((block) => block.id);
  const { data: sessions, error: sessionsError } = blockIds.length
    ? await supabase.from("study_sessions").select("id, block_id, topic_id, studied_on, duration_minutes, question_count, correct_count, notes")
      .eq("user_id", user.id).is("deleted_at", null).in("block_id", blockIds)
    : { data: [], error: null };
  if (sessionsError) throw new Error("Não foi possível carregar os registros dos blocos.");
  const sessionIds = (sessions ?? []).map((session) => session.id);
  const { data: reviews, error: reviewsError } = sessionIds.length
    ? await supabase.from("review_tasks").select("study_session_id, due_on, interval_days").eq("user_id", user.id)
      .eq("review_kind", "standard").in("study_session_id", sessionIds).order("interval_days", { ascending: true })
    : { data: [], error: null };
  if (reviewsError) throw new Error("Não foi possível carregar as revisões dos registros.");

  const subjectById = new Map((rawSubjects ?? []).map((subject) => [subject.id, subject.name]));
  const topicById = new Map((rawTopics ?? []).filter((topic) => subjectById.has(topic.subject_id)).map((topic) => [topic.id, topic]));
  const reviewsBySession = new Map<string, string[]>();
  for (const review of reviews ?? []) {
    const dates = reviewsBySession.get(review.study_session_id) ?? [];
    dates.push(review.due_on);
    reviewsBySession.set(review.study_session_id, dates);
  }
  const sessionByBlock = new Map((sessions ?? []).flatMap((session) => {
    if (!session.block_id) return [];
    const topic = topicById.get(session.topic_id);
    const subject = topic ? subjectById.get(topic.subject_id) : undefined;
    if (!topic || !subject) return [];
    return [[session.block_id, {
      id: session.id, blockId: session.block_id, topicId: session.topic_id, subject, topic: topic.title,
      studiedOn: session.studied_on, durationMinutes: session.duration_minutes, questionCount: session.question_count,
      correctCount: session.correct_count, notes: session.notes, reviewDates: reviewsBySession.get(session.id) ?? [],
    }] as const];
  }));
  const blocks: PlanningBlock[] = (rawBlocks ?? []).flatMap((block) => {
    const topic = topicById.get(block.topic_id);
    const subject = topic ? subjectById.get(topic.subject_id) : undefined;
    if (!topic || !subject) return [];
    return [{
      id: block.id,
      topicId: block.topic_id,
      subject,
      topic: topic.title,
      plannedDate: block.planned_date,
      plannedMinutes: block.planned_minutes,
      plannedStartTime: block.planned_start_time,
      status: block.status as PlanningBlock["status"],
      pinned: block.pinned,
      sortOrder: block.sort_order,
      studySession: sessionByBlock.get(block.id) ?? null,
    }];
  });
  const activeSubjectIds = new Set((rawSubjects ?? []).filter((subject) => subject.archived_at === null).map((subject) => subject.id));
  const topics: PlanningTopicOption[] = (rawTopics ?? []).filter((topic) => topic.archived_at === null && activeSubjectIds.has(topic.subject_id)).flatMap((topic) => {
    const subject = subjectById.get(topic.subject_id);
    return subject ? [{ id: topic.id, subjectId: topic.subject_id, subject, topic: topic.title }] : [];
  });

  return {
    email: user.email ?? "",
    today,
    timeZone,
    dailyGoalMinutes: settings?.daily_goal_minutes ?? DEFAULT_DAILY_GOAL_MINUTES,
    weekStart,
    blocks,
    topics,
  };
}
