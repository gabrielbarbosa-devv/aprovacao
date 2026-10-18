"use client";

import { useState } from "react";
import { BookOpen, CalendarClock, Check, Info, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewTaskDialog } from "@/features/reviews/components/review-task-dialog";
import type { EnrichedReviewTask } from "@/features/reviews/data/reviews-repository";
import { formatStudyDate } from "@/lib/date/study-day";

type Tab = "due" | "upcoming" | "completed";
type Props = { email: string; today: string; due: EnrichedReviewTask[]; upcoming: EnrichedReviewTask[]; completed: EnrichedReviewTask[] };

const tabs: { id: Tab; label: string }[] = [
  { id: "due", label: "Hoje e atrasadas" },
  { id: "upcoming", label: "Próximas" },
  { id: "completed", label: "Concluídas" },
];

export function ReviewsPage({ email, today, due, upcoming, completed }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("due");
  const items = activeTab === "due" ? due : activeTab === "upcoming" ? upcoming : completed;
  return <AppShell email={email} activeItem="revisoes">
    <main className="app-page">
      <section aria-labelledby="reviews-heading" className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Repetição espaçada</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 id="reviews-heading" className="text-3xl font-bold leading-tight tracking-tight sm:text-[34px]">Revisões</h1><p className="mt-2 text-sm text-muted-foreground">Reforce cada assunto no momento certo e acompanhe o que já revisou.</p></div>
          <Badge variant="outline" className="h-9 w-fit gap-2 px-3"><CalendarClock aria-hidden="true" className="size-4" />{formatStudyDate(today, "short")}</Badge>
        </div>
      </section>

      <div role="group" aria-label="Filtrar revisões" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => {
          const count = tab.id === "due" ? due.length : tab.id === "upcoming" ? upcoming.length : completed.length;
          return <Button key={tab.id} type="button" variant="ghost" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`h-10 rounded-none border-b-2 px-3 ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {tab.label}<span className="ml-1 text-xs tabular-nums">{count}</span>
          </Button>;
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <Card className="min-w-0 py-0 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
            <div><CardTitle>{activeTab === "due" ? "Para revisar agora" : activeTab === "upcoming" ? "Revisões programadas" : "Histórico de revisões"}</CardTitle>
              <CardDescription className="mt-2">{activeTab === "due" ? "As pendências de dias anteriores continuam visíveis aqui." : activeTab === "upcoming" ? "Organizadas pela próxima data agendada." : "Registros concluídos e resultados informados por você."}</CardDescription></div>
            <Badge variant="secondary" className="shrink-0">{items.length} {items.length === 1 ? "revisão" : "revisões"}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
            {items.length ? items.map((task) => <ReviewRow key={task.id} task={task} today={today} completed={activeTab === "completed"} />) : <EmptyState tab={activeTab} />}
          </CardContent>
        </Card>

        <Card className="min-w-0 py-0 shadow-sm">
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6"><CardTitle>Como funciona?</CardTitle><CardDescription className="mt-2">As datas partem do dia em que você estudou de verdade.</CardDescription></CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="space-y-4 border-t pt-4">
              {[{ label: "D+1", title: "Primeira revisão", description: "No dia seguinte ao estudo" }, { label: "D+7", title: "Consolidação", description: "Sete dias depois do estudo" }, { label: "D+30", title: "Revisão de longo prazo", description: "Trinta dias depois do estudo" }].map((stage) => <div key={stage.label} className="flex items-center gap-3"><Badge variant="secondary" className="h-6 min-w-12 justify-center text-primary">{stage.label}</Badge><div><p className="text-sm font-semibold">{stage.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{stage.description}</p></div></div>)}
            </div>
            <p className="flex items-start gap-2 border-t pt-4 text-xs leading-5 text-muted-foreground"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Reagendar muda apenas esta tarefa. As etapas futuras do estudo continuam no histórico.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-xl border bg-background p-4 text-xs leading-5 text-muted-foreground"><Check aria-hidden="true" className="size-4 shrink-0" />Conclua uma revisão depois de estudá-la no seu material habitual. Nenhum conteúdo ou questão é gerado dentro do app.</div>
    </main>
  </AppShell>;
}

function ReviewRow({ task, today, completed }: { task: EnrichedReviewTask; today: string; completed: boolean }) {
  const overdue = !completed && task.dueOn < today;
  const stage = task.kind === "reinforcement" ? "Reforço · D+2" : `D+${task.intervalDays}`;
  return <article className="flex flex-col gap-3 rounded-xl border p-3.5 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:gap-4">
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><BookOpen aria-hidden="true" className="size-5" /></span>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{task.topic}</h3>{overdue ? <Badge variant="destructive">Atrasada</Badge> : null}</div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{task.subject} · {stage}</p>
      <p className="mt-1 text-xs text-muted-foreground">{completed && task.outcome?.reviewedOn ? `Revisada em ${formatStudyDate(task.outcome.reviewedOn, "short")}` : `Agendada para ${formatStudyDate(task.dueOn, "short")}`}</p>
      {completed && task.outcome ? <p className="mt-1 text-xs text-muted-foreground">Dificuldade: {difficultyText(task.outcome.difficulty)}{task.outcome.questionCount !== null && task.outcome.correctCount !== null ? ` · ${task.outcome.correctCount}/${task.outcome.questionCount} acertos` : ""}</p> : null}
    </div>
    <ReviewTaskDialog task={task} today={today} completed={completed} />
  </article>;
}

function EmptyState({ tab }: { tab: Tab }) {
  const content = tab === "due"
    ? { icon: RefreshCw, title: "Nenhuma revisão pendente", description: "Quando chegar a data de uma revisão, ela aparecerá aqui ligada ao estudo que você registrou." }
    : tab === "upcoming"
      ? { icon: CalendarClock, title: "Nenhuma revisão futura", description: "As próximas etapas aparecem aqui quando seus estudos registrados tiverem novas datas agendadas." }
      : { icon: Check, title: "Nenhuma revisão concluída", description: "Depois que você registrar uma revisão, o resultado ficará disponível neste histórico." };
  const Icon = content.icon;
  return <div className="grid min-h-48 place-items-center rounded-xl border border-dashed px-6 py-7 text-center"><div className="max-w-sm"><span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon aria-hidden="true" className="size-5" /></span><h3 className="text-sm font-semibold">{content.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{content.description}</p></div></div>;
}

function difficultyText(value: number | null) {
  if (value === null) return "Não informada";
  if (value <= 2) return "Fácil";
  if (value <= 4) return "Média";
  return "Difícil";
}
