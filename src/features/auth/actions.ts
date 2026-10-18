"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginCredentialsSchema, signupCredentialsSchema } from "@/features/auth/schemas";
import { getSafeAuthReturnTo } from "@/features/auth/return-to";

export type AuthActionResult = {
  status: "idle" | "error" | "success";
  message: string;
};

export async function loginAction(
  _previous: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = loginCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const returnToValue = formData.get("returnTo");
  const returnTo = getSafeAuthReturnTo(typeof returnToValue === "string" ? returnToValue : null);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Confira seus dados." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: "Não foi possível entrar. Confira o e-mail e a senha." };
  redirect(returnTo);
}

export async function signupAction(
  _previous: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = signupCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const returnToValue = formData.get("returnTo");
  const returnTo = getSafeAuthReturnTo(typeof returnToValue === "string" ? returnToValue : null);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Confira seus dados." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { status: "error", message: "Não foi possível criar a conta. Confira os dados e tente novamente." };
  if (data.user?.identities?.length === 0) {
    return { status: "error", message: "Não foi possível criar a conta com esses dados. Tente entrar ou use outro e-mail." };
  }
  if (data.session) redirect(returnTo);
  return { status: "success", message: "Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre." };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
