"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, BriefcaseBusiness, CheckCircle2, LoaderCircle, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { todoWorkspaceAction } from "@/features/todo/actions";
import { TodoWorkspaceDeleteDialog, type WorkspaceTaskPolicy } from "@/features/todo/components/todo-workspace-delete-dialog";
import { TodoWorkspaceFormDialog } from "@/features/todo/components/todo-workspace-form-dialog";
import { TodoWorkspaceIcon } from "@/features/todo/components/todo-workspace-icon";
import { TodoTaskFormDialog } from "@/features/todo/components/todo-task-form-dialog";
import { activityLabel, filterWorkspacesBySearch, summarizeWorkspaceTasks } from "@/features/todo/domain/workspaces";
import { localDateKey } from "@/features/todo/domain/dashboard";
import { useTodoDashboardData } from "@/features/todo/hooks/todo-dashboard-context";
import { useTodoRecentActivity } from "@/features/todo/hooks/use-todo-data";
import type { TodoWorkspace } from "@/features/todo/domain/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type WorkspaceFilter = "all" | "in_progress" | "completed";

function relativeTime(date: string) {
  const elapsedHours = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 3_600_000));
  if (elapsedHours < 1) return "agora há pouco";
  if (elapsedHours < 24) return `há ${elapsedHours} ${elapsedHours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(elapsedHours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export function TodoWorkspacesPage() {
  const { lists, workspaces, tasks, loading, error, refreshing, refreshAll } = useTodoDashboardData();
  const [filter, setFilter] = useState<WorkspaceFilter>("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<TodoWorkspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<TodoWorkspace | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  const activityResource = useTodoRecentActivity();
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const workspaceById = useMemo(() => new Map(workspaces.map((workspace) => [workspace.id, workspace])), [workspaces]);
  const metrics = useMemo(() => new Map(workspaces.map((workspace) => [workspace.id, summarizeWorkspaceTasks(tasks.filter((task) => task.workspace_id === workspace.id))])), [workspaces, tasks]);
  const filtered = filterWorkspacesBySearch(workspaces, search).filter((workspace) => {
    if (filter === "all") return true;
    return metrics.get(workspace.id)?.filterStatus === filter;
  });
  const recentActivity = (activityResource.data ?? []).filter((entry) => {
    const task = taskById.get(entry.task_id);
    return task?.workspace_id && workspaceById.has(task.workspace_id);
  }).slice(0, 6);
  const highlights = workspaces.map((workspace) => ({ workspace, stats: metrics.get(workspace.id) ?? summarizeWorkspaceTasks([]) }))
    .filter(({ stats }) => stats.total > 0)
    .toSorted((a, b) => b.stats.progress - a.stats.progress || b.stats.total - a.stats.total)
    .slice(0, 3);

  async function deleteWorkspace(policy: WorkspaceTaskPolicy) {
    if (!deletingWorkspace) return;
    setDeleteBusy(true);
    setDeletingId(deletingWorkspace.id);
    try {
      const result = await todoWorkspaceAction({ operation: "delete_with_policy", id: deletingWorkspace.id, taskPolicy: policy });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const count = result.data;
      setDeletingWorkspace(null);
      await refreshAll();
      toast.success(policy === "keep_tasks" ? `Workspace excluído; ${count} tarefa(s) mantida(s) sem workspace.` : `Workspace excluído; ${count} tarefa(s) removida(s) de forma recuperável.`);
    } catch {
      toast.error("Não foi possível excluir o workspace.");
    } finally {
      setDeleteBusy(false);
      setDeletingId(null);
    }
  }

  if (loading) return <main className="mx-auto w-full max-w-[110rem] space-y-6 p-4 sm:p-6 xl:p-7"><Skeleton className="h-24" /><Skeleton className="h-10 w-full max-w-2xl" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-52" />)}</div></main>;
  if (error) return <main className="mx-auto max-w-3xl p-6"><Alert variant="destructive"><AlertTitle>Não foi possível carregar os workspaces</AlertTitle><AlertDescription className="mt-2 flex items-center justify-between gap-3">{error}<Button variant="outline" onClick={() => void refreshAll()} disabled={refreshing}><LoaderCircle className={cn("size-4", refreshing && "animate-spin")} /> Tentar novamente</Button></AlertDescription></Alert></main>;

  return <>
    <main className="mx-auto grid w-full max-w-[110rem] min-w-0 gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-6 xl:p-7">
      <section className="min-w-0 space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Tarefas / Workspaces</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Espaços de trabalho</h1><p className="mt-2 text-sm text-muted-foreground">Organize seus projetos e acompanhe o progresso das tarefas vinculadas.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTaskFormOpen(true)}><Plus aria-hidden="true" /> Nova tarefa</Button><Button onClick={() => { setEditingWorkspace(null); setFormOpen(true); }}><Plus aria-hidden="true" /> Novo workspace</Button></div>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as WorkspaceFilter)}>
            <TabsList variant="line" aria-label="Filtrar workspaces"><TabsTrigger value="all">Todos <span className="ml-1 text-xs text-muted-foreground">{workspaces.length}</span></TabsTrigger><TabsTrigger value="in_progress">Em andamento</TabsTrigger><TabsTrigger value="completed">Concluídos</TabsTrigger></TabsList>
          </Tabs>
          <div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar workspace" placeholder="Buscar workspace" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" /></div>
        </div>

        {filtered.length ? <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((workspace) => {
            const stats = metrics.get(workspace.id) ?? summarizeWorkspaceTasks([]);
            return <Card key={workspace.id} className="group relative shadow-none transition-colors hover:border-primary/40">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/todo/workspaces/${workspace.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <TodoWorkspaceIcon workspace={workspace} />
                    <div className="min-w-0"><CardTitle className="truncate text-base">{workspace.name}</CardTitle><CardDescription className="mt-1">{stats.total} {stats.total === 1 ? "tarefa" : "tarefas"}</CardDescription></div>
                  </Link>
                  <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Opções de ${workspace.name}`} disabled={deletingId === workspace.id}><MoreHorizontal /></Button>} /><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setEditingWorkspace(workspace); setFormOpen(true); }}><Pencil />Editar workspace</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={() => setDeletingWorkspace(workspace)}><Trash2 />Excluir workspace</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                </div>
                <Link href={`/todo/workspaces/${workspace.id}`} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{workspace.description || "Sem descrição"}</p>
                </Link>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex items-center gap-3"><Progress value={stats.progress} aria-label={`${stats.progress}% concluído em ${workspace.name}`} /><span className="w-10 text-right text-xs font-medium tabular-nums text-muted-foreground">{stats.progress}%</span></div>
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{stats.completed} concluídas</span><span>{stats.pending} pendentes</span></div>
              </CardContent>
            </Card>;
          })}
          <button type="button" onClick={() => { setEditingWorkspace(null); setFormOpen(true); }} className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-center transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="grid size-10 place-items-center rounded-xl bg-muted"><Plus className="size-5" /></span><span className="text-sm font-medium">Criar workspace</span><span className="text-xs text-muted-foreground">Organize outro projeto</span></button>
        </div> : <Card className="border-dashed shadow-none"><CardContent className="flex min-h-64 flex-col items-center justify-center px-5 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><BriefcaseBusiness className="size-5" /></span><h2 className="mt-4 text-base font-semibold">{workspaces.length ? "Nenhum workspace encontrado" : "Seus projetos começam por aqui"}</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">{workspaces.length ? "Ajuste a busca ou o filtro para ver seus espaços." : "Crie um workspace para agrupar tarefas relacionadas. Ele não cria tarefas automaticamente."}</p>{workspaces.length === 0 ? <Button className="mt-4" onClick={() => { setEditingWorkspace(null); setFormOpen(true); }}><Plus /> Criar workspace</Button> : null}</CardContent></Card>}
      </section>

      <aside className="min-w-0 space-y-4">
        <Card className="shadow-none"><CardHeader className="p-4 pb-3"><div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><CardTitle className="text-sm">Atividade recente</CardTitle></div><CardDescription>Alterações registradas nas tarefas dos workspaces</CardDescription></CardHeader><CardContent className="space-y-3 px-4 pb-4">
          {activityResource.loading ? <div className="space-y-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-12" />)}</div> : activityResource.error ? <p className="text-sm text-muted-foreground">A atividade não pôde ser carregada.</p> : recentActivity.length ? recentActivity.map((entry) => { const task = taskById.get(entry.task_id); const workspace = task?.workspace_id ? workspaceById.get(task.workspace_id) : null; if (!task || !workspace) return null; return <div key={entry.id} className="flex min-w-0 items-start gap-3 border-b pb-3 last:border-0 last:pb-0"><TodoWorkspaceIcon workspace={workspace} className="size-9 rounded-xl" /><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{activityLabel(entry.action)} em</p><p className="truncate text-sm font-medium">{workspace.name}</p><p className="truncate text-xs text-muted-foreground">{task.title} · {relativeTime(entry.created_at)}</p></div></div>; }) : <p className="rounded-lg border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">Atividades de tarefas vinculadas aparecerão aqui.</p>}
        </CardContent></Card>

        <Card className="shadow-none"><CardHeader className="p-4 pb-3"><div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /><CardTitle className="text-sm">Workspaces em destaque</CardTitle></div><CardDescription>Ordenados pelo progresso real</CardDescription></CardHeader><CardContent className="space-y-3 px-4 pb-4">{highlights.length ? highlights.map(({ workspace, stats }) => <Link key={workspace.id} href={`/todo/workspaces/${workspace.id}`} className="flex items-center gap-3 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><TodoWorkspaceIcon workspace={workspace} className="size-9 rounded-xl" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{workspace.name}</span><span className="block text-xs text-muted-foreground">{stats.total} {stats.total === 1 ? "tarefa" : "tarefas"} · {stats.progress}% concluído</span></span></Link>) : <p className="rounded-lg border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">O destaque aparece após tarefas serem vinculadas.</p>}</CardContent></Card>
      </aside>
    </main>
    <TodoWorkspaceFormDialog key={editingWorkspace?.id ?? "new-workspace"} open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingWorkspace(null); }} workspace={editingWorkspace} onSaved={refreshAll} />
    <TodoTaskFormDialog open={taskFormOpen} onOpenChange={setTaskFormOpen} lists={lists} workspaces={workspaces} initialDate={localDateKey(new Date())} onCreated={refreshAll} />
    <TodoWorkspaceDeleteDialog workspace={deletingWorkspace} linkedTaskCount={deletingWorkspace ? tasks.filter((task) => task.workspace_id === deletingWorkspace.id).length : 0} open={Boolean(deletingWorkspace)} busy={deleteBusy} onOpenChange={(open) => { if (!open) setDeletingWorkspace(null); }} onConfirm={(policy) => void deleteWorkspace(policy)} />
  </>;
}
