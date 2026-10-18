import Link from "next/link";
import { CalendarDays, Check, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateStarterPlanDialog } from "@/features/today/components/create-starter-plan-dialog";
import { ReviewsEmptyState } from "@/features/today/components/reviews-empty-state";
import { StudyBlockCard } from "@/features/today/components/study-block-card";
import { getTodayDashboard } from "@/features/today/data/get-today-dashboard";
import { formatDuration } from "@/features/today/domain/format-duration";
import { StudySessionDialog } from "@/features/study-sessions/components/study-session-dialog";
import { StudySessionHistory } from "@/features/study-sessions/components/study-session-history";
import { addStudyDays, formatStudyDate } from "@/lib/date/study-day";

function formatDailyGoal(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h${String(rest).padStart(2, "0")} por dia`;
  if (hours) return `${hours} ${hours === 1 ? "hora" : "horas"} por dia`;
  return `${minutes} min por dia`;
}

export async function TodayPage() {
  const dashboard = await getTodayDashboard();
  const plannedMinutes = dashboard.blocks.reduce((total, block) => total + block.durationMinutes, 0);
  const dateLong = formatStudyDate(dashboard.studyDay, "long");
  const dateCompact = formatStudyDate(dashboard.studyDay, "short");

  return (
    <AppShell email={dashboard.email}>
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 pb-8 pt-8 sm:px-8 sm:pt-10 lg:px-10">
        <section aria-labelledby="today-heading" className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Hoje</p>
            <h1 id="today-heading" className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-[34px]">
              Seu estudo começa por aqui.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {dateLong} · Meta de {formatDailyGoal(dashboard.dailyGoalMinutes)}
            </p>
          </div>
          <Badge variant="outline" className="h-10 w-fit gap-2 px-4 text-sm font-medium">
            <CalendarDays aria-hidden="true" className="size-4" />{dateCompact}
          </Badge>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
          <Card className="min-w-0 py-0 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
              <div>
                <CardTitle>Estudar hoje</CardTitle>
                <CardDescription className="mt-2">
                  {dashboard.blocks.length ? "Seus próximos blocos planejados." : "Blocos de estudo planejados para esta data."}
                </CardDescription>
              </div>
              <CardAction>
                <Badge variant="secondary" className="mt-1 whitespace-nowrap">
                  {dashboard.blocks.length} {dashboard.blocks.length === 1 ? "bloco" : "blocos"} · {formatDuration(plannedMinutes)}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
              {dashboard.blocks.map((block) => <StudyBlockCard key={block.id} block={block} topics={dashboard.topics} today={dashboard.studyDay} />)}
              {dashboard.blocks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <p className="text-sm font-medium">{dashboard.hasPlan ? "Nenhum bloco planejado para hoje." : "Seu planejamento ainda não começou."}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {dashboard.hasPlan ? "Você pode consultar seus próximos compromissos quando o Planejamento estiver disponível." : "Crie um plano inicial quando estiver pronto para organizar os primeiros estudos."}
                  </p>
                  {!dashboard.hasPlan ? (
                    <CreateStarterPlanDialog today={dashboard.studyDay} defaultStartDate={addStudyDays(dashboard.studyDay, 1)} />
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-start gap-3 rounded-xl border bg-muted/30 px-4 py-4 text-sm leading-5 text-muted-foreground">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>Estude onde preferir. Ao terminar, registre seu tempo e seus acertos aqui.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 py-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
              <CardTitle>Revisões de hoje</CardTitle>
              <Badge variant="secondary">{dashboard.reviewCount} pendentes</Badge>
            </CardHeader>
            <CardContent className="px-0 pt-1">
              <ReviewsEmptyState count={dashboard.reviewCount} items={dashboard.reviewItems} today={dashboard.studyDay} />
            </CardContent>
          </Card>
        </div>

        <section className="mt-6 flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-semibold">Estudou fora de um bloco?</h2><p className="mt-1 text-sm text-muted-foreground">Registre uma sessão avulsa vinculada a um tópico seu.</p></div>
          <StudySessionDialog topics={dashboard.topics} today={dashboard.studyDay} />
        </section>
        <StudySessionHistory sessions={dashboard.history} topics={dashboard.topics} today={dashboard.studyDay} />

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Check aria-hidden="true" className="size-4 shrink-0" />
          O planejamento poderá ser ajustado em uma próxima etapa.
          <Button render={<Link href="/planejamento" />} variant="outline" className="ml-auto hidden sm:inline-flex">Ver planejamento</Button>
        </div>
      </main>
    </AppShell>
  );
}
