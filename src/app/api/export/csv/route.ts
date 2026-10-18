import { NextResponse } from "next/server";
import { getQuestionBatchExport } from "@/features/settings/data/export-data";
import { encodeCsv } from "@/features/settings/domain/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const HEADERS = [
  "ID do lote", "Data do estudo", "ID da matéria", "Matéria", "ID do tópico", "Tópico", "Tipo de origem", "Origem",
  "ID do concurso", "ID da sessão", "Questões", "Acertos", "Erros calculados", "Duração em minutos", "Observações",
  "Substitui totais da sessão", "Excluído em", "Criado em (UTC)",
];

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Entre na sua conta para exportar os dados." }, { status: 401, headers: { "cache-control": "no-store" } });
    const batches = await getQuestionBatchExport(supabase, user.id);
    const rows = batches.map((batch) => [
      batch.id, batch.studiedOn, batch.subjectId, batch.subject, batch.topicId, batch.topic, batch.sourceType, batch.sourceLabel,
      batch.examTargetId, batch.studySessionId, batch.questionCount, batch.correctCount, batch.mistakeCount, batch.durationMinutes,
      batch.notes, batch.replacesSessionTotals, batch.deletedAt, batch.createdAt,
    ]);
    const content = encodeCsv([HEADERS, ...rows]);
    return new Response(content, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=operacao-aprovacao-questoes.csv",
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível gerar a exportação CSV. Tente novamente." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
