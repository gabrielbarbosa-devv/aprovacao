"use client";

import { useState } from "react";
import { ArrowUpRight, BookOpen, ChevronRight, Clock3, Info, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TopicStudyGuide } from "@/features/topics/components/topic-study-guide";
import { StudySessionDialog } from "@/features/study-sessions/components/study-session-dialog";
import type { StudyTopicOption } from "@/features/study-sessions/domain/types";
import type { TodayStudyBlock } from "@/features/today/domain/types";
import { formatDuration } from "@/features/today/domain/format-duration";
import { StudyBlockActionButton } from "@/features/today/components/study-block-action-button";

type StudyBlockDetailsDialogProps = {
  block: TodayStudyBlock;
  topics: StudyTopicOption[];
  today: string;
};

export function StudyBlockDetailsDialog({ block, topics, today }: StudyBlockDetailsDialogProps) {
  const [open, setOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const suggestedQuestions = block.studyGuide?.practice?.firstQuestions ?? null;
  const action = block.status === "em_andamento" ? "pause" : "start";

  function openResultDialog() {
    setOpen(false);
    setResultOpen(true);
  }

  return <>
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`Abrir plano de estudo: ${block.subject}, ${block.topic}`}
      onClick={() => setOpen(true)}
      className="flex w-full min-w-0 items-center gap-3 rounded-lg p-1 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring sm:gap-4"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><BookOpen aria-hidden="true" className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{block.subject}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{block.topic}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
          <Badge variant="secondary">Bloco {String(block.sequence).padStart(2, "0")}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" />{formatDuration(block.durationMinutes)}</span>
          {block.status === "em_andamento" ? <Badge className="h-5">Em andamento</Badge> : null}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-3 sm:flex">
        <Badge variant="secondary">Bloco {String(block.sequence).padStart(2, "0")}</Badge>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Clock3 aria-hidden="true" className="size-4" />{formatDuration(block.durationMinutes)}</span>
        {block.status === "em_andamento" ? <Badge>Em andamento</Badge> : null}
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </button>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader className="pr-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Seu próximo bloco</p>
          <DialogTitle className="text-xl leading-snug">{block.topic}</DialogTitle>
          <DialogDescription>{block.subject} · Bloco {String(block.sequence).padStart(2, "0")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Summary icon={<Clock3 aria-hidden="true" className="size-4" />} label="Tempo planejado">
            <span className="font-semibold">{formatDuration(block.durationMinutes)}</span>
          </Summary>
          <Summary icon={<ListChecks aria-hidden="true" className="size-4" />} label="Questões para praticar">
            {suggestedQuestions === null
              ? <span className="text-muted-foreground">Quantidade não definida no guia</span>
              : <span><strong>{suggestedQuestions}</strong> <span className="text-muted-foreground">sugeridas pelo guia</span></span>}
          </Summary>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />Iniciar marca o bloco como em andamento. O tempo real e as questões feitas são informados por você ao registrar o resultado.
        </p>

        <TopicStudyGuide guide={block.studyGuide} mode="session" />

        {block.sourceUrl ? <a href={block.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Abrir material registrado <ArrowUpRight aria-hidden="true" className="size-4" /><span className="sr-only">(abre em nova aba)</span>
        </a> : null}

        <DialogFooter className="flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <StudyBlockActionButton
              blockId={block.id}
              action={action}
              label={action === "pause" ? "Pausar atividade" : "Iniciar atividade"}
              variant="default"
            />
            <Button type="button" variant="outline" onClick={openResultDialog}>Registrar resultado</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <StudySessionDialog
      topics={topics}
      today={today}
      selectedBlock={{ id: block.id, topicId: block.topicId, subject: block.subject, topic: block.topic, durationMinutes: block.durationMinutes }}
      trigger={false}
      open={resultOpen}
      onOpenChange={setResultOpen}
    />
  </>;
}

function Summary({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-xl border bg-background p-3.5">
    <h3 className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</h3>
    <p className="text-sm">{children}</p>
  </section>;
}
