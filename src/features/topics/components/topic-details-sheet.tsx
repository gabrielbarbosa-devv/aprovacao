"use client";

import { BookOpen, ExternalLink, Pencil, Timer } from "lucide-react";
import type { StudyTopic } from "@/features/topics/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TopicStudyGuide } from "@/features/topics/components/topic-study-guide";

const statusLabels: Record<StudyTopic["status"], string> = {
  nao_iniciado: "Não iniciado", em_andamento: "Estudando", revisando: "Revisando", dominado: "Dominado", concluido: "Concluído",
};
const priorityLabels: Record<StudyTopic["priority"], string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

export function TopicDetailsSheet({ topic, open, onOpenChange, onEdit }: {
  topic: StudyTopic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (topic: StudyTopic) => void;
}) {
  if (!topic) return null;
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-[min(100vw,42rem)] !max-w-[42rem] overflow-y-auto">
      <SheetHeader className="border-b px-5 py-6 sm:px-6">
        <div className="pr-8">
          {topic.moduleTitle ? <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><BookOpen aria-hidden="true" className="size-3.5" />{topic.moduleTitle}</p> : null}
          <SheetTitle className="text-xl leading-snug">{topic.title}</SheetTitle>
          <SheetDescription className="mt-1">Guia de estudo e informações pessoais deste tópico.</SheetDescription>
          {topic.archivedAt ? <Badge variant="secondary" className="mt-3 w-fit">Tópico arquivado</Badge> : null}
        </div>
      </SheetHeader>
      <div className="space-y-6 px-5 py-6 sm:px-6">
        <div className="grid grid-cols-2 gap-3">
          <Info label="Status"><Badge variant={topic.status === "dominado" ? "default" : "secondary"}>{statusLabels[topic.status]}</Badge></Info>
          <Info label="Prioridade"><Badge variant="outline">{priorityLabels[topic.priority]}</Badge></Info>
          <Info label="Tempo estimado"><span className="inline-flex items-center gap-1.5 text-sm">{topic.estimatedMinutes ? <><Timer aria-hidden="true" className="size-4 text-muted-foreground" />{topic.estimatedMinutes} min</> : "Não informado"}</span></Info>
          <Info label="Planejamento"><span className="text-sm">{topic.openStudyBlockCount > 0 ? `${topic.openStudyBlockCount} bloco(s) em aberto` : "Sem bloco em aberto"}</span></Info>
          {topic.plannedStudyDate ? <Info label="Próximo bloco"><span className="text-sm">{formatDate(topic.plannedStudyDate)}</span></Info> : null}
        </div>

        <TopicStudyGuide guide={topic.studyGuide} />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Material externo</h3>
          {topic.sourceUrl ? <a href={topic.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 break-all text-sm text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="truncate">{topic.sourceUrl}</span><ExternalLink aria-hidden="true" className="size-4 shrink-0" /><span className="sr-only">Abre em uma nova aba</span>
          </a> : <p className="text-sm text-muted-foreground">Nenhum link informado.</p>}
        </section>

        <section className="space-y-2 border-t pt-5">
          <h3 className="text-sm font-semibold">Suas notas</h3>
          {topic.notes ? <p className="whitespace-pre-wrap break-words rounded-xl border bg-muted/20 p-4 text-sm leading-6">{topic.notes}</p> : <p className="text-sm text-muted-foreground">Nenhuma nota informada.</p>}
        </section>
        <p className="text-xs leading-5 text-muted-foreground">“Dominado” é uma autoavaliação sua; não é inferida por tempo de estudo ou resultados.</p>
      </div>
      {topic.archivedAt === null ? <div className="mt-auto border-t bg-muted/20 p-4 sm:px-6">
        <Button className="w-full gap-2" onClick={() => onEdit(topic)}><Pencil aria-hidden="true" className="size-4" />Editar tópico</Button>
      </div> : <p className="mt-auto border-t bg-muted/20 p-4 text-center text-sm text-muted-foreground sm:px-6">Restaure o tópico pelo menu de ações para editar.</p>}
    </SheetContent>
  </Sheet>;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-2 rounded-xl border bg-background p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="min-w-0">{children}</div>
  </div>;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
