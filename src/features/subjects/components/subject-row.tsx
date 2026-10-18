"use client";

import { useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import type { Subject } from "@/features/subjects/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubjectActionsMenu } from "@/features/subjects/components/subject-actions-menu";
import { SubjectDetailsDialog } from "@/features/subjects/components/subject-details-dialog";

const colorClasses: Record<NonNullable<Subject["colorToken"]>, string> = {
  blue: "bg-primary/10 text-primary",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export function SubjectRow({ subject }: { subject: Subject }) {
  const count = subject.topics.length;
  const notStartedCount = subject.topics.filter((topic) => topic.status === "nao_iniciado").length;
  const inProgressCount = subject.topics.filter((topic) => topic.status === "em_andamento").length;
  const completedCount = subject.topics.filter((topic) => topic.status === "concluido").length;
  const statusLabel = count === 0
    ? "Sem tópicos"
    : [notStartedCount > 0 ? `${notStartedCount} não iniciados` : "", inProgressCount > 0 ? `${inProgressCount} em andamento` : "", completedCount > 0 ? `${completedCount} concluídos` : ""]
      .filter(Boolean).join(" · ") || `${count} não iniciados`;
  const colorClass = colorClasses[subject.colorToken ?? "blue"];
  const archived = subject.archivedAt !== null;

  return <div className="flex items-center gap-2 rounded-xl border bg-background p-2 transition-colors hover:bg-muted/20 sm:p-3">
    <SubjectDetailTrigger subject={subject} colorClass={colorClass} count={count} statusLabel={statusLabel} archived={archived} />
    <SubjectActionsMenu subject={subject} />
  </div>;
}

function SubjectDetailTrigger({ subject, colorClass, count, statusLabel, archived }: {
  subject: Subject;
  colorClass: string;
  count: number;
  statusLabel: string;
  archived: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="ghost" onClick={() => setOpen(true)} aria-label={`Abrir conteúdo de ${subject.name}`} className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-lg px-2 py-2 text-left sm:gap-4 sm:px-2.5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${colorClass}`}><BookOpen aria-hidden="true" className="size-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground"><span className="truncate">{subject.name}</span>{archived ? <Badge variant="secondary">Arquivada</Badge> : null}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{count} {count === 1 ? "tópico" : "tópicos"} · {statusLabel}</span>
      </span>
      <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">Ver conteúdo</span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Button>
    <SubjectDetailsDialog subject={subject} open={open} onOpenChange={setOpen} />
  </>;
}
