import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import { getStudyDay } from "@/lib/date/study-day";
import { reconcileQuestionRecords, type QuestionBatch, type QuestionLogsPageData, type QuestionLogRecord, type StudySessionSummary } from "@/features/question-logs/domain/types";

export async function getQuestionLogsPageData(): Promise<QuestionLogsPageData> {
  const { user, supabase } = await requireUser();
  const [batchResult, sessionResult, subjectResult, topicResult, targetResult, examSubjectResult, examTopicResult, settingsResult] = await Promise.all([
    supabase.from("question_batches").select("id, operation_key, studied_on, subject_id, topic_id, source_type, source_label, exam_target_id, study_session_id, question_count, correct_count, duration_minutes, notes, replaces_session_totals, created_at").eq("user_id", user.id).is("deleted_at", null).order("studied_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("study_sessions").select("id, topic_id, studied_on, duration_minutes, question_count, correct_count, deleted_at, created_at").eq("user_id", user.id).order("studied_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("subjects").select("id, name, archived_at").eq("user_id", user.id).order("sort_order", { ascending: true }),
    supabase.from("topics").select("id, title, subject_id, archived_at").eq("user_id", user.id).order("sort_order", { ascending: true }),
    supabase.from("exam_targets").select("id, exam_name, institution, archived_at").eq("user_id", user.id),
    supabase.from("exam_subjects").select("exam_target_id, subject_id").eq("user_id", user.id),
    supabase.from("exam_topics").select("exam_target_id, topic_id").eq("user_id", user.id),
    supabase.from("user_settings").select("timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  if (batchResult.error || sessionResult.error || subjectResult.error || topicResult.error || targetResult.error || examSubjectResult.error || examTopicResult.error || settingsResult.error) {
    throw new Error("Não foi possível carregar seus registros de questões.");
  }

  const subjects = (subjectResult.data ?? []).map((subject) => ({ id: subject.id, name: subject.name, archivedAt: subject.archived_at }));
  const topics = (topicResult.data ?? []).map((topic) => ({ id: topic.id, title: topic.title, subjectId: topic.subject_id, archivedAt: topic.archived_at }));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const targetById = new Map((targetResult.data ?? []).map((target) => [target.id, target]));
  const subjectIdsByTarget = groupValues(examSubjectResult.data ?? [], (row) => row.exam_target_id, (row) => row.subject_id);
  const topicIdsByTarget = groupValues(examTopicResult.data ?? [], (row) => row.exam_target_id, (row) => row.topic_id);

  const sessions: StudySessionSummary[] = (sessionResult.data ?? []).flatMap((session) => {
    const topic = topicById.get(session.topic_id);
    const subject = topic ? subjectById.get(topic.subjectId) : undefined;
    return topic && subject ? [{ id: session.id, studiedOn: session.studied_on, subjectId: subject.id, topicId: topic.id, questionCount: session.question_count, correctCount: session.correct_count, durationMinutes: session.duration_minutes, deletedAt: session.deleted_at, createdAt: session.created_at }] : [];
  });
  const batches: QuestionBatch[] = (batchResult.data ?? []).map((batch) => ({
    id: batch.id, operationKey: batch.operation_key, studiedOn: batch.studied_on, subjectId: batch.subject_id, topicId: batch.topic_id,
    sourceType: normalizeSourceType(batch.source_type), sourceLabel: batch.source_label, examTargetId: batch.exam_target_id,
    studySessionId: batch.study_session_id, questionCount: batch.question_count, correctCount: batch.correct_count,
    durationMinutes: batch.duration_minutes, notes: batch.notes, replacesSessionTotals: batch.replaces_session_totals, createdAt: batch.created_at,
  }));
  const canonical = reconcileQuestionRecords(batches, sessions);
  const batchRecords: QuestionLogRecord[] = canonical.batches.flatMap((batch) => {
    const subject = subjectById.get(batch.subjectId);
    if (!subject) return [];
    const topic = batch.topicId ? topicById.get(batch.topicId) : undefined;
    const target = batch.examTargetId ? targetById.get(batch.examTargetId) : undefined;
    return [{ id: batch.id, kind: "batch", studiedOn: batch.studiedOn, subjectId: subject.id, subjectName: subject.name,
      topicId: topic?.id ?? null, topicTitle: topic?.title ?? null, sourceType: batch.sourceType, sourceLabel: batch.sourceLabel,
      examTargetId: target?.id ?? null, examTargetName: target?.exam_name ?? null, studySessionId: batch.studySessionId,
      questionCount: batch.questionCount, correctCount: batch.correctCount, durationMinutes: batch.durationMinutes,
      notes: batch.notes, replacesSessionTotals: batch.replacesSessionTotals, createdAt: batch.createdAt }];
  });
  const summaryRecords: QuestionLogRecord[] = canonical.sessionSummaries.flatMap((session) => {
    const subject = subjectById.get(session.subjectId);
    const topic = topicById.get(session.topicId);
    if (!subject || !topic) return [];
    return [{ id: `session-summary:${session.id}`, kind: "study_summary", studiedOn: session.studiedOn, subjectId: subject.id, subjectName: subject.name,
      topicId: topic.id, topicTitle: topic.title, sourceType: "registro_estudo", sourceLabel: "Resumo do estudo", examTargetId: null,
      examTargetName: null, studySessionId: session.id, questionCount: session.questionCount, correctCount: session.correctCount,
      durationMinutes: session.durationMinutes, notes: null, replacesSessionTotals: false, createdAt: session.createdAt }];
  });
  const records = [...batchRecords, ...summaryRecords].sort((a, b) => b.studiedOn.localeCompare(a.studiedOn) || b.createdAt.localeCompare(a.createdAt));
  const studySessions = sessions.flatMap((session) => {
    const subject = subjectById.get(session.subjectId);
    const topic = topicById.get(session.topicId);
    return subject && topic ? [{ ...session, subjectName: subject.name, topicTitle: topic.title }] : [];
  });

  return { email: user.email ?? "", today: getStudyDay(settingsResult.data?.timezone ?? "America/Sao_Paulo"), batches, records, subjects, topics,
    examTargets: (targetResult.data ?? []).map((target) => ({ id: target.id, name: target.exam_name, institution: target.institution,
      archivedAt: target.archived_at, subjectIds: subjectIdsByTarget.get(target.id) ?? [], topicIds: topicIdsByTarget.get(target.id) ?? [] })),
    studySessions };
}

function groupValues<T, K extends string, V>(rows: T[], getKey: (row: T) => K, getValue: (row: T) => V): Map<K, V[]> {
  const groups = new Map<K, V[]>();
  for (const row of rows) {
    const key = getKey(row);
    const group = groups.get(key) ?? [];
    group.push(getValue(row));
    groups.set(key, group);
  }
  return groups;
}

function normalizeSourceType(value: string): QuestionBatch["sourceType"] {
  if (value === "prova_oficial" || value === "pdf" || value === "outro") return value;
  return "plataforma";
}
