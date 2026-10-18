"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const previewSchema = z.object({
  revisionId: z.string().uuid(),
  expected: z.array(z.object({
    id: z.string().uuid(), topic_id: z.string().uuid(), planned_date: dateSchema,
    planned_minutes: z.number().int().positive(), planned_start_time: z.string().nullable(),
    status: z.literal("planejado"), pinned: z.boolean(), updated_at: z.string(),
  })).min(1).max(500),
  changes: z.array(z.object({
    id: z.string().uuid(), before_topic_id: z.string().uuid(), before_date: dateSchema,
    after_topic_id: z.string().uuid(), after_date: dateSchema,
  })).min(1).max(100),
});

export type ReinforcementActionResult = { ok: true } | { ok: false; message: string };

export async function applyReinforcementPlanAction(input: unknown): Promise<ReinforcementActionResult> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "A prévia está inválida." };
  if (new Set(parsed.data.expected.map(({ id }) => id)).size !== parsed.data.expected.length
      || new Set(parsed.data.changes.map(({ id }) => id)).size !== parsed.data.changes.length) {
    return { ok: false, message: "A prévia contém blocos repetidos. Atualize o planejamento." };
  }
  const expectedIds = new Set(parsed.data.expected.map(({ id }) => id));
  if (parsed.data.changes.some(({ id }) => !expectedIds.has(id))) {
    return { ok: false, message: "Um dos blocos mudou desde a prévia. Atualize o planejamento." };
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("apply_reinforcement_plan", {
    p_revision_id: parsed.data.revisionId,
    p_expected: parsed.data.expected,
    p_changes: parsed.data.changes,
  });
  if (error || data !== "applied") {
    return { ok: false, message: data === "stale"
      ? "O planejamento mudou desde a prévia. Atualize a tela e gere outra sugestão."
      : data === "over_capacity"
        ? "A mudança ultrapassaria sua meta diária. Nenhuma alteração foi aplicada."
        : data === "protected_exam"
          ? "Um bloco vinculado a um concurso próximo está protegido. Atualize o planejamento e gere outra prévia."
          : data === "time_conflict"
            ? "O novo horário entraria em conflito com outro bloco. Atualize o planejamento e gere outra prévia."
            : "Não foi possível aplicar o reforço. Nenhuma alteração foi confirmada." };
  }
  revalidatePath("/planejamento");
  revalidatePath("/planejamento/reforco");
  revalidatePath("/");
  return { ok: true };
}
