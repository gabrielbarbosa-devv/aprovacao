"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function revokeOAuthGrant(formData: FormData): Promise<void> {
  const clientId = formData.get("client_id");
  if (typeof clientId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(clientId)) redirect("/configuracoes/conexoes?status=invalid");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  redirect(error ? "/configuracoes/conexoes?status=error" : "/configuracoes/conexoes?status=revoked");
}
