"use client";

import { BookOpen, CircleCheck, ListTodo } from "lucide-react";
import type { StudyTopic, SubjectModule } from "@/features/topics/domain/types";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TopicRow } from "@/features/topics/components/topic-row";

type TopicActions = {
  onSelect: (topic: StudyTopic) => void;
  onEdit: (topic: StudyTopic) => void;
  onArchive: (topic: StudyTopic) => void;
  onRestore: (topic: StudyTopic) => void;
  onMove: (topic: StudyTopic, direction: -1 | 1) => void;
};

export function SubjectModuleList({ modules, topics, nextTopicId, actions }: {
  modules: SubjectModule[];
  topics: StudyTopic[];
  nextTopicId: string | null;
  actions: TopicActions;
}) {
  const activeTopics = topics.filter((topic) => topic.archivedAt === null);
  const nextModule = activeTopics.find((topic) => topic.id === nextTopicId)?.moduleId;

  return <Accordion multiple defaultValue={nextModule ? [nextModule] : []} className="divide-y-0">
    {modules.map((module, moduleIndex) => {
      const moduleTopics = activeTopics.filter((topic) => topic.moduleId === module.id);
      const completed = moduleTopics.filter((topic) => topic.status === "concluido").length;
      const percentage = moduleTopics.length > 0 ? Math.round((completed / moduleTopics.length) * 100) : 0;
      return <AccordionItem key={module.id} value={module.id} className="mb-3 overflow-hidden rounded-xl border bg-card last:border-b">
        <AccordionHeader>
          <AccordionTrigger className="min-h-[68px] px-3.5 py-2.5 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-semibold tabular-nums text-primary" aria-hidden="true">{String(moduleIndex + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold text-foreground">{module.title}</span>
                {module.description ? <span className="mt-1 hidden max-w-3xl text-sm font-normal leading-5 text-muted-foreground sm:block">{module.description}</span> : null}
                <span className="mt-2 flex flex-wrap items-center gap-2 text-xs font-normal text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><BookOpen aria-hidden="true" className="size-3.5" />{moduleTopics.length} {moduleTopics.length === 1 ? "tópico" : "tópicos"}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1"><CircleCheck aria-hidden="true" className="size-3.5" />{completed} concluídos</span>
                  {moduleTopics.some((topic) => topic.id === nextTopicId) ? <Badge variant="default" className="h-5">Próximo estudo neste módulo</Badge> : null}
                </span>
              </span>
              <span className="hidden w-28 shrink-0 items-center gap-2 sm:flex" aria-label={`${percentage}% dos tópicos concluídos`}>
                <Progress value={percentage} max={100} aria-valuetext={`${percentage}% concluído`} className="flex-1" />
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{percentage}%</span>
              </span>
            </div>
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionPanel className="px-3 pb-3 sm:px-4 sm:pb-4">
          {moduleTopics.length > 0 ? <div className="space-y-2 border-t pt-3">
            {moduleTopics.map((topic, index) => <TopicRow key={topic.id} topic={topic} activeTopics={moduleTopics} index={index}
              isNext={topic.id === nextTopicId} onSelect={actions.onSelect} onEdit={actions.onEdit}
              onArchive={actions.onArchive} onRestore={actions.onRestore} onMove={actions.onMove} />)}
          </div> : <div className="flex items-center gap-2 border-t px-2 py-5 text-sm text-muted-foreground"><ListTodo aria-hidden="true" className="size-4" />Nenhum tópico ativo neste módulo.</div>}
        </AccordionPanel>
      </AccordionItem>;
    })}
  </Accordion>;
}
