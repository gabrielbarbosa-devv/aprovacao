"use client";

import { useState } from "react";
import { Archive, ArrowDown, ArrowUp, Ellipsis, RotateCcw } from "lucide-react";
import type { StudyTopic } from "@/features/topics/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const statusLabels: Record<StudyTopic["status"], string> = {
  nao_iniciado: "Não iniciado", em_andamento: "Estudando", revisando: "Revisando", dominado: "Dominado", concluido: "Concluído",
};
const priorityLabels: Record<StudyTopic["priority"], string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

export function TopicRow({ topic, activeTopics, index, isNext = false, onSelect, onEdit, onArchive, onRestore, onMove }: {
  topic: StudyTopic;
  activeTopics: StudyTopic[];
  index: number;
  isNext?: boolean;
  onSelect: (topic: StudyTopic) => void;
  onEdit: (topic: StudyTopic) => void;
  onArchive: (topic: StudyTopic) => void;
  onRestore: (topic: StudyTopic) => void;
  onMove: (topic: StudyTopic, direction: -1 | 1) => void;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const archived = topic.archivedAt !== null;
  return <div className={`flex min-w-0 items-center gap-1 rounded-xl border bg-background p-2 transition-colors hover:bg-muted/20 sm:gap-2 sm:p-3 ${isNext ? "border-primary/30 bg-primary/[0.025]" : ""}`}>
    <Button type="button" variant="ghost" onClick={() => onSelect(topic)} className="h-auto min-h-14 min-w-0 flex-1 justify-start gap-3 rounded-lg px-2 py-2 text-left sm:gap-4 sm:px-2.5" aria-label={`Ver detalhes: ${topic.title}`}>
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-semibold leading-5 text-foreground">{topic.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{statusLabels[topic.status]}</span><span aria-hidden="true">·</span><span>Prioridade {priorityLabels[topic.priority]}</span>
          {isNext ? <Badge variant="default" className="h-5">Próximo estudo</Badge> : null}
          {isNext && topic.plannedStudyDate ? <span>Planejado para {formatPlannedDate(topic.plannedStudyDate)}</span> : null}
          {topic.sourceUrl ? <span className="hidden sm:inline">· Material externo adicionado</span> : null}
          {archived ? <Badge variant="secondary" className="h-5">Arquivado</Badge> : null}
        </span>
      </span>
      <span className="sr-only">Abrir detalhes</span>
    </Button>

    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={`Ações de ${topic.title}`} />}>
        <Ellipsis aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {!archived ? <>
          <DropdownMenuItem onClick={() => onEdit(topic)}>Editar tópico</DropdownMenuItem>
          <DropdownMenuItem disabled={index === 0} onClick={() => onMove(topic, -1)}><ArrowUp aria-hidden="true" />Mover para cima</DropdownMenuItem>
          <DropdownMenuItem disabled={index === activeTopics.length - 1} onClick={() => onMove(topic, 1)}><ArrowDown aria-hidden="true" />Mover para baixo</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmArchive(true)}><Archive aria-hidden="true" />Arquivar tópico</DropdownMenuItem>
        </> : <DropdownMenuItem onClick={() => onRestore(topic)}><RotateCcw aria-hidden="true" />Restaurar tópico</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>

    <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar este tópico?</AlertDialogTitle>
          <AlertDialogDescription>
            {topic.openStudyBlockCount > 0
              ? `Há ${topic.openStudyBlockCount} bloco(s) planejado(s) ou em andamento ligado(s) a este tópico. Reorganize o planejamento antes de arquivar.`
              : "Ele sairá da lista ativa. Os registros de estudo concluídos serão preservados."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={topic.openStudyBlockCount > 0} onClick={() => { onArchive(topic); setConfirmArchive(false); }}>Arquivar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

function formatPlannedDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
