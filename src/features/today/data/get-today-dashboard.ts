import "server-only";
import { getStudyDay } from "@/lib/date/study-day";
import { requireUser } from "@/lib/auth/require-user";
import type { TodayDashboard } from "@/features/today/domain/types";
import { getStudySessionHistory } from "@/features/study-sessions/data/get-study-session-history";

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_DAILY_GOAL_MINUTES = 240;

export async function getTodayDashboard(): Promise<TodayDashboard> {
  const { user, supabase } = await requireUser();
  const [{ data: settings, error: settingsError }, { data: subjects, error: subjectsError }, { data: allBlocks, error: allBlocksError }] =
    await Promise.all([
      supabase
        .from("user_settings")
        .select("timezone, daily_goal_minutes")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("subjects").select("id").eq("user_id", user.id).limit(1),
      supabase.from("study_blocks").select("id").eq("user_id", user.id).limit(1),
    ]);

  if (settingsError || subjectsError || allBlocksError) {
    throw new Error("Não foi possível carregar seus dados de estudo.");
  }

  const timeZone = settings?.timezone ?? DEFAULT_TIME_ZONE;
  const studyDay = getStudyDay(timeZone);
  const { data: blocks, error: blocksError } = await supabase
    .from("study_blocks")
    .select("id, topic_id, planned_minutes, sort_order, status")
    .eq("user_id", user.id)
    .eq("planned_date", studyDay)
    .in("status", ["planejado", "em_andamento"])
    .order("sort_order", { ascending: true })
    .limit(2);

  if (blocksError) throw new Error("Não foi possível carregar o planejamento de hoje.");

  const topicIds = (blocks ?? []).map((block) => block.topic_id);
  const { data: topics, error: topicsError } = topicIds.length
    ? await supabase
        .from("topics")
        .select("id, title, subject_id")
        .eq("user_id", user.id)
        .in("id", topicIds)
    : { data: [], error: null };

  if (topicsError) throw new Error("Não foi possível carregar as matérias dos blocos.");

  const subjectIds = [...new Set((topics ?? []).map((topic) => topic.subject_id))];
  const { data: topicSubjects, error: topicSubjectsError } = subjectIds.length
    ? await supabase
        .from("subjects")
        .select("id, name")
        .eq("user_id", user.id)
        .in("id", subjectIds)
    : { data: [], error: null };

  if (topicSubjectsError) throw new Error("Não foi possível carregar as matérias dos blocos.");

  const [{ data: activeTopics, error: activeTopicsError }, history] = await Promise.all([
    supabase.from("topics").select("id, subject_id, title").eq("user_id", user.id).is("archived_at", null).order("sort_order", { ascending: true }),
    getStudySessionHistory(10),
  ]);
  if (activeTopicsError) throw new Error("Não foi possível carregar seus tópicos.");
  const activeSubjectIds = [...new Set((activeTopics ?? []).map((topic) => topic.subject_id))];
  const { data: activeSubjects, error: activeSubjectsError } = activeSubjectIds.length
    ? await supabase.from("subjects").select("id, name").eq("user_id", user.id).is("archived_at", null).in("id", activeSubjectIds)
    : { data: [], error: null };
  if (activeSubjectsError) throw new Error("Não foi possível carregar suas matérias.");

  const topicById = new Map((topics ?? []).map((topic) => [topic.id, topic]));
  const subjectById = new Map((topicSubjects ?? []).map((subject) => [subject.id, subject.name]));

  return {
    studyDay,
    timeZone,
    dailyGoalMinutes: settings?.daily_goal_minutes ?? DEFAULT_DAILY_GOAL_MINUTES,
    email: user.email ?? "",
    blocks: (blocks ?? []).flatMap((block, index) => {
      const topic = topicById.get(block.topic_id);
      if (!topic) return [];
      const subject = subjectById.get(topic.subject_id);
      if (!subject) return [];

      return [{
        id: block.id,
        topicId: block.topic_id,
        subject,
        topic: topic.title,
        durationMinutes: block.planned_minutes,
        sequence: index + 1,
        status: block.status as "planejado" | "em_andamento",
      }];
    }),
    hasPlan: Boolean(subjects?.length || allBlocks?.length),
    reviewCount: 0,
    topics: (activeTopics ?? []).flatMap((topic) => {
      const subject = (activeSubjects ?? []).find((entry) => entry.id === topic.subject_id)?.name;
      return subject ? [{ id: topic.id, subject, topic: topic.title }] : [];
    }),
    history,
  };
}
