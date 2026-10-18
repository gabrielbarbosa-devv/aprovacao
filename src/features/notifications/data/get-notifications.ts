import "server-only";
import { requireUser } from "@/lib/auth/require-user";
import type { NotificationItem } from "@/features/notifications/domain/types";

export async function getNotifications(): Promise<{ items: NotificationItem[]; timezone: string }> {
  const { user, supabase } = await requireUser();
  const { error: syncError } = await supabase.rpc("sync_my_notifications");
  if (syncError) throw new Error("Não foi possível atualizar os avisos agora.");

  const [{ data, error }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("notifications").select("id, category, title, body, target_url, scheduled_for, created_at, read_at")
      .eq("user_id", user.id).is("dismissed_at", null).is("resolved_at", null)
      .order("created_at", { ascending: false }).limit(50),
    supabase.from("user_settings").select("timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  if (error || settingsError) throw new Error("Não foi possível carregar as notificações.");
  return { items: (data ?? []) as NotificationItem[], timezone: settings?.timezone ?? "America/Sao_Paulo" };
}
