"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { completeReviewSchema, snoozeReviewSchema } from "@/features/reviews/domain/schemas";

type ActionResult = { ok: true; status: string; reinforcementCreated?: boolean } | { ok: false; message: string };

function readStatus(value: unknown): string | null {
  if (value && typeof value === "object" && "status" in value && typeof value.status === "string") return value.status;
  return null;
}

export async function completeReviewAction(input: unknown): Promise<ActionResult> {
  const parsed = completeReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados da revisão." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("complete_review_task", {
    p_review_id: parsed.data.reviewId,
    p_reviewed_on: parsed.data.reviewedOn,
    p_difficulty: parsed.data.difficulty,
    p_schedule_reinforcement: parsed.data.scheduleReinforcement,
    p_question_count: parsed.data.questionCount,
    p_correct_count: parsed.data.correctCount,
    p_notes: parsed.data.notes,
  });
  if (error) return { ok: false, message: "Não foi possível concluir esta revisão. Atualize a página e tente novamente." };
  const status = readStatus(data);
  if (status !== "completed" && status !== "already_completed") return { ok: false, message: "A revisão não pôde ser concluída." };
  const reinforcementCreated = Boolean(data && typeof data === "object" && "reinforcement_created" in data && data.reinforcement_created === true);
  revalidatePath("/revisoes");
  revalidatePath("/");
  return { ok: true, status, reinforcementCreated };
}

export async function snoozeReviewAction(input: unknown): Promise<ActionResult> {
  const parsed = snoozeReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira a nova data." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("snooze_review_task", {
    p_review_id: parsed.data.reviewId,
    p_new_due_on: parsed.data.newDueOn,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: "Não foi possível adiar esta revisão. Confira se a nova data é futura." };
  const status = readStatus(data);
  if (status !== "rescheduled" && status !== "already_scheduled") return { ok: false, message: "A revisão não pôde ser reagendada." };
  revalidatePath("/revisoes");
  revalidatePath("/");
  return { ok: true, status };
}
