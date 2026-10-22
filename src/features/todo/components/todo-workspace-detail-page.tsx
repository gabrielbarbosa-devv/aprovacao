"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clock3, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { todoTaskAction, todoWorkspaceAction } from "@/features/todo/actions";
import { TodoTaskDetailsSheet } from "@/features/todo/components/todo-task-details-sheet";
import { TodoTaskFormDialog } from "@/features/todo/components/todo-task-form-dialog";
import { TodoWorkspaceDeleteDialog, type WorkspaceTaskPolicy } from "@/features/todo/components/todo-workspace-delete-dialog";
import { TodoWorkspaceFormDialog } from "@/features/todo/components/todo-workspace-form-dialog";
import { TodoWorkspaceIcon } from "@/features/todo/components/todo-workspace-icon";
import { localDateKey } from "@/features/todo/domain/dashboard";
import { summarizeWorkspaceTasks } from "@/features/todo/domain/workspaces";
import { useTodoDashboardData } from "@/features/todo/hooks/todo-dashboard-context";
import { useTodoTasks } from "@/features/todo/hooks/use-todo-data";
import type { TodoTask } from "@/features/todo/domain/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TodoWorkspaceDetailPageProps = { workspaceId: string };

function dueLabel(task: TodoTask) {
  if (!task.due_on) return "Sem prazo";
  const date = new Date(`${task.due_on}T12:00:00`);
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
  const time = task.due_at ? ` · ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(task.due_at))}` : "";
  return `${day}${time}`;
}

function priorityLabel(priority: string) {
  return priority === "high" ? "Alta" : priority === "low" ? "Baixa" : "Média";
}

export function TodoWorkspaceDetailPage({ workspaceId }: TodoWorkspaceDetailPageProps) {
  const { lists, tasks, workspaces, loading, error, refreshing, refreshAll } = useTodoDashboardData();
  const storedTasksResource = useTodoTasks({ workspaceId, includeDeleted: true });
  const [today, setToday] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editWorkspaceOpen, setEditWorkspaceOpen] = useState(false);
  const [deleteWorkspaceOpen, setDeleteWorkspaceOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [taskForm, setTaskForm] = useState<TodoTask | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const frame = requestAnimationFrame(() => setToday(localDateKey(new Date())));
    return () => cancelAnimationFrame(frame);
  }, []);

  const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
  const workspaceTasks = useMemo(() => tasks.filter((task) => task.workspace_id === workspaceId), [tasks, workspaceId]);
  const pendingTasks = workspaceTasks.filter((task) => task.status !== "done");
  const completedTasks = workspaceTasks.filter((task) => task.status === "done");
  const stats = summarizeWorkspaceTasks(workspaceTasks);
  const activeTask = workspaceTasks.find((task) => task.id === activeTaskId) ?? null;

  async function mutateTask(task: TodoTask, fields: { status?: "todo" | "in_progress" | "done"; workspaceId?: string | null }) {
    setSavingTaskId(task.id);
    try {
      const result = await todoTaskAction({ operation: "update", id: task.id, ...fields });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (fields.workspaceId === null) {
        setActiveTaskId(null);
        toast.success("Tarefa desvinculada do workspace.");
      } else if (fields.status === "done") {
        setActiveTaskId(null);
        toast.success("Tarefa concluída.");
      } else if (fields.status) {
        toast.success("Tarefa reaberta.");
      }
      await refreshAll();
    } catch {
      toast.error("Não foi possível atualizar a tarefa.");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function deleteWorkspace(policy: WorkspaceTaskPolicy) {
    if (!workspace) return;
    setDeleteBusy(true);
    try {
      const result = await todoWorkspaceAction({ operation: "delete_with_policy", id: workspace.id, taskPolicy: policy });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      await refreshAll();
      toast.success(policy === "keep_tasks" ? `Workspace excluído; ${result.data} tarefa(s) mantida(s) sem workspace.` : `Workspace excluído; ${result.data} tarefa(s) removida(s) de forma recuperável.`);
      router.push("/todo/workspaces");
    } catch {
      toast.error("Não foi possível excluir o workspace.");
    } finally {
      setDeleteBusy(false);
      setDeleteWorkspaceOpen(false);
    }
  }

  if (loading || !today) return <main className="mx-auto w-full max-w-[110rem] space-y-5 p-4 sm:p-6 xl:p-7"><Skeleton className="h-24" /><div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div><Skeleton className="h-[28rem]" /></main>;
  if (error) return <main className="mx-auto max-w-3xl p-6"><Alert variant="destructive"><AlertTitle>Não foi possível carregar o workspace</AlertTitle><AlertDescription className="mt-2 flex items-center justify-between gap-3">{error}<Button variant="outline" onClick={() => void refreshAll()} disabled={refreshing}><RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Tentar novamente</Button></AlertDescription></Alert></main>;
  if (!workspace) return <main className="mx-auto max-w-3xl p-6"><Alert><AlertTitle>Workspace não encontrado</AlertTitle><AlertDescription>Ele pode ter sido removido ou não pertence a esta conta.</AlertDescription></Alert><Button render={<Link href="/todo/workspaces" />} className="mt-4" variant="outline"><ArrowLeft /> Voltar aos workspaces</Button></main>;

  return <>
    <main className="mx-auto grid w-full max-w-[110rem] min-w-0 gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-6 xl:p-7">
      <section className="min-w-0 space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <Button render={<Link href="/todo/workspaces" />} variant="ghost" size="sm" className="-ml-2 mb-3"><ArrowLeft />Workspaces</Button>
            <div className="flex min-w-0 items-center gap-3"><TodoWorkspaceIcon workspace={workspace} /><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Detalhe do workspace</p><h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{workspace.name}</h1></div></div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{workspace.description || "Organize as tarefas relacionadas a este projeto."}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2"><Button onClick={() => { setTaskForm(null); setFormOpen(true); }}><Plus />Adicionar tarefa</Button><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Opções do workspace"><MoreHorizontal /></Button>} /><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setEditWorkspaceOpen(true)}><Pencil />Editar workspace</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={() => setDeleteWorkspaceOpen(true)}><Trash2 />Excluir workspace</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Progresso do workspace">
          <MetricCard label="Pendentes" value={stats.pending} icon={<Clock3 />} />
          <MetricCard label="Concluídas" value={stats.completed} icon={<CheckCircle2 />} tone="green" />
          <MetricCard label="Progresso" value={`${stats.progress}%`} icon={<Check />} tone="violet" />
        </section>

        <Card className="shadow-none"><CardContent className="space-y-2 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Progresso do workspace</p><span className="text-sm tabular-nums text-muted-foreground">{stats.completed} de {stats.total}</span></div><Progress value={stats.progress} aria-label={`Progresso do workspace: ${stats.progress}%`} />{stats.total === 0 ? <p className="text-xs text-muted-foreground">O progresso será calculado quando houver tarefas vinculadas.</p> : null}</CardContent></Card>

        <TaskGroup title="Tarefas pendentes" count={pendingTasks.length} empty="Nenhuma tarefa pendente neste workspace.">
          {pendingTasks.map((task) => <WorkspaceTaskRow key={task.id} task={task} listName={lists.find((item) => item.id === task.list_id)?.name ?? "Lista indisponível"} saving={savingTaskId === task.id} onOpen={() => setActiveTaskId(task.id)} onToggle={() => void mutateTask(task, { status: "done" })} onEdit={() => { setTaskForm(task); setFormOpen(true); }} onUnlink={() => void mutateTask(task, { workspaceId: null })} />)}
        </TaskGroup>
        <TaskGroup title="Tarefas concluídas" count={completedTasks.length} empty="Nenhuma tarefa concluída neste workspace.">
          {completedTasks.map((task) => <WorkspaceTaskRow key={task.id} task={task} listName={lists.find((item) => item.id === task.list_id)?.name ?? "Lista indisponível"} saving={savingTaskId === task.id} onOpen={() => setActiveTaskId(task.id)} onToggle={() => void mutateTask(task, { status: "todo" })} onEdit={() => { setTaskForm(task); setFormOpen(true); }} onUnlink={() => void mutateTask(task, { workspaceId: null })} />)}
        </TaskGroup>
      </section>

      <aside className="min-w-0 space-y-4">
        <Card className="shadow-none"><CardContent className="space-y-3 p-4"><p className="text-sm font-semibold">Informações do projeto</p><dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Tarefas</dt><dd className="font-medium">{stats.total}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Em aberto</dt><dd className="font-medium">{stats.pending}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Concluídas</dt><dd className="font-medium">{stats.completed}</dd></div></dl><Button variant="outline" className="w-full" onClick={() => setEditWorkspaceOpen(true)}><Pencil />Editar workspace</Button></CardContent></Card>
        <Card className="shadow-none"><CardContent className="space-y-2 p-4"><CardTitle className="text-sm">Sobre este espaço</CardTitle><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{workspace.description || "Nenhuma descrição foi adicionada."}</p><Badge variant="secondary">As tarefas continuam pertencendo às listas escolhidas</Badge></CardContent></Card>
      </aside>
    </main>

    <TodoTaskFormDialog key={`${workspace.id}-${taskForm?.id ?? "new"}`} open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setTaskForm(null); }} lists={lists} workspaces={workspaces} initialDate={today} initialWorkspaceId={workspace.id} initialTask={taskForm} onCreated={refreshAll} />
    <TodoWorkspaceFormDialog key={workspace.id} open={editWorkspaceOpen} onOpenChange={setEditWorkspaceOpen} workspace={workspace} onSaved={refreshAll} />
    <TodoTaskDetailsSheet task={activeTask} list={lists.find((item) => item.id === activeTask?.list_id)} workspace={workspace} lists={lists} workspaces={workspaces} onSelectTask={setActiveTaskId} onOpenChange={(open) => { if (!open) setActiveTaskId(null); }} onSaved={refreshAll} />
    <TodoWorkspaceDeleteDialog workspace={workspace} linkedTaskCount={storedTasksResource.data?.length ?? 0} open={deleteWorkspaceOpen} busy={deleteBusy || storedTasksResource.loading} onOpenChange={setDeleteWorkspaceOpen} onConfirm={(policy) => void deleteWorkspace(policy)} />
  </>;
}

function MetricCard({ label, value, icon, tone = "blue" }: { label: string; value: number | string; icon: ReactNode; tone?: "blue" | "green" | "violet" }) {
  const tones = { blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400", green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
  return <Card className="shadow-none"><CardContent className="flex items-center gap-3 p-4"><span className={cn("grid size-10 place-items-center rounded-xl", tones[tone])}>{icon}</span><div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}

function TaskGroup({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-xl border bg-card"><header className="flex items-center justify-between border-b bg-muted/20 px-4 py-3"><h2 className="text-sm font-semibold">{title}</h2><Badge variant="secondary">{count}</Badge></header>{count ? <div className="divide-y">{children}</div> : <p className="px-4 py-7 text-center text-sm text-muted-foreground">{empty}</p>}</section>;
}

function WorkspaceTaskRow({ task, listName, saving, onOpen, onToggle, onEdit, onUnlink }: { task: TodoTask; listName: string; saving: boolean; onOpen: () => void; onToggle: () => void; onEdit: () => void; onUnlink: () => void }) {
  const done = task.status === "done";
  return <div className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4">
    <Checkbox checked={done} disabled={saving} onCheckedChange={onToggle} aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`} />
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={cn("block break-words text-sm font-medium", done && "text-muted-foreground line-through")}>{task.title}</span><span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{task.description ? <span className="max-w-md truncate">{task.description}</span> : null}<span>{listName}</span><span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{dueLabel(task)}</span>{task.status === "in_progress" ? <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Em andamento</Badge> : null}</span></button>
    <Badge variant={task.priority === "high" ? "destructive" : "secondary"} className="hidden sm:inline-flex">{priorityLabel(task.priority)}</Badge>
    <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Ações de ${task.title}`}><MoreHorizontal /></Button>} /><DropdownMenuContent align="end"><DropdownMenuItem onClick={onOpen}>Abrir detalhes</DropdownMenuItem><DropdownMenuItem onClick={onEdit}><Pencil />Editar tarefa</DropdownMenuItem><DropdownMenuItem disabled={saving} onClick={onUnlink}><Unlink />Remover do workspace</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </div>;
}
