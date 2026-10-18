"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { archiveSubjectSchema, createSubjectSchema, reorderSubjectsSchema, subjectIdSchema, updateSubjectSchema } from "@/features/subjects/domain/schemas";
import type { SubjectActionResult } from "@/features/subjects/domain/types";

export async function createSubjectAction(input: unknown): Promise<SubjectActionResult> {
  const parsed = createSubjectSchema.safeParse(input);
  if (!parsed.success) return invalidResult(parsed.error.issues[0]?.message);
  const { user, supabase } = await requireUser();

  const { data: lastSubject, error: orderError } = await supabase.from("subjects")
    .select("sort_order").eq("user_id", user.id)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (orderError) return { ok: false, message: "Não foi possível preparar a nova matéria. Tente novamente." };

  const { error } = await supabase.from("subjects").insert({
    user_id: user.id,
    name: parsed.data.name,
    color_token: parsed.data.colorToken,
    sort_order: (lastSubject?.sort_order ?? 0) + 1,
  });
  if (error) return mapWriteError(error.code);
  revalidateSubjects();
  return { ok: true };
}

export async function updateSubjectAction(input: unknown): Promise<SubjectActionResult> {
  const parsed = updateSubjectSchema.safeParse(input);
  if (!parsed.success) return invalidResult(parsed.error.issues[0]?.message);
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase.from("subjects").update({
    name: parsed.data.name,
    color_token: parsed.data.colorToken,
  }).eq("id", parsed.data.id).eq("user_id", user.id).is("archived_at", null).select("id").maybeSingle();
  if (error) return mapWriteError(error.code);
  if (!data) return { ok: false, message: "Matéria não encontrada ou já arquivada. Atualize a página." };
  revalidateSubjects();
  revalidatePath("/planejamento");
  revalidatePath("/");
  return { ok: true };
}

export async function archiveSubjectAction(input: unknown): Promise<SubjectActionResult> {
  const parsed = archiveSubjectSchema.safeParse(input);
  if (!parsed.success) return invalidResult(parsed.error.issues[0]?.message);
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("archive_subject", {
    p_subject_id: parsed.data.id,
    p_expected_future_blocks: parsed.data.expectedFutureBlocks,
  });
  if (error || data !== "archived") {
    const message = data === "future_blocks_changed"
      ? "O número de blocos futuros mudou. Atualize a página e confirme novamente."
      : data === "already_archived"
        ? "Esta matéria já está arquivada. Atualize a página."
        : "Não foi possível arquivar a matéria. Atualize a página e tente novamente.";
    return { ok: false, message };
  }
  revalidateSubjects();
  revalidatePath("/planejamento");
  revalidatePath("/");
  return { ok: true };
}

export async function restoreSubjectAction(input: unknown): Promise<SubjectActionResult> {
  const parsed = subjectIdSchema.safeParse(input);
  if (!parsed.success) return invalidResult(parsed.error.issues[0]?.message);
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase.from("subjects").update({ archived_at: null })
    .eq("id", parsed.data).eq("user_id", user.id).not("archived_at", "is", null).select("id").maybeSingle();
  if (error) return mapWriteError(error.code);
  if (!data) return { ok: false, message: "Matéria não encontrada ou já ativa. Atualize a página." };
  revalidateSubjects();
  revalidatePath("/planejamento");
  revalidatePath("/");
  return { ok: true };
}

export async function reorderSubjectsAction(input: unknown): Promise<SubjectActionResult> {
  const parsed = reorderSubjectsSchema.safeParse(input);
  if (!parsed.success) return invalidResult(parsed.error.issues[0]?.message);
  if (new Set(parsed.data).size !== parsed.data.length) return { ok: false, message: "A lista de matérias contém itens repetidos. Atualize a página e tente novamente." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("reorder_subjects", { p_subject_ids: parsed.data });
  if (error || data !== "reordered") return { ok: false, message: "A lista de matérias mudou. Atualize a página e tente novamente." };
  revalidateSubjects();
  return { ok: true };
}

export async function deleteEmptySubjectAction(input: unknown): Promise<SubjectActionResult> {
  const parsed = subjectIdSchema.safeParse(input);
  if (!parsed.success) return invalidResult(parsed.error.issues[0]?.message);
  const { user, supabase } = await requireUser();
  const { count, error: countError } = await supabase.from("topics")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("subject_id", parsed.data);
  if (countError) return { ok: false, message: "Não foi possível conferir os tópicos desta matéria." };
  if ((count ?? 0) > 0) return { ok: false, message: "Esta matéria possui tópicos e não pode ser excluída sem apagar conteúdo. Arquive-a para preservar seus registros." };

  const { data, error } = await supabase.from("subjects").delete()
    .eq("id", parsed.data).eq("user_id", user.id).is("archived_at", null).select("id").maybeSingle();
  if (error) return { ok: false, message: "Não foi possível excluir a matéria. Ela pode ter recebido conteúdo; arquive-a para preservar o histórico." };
  if (!data) return { ok: false, message: "Matéria não encontrada ou já arquivada. Atualize a página." };
  revalidateSubjects();
  return { ok: true };
}

function invalidResult(message: string | undefined): SubjectActionResult {
  return { ok: false, message: message ?? "Confira os dados informados." };
}

function mapWriteError(code: string): SubjectActionResult {
  if (code === "23505") return { ok: false, message: "Já existe uma matéria com esse nome na sua conta." };
  if (code === "23514") return { ok: false, message: "Informe um nome válido para a matéria." };
  return { ok: false, message: "Não foi possível salvar a matéria. Tente novamente." };
}

function revalidateSubjects() {
  revalidatePath("/materias");
}
