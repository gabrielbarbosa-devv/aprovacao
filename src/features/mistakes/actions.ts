"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { deleteMistakeEntrySchema, mistakeEntrySchema } from "@/features/mistakes/domain/schemas";
import type { MistakeActionResult } from "@/features/mistakes/domain/types";

export async function saveMistakeEntryAction(input: unknown): Promise<MistakeActionResult> {
  const parsed = mistakeEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados da ficha." };
  const { supabase } = await requireUser();
  const value = parsed.data;
  const { data, error } = await supabase.rpc("save_mistake_entry", {
    p_entry_id: value.id,
    p_operation_key: value.operationKey,
    p_subject_id: value.subjectId,
    p_topic_id: value.topicId,
    p_question_batch_id: value.questionBatchId,
    p_reason: value.reason,
    p_thought: value.thought,
    p_correct_rule: value.correctRule,
    p_next_step: value.nextStep,
    p_external_reference: value.externalReference,
    p_status: value.status,
  });
  if (error) {
    if (error.code === "23503" || error.code === "23514") return { ok: false, message: "A matéria, tópico ou lote não corresponde mais às suas opções. Atualize a tela e tente novamente." };
    if (error.code === "23505") return { ok: false, message: "Esta ficha já foi salva. Atualize o caderno antes de editar novamente." };
    if (error.code === "22023") return { ok: false, message: "Confira os campos e a referência externa." };
    return { ok: false, message: "Não foi possível salvar a ficha. Tente novamente." };
  }
  const response = readRpcResponse(data);
  if (!response) return { ok: false, message: "O banco não confirmou a ficha salva." };
  revalidatePath("/caderno-de-erros");
  return { ok: true, id: response.id, status: response.status };
}

export async function deleteMistakeEntryAction(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = deleteMistakeEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ficha inválida." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("delete_mistake_entry", { p_entry_id: parsed.data.id });
  if (error || data !== "deleted") {
    return { ok: false, message: data === "not_found" ? "Esta ficha não foi encontrada ou já foi excluída." : "Não foi possível excluir a ficha." };
  }
  revalidatePath("/caderno-de-erros");
  return { ok: true };
}

function readRpcResponse(value: unknown): { id: string; status: "created" | "updated" | "exists" } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (typeof response.entry_id !== "string") return null;
  if (response.status !== "created" && response.status !== "updated" && response.status !== "exists") return null;
  return { id: response.entry_id, status: response.status };
}
