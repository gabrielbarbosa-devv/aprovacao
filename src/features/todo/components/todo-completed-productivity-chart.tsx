"use client";

import { ChartNoAxesCombined } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { TodoCompletedDay } from "@/features/todo/domain/completed-tasks";

const chartConfig = {
  completed: { label: "Concluídas", theme: { light: "var(--primary)", dark: "var(--primary)" } },
  planned: { label: "Início ou prazo", theme: { light: "var(--muted-foreground)", dark: "var(--muted-foreground)" } },
} satisfies ChartConfig;

export function TodoCompletedProductivityChart({ data, enoughData, title, description }: {
  data: TodoCompletedDay[];
  enoughData: boolean;
  title: string;
  description: string;
}) {
  return <Card className="shadow-none">
    <CardHeader className="p-4 pb-2">
      <CardTitle className="text-base">Sua evolução</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="p-4 pt-2">
      {enoughData ? <ChartContainer config={chartConfig} className="h-[220px] w-full aspect-auto" aria-label={title}>
        <BarChart data={data} accessibilityLayer margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={18} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="planned" fill="var(--color-planned)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ChartContainer> : <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed px-4 text-center">
        <span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground"><ChartNoAxesCombined aria-hidden="true" className="size-5" /></span>
        <p className="mt-3 text-sm font-medium">Sem dados suficientes para mostrar a evolução</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">Quando houver tarefas planejadas ou concluídas neste período, o gráfico será preenchido.</p>
      </div>}
    </CardContent>
  </Card>;
}
