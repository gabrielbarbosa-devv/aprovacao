"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { sortSubjectPerformance } from "@/features/analytics/domain/calculate-aggregates";
import type { AnalyticsFilters, SubjectPerformance } from "@/features/analytics/domain/types";

const chartConfig = {
  accuracy: { label: "Aproveitamento", color: "var(--primary)" },
} satisfies ChartConfig;

type SubjectBreakdownProps = { data: SubjectPerformance[]; filters: AnalyticsFilters; hasQuestionHistory: boolean };

export function SubjectBreakdown({ data, filters, hasQuestionHistory }: SubjectBreakdownProps) {
  const router = useRouter();
  const ordered = sortSubjectPerformance(data, filters.sortBy);
  const chartHeight = Math.max(176, Math.min(420, ordered.length * 36 + 32));

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Por matéria</CardTitle>
        <CardDescription>Aproveitamento calculado sobre questões registradas; clique em uma barra para filtrar.</CardDescription>
      </CardHeader>
      <CardContent>
        {ordered.length > 0 ? (
          <>
            <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight, aspectRatio: "auto" }} role="group" aria-label="Gráfico de aproveitamento por matéria">
              <BarChart
                accessibilityLayer
                data={ordered}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
                barCategoryGap="28%"
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.45 }}
                  content={<ChartTooltipContent
                    labelFormatter={(label) => String(label)}
                    formatter={(value, name, item) => {
                      if (name !== "accuracy" || typeof value !== "number") return null;
                      const subject = item.payload as SubjectPerformance;
                      return <div className="grid gap-1">
                        <span className="font-semibold text-foreground">{formatPercent(subject.accuracy)}</span>
                        <span className="text-muted-foreground">{subject.correctCount} acertos de {subject.questionCount} questões</span>
                      </div>;
                    }}
                  />}
                />
                <Bar
                  dataKey="accuracy"
                  fill="var(--color-accuracy)"
                  radius={4}
                  maxBarSize={18}
                  cursor="pointer"
                  onClick={(_bar, index) => {
                    const subject = ordered[index];
                    if (subject) router.push(getSubjectHref(filters, filters.subjectId === subject.id ? null : subject.id));
                  }}
                />
              </BarChart>
            </ChartContainer>
            <ul className="sr-only" aria-label="Desempenho registrado por matéria">
              {ordered.map((subject) => <li key={subject.id}>{`${subject.name}: ${formatPercent(subject.accuracy)}, ${subject.correctCount} acertos de ${subject.questionCount} questões.`}</li>)}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">A amostra de cada matéria aparece ao passar ou focar uma barra. Use também o filtro de matéria acima.</p>
          </>
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
