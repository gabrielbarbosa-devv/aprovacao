import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import { getStudyDay } from "@/lib/date/study-day";
import type { Subject, SubjectsPageData, SubjectColorToken } from "@/features/subjects/domain/types";
import type { TopicStatus } from "@/features/topics/domain/types";

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export async function getSubjectsPageData(): Promise<SubjectsPageData> {
  const { user, supabase } = await requireUser();
  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (settingsError) throw new Error("Não foi possível carregar suas matérias.");
  const today = getStudyDay(settings?.timezone ?? DEFAULT_TIME_ZONE);

  const [subjectResult, topicResult, blockResult] = await Promise.all([
    supabase.from("subjects")
      .select("id, name, color_token, sort_order, is_focus, archived_at")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("topics")
      .select("id, subject_id, title, status, archived_at")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase.from("study_blocks")
      .select("topic_id")
      .eq("user_id", user.id)
      .gt("planned_date", today)
      .in("status", ["planejado", "em_andamento"]),
  ]);

  if (subjectResult.error || topicResult.error || blockResult.error) {
    throw new Error("Não foi possível carregar suas matérias.");
  }

  const topicById = new Map((topicResult.data ?? []).map((topic) => [topic.id, topic]));
  const futureBlocksBySubject = new Map<string, number>();
  for (const block of blockResult.data ?? []) {
    const topic = topicById.get(block.topic_id);
    if (topic) futureBlocksBySubject.set(topic.subject_id, (futureBlocksBySubject.get(topic.subject_id) ?? 0) + 1);
  }

  const subjects: Subject[] = (subjectResult.data ?? []).map((subject) => ({
    id: subject.id,
    name: subject.name,
    colorToken: isSubjectColorToken(subject.color_token) ? subject.color_token : null,
    sortOrder: subject.sort_order,
    isFocus: subject.is_focus,
    archivedAt: subject.archived_at,
    topics: (topicResult.data ?? [])
      .filter((topic) => topic.subject_id === subject.id && topic.archived_at === null)
      .map((topic) => ({
        id: topic.id,
        title: topic.title,
        status: normalizeTopicStatus(topic.status),
      })),
    futureBlockCount: futureBlocksBySubject.get(subject.id) ?? 0,
  }));

  return { email: user.email ?? "", subjects };
}

function isSubjectColorToken(value: string | null): value is SubjectColorToken {
  return value === "blue" || value === "green" || value === "violet" || value === "orange" || value === "rose";
}

function normalizeTopicStatus(value: string): TopicStatus {
  if (value === "em_andamento" || value === "revisando" || value === "dominado" || value === "concluido") return value;
  return "nao_iniciado";
}
