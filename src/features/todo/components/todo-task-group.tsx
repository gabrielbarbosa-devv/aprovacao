import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TodoTaskRow } from "@/features/todo/components/todo-task-row";
import type { TodoList, TodoTask } from "@/features/todo/domain/types";

export function TodoTaskGroup({ title, description, tasks, lists, overdue = false, savingTaskIds, onToggle, onOpen, onPriority, onMove, onDelete }: {
  title: string;
  description?: string;
  tasks: TodoTask[];
  lists: TodoList[];
  overdue?: boolean;
  savingTaskIds: Set<string>;
  onToggle: (task: TodoTask, completed: boolean) => void;
  onOpen: (task: TodoTask) => void;
  onPriority: (task: TodoTask, priority: TodoTask["priority"]) => void;
  onMove: (task: TodoTask, listId: string) => void;
  onDelete: (task: TodoTask) => void;
}) {
  const titleTone = overdue ? "text-destructive" : "text-foreground";
  return <section className="overflow-hidden rounded-xl border" aria-label={title}>
    <header className="flex items-center gap-2 bg-muted/30 px-3 py-3 sm:px-4">{overdue ? <ChevronDown aria-hidden="true" className="size-4 text-destructive" /> : <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />}<div className="min-w-0 flex-1"><h2 className={`text-sm font-semibold ${titleTone}`}>{title}</h2>{description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}</div><Badge variant="secondary">{tasks.length}</Badge></header>
    {tasks.length ? <div className="divide-y">{tasks.map((task) => <TodoTaskRow key={task.id} task={task} lists={lists} overdue={overdue} saving={savingTaskIds.has(task.id)} onToggle={onToggle} onOpen={onOpen} onPriority={onPriority} onMove={onMove} onDelete={onDelete} />)}</div> : <p className="px-4 py-5 text-sm text-muted-foreground">Nenhuma tarefa nesta seção.</p>}
  </section>;
}
