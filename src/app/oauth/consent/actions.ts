"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function decideOAuthConsent(formData: FormData): Promise<void> {
  const authorizationId = formData.get("authorization_id");
  const decision = formData.get("decision");
  if (typeof authorizationId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(authorizationId)) {
    redirect("/oauth/consent?error=invalid_request");
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    const returnTo = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const result = decision === "approve"
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : decision === "deny"
      ? await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
      : null;

  if (!result || result.error || !result.data.redirect_url) {
    redirect(`/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}&error=decision_failed`);
  }

  redirect(result.data.redirect_url);
}
