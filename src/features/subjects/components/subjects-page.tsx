"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Archive, BookOpen, Plus } from "lucide-react";
import type { Subject } from "@/features/subjects/domain/types";
import { getActiveSubjectFocusGroups } from "@/features/subjects/domain/focus-groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubjectFormDialog } from "@/features/subjects/components/subject-form-dialog";
import { SubjectRow } from "@/features/subjects/components/subject-row";

type SubjectTab = "ativas" | "arquivadas";

export function SubjectsPage({ subjects }: { subjects: Subject[] }) {
  const [tab, setTab] = useState<SubjectTab>("ativas");
  const [addOpen, setAddOpen] = useState(false);
  const activeSubjects = useMemo(() => subjects.filter((subject) => subject.archivedAt === null), [subjects]);
  const archivedSubjects = useMemo(() => subjects.filter((subject) => subject.archivedAt !== null), [subjects]);
  const visibleSubjects = tab === "ativas" ? activeSubjects : archivedSubjects;
  const { focusSubjects, otherSubjects: activeOtherSubjects } = useMemo(() => getActiveSubjectFocusGroups(subjects), [subjects]);
  const prioritySubjects = tab === "ativas" ? focusSubjects : [];
  const otherSubjects = tab === "ativas" ? activeOtherSubjects : visibleSubjects;

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const nextTab = event.key === "Home" || event.key === "ArrowLeft" && tab === "arquivadas"
      ? "ativas"
      : "arquivadas";
    setTab(nextTab);
    document.getElementById(`subjects-tab-${nextTab}`)?.focus();
  }

  return <main className="app-page">
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Conteúdos</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[34px]">Matérias</h1>
        <p className="mt-2 text-sm text-muted-foreground">Seus conteúdos organizados por disciplina.</p>
      </div>
      <Button onClick={() => setAddOpen(true)} className="gap-2 self-start"><Plus aria-hidden="true" className="size-4" />Adicionar matéria</Button>
    </div>

    <Card className="gap-0 rounded-2xl py-0 shadow-sm shadow-foreground/[0.02]">
      <CardHeader className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-6">
        <div><CardTitle className="text-base">{tab === "ativas" ? "Matérias do seu ciclo" : "Matérias arquivadas"}</CardTitle><p className="mt-1.5 text-sm text-muted-foreground">Abra uma matéria para ver os tópicos cadastrados.</p></div>
        <Badge variant="secondary" className="self-start sm:self-auto">{visibleSubjects.length} {visibleSubjects.length === 1 ? "disciplina" : "disciplinas"}</Badge>
      </CardHeader>
      <CardContent className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div role="tablist" aria-label="Matérias ativas ou arquivadas" onKeyDown={handleTabKeyDown} className="mb-4 flex w-fit gap-1 rounded-xl bg-muted/60 p-1">
          <button id="subjects-tab-ativas" type="button" role="tab" tabIndex={tab === "ativas" ? 0 : -1} aria-selected={tab === "ativas"} aria-controls="subjects-panel" onClick={() => setTab("ativas")} className={`min-h-9 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === "ativas" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Ativas <span className="ml-1 tabular-nums text-xs text-muted-foreground">{activeSubjects.length}</span></button>
          <button id="subjects-tab-arquivadas" type="button" role="tab" tabIndex={tab === "arquivadas" ? 0 : -1} aria-selected={tab === "arquivadas"} aria-controls="subjects-panel" onClick={() => setTab("arquivadas")} className={`min-h-9 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === "arquivadas" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Arquivadas <span className="ml-1 tabular-nums text-xs text-muted-foreground">{archivedSubjects.length}</span></button>
        </div>

        <div id="subjects-panel" role="tabpanel" aria-labelledby={`subjects-tab-${tab}`} tabIndex={0} className="space-y-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {visibleSubjects.length > 0 ? <>
            {prioritySubjects.length > 0 ? <section aria-labelledby="priority-subjects-title">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 id="priority-subjects-title" className="text-sm font-semibold">Foco principal</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Matérias que você escolheu manter em destaque. A ordem segue o currículo.</p>
                </div>
                <Badge variant="secondary">{prioritySubjects.length} {prioritySubjects.length === 1 ? "matéria" : "matérias"}</Badge>
              </div>
              <div className="grid gap-2 xl:grid-cols-2">
                {prioritySubjects.map((subject) => <SubjectRow key={subject.id} subject={subject} activeSubjectIds={activeSubjects.map((activeSubject) => activeSubject.id)} activeIndex={activeSubjects.findIndex((activeSubject) => activeSubject.id === subject.id)} />)}
              </div>
            </section> : null}
            {otherSubjects.length > 0 ? <section aria-labelledby="other-subjects-title">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 id="other-subjects-title" className="text-sm font-semibold">Demais matérias do edital</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Continuam disponíveis para o planejamento e para seus registros.</p>
                </div>
                <Badge variant="outline">{otherSubjects.length}</Badge>
              </div>
              <div className="grid gap-2 xl:grid-cols-2">
                {otherSubjects.map((subject) => <SubjectRow key={subject.id} subject={subject} activeSubjectIds={activeSubjects.map((activeSubject) => activeSubject.id)} activeIndex={activeSubjects.findIndex((activeSubject) => activeSubject.id === subject.id)} />)}
              </div>
            </section> : null}
            {tab === "arquivadas" ? <div className="grid gap-2 xl:grid-cols-2">
              {visibleSubjects.map((subject, index) => <SubjectRow key={subject.id} subject={subject} activeIndex={index} />)}
            </div> : null}
          </> : <div className="rounded-xl border border-dashed bg-muted/10 px-5 py-8 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground">{tab === "ativas" ? <BookOpen aria-hidden="true" className="size-5" /> : <Archive aria-hidden="true" className="size-5" />}</span>
            <h2 className="mt-3 text-sm font-semibold">{tab === "ativas" ? "Nenhuma matéria cadastrada" : "Nenhuma matéria arquivada"}</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{tab === "ativas" ? "Adicione uma matéria para começar a organizar seus tópicos de estudo." : "Quando você arquivar uma matéria, ela ficará disponível aqui para ser restaurada."}</p>
            {tab === "ativas" ? <Button variant="outline" onClick={() => setAddOpen(true)} className="mt-4 gap-2"><Plus aria-hidden="true" className="size-4" />Adicionar matéria</Button> : null}
          </div>}
        </div>
      </CardContent>
    </Card>
    {addOpen ? <SubjectFormDialog open={addOpen} onOpenChange={setAddOpen} subject={null} /> : null}
  </main>;
}
