"use client";

import { useEffect, useMemo, useState } from "react";
import { ListTodo, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { todoTaskAction } from "@/features/todo/actions";
import { TodoTaskDetailsSheet } from "@/features/todo/components/todo-task-details-sheet";
import { TodoTaskFilters } from "@/features/todo/components/todo-task-filters";
import { TodoTaskFormDialog } from "@/features/todo/components/todo-task-form-dialog";
import { TodoTaskGroup } from "@/features/todo/components/todo-task-group";
import { TodoTaskLifecycleDialog, type TodoTaskLifecycleAction } from "@/features/todo/components/todo-task-lifecycle-dialog";
import { filterTodoTasks, groupTodoTasks, hasTodoTaskListFilters, type TodoTaskListFilters as Filters } from "@/features/todo/domain/task-list";
import { localDateKey } from "@/features/todo/domain/dashboard";
import { useTodoDashboardData } from "@/features/todo/hooks/todo-dashboard-context";
import type { TodoTask } from "@/features/todo/domain/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const defaultFilters: Filters = { query: "", status: "all", listId: "all", priority: "all", due: "all", dueDate: "", sort: "date" };
const pageSize = 40;

function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const status = params.get("status");
  const priority = params.get("priority");
  const due = params.get("due");
  const sort = params.get("sort");
  const requestedList = params.get("list");
  const requestedDate = params.get("date") ?? "";
  return {
    query: params.get("q") ?? "",
    status: status === "pending" || status === "completed" ? status : "all",
    listId: requestedList ?? "all",
    priority: priority === "high" || priority === "medium" || priority === "low" ? priority : "all",
    due: due === "overdue" || due === "this_week" || due === "upcoming" || due === "no_date" ? due : "all",
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : "",
    sort: sort === "priority" || sort === "created" ? sort : "date",
  };
}

function serializeFilters(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.listId !== "all") params.set("list", filters.listId);
  if (filters.priority !== "all") params.set("priority", filters.priority);
  if (filters.due !== "all") params.set("due", filters.due);
  if (filters.dueDate) params.set("date", filters.dueDate);
  if (filters.sort !== "date") params.set("sort", filters.sort);
  return params.toString();
}

function TasksSkeleton() {
  return <main className="mx-auto w-full max-w-[110rem] space-y-5 p-4 sm:p-6 xl:p-7"><div className="flex items-end justify-between gap-4"><div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-72" /><Skeleton className="h-4 w-80" /></div><Skeleton className="h-9 w-32" /></div><Skeleton className="h-32" /><Skeleton className="h-72" /></main>;
}

export function TodoAllTasksPage() {
  const { lists, tasks, workspaces, loading, refreshing, error, refreshAll } = useTodoDashboardData();
  const [today, setToday] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [filtersReady, setFiltersReady] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(pageSize);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TodoTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingTaskIds, setSavingTaskIds] = useState<Set<string>>(() => new Set());
  const [optimisticTasks, setOptimisticTasks] = useState<Map<string, TodoTask>>(() => new Map());
  const [optimisticallyDeleted, setOptimisticallyDeleted] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setToday(localDateKey(new Date()));
      setFilters(parseFilters(window.location.search));
      setFiltersReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    const nextSearch = serializeFilters(filters);
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) window.history.replaceState(null, "", nextUrl);
  }, [filters, filtersReady]);

  const visibleTasks = useMemo(() => tasks
    .filter((task) => !optimisticallyDeleted.has(task.id))
    .map((task) => optimisticTasks.get(task.id) ?? task), [tasks, optimisticTasks, optimisticallyDeleted]);

  const filteredTasks = useMemo(() => today ? filterTodoTasks(visibleTasks, filters, today) : [], [visibleTasks, filters, today]);
  const groups = useMemo(() => today ? groupTodoTasks(filteredTasks, today, filters.sort) : { overdue: [], thisWeek: [], upcoming: [], noDate: [], completed: [] }, [filteredTasks, today, filters.sort]);
  const counts = useMemo(() => ({
    all: visibleTasks.length,
    pending: visibleTasks.filter((task) => task.status !== "done").length,
    completed: visibleTasks.filter((task) => task.status === "done").length,
  }), [visibleTasks]);
  const activeTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? null;
  const activeList = lists.find((list) => list.id === activeTask?.list_id);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeTask?.workspace_id);
  const visibleGroups = useMemo(() => {
    const overdueCount = Math.min(groups.overdue.length, visibleLimit);
    const thisWeekCount = Math.min(groups.thisWeek.length, Math.max(visibleLimit - groups.overdue.length, 0));
    const upcomingCount = Math.min(groups.upcoming.length, Math.max(visibleLimit - groups.overdue.length - groups.thisWeek.length, 0));
    const noDateCount = Math.min(groups.noDate.length, Math.max(visibleLimit - groups.overdue.length - groups.thisWeek.length - groups.upcoming.length, 0));
    const completedCount = Math.min(groups.completed.length, Math.max(visibleLimit - groups.overdue.length - groups.thisWeek.length - groups.upcoming.length - groups.noDate.length, 0));
    return {
      overdue: groups.overdue.slice(0, overdueCount),
      thisWeek: groups.thisWeek.slice(0, thisWeekCount),
      upcoming: groups.upcoming.slice(0, upcomingCount),
      noDate: groups.noDate.slice(0, noDateCount),
      completed: groups.completed.slice(0, completedCount),
    };
  }, [groups, visibleLimit]);

  function changeFilters(changes: Partial<Filters>) {
    setVisibleLimit(pageSize);
    setFilters((current) => ({ ...current, ...changes }));
  }

  async function updateTask(task: TodoTask, changes: { status?: TodoTask["status"]; priority?: TodoTask["priority"]; listId?: string }) {
    if (savingTaskIds.has(task.id)) return;
    const optimistic: TodoTask = { ...task, ...("listId" in changes && changes.listId ? { list_id: changes.listId } : {}), ...("status" in changes && changes.status ? { status: changes.status, completed_at: changes.status === "done" ? new Date().toISOString() : null } : {}), ...(changes.priority ? { priority: changes.priority } : {}) };
    setSavingTaskIds((current) => new Set(current).add(task.id));
    setOptimisticTasks((current) => new Map(current).set(task.id, optimistic));
    const input = { operation: "update", id: task.id, ...(changes.status ? { status: changes.status } : {}), ...(changes.priority ? { priority: changes.priority } : {}), ...(changes.listId ? { listId: changes.listId } : {}) };
    try {
      const result = await todoTaskAction(input);
      if (!result.ok) {
        setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
        toast.error(result.message);
        return;
      }
      toast.success(changes.status === "done" ? "Tarefa concluída." : changes.status ? "Tarefa reaberta." : changes.priority ? "Prioridade atualizada." : "Tarefa movida para outra lista.");
      await refreshAll();
      setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
    } catch {
      setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
      toast.error("Não foi possível atualizar a tarefa. Tente novamente.");
    } finally {
      setSavingTaskIds((current) => { const next = new Set(current); next.delete(task.id); return next; });
    }
  }

  async function applyLifecycle(action: TodoTaskLifecycleAction): Promise<boolean> {
    if (!deleteTarget || deleting) return false;
    const target = deleteTarget;
    setDeleting(true);
    setOptimisticallyDeleted((current) => new Set(current).add(target.id));
    try {
      const result = await todoTaskAction({ operation: action, id: target.id });
      if (!result.ok) {
        setOptimisticallyDeleted((current) => { const next = new Set(current); next.delete(target.id); return next; });
        toast.error(result.message);
        return false;
      }
      toast.success(action === "archive" ? "Tarefa arquivada." : "Tarefa movida para a lixeira.");
      setSelectedTaskId((current) => current === target.id ? null : current);
      setDeleteTarget(null);
      try { await refreshAll(); } catch { toast.warning("A tarefa foi atualizada, mas a lista ainda não foi recarregada."); }
      return true;
    } catch {
      setOptimisticallyDeleted((current) => { const next = new Set(current); next.delete(target.id); return next; });
      toast.error(action === "archive" ? "Não foi possível arquivar a tarefa." : "Não foi possível mover a tarefa para a lixeira.");
      return false;
    } finally {
      setDeleting(false);
    }
  }

  if (loading || !today || !filtersReady) return <TasksSkeleton />;
  if (error) return <main className="mx-auto w-full max-w-3xl p-4 pt-10 sm:p-8"><Alert variant="destructive"><AlertTitle>Não foi possível carregar suas tarefas</AlertTitle><AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-3">{error}<Button variant="outline" size="sm" disabled={refreshing} onClick={() => void refreshAll()}><RefreshCw className={refreshing ? "animate-spin" : ""} />Tentar novamente</Button></AlertDescription></Alert></main>;

  const sections = [
    { key: "overdue", title: "Atrasadas", description: "Tarefas pendentes com prazo anterior a hoje.", tasks: visibleGroups.overdue, overdue: true },
    { key: "thisWeek", title: "Esta semana", description: "Prazos de hoje até o fim desta semana.", tasks: visibleGroups.thisWeek },
    { key: "upcoming", title: "Próximas", description: "Prazos posteriores a esta semana.", tasks: visibleGroups.upcoming },
    { key: "noDate", title: "Sem data", description: "Tarefas pendentes sem prazo definido.", tasks: visibleGroups.noDate },
    { key: "completed", title: "Concluídas", description: "Tarefas concluídas no seu To-Do.", tasks: visibleGroups.completed },
  ] as const;

  return <>
    <main className="mx-auto w-full max-w-[110rem] min-w-0 space-y-5 p-4 sm:p-6 xl:p-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Minhas tarefas</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Todas as tarefas</h1><p className="mt-2 text-sm text-muted-foreground">Tudo o que precisa fazer, em um só lugar.</p></div><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Atualizar tarefas" title="Atualizar" disabled={refreshing} onClick={() => void refreshAll()}><LoaderCircle className={refreshing ? "size-4 animate-spin" : "size-4"} /></Button><Button onClick={() => setFormOpen(true)}><Plus aria-hidden="true" />Nova tarefa</Button></div></header>

      <TodoTaskFilters filters={filters} lists={lists} counts={counts} onChange={changeFilters} onClear={() => changeFilters(defaultFilters)} />

      <div className="space-y-4">
        {sections.filter((section) => section.tasks.length > 0).map((section) => <TodoTaskGroup key={section.key} title={section.title} description={section.description} tasks={section.tasks} lists={lists} overdue={"overdue" in section && section.overdue} savingTaskIds={savingTaskIds} onToggle={(task, completed) => void updateTask(task, { status: completed ? "done" : "todo" })} onOpen={(task) => setSelectedTaskId(task.id)} onPriority={(task, priority) => void updateTask(task, { priority })} onMove={(task, listId) => void updateTask(task, { listId })} onDelete={setDeleteTarget} />)}
        {filteredTasks.length === 0 ? <Card className="shadow-none"><CardContent className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center"><span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground"><ListTodo className="size-5" /></span><h2 className="mt-4 text-base font-semibold">{visibleTasks.length === 0 ? "Você ainda não tem tarefas" : hasTodoTaskListFilters(filters) ? "Nenhuma tarefa encontrada" : "Tudo em dia"}</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{visibleTasks.length === 0 ? "Crie uma tarefa para começar a organizar suas atividades." : hasTodoTaskListFilters(filters) ? "Experimente mudar ou limpar os filtros." : "Suas tarefas aparecerão aqui quando forem cadastradas."}</p>{visibleTasks.length === 0 ? <Button className="mt-4" onClick={() => setFormOpen(true)}><Plus aria-hidden="true" />Nova tarefa</Button> : null}</CardContent></Card> : null}
      </div>

      {filteredTasks.length > visibleLimit ? <div className="flex justify-center"><Button variant="outline" onClick={() => setVisibleLimit((current) => current + pageSize)}>Carregar mais tarefas <Badge variant="secondary" className="ml-1">{filteredTasks.length - visibleLimit}</Badge></Button></div> : null}
    </main>

    <TodoTaskFormDialog open={formOpen} onOpenChange={setFormOpen} lists={lists} workspaces={workspaces} initialDate={today} onCreated={refreshAll} />
    <TodoTaskDetailsSheet task={activeTask} list={activeList} workspace={activeWorkspace} lists={lists} workspaces={workspaces} onSelectTask={setSelectedTaskId} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }} onSaved={refreshAll} />
    <TodoTaskLifecycleDialog open={deleteTarget !== null} taskTitle={deleteTarget?.title} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }} onConfirm={applyLifecycle} />
  </>;
}
