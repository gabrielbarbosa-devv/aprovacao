"use client";

import { Archive, CalendarDays, Check, Clock3, Ellipsis, ListTodo, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { TodoList, TodoTask } from "@/features/todo/domain/types";
import { localDateFromKey, taskDueDateKey } from "@/features/todo/domain/dashboard";
import { cn } from "@/lib/utils";

function dateLabel(dateKey: string | null): string {
  if (!dateKey) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(localDateFromKey(dateKey));
}

function timeLabel(task: TodoTask): string | null {
  return task.due_at ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(task.due_at)) : null;
}

const priorityOptions = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
] as const;

export function TodoTaskRow({ task, lists, overdue = false, saving, onToggle, onOpen, onPriority, onMove, onDelete }: {
  task: TodoTask;
  lists: TodoList[];
  overdue?: boolean;
  saving: boolean;
  onToggle: (task: TodoTask, completed: boolean) => void;
  onOpen: (task: TodoTask) => void;
  onPriority: (task: TodoTask, priority: TodoTask["priority"]) => void;
  onMove: (task: TodoTask, listId: string) => void;
  onDelete: (task: TodoTask) => void;
}) {
  const currentList = lists.find((list) => list.id === task.list_id);
  const dueDate = taskDueDateKey(task);
  const time = timeLabel(task);

  return <article className="group flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4">
    <Checkbox checked={task.status === "done"} disabled={saving} aria-label={task.status === "done" ? `Reabrir ${task.title}` : `Concluir ${task.title}`} onCheckedChange={(checked) => onToggle(task, checked === true)} />
    <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className={cn("block break-words text-sm font-medium", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</span>
      <span className="mt-1 block break-words text-xs text-muted-foreground">{task.description?.trim() || "Sem descrição"}</span>
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "secondary" : "outline"} className="text-[10px]">{priorityOptions.find((item) => item.value === task.priority)?.label}</Badge>
        {currentList ? <Badge variant="outline" className="max-w-32 truncate text-[10px]"><ListTodo aria-hidden="true" />{currentList.name}</Badge> : null}
        <span className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground", overdue && "text-destructive")}><CalendarDays aria-hidden="true" className="size-3" />{dateLabel(dueDate)}{time ? <><span aria-hidden="true">·</span><Clock3 aria-hidden="true" className="size-3" />{time}</> : null}</span>
      </span>
    </button>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Ações para ${task.title}`} disabled={saving} className="size-8 shrink-0 opacity-100 sm:opacity-70 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" />}><Ellipsis className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => onOpen(task)}>Abrir detalhes</DropdownMenuItem>
        <DropdownMenuSub><DropdownMenuSubTrigger><Check aria-hidden="true" />Prioridade</DropdownMenuSubTrigger><DropdownMenuSubContent>{priorityOptions.map((item) => <DropdownMenuItem key={item.value} disabled={task.priority === item.value || saving} onClick={() => onPriority(task, item.value)}>{task.priority === item.value ? <Check aria-hidden="true" /> : null}{item.label}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
        <DropdownMenuSub><DropdownMenuSubTrigger><ListTodo aria-hidden="true" />Mover para lista</DropdownMenuSubTrigger><DropdownMenuSubContent>{lists.map((list) => <DropdownMenuItem key={list.id} disabled={list.id === task.list_id || saving} onClick={() => onMove(task, list.id)}>{list.id === task.list_id ? <Check aria-hidden="true" /> : null}{list.name}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
        <DropdownMenuItem onClick={() => onDelete(task)}><Archive aria-hidden="true" />Arquivar…</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(task)}><Trash2 aria-hidden="true" />Mover para a lixeira…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </article>;
}
