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

  const subjectById = new Map((rawSubjects ?? []).map((subject) => [subject.id, subject.name]));
  const topicById = new Map((rawTopics ?? []).filter((topic) => subjectById.has(topic.subject_id)).map((topic) => [topic.id, topic]));
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
