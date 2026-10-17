"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createStudyBlockSchema, reorganizeSchema, studyBlockInputSchema } from "@/features/planning/domain/schemas";

export type PlanningActionResult = { ok: true } | { ok: false; message: string };

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveStudyBlockAction(formData: FormData): Promise<PlanningActionResult> {
  const parsed = createStudyBlockSchema.safeParse({
    id: formValue(formData, "id"),
    topicId: formValue(formData, "topicId"),
    plannedDate: formValue(formData, "plannedDate"),
    plannedMinutes: formValue(formData, "plannedMinutes"),
    plannedStartTime: formValue(formData, "plannedStartTime") || null,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados informados." };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_planned_study_block", {
    p_id: parsed.data.id,
    p_topic_id: parsed.data.topicId,
    p_planned_date: parsed.data.plannedDate,
    p_planned_minutes: parsed.data.plannedMinutes,
    p_planned_start_time: parsed.data.plannedStartTime,
  });
  if (error || data !== "saved") {
    return { ok: false, message: data === "invalid_topic" ? "Escolha um tópico ativo da sua conta." : "Não foi possível salvar o bloco. Atualize a página e tente novamente." };
  }
  revalidatePath("/planejamento");
  revalidatePath("/");
  return { ok: true };
}

export async function updateStudyBlockAction(input: unknown): Promise<PlanningActionResult> {
  const parsed = studyBlockInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados informados." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("update_planned_study_block", {
    p_id: parsed.data.id,
    p_topic_id: parsed.data.topicId,
    p_planned_date: parsed.data.plannedDate,
    p_planned_minutes: parsed.data.plannedMinutes,
    p_planned_start_time: parsed.data.plannedStartTime,
    p_status: parsed.data.status,
  });
  if (error || data !== "saved") return { ok: false, message: "Não foi possível atualizar o bloco. Confira se ele ainda está disponível e tente novamente." };
  revalidatePath("/planejamento");
  revalidatePath("/");
  return { ok: true };
}

export async function reorganizeStudyBlocksAction(input: unknown): Promise<PlanningActionResult> {
  const parsed = reorganizeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "A prévia está inválida." };
  if (new Set(parsed.data.expected.map(({ id }) => id)).size !== parsed.data.expected.length
      || new Set(parsed.data.changes.map(({ id }) => id)).size !== parsed.data.changes.length) {
    return { ok: false, message: "A prévia contém blocos duplicados. Atualize a tela e tente novamente." };
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("apply_schedule_reorganization", {
    p_expected: parsed.data.expected,
    p_changes: parsed.data.changes,
  });
  if (error || data !== "applied") {
    const message = data === "stale"
      ? "O planejamento mudou desde a prévia. Atualize a tela e gere outra prévia."
      : data === "over_capacity"
        ? "A reorganização ultrapassaria sua meta diária. Gere outra prévia."
        : "Não foi possível reorganizar os blocos. Nenhuma alteração foi aplicada.";
    return { ok: false, message };
  }
  revalidatePath("/planejamento");
  revalidatePath("/");
  return { ok: true };
}
