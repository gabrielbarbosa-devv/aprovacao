"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, CalendarDays, LoaderCircle, Plus, RotateCcw, Save, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { loadTodoTaskDetailsAction, saveTodoTaskDetailsAction, todoTaskAction } from "@/features/todo/actions";
import { todoTaskDetailsSchema } from "@/features/todo/domain/schemas";
import type { TodoActivityLog, TodoLabel, TodoList, TodoSubtask, TodoTask, TodoTaskLabel, TodoWorkspace } from "@/features/todo/domain/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type EditableSubtask = { id?: string; title: string; isCompleted: boolean };
type DetailData = { task: TodoTask; subtasks: TodoSubtask[]; taskLabels: TodoTaskLabel[]; labels: TodoLabel[]; activity: TodoActivityLog[]; list: TodoList | null; workspace: TodoWorkspace | null };
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

export function TodoTaskDetailsSheet({ task, list, workspace, lists, workspaces, onSelectTask, onOpenChange, onSaved }: TodoTaskDetailsSheetProps) {
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
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [subtasks, setSubtasks] = useState<EditableSubtask[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [dirty, setDirty] = useState(false);
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
      setLoading(true); setLoadError(null); setDirty(false);
      return loadTodoTaskDetailsAction({ taskId: activeTaskId }).then((result) => {
        if (!active) return;
        if (!result.ok) { setLoadError(result.message); return; }
        const loaded = result.data as DetailData | null;
        if (!loaded) { setLoadError("Esta tarefa não existe ou não está disponível para sua conta."); return; }
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
        setSelectedLabels(loaded.taskLabels.map((item) => item.label_id));
        setNewLabels([]); setLabelDraft("");
        setSubtasks(loaded.subtasks.map((item) => ({ id: item.id, title: item.title, isCompleted: item.is_completed })));
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
  async function save() {
    if (!details || saveLock.current || saving || isDeleted) return;
    const dueAt = dueOn && dueTime ? (() => { const [year, month, day] = dueOn.split("-").map(Number); const [hours, minutes] = dueTime.split(":").map(Number); return new Date(year, month - 1, day, hours, minutes).toISOString(); })() : null;
    const parsed = todoTaskDetailsSchema.safeParse({ id: details.task.id, title, description: description.trim() || null, listId, workspaceId: workspaceId === "none" ? null : workspaceId, priority, status, startsOn, dueOn: dueOn || null, dueAt, labelIds: selectedLabels, newLabels, subtasks });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Confira os dados da tarefa."); return; }
    saveLock.current = true; setSaving(true);
    try {
      const result = await saveTodoTaskDetailsAction(parsed.data);
      if (!result.ok) { toast.error(result.message); return; }
      setDirty(false); toast.success("Alterações salvas.");
      try { await onSaved(); } catch { toast.warning("A tarefa foi salva, mas algumas listas ainda não atualizaram."); }
      let reloaded;
      try { reloaded = await loadTodoTaskDetailsAction({ taskId: details.task.id }); }
      catch { toast.warning("A tarefa foi salva, mas os detalhes precisam ser recarregados."); return; }
      if (reloaded.ok && reloaded.data) {
        const loaded = reloaded.data as DetailData;
        setDetails(loaded); setSelectedLabels(loaded.taskLabels.map((item) => item.label_id));
        setNewLabels([]); setSubtasks(loaded.subtasks.map((item) => ({ id: item.id, title: item.title, isCompleted: item.is_completed })));
      }
    } catch { toast.error("Não foi possível salvar. Seus dados continuam nesta tela para você tentar novamente."); }
    finally { saveLock.current = false; setSaving(false); }
  }
  async function removeTask() {
    if (!details) return;
    setDeleting(true);
    try {
      const result = await todoTaskAction({ operation: "soft_delete", id: details.task.id });
      if (!result.ok) { toast.error(result.message); return; }
      setConfirmDelete(false); setDirty(false); toast.success("Tarefa movida para excluídas.", { action: { label: "Desfazer", onClick: () => { void restoreDeletedTask(details.task.id); } } });
      try { await onSaved(); } catch { toast.warning("A tarefa foi excluída, mas algumas listas ainda não atualizaram."); }
      onOpenChange(false);
    } catch { toast.error("Não foi possível excluir a tarefa. Tente novamente."); }
    finally { setDeleting(false); }
  }
  async function restoreDeletedTask(taskId: string) {
    try {
      const result = await todoTaskAction({ operation: "restore", id: taskId });
      if (!result.ok) { toast.error(result.message); return; }
      await onSaved();
      toast.success("Tarefa restaurada.");
    } catch { toast.error("Não foi possível restaurar a tarefa."); }
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
  const displayList = details?.list ?? list;
  const displayWorkspace = details?.workspace ?? workspace;
  const dateTimeNow = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return <>
    <Sheet open={Boolean(task)} onOpenChange={(open) => { if (open) onOpenChange(true); else closeSheet(); }}>
      <SheetContent side="right" showCloseButton={false} className="data-[side=right]:w-[min(100vw,38rem)] data-[side=right]:sm:max-w-xl gap-0 p-0">
        {!task ? null : <>
          <SheetHeader className="border-b px-5 pb-4 pt-5 sm:px-6">
            <div className="flex min-w-0 items-center justify-between gap-3 pr-0">
              <div className="min-w-0 truncate text-xs text-muted-foreground">{displayList?.name ?? "Lista"} <span className="px-1">/</span> Detalhes da tarefa</div>
              <Button type="button" variant="ghost" size="icon" aria-label="Fechar detalhes" onClick={() => closeSheet()}>×</Button>
            </div>
            {showingLoading ? <><Skeleton className="h-8 w-4/5" /><Skeleton className="h-4 w-2/3" /></> : loadError ? <><SheetTitle>Não foi possível abrir a tarefa</SheetTitle><SheetDescription>{loadError}</SheetDescription></> : details ? <>
              <div className="flex items-start gap-3 pt-1">
                <Checkbox checked={status === "done"} disabled={isDeleted} aria-label={status === "done" ? "Reabrir tarefa" : "Concluir tarefa"} onCheckedChange={(checked) => change(setStatus, checked ? "done" : "todo")} className="mt-1 size-5" />
                <div className="min-w-0 flex-1 space-y-1"><Input aria-label="Título da tarefa" maxLength={240} value={title} disabled={isDeleted} onChange={(event) => change(setTitle, event.target.value)} className="h-auto border-transparent px-1 py-0 text-lg font-semibold shadow-none focus-visible:border-input" /><SheetTitle className="sr-only">{title}</SheetTitle><SheetDescription className="sr-only">Edite os dados, subtarefas e etiquetas da tarefa.</SheetDescription></div>
                <Select items={statusItems} value={status} disabled={isDeleted} onValueChange={(value) => { if (value === "todo" || value === "in_progress" || value === "done") change(setStatus, value); }}><SelectTrigger aria-label="Status da tarefa" className="w-36"><SelectValue /></SelectTrigger><SelectContent>{statusItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
              </div>
              {isDeleted ? <Badge variant="destructive" className="mt-2 w-fit">Excluída</Badge> : null}
            </> : null}
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {showingLoading ? <div className="space-y-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> : loadError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div> : details ? <>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2"><Label>Lista</Label><Select items={lists.map((item) => ({ value: item.id, label: item.name }))} value={listId} disabled={isDeleted} onValueChange={(value) => change(setListId, value ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Selecione uma lista" /></SelectTrigger><SelectContent>{lists.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="min-w-0 space-y-2"><Label>Workspace</Label><Select items={[{ value: "none", label: "Sem workspace" }, ...workspaces.map((item) => ({ value: item.id, label: item.name }))]} value={workspaceId} disabled={isDeleted} onValueChange={(value) => change(setWorkspaceId, value ?? "none")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem workspace</SelectItem>{workspaces.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="min-w-0 space-y-2"><Label>Prioridade</Label><Select items={priorityItems} value={priority} disabled={isDeleted} onValueChange={(value) => { if (value === "low" || value === "medium" || value === "high") change(setPriority, value); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{priorityItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                <DateField id="task-details-start" label="Data de início" value={startsOn} clearable={false} onChange={(value) => { change(setStartsOn, value); if (dueOn && value && dueOn < value) setDueOn(""); }} />
                <DateField id="task-details-due" label="Vencimento" value={dueOn} minimum={startDate} onChange={(value) => { change(setDueOn, value); if (!value) setDueTime(""); }} />
                <div className="min-w-0 space-y-2"><Label htmlFor="task-details-time">Horário <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="task-details-time" type="time" value={dueTime} disabled={isDeleted || !dueOn} onChange={(event) => change(setDueTime, event.target.value)} /><p className="text-xs text-muted-foreground">Usa o fuso local do dispositivo.</p></div>
              </div>
              <section className="space-y-2"><Label htmlFor="task-details-description">Descrição e anotações</Label><Textarea id="task-details-description" rows={4} maxLength={10000} value={description} disabled={isDeleted} onChange={(event) => change(setDescription, event.target.value)} placeholder="Adicione contexto ou próximos passos." /></section>
              <section className="space-y-3"><div className="flex items-center gap-2"><Tag className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Etiquetas</h3></div>{labelItems.length ? <div className="flex flex-wrap gap-2">{labelItems.map((label) => <label key={label.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm"><Checkbox checked={selectedLabels.includes(label.id)} disabled={isDeleted} onCheckedChange={(checked) => change(setSelectedLabels, checked ? [...selectedLabels, label.id] : selectedLabels.filter((id) => id !== label.id))} />{label.name}</label>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma etiqueta criada ainda.</p>}<div className="flex min-w-0 gap-2"><Input aria-label="Nome da nova etiqueta" value={labelDraft} maxLength={60} disabled={isDeleted} placeholder="Criar etiqueta" onChange={(event) => setLabelDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLabel(); } }} /><Button type="button" variant="outline" disabled={isDeleted || !labelDraft.trim()} onClick={addLabel}><Plus className="size-4" />Adicionar</Button></div>{newLabels.length ? <div className="flex flex-wrap gap-2">{newLabels.map((item) => <Badge key={item} variant="secondary" className="gap-1">{item}<button type="button" disabled={isDeleted} aria-label={`Remover etiqueta ${item}`} onClick={() => { setNewLabels((current) => current.filter((labelName) => labelName !== item)); setDirty(true); }}>×</button></Badge>)}</div> : null}</section>
              <Separator />
              <section className="space-y-3"><div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Subtarefas</h3><p className="text-xs text-muted-foreground">{subtasks.filter((item) => item.isCompleted).length} de {subtasks.length} concluídas</p></div><span className="text-xs text-muted-foreground">{subtasks.length}/50</span></div>{subtasks.length ? <ul className="space-y-2">{subtasks.map((item, index) => <li key={item.id ?? `new-${index}`} className="flex min-w-0 items-center gap-2"><Checkbox checked={item.isCompleted} disabled={isDeleted} aria-label={`Concluir ${item.title}`} onCheckedChange={(checked) => { setSubtasks((current) => current.map((subtask, subtaskIndex) => subtaskIndex === index ? { ...subtask, isCompleted: checked === true } : subtask)); setDirty(true); }} /><Input value={item.title} maxLength={240} disabled={isDeleted} aria-label={`Editar subtarefa ${index + 1}`} onChange={(event) => { setSubtasks((current) => current.map((subtask, subtaskIndex) => subtaskIndex === index ? { ...subtask, title: event.target.value } : subtask)); setDirty(true); }} className={item.isCompleted ? "text-muted-foreground line-through" : ""} /><Button type="button" variant="ghost" size="icon" aria-label={`Remover ${item.title}`} disabled={isDeleted} onClick={() => { setSubtasks((current) => current.filter((_, subtaskIndex) => subtaskIndex !== index)); setDirty(true); }}><Trash2 className="size-4 text-muted-foreground" /></Button></li>)}</ul> : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nenhuma subtarefa adicionada.</p>}<div className="flex min-w-0 gap-2"><Input value={subtaskDraft} maxLength={240} disabled={isDeleted || subtasks.length >= 50} aria-label="Título da nova subtarefa" placeholder="Adicionar uma etapa" onChange={(event) => setSubtaskDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSubtask(); } }} /><Button type="button" variant="outline" disabled={isDeleted || !subtaskDraft.trim() || subtasks.length >= 50} onClick={addSubtask}><Plus className="size-4" />Adicionar</Button></div></section>
              <Separator />
              <section className="space-y-3"><div className="flex items-center gap-2"><Activity className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Histórico de atividades</h3></div>{details.activity.length ? <ol className="space-y-3">{details.activity.map((item) => <li key={item.id} className="flex min-w-0 gap-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/70" /><div className="min-w-0 flex-1"><p className="break-words text-sm">{activityText(item)}</p><time className="mt-0.5 block text-xs text-muted-foreground" dateTime={item.created_at}>{dateTimeNow(item.created_at)}</time></div></li>)}</ol> : <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>}</section>
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground"><p>Criada em {dateTimeNow(details.task.created_at)}</p><p className="mt-1">Atualizada em {dateTimeNow(details.task.updated_at)}</p></div>
              {displayWorkspace ? <p className="text-xs text-muted-foreground">Workspace atual: {displayWorkspace.name}</p> : null}
            </> : null}
          </div>
          {details && !showingLoading && !loadError ? <SheetFooter className="border-t bg-background px-5 py-3 sm:px-6">
            {isDeleted ? <Button type="button" variant="outline" className="w-full" disabled={restoring} onClick={() => void restoreTask()}>{restoring ? <><LoaderCircle className="size-4 animate-spin" />Restaurando…</> : <><RotateCcw className="size-4" />Restaurar tarefa</>}</Button> : <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button type="button" variant="ghost" className="text-destructive hover:text-destructive sm:mr-auto" disabled={saving || deleting} onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />Excluir</Button><div className="flex gap-2"><Button type="button" variant="outline" disabled={saving || deleting} onClick={() => closeSheet()}>Fechar</Button><Button type="button" disabled={saving || deleting || !dirty} onClick={() => void save()}>{saving ? <><LoaderCircle className="size-4 animate-spin" />Salvando…</> : <><Save className="size-4" />Salvar alterações</>}</Button></div></div>}
          </SheetFooter> : null}
        </>}
      </SheetContent>
    </Sheet>
    <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Descartar alterações?</AlertDialogTitle><AlertDialogDescription>As alterações ainda não foram salvas e serão perdidas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => { if (activeTaskId && typeof window !== "undefined") { const url = new URL(window.location.href); if (!url.searchParams.has("task")) { url.searchParams.set("task", activeTaskId); window.history.replaceState(window.history.state, "", url); } } }}>Continuar editando</AlertDialogCancel><AlertDialogAction onClick={() => { setConfirmDiscard(false); setDirty(false); closeSheet(true); }}>Descartar alterações</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir esta tarefa?</AlertDialogTitle><AlertDialogDescription>A tarefa será removida das listas ativas, mas poderá ser restaurada pela experiência de recuperação.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void removeTask(); }}>{deleting ? <><LoaderCircle className="size-4 animate-spin" />Excluindo…</> : <><Trash2 className="size-4" />Excluir tarefa</>}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
