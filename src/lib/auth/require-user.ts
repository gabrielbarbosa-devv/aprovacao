import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser(expectedUserId?: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user || (expectedUserId && data.user.id !== expectedUserId)) {
    redirect("/login");
  }

  return { user: data.user, supabase };
}
