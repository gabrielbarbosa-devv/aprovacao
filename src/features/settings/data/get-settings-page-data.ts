import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import { parseWeekdays } from "@/features/settings/domain/settings";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_DAILY_GOAL_MINUTES = 240;

export async function getSettingsPageData() {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase.from("user_settings").select("timezone, daily_goal_minutes, weekly_availability")
    .eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar suas preferências de estudo.");
  return {
    email: user.email ?? "",
    preferences: {
      timezone: data?.timezone ?? DEFAULT_TIMEZONE,
      dailyGoalMinutes: data?.daily_goal_minutes ?? DEFAULT_DAILY_GOAL_MINUTES,
      weekdays: parseWeekdays(data?.weekly_availability ?? {}),
    },
  };
}
