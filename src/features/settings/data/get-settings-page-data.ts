import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import { parseWeekdays } from "@/features/settings/domain/settings";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_DAILY_GOAL_MINUTES = 240;

export async function getSettingsPageData() {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase.from("user_settings").select("timezone, daily_goal_minutes, weekly_availability, notifications_study_enabled, notifications_reviews_enabled, notifications_pending_enabled, daily_reminder_time, reminder_lead_minutes, quiet_hours_start, quiet_hours_end, browser_push_enabled")
    .eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar suas preferências de estudo.");
  return {
    email: user.email ?? "",
    preferences: {
      timezone: data?.timezone ?? DEFAULT_TIMEZONE,
      dailyGoalMinutes: data?.daily_goal_minutes ?? DEFAULT_DAILY_GOAL_MINUTES,
      weekdays: parseWeekdays(data?.weekly_availability ?? {}),
    },
    notificationPreferences: {
      studyEnabled: data?.notifications_study_enabled ?? false,
      reviewsEnabled: data?.notifications_reviews_enabled ?? false,
      pendingEnabled: data?.notifications_pending_enabled ?? false,
      dailyReminderTime: data?.daily_reminder_time?.slice(0, 5) ?? "06:00",
      reminderLeadMinutes: data?.reminder_lead_minutes ?? 30,
      quietHoursStart: data?.quiet_hours_start?.slice(0, 5) ?? null,
      quietHoursEnd: data?.quiet_hours_end?.slice(0, 5) ?? null,
      browserPushEnabled: data?.browser_push_enabled ?? false,
      reminderTimeSaved: data?.daily_reminder_time !== null && data?.daily_reminder_time !== undefined,
    },
  };
}
