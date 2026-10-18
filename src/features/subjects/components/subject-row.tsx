import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import type { Subject } from "@/features/subjects/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubjectActionsMenu } from "@/features/subjects/components/subject-actions-menu";

const colorClasses: Record<NonNullable<Subject["colorToken"]>, string> = {
  blue: "bg-primary/10 text-primary",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export function SubjectRow({ subject, activeSubjectIds, activeIndex }: { subject: Subject; activeSubjectIds?: string[]; activeIndex: number }) {
  const archived = subject.archivedAt !== null;
  const colorClass = colorClasses[subject.colorToken ?? "blue"];
  const counts = subject.topics.reduce<Record<string, number>>((result, topic) => {
    result[topic.status] = (result[topic.status] ?? 0) + 1;
    return result;
  }, {});
  const statusLabel = subject.topics.length === 0
    ? "Sem tópicos"
    : [
      counts.nao_iniciado ? `${counts.nao_iniciado} não iniciados` : "",
      counts.em_andamento ? `${counts.em_andamento} estudando` : "",
      counts.revisando ? `${counts.revisando} revisando` : "",
      counts.dominado ? `${counts.dominado} dominados` : "",
      counts.concluido ? `${counts.concluido} concluídos` : "",
    ].filter(Boolean).join(" · ");
  const content = <>
    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${colorClass}`}><BookOpen aria-hidden="true" className="size-[18px]" /></span>
    <span className="min-w-0 flex-1">
      <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-foreground"><span className="min-w-0 break-words [overflow-wrap:anywhere]">{subject.name}</span>{archived ? <Badge variant="secondary">Arquivada</Badge> : null}</span>
      <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{subject.topics.length} {subject.topics.length === 1 ? "tópico" : "tópicos"}{statusLabel ? ` · ${statusLabel}` : ""}</span>
    </span>
    <span className="hidden shrink-0 text-xs text-muted-foreground md:inline">{archived ? "Restaurar para abrir" : "Ver conteúdo"}</span>
    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
  </>;

  return <div className="flex items-center gap-2 rounded-xl border bg-background p-1.5 transition-colors hover:bg-muted/20 sm:p-2">
    {archived
      ? <Button type="button" variant="ghost" disabled className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-lg px-2 py-2 text-left sm:gap-4 sm:px-2.5" aria-label={`Matéria arquivada: ${subject.name}`}>{content}</Button>
      : <Link href={`/materias/${subject.id}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring sm:gap-3 sm:px-2.5" aria-label={`Abrir tópicos de ${subject.name}`}>{content}</Link>}
    <SubjectActionsMenu subject={subject} activeSubjectIds={activeSubjectIds} activeIndex={activeIndex} />
  </div>;
}
