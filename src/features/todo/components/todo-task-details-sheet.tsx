"use client";

import { BriefcaseBusiness, CalendarDays, Check, Circle, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { TodoList, TodoTask, TodoWorkspace } from "@/features/todo/domain/types";
import { localDateFromKey, taskDueDateKey } from "@/features/todo/domain/dashboard";

function priorityLabel(priority: string): string {
  if (priority === "high") return "Alta";
  if (priority === "low") return "Baixa";
  return "Média";
}

function formatDate(value: string | null) {
  if (!value) return "Sem prazo definido";
  const date = value.includes("T") ? new Date(value) : localDateFromKey(value);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
}

type TodoTaskDetailsSheetProps = {
  task: TodoTask | null;
  list?: TodoList;
  workspace?: TodoWorkspace;
  onOpenChange: (open: boolean) => void;
  onToggleComplete: (task: TodoTask) => Promise<void>;
  saving: boolean;
};

export function TodoTaskDetailsSheet({ task, list, workspace, onOpenChange, onToggleComplete, saving }: TodoTaskDetailsSheetProps) {
  const done = task?.status === "done";
  const dateKey = task ? taskDueDateKey(task) : null;
  const dueLabel = task?.due_at
    ? `${formatDate(task.due_at)} às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(task.due_at))}`
    : task?.due_on ? formatDate(task.due_on) : "Sem prazo definido";

  return (
    <Sheet open={Boolean(task)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        {task ? <>
          <SheetHeader className="border-b px-5 pb-4 pt-7 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <Badge variant={done ? "secondary" : task.priority === "high" ? "destructive" : "outline"}>{done ? "Concluída" : priorityLabel(task.priority)}</Badge>
              {task.status === "in_progress" ? <Badge variant="secondary">Em andamento</Badge> : null}
            </div>
            <SheetTitle className="pt-1 text-xl">{task.title}</SheetTitle>
            <SheetDescription>{done ? "Esta tarefa foi concluída." : "Detalhes e organização da tarefa."}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {task.description ? <section className="space-y-2"><h3 className="text-sm font-semibold">Descrição</h3><p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{task.description}</p></section> : <p className="text-sm text-muted-foreground">Nenhuma descrição foi adicionada.</p>}
            <Separator />
            <dl className="space-y-4">
              <div className="flex items-start gap-3"><ListTodo className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" /><div><dt className="text-xs text-muted-foreground">Lista</dt><dd className="mt-1 text-sm font-medium">{list?.name ?? "Lista indisponível"}</dd></div></div>
              {workspace ? <div className="flex items-start gap-3"><BriefcaseBusiness className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" /><div><dt className="text-xs text-muted-foreground">Workspace</dt><dd className="mt-1 text-sm font-medium">{workspace.name}</dd></div></div> : null}
              <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" /><div><dt className="text-xs text-muted-foreground">Prazo</dt><dd className="mt-1 text-sm font-medium">{dueLabel}</dd></div></div>
              <div className="flex items-start gap-3"><Circle className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" /><div><dt className="text-xs text-muted-foreground">Início</dt><dd className="mt-1 text-sm font-medium">{formatDate(task.starts_on)}</dd></div></div>
              {task.completed_at ? <div className="flex items-start gap-3"><Check className="mt-0.5 size-4 text-primary" aria-hidden="true" /><div><dt className="text-xs text-muted-foreground">Concluída em</dt><dd className="mt-1 text-sm font-medium">{formatDate(task.completed_at)}</dd></div></div> : null}
              {dateKey ? <div className="text-xs text-muted-foreground">Data local do prazo: {dateKey}</div> : null}
            </dl>
          </div>
          <SheetFooter className="border-t px-5 py-4 sm:px-6">
            <Button onClick={() => void onToggleComplete(task)} disabled={saving} className="w-full">
              {done ? "Reabrir tarefa" : "Concluir tarefa"}
            </Button>
          </SheetFooter>
        </> : null}
      </SheetContent>
    </Sheet>
  );
}
