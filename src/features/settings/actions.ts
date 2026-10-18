"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { isValidTimezone, serializeWeekdays, settingsSchema } from "@/features/settings/domain/settings";
import { notificationPreferencesSchema } from "@/features/notifications/domain/schemas";

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
  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function saveNotificationPreferencesAction(input: unknown): Promise<SettingsActionResult> {
  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os avisos informados." };
  const { supabase } = await requireUser();
  const prefs = parsed.data;
  const { error } = await supabase.rpc("save_notification_preferences", {
    p_study_enabled: prefs.studyEnabled,
    p_reviews_enabled: prefs.reviewsEnabled,
    p_pending_enabled: prefs.pendingEnabled,
    p_daily_reminder_time: `${prefs.dailyReminderTime}:00`,
    p_reminder_lead_minutes: prefs.reminderLeadMinutes,
    p_quiet_hours_start: prefs.quietHoursStart ? `${prefs.quietHoursStart}:00` : null,
    p_quiet_hours_end: prefs.quietHoursEnd ? `${prefs.quietHoursEnd}:00` : null,
    p_browser_push_enabled: prefs.browserPushEnabled,
  });
  if (error) return { ok: false, message: "Não foi possível salvar os avisos. Confira sua conexão e tente novamente." };
  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { ok: true };
}
