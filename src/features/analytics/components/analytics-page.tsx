import Link from "next/link";
import { ArrowUpRight, Clock3, Info, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AnalyticsFiltersBar } from "@/features/analytics/components/analytics-filters";
import { AccuracyTrendChart } from "@/features/analytics/components/accuracy-trend-chart";
import { MetricCard } from "@/features/analytics/components/metric-card";
import { SubjectBreakdown } from "@/features/analytics/components/subject-breakdown";
import type { AnalyticsPageData } from "@/features/analytics/data/get-analytics";
import { formatStudyDate } from "@/lib/date/study-day";

export function AnalyticsPage({ data }: { data: AnalyticsPageData }) {
  const { filters, summary } = data;
  const dateRange = `${formatStudyDate(filters.from, "short")} – ${formatStudyDate(filters.to, "short")}`;
  const studyTime = summary.studyMinutes === null ? "Sem dados" : formatMinutes(summary.studyMinutes);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Seu histórico</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Meu progresso</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Entenda sua evolução com métricas fiéis aos estudos registrados.</p>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">{dateRange}</p>
      </header>

      <AnalyticsFiltersBar key={`${filters.period}:${filters.from}:${filters.to}:${filters.subjectId ?? "all"}:${filters.sortBy}`} filters={filters} subjects={data.subjects} />
      <div className="mt-4 flex justify-end"><Button render={<Link href="/planejamento/reforco" />} variant="outline" size="sm"><Sparkles aria-hidden="true" />Ver plano de reforço</Button></div>
      {data.invalidCustomRange ? (
        <Alert className="mt-3 border-amber-500/30 bg-amber-500/5 text-foreground">
          <Info aria-hidden="true" />
          <AlertDescription>O intervalo personalizado era inválido. Ajuste as datas e aplique os filtros novamente.</AlertDescription>
        </Alert>
      ) : null}

      {!data.hasQuestionHistory ? (
        <Alert className="mt-4">
          <Info aria-hidden="true" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Seus indicadores começam a aparecer quando você registra questões resolvidas.</span>
            <Button render={<Link href="/registros" />} variant="outline" size="sm" className="w-fit">
              Registrar questões <ArrowUpRight aria-hidden="true" />
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="period-summary" className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="period-summary" className="text-base font-medium">Resumo do período</h2>
          <p className="text-xs text-muted-foreground">Com base nos registros que você informou</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Questões resolvidas" value={new Intl.NumberFormat("pt-BR").format(summary.questionCount)} description={summary.questionCount > 0 ? "Soma dos registros dentro do período." : "Nenhuma questão registrada neste período."} />
          <MetricCard label="Aproveitamento geral" value={formatPercent(summary.accuracy)} description={summary.accuracy === null ? "Sem dados para calcular um percentual." : `${new Intl.NumberFormat("pt-BR").format(summary.correctCount)} acertos de ${new Intl.NumberFormat("pt-BR").format(summary.questionCount)} questões.`} />
          <MetricCard label="Tempo estudado" value={studyTime} description={summary.studyMinutes === null ? "Nenhum tempo confiável registrado neste período." : "Sessões e práticas avulsas, sem somar o mesmo tempo duas vezes."} />
        </div>
      </section>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
        <AccuracyTrendChart data={summary.trend} hasQuestionHistory={data.hasQuestionHistory} />
        <SubjectBreakdown data={summary.subjects} filters={filters} hasQuestionHistory={data.hasQuestionHistory} />
      </div>

      <Card className="mt-4 border-primary/15 bg-primary/[0.035] shadow-none">
        <CardContent className="flex items-start gap-3 py-3 text-sm text-muted-foreground">
          <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>O aproveitamento é ponderado pelo número de questões. Ele descreve seus registros e não estima a chance de aprovação. Sessões vinculadas a lotes contam uma única vez no tempo estudado.</p>
        </CardContent>
      </Card>
    </main>
  );
}

function formatPercent(value: number | null): string {
  if (value === null) return "Sem dados";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)}%`;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}min`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}min`;
}
