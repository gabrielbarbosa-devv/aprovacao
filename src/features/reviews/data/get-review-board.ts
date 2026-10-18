import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import { getStudyDay } from "@/lib/date/study-day";
import { getReviewTasksForBoard } from "@/features/reviews/data/reviews-repository";

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export async function getReviewBoard() {
  const { user, supabase } = await requireUser();
  const { data: settings, error: settingsError } = await supabase.from("user_settings")
    .select("timezone").eq("user_id", user.id).maybeSingle();
  if (settingsError) throw new Error("Não foi possível carregar suas preferências de estudo.");
  const timeZone = settings?.timezone ?? DEFAULT_TIME_ZONE;
  const studyDay = getStudyDay(timeZone);
  const tasks = await getReviewTasksForBoard(supabase, user.id, studyDay);
  return { email: user.email ?? "", timeZone, studyDay, ...tasks };
}
