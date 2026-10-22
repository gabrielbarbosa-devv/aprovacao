"use client";

import { Check, Clock3, LoaderCircle, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { TodoList, TodoTask, TodoWorkspace } from "@/features/todo/domain/types";
import { cn } from "@/lib/utils";

export function TodoCompletedTaskRow({ task, list, workspace, saving, onOpen, onReopen, onDelete }: {
  task: TodoTask;
  list?: TodoList;
  workspace?: TodoWorkspace;
  saving: boolean;
  onOpen: (task: TodoTask) => void;
  onReopen: (task: TodoTask) => void;
  onDelete: (task: TodoTask) => void;
}) {
  const completedAt = task.completed_at ? new Date(task.completed_at) : null;
  const completedTime = completedAt ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(completedAt) : "—";

  return <article className="group flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:flex-nowrap sm:px-4">
    <Checkbox checked disabled={saving} aria-label={`Reabrir ${task.title}`} onCheckedChange={() => onReopen(task)} />
    <button type="button" onClick={() => onOpen(task)} className="order-1 min-w-0 flex-1 basis-[calc(100%-3rem)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:order-none sm:basis-auto">
      <span className={cn("block break-words text-sm font-medium line-through decoration-muted-foreground/50", "text-muted-foreground")}>{task.title}</span>
      <span className="mt-1 block break-words text-xs text-muted-foreground">{task.description?.trim() || "Sem descrição"}</span>
    </button>
    <div className="order-2 ml-8 flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:order-none sm:ml-0 sm:flex-none">
      {list ? <Badge variant="secondary" className="max-w-32 truncate">{list.name}</Badge> : null}
      {workspace ? <Badge variant="outline" className="max-w-32 truncate">{workspace.name}</Badge> : null}
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" />Concluída às {completedTime}</span>
    </div>
    <div className="order-3 ml-auto flex items-center gap-1 sm:order-none sm:ml-0">
      <Button variant="outline" size="sm" disabled={saving} onClick={() => onReopen(task)} className="h-8 gap-1.5">
        {saving ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <RotateCcw aria-hidden="true" className="size-3.5" />}
        <span>Reabrir</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Ações para ${task.title}`} disabled={saving} className="size-8 shrink-0" />}><MoreHorizontal aria-hidden="true" className="size-4" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onOpen(task)}><Check aria-hidden="true" />Ver detalhes</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onReopen(task)}><RotateCcw aria-hidden="true" />Reabrir tarefa</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}><Trash2 aria-hidden="true" />Excluir tarefa</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </article>;
}
