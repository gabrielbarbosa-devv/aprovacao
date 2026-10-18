import { NextResponse } from "next/server";
import { notificationMutationSchema } from "@/features/notifications/domain/schemas";
import { getNotifications } from "@/features/notifications/data/get-notifications";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  try {
    const notifications = await getNotifications();
    return NextResponse.json(notifications, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar as notificações." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const parsed = notificationMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });

  try {
    const { user, supabase } = await requireUser();
    const now = new Date().toISOString();
    let query = supabase.from("notifications").update(parsed.data.action === "dismiss" ? { dismissed_at: now } : { read_at: now }).eq("user_id", user.id);
    if (parsed.data.action !== "read-all") query = query.eq("id", parsed.data.id);
    else query = query.is("read_at", null).is("dismissed_at", null).is("resolved_at", null);
    const { error } = await query;
    if (error) return NextResponse.json({ error: "Não foi possível atualizar este aviso." }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }
}
