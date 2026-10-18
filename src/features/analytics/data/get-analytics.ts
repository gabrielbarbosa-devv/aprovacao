import "server-only";
import { calculateAnalytics } from "@/features/analytics/domain/calculate-aggregates";
import { resolveAnalyticsFilters, type AnalyticsSearchParams } from "@/features/analytics/domain/filters";
import type { AnalyticsBatch, AnalyticsSession, AnalyticsSubject, AnalyticsSummary } from "@/features/analytics/domain/types";
import { getStudyDay } from "@/lib/date/study-day";
import { requireUser } from "@/lib/auth/require-user";

export type AnalyticsPageData = {
  email: string;
  filters: ReturnType<typeof resolveAnalyticsFilters>["filters"];
  invalidCustomRange: boolean;
  hasQuestionHistory: boolean;
  subjects: AnalyticsSubject[];
  summary: AnalyticsSummary;
};

export async function getAnalyticsPageData(search: AnalyticsSearchParams): Promise<AnalyticsPageData> {
  const { user, supabase } = await requireUser();
  const [settingsResult, subjectResult, topicResult] = await Promise.all([
    supabase.from("user_settings").select("timezone").eq("user_id", user.id).maybeSingle(),
    supabase.from("subjects").select("id, name, archived_at").eq("user_id", user.id).order("sort_order", { ascending: true }),
    supabase.from("topics").select("id, subject_id").eq("user_id", user.id),
  ]);
  if (settingsResult.error || subjectResult.error || topicResult.error) {
    throw new Error("Não foi possível carregar os filtros de desempenho.");
  }

  const today = getStudyDay(settingsResult.data?.timezone ?? "America/Sao_Paulo");
  const subjects: AnalyticsSubject[] = (subjectResult.data ?? []).map((subject) => ({ id: subject.id, name: subject.name, archivedAt: subject.archived_at }));
  const validSubjectIds = new Set(subjects.map((subject) => subject.id));
  const resolved = resolveAnalyticsFilters(search, today, validSubjectIds);
  const selectedSubjectId = resolved.filters.subjectId;
  const topicsById = new Map((topicResult.data ?? []).map((topic) => [topic.id, topic.subject_id]));
  const selectedTopicIds = selectedSubjectId === null
    ? null
    : [...topicsById].filter(([, subjectId]) => subjectId === selectedSubjectId).map(([topicId]) => topicId);

  let batchQuery = supabase.from("question_batches")
    .select("id, studied_on, subject_id, study_session_id, question_count, correct_count, duration_minutes")
    .eq("user_id", user.id).is("deleted_at", null)
    .gte("studied_on", resolved.filters.from).lte("studied_on", resolved.filters.to);
  if (selectedSubjectId) batchQuery = batchQuery.eq("subject_id", selectedSubjectId);

  const sessionsQuery = supabase.from("study_sessions")
    .select("id, topic_id, studied_on, duration_minutes, question_count, correct_count, replacements:question_batches!question_batches_study_session_id_user_id_fkey(id, replaces_session_totals, deleted_at)")
    .eq("user_id", user.id).is("deleted_at", null)
    .gte("studied_on", resolved.filters.from).lte("studied_on", resolved.filters.to);

  const scopedSessionsQuery = selectedTopicIds === null
    ? sessionsQuery
    : selectedTopicIds.length > 0 ? sessionsQuery.in("topic_id", selectedTopicIds) : null;
  const [batchResult, sessionResult, anyBatchResult, anySessionResult] = await Promise.all([
    batchQuery,
    scopedSessionsQuery ?? Promise.resolve({ data: [], error: null }),
    supabase.from("question_batches").select("id").eq("user_id", user.id).is("deleted_at", null).limit(1),
    supabase.from("study_sessions").select("id").eq("user_id", user.id).is("deleted_at", null).gt("question_count", 0).limit(1),
  ]);
  if (batchResult.error || sessionResult.error || anyBatchResult.error || anySessionResult.error) {
    throw new Error("Não foi possível carregar seus dados de desempenho.");
  }

  const subjectIdByTopic = topicsById;
  const batches = toBatches(batchResult.data ?? []);
  const sessions: AnalyticsSession[] = (sessionResult.data ?? []).flatMap((session) => {
    const subjectId = subjectIdByTopic.get(session.topic_id);
    if (!subjectId) return [];
    const hasReplacementBatch = session.replacements.some((batch) => batch.deleted_at === null && batch.replaces_session_totals);
    return [{ id: session.id, studiedOn: session.studied_on, subjectId, questionCount: session.question_count,
      correctCount: session.correct_count, durationMinutes: session.duration_minutes, hasReplacementBatch }];
  });
  const summary = calculateAnalytics({ batches, sessions, subjects, filters: resolved.filters });

  return { email: user.email ?? "", filters: resolved.filters, invalidCustomRange: resolved.invalidCustomRange,
    hasQuestionHistory: (anyBatchResult.data?.length ?? 0) > 0 || (anySessionResult.data?.length ?? 0) > 0, subjects, summary };
}

type BatchRow = {
  id: string;
  studied_on: string;
  subject_id: string;
  study_session_id: string | null;
  question_count: number;
  correct_count: number;
  duration_minutes: number | null;
};

function toBatches(rows: BatchRow[]): AnalyticsBatch[] {
  return rows.map((batch) => ({ id: batch.id, studiedOn: batch.studied_on, subjectId: batch.subject_id,
    studySessionId: batch.study_session_id, questionCount: batch.question_count,
    correctCount: batch.correct_count, durationMinutes: batch.duration_minutes }));
}
