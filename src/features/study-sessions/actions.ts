"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { getStudyDay } from "@/lib/date/study-day";
import { deleteStudySessionSchema, studySessionSchema } from "@/features/study-sessions/domain/schemas";
import type { SaveStudySessionResult } from "@/features/study-sessions/domain/types";

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export async function saveStudySessionAction(input: unknown): Promise<SaveStudySessionResult> {
  const parsed = studySessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados informados." };
  const { supabase } = await requireUser();
  const value = parsed.data;
  const { data: settings, error: settingsError } = await supabase.from("user_settings")
    .select("timezone").maybeSingle();
  if (settingsError) return { ok: false, message: "Não foi possível validar a data do estudo." };
  if (value.studiedOn > getStudyDay(settings?.timezone ?? "America/Sao_Paulo")) {
    return { ok: false, message: "A data do estudo não pode estar no futuro." };
  }
  const { data, error } = await supabase.rpc("save_study_session", {
    p_session_id: value.sessionId,
    p_operation_key: value.sessionId ? null : value.operationKey,
    p_block_id: value.blockId,
    p_topic_id: value.topicId,
    p_studied_on: value.studiedOn,
    p_duration_minutes: value.durationMinutes,
    p_question_count: value.questionCount,
    p_correct_count: value.correctCount,
    p_notes: value.notes,
  });
  if (error || typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, message: "Não foi possível salvar o registro. Tente novamente." };
  }
  const response = data as Record<string, unknown>;
  if (response.status !== "created" && response.status !== "updated" && response.status !== "exists") {
    const message = response.status === "invalid_relation"
      ? "O tópico ou bloco não está mais disponível para este registro. Atualize a página."
      : response.status === "not_found"
        ? "Este registro não está mais disponível. Atualize a página."
        : "Confira os dados informados e tente novamente.";
    return { ok: false, message };
  }
  if (typeof response.session_id !== "string") return { ok: false, message: "Não foi possível confirmar o registro salvo." };
  revalidatePath("/");
  revalidatePath("/planejamento");
  return { ok: true, status: response.status, sessionId: response.session_id, reviewDates: stringArray(response.review_dates) };
}

export async function deleteStudySessionAction(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = deleteStudySessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Registro inválido." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("delete_study_session", { p_session_id: parsed.data.sessionId });
  if (error || data !== "deleted") {
    return { ok: false, message: data === "not_found" ? "Este registro não foi encontrado." : "Não foi possível excluir o registro." };
  }
  revalidatePath("/");
  revalidatePath("/planejamento");
  return { ok: true };
}
