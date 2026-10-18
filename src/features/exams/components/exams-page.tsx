"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarDays, ChevronRight, Plus, Trophy } from "lucide-react";
import type { ExamPageData, ExamTarget } from "@/features/exams/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExamTargetForm } from "@/features/exams/components/exam-target-form";
import { ExamTargetSheet } from "@/features/exams/components/exam-target-sheet";

type ListTab = "ativos" | "arquivados";
const stageLabels: Record<string, string> = { em_preparacao: "Em preparação", edital_publicado: "Edital publicado", inscricao_aberta: "Inscrição aberta", prova_realizada: "Prova realizada" };
const priorityLabels: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

export function ExamsPage({ data }: { data: ExamPageData }) {
  const router = useRouter();
  const [tab, setTab] = useState<ListTab>("ativos");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<ExamTarget | null>(null);
  const activeTargets = useMemo(() => data.targets.filter((target) => target.archivedAt === null), [data.targets]);
  const archivedTargets = useMemo(() => data.targets.filter((target) => target.archivedAt !== null), [data.targets]);
  const visibleTargets = tab === "ativos" ? activeTargets : archivedTargets;

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: ListTab = event.key === "Home" || (event.key === "ArrowLeft" && tab === "arquivados") ? "ativos" : "arquivados";
    setTab(next);
    document.getElementById(`exam-tab-${next}`)?.focus();
  }

  return <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pb-10 pt-8 sm:px-8 sm:pt-10 lg:px-10">
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Meus objetivos</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[34px]">Concursos</h1><p className="mt-2 text-sm text-muted-foreground">Acompanhe seus objetivos em um único lugar.</p></div>
      <Button onClick={() => setAddOpen(true)} className="gap-2 self-start"><Plus aria-hidden="true" className="size-4" />Adicionar concurso</Button>
    </div>

    <Card className="gap-0 rounded-2xl py-0 shadow-sm shadow-foreground/[0.02]">
      <CardHeader className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-6">
        <div><CardTitle className="text-base">{tab === "ativos" ? "Concursos acompanhados" : "Concursos arquivados"}</CardTitle><p className="mt-1.5 text-sm text-muted-foreground">Etapas e datas são informações registradas por você.</p></div>
        <Badge variant="secondary" className="self-start sm:self-auto">{visibleTargets.length} {visibleTargets.length === 1 ? "concurso" : "concursos"}</Badge>
      </CardHeader>
      <CardContent className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div role="tablist" aria-label="Concursos ativos ou arquivados" onKeyDown={handleTabKeyDown} className="mb-4 flex w-fit gap-1 rounded-xl bg-muted/60 p-1">
          <Tab id="ativos" label="Ativos" count={activeTargets.length} selected={tab === "ativos"} onSelect={setTab} />
          <Tab id="arquivados" label="Arquivados" count={archivedTargets.length} selected={tab === "arquivados"} onSelect={setTab} />
        </div>
        <div id="exam-panel" role="tabpanel" aria-labelledby={`exam-tab-${tab}`} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {visibleTargets.length ? <ul className="grid gap-2.5 md:grid-cols-2">{visibleTargets.map((target) => <li key={target.id}><ExamTargetRow target={target} onOpen={() => setSelectedTarget(target)} archived={tab === "arquivados"} /></li>)}</ul> : <div className="rounded-xl border border-dashed bg-muted/10 px-5 py-12 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground">{tab === "ativos" ? <Trophy aria-hidden="true" className="size-5" /> : <Archive aria-hidden="true" className="size-5" />}</span>
            <h2 className="mt-3 text-sm font-semibold">{tab === "ativos" ? "Nenhum concurso cadastrado" : "Nenhum concurso arquivado"}</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{tab === "ativos" ? "Adicione um objetivo para organizar suas matérias e acompanhar sua preparação." : "Concursos arquivados por você aparecerão aqui e poderão ser restaurados."}</p>
            {tab === "ativos" ? <Button variant="outline" onClick={() => setAddOpen(true)} className="mt-4 gap-2"><Plus aria-hidden="true" className="size-4" />Adicionar concurso</Button> : null}
          </div>}
        </div>
      </CardContent>
    </Card>

    <Dialog open={addOpen} onOpenChange={setAddOpen}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Adicionar concurso</DialogTitle><DialogDescription>Registre um objetivo de preparação. As etapas e datas são pessoais e informadas por você.</DialogDescription></DialogHeader>
        <ExamTargetForm target={null} onSaved={() => { setAddOpen(false); router.refresh(); }} onCancel={() => setAddOpen(false)} />
      </DialogContent>
    </Dialog>
    {selectedTarget ? <ExamTargetSheet key={selectedTarget.id} target={selectedTarget} open onOpenChange={(open) => { if (!open) setSelectedTarget(null); }} subjects={data.subjects} topics={data.topics} archived={selectedTarget.archivedAt !== null} /> : null}
  </main>;
}

function Tab({ id, label, count, selected, onSelect }: { id: ListTab; label: string; count: number; selected: boolean; onSelect: (tab: ListTab) => void }) {
  return <button id={`exam-tab-${id}`} type="button" role="tab" tabIndex={selected ? 0 : -1} aria-selected={selected} aria-controls="exam-panel" onClick={() => onSelect(id)} className={`min-h-9 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label} <span className="ml-1 tabular-nums text-xs text-muted-foreground">{count}</span></button>;
}

function ExamTargetRow({ target, onOpen, archived }: { target: ExamTarget; onOpen: () => void; archived: boolean }) {
  return <button type="button" onClick={onOpen} className="group flex min-h-[82px] w-full items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4">
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Trophy aria-hidden="true" className="size-4" /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{target.examName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{target.institution} · {target.roleTitle}</span><span className="mt-1.5 flex flex-wrap gap-1.5"><Badge variant="secondary">{archived ? "Arquivado" : stageLabels[target.currentStage]}</Badge><Badge variant="outline">Prioridade {priorityLabels[target.priority]}</Badge></span></span>
    <span className="hidden shrink-0 text-right sm:block"><span className="block text-xs font-medium text-foreground">{target.subjects.length} {target.subjects.length === 1 ? "matéria" : "matérias"}</span><span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">{target.examDate ? <><CalendarDays aria-hidden="true" className="size-3" />{formatDate(target.examDate)}</> : "Sem data"}</span></span>
    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
  </button>;
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
