"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDown, ArrowUp, CalendarDays, Check, LoaderCircle, Plus, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { loadTodoLabelsAction, loadTodoSubtasksAction, loadTodoTaskLabelsAction } from "@/features/todo/actions";
import { todoTaskBundleSchema } from "@/features/todo/domain/schemas";
import type { TodoLabel, TodoList, TodoSubtask, TodoTask, TodoTaskLabel, TodoWorkspace } from "@/features/todo/domain/types";
import { localDateKey } from "@/features/todo/domain/dashboard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
import { useTodoTaskFormMutation } from "@/features/todo/hooks/use-todo-task-form-mutation";
import { TodoRecurrenceFields } from "@/features/todo/components/todo-recurrence-fields";
import { type TodoRecurrenceConfig } from "@/features/todo/domain/recurrence";

type TodoTaskFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: TodoList[];
  workspaces: TodoWorkspace[];
  initialDate: string;
  initialListId?: string;
  initialWorkspaceId?: string;
  initialTask?: TodoTask | null;
  initialRecurrence?: TodoRecurrenceConfig | null;
  onCreated: () => Promise<void>;
};
type FormSubtask = { id?: string; title: string; isCompleted: boolean };

function dateFromKey(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(value?: Date): string {
  if (!value) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function DatePickerField({ id, label, value, onChange, disabledBefore, clearable = true }: { id: string; label: string; value: string; onChange: (value: string) => void; disabledBefore?: Date; clearable?: boolean }) {
  const selected = dateFromKey(value);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-1">
        <Popover>
          <PopoverTrigger render={<Button id={id} type="button" variant="outline" className="w-full justify-start gap-2 font-normal" />}>
            <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
            {selected ? format(selected, "PPP", { locale: ptBR }) : <span className="text-muted-foreground">Selecione uma data</span>}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar mode="single" selected={selected} onSelect={(nextDate) => onChange(dateKey(nextDate))} disabled={disabledBefore ? { before: disabledBefore } : undefined} locale={ptBR} />
          </PopoverContent>
        </Popover>
        {clearable && value ? <Button type="button" variant="ghost" size="icon" aria-label={`Limpar ${label.toLowerCase()}`} onClick={() => onChange("")}><X aria-hidden="true" className="size-4" /></Button> : null}
      </div>
    </div>
  );
}

export function TodoTaskFormDialog({ open, onOpenChange, lists, workspaces, initialDate, initialListId, initialWorkspaceId, initialTask = null, initialRecurrence = null, onCreated }: TodoTaskFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("none");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [startsOn, setStartsOn] = useState(initialDate);
  const [dueOn, setDueOn] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [labels, setLabels] = useState<TodoLabel[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [subtasks, setSubtasks] = useState<FormSubtask[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [recurrence, setRecurrence] = useState<TodoRecurrenceConfig | null>(initialRecurrence);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [relationsError, setRelationsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const taskMutation = useTodoTaskFormMutation();
  const submitLock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle(initialTask?.title ?? "");
    setDescription(initialTask?.description ?? "");
    setListId(initialTask?.list_id ?? initialListId ?? lists[0]?.id ?? "");
    setWorkspaceId(initialTask?.workspace_id ?? initialWorkspaceId ?? "none");
    setPriority((initialTask?.priority as "low" | "medium" | "high" | undefined) ?? "medium");
    setStartsOn(initialTask?.starts_on ?? initialDate ?? localDateKey(new Date()));
    setDueOn(initialTask?.due_on ?? "");
    setDueTime(initialTask?.due_at ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(initialTask.due_at)) : "");
    setSelectedLabels([]);
    setLabels([]);
    setNewLabels([]);
    setLabelDraft("");
    setSubtasks([]);
    setSubtaskDraft("");
    setRecurrence(initialRecurrence);
    setValidationError(null);
    setDirty(false);
  };

  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      reset();
      setLoadingRelations(true);
      setRelationsError(null);
      const labelResult = await loadTodoLabelsAction();
      if (!active) return;
      if (labelResult.ok) setLabels(labelResult.data);
      else { setRelationsError("Não foi possível carregar suas etiquetas. Feche e abra o formulário para tentar novamente."); toast.error(labelResult.message); }
      if (initialTask) {
        const [subtaskResult, linkedLabelResult] = await Promise.all([
          loadTodoSubtasksAction({ taskId: initialTask.id }),
          loadTodoTaskLabelsAction({ taskId: initialTask.id }),
        ]);
        if (!active) return;
        if (subtaskResult.ok) setSubtasks(subtaskResult.data.map((subtask: TodoSubtask) => ({ id: subtask.id, title: subtask.title, isCompleted: subtask.is_completed })));
        else { setRelationsError("Não foi possível carregar as subtarefas existentes. Feche e abra o formulário para tentar novamente."); toast.error(subtaskResult.message); }
        if (linkedLabelResult.ok) setSelectedLabels(linkedLabelResult.data.map((link: TodoTaskLabel) => link.label_id));
        else { setRelationsError("Não foi possível carregar as etiquetas existentes. Feche e abra o formulário para tentar novamente."); toast.error(linkedLabelResult.message); }
      }
      if (active) setLoadingRelations(false);
    })();
    return () => { active = false; };
  // The dialog's form is initialized once per opening and task identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTask?.id]);

  useEffect(() => {
    if (open && !loadingRelations) window.requestAnimationFrame(() => titleRef.current?.focus());
  }, [open, loadingRelations]);

  function update<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setDirty(true);
    setValidationError(null);
  }

  function requestClose(nextOpen: boolean) {
    if (nextOpen) { onOpenChange(true); return; }
    if (saving) return;
    if (dirty) { setConfirmDiscard(true); return; }
    reset();
    onOpenChange(false);
  }

  function addLabel() {
    const normalized = labelDraft.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const existing = labels.find((label) => label.name.toLocaleLowerCase() === normalized.toLocaleLowerCase());
    if (existing) setSelectedLabels((current) => current.includes(existing.id) ? current : [...current, existing.id]);
    else setNewLabels((current) => current.some((label) => label.toLocaleLowerCase() === normalized.toLocaleLowerCase()) ? current : [...current, normalized]);
    setLabelDraft("");
    setDirty(true);
  }

  function addSubtask() {
    const normalized = subtaskDraft.trim();
    if (!normalized) return;
    setSubtasks((current) => [...current, { title: normalized, isCompleted: false }]);
    setSubtaskDraft("");
    setDirty(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || saving || taskMutation.pending) return;
    if (initialTask?.recurrence_rule_id && initialRecurrence && !recurrence) {
      const message = "Encerre esta recorrência pela tela Tarefas recorrentes antes de transformar a tarefa em avulsa.";
      setValidationError(message); toast.error(message); return;
    }
    const localDueAt = dueOn && dueTime ? (() => {
      const [year, month, day] = dueOn.split("-").map(Number);
      const [hours, minutes] = dueTime.split(":").map(Number);
      return new Date(year, month - 1, day, hours, minutes).toISOString();
    })() : null;
    const parsed = todoTaskBundleSchema.safeParse({
      id: initialTask?.id ?? null,
      title,
      description: description.trim() || null,
      listId,
      workspaceId: workspaceId === "none" ? null : workspaceId,
      priority,
      startsOn,
      dueOn: dueOn || null,
      dueAt: localDueAt,
      recurrence,
      labelIds: selectedLabels,
      newLabels,
      subtasks,
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Confira os dados informados.";
      setValidationError(message);
      toast.error(message);
      return;
    }
    submitLock.current = true;
    setSaving(true);
    setValidationError(null);
    try {
      const result = await taskMutation.save(parsed.data);
      if (!result.ok) { setValidationError(result.message); toast.error(result.message); return; }
      toast.success(initialTask ? "Tarefa atualizada." : "Tarefa criada.");
      setDirty(false);
      reset();
      onOpenChange(false);
      try { await onCreated(); }
      catch { toast.warning("A tarefa foi salva, mas a tela não conseguiu atualizar agora."); }
    } catch {
      const message = "Não foi possível salvar no Supabase. Seus dados continuam preenchidos; verifique a conexão e tente novamente.";
      setValidationError(message);
      toast.error(message);
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  const listItems = lists.map((list) => ({ value: list.id, label: list.name }));
  const workspaceItems = [{ value: "none", label: "Sem workspace" }, ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))];
  const startDate = dateFromKey(startsOn);
  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="max-h-[min(92dvh,900px)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">{initialTask ? "Editar tarefa" : "Criar nova tarefa"}</DialogTitle>
            <DialogDescription>Organize os detalhes da sua próxima atividade.</DialogDescription>
          </DialogHeader>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="todo-task-title">Título da tarefa <span className="text-destructive">*</span></Label>
              <Input ref={titleRef} id="todo-task-title" autoFocus maxLength={240} required value={title} onChange={(event) => update(setTitle, event.target.value)} placeholder="Ex.: Preparar apresentação do projeto" />
              <p className="text-right text-xs text-muted-foreground">{title.length}/240</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="todo-task-description">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea id="todo-task-description" value={description} onChange={(event) => update(setDescription, event.target.value)} maxLength={10000} rows={3} placeholder="Inclua detalhes que ajudem você a executar esta tarefa." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Lista <span className="text-destructive">*</span></Label>
                <Select items={listItems} value={listId} onValueChange={(value) => update(setListId, value ?? "")}>
                  <SelectTrigger className="w-full" disabled={Boolean(initialListId && !initialTask) || lists.length === 0}><SelectValue placeholder="Selecione uma lista" /></SelectTrigger>
                  <SelectContent>{lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Workspace <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Select items={workspaceItems} value={workspaceId} onValueChange={(value) => update(setWorkspaceId, value ?? "none")}>
                  <SelectTrigger className="w-full" disabled={Boolean(initialWorkspaceId && !initialTask)}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Sem workspace</SelectItem>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade <span className="text-destructive">*</span></Label>
                <Select items={[{ value: "low", label: "Baixa" }, { value: "medium", label: "Média" }, { value: "high", label: "Alta" }]} value={priority} onValueChange={(value) => { if (value === "low" || value === "medium" || value === "high") update(setPriority, value); }}>
                  <SelectTrigger className={cn("w-full", priority === "high" && "text-red-600", priority === "medium" && "text-amber-600", priority === "low" && "text-emerald-600")}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem></SelectContent>
                </Select>
              </div>
              <DatePickerField id="todo-task-start-date" label="Data de início" value={startsOn} onChange={(value) => { update(setStartsOn, value); if (recurrence) setRecurrence({ ...recurrence, startsOn: value }); if (dueOn && value && dueOn < value) setDueOn(""); }} clearable={false} />
              <DatePickerField id="todo-task-date" label="Vencimento" value={dueOn} onChange={(value) => { update(setDueOn, value); if (!value) setDueTime(""); }} disabledBefore={startDate} />
              <div className="space-y-2">
                <Label htmlFor="todo-task-time">Horário <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Input id="todo-task-time" type="time" value={dueTime} disabled={!dueOn} onChange={(event) => update(setDueTime, event.target.value)} />
                <p className="text-xs text-muted-foreground">No fuso local do seu dispositivo.</p>
              </div>
            </div>

            <TodoRecurrenceFields value={recurrence} onChange={(value) => { setRecurrence(value); setDirty(true); }} startsOn={startsOn} />

            <section className="space-y-3 rounded-xl border p-4" aria-labelledby="todo-labels-heading">
              <div className="flex items-center gap-2"><Tag aria-hidden="true" className="size-4 text-muted-foreground" /><h3 id="todo-labels-heading" className="text-sm font-medium">Etiquetas</h3></div>
              {loadingRelations ? <p className="text-sm text-muted-foreground">Carregando etiquetas…</p> : labels.length ? (
                <div className="flex flex-wrap gap-2">{labels.map((label) => <label key={label.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm"><Checkbox checked={selectedLabels.includes(label.id)} onCheckedChange={(checked) => { update(setSelectedLabels, checked ? [...selectedLabels, label.id] : selectedLabels.filter((id) => id !== label.id)); }} />{label.name}</label>)}</div>
              ) : <p className="text-sm text-muted-foreground">Você ainda não tem etiquetas. Crie uma abaixo.</p>}
              <div className="flex gap-2">
                <Input aria-label="Nome da nova etiqueta" value={labelDraft} maxLength={60} placeholder="Adicionar etiqueta" onChange={(event) => { setLabelDraft(event.target.value); setDirty(true); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLabel(); } }} />
                <Button type="button" variant="outline" onClick={addLabel} disabled={!labelDraft.trim()}><Plus aria-hidden="true" className="size-4" /> Criar</Button>
              </div>
              {newLabels.length ? <div className="flex flex-wrap gap-2">{newLabels.map((label) => <span key={label} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{label}<button type="button" aria-label={`Remover etiqueta ${label}`} onClick={() => { update(setNewLabels, newLabels.filter((item) => item !== label)); }}><X className="size-3" /></button></span>)}</div> : null}
            </section>

            <section className="space-y-3 rounded-xl border p-4" aria-labelledby="todo-subtasks-heading">
              <div className="flex items-center justify-between"><h3 id="todo-subtasks-heading" className="text-sm font-medium">Subtarefas <span className="font-normal text-muted-foreground">(opcional)</span></h3><span className="text-xs text-muted-foreground">{subtasks.length}/50</span></div>
              <div className="flex gap-2"><Input aria-label="Título da subtarefa" value={subtaskDraft} maxLength={240} placeholder="Adicionar uma etapa" onChange={(event) => { setSubtaskDraft(event.target.value); setDirty(true); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSubtask(); } }} /><Button type="button" variant="outline" onClick={addSubtask} disabled={!subtaskDraft.trim() || subtasks.length >= 50}><Plus aria-hidden="true" className="size-4" /> Adicionar</Button></div>
              {subtasks.length ? <ul className="space-y-2">{subtasks.map((subtask, index) => <li key={subtask.id ?? `new-${index}`} className="flex items-center gap-2"><Checkbox checked={subtask.isCompleted} aria-label={`Marcar ${subtask.title} como concluída`} onCheckedChange={(checked) => { setSubtasks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, isCompleted: checked === true } : item)); setDirty(true); }} /><Input aria-label={`Editar subtarefa ${index + 1}`} value={subtask.title} maxLength={240} onChange={(event) => { setSubtasks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item)); setDirty(true); }} className={subtask.isCompleted ? "text-muted-foreground line-through" : ""} /><Button type="button" variant="ghost" size="icon" aria-label="Mover subtarefa para cima" disabled={index === 0} onClick={() => { setSubtasks((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; }); setDirty(true); }}><ArrowUp className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label="Mover subtarefa para baixo" disabled={index === subtasks.length - 1} onClick={() => { setSubtasks((current) => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; }); setDirty(true); }}><ArrowDown className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Remover ${subtask.title}`} onClick={() => { setSubtasks((current) => current.filter((_, itemIndex) => itemIndex !== index)); setDirty(true); }}><Trash2 className="size-4 text-destructive" /></Button></li>)}</ul> : <p className="text-sm text-muted-foreground">Divida a tarefa em etapas menores quando isso ajudar.</p>}
            </section>

            {validationError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{validationError}</p> : null}
            {relationsError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{relationsError}</p> : null}
            {lists.length === 0 ? <p role="alert" className="text-sm text-destructive">Crie uma lista antes de adicionar tarefas.</p> : null}
            <DialogFooter className="-mx-4 -mb-4 mt-6 border-t bg-muted/30 px-4 py-3 sm:mx-0 sm:mb-0 sm:rounded-lg sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
              <Button type="button" variant="outline" disabled={saving} onClick={() => requestClose(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving || taskMutation.pending || loadingRelations || Boolean(relationsError) || lists.length === 0}>
              {saving || taskMutation.pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Salvando…</> : initialTask ? <><Check aria-hidden="true" className="size-4" /> Salvar alterações</> : <><Plus aria-hidden="true" className="size-4" /> Criar tarefa</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Descartar alterações?</AlertDialogTitle><AlertDialogDescription>As informações preenchidas ainda não foram salvas e serão perdidas.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Continuar editando</AlertDialogCancel><AlertDialogAction onClick={() => { setConfirmDiscard(false); reset(); onOpenChange(false); }}>Descartar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
