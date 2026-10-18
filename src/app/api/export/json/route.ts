import { NextResponse } from "next/server";
import { getPersonalDataExport } from "@/features/settings/data/export-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Entre na sua conta para exportar os dados." }, { status: 401, headers: { "cache-control": "no-store" } });
    const backup = await getPersonalDataExport(supabase, user.id);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": "attachment; filename=operacao-aprovacao-dados-v1.json",
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível gerar a exportação JSON. Tente novamente." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
