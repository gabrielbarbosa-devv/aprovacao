"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { getStudyDay } from "@/lib/date/study-day";
import { startBlockSchema, starterPlanSchema } from "@/features/today/domain/schemas";

export type ActionResult = {
  status: "idle" | "success" | "error";
  message: string;
};

const idleResult: ActionResult = { status: "idle", message: "" };

export async function createStarterPlanAction(
  _previous: ActionResult = idleResult,
  formData: FormData,
): Promise<ActionResult> {
  void _previous;
  const parsed = starterPlanSchema.safeParse({ startDate: formData.get("startDate") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data inválida." };

  const { user, supabase } = await requireUser();
  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (settingsError) return { status: "error", message: "Não foi possível validar a data do plano." };
  const today = getStudyDay(settings?.timezone ?? "America/Sao_Paulo");
  if (parsed.data.startDate < today) {
    return { status: "error", message: "A data do plano não pode estar no passado." };
  }

  const { data, error } = await supabase.rpc("create_starter_plan", {
    p_start_date: parsed.data.startDate,
  });

  if (error) return { status: "error", message: "Não foi possível criar o plano. Tente novamente." };
  if (data === "invalid_date") return { status: "error", message: "A data escolhida já passou." };
  if (data === "already_exists") {
    revalidatePath("/");
    return { status: "success", message: "Sua matéria ou planejamento já existe; nenhum dado foi alterado." };
  }
  if (data !== "created") return { status: "error", message: "O plano não foi criado. Atualize a página e tente novamente." };

  revalidatePath("/");
  return { status: "success", message: "Plano inicial criado com sucesso." };
}

export async function startStudyBlockAction(
  _previous: ActionResult = idleResult,
  formData: FormData,
): Promise<ActionResult> {
  void _previous;
  const parsed = startBlockSchema.safeParse({ blockId: formData.get("blockId") });
  if (!parsed.success) return { status: "error", message: "Bloco inválido." };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("start_study_block", {
    p_block_id: parsed.data.blockId,
  });

  if (error) return { status: "error", message: "Não foi possível atualizar o bloco." };
  if (data === "not_found") return { status: "error", message: "Este bloco não foi encontrado." };
  if (data === "invalid_state") return { status: "error", message: "Este bloco não pode mais ser iniciado." };

  revalidatePath("/");
  return {
    status: "success",
    message: data === "started" ? "Estudo iniciado." : "Este bloco já está em andamento.",
  };
}
