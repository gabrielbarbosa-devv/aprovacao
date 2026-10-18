"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { archiveExamTargetSchema, examTargetSchema } from "@/features/exams/domain/schemas";
import type { ExamActionResult } from "@/features/exams/domain/types";

function readTargetId(value: unknown): string | null {
  if (value && typeof value === "object" && "target_id" in value && typeof value.target_id === "string") return value.target_id;
  return null;
}

export async function saveExamTargetAction(input: unknown): Promise<ExamActionResult> {
  const parsed = examTargetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados do concurso." };
  const { supabase } = await requireUser();
  const value = parsed.data;
  const { data, error } = await supabase.rpc("save_exam_target", {
    p_target_id: value.id,
    p_exam_name: value.examName,
    p_institution: value.institution,
    p_role_title: value.roleTitle,
    p_jurisdiction: value.jurisdiction,
    p_current_stage: value.currentStage,
    p_priority: value.priority,
    p_exam_date: value.examDate,
    p_application_deadline: value.applicationDeadline,
    p_official_url: value.officialUrl,
    p_notes: value.notes,
    p_subject_ids: value.subjectIds,
    p_topic_ids: value.topicIds,
  });
  if (error) {
    if (error.code === "P0002") return { ok: false, message: "Concurso não encontrado ou arquivado. Atualize a página." };
    if (error.code === "23503" || error.code === "23514" || error.code === "22023") return { ok: false, message: "Uma matéria ou tópico selecionado não está mais disponível. Atualize os dados e tente novamente." };
    return { ok: false, message: "Não foi possível salvar o concurso. Tente novamente." };
  }
  const id = readTargetId(data);
  if (!id) return { ok: false, message: "O concurso não foi salvo. Atualize a página e tente novamente." };
  revalidatePath("/concursos");
  return { ok: true, id };
}

export async function setExamTargetArchivedAction(input: unknown): Promise<ExamActionResult> {
  const parsed = archiveExamTargetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Concurso inválido. Atualize a página." };
  const { user, supabase } = await requireUser();
  const query = supabase.from("exam_targets").update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id).eq("user_id", user.id);
  const { data, error } = await (parsed.data.archived ? query.is("archived_at", null) : query.not("archived_at", "is", null)).select("id").maybeSingle();
  if (error) return { ok: false, message: "Não foi possível atualizar o concurso." };
  if (!data) return { ok: false, message: parsed.data.archived ? "Concurso não encontrado ou já arquivado. Atualize a página." : "Concurso não encontrado ou já ativo. Atualize a página." };
  revalidatePath("/concursos");
  return { ok: true };
}
