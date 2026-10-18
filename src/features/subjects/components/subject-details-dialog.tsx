"use client";

import { BookOpen, CircleCheck, CircleDot, CircleDashed } from "lucide-react";
import type { Subject, SubjectTopic } from "@/features/subjects/domain/types";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const topicStatus: Record<SubjectTopic["status"], { label: string; icon: typeof CircleDot }> = {
  nao_iniciado: { label: "Não iniciado", icon: CircleDashed },
  em_andamento: { label: "Em andamento", icon: CircleDot },
  concluido: { label: "Concluído", icon: CircleCheck },
};

export function SubjectDetailsDialog({ subject, open, onOpenChange }: {
  subject: Subject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!subject) return null;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <div className="flex items-center gap-3 pr-8"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BookOpen aria-hidden="true" className="size-5" /></span><div className="min-w-0"><DialogTitle>{subject.name}</DialogTitle><DialogDescription className="mt-1">Conteúdo cadastrado nesta matéria</DialogDescription></div></div>
      </DialogHeader>
      {subject.topics.length === 0 ? <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-8 text-center"><BookOpen aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium">Nenhum tópico cadastrado</p><p className="mt-1 text-sm text-muted-foreground">Os tópicos desta matéria aparecerão aqui quando forem adicionados.</p></div> : <div className="max-h-[min(55svh,420px)] space-y-2 overflow-y-auto pr-1" aria-label="Tópicos cadastrados">
        {subject.topics.map((topic) => {
          const state = topicStatus[topic.status];
          const StateIcon = state.icon;
          return <div key={topic.id} className="flex items-center gap-3 rounded-xl border px-4 py-3">
            <StateIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-sm font-medium">{topic.title}</span>
            <Badge variant="secondary" className="hidden sm:inline-flex">{state.label}</Badge>
          </div>;
        })}
      </div>}
      <p className="text-xs text-muted-foreground">{subject.topics.length} {subject.topics.length === 1 ? "tópico ativo" : "tópicos ativos"}</p>
    </DialogContent>
  </Dialog>;
}
