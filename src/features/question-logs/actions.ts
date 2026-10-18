"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { deleteQuestionBatchSchema, questionBatchSchema } from "@/features/question-logs/domain/schemas";
import type { QuestionActionResult } from "@/features/question-logs/domain/types";

export async function saveQuestionBatchAction(input: unknown): Promise<QuestionActionResult> {
  const parsed = questionBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados informados." };
  const { supabase } = await requireUser();
  const value = parsed.data;
  const { data, error } = await supabase.rpc("save_question_batch", {
    p_batch_id: value.id, p_operation_key: value.operationKey, p_studied_on: value.studiedOn,
    p_subject_id: value.subjectId, p_topic_id: value.topicId, p_source_type: value.sourceType,
    p_source_label: value.sourceLabel, p_exam_target_id: value.examTargetId, p_study_session_id: value.studySessionId,
    p_question_count: value.questionCount, p_correct_count: value.correctCount, p_duration_minutes: value.durationMinutes,
    p_notes: value.notes, p_replaces_session_totals: value.replacesSessionTotals,
  });
  if (error) {
    if (error.code === "23503" || error.code === "23514") return { ok: false, message: "A matéria, tópico, concurso ou sessão não corresponde mais às suas opções. Atualize a tela e tente novamente." };
    if (error.code === "23505") return { ok: false, message: "Já existe um registro que substitui o resumo desta sessão. Edite esse registro para evitar duplicidade." };
    if (error.code === "22023") return { ok: false, message: "Confira os números e a data do registro." };
    return { ok: false, message: "Não foi possível salvar o lote de questões. Tente novamente." };
  }
  const response = readRpcResponse(data);
  if (!response) return { ok: false, message: "O banco não confirmou o registro salvo." };
  revalidatePath("/registros");
  return { ok: true, id: response.id, status: response.status };
}

export async function deleteQuestionBatchAction(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = deleteQuestionBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Registro inválido." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("delete_question_batch", { p_batch_id: parsed.data.id });
  if (error || data !== "deleted") return { ok: false, message: data === "not_found" ? "Este lote não foi encontrado ou já foi arquivado." : "Não foi possível excluir o lote." };
  revalidatePath("/registros");
  return { ok: true };
}

function readRpcResponse(value: unknown): { id: string; status: "created" | "updated" | "exists" } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (typeof response.batch_id !== "string") return null;
  if (response.status !== "created" && response.status !== "updated" && response.status !== "exists") return null;
  return { id: response.batch_id, status: response.status };
}
