"use client";

import { useMemo, useState, useTransition, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, ChevronRight, Plus } from "lucide-react";
import type { StudyTopic, SubjectTopicsPageData } from "@/features/topics/domain/types";
import { archiveTopicAction, reorderTopicsAction, restoreTopicAction } from "@/features/topics/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TopicDetailsSheet } from "@/features/topics/components/topic-details-sheet";
import { TopicFormDialog } from "@/features/topics/components/topic-form-dialog";
import { TopicRow } from "@/features/topics/components/topic-row";
import { SubjectModuleList } from "@/features/topics/components/subject-module-list";

type TopicTab = "ativas" | "arquivadas";

export function SubjectTopicsPage({ data }: { data: SubjectTopicsPageData }) {
  const router = useRouter();
  const [tab, setTab] = useState<TopicTab>("ativas");
  const [selectedTopic, setSelectedTopic] = useState<StudyTopic | null>(null);
  const [editingTopic, setEditingTopic] = useState<StudyTopic | null>(null);
  const [addingTopic, setAddingTopic] = useState(false);
  const [isPending, startTransition] = useTransition();
  const activeTopics = useMemo(() => data.topics.filter((topic) => topic.archivedAt === null), [data.topics]);
  const archivedTopics = useMemo(() => data.topics.filter((topic) => topic.archivedAt !== null), [data.topics]);
  const visibleTopics = tab === "ativas" ? activeTopics : archivedTopics;

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!(["ArrowLeft", "ArrowRight", "Home", "End"] as string[]).includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === "Home" || (event.key === "ArrowLeft" && tab === "arquivadas") ? "ativas" : "arquivadas";
    setTab(nextTab);
    document.getElementById(`topics-tab-${nextTab}`)?.focus();
  }

  function mutate(action: () => Promise<{ ok: true } | { ok: false; message: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(successMessage);
      setSelectedTopic(null);
      router.refresh();
    });
  }

  function moveTopic(topic: StudyTopic, direction: -1 | 1) {
    const siblingTopics = activeTopics.filter((item) => item.moduleId === topic.moduleId);
    const currentIndex = siblingTopics.findIndex((item) => item.id === topic.id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= siblingTopics.length) return;
    const reordered = [...activeTopics];
    const firstPosition = reordered.findIndex((item) => item.id === siblingTopics[currentIndex]?.id);
    const secondPosition = reordered.findIndex((item) => item.id === siblingTopics[nextIndex]?.id);
    [reordered[firstPosition], reordered[secondPosition]] = [reordered[secondPosition], reordered[firstPosition]];
    mutate(() => reorderTopicsAction({ subjectId: data.subject.id, topicIds: reordered.map((item) => item.id) }), "Ordem dos tópicos atualizada.");
  }

  return <main className="app-page">
    <Link href="/materias" className="mb-4 inline-flex min-h-8 items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
      <ArrowLeft aria-hidden="true" className="size-4" /><span>Matérias</span><span aria-hidden="true" className="text-border">/</span><span className="max-w-[48vw] truncate text-foreground">{data.subject.name}</span>
    </Link>

    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Detalhe da matéria</p>
        <h1 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-[34px]">{data.subject.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Organize o conteúdo, acompanhe o que já estudou e escolha o próximo tópico.</p>
      </div>
      <Button onClick={() => setAddingTopic(true)} className="gap-2 self-start"><Plus aria-hidden="true" className="size-4" />Adicionar tópico</Button>
    </div>

    <Card className="gap-0 rounded-2xl py-0 shadow-sm shadow-foreground/[0.02]">
      <CardHeader className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-6">
        <div><CardTitle className="text-base">{tab === "ativas" ? "Conteúdos principais" : "Tópicos arquivados"}</CardTitle><p className="mt-1.5 text-sm text-muted-foreground">{tab === "ativas" ? "Ordene os tópicos conforme seu ciclo de estudos." : "Os tópicos arquivados permanecem disponíveis para consulta e restauração."}</p></div>
        <Badge variant="secondary" className="self-start tabular-nums sm:self-auto">{tab === "ativas" ? `${data.modules.length} módulos · ${activeTopics.length} tópicos` : `${archivedTopics.length} tópicos`}</Badge>
      </CardHeader>
      <CardContent className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div role="tablist" aria-label="Tópicos ativos ou arquivados" onKeyDown={handleTabKeyDown} className="mb-4 flex w-fit gap-1 rounded-xl bg-muted/60 p-1">
          <Tab id="ativas" label="Ativos" count={activeTopics.length} selected={tab === "ativas"} onClick={() => setTab("ativas")} />
          <Tab id="arquivadas" label="Arquivados" count={archivedTopics.length} selected={tab === "arquivadas"} onClick={() => setTab("arquivadas")} />
        </div>
        <div id="topics-panel" role="tabpanel" aria-labelledby={`topics-tab-${tab}`} tabIndex={0} className="space-y-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {visibleTopics.length > 0 ? tab === "ativas" && data.modules.length > 0 ? <>
            <SubjectModuleList modules={data.modules} topics={activeTopics} nextTopicId={data.nextTopicId} actions={{
              onSelect: setSelectedTopic,
              onEdit: setEditingTopic,
              onArchive: (item) => mutate(() => archiveTopicAction({ id: item.id, subjectId: data.subject.id }), "Tópico arquivado."),
              onRestore: (item) => mutate(() => restoreTopicAction({ id: item.id, subjectId: data.subject.id }), "Tópico restaurado."),
              onMove: moveTopic,
            }} />
            {activeTopics.some((topic) => topic.moduleId === null || !data.modules.some((module) => module.id === topic.moduleId)) ? <section className="mt-4 space-y-2" aria-labelledby="unassigned-topics-heading">
              <h2 id="unassigned-topics-heading" className="px-1 text-sm font-semibold">Tópicos sem módulo</h2>
              {activeTopics.filter((topic) => topic.moduleId === null || !data.modules.some((module) => module.id === topic.moduleId)).map((topic, index) => <TopicRow key={topic.id} topic={topic} activeTopics={activeTopics.filter((item) => item.moduleId === topic.moduleId)} index={index} isNext={topic.id === data.nextTopicId}
                onSelect={setSelectedTopic} onEdit={setEditingTopic}
                onArchive={(item) => mutate(() => archiveTopicAction({ id: item.id, subjectId: data.subject.id }), "Tópico arquivado.")}
                onRestore={(item) => mutate(() => restoreTopicAction({ id: item.id, subjectId: data.subject.id }), "Tópico restaurado.")}
                onMove={moveTopic} />)}
            </section> : null}
          </> : visibleTopics.map((topic, index) => <TopicRow key={topic.id} topic={topic} activeTopics={tab === "ativas" ? activeTopics : archivedTopics} index={index}
            isNext={topic.id === data.nextTopicId} onSelect={setSelectedTopic} onEdit={setEditingTopic}
            onArchive={(item) => mutate(() => archiveTopicAction({ id: item.id, subjectId: data.subject.id }), "Tópico arquivado.")}
            onRestore={(item) => mutate(() => restoreTopicAction({ id: item.id, subjectId: data.subject.id }), "Tópico restaurado.")}
            onMove={moveTopic} />) : <div className="rounded-xl border border-dashed bg-muted/10 px-5 py-10 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground"><BookOpen aria-hidden="true" className="size-5" /></span>
            <h2 className="mt-3 text-sm font-semibold">{tab === "ativas" ? "Nenhum tópico cadastrado" : "Nenhum tópico arquivado"}</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{tab === "ativas" ? "Adicione um tópico para organizar os conteúdos que você vai estudar." : "Quando um tópico for arquivado, ele ficará disponível aqui para ser restaurado."}</p>
            {tab === "ativas" ? <Button variant="outline" onClick={() => setAddingTopic(true)} className="mt-4 gap-2"><Plus aria-hidden="true" className="size-4" />Adicionar tópico</Button> : null}
          </div>}
        </div>
      </CardContent>
    </Card>

    <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><ChevronRight aria-hidden="true" className="size-3.5 rotate-180" />“Dominado” é uma autoavaliação, não uma previsão de desempenho em prova.</div>
    {isPending ? <div className="sr-only" role="status"><Spinner />Salvando alteração…</div> : null}
    <TopicDetailsSheet topic={selectedTopic} open={selectedTopic !== null} onOpenChange={(open) => { if (!open) setSelectedTopic(null); }} onEdit={(topic) => { setSelectedTopic(null); setEditingTopic(topic); }} />
    {(addingTopic || editingTopic !== null) ? <TopicFormDialog key={editingTopic?.id ?? "new-topic"} subjectId={data.subject.id} topic={editingTopic} open={addingTopic || editingTopic !== null} onOpenChange={(open) => { if (!open) { setAddingTopic(false); setEditingTopic(null); } }} /> : null}
  </main>;
}

function Tab({ id, label, count, selected, onClick }: { id: TopicTab; label: string; count: number; selected: boolean; onClick: () => void }) {
  return <button id={`topics-tab-${id}`} type="button" role="tab" tabIndex={selected ? 0 : -1} aria-selected={selected} aria-controls="topics-panel" onClick={onClick} className={`min-h-9 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
    {label} <span className="ml-1 tabular-nums text-xs text-muted-foreground">{count}</span>
  </button>;
}
