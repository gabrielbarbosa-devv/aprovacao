"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { topicsRepository } from "@/features/topics/data/topics-repository";
import {
  archiveTopicSchema,
  changeTopicPrioritySchema,
  changeTopicStatusSchema,
  createTopicSchema,
  reorderTopicsSchema,
  restoreTopicSchema,
  updateTopicSchema,
} from "@/features/topics/domain/schemas";
import type { TopicActionResult } from "@/features/topics/domain/types";

export async function createTopicAction(input: unknown): Promise<TopicActionResult> {
  const parsed = createTopicSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const { user, supabase } = await requireUser();
  const subject = await topicsRepository.getActiveSubject(supabase, user.id, parsed.data.subjectId);
  if (!subject.data || subject.error) return { ok: false, message: "Matéria não encontrada ou arquivada. Atualize a página." };
  const { error } = await topicsRepository.create(supabase, {
    user_id: user.id,
    subject_id: parsed.data.subjectId,
    title: parsed.data.title,
    status: parsed.data.status,
    priority: parsed.data.priority,
    estimated_minutes: parsed.data.estimatedMinutes,
    source_url: parsed.data.sourceUrl,
    notes: parsed.data.notes,
  });
  if (error) return mapWriteError(error.code);
  revalidateTopicRoutes(parsed.data.subjectId);
  return { ok: true };
}

export async function updateTopicAction(input: unknown): Promise<TopicActionResult> {
  const parsed = updateTopicSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const { user, supabase } = await requireUser();
  if (!(await topicsRepository.getActiveSubject(supabase, user.id, parsed.data.subjectId)).data) {
    return { ok: false, message: "Matéria não encontrada ou arquivada. Atualize a página." };
  }
  const { data, error } = await topicsRepository.update(supabase, user.id, parsed.data.subjectId, parsed.data.id, parsed.data);
  if (error) return mapWriteError(error.code);
  if (!data) return { ok: false, message: "Tópico não encontrado ou arquivado. Atualize a página." };
  revalidateTopicRoutes(parsed.data.subjectId);
  return { ok: true };
}

export async function changeTopicStatusAction(input: unknown): Promise<TopicActionResult> {
  const parsed = changeTopicStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const { user, supabase } = await requireUser();
  if (!(await topicsRepository.getActiveSubject(supabase, user.id, parsed.data.subjectId)).data) return notFound();
  const { data, error } = await topicsRepository.changeStatus(supabase, user.id, parsed.data.subjectId, parsed.data.id, parsed.data.status);
  if (error) return mapWriteError(error.code);
  if (!data) return { ok: false, message: "Tópico não encontrado. Atualize a página." };
  revalidateTopicRoutes(parsed.data.subjectId);
  return { ok: true };
}

export async function changeTopicPriorityAction(input: unknown): Promise<TopicActionResult> {
  const parsed = changeTopicPrioritySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const { user, supabase } = await requireUser();
  if (!(await topicsRepository.getActiveSubject(supabase, user.id, parsed.data.subjectId)).data) return notFound();
  const { data, error } = await topicsRepository.changePriority(supabase, user.id, parsed.data.subjectId, parsed.data.id, parsed.data.priority);
  if (error) return mapWriteError(error.code);
  if (!data) return { ok: false, message: "Tópico não encontrado. Atualize a página." };
  revalidateTopicRoutes(parsed.data.subjectId);
  return { ok: true };
}

export async function archiveTopicAction(input: unknown): Promise<TopicActionResult> {
  const parsed = archiveTopicSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const { user, supabase } = await requireUser();
  const result = await topicsRepository.archive(supabase, user.id, parsed.data.subjectId, parsed.data.id);
  if (result !== "archived") {
    const message = result === "has_open_blocks"
      ? "Este tópico ainda tem blocos planejados ou em andamento. Reorganize esses blocos antes de arquivá-lo."
      : result === "blocks_changed"
        ? "O planejamento mudou enquanto você arquivava. Atualize a página e tente novamente."
        : result === "already_archived"
          ? "Este tópico já está arquivado. Atualize a página."
          : "Não foi possível arquivar o tópico. Atualize a página e tente novamente.";
    return { ok: false, message };
  }
  revalidateTopicRoutes(parsed.data.subjectId);
  return { ok: true };
}

export async function restoreTopicAction(input: unknown): Promise<TopicActionResult> {
  const parsed = restoreTopicSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const { user, supabase } = await requireUser();
  if (!(await topicsRepository.getActiveSubject(supabase, user.id, parsed.data.subjectId)).data) return notFound();
  const { data, error } = await topicsRepository.restore(supabase, user.id, parsed.data.subjectId, parsed.data.id);
  if (error) return mapWriteError(error.code);
  if (!data) return { ok: false, message: "Tópico não encontrado ou já ativo. Atualize a página." };
  revalidateTopicRoutes(parsed.data.subjectId);
  return { ok: true };
}

export async function reorderTopicsAction(input: unknown): Promise<TopicActionResult> {
  const parsed = reorderTopicsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const { supabase } = await requireUser();
  const { data, error } = await topicsRepository.reorder(supabase, parsed.data.subjectId, parsed.data.topicIds);
  if (error || data !== "reordered") return { ok: false, message: "A lista de tópicos mudou. Atualize a página e tente novamente." };
  revalidateTopicRoutes(parsed.data.subjectId);
  return { ok: true };
}

function notFound(): TopicActionResult {
  return { ok: false, message: "Matéria não encontrada ou arquivada. Atualize a página." };
}

function invalid(message: string | undefined): TopicActionResult {
  return { ok: false, message: message ?? "Confira os dados informados." };
}

function mapWriteError(code: string): TopicActionResult {
  if (code === "23505") return { ok: false, message: "Já existe um tópico ativo com esse nome nesta matéria." };
  if (code === "23503") return { ok: false, message: "A matéria está arquivada ou não pertence a esta conta." };
  if (code === "23514") return { ok: false, message: "Confira o link, o tempo estimado e os demais campos." };
  return { ok: false, message: "Não foi possível salvar o tópico. Tente novamente." };
}

function revalidateTopicRoutes(subjectId: string) {
  revalidatePath(`/materias/${subjectId}`);
  revalidatePath("/materias");
  revalidatePath("/planejamento");
  revalidatePath("/");
}
