"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Archive, ArrowDown, ArrowUp, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronsDown, ChevronsUp, Circle, Clock3, GripVertical, ListTodo, LoaderCircle, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Tags, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderTodoTaskPositionsAction, todoLabelAction, todoListAction, todoTaskAction, todoTaskLabelAction } from "@/features/todo/actions";
import { TodoTaskFormDialog } from "@/features/todo/components/todo-task-form-dialog";
import { TodoTaskDetailsSheet } from "@/features/todo/components/todo-task-details-sheet";
import { TodoTaskLifecycleDialog, type TodoTaskLifecycleAction } from "@/features/todo/components/todo-task-lifecycle-dialog";
import { countLabelUsage, splitListTasks, splitWorkListTasks } from "@/features/todo/domain/list-page";
import { localDateKey, taskDueDateKey } from "@/features/todo/domain/dashboard";
import { useTodoDashboardData } from "@/features/todo/hooks/todo-dashboard-context";
import { useTodoLabels, useTodoLabelsForTasks, useTodoTasks } from "@/features/todo/hooks/use-todo-data";
import type { TodoLabel, TodoList, TodoTask, TodoTaskLabel } from "@/features/todo/domain/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { moveItem, reorderById } from "@/features/todo/domain/manual-order";

const colors = ["blue", "violet", "green", "orange", "rose", "slate"] as const;
const priorities = [{ value: "high", label: "Alta" }, { value: "medium", label: "Média" }, { value: "low", label: "Baixa" }] as const;
const noLabels: TodoLabel[] = [];
const noLabelLinks: TodoTaskLabel[] = [];

function humanDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function listIcon(list: TodoList): ReactNode {
  const className = "size-5";
  if (list.icon.toLowerCase().includes("user") || list.slug === "pessoal") return <UserRound className={className} aria-hidden="true" />;
  if (list.icon.toLowerCase().includes("brief") || list.slug === "trabalho") return <BriefcaseBusiness className={className} aria-hidden="true" />;
  return <ListTodo className={className} aria-hidden="true" />;
}

function LoadingState() {
  return <main className="mx-auto grid w-full max-w-[110rem] gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_19rem]"><div className="space-y-5"><Skeleton className="h-24" /><div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-20" />)}</div><Skeleton className="h-[28rem]" /></div><Skeleton className="h-[30rem]" /></main>;
}

export function TodoListPage({ listId }: { listId: string }) {
  const router = useRouter();
  const { lists, tasks, workspaces, loading, error, refreshing, refreshAll } = useTodoDashboardData();
  const storedTasksResource = useTodoTasks({ listId, includeDeleted: true });
  const labelsResource = useTodoLabels();
  const listTasks = useMemo(() => tasks.filter((task) => task.list_id === listId), [tasks, listId]);
  const labelLinksResource = useTodoLabelsForTasks(listTasks.map((task) => task.id).sort());
  const [today, setToday] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(() => new Set());
  const [listName, setListName] = useState("");
  const [listIconValue, setListIconValue] = useState("list");
  const [listColor, setListColor] = useState("blue");
  const [newLabel, setNewLabel] = useState("");
  const [labelSaving, setLabelSaving] = useState(false);
  const [listSaving, setListSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TodoTask | null>(null);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"manual" | "priority" | "due" | "created" | "title">("manual");
  const [manualOrderOverride, setManualOrderOverride] = useState<{ lane: "pending" | "done"; ids: string[] } | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setToday(localDateKey(new Date())));
    return () => cancelAnimationFrame(frame);
  }, []);
  const list = lists.find((item) => item.id === listId) ?? null;
  const storedTaskCount = (storedTasksResource.data ?? []).length;
  const activeTask = listTasks.find((task) => task.id === taskId) ?? null;
  const isWorkList = list?.slug === "trabalho";
  const partitions = useMemo(() => today ? splitListTasks(listTasks, today) : { pending: [], completed: [], upcoming: [] }, [listTasks, today]);
  const workPartitions = useMemo(() => today ? splitWorkListTasks(listTasks, today) : { pending: [], completed: [], overdue: [], highPriority: [], inProgress: [], other: [], upcoming: [] }, [listTasks, today]);
  const labelRows = labelsResource.data ?? noLabels;
  const labelLinks = labelLinksResource.data ?? noLabelLinks;
  const usage = useMemo(() => countLabelUsage(listTasks.map((task) => task.id), labelLinks), [listTasks, labelLinks]);
  const popularLabels = useMemo(() => labelRows.filter((label) => usage.has(label.id)).sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)).slice(0, 5), [labelRows, usage]);
  const progress = listTasks.length ? Math.round((partitions.completed.length / listTasks.length) * 100) : 0;
  const filteredTasks = listTasks.filter((task) => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (query && !`${task.title} ${task.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(query)) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (dueFilter === "upcoming" && !(task.due_on && today && task.due_on >= today)) return false;
    if (dueFilter === "overdue" && !(task.due_on && today && task.due_on < today)) return false;
    if (dueFilter === "none" && task.due_on !== null) return false;
    return true;
  });
  const canManualReorder = sortBy === "manual" && !search.trim() && priorityFilter === "all" && dueFilter === "all";
  const sortedTasks = filteredTasks.toSorted((a, b) => {
    if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
    const lane = a.status === "done" ? "done" : "pending";
    if (sortBy === "manual") {
      if (manualOrderOverride?.lane === lane) {
        const aIndex = manualOrderOverride.ids.indexOf(a.id);
        const bIndex = manualOrderOverride.ids.indexOf(b.id);
        if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
      }
      return a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
    }
    if (sortBy === "priority") return priorities.findIndex((item) => item.value === a.priority) - priorities.findIndex((item) => item.value === b.priority) || a.position - b.position;
    if (sortBy === "created") return b.created_at.localeCompare(a.created_at) || a.position - b.position;
    if (sortBy === "title") return a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }) || a.position - b.position;
    return (taskDueDateKey(a) ?? "9999-12-31").localeCompare(taskDueDateKey(b) ?? "9999-12-31") || a.position - b.position;
  });
  const visiblePending = sortedTasks.filter((task) => task.status !== "done");
  const workVisible = isWorkList && today ? splitWorkListTasks(sortedTasks, today) : null;
  const upcoming = (isWorkList ? workPartitions.upcoming : partitions.upcoming).slice(0, 4);
  const associatedWorkspaces = workspaces.map((workspace) => ({
    workspace,
    tasks: listTasks.filter((task) => task.workspace_id === workspace.id),
  })).filter(({ tasks }) => tasks.length > 0);
  const hasAsideContent = isWorkList
    ? associatedWorkspaces.length > 0 || upcoming.length > 0 || workPartitions.overdue.length > 0
    : listTasks.length > 0 || popularLabels.length > 0 || upcoming.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function persistManualOrder(lane: "pending" | "done", ids: string[]) {
    if (reordering || !canManualReorder) return;
    const original = listTasks.filter((task) => lane === "done" ? task.status === "done" : task.status !== "done")
      .toSorted((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .map((task) => task.id);
    setManualOrderOverride({ lane, ids });
    setReordering(true);
    let persisted = false;
    try {
      const result = await reorderTodoTaskPositionsAction({ listId, lane, taskIds: ids });
      if (!result.ok) {
        setManualOrderOverride({ lane, ids: original });
        toast.error(result.message || "Não foi possível salvar a ordem das tarefas.");
        return;
      }
      persisted = true;
      await refreshAll();
      setManualOrderOverride(null);
      toast.success("Ordem das tarefas salva.");
    } catch {
      if (persisted) toast.message("A ordem foi salva, mas a lista não atualizou. Recarregue para ver a confirmação do servidor.");
      else {
        setManualOrderOverride({ lane, ids: original });
        toast.error("Não foi possível salvar a ordem. A ordem anterior foi restaurada.");
      }
    } finally {
      setReordering(false);
    }
  }

  function handleDragEnd(event: DragEndEvent, rows: TodoTask[], lane: "pending" | "done") {
    if (!event.over || event.active.id === event.over.id) return;
    const next = reorderById(rows, String(event.active.id), String(event.over.id));
    void persistManualOrder(lane, next.map((task) => task.id));
  }

  function renderTaskRows(rows: TodoTask[], lane: "pending" | "done") {
    const renderRow = (task: TodoTask, index: number) => <TaskRow key={task.id} task={task} lists={lists} labels={labelRows} taskLabelIds={labelLinks.filter((link) => link.task_id === task.id).map((link) => link.label_id)} saving={saving.has(task.id) || reordering} manualOrder={sortBy === "manual" ? { enabled: canManualReorder, index, count: rows.length, onMove: (target: number) => void persistManualOrder(lane, moveItem(rows.map((row) => row.id), index, target)) } : undefined} onOpen={() => setTaskId(task.id)} onEdit={() => { setEditingTask(task); setFormOpen(true); }} onDelete={() => setTaskToDelete(task)} onToggle={() => void mutateTask(task, { status: task.status === "done" ? "todo" : "done" })} onStatus={(status) => void mutateTask(task, { status })} onPriority={(priority) => void mutateTask(task, { priority })} onMove={(targetListId) => void mutateTask(task, { listId: targetListId })} onLabel={(label, checked) => void toggleLabel(task, label, checked)} />;
    if (!canManualReorder || rows.length < 2) return <div className="divide-y">{rows.map(renderRow)}</div>;
    return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => handleDragEnd(event, rows, lane)}>
      <SortableContext items={rows.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="divide-y">{rows.map((task, index) => <SortableTaskRow key={task.id} task={task}>{(dragHandle) => <TaskRow task={task} lists={lists} labels={labelRows} taskLabelIds={labelLinks.filter((link) => link.task_id === task.id).map((link) => link.label_id)} saving={saving.has(task.id) || reordering} manualOrder={{ enabled: true, index, count: rows.length, onMove: (target) => void persistManualOrder(lane, moveItem(rows.map((row) => row.id), index, target)) }} dragHandle={dragHandle} onOpen={() => setTaskId(task.id)} onEdit={() => { setEditingTask(task); setFormOpen(true); }} onDelete={() => setTaskToDelete(task)} onToggle={() => void mutateTask(task, { status: task.status === "done" ? "todo" : "done" })} onStatus={(status) => void mutateTask(task, { status })} onPriority={(priority) => void mutateTask(task, { priority })} onMove={(targetListId) => void mutateTask(task, { listId: targetListId })} onLabel={(label, checked) => void toggleLabel(task, label, checked)} />}</SortableTaskRow>)}</div>
      </SortableContext>
    </DndContext>;
  }

  function renderTaskSection(title: string, rows: TodoTask[], emptyMessage: string, lane: "pending" | "done" = title === "Concluídas" ? "done" : "pending") {
    return <TaskSection title={title} count={rows.length}>{rows.length ? renderTaskRows(rows, lane) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>}</TaskSection>;
  }

  async function reloadLabels() {
    await Promise.all([labelsResource.refresh(), labelLinksResource.refresh()]);
  }
  async function mutateTask(task: TodoTask, fields: { status?: "todo" | "in_progress" | "done"; priority?: string; listId?: string }) {
    if (saving.has(task.id)) return;
    setSaving((current) => new Set(current).add(task.id));
    try {
      const result = await todoTaskAction({ operation: "update", id: task.id, ...fields });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(fields.listId ? "Tarefa movida para outra lista." : fields.status === "done" ? "Tarefa concluída." : fields.status === "in_progress" ? "Tarefa marcada como em andamento." : fields.status ? "Tarefa reaberta." : "Prioridade atualizada.");
      if (fields.status === "done") setTaskId(null);
      await refreshAll();
    } catch { toast.error("Não foi possível atualizar a tarefa."); }
    finally { setSaving((current) => { const next = new Set(current); next.delete(task.id); return next; }); }
  }

  async function applyTaskLifecycle(action: TodoTaskLifecycleAction): Promise<boolean> {
    if (!taskToDelete || saving.has(taskToDelete.id)) return false;
    const task = taskToDelete;
    setSaving((current) => new Set(current).add(task.id));
    try {
      const result = await todoTaskAction({ operation: action, id: task.id });
      if (!result.ok) { toast.error(result.message); return false; }
      setTaskToDelete(null);
      if (taskId === task.id) setTaskId(null);
      toast.success(action === "archive" ? "Tarefa arquivada." : "Tarefa movida para a lixeira.");
      try { await refreshAll(); } catch { toast.warning("A tarefa foi atualizada, mas a lista ainda não foi recarregada."); }
      return true;
    } catch { toast.error(action === "archive" ? "Não foi possível arquivar a tarefa." : "Não foi possível mover a tarefa para a lixeira."); return false; }
    finally { setSaving((current) => { const next = new Set(current); next.delete(task.id); return next; }); }
  }

  async function createLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newLabel.trim();
    if (!name) return;
    setLabelSaving(true);
    try {
      const result = await todoLabelAction({ operation: "create", name, color: "blue" });
      if (!result.ok) { toast.error(result.message); return; }
      setNewLabel(""); setLabelOpen(false); await reloadLabels(); toast.success("Etiqueta criada.");
    } catch { toast.error("Não foi possível criar a etiqueta."); }
    finally { setLabelSaving(false); }
  }

  async function toggleLabel(task: TodoTask, label: TodoLabel, checked: boolean) {
    const result = await todoTaskLabelAction({ operation: checked ? "attach" : "detach", taskId: task.id, labelId: label.id });
    if (!result.ok) toast.error(result.message);
    else await reloadLabels();
  }

  async function saveList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!list) return;
    setListSaving(true);
    try {
      const result = await todoListAction({ operation: "update", id: list.id, name: listName.trim(), icon: listIconValue, color: listColor });
      if (!result.ok) { toast.error(result.message); return; }
      setEditOpen(false); await refreshAll(); toast.success("Lista atualizada.");
    } catch { toast.error("Não foi possível atualizar a lista."); }
    finally { setListSaving(false); }
  }

  async function deleteList() {
    if (!list) return;
    if (storedTasksResource.loading) return;
    if (storedTaskCount > 0 && !transferTargetId) {
      toast.error("Escolha uma lista de destino para preservar as tarefas.");
      setConfirmDelete(false);
      return;
    }
    const result = await todoListAction({ operation: "delete_with_transfer", id: list.id, targetListId: storedTaskCount > 0 ? transferTargetId : null });
    if (!result.ok) { toast.error(result.message); return; }
    toast.success(storedTaskCount > 0 ? `${storedTaskCount} tarefa(s) transferida(s) e lista excluída.` : "Lista excluída.");
    await refreshAll();
    router.push("/todo");
  }

  if (loading || !today) return <LoadingState />;
  if (error) return <main className="mx-auto w-full max-w-3xl p-4 pt-10 sm:p-8"><Alert variant="destructive"><AlertTitle>Não foi possível carregar a lista</AlertTitle><AlertDescription className="mt-2 flex items-center justify-between gap-3">{error}<Button variant="outline" onClick={() => void refreshAll()} disabled={refreshing}><RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Tentar novamente</Button></AlertDescription></Alert></main>;
  if (!list) return <main className="mx-auto max-w-2xl p-6"><Alert><AlertTitle>Lista não encontrada</AlertTitle><AlertDescription>Ela pode ter sido removida ou não pertence a esta conta.</AlertDescription></Alert><Button className="mt-4" variant="outline" onClick={() => router.push("/todo")}>Voltar à visão geral</Button></main>;

  return <>
    <main className={cn("mx-auto grid w-full max-w-[110rem] min-w-0 gap-5 p-4 sm:p-6 xl:gap-6 xl:p-7", hasAsideContent ? "xl:grid-cols-[minmax(0,1fr)_19rem]" : "grid-cols-1")}>
      <div className="min-w-0 space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-12 rounded-2xl"><AvatarFallback className={cn("rounded-2xl", list.color === "violet" ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" : list.color === "green" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : list.color === "orange" ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" : list.color === "rose" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : list.color === "slate" ? "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300")}>{listIcon(list)}</AvatarFallback></Avatar>
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Tarefas / {list.name}</p><h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">{list.slug === "pessoal" && list.name === "Pessoal" ? "Minha vida pessoal" : list.name}</h1><p className="mt-1 text-sm text-muted-foreground">{list.slug === "pessoal" && list.name === "Pessoal" ? "Tudo que importa fora do trabalho, em um só lugar." : list.slug === "trabalho" && list.name === "Trabalho" ? "Organize suas entregas e mantenha os prazos sob controle." : "Tarefas organizadas nesta lista."}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={() => { setEditingTask(null); setFormOpen(true); }}><Plus aria-hidden="true" /> Nova tarefa</Button>
            <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Opções da lista"><MoreHorizontal /></Button>} /><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setListName(list.name); setListIconValue(list.icon); setListColor(list.color); setEditOpen(true); }}><Pencil /> Editar lista</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Excluir lista</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo da lista">
          <ListMetric icon={<ListTodo />} label="Pendentes" value={partitions.pending.length} />
          <ListMetric icon={<CheckCircle2 />} label="Concluídas" value={partitions.completed.length} tone="green" />
          <ListMetric icon={isWorkList ? <AlertCircle /> : <CalendarDays />} label={isWorkList ? "Atrasadas" : "Próximas"} value={isWorkList ? workPartitions.overdue.length : partitions.upcoming.length} tone={isWorkList ? "red" : "violet"} />
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tarefas da lista</h2>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative min-w-40 flex-1 sm:flex-none"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefas" aria-label="Buscar tarefas por título ou descrição" className="pl-9 sm:w-48" /></div>
            <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value ?? "all")}><SelectTrigger className="w-32" aria-label="Filtrar por prioridade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Prioridade</SelectItem>{priorities.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
            <Select value={dueFilter} onValueChange={(value) => setDueFilter(value ?? "all")}><SelectTrigger className="w-32" aria-label="Filtrar por prazo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Prazo</SelectItem><SelectItem value="upcoming">Próximas</SelectItem><SelectItem value="overdue">Atrasadas</SelectItem><SelectItem value="none">Sem prazo</SelectItem></SelectContent></Select>
            <Select value={sortBy} onValueChange={(value) => setSortBy((value as typeof sortBy | null) ?? "manual")}><SelectTrigger className="w-40" aria-label="Ordenar tarefas"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Ordem manual</SelectItem><SelectItem value="priority">Por prioridade</SelectItem><SelectItem value="due">Por prazo</SelectItem><SelectItem value="created">Data de criação</SelectItem><SelectItem value="title">Ordem alfabética</SelectItem></SelectContent></Select>
          </div>
        </div>
        {sortBy === "manual" && !canManualReorder ? <p className="text-xs text-muted-foreground">Limpe a busca e os filtros para reorganizar tarefas manualmente.</p> : null}

        {isWorkList && workVisible && sortBy !== "manual" ? <>
          {renderTaskSection("Prioridade alta", workVisible.highPriority, "Nenhuma tarefa pendente de prioridade alta.")}
          {renderTaskSection("Em andamento", workVisible.inProgress, "Nenhuma tarefa em andamento.")}
          {renderTaskSection("Outras tarefas", workVisible.other, "Nenhuma outra tarefa pendente nesta lista.")}
          {renderTaskSection("Concluídas", workVisible.completed, "Nenhuma tarefa concluída nesta lista.", "done")}
        </> : <>
          {renderTaskSection("Pendentes", visiblePending, partitions.pending.length ? "Nenhuma tarefa corresponde aos filtros." : "Nenhuma tarefa pendente nesta lista.", "pending")}
          {renderTaskSection("Concluídas", sortedTasks.filter((task) => task.status === "done"), partitions.completed.length ? "Nenhuma tarefa corresponde aos filtros." : "Nenhuma tarefa concluída nesta lista.", "done")}
        </>}
      </div>

      {hasAsideContent ? <aside className="min-w-0 space-y-4">
        {isWorkList ? <>
          {associatedWorkspaces.length ? <Card className="shadow-none"><CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-3"><div><CardTitle className="text-sm">Workspaces associados</CardTitle><CardDescription className="mt-1">Projetos vinculados a tarefas desta lista</CardDescription></div><Badge variant="secondary">{associatedWorkspaces.length}</Badge></CardHeader><CardContent className="px-4 pb-4"><div className="space-y-3">{associatedWorkspaces.map(({ workspace, tasks: workspaceTasks }) => {
            const doneCount = workspaceTasks.filter((task) => task.status === "done").length;
            const completion = Math.round((doneCount / workspaceTasks.length) * 100);
            return <div key={workspace.id} className="space-y-1.5"><div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-sm font-medium"><BriefcaseBusiness className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{workspace.name}</span></span><span className="text-xs text-muted-foreground">{workspaceTasks.length} {workspaceTasks.length === 1 ? "tarefa" : "tarefas"}</span></div><Progress value={completion} aria-label={`${completion}% concluído em ${workspace.name}`} /></div>;
          })}</div></CardContent></Card> : null}
          {upcoming.length ? <Card className="shadow-none"><CardHeader className="p-4 pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="text-sm">Próximos prazos</CardTitle><Badge variant="secondary">{upcoming.length}</Badge></div><CardDescription>Tarefas pendentes com prazo a partir de hoje</CardDescription></CardHeader><CardContent className="px-4 pb-4"><div className="space-y-3">{upcoming.map((task) => <button type="button" key={task.id} onClick={() => setTaskId(task.id)} className="flex w-full items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{task.due_on ? humanDate(task.due_on) : "Sem data"}{task.due_at ? ` · ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(task.due_at))}` : ""}</span></span></button>)}</div></CardContent></Card> : null}
          {workPartitions.overdue.length ? <Alert variant="destructive"><AlertCircle className="size-4" /><AlertTitle>Tarefas atrasadas</AlertTitle><AlertDescription>{workPartitions.overdue.length} {workPartitions.overdue.length === 1 ? "tarefa pendente passou" : "tarefas pendentes passaram"} do prazo. {workPartitions.overdue.slice(0, 3).map((task) => task.title).join(" · ")}</AlertDescription></Alert> : null}
        </> : <>
        {listTasks.length ? <Card className="shadow-none"><CardHeader className="space-y-2 p-4 pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm">Progresso da lista</CardTitle><Badge variant="secondary">{progress}%</Badge></div><CardDescription>{partitions.completed.length} concluídas · {partitions.pending.length} pendentes</CardDescription></CardHeader><CardContent className="px-4 pb-4"><Progress value={progress} aria-label={`Progresso da lista: ${progress}%`} /></CardContent></Card> : null}

        {popularLabels.length ? <Card className="shadow-none"><CardHeader className="p-4 pb-3"><CardTitle className="text-sm">Etiquetas mais usadas</CardTitle></CardHeader><CardContent className="px-4 pb-4"><div className="space-y-3">{popularLabels.map((label) => <div key={label.id} className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2 text-sm"><Tags className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{label.name}</span></span><Badge variant="secondary">{usage.get(label.id)} {usage.get(label.id) === 1 ? "tarefa" : "tarefas"}</Badge></div>)}</div></CardContent></Card> : null}

        {upcoming.length ? <Card className="shadow-none"><CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Próximos compromissos</CardTitle></CardHeader><CardContent className="px-4 pb-4"><div className="space-y-3">{upcoming.map((task) => <button type="button" key={task.id} onClick={() => setTaskId(task.id)} className="flex w-full items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{task.due_on ? humanDate(task.due_on) : "Sem data"}{task.due_at ? ` · ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(task.due_at))}` : ""}</span></span></button>)}</div></CardContent></Card> : null}
        </>}
      </aside> : null}
    </main>

    <TodoTaskFormDialog key={editingTask?.id ?? `new-${list.id}`} open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingTask(null); }} lists={lists} workspaces={workspaces} initialDate={today} initialListId={list.id} initialTask={editingTask} onCreated={refreshAll} />
    <TodoTaskDetailsSheet task={activeTask} list={list} workspace={workspaces.find((workspace) => workspace.id === activeTask?.workspace_id)} lists={lists} workspaces={workspaces} onSelectTask={setTaskId} onOpenChange={(open) => { if (!open) setTaskId(null); }} onSaved={refreshAll} />

    <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle>Editar lista</DialogTitle><DialogDescription>Altere a identificação visual desta lista.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => void saveList(event)}><div className="space-y-2"><Label htmlFor="todo-list-name">Nome</Label><Input id="todo-list-name" maxLength={80} required value={listName} onChange={(event) => setListName(event.target.value)} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Ícone</Label><Select value={listIconValue} onValueChange={(value) => setListIconValue(value ?? "list")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="list">Lista</SelectItem><SelectItem value="user">Pessoal</SelectItem><SelectItem value="briefcase">Trabalho</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Cor</Label><Select value={listColor} onValueChange={(value) => setListColor(value ?? "blue")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{colors.map((color) => <SelectItem key={color} value={color}>{color[0]?.toLocaleUpperCase("pt-BR")}{color.slice(1)}</SelectItem>)}</SelectContent></Select></div></div><p className="text-xs text-muted-foreground">A descrição não é um campo salvo no modelo atual de listas.</p><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={listSaving}>Cancelar</Button><Button type="submit" disabled={listSaving}>{listSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}Salvar alterações</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={labelOpen} onOpenChange={setLabelOpen}><DialogContent><DialogHeader><DialogTitle>Nova etiqueta</DialogTitle><DialogDescription>Crie uma etiqueta para organizar tarefas. Ela só aparece como usada quando vinculada a uma tarefa.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => void createLabel(event)}><div className="space-y-2"><Label htmlFor="todo-label-name">Nome</Label><Input id="todo-label-name" maxLength={60} required value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Ex.: Saúde, Casa, Finanças" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setLabelOpen(false)} disabled={labelSaving}>Cancelar</Button><Button type="submit" disabled={labelSaving || !newLabel.trim()}>{labelSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Criar etiqueta</Button></DialogFooter></form></DialogContent></Dialog>

    <TodoTaskLifecycleDialog open={taskToDelete !== null} taskTitle={taskToDelete?.title} onOpenChange={(open) => { if (!open && !saving.has(taskToDelete?.id ?? "")) setTaskToDelete(null); }} onConfirm={applyTaskLifecycle} />

    <Dialog open={confirmDelete} onOpenChange={(open) => { setConfirmDelete(open); if (!open) setTransferTargetId(""); }}><DialogContent><DialogHeader><DialogTitle>Excluir lista?</DialogTitle><DialogDescription>{storedTasksResource.loading ? "Conferindo tarefas vinculadas…" : storedTaskCount ? `Há ${storedTaskCount} tarefa(s), incluindo registros removidos logicamente. Escolha onde transferi-las. A transferência e exclusão acontecem em uma única operação; o histórico e os dados das tarefas são preservados.` : "A lista está vazia e será removida. Esta ação não pode ser desfeita."}</DialogDescription></DialogHeader>{storedTaskCount > 0 ? <div className="space-y-2"><Label>Transferir tarefas para</Label><Select value={transferTargetId} onValueChange={(value) => setTransferTargetId(value ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Selecione uma lista de destino" /></SelectTrigger><SelectContent>{lists.filter((item) => item.id !== list.id).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div> : null}<DialogFooter><Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button><Button variant="destructive" onClick={() => void deleteList()} disabled={storedTasksResource.loading || (storedTaskCount > 0 && !transferTargetId)}>Transferir e excluir</Button></DialogFooter></DialogContent></Dialog>
  </>;
}

function ListMetric({ icon, label, value, tone = "blue" }: { icon: React.ReactNode; label: string; value: number; tone?: "blue" | "green" | "violet" | "red" }) {
  const tones = { blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400", green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400", red: "bg-destructive/10 text-destructive" };
  return <Card className="shadow-none"><CardContent className="flex items-center gap-3 p-4"><span className={cn("grid size-10 place-items-center rounded-xl", tones[tone])}>{icon}</span><div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}

function TaskSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return <section className="overflow-hidden rounded-xl border bg-card"><header className="flex items-center justify-between border-b bg-muted/20 px-4 py-3"><h2 className="text-sm font-semibold">{title}</h2><Badge variant="secondary">{count}</Badge></header>{children}</section>;
}

function SortableTaskRow({ task, children }: { task: TodoTask; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: task.id });
  const handle = <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 touch-none cursor-grab active:cursor-grabbing" aria-label={`Arrastar ${task.title}`} {...attributes} {...listeners}><GripVertical className="size-4" /></Button>;
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "relative z-10 rounded-lg bg-accent/70 opacity-80 shadow-md", isOver && !isDragging && "relative z-[1] rounded-lg outline outline-2 outline-primary/35")}>{children(handle)}</div>;
}

function TaskRow({ task, lists, labels, taskLabelIds, saving, onOpen, onEdit, onDelete, onToggle, onStatus, onPriority, onMove, onLabel, manualOrder, dragHandle }: { task: TodoTask; lists: TodoList[]; labels: TodoLabel[]; taskLabelIds: string[]; saving: boolean; onOpen: () => void; onEdit: () => void; onDelete: () => void; onToggle: () => void; onStatus: (status: "todo" | "in_progress" | "done") => void; onPriority: (priority: string) => void; onMove: (listId: string) => void; onLabel: (label: TodoLabel, checked: boolean) => void; manualOrder?: { enabled: boolean; index: number; count: number; onMove: (target: number) => void }; dragHandle?: ReactNode }) {
  const done = task.status === "done";
  const currentList = lists.find((list) => list.id === task.list_id);
  const labelNames = labels.filter((label) => taskLabelIds.includes(label.id));
  return <div className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4">
    {dragHandle}
    <button type="button" disabled={saving} onClick={onToggle} aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`} aria-pressed={done} className="grid size-5 shrink-0 place-items-center rounded border border-input text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">{saving ? <LoaderCircle className="size-3.5 animate-spin" /> : done ? <Check className="size-3.5" /> : null}</button>
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className={cn("block break-words text-sm font-medium", done && "text-muted-foreground line-through")}>{task.title}</span><span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">{task.description ? <span className="max-w-md truncate">{task.description}</span> : null}{currentList ? <span className="inline-flex items-center gap-1"><ListTodo className="size-3" />{currentList.name}</span> : null}{task.due_on ? <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{humanDate(task.due_on)}</span> : null}{task.due_at ? <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(task.due_at))}</span> : null}{labelNames.map((label) => <Badge key={label.id} variant="outline" className="h-5 px-1.5 text-[10px]">{label.name}</Badge>)}</span></button>
    {task.status === "in_progress" ? <Badge variant="outline" className="hidden sm:inline-flex">Em andamento</Badge> : null}
    <Badge variant={task.priority === "high" ? "destructive" : "secondary"} className="hidden sm:inline-flex">{task.priority === "high" ? "Alta" : task.priority === "low" ? "Baixa" : "Média"}</Badge>
    <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Ações de ${task.title}`}><MoreHorizontal /></Button>} /><DropdownMenuContent align="end">
      {manualOrder ? <>
        <DropdownMenuItem disabled={!manualOrder.enabled || saving || manualOrder.index === 0} onClick={() => manualOrder.onMove(manualOrder.index - 1)}><ArrowUp />Mover para cima</DropdownMenuItem>
        <DropdownMenuItem disabled={!manualOrder.enabled || saving || manualOrder.index >= manualOrder.count - 1} onClick={() => manualOrder.onMove(manualOrder.index + 1)}><ArrowDown />Mover para baixo</DropdownMenuItem>
        <DropdownMenuItem disabled={!manualOrder.enabled || saving || manualOrder.index === 0} onClick={() => manualOrder.onMove(0)}><ChevronsUp />Mover para o início</DropdownMenuItem>
        <DropdownMenuItem disabled={!manualOrder.enabled || saving || manualOrder.index >= manualOrder.count - 1} onClick={() => manualOrder.onMove(manualOrder.count - 1)}><ChevronsDown />Mover para o final</DropdownMenuItem>
      </> : null}
      <DropdownMenuItem onClick={onOpen}>Abrir detalhes</DropdownMenuItem><DropdownMenuItem onClick={onEdit}><Pencil />Editar tarefa</DropdownMenuItem><DropdownMenuItem disabled={saving} onClick={onDelete}><Archive />Arquivar…</DropdownMenuItem><DropdownMenuItem disabled={saving} onClick={onDelete}><Trash2 />Mover para a lixeira…</DropdownMenuItem><DropdownMenuSub><DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger><DropdownMenuSubContent>{([{ value: "todo", label: "Pendente" }, { value: "in_progress", label: "Em andamento" }, { value: "done", label: "Concluída" }] as const).map((item) => <DropdownMenuItem key={item.value} disabled={task.status === item.value || saving} onClick={() => onStatus(item.value)}>{task.status === item.value ? <Check /> : null}{item.label}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub><DropdownMenuSub><DropdownMenuSubTrigger>Prioridade</DropdownMenuSubTrigger><DropdownMenuSubContent>{priorities.map((item) => <DropdownMenuItem key={item.value} disabled={task.priority === item.value || saving} onClick={() => onPriority(item.value)}>{task.priority === item.value ? <Check /> : null}{item.label}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub><DropdownMenuSub><DropdownMenuSubTrigger>Mover para lista</DropdownMenuSubTrigger><DropdownMenuSubContent>{lists.map((list) => <DropdownMenuItem key={list.id} disabled={list.id === task.list_id || saving} onClick={() => onMove(list.id)}>{list.id === task.list_id ? <Check /> : null}{list.name}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>{labels.length ? <DropdownMenuSub><DropdownMenuSubTrigger>Etiquetas</DropdownMenuSubTrigger><DropdownMenuSubContent>{labels.map((label) => <DropdownMenuCheckboxItem key={label.id} checked={taskLabelIds.includes(label.id)} onCheckedChange={(checked) => onLabel(label, checked)}>{label.name}</DropdownMenuCheckboxItem>)}</DropdownMenuSubContent></DropdownMenuSub> : null}<DropdownMenuItem onClick={onToggle}>{done ? <Circle /> : <CheckCircle2 />}{done ? "Reabrir" : "Concluir"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </div>;
}
