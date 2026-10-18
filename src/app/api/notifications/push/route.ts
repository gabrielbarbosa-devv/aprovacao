import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine((value) => value.startsWith("https://"), "Endpoint inválido."),
  keys: z.object({
    p256dh: z.string().min(32).max(256),
    auth: z.string().min(16).max(128),
  }).strict(),
}).strict();

const removeSubscriptionSchema = z.object({ endpoint: z.string().url().max(2048) }).strict();

export async function POST(request: Request) {
  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  try {
    const { user, supabase } = await requireUser();
    const { error } = await supabase.from("notification_push_subscriptions").insert({
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth_secret: parsed.data.keys.auth,
    });
    if (error?.code === "23505") {
      const { data: current } = await supabase.from("notification_push_subscriptions").select("id").eq("user_id", user.id).eq("endpoint", parsed.data.endpoint).maybeSingle();
      if (current) return NextResponse.json({ ok: true });
    }
    if (error) return NextResponse.json({ error: "Não foi possível guardar a inscrição." }, { status: 503 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  const parsed = removeSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  try {
    const { user, supabase } = await requireUser();
    const { error } = await supabase.from("notification_push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", parsed.data.endpoint);
    if (error) return NextResponse.json({ error: "Não foi possível remover a inscrição." }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }
}
