"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleHelp, LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { todoTaskAction } from "@/features/todo/actions";
import { TodoCompletedProductivityChart } from "@/features/todo/components/todo-completed-productivity-chart";
import { TodoCompletedTaskRow } from "@/features/todo/components/todo-completed-task-row";
import { TodoTaskDetailsSheet } from "@/features/todo/components/todo-task-details-sheet";
import { TodoTaskFormDialog } from "@/features/todo/components/todo-task-form-dialog";
import { calculateTodoCompletedMetrics, filterCompletedTasks, formatCompletedGroupLabel, getTodoCompletedRange, groupCompletedTasks, type TodoCompletedPeriod } from "@/features/todo/domain/completed-tasks";
import { localDateKey } from "@/features/todo/domain/dashboard";
import { useTodoDashboardData } from "@/features/todo/hooks/todo-dashboard-context";
import type { TodoTask } from "@/features/todo/domain/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const periods: { value: TodoCompletedPeriod; label: string }[] = [
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "all", label: "Todo o período" },
];

function CompletedTasksSkeleton() {
  return <main className="mx-auto grid w-full max-w-[110rem] gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,.8fr)] xl:p-7"><div className="space-y-5"><div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-72" /><Skeleton className="h-4 w-56" /></div><Skeleton className="h-24" /><Skeleton className="h-64" /></div><div className="space-y-5"><Skeleton className="h-80" /><Skeleton className="h-48" /></div></main>;
}

function formatCompletedAt(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function TodoCompletedTasksPage() {
  const { lists, tasks, workspaces, loading, refreshing, error, refreshAll } = useTodoDashboardData();
  const [today, setToday] = useState<string | null>(null);
  const [period, setPeriod] = useState<TodoCompletedPeriod>("week");
  const [listId, setListId] = useState("all");
  const [workspaceId, setWorkspaceId] = useState("all");
  const [savingTaskIds, setSavingTaskIds] = useState<Set<string>>(() => new Set());
  const [optimisticTasks, setOptimisticTasks] = useState<Map<string, TodoTask>>(() => new Map());
  const [optimisticallyDeleted, setOptimisticallyDeleted] = useState<Set<string>>(() => new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TodoTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setToday(localDateKey(new Date())));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const visibleTasks = useMemo(() => tasks
    .filter((task) => !optimisticallyDeleted.has(task.id))
    .map((task) => optimisticTasks.get(task.id) ?? task), [tasks, optimisticTasks, optimisticallyDeleted]);
  const scopedTasks = useMemo(() => visibleTasks.filter((task) =>
    (listId === "all" || task.list_id === listId)
    && (workspaceId === "all" || task.workspace_id === workspaceId),
  ), [visibleTasks, listId, workspaceId]);
  const range = useMemo(() => today ? getTodoCompletedRange(scopedTasks, today, period) : null, [scopedTasks, today, period]);
  const completedTasks = useMemo(() => range ? filterCompletedTasks(scopedTasks, range, { listId: "all", workspaceId: "all" }) : [], [scopedTasks, range]);
  const groups = useMemo(() => groupCompletedTasks(completedTasks), [completedTasks]);
  const metrics = useMemo(() => range ? calculateTodoCompletedMetrics(scopedTasks, completedTasks, range, lists, period === "all") : null, [scopedTasks, completedTasks, range, lists, period]);
  const activeTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? null;
  const activeList = lists.find((list) => list.id === activeTask?.list_id);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeTask?.workspace_id);
  const listSummaries = metrics?.byList ?? [];
  const maxListCount = Math.max(0, ...listSummaries.map((item) => item.count));

  async function reopenTask(task: TodoTask) {
    if (savingTaskIds.has(task.id)) return;
    setSavingTaskIds((current) => new Set(current).add(task.id));
    setOptimisticTasks((current) => new Map(current).set(task.id, { ...task, status: "todo", completed_at: null }));
    try {
      const result = await todoTaskAction({ operation: "update", id: task.id, status: "todo" });
      if (!result.ok) {
        setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
        toast.error(result.message);
        return;
      }
      setSelectedTaskId((current) => current === task.id ? null : current);
      toast.success("Tarefa reaberta. Ela voltou para suas tarefas pendentes.");
      await refreshAll();
      setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
    } catch {
      setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
      toast.error("Não foi possível reabrir a tarefa. Tente novamente.");
    } finally {
      setSavingTaskIds((current) => { const next = new Set(current); next.delete(task.id); return next; });
    }
  }

  async function deleteTask() {
    if (!deleteTarget || deleting) return;
    const target = deleteTarget;
    setDeleting(true);
    setOptimisticallyDeleted((current) => new Set(current).add(target.id));
    try {
      const result = await todoTaskAction({ operation: "soft_delete", id: target.id });
      if (!result.ok) {
        setOptimisticallyDeleted((current) => { const next = new Set(current); next.delete(target.id); return next; });
        toast.error(result.message);
        return;
      }
      setSelectedTaskId((current) => current === target.id ? null : current);
      setDeleteTarget(null);
      toast.success("Tarefa excluída.");
      await refreshAll();
    } catch {
      setOptimisticallyDeleted((current) => { const next = new Set(current); next.delete(target.id); return next; });
      toast.error("Não foi possível excluir a tarefa. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading || !today || !metrics) return <CompletedTasksSkeleton />;
  if (error) return <main className="mx-auto w-full max-w-3xl p-4 pt-10 sm:p-8"><Alert variant="destructive"><AlertTitle>Não foi possível carregar seu histórico</AlertTitle><AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-3">{error}<Button variant="outline" size="sm" disabled={refreshing} onClick={() => void refreshAll()}><RefreshCw className={cn("size-4", refreshing && "animate-spin")} />Tentar novamente</Button></AlertDescription></Alert></main>;

  const periodLabel = periods.find((item) => item.value === period)?.label ?? "Este período";
  const chartIsLimited = period === "all" && range !== null && metrics.daily.length === 30 && metrics.daily[0]?.date !== range.from;
  const hasAnyCompletedTask = visibleTasks.some((task) => task.status === "done" && task.completed_at !== null);
  const rateBasisLabel = `${metrics.denominator} ${metrics.denominator === 1 ? "tarefa prevista ou concluída" : "tarefas previstas ou concluídas"}`;
  const selectedTaskList = (task: TodoTask) => lists.find((list) => list.id === task.list_id);
  const selectedTaskWorkspace = (task: TodoTask) => workspaces.find((workspace) => workspace.id === task.workspace_id);

  return <>
    <main className="mx-auto grid w-full max-w-[110rem] gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,.8fr)] xl:p-7">
      <section className="min-w-0 space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Tarefas / Concluídas</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Tarefas concluídas</h1><p className="mt-2 text-sm text-muted-foreground">Tudo o que você já realizou.</p></div>
          <div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Atualizar histórico" title="Atualizar" disabled={refreshing} onClick={() => void refreshAll()}><RefreshCw className={cn("size-4", refreshing && "animate-spin")} /></Button><Button onClick={() => setFormOpen(true)}><Plus aria-hidden="true" />Nova tarefa</Button></div>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={period} onValueChange={(value) => { if (value === "week" || value === "month" || value === "all") setPeriod(value); }}>
            <TabsList className="grid h-9 w-full grid-cols-3 sm:w-auto"><TabsTrigger value="week">Esta semana</TabsTrigger><TabsTrigger value="month">Este mês</TabsTrigger><TabsTrigger value="all">Todo o período</TabsTrigger></TabsList>
          </Tabs>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select items={[{ value: "all", label: "Todas as listas" }, ...lists.map((list) => ({ value: list.id, label: list.name }))]} value={listId} onValueChange={(value) => value && setListId(value)}><SelectTrigger aria-label="Filtrar por lista" className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent>{[{ value: "all", label: "Todas as listas" }, ...lists.map((list) => ({ value: list.id, label: list.name }))].map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
            <Select items={[{ value: "all", label: "Todos os workspaces" }, ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))]} value={workspaceId} onValueChange={(value) => value && setWorkspaceId(value)}><SelectTrigger aria-label="Filtrar por workspace" className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent>{[{ value: "all", label: "Todos os workspaces" }, ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))].map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="shadow-none"><CardHeader className="space-y-1 p-4 pb-2"><CardDescription>Concluídas no período</CardDescription><CardTitle className="text-3xl tabular-nums">{metrics.completed}</CardTitle></CardHeader><CardContent className="p-4 pt-0 text-xs text-muted-foreground">{periodLabel}</CardContent></Card>
          <Card className="shadow-none"><CardHeader className="space-y-1 p-4 pb-2"><CardDescription>Taxa de conclusão</CardDescription><CardTitle className="text-3xl tabular-nums">{metrics.completionRate === null ? "—" : `${metrics.completionRate}%`}</CardTitle></CardHeader><CardContent className="space-y-2 p-4 pt-0"><p className="text-xs text-muted-foreground">{metrics.completionRate === null ? "Sem tarefas planejadas ou concluídas neste período." : `${metrics.completed} ${metrics.completed === 1 ? "concluída" : "concluídas"} entre ${rateBasisLabel}.`}</p>{metrics.completionRate !== null ? <Progress value={metrics.completionRate} aria-label={`Taxa de conclusão: ${metrics.completionRate}%`} /> : null}</CardContent></Card>
        </div>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-3"><div><CardTitle className="text-base">Histórico de conclusões</CardTitle><CardDescription className="mt-1">Agrupado pelo momento em que cada tarefa foi concluída.</CardDescription></div><Badge variant="secondary" className="shrink-0">{completedTasks.length} {completedTasks.length === 1 ? "tarefa" : "tarefas"}</Badge></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            {groups.length ? <div className="space-y-3">{groups.map((group) => <section key={group.date} className="overflow-hidden rounded-xl border" aria-label={formatCompletedGroupLabel(group.date, today)}><header className="flex items-center justify-between gap-2 bg-muted/30 px-3 py-3 sm:px-4"><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{formatCompletedGroupLabel(group.date, today)}</h2><p className="mt-0.5 text-xs text-muted-foreground">Última conclusão às {formatCompletedAt(group.tasks[0]?.completed_at ?? `${group.date}T12:00:00`)}</p></div><Badge variant="secondary">{group.tasks.length}</Badge></header><div className="divide-y">{group.tasks.map((task) => <TodoCompletedTaskRow key={task.id} task={task} list={selectedTaskList(task)} workspace={selectedTaskWorkspace(task)} saving={savingTaskIds.has(task.id)} onOpen={(item) => setSelectedTaskId(item.id)} onReopen={(item) => void reopenTask(item)} onDelete={setDeleteTarget} />)}</div></section>)}</div> : <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed px-5 py-9 text-center"><span className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 aria-hidden="true" className="size-5" /></span><h2 className="mt-4 text-base font-semibold">{hasAnyCompletedTask ? "Nenhuma conclusão neste período" : "Nenhuma tarefa concluída ainda"}</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{hasAnyCompletedTask ? "Altere o período, a lista ou o workspace para consultar outras conclusões." : "Quando você concluir uma tarefa, ela aparecerá aqui com a data e o horário registrados."}</p></div>}
          </CardContent>
        </Card>
      </section>

      <aside className="min-w-0 space-y-5">
        <TodoCompletedProductivityChart data={metrics.daily} enoughData={metrics.denominator > 0} title="Evolução diária das tarefas" description={chartIsLimited ? "Últimos 30 dias · tarefas concluídas e planejadas" : `${periodLabel} · tarefas concluídas e planejadas`} />

        <Card className="shadow-none"><CardHeader className="p-4 pb-3"><CardTitle className="text-base">Listas mais concluídas</CardTitle><CardDescription>Conclusões neste período por lista.</CardDescription></CardHeader><CardContent className="space-y-4 p-4 pt-0">{listSummaries.length ? listSummaries.map((item) => <div key={item.id} className="space-y-1.5"><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium">{item.name}</span><span className="tabular-nums text-muted-foreground">{item.count}</span></div><Progress value={maxListCount ? item.count / maxListCount * 100 : 0} aria-label={`${item.name}: ${item.count} tarefas concluídas`} className="h-2" /></div>) : <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">As listas aparecerão aqui quando houver conclusões no período.</p>}</CardContent></Card>

        <Card className="border-primary/20 bg-primary/5 shadow-none"><CardContent className="flex items-start gap-3 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-primary"><CircleHelp aria-hidden="true" className="size-4" /></span><div><p className="text-sm font-semibold">Seu histórico permanece organizado</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">A taxa compara tarefas concluídas no período com tarefas previstas ou concluídas nele. Reabrir uma tarefa a remove deste histórico e registra a alteração.</p></div></CardContent></Card>
      </aside>
    </main>

    <TodoTaskDetailsSheet task={activeTask} list={activeList} workspace={activeWorkspace} lists={lists} workspaces={workspaces} onSelectTask={setSelectedTaskId} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }} onSaved={refreshAll} />
    <TodoTaskFormDialog open={formOpen} onOpenChange={setFormOpen} lists={lists} workspaces={workspaces} initialDate={today} onCreated={refreshAll} />
    <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir esta tarefa?</AlertDialogTitle><AlertDialogDescription>A tarefa será removida das suas listas. O histórico de atividade é preservado conforme as regras do To-Do.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleting} onClick={(event) => { event.preventDefault(); void deleteTask(); }}>{deleting ? <><LoaderCircle className="size-4 animate-spin" />Excluindo…</> : <><Trash2 className="size-4" />Excluir tarefa</>}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
