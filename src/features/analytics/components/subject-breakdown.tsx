import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sortSubjectPerformance } from "@/features/analytics/domain/calculate-aggregates";
import type { AnalyticsFilters, SubjectPerformance } from "@/features/analytics/domain/types";

type SubjectBreakdownProps = { data: SubjectPerformance[]; filters: AnalyticsFilters; hasQuestionHistory: boolean };

export function SubjectBreakdown({ data, filters, hasQuestionHistory }: SubjectBreakdownProps) {
  const ordered = sortSubjectPerformance(data, filters.sortBy);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Por matéria</CardTitle>
        <CardDescription>Acertos e aproveitamento sobre as questões registradas.</CardDescription>
      </CardHeader>
      <CardContent>
        {ordered.length > 0 ? (
          <div className="grid gap-5">
            {ordered.map((subject) => {
              const isSelected = filters.subjectId === subject.id;
              const href = getSubjectHref(filters, isSelected ? null : subject.id);
              return (
                <div key={subject.id} className="grid gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <Link href={href} aria-current={isSelected ? "page" : undefined} className="text-sm font-medium underline-offset-4 hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {subject.name}{isSelected ? " · filtrada" : ""}
                    </Link>
                    <span className="text-sm font-semibold tabular-nums text-muted-foreground">{formatPercent(subject.accuracy)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div role="progressbar" aria-label={`Aproveitamento em ${subject.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={subject.accuracy ?? 0} className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${subject.accuracy ?? 0}%` }} />
                    </div>
                    <span className="min-w-28 text-right text-xs text-muted-foreground tabular-nums">{subject.correctCount}/{subject.questionCount} acertos</span>
                  </div>
                  {subject.questionCount < 10 ? <p className="text-xs text-muted-foreground">Amostra limitada: menos de 10 questões.</p> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-36 place-items-center rounded-lg border border-dashed px-5 py-5 text-center">
            <div className="grid max-w-sm gap-2">
              <p className="font-medium">{hasQuestionHistory ? "Nenhuma matéria neste filtro" : "Sem desempenho por matéria"}</p>
              <p className="text-sm text-muted-foreground">{hasQuestionHistory ? "Experimente outro período ou remova o filtro de matéria." : "Os resultados aparecem depois dos primeiros registros de questões."}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getSubjectHref(filters: AnalyticsFilters, subjectId: string | null): string {
  const query = new URLSearchParams({ period: filters.period });
  if (subjectId) query.set("subject", subjectId);
  if (filters.sortBy !== "questions") query.set("sort", filters.sortBy);
  if (filters.period === "custom") {
    query.set("from", filters.from);
    query.set("to", filters.to);
  }
  return `/meu-progresso?${query.toString()}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "Sem dados";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)}%`;
}
