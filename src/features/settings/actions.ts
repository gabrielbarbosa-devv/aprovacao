"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { isValidTimezone, serializeWeekdays, settingsSchema } from "@/features/settings/domain/settings";

export type SettingsActionResult = { ok: true } | { ok: false; message: string };

export async function saveStudyPreferencesAction(input: unknown): Promise<SettingsActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira as preferências informadas." };
  if (!isValidTimezone(parsed.data.timezone)) return { ok: false, message: "Informe um fuso horário IANA válido, por exemplo America/Sao_Paulo." };

  const { user, supabase } = await requireUser();
  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    daily_goal_minutes: parsed.data.dailyGoalMinutes,
    timezone: parsed.data.timezone,
    weekly_availability: serializeWeekdays(parsed.data.weekdays),
  }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "Não foi possível salvar. Confira sua conexão e tente novamente." };

  revalidatePath("/configuracoes");
  revalidatePath("/planejamento");
  revalidatePath("/planejamento/reforco");
  revalidatePath("/revisoes");
  revalidatePath("/");
  return { ok: true };
}
