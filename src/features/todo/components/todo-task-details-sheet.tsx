"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDown, ArrowUp, CalendarDays, Clock3, History, LoaderCircle, Plus, Repeat2, RotateCcw, Save, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { loadTodoTaskDetailsAction, saveTodoTaskDetailsAction, todoTaskAction } from "@/features/todo/actions";
import { todoTaskDetailsSchema } from "@/features/todo/domain/schemas";
import type { TodoActivityLog, TodoLabel, TodoList, TodoSubtask, TodoTask, TodoTaskLabel, TodoWorkspace } from "@/features/todo/domain/types";
import type { TodoRecurrenceConfig } from "@/features/todo/domain/recurrence";
import { TodoRecurrenceFields } from "@/features/todo/components/todo-recurrence-fields";
import { TodoTaskLifecycleDialog, type TodoTaskLifecycleAction } from "@/features/todo/components/todo-task-lifecycle-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type EditableSubtask = { id?: string; title: string; isCompleted: boolean };
type DetailData = { task: TodoTask; subtasks: TodoSubtask[]; taskLabels: TodoTaskLabel[]; labels: TodoLabel[]; activity: TodoActivityLog[]; list: TodoList | null; workspace: TodoWorkspace | null; recurrence: { rule: import("@/lib/supabase/database.types").Tables<"todo_recurrence_rules">; config: TodoRecurrenceConfig } | null };
type TodoTaskDetailsSheetProps = {
  task: TodoTask | null;
  list?: TodoList;
  workspace?: TodoWorkspace;
  lists: TodoList[];
  workspaces: TodoWorkspace[];
  onSelectTask: (taskId: string) => void;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
};

function dateFromKey(key: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return undefined;
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function dateKey(date?: Date): string { return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : ""; }
function localTime(iso: string | null): string { return iso ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) : ""; }
function activityText(item: TodoActivityLog): string {
  const metadata = item.metadata as Record<string, unknown>;
  if (metadata.entity === "subtask" && metadata.change === "added") return `Você adicionou a etapa “${String(metadata.title ?? "Subtarefa")}”.`;
  if (item.action === "created") return "Tarefa criada.";
  if (item.action === "completed") return "Tarefa concluída.";
  if (item.action === "reopened") return "Tarefa reaberta.";
  if (item.action === "archived") return "Tarefa arquivada.";
  if (item.action === "restored") return "Tarefa restaurada.";
  if (item.action === "soft_deleted") return "Tarefa movida para a lixeira.";
  if (item.action === "status_changed") return "Status atualizado.";
  if (metadata.priority && typeof metadata.priority === "object") return "Prioridade alterada.";
  if (metadata.due_on || metadata.due_at) return "Prazo atualizado.";
  if (metadata.list_id) return "Lista da tarefa alterada.";
  if (metadata.workspace_id) return "Workspace atualizado.";
  return "Detalhes da tarefa atualizados.";
}
function DateField({ id, label, value, onChange, minimum, clearable = true }: { id: string; label: string; value: string; onChange: (value: string) => void; minimum?: Date; clearable?: boolean }) {
  const selected = dateFromKey(value);
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label><div className="flex gap-1"><Popover><PopoverTrigger render={<Button id={id} type="button" variant="outline" className="w-full min-w-0 justify-start gap-2 overflow-hidden font-normal" />}><CalendarDays className="size-4 shrink-0 text-muted-foreground" />{selected ? <span className="truncate">{format(selected, "PPP", { locale: ptBR })}</span> : <span className="truncate text-muted-foreground">Selecione uma data</span>}</PopoverTrigger><PopoverContent align="start" className="w-auto p-0"><Calendar mode="single" selected={selected} onSelect={(next) => onChange(dateKey(next))} disabled={minimum ? { before: minimum } : undefined} locale={ptBR} /></PopoverContent></Popover>{clearable && value ? <Button type="button" variant="ghost" size="icon" aria-label={`Limpar ${label}`} onClick={() => onChange("")}><span aria-hidden="true">×</span></Button> : null}</div></div>;
}

export function TodoTaskDetailsSheet({ task, list, lists, workspaces, onSelectTask, onOpenChange, onSaved }: TodoTaskDetailsSheetProps) {
  const [details, setDetails] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("none");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [status, setStatus] = useState<"todo" | "in_progress" | "done">("todo");
  const [startsOn, setStartsOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [recurrence, setRecurrence] = useState<TodoRecurrenceConfig | null>(null);
  const [recurrenceScope, setRecurrenceScope] = useState<"occurrence" | "following" | "series">("occurrence");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [subtasks, setSubtasks] = useState<EditableSubtask[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [conflictDetected, setConflictDetected] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const saveLock = useRef(false);
  const historyEntry = useRef<string | null>(null);
  const handledDeepLink = useRef(false);
  const handlingPop = useRef(false);
  const activeTaskId = task?.id ?? null;
  const isDeleted = Boolean(details?.task.deleted_at);
  const isArchived = Boolean(details?.task.archived_at);
  const isUnavailable = isDeleted || isArchived;
  const showingLoading = Boolean(activeTaskId && (loading || details?.task.id !== activeTaskId) && !loadError);

  useEffect(() => {
    if (handledDeepLink.current || typeof window === "undefined") return;
    handledDeepLink.current = true;
    const requestedTaskId = new URLSearchParams(window.location.search).get("task");
    if (requestedTaskId && requestedTaskId !== activeTaskId) onSelectTask(requestedTaskId);
  }, [activeTaskId, onSelectTask]);

  useEffect(() => {
    if (!activeTaskId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true); setLoadError(null); setDirty(false); setConflictDetected(false); setExpandedSections([]);
      return loadTodoTaskDetailsAction({ taskId: activeTaskId }).then((result) => {
        if (!active) return;
        if (!result.ok) { setLoadError(result.message); return; }
        const loaded = result.data as DetailData | null;
        if (!loaded) { setLoadError("Esta tarefa não existe ou não está disponível para sua conta."); return; }
        hydrateDetails(loaded);
      }).catch(() => { if (active) setLoadError("Não foi possível carregar os dados desta tarefa. Tente novamente."); }).finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; };
  }, [activeTaskId]);

  useEffect(() => {
    if (!activeTaskId || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const existing = url.searchParams.get("task");
    if (existing !== activeTaskId) {
      url.searchParams.set("task", activeTaskId);
      window.history.pushState({ ...(window.history.state ?? {}), todoTaskDetails: activeTaskId }, "", url);
      historyEntry.current = activeTaskId;
    }
    const onPopState = () => {
      if (historyEntry.current) {
        handlingPop.current = true;
        historyEntry.current = null;
        onOpenChange(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [activeTaskId, onOpenChange]);

  function change<T>(setter: (value: T) => void, value: T) { setter(value); setDirty(true); }
  function hydrateDetails(loaded: DetailData) {
    setDetails(loaded);
    setTitle(loaded.task.title);
    setDescription(loaded.task.description ?? "");
    setListId(loaded.task.list_id);
    setWorkspaceId(loaded.task.workspace_id ?? "none");
    setPriority(loaded.task.priority as "low" | "medium" | "high");
    setStatus(loaded.task.status as "todo" | "in_progress" | "done");
    setStartsOn(loaded.task.starts_on);
    setDueOn(loaded.task.due_on ?? "");
    setDueTime(localTime(loaded.task.due_at));
    setRecurrence(loaded.recurrence?.config ?? null);
    setRecurrenceScope("occurrence");
    setSelectedLabels(loaded.taskLabels.map((item) => item.label_id));
    setNewLabels([]); setLabelDraft("");
    setSubtaskDraft("");
    setSubtasks(loaded.subtasks.map((item) => ({ id: item.id, title: item.title, isCompleted: item.is_completed })));
    setDirty(false); setConflictDetected(false);
  }
  function closeSheet(force = false) {
    if (saving || deleting || restoring) return;
    if (dirty && !force) { setConfirmDiscard(true); return; }
    if (historyEntry.current && !handlingPop.current) {
      historyEntry.current = null;
      onOpenChange(false);
      window.history.back();
      return;
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("task") === activeTaskId) {
        url.searchParams.delete("task");
        window.history.replaceState(window.history.state, "", url);
      }
    }
    handlingPop.current = false;
    onOpenChange(false);
  }
  function addLabel() {
    const normalized = labelDraft.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const existing = details?.labels.find((item) => item.name.toLocaleLowerCase("pt-BR") === normalized.toLocaleLowerCase("pt-BR"));
    if (existing) setSelectedLabels((current) => current.includes(existing.id) ? current : [...current, existing.id]);
    else setNewLabels((current) => current.some((item) => item.toLocaleLowerCase("pt-BR") === normalized.toLocaleLowerCase("pt-BR")) ? current : [...current, normalized]);
    setLabelDraft(""); setDirty(true);
  }
  function addSubtask() {
    const normalized = subtaskDraft.trim();
    if (!normalized || subtasks.length >= 50) return;
    setSubtasks((current) => [...current, { title: normalized, isCompleted: false }]);
    setSubtaskDraft(""); setDirty(true);
  }
  function moveSubtask(index: number, target: number) {
    if (target < 0 || target >= subtasks.length || target === index) return;
    setSubtasks((current) => { const next = [...current]; const [item] = next.splice(index, 1); next.splice(target, 0, item); return next; });
    setDirty(true);
  }
  async function reloadLatestDetails() {
    if (!details) return;
    setLoading(true);
    try {
      const result = await loadTodoTaskDetailsAction({ taskId: details.task.id });
      if (!result.ok || !result.data) { toast.error(result.ok ? "Esta tarefa não está mais disponível." : result.message); return; }
      hydrateDetails(result.data as DetailData);
      toast.success("Versão atual carregada.");
    } catch { toast.error("Não foi possível carregar a versão atual."); }
    finally { setLoading(false); }
  }
  async function save() {
    if (!details || saveLock.current || saving || isUnavailable) return;
    const dueAt = dueOn && dueTime ? (() => { const [year, month, day] = dueOn.split("-").map(Number); const [hours, minutes] = dueTime.split(":").map(Number); return new Date(year, month - 1, day, hours, minutes).toISOString(); })() : null;
    const parsed = todoTaskDetailsSchema.safeParse({ id: details.task.id, expectedUpdatedAt: details.task.updated_at, title, description: description.trim() || null, listId, workspaceId: workspaceId === "none" ? null : workspaceId, priority, status, startsOn, dueOn: dueOn || null, dueAt, labelIds: selectedLabels, newLabels, subtasks, recurrence, recurrenceScope });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Confira os dados da tarefa."); return; }
    saveLock.current = true; setSaving(true);
    try {
      const result = await saveTodoTaskDetailsAction(parsed.data);
      if (!result.ok) { if (result.message.includes("alterada em outra sessão") || result.message.includes("Task changed since it was opened")) setConflictDetected(true); toast.error(result.message.includes("Task changed since it was opened") ? "A tarefa mudou em outra sessão. Recarregue a versão atual antes de salvar." : result.message); return; }
      setDirty(false); toast.success("Alterações salvas.");
      try { await onSaved(); } catch { toast.warning("A tarefa foi salva, mas algumas listas ainda não atualizaram."); }
      let reloaded;
      try { reloaded = await loadTodoTaskDetailsAction({ taskId: details.task.id }); }
      catch { setConflictDetected(true); toast.warning("A tarefa foi salva, mas os detalhes precisam ser recarregados."); return; }
      if (reloaded.ok && reloaded.data) hydrateDetails(reloaded.data as DetailData);
      else { setConflictDetected(true); toast.warning("A tarefa foi salva, mas os detalhes precisam ser recarregados."); }
    } catch { toast.error("Não foi possível salvar. Seus dados continuam nesta tela para você tentar novamente."); }
    finally { saveLock.current = false; setSaving(false); }
  }
  async function applyLifecycle(action: TodoTaskLifecycleAction): Promise<boolean> {
    if (!details || dirty) { if (dirty) toast.error("Salve ou descarte as alterações antes de arquivar ou excluir."); return false; }
    setDeleting(true);
    try {
      const result = await todoTaskAction({ operation: action, id: details.task.id });
      if (!result.ok) { toast.error(result.message); return false; }
      setConfirmDelete(false); setDirty(false); toast.success(action === "archive" ? "Tarefa arquivada." : "Tarefa movida para a lixeira.");
      try { await onSaved(); } catch { toast.warning("A tarefa foi excluída, mas algumas listas ainda não atualizaram."); }
      onOpenChange(false);
      return true;
    } catch { toast.error(action === "archive" ? "Não foi possível arquivar a tarefa." : "Não foi possível mover a tarefa para a lixeira."); return false; }
    finally { setDeleting(false); }
  }
  async function restoreTask() {
    if (!details) return;
    setRestoring(true);
    try {
      const result = await todoTaskAction({ operation: "restore", id: details.task.id });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Tarefa restaurada."); await onSaved(); onOpenChange(false);
    } catch { toast.error("Não foi possível restaurar a tarefa."); }
    finally { setRestoring(false); }
  }

  const startDate = dateFromKey(startsOn);
  const labelItems = details?.labels ?? [];
  const statusItems = [{ value: "todo", label: "Pendente" }, { value: "in_progress", label: "Em andamento" }, { value: "done", label: "Concluída" }];
  const priorityItems = [{ value: "low", label: "Baixa" }, { value: "medium", label: "Média" }, { value: "high", label: "Alta" }];
  const displayList = lists.find((item) => item.id === listId) ?? details?.list ?? list;
  const dateTimeNow = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return <>
    <Sheet open={Boolean(task)} onOpenChange={(open) => { if (open) onOpenChange(true); else closeSheet(); }}>
      <SheetContent side="right" showCloseButton={false} className="data-[side=right]:w-screen data-[side=right]:sm:w-[min(100vw,44rem)] data-[side=right]:sm:max-w-2xl gap-0 p-0">
        {!task ? null : <>
          <SheetHeader className="border-b px-4 pb-3 pt-4 sm:px-5">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0 truncate text-xs text-muted-foreground">{displayList?.name ?? "Lista"} <span className="px-1">/</span> Tarefa</div>
              <Button type="button" variant="ghost" size="icon" aria-label="Fechar detalhes" onClick={() => closeSheet()} className="size-8 shrink-0">×</Button>
            </div>
            {showingLoading ? <><Skeleton className="h-8 w-4/5" /><Skeleton className="h-4 w-2/3" /></> : loadError ? <><SheetTitle>Não foi possível abrir a tarefa</SheetTitle><SheetDescription>{loadError}</SheetDescription></> : details ? <>
              <div className="flex min-w-0 items-center gap-2 pt-1">
                <Checkbox checked={status === "done"} disabled={isUnavailable} aria-label={status === "done" ? "Reabrir tarefa" : "Concluir tarefa"} onCheckedChange={(checked) => change(setStatus, checked ? "done" : "todo")} className="size-5 shrink-0" />
                <div className="min-w-0 flex-1"><Input aria-label="Título da tarefa" maxLength={240} value={title} disabled={isUnavailable} onChange={(event) => change(setTitle, event.target.value)} className="h-9 border-transparent px-2 text-base font-semibold shadow-none focus-visible:border-input" /><SheetTitle className="sr-only">{title}</SheetTitle><SheetDescription className="sr-only">Edite os dados, subtarefas e etiquetas da tarefa.</SheetDescription></div>
                <Select items={statusItems} value={status} disabled={isUnavailable} onValueChange={(value) => { if (value === "todo" || value === "in_progress" || value === "done") change(setStatus, value); }}><SelectTrigger aria-label="Status da tarefa" className="w-32 shrink-0"><SelectValue /></SelectTrigger><SelectContent>{statusItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
              </div>
      {isDeleted ? <Badge variant="destructive" className="mt-1 w-fit">Na lixeira</Badge> : isArchived ? <Badge variant="secondary" className="mt-1 w-fit">Arquivada</Badge> : null}
            </> : null}
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {showingLoading ? <div className="space-y-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> : loadError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div> : details ? <>
              {conflictDetected ? <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><p>Outra sessão salvou uma versão mais recente. Seu rascunho está preservado; carregue a versão atual para continuar.</p><Button type="button" size="sm" variant="outline" className="self-start" disabled={loading} onClick={() => void reloadLatestDetails()}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Descartar rascunho e recarregar</Button></div> : null}
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5"><Label>Lista</Label><Select items={lists.map((item) => ({ value: item.id, label: item.name }))} value={listId} disabled={isUnavailable} onValueChange={(value) => change(setListId, value ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Selecione uma lista" /></SelectTrigger><SelectContent>{lists.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="min-w-0 space-y-1.5"><Label>Workspace <span className="font-normal text-muted-foreground">(opcional)</span></Label><Select items={[{ value: "none", label: "Sem workspace" }, ...workspaces.map((item) => ({ value: item.id, label: item.name }))]} value={workspaceId} disabled={isUnavailable} onValueChange={(value) => change(setWorkspaceId, value ?? "none")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem workspace</SelectItem>{workspaces.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="min-w-0 space-y-1.5"><Label>Prioridade</Label><Select items={priorityItems} value={priority} disabled={isUnavailable} onValueChange={(value) => { if (value === "low" || value === "medium" || value === "high") change(setPriority, value); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{priorityItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                <DateField id="task-details-due" label="Vencimento" value={dueOn} minimum={startDate} onChange={(value) => { change(setDueOn, value); if (!value) setDueTime(""); }} />
              </div>
              <section className="space-y-1.5"><Label htmlFor="task-details-description">Descrição e observações</Label><Textarea id="task-details-description" rows={3} maxLength={10000} value={description} disabled={isUnavailable} onChange={(event) => change(setDescription, event.target.value)} placeholder="Adicione contexto ou próximos passos." /></section>
              <Accordion multiple value={expandedSections} onValueChange={(value) => setExpandedSections(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [])} className="space-y-2">
                <AccordionItem value="more" className="overflow-hidden rounded-lg border bg-card"><AccordionHeader><AccordionTrigger className="min-h-12 px-3 py-2"><span className="text-sm font-medium">Mais opções</span></AccordionTrigger></AccordionHeader><AccordionPanel className="space-y-4 px-3 pb-3">
                  <div className="grid gap-3 sm:grid-cols-2"><DateField id="task-details-start" label="Data de início" value={startsOn} clearable={false} onChange={(value) => { change(setStartsOn, value); if (dueOn && value && dueOn < value) setDueOn(""); }} /><div className="min-w-0 space-y-1.5"><Label htmlFor="task-details-time">Horário <span className="font-normal text-muted-foreground">(opcional)</span></Label><div className="relative"><Clock3 className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="task-details-time" type="time" value={dueTime} disabled={isUnavailable || !dueOn} onChange={(event) => change(setDueTime, event.target.value)} className="pl-9" /></div><p className="text-xs text-muted-foreground">Usa o fuso local do dispositivo.</p></div></div>
                  <section className="space-y-2"><div className="flex items-center gap-2"><Tag className="size-4 text-muted-foreground" /><h3 className="text-sm font-medium">Etiquetas</h3></div>{labelItems.length ? <div className="flex flex-wrap gap-2">{labelItems.map((label) => <label key={label.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm"><Checkbox checked={selectedLabels.includes(label.id)} disabled={isUnavailable} onCheckedChange={(checked) => change(setSelectedLabels, checked ? [...selectedLabels, label.id] : selectedLabels.filter((id) => id !== label.id))} />{label.name}</label>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma etiqueta criada ainda.</p>}<div className="flex min-w-0 gap-2"><Input aria-label="Nome da nova etiqueta" value={labelDraft} maxLength={60} disabled={isUnavailable} placeholder="Criar etiqueta" onChange={(event) => setLabelDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLabel(); } }} /><Button type="button" variant="outline" disabled={isUnavailable || !labelDraft.trim()} onClick={addLabel}><Plus className="size-4" />Adicionar</Button></div>{newLabels.length ? <div className="flex flex-wrap gap-2">{newLabels.map((item) => <Badge key={item} variant="secondary" className="gap-1">{item}<button type="button" disabled={isUnavailable} aria-label={`Remover etiqueta ${item}`} onClick={() => { setNewLabels((current) => current.filter((labelName) => labelName !== item)); setDirty(true); }}>×</button></Badge>)}</div> : null}</section>
                </AccordionPanel></AccordionItem>
                <AccordionItem value="recurrence" className="overflow-hidden rounded-lg border bg-card"><AccordionHeader><AccordionTrigger className="min-h-12 px-3 py-2"><span className="flex items-center gap-2 text-sm font-medium"><Repeat2 className="size-4 text-muted-foreground" />Recorrência</span></AccordionTrigger></AccordionHeader><AccordionPanel className="space-y-3 px-3 pb-3">
                  {details.task.recurrence_rule_id ? <div className="space-y-1.5"><Label htmlFor="todo-recurrence-scope">Aplicar edição a</Label><Select value={recurrenceScope} disabled={isUnavailable} onValueChange={(value) => { if (value === "occurrence" || value === "following" || value === "series") change(setRecurrenceScope, value); }}><SelectTrigger id="todo-recurrence-scope" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="occurrence">Somente esta ocorrência</SelectItem><SelectItem value="following">Esta e as próximas ocorrências</SelectItem><SelectItem value="series">Toda a série</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">Apenas alterações da regra seguem o escopo escolhido. Os dados desta ocorrência são sempre salvos.</p></div> : null}
                  <fieldset disabled={Boolean(details.task.recurrence_rule_id && recurrenceScope === "occurrence")} className="min-w-0 disabled:opacity-60"><TodoRecurrenceFields value={recurrence} startsOn={startsOn} onChange={(value) => { change(setRecurrence, value); if (value && value.startsOn !== startsOn) setStartsOn(value.startsOn); }} /></fieldset>
                </AccordionPanel></AccordionItem>
                <AccordionItem value="subtasks" className="overflow-hidden rounded-lg border bg-card"><AccordionHeader><AccordionTrigger className="min-h-12 px-3 py-2"><span className="flex items-center gap-2 text-sm font-medium">Subtarefas <Badge variant="secondary" className="tabular-nums">{subtasks.filter((item) => item.isCompleted).length}/{subtasks.length}</Badge></span></AccordionTrigger></AccordionHeader><AccordionPanel className="space-y-3 px-3 pb-3">{subtasks.length ? <ul className="space-y-2">{subtasks.map((item, index) => <li key={item.id ?? `new-${index}`} className="flex min-w-0 items-center gap-1.5"><Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Mover ${item.title} para cima`} disabled={isUnavailable || index === 0} onClick={() => moveSubtask(index, index - 1)}><ArrowUp className="size-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Mover ${item.title} para baixo`} disabled={isUnavailable || index === subtasks.length - 1} onClick={() => moveSubtask(index, index + 1)}><ArrowDown className="size-3.5" /></Button><Checkbox checked={item.isCompleted} disabled={isUnavailable} aria-label={`Concluir ${item.title}`} onCheckedChange={(checked) => { setSubtasks((current) => current.map((subtask, subtaskIndex) => subtaskIndex === index ? { ...subtask, isCompleted: checked === true } : subtask)); setDirty(true); }} /><Input value={item.title} maxLength={240} disabled={isUnavailable} aria-label={`Editar subtarefa ${index + 1}`} onChange={(event) => { setSubtasks((current) => current.map((subtask, subtaskIndex) => subtaskIndex === index ? { ...subtask, title: event.target.value } : subtask)); setDirty(true); }} className={item.isCompleted ? "text-muted-foreground line-through" : ""} /><Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Remover ${item.title}`} disabled={isUnavailable} onClick={() => { setSubtasks((current) => current.filter((_, subtaskIndex) => subtaskIndex !== index)); setDirty(true); }}><Trash2 className="size-4 text-muted-foreground" /></Button></li>)}</ul> : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nenhuma subtarefa adicionada.</p>}<div className="flex min-w-0 gap-2"><Input value={subtaskDraft} maxLength={240} disabled={isUnavailable || subtasks.length >= 50} aria-label="Título da nova subtarefa" placeholder="Adicionar uma etapa" onChange={(event) => setSubtaskDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSubtask(); } }} /><Button type="button" variant="outline" disabled={isUnavailable || !subtaskDraft.trim() || subtasks.length >= 50} onClick={addSubtask}><Plus className="size-4" />Adicionar</Button></div></AccordionPanel></AccordionItem>
                <AccordionItem value="history" className="overflow-hidden rounded-lg border bg-card"><AccordionHeader><AccordionTrigger className="min-h-12 px-3 py-2"><span className="flex items-center gap-2 text-sm font-medium"><History className="size-4 text-muted-foreground" />Histórico</span></AccordionTrigger></AccordionHeader><AccordionPanel className="space-y-3 px-3 pb-3"><div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground"><p>Criada em {dateTimeNow(details.task.created_at)}</p><p className="mt-1">Atualizada em {dateTimeNow(details.task.updated_at)}</p></div>{details.activity.length ? <ol className="space-y-3">{details.activity.map((item) => <li key={item.id} className="flex min-w-0 gap-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/70" /><div className="min-w-0 flex-1"><p className="break-words text-sm">{activityText(item)}</p><time className="mt-0.5 block text-xs text-muted-foreground" dateTime={item.created_at}>{dateTimeNow(item.created_at)}</time></div></li>)}</ol> : <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>}</AccordionPanel></AccordionItem>
              </Accordion>
            </> : null}
          </div>
          {details && !showingLoading && !loadError ? <SheetFooter className="sticky bottom-0 z-10 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-5">
            {isUnavailable ? <div className="flex w-full flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" className="flex-1" disabled={restoring} onClick={() => void restoreTask()}>{restoring ? <><LoaderCircle className="size-4 animate-spin" />Restaurando…</> : <><RotateCcw className="size-4" />Restaurar tarefa</>}</Button></div> : <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button type="button" variant="ghost" className="text-destructive hover:text-destructive sm:mr-auto" disabled={saving || deleting || dirty} title={dirty ? "Salve ou cancele as alterações antes de arquivar" : undefined} onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />Arquivar ou excluir</Button><div className="flex gap-2"><Button type="button" variant="outline" disabled={saving || deleting} onClick={() => closeSheet()}>Cancelar</Button><Button type="button" disabled={saving || deleting || !dirty || conflictDetected} onClick={() => void save()}>{saving ? <><LoaderCircle className="size-4 animate-spin" />Salvando…</> : <><Save className="size-4" />Salvar alterações</>}</Button></div></div>}
          </SheetFooter> : null}
        </>}
      </SheetContent>
    </Sheet>
    <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Descartar alterações?</AlertDialogTitle><AlertDialogDescription>As alterações ainda não foram salvas e serão perdidas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => { if (activeTaskId && typeof window !== "undefined") { const url = new URL(window.location.href); if (!url.searchParams.has("task")) { url.searchParams.set("task", activeTaskId); window.history.replaceState(window.history.state, "", url); } } }}>Continuar editando</AlertDialogCancel><AlertDialogAction onClick={() => { setConfirmDiscard(false); setDirty(false); closeSheet(true); }}>Descartar alterações</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <TodoTaskLifecycleDialog open={confirmDelete} taskTitle={details?.task.title} onOpenChange={setConfirmDelete} onConfirm={applyLifecycle} />
  </>;
}
