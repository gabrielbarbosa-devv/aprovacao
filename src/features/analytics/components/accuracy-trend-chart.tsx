"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { WeeklyAccuracy } from "@/features/analytics/domain/types";

const chartConfig = {
  accuracy: { label: "Aproveitamento", color: "var(--primary)" },
} satisfies ChartConfig;

type AccuracyTrendChartProps = { data: WeeklyAccuracy[]; hasQuestionHistory: boolean };

export function AccuracyTrendChart({ data, hasQuestionHistory }: AccuracyTrendChartProps) {
  const hasTrendData = data.some((week) => week.accuracy !== null);
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <CardTitle id="accuracy-trend-title">Evolução dos acertos</CardTitle>
          <CardDescription>Percentual semanal calculado pelo total de questões.</CardDescription>
        </div>
        <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Por semana</span>
      </CardHeader>
      <CardContent role="region" aria-labelledby="accuracy-trend-title" className="min-w-0">
        {hasTrendData ? (
          <>
            <ChartContainer config={chartConfig} className="h-[230px] min-h-[230px] w-full" role="group" aria-label="Gráfico de aproveitamento semanal">
              <LineChart accessibilityLayer data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(value: number) => `${value}%`} width={42} tickLine={false} axisLine={false} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent
                    labelFormatter={(label) => `Semana de ${String(label)}`}
                    formatter={(value, name, item) => {
                      if (name !== "accuracy" || typeof value !== "number") return null;
                      const point = item.payload as WeeklyAccuracy;
                      return (
                        <div className="grid gap-1">
                          <span className="text-muted-foreground">Aproveitamento</span>
                          <span className="font-mono font-semibold text-foreground">{formatPercent(point.accuracy)}</span>
                          <span className="text-muted-foreground">{point.correctCount} acertos de {point.questionCount} questões</span>
                        </div>
                      );
                    }}
                  />}
                />
                <Line dataKey="accuracy" type="monotone" stroke="var(--color-accuracy)" strokeWidth={2.5} dot={{ r: 3.5, fill: "var(--background)", strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} />
              </LineChart>
            </ChartContainer>
            <ul className="sr-only" aria-label="Dados semanais de desempenho">
              {data.filter((week) => week.accuracy !== null).map((week) => (
                <li key={week.weekStart}>{`Semana de ${week.label}: ${week.correctCount} acertos de ${week.questionCount} questões, ${formatPercent(week.accuracy)}.`}</li>
              ))}
            </ul>
          </>
        ) : (
          <div className="grid min-h-[230px] place-items-center rounded-lg border border-dashed px-5 text-center">
            <div className="grid max-w-sm gap-2">
              <p className="font-medium">{hasQuestionHistory ? "Sem questões neste filtro" : "Ainda não há evolução para exibir"}</p>
              <p className="text-sm text-muted-foreground">
                {hasQuestionHistory ? "Ajuste o período ou a matéria para encontrar registros." : "Quando você registrar questões resolvidas, a evolução semanal aparecerá aqui."}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatPercent(value: number | null): string {
  if (value === null) return "Sem dados";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)}%`;
}
