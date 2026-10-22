"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, Ellipsis, ListFilter, LoaderCircle, Search, SquareCheckBig } from "lucide-react";
import { toast } from "sonner";
import { todoTaskAction } from "@/features/todo/actions";
import { TodoTaskDetailsSheet } from "@/features/todo/components/todo-task-details-sheet";
import { getTasksForDay, groupTodoTasksForDay, localDateFromKey, localDateKey, taskDueDateKey } from "@/features/todo/domain/dashboard";
import { useTodoDashboardData } from "@/features/todo/hooks/todo-dashboard-context";
import type { TodoTask } from "@/features/todo/domain/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const priorities = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
] as const;

function longDate(dateKey: string): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(localDateFromKey(dateKey));
}

function timeFor(task: TodoTask): string | null {
  return task.due_at ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(task.due_at)) : null;
}

function orderTasks(tasks: TodoTask[]): TodoTask[] {
  return [...tasks].sort((left, right) => {
    const timeOrder = (timeFor(left) ?? "99:99").localeCompare(timeFor(right) ?? "99:99");
    return timeOrder || left.position - right.position || left.created_at.localeCompare(right.created_at);
  });
}

function TodaySkeleton() {
  return <main className="mx-auto grid w-full max-w-[110rem] gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:p-7"><section className="space-y-5"><Skeleton className="h-28" /><Skeleton className="h-12" /><Skeleton className="h-[30rem]" /></section><aside><Skeleton className="h-[30rem]" /></aside></main>;
}

export function TodoTodayPage() {
  const { lists, tasks, workspaces, loading, refreshing, error, refreshAll } = useTodoDashboardData();
  const [today, setToday] = useState<string | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [savingTaskIds, setSavingTaskIds] = useState<Set<string>>(() => new Set());
  const [optimisticTasks, setOptimisticTasks] = useState<Map<string, TodoTask>>(() => new Map());

  useEffect(() => {
    const now = new Date();
    const todayKey = localDateKey(now);
    const frame = window.requestAnimationFrame(() => {
      setToday(todayKey);
      setSelectedDate(todayKey);
      setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const visibleTasks = useMemo(() => tasks.map((task) => optimisticTasks.get(task.id) ?? task), [tasks, optimisticTasks]);
  const dayKey = selectedDate ?? today;
  const allDayTasks = useMemo(() => dayKey ? [
    ...getTasksForDay(visibleTasks, dayKey),
    ...visibleTasks.filter((task) => task.status === "done" && (
      (task.completed_at !== null && localDateKey(new Date(task.completed_at)) === dayKey)
      || task.starts_on === dayKey
      || task.due_on === dayKey
      || (task.due_at !== null && localDateKey(new Date(task.due_at)) === dayKey)
    )),
  ] : [], [visibleTasks, dayKey]);
  const dayTasks = useMemo(() => allDayTasks.filter((task) => selectedListId === null || task.list_id === selectedListId), [allDayTasks, selectedListId]);
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const searchedTasks = useMemo(() => query ? dayTasks.filter((task) =>
    task.title.toLocaleLowerCase("pt-BR").includes(query)
    || (task.description ?? "").toLocaleLowerCase("pt-BR").includes(query)
    || (lists.find((list) => list.id === task.list_id)?.name ?? "").toLocaleLowerCase("pt-BR").includes(query),
  ) : dayTasks, [dayTasks, lists, query]);
  const groups = dayKey ? groupTodoTasksForDay(searchedTasks, dayKey) : { overdue: [], highPriority: [], other: [], completed: [] };
  const summaryGroups = dayKey ? groupTodoTasksForDay(dayTasks, dayKey) : { overdue: [], highPriority: [], other: [], completed: [] };
  const pendingCount = summaryGroups.overdue.length + summaryGroups.highPriority.length + summaryGroups.other.length;
  const completedCount = summaryGroups.completed.length;
  const dayTotal = pendingCount + completedCount;
  const progress = dayTotal ? Math.round((completedCount / dayTotal) * 100) : 0;
  const activeTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? null;
  const activeList = lists.find((list) => list.id === activeTask?.list_id);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeTask?.workspace_id);
  const timedTasks = useMemo(() => dayKey ? orderTasks(visibleTasks.filter((task) => task.status !== "done" && task.due_at && localDateKey(new Date(task.due_at)) === dayKey)) : [], [visibleTasks, dayKey]);
  const calendarDates = useMemo(() => {
    if (!month) return [];
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(monthStart);
    start.setDate(1 - ((start.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);

  async function updateTask(task: TodoTask, changes: { status?: "todo" | "in_progress" | "done"; priority?: "low" | "medium" | "high" }) {
    if (savingTaskIds.has(task.id)) return;
    const optimistic: TodoTask = {
      ...task,
      ...changes,
      completed_at: changes.status === "done" ? new Date().toISOString() : changes.status ? null : task.completed_at,
    };
    setSavingTaskIds((current) => new Set(current).add(task.id));
    setOptimisticTasks((current) => new Map(current).set(task.id, optimistic));
    try {
      const result = await todoTaskAction({ operation: "update", id: task.id, ...changes });
      if (!result.ok) {
        setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
        toast.error(result.message);
        return;
      }
      toast.success(changes.status === "done" ? "Tarefa concluída." : changes.status ? "Tarefa reaberta." : "Prioridade atualizada.");
      await refreshAll();
      setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
    } catch {
      setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
      toast.error("Não foi possível atualizar a tarefa. Tente novamente.");
    } finally {
      setSavingTaskIds((current) => { const next = new Set(current); next.delete(task.id); return next; });
    }
  }

  if (loading || !today || !month || !dayKey) return <TodaySkeleton />;
  if (error) return <main className="mx-auto w-full max-w-3xl p-4 pt-10 sm:p-8"><Alert variant="destructive"><AlertTitle>Não foi possível carregar suas tarefas</AlertTitle><AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-3">{error}<Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={refreshing}>Tentar novamente</Button></AlertDescription></Alert></main>;

  const greeting = new Date().getHours() < 12 ? "Um passo de cada vez. Foque no que importa." : new Date().getHours() < 18 ? "Siga no seu ritmo. Foque no que importa." : "Faça o que for possível hoje. O progresso continua.";
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month);

  return <>
    <main className="mx-auto grid w-full max-w-[110rem] min-w-0 gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-6 xl:p-7">
      <section className="min-w-0 space-y-5">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Hoje</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{dayKey === today ? "Hoje" : "Tarefas do dia"}, {new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(localDateFromKey(dayKey))}</h1><p className="mt-2 text-sm text-muted-foreground">{greeting}</p></div>
          <Card className="w-full max-w-xs shadow-none"><CardContent className="flex items-center gap-3 p-3"><div className="grid size-12 shrink-0 place-items-center rounded-full border-4 border-primary/20 text-sm font-semibold tabular-nums"><span>{completedCount}/{dayTotal}</span></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{completedCount} de {dayTotal} tarefas concluídas</p><Progress className="mt-2" value={progress} aria-label={`Progresso do dia: ${progress}%`} /><p className="mt-1 text-right text-xs text-muted-foreground">{progress}%</p></div></CardContent></Card>
        </header>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="Filtrar por lista">
            <Button size="sm" variant={selectedListId === null ? "default" : "outline"} onClick={() => setSelectedListId(null)}>Todas <Badge variant={selectedListId === null ? "secondary" : "outline"} className="ml-1 h-5 px-1.5">{allDayTasks.length}</Badge></Button>
            {lists.map((list) => <Button key={list.id} size="sm" variant={selectedListId === list.id ? "default" : "outline"} onClick={() => setSelectedListId(list.id)} className="max-w-40"><span className="truncate">{list.name}</span><Badge variant={selectedListId === list.id ? "secondary" : "outline"} className="ml-1 h-5 px-1.5">{allDayTasks.filter((task) => task.list_id === list.id).length}</Badge></Button>)}
          </div>
          <div className="flex min-w-0 gap-2"><div className="relative min-w-0 flex-1 lg:w-56 lg:flex-none"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefas" aria-label="Buscar tarefas do dia" className="pl-9" /></div><Button variant="outline" size="icon" aria-label="Atualizar tarefas" title="Atualizar" disabled={refreshing} onClick={() => void refreshAll()}><LoaderCircle className={cn("size-4", refreshing && "animate-spin")} /></Button></div>
        </div>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-3 sm:px-5"><div><CardTitle className="text-base">Tarefas do dia</CardTitle><CardDescription className="mt-1">Atrasos e atividades previstas para {dayKey === today ? "hoje" : longDate(dayKey)}.</CardDescription></div><Badge variant="secondary" className="shrink-0">{pendingCount} pendentes</Badge></CardHeader>
          <CardContent className="space-y-5 px-4 pb-4 sm:px-5">
            <TaskGroup title="Atrasadas" tasks={groups.overdue} variant="overdue" lists={lists} savingTaskIds={savingTaskIds} onToggle={(task) => void updateTask(task, { status: task.status === "done" ? "todo" : "done" })} onPriority={(task, priority) => void updateTask(task, { priority })} onOpen={setSelectedTaskId} />
            <TaskGroup title="Prioridade alta" tasks={groups.highPriority} variant="high" lists={lists} savingTaskIds={savingTaskIds} onToggle={(task) => void updateTask(task, { status: task.status === "done" ? "todo" : "done" })} onPriority={(task, priority) => void updateTask(task, { priority })} onOpen={setSelectedTaskId} />
            <TaskGroup title="Outras tarefas" tasks={groups.other} variant="other" lists={lists} savingTaskIds={savingTaskIds} onToggle={(task) => void updateTask(task, { status: task.status === "done" ? "todo" : "done" })} onPriority={(task, priority) => void updateTask(task, { priority })} onOpen={setSelectedTaskId} />
            <TaskGroup title="Concluídas" tasks={groups.completed} variant="done" lists={lists} savingTaskIds={savingTaskIds} onToggle={(task) => void updateTask(task, { status: "todo" })} onPriority={(task, priority) => void updateTask(task, { priority })} onOpen={setSelectedTaskId} />
            {dayTotal === 0 ? <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center"><span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground"><SquareCheckBig className="size-5" /></span><h2 className="mt-3 text-sm font-semibold">Nenhuma tarefa exige atenção nesta data</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">Tarefas com vencimento ou início em outra data continuam fora desta lista.</p></div> : null}
          </CardContent>
        </Card>
      </section>

      <aside className="min-w-0 space-y-5">
        <Card className="shadow-none">
          <CardHeader className="space-y-3 p-4 pb-2"><div className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" aria-hidden="true" /><div><CardTitle className="text-base">Resumo do dia</CardTitle><CardDescription className="mt-1">Tarefas registradas no To-Do</CardDescription></div></div><div className="flex items-center justify-between"><Button variant="ghost" size="icon" className="size-8" aria-label="Mês anterior" onClick={() => setMonth((current) => current ? new Date(current.getFullYear(), current.getMonth() - 1, 1) : current)}><ChevronLeft className="size-4" /></Button><p className="text-sm font-semibold capitalize">{monthLabel}</p><Button variant="ghost" size="icon" className="size-8" aria-label="Próximo mês" onClick={() => setMonth((current) => current ? new Date(current.getFullYear(), current.getMonth() + 1, 1) : current)}><ChevronRight className="size-4" /></Button></div></CardHeader>
          <CardContent className="p-4 pt-1"><div className="grid grid-cols-7 gap-1 text-center">{weekdays.map((day) => <span key={day} className="py-1 text-[10px] font-medium text-muted-foreground">{day}</span>)}{calendarDates.map((date) => { const key = localDateKey(date); const hasTasks = getTasksForDay(visibleTasks, key).length > 0 || visibleTasks.some((task) => task.status === "done" && (task.completed_at ? localDateKey(new Date(task.completed_at)) === key : taskDueDateKey(task) === key)); const selected = key === dayKey; const isToday = key === today; return <button key={key} type="button" aria-label={`${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(date)}${hasTasks ? ", há tarefas" : ""}`} aria-pressed={selected} onClick={() => setSelectedDate(key)} className={cn("relative mx-auto grid size-8 place-items-center rounded-lg text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", date.getMonth() !== month.getMonth() && "text-muted-foreground/40", selected && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90", isToday && !selected && "text-primary ring-1 ring-primary")}>{date.getDate()}{hasTasks && !selected ? <span className="absolute bottom-1 size-1 rounded-full bg-primary" /> : null}</button>; })}</div></CardContent>
        </Card>

        <Card className="shadow-none"><CardHeader className="p-4 pb-3"><CardTitle className="text-base">Progresso do dia</CardTitle><CardDescription>{longDate(dayKey)}</CardDescription></CardHeader><CardContent className="space-y-3 p-4 pt-0"><div className="flex items-baseline justify-between"><span className="text-2xl font-bold tabular-nums">{progress}%</span><span className="text-sm text-muted-foreground">{completedCount} concluídas · {pendingCount} pendentes</span></div><Progress value={progress} aria-label={`Tarefas concluídas: ${progress}%`} /><p className="text-xs text-muted-foreground">{dayTotal} {dayTotal === 1 ? "tarefa considerada" : "tarefas consideradas"} nesta data</p></CardContent></Card>

        <Card className="shadow-none"><CardHeader className="p-4 pb-3"><div className="flex items-center gap-2"><Clock3 className="size-4 text-muted-foreground" aria-hidden="true" /><div><CardTitle className="text-base">Agenda</CardTitle><CardDescription>{longDate(dayKey)}</CardDescription></div></div></CardHeader><CardContent className="p-4 pt-0">{timedTasks.length ? <ol className="space-y-1">{timedTasks.map((task) => <li key={task.id}><button type="button" onClick={() => setSelectedTaskId(task.id)} className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="w-11 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground">{timeFor(task)}</span><span className={cn("mt-1 size-2 shrink-0 rounded-full", task.priority === "high" ? "bg-destructive" : "bg-primary")} aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{task.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{lists.find((list) => list.id === task.list_id)?.name ?? "Lista"}</span></span></button></li>)}</ol> : <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Nenhuma tarefa com horário definido nesta data.</p>}</CardContent></Card>
      </aside>
    </main>
    <TodoTaskDetailsSheet task={activeTask} list={activeList} workspace={activeWorkspace} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }} onToggleComplete={(task) => updateTask(task, { status: task.status === "done" ? "todo" : "done" })} saving={activeTask ? savingTaskIds.has(activeTask.id) : false} />
  </>;
}

function TaskGroup({ title, tasks, variant, lists, savingTaskIds, onToggle, onPriority, onOpen }: {
  title: string;
  tasks: TodoTask[];
  variant: "overdue" | "high" | "other" | "done";
  lists: ReturnType<typeof useTodoDashboardData>["lists"];
  savingTaskIds: Set<string>;
  onToggle: (task: TodoTask) => void;
  onPriority: (task: TodoTask, priority: "low" | "medium" | "high") => void;
  onOpen: (taskId: string) => void;
}) {
  if (!tasks.length) return null;
  const headingTone = variant === "overdue" ? "text-destructive" : variant === "high" ? "text-amber-700 dark:text-amber-400" : variant === "done" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground";
  const sorted = orderTasks(tasks);
  return <section aria-label={title} className="space-y-2"><div className="flex items-center justify-between gap-2"><h2 className={cn("text-sm font-semibold", headingTone)}>{title}</h2><Badge variant="secondary" className="h-5 min-w-6 justify-center px-1.5 text-[10px]">{tasks.length}</Badge></div><ul className="divide-y rounded-xl border">{sorted.map((task) => {
    const list = lists.find((item) => item.id === task.list_id);
    const dueDate = taskDueDateKey(task);
    const overdue = variant === "overdue";
    return <li key={task.id} className="flex min-w-0 items-center gap-2 px-2 py-3 sm:gap-3 sm:px-3"><Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" aria-label={task.status === "done" ? `Reabrir ${task.title}` : `Concluir ${task.title}`} aria-pressed={task.status === "done"} disabled={savingTaskIds.has(task.id)} onClick={() => onToggle(task)}>{savingTaskIds.has(task.id) ? <LoaderCircle className="size-4 animate-spin" /> : task.status === "done" ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5 text-muted-foreground" />}</Button><button type="button" onClick={() => onOpen(task.id)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={cn("block break-words text-sm font-medium", variant === "done" && "text-muted-foreground line-through")}>{task.title}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{task.description?.trim() || "Sem descrição"}</span><span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground"><span>{list?.name ?? "Lista indisponível"}</span>{timeFor(task) ? <span className="inline-flex items-center gap-1"><Clock3 className="size-3" aria-hidden="true" />{timeFor(task)}</span> : null}{overdue && dueDate ? <span className="text-destructive">Prazo {new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(localDateFromKey(dueDate))}</span> : null}</span></button><Badge variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "secondary" : "outline"} className="hidden shrink-0 sm:inline-flex">{priorities.find((priority) => priority.value === task.priority)?.label}</Badge><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Ações para ${task.title}`} />}><Ellipsis className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onOpen(task.id)}>Abrir detalhes</DropdownMenuItem><DropdownMenuSub><DropdownMenuSubTrigger><ListFilter aria-hidden="true" />Alterar prioridade</DropdownMenuSubTrigger><DropdownMenuSubContent>{priorities.map((priority) => <DropdownMenuItem key={priority.value} disabled={task.priority === priority.value || savingTaskIds.has(task.id)} onClick={() => onPriority(task, priority.value)}>{task.priority === priority.value ? <Check aria-hidden="true" /> : null}{priority.label}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub></DropdownMenuContent></DropdownMenu></li>;
  })}</ul></section>;
}
