"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Info, Pin, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddBlockDialog } from "@/features/planning/components/add-block-dialog";
import { PlanningBlockSheet } from "@/features/planning/components/planning-block-sheet";
import { ReorganizeDialog } from "@/features/planning/components/reorganize-dialog";
import { formatShortDate, formatWeekRange, formatWeekday, getWeekStart } from "@/features/planning/domain/dates";
import type { PlanningBlock, PlanningData } from "@/features/planning/domain/types";
import { addStudyDays } from "@/lib/date/study-day";

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}min`;
  if (hours) return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  return `${minutes} min`;
}

function statusLabel(status: PlanningBlock["status"]): string {
  return ({ planejado: "Planejado", em_andamento: "Em andamento", concluido: "Concluído", ignorado: "Ignorado" })[status];
}

function PlanningBlockButton({ block, onOpen }: { block: PlanningBlock; onOpen: (block: PlanningBlock) => void }) {
  return (
    <button type="button" onClick={() => onOpen(block)} className="w-full rounded-lg border bg-background px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex items-start justify-between gap-2"><span className="truncate font-semibold text-foreground">{block.subject}</span>{block.pinned ? <Pin aria-label="Bloco fixado" className="size-3 shrink-0 text-muted-foreground" /> : null}</span>
      <span className="mt-1 block truncate text-muted-foreground">{block.topic}</span>
      <span className="mt-2 flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {block.plannedStartTime ? <span>{block.plannedStartTime.slice(0, 5)} ·</span> : null}
        <Clock3 aria-hidden="true" className="size-3" />{block.plannedMinutes} min
        <Badge variant={block.status === "concluido" ? "secondary" : "outline"} className="ml-auto h-5 px-1.5 text-[10px]">{statusLabel(block.status)}</Badge>
      </span>
    </button>
  );
}

export function PlanningScreen({ data }: { data: PlanningData }) {
  const initialSelected = data.today >= data.weekStart && data.today <= addStudyDays(data.weekStart, 6) ? data.today : data.weekStart;
  const [selectedDate, setSelectedDate] = useState(initialSelected);
  const [selectedBlock, setSelectedBlock] = useState<PlanningBlock | null>(null);
  const days = Array.from({ length: 7 }, (_, index) => addStudyDays(data.weekStart, index));
  const weekEnd = days[6] ?? data.weekStart;
  const blocksByDate = useMemo(() => {
    const grouped = new Map<string, PlanningBlock[]>();
    for (const block of data.blocks) {
      const current = grouped.get(block.plannedDate) ?? [];
      current.push(block);
      grouped.set(block.plannedDate, current);
    }
    for (const blocks of grouped.values()) blocks.sort((a, b) => (a.plannedStartTime ?? "99:99").localeCompare(b.plannedStartTime ?? "99:99") || a.sortOrder - b.sortOrder);
    return grouped;
  }, [data.blocks]);
  const weekBlockCount = days.reduce((total, day) => total + (blocksByDate.get(day)?.length ?? 0), 0);
  const selectedBlocks = blocksByDate.get(selectedDate) ?? [];
  const selectedMinutes = selectedBlocks.filter((block) => block.status !== "ignorado").reduce((total, block) => total + block.plannedMinutes, 0);
  const overdue = data.blocks.filter((block) => block.plannedDate < data.today && block.status === "planejado").slice(-5);
  const previousWeek = addStudyDays(data.weekStart, -7);
  const nextWeek = addStudyDays(data.weekStart, 7);
  const currentWeekStart = getWeekStart(data.today);

  return (
    <AppShell email={data.email} activeItem="planejamento">
      <main className="app-page">
        <section aria-labelledby="planning-title" className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Planejamento</p>
            <h1 id="planning-title" className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-[34px]">Planejamento semanal</h1>
            <p className="mt-2 text-sm text-muted-foreground">Organize o que estudar, sem precisar refazer tudo quando a rotina mudar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:pt-1">
            <Button render={<Link href="/planejamento/reforco" />} variant="outline"><Sparkles aria-hidden="true" />Reforçar</Button>
            <Link href={`?week=${currentWeekStart}`} aria-label="Ir para a semana atual" className="inline-flex h-9 items-center rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted">Hoje</Link>
            <AddBlockDialog topics={data.topics} initialDate={selectedDate} />
          </div>
        </section>

        <Card className="py-0 shadow-sm">
          <CardHeader className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-6">
            <div><CardTitle>{formatWeekRange(data.weekStart, weekEnd)}</CardTitle><CardDescription className="mt-2">Sua semana de estudos</CardDescription></div>
            <nav aria-label="Navegar entre semanas" className="flex items-center gap-2">
              <Button variant="outline" size="icon" render={<Link href={`?week=${previousWeek}`} aria-label="Semana anterior" />}><ArrowLeft aria-hidden="true" /></Button>
              <Link href={`?week=${currentWeekStart}`} className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted">Esta semana</Link>
              <Button variant="outline" size="icon" render={<Link href={`?week=${nextWeek}`} aria-label="Próxima semana" />}><ArrowRight aria-hidden="true" /></Button>
            </nav>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-2 sm:px-6 sm:pb-6">
            <div className="hidden grid-cols-2 gap-2 md:grid xl:grid-cols-7">
              {days.map((day) => {
                const dayBlocks = blocksByDate.get(day) ?? [];
                const isSelected = selectedDate === day;
                return <section key={day} aria-label={`${formatWeekday(day)} ${formatShortDate(day)}`} className={`min-h-32 rounded-xl border p-2 ${isSelected ? "border-primary ring-1 ring-primary/30" : ""}`}>
                  <button type="button" onClick={() => setSelectedDate(day)} aria-pressed={isSelected} className="mb-2 w-full rounded-md px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="block text-xs font-semibold capitalize">{formatWeekday(day)}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{formatShortDate(day)}</span>
                  </button>
                  <div className="space-y-1.5">{dayBlocks.map((block) => <PlanningBlockButton key={block.id} block={block} onOpen={setSelectedBlock} />)}</div>
                  {dayBlocks.length === 0 ? <p className="px-1 py-2 text-xs text-muted-foreground">Sem blocos</p> : null}
                </section>;
              })}
            </div>

            <div className="space-y-3 md:hidden">
              <div className="space-y-2"><label htmlFor="planning-selected-day" className="text-sm font-medium">Dia selecionado</label>
                <select id="planning-selected-day" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {days.map((day) => <option key={day} value={day}>{formatWeekday(day)} · {formatShortDate(day)}</option>)}
                </select>
              </div>
              <section aria-label={`Blocos de ${formatShortDate(selectedDate)}`} className="space-y-2">
                {selectedBlocks.map((block) => <PlanningBlockButton key={block.id} block={block} onOpen={setSelectedBlock} />)}
                {selectedBlocks.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum bloco neste dia.</p> : null}
              </section>
            </div>

            <div className="flex flex-col gap-2 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">{weekBlockCount ? `${weekBlockCount} ${weekBlockCount === 1 ? "bloco" : "blocos"} nesta semana` : "Nenhum bloco previsto nesta semana"}</span>
              <span className={selectedMinutes > data.dailyGoalMinutes ? "font-medium text-destructive" : "text-muted-foreground"} aria-live="polite">
                {formatWeekday(selectedDate)}: {formatHours(selectedMinutes)} de {formatHours(data.dailyGoalMinutes)}{selectedMinutes > data.dailyGoalMinutes ? " · acima da meta diária" : ""}
              </span>
            </div>
          </CardContent>
        </Card>

        {weekBlockCount === 0 ? <div className="mt-5 rounded-xl border border-dashed bg-background p-5 sm:p-6">
          <h2 className="text-sm font-semibold">{data.blocks.length === 0 ? "Seu planejamento ainda está vazio." : "Não há blocos nesta semana."}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.topics.length === 0 ? "Para adicionar um bloco, primeiro cadastre matérias e tópicos. Se preferir, crie seu plano inicial na tela Hoje." : "Adicione um bloco para organizar seus próximos estudos. Os dados serão salvos na sua conta."}</p>
          {data.topics.length === 0 ? <Button render={<Link href="/hoje" />} variant="outline" className="mt-4">Ir para Hoje</Button> : <div className="mt-4"><AddBlockDialog topics={data.topics} initialDate={selectedDate} /></div>}
        </div> : null}

        {data.topics.length === 0 && weekBlockCount > 0 ? <p className="mt-4 rounded-lg border bg-background p-3 text-sm text-muted-foreground">Para criar novos blocos, cadastre matérias e tópicos na tela Hoje.</p> : null}

        {overdue.length ? <Card className="mt-5 py-0 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
            <div><CardTitle>Pendências anteriores</CardTitle><CardDescription className="mt-2">Blocos pendentes permanecem no histórico até você reorganizá-los.</CardDescription></div>
            <ReorganizeDialog overdue={overdue} allBlocks={data.blocks} today={data.today} dailyGoalMinutes={data.dailyGoalMinutes} />
          </CardHeader>
          <CardContent className="space-y-2 px-5 pb-5 sm:px-6 sm:pb-6">
            {overdue.map((block) => <button type="button" key={block.id} onClick={() => setSelectedBlock(block)} className="flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm"><span className="font-medium">{block.subject}</span><span className="text-muted-foreground"> · {block.topic}</span></span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatShortDate(block.plannedDate)} · {block.plannedMinutes} min</span>
            </button>)}
          </CardContent>
        </Card> : null}

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p>Se a rotina mudar, reorganize blocos pendentes sem alterar estudos concluídos nem blocos fixados.</p></div>
      </main>
      <PlanningBlockSheet key={selectedBlock?.id ?? "no-selection"} block={selectedBlock} topics={data.topics} today={data.today} onClose={() => setSelectedBlock(null)} />
    </AppShell>
  );
}
