"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, Circle, ClipboardCheck, GripVertical, Plus, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TodoTaskLifecycleDialog, type TodoTaskLifecycleAction } from "@/features/todo/components/todo-task-lifecycle-dialog";
import { TodoTaskDetailsSheet } from "@/features/todo/components/todo-task-details-sheet";
import { useTodoDashboardData } from "@/features/todo/hooks/todo-dashboard-context";
import { todoTaskAction, loadTodoWeeklyReviewAction, createTodoWeeklyCaptureAction, saveTodoWeeklyCaptureDraftAction, convertTodoWeeklyCaptureAction, updateTodoWeeklyCaptureAction, saveTodoWeeklyReviewAction, setTodoWeeklyReviewReservationAction } from "@/features/todo/actions";
import type { TodoTask, TodoWeeklyReviewCapture } from "@/features/todo/domain/types";
import { plannedWeekDays, weeklyReviewStart } from "@/features/todo/domain/weekly-review";

type PriorityDraft = { taskId: string; position: number; whyImportant: string; plannedOn: string | null; plannedTime: string | null };
type ReviewData = { review: { current_step: number; notes: string; capture_draft_title: string; capture_draft_notes: string } | null; captures: TodoWeeklyReviewCapture[]; priorities: { task_id: string; position: number; why_important: string; planned_on: string | null; planned_time: string | null }[]; reservations: { planned_on: string }[] };
const stepLabels = ["Capturar", "Revisar", "Prioridades", "Planejar"];

function dateKey(date: Date) { return format(date, "yyyy-MM-dd"); }
function localToday() { return dateKey(new Date()); }

function SortablePriority({ item, task, onMove, onRemove, onWhy }: { item: PriorityDraft; task: TodoTask; onMove: (id: string, direction: -1 | 1) => void; onRemove: (id: string) => void; onWhy: (id: string, value: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.taskId });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded-lg border bg-background p-3 ${isDragging ? "z-10 shadow-lg ring-2 ring-primary/30" : ""}`}>
    <div className="flex items-start gap-2">
      <button type="button" {...attributes} {...listeners} aria-label={`Arrastar ${task.title}`} className="mt-1 cursor-grab rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"><GripVertical className="size-4" /></button>
      <Badge variant="secondary" className="mt-1">{item.position}</Badge>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{task.title}</p><Label htmlFor={`why-${task.id}`} className="sr-only">Por que isso é importante: {task.title}</Label><Input id={`why-${task.id}`} value={item.whyImportant} maxLength={500} placeholder="Por que isso é importante? (opcional)" className="mt-2 h-9" onChange={(event) => onWhy(task.id, event.target.value)} /></div>
      <div className="flex shrink-0 flex-col"><Button type="button" variant="ghost" size="icon" aria-label={`Mover ${task.title} para cima`} className="size-7" onClick={() => onMove(task.id, -1)}><ArrowUp className="size-3.5" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Mover ${task.title} para baixo`} className="size-7" onClick={() => onMove(task.id, 1)}><ArrowDown className="size-3.5" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Remover ${task.title} das prioridades`} className="size-7 text-muted-foreground" onClick={() => onRemove(task.id)}><X className="size-3.5" /></Button></div>
    </div>
  </div>;
}

export function TodoWeeklyReviewPage() {
  const { lists, tasks, workspaces, loading: todoLoading, refreshAll } = useTodoDashboardData();
  const [weekStart] = useState(() => weeklyReviewStart(new Date()));
  const [review, setReview] = useState<ReviewData | null>(null);
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState("");
  const [priorities, setPriorities] = useState<PriorityDraft[]>([]);
  const [reservedDays, setReservedDays] = useState<string[]>([]);
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureNotes, setCaptureNotes] = useState("");
  const [captureList, setCaptureList] = useState<Record<string, string>>({});
  const [captureDate, setCaptureDate] = useState<Record<string, string>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [lifecycleTask, setLifecycleTask] = useState<TodoTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMoreTasks, setShowMoreTasks] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const today = localToday();
  const nextWeekDays = useMemo(() => weekStart ? plannedWeekDays(weekStart).map(({ key }) => parseISO(`${key}T12:00:00`)) : [], [weekStart]);
  const nextWeekStart = weekStart ? dateKey(addDays(parseISO(`${weekStart}T12:00:00`), 7)) : "";
  const nextWeekEnd = weekStart ? dateKey(addDays(parseISO(`${weekStart}T12:00:00`), 13)) : "";
  const weekEnd = weekStart ? dateKey(addDays(parseISO(`${weekStart}T12:00:00`), 6)) : "";

  const loadReview = useCallback(async (start: string, active = true) => {
    const result = await loadTodoWeeklyReviewAction({ weekStart: start });
    if (!active) return;
    if (!result.ok) { toast.error(result.message); setReview({ review: null, captures: [], priorities: [], reservations: [] }); setLoading(false); return; }
    const data = result.data as ReviewData;
    setReview(data);
    setStep(data.review?.current_step ?? 0);
    setNotes(data.review?.notes ?? "");
    setCaptureTitle(data.review?.capture_draft_title ?? "");
    setCaptureNotes(data.review?.capture_draft_notes ?? "");
    setPriorities(data.priorities.map((item) => ({ taskId: item.task_id, position: item.position, whyImportant: item.why_important, plannedOn: item.planned_on, plannedTime: item.planned_time?.slice(0, 5) ?? null })));
    setReservedDays(data.reservations.map((item) => item.planned_on));
    setDirty(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { void loadReview(weekStart, active); }, 0);
    return () => { active = false; clearTimeout(timer); if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [loadReview, weekStart]);

  useEffect(() => {
    if (!weekStart || loading) return;
    if (captureDraftTimer.current) clearTimeout(captureDraftTimer.current);
    captureDraftTimer.current = setTimeout(() => {
      void saveTodoWeeklyCaptureDraftAction({ weekStart, title: captureTitle, notes: captureNotes }).then((result) => {
        if (!result.ok) toast.error(`Rascunho não salvo: ${result.message}`);
      });
    }, 700);
    return () => { if (captureDraftTimer.current) clearTimeout(captureDraftTimer.current); };
  }, [weekStart, loading, captureTitle, captureNotes]);

  const save = useCallback(async (nextStep = step, showFeedback = false) => {
    if (!weekStart || busyRef.current) return false;
    busyRef.current = true;
    setSaving(true);
    try {
      const payload = { weekStart, step: nextStep, notes, priorities: priorities.map((item, index) => ({ ...item, position: index + 1 })) };
      const result = await saveTodoWeeklyReviewAction(payload);
      if (!result.ok) { toast.error(result.message); return false; }
      setStep(nextStep);
      setPriorities((current) => current.map((item, index) => ({ ...item, position: index + 1 })));
      setDirty(false);
      setSavedAt(Date.now());
      if (showFeedback) toast.success(nextStep === 4 ? "Sua semana foi salva." : "Progresso salvo.");
      return true;
    } finally { busyRef.current = false; setSaving(false); }
  }, [weekStart, step, notes, priorities]);

  useEffect(() => {
    if (!dirty || !weekStart || loading) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void save(step); }, 700);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [dirty, weekStart, loading, step, notes, priorities, save]);

  const currentWeekCompleted = useMemo(() => tasks.filter((task) => task.status === "done" && task.completed_at && isWithinInterval(new Date(task.completed_at), { start: parseISO(`${weekStart || today}T00:00:00`), end: parseISO(`${weekEnd || today}T23:59:59`) })), [tasks, weekStart, weekEnd, today]);
  const pendingDecisions = useMemo(() => tasks.filter((task) => task.status !== "done" && !task.deleted_at && !task.archived_at && (task.due_on === null || task.due_on <= weekEnd) && task.starts_on <= weekEnd).sort((a, b) => {
    const aOverdue = Boolean(a.due_on && a.due_on < today), bOverdue = Boolean(b.due_on && b.due_on < today);
    return Number(bOverdue) - Number(aOverdue) || (a.due_on ?? "9999-12-31").localeCompare(b.due_on ?? "9999-12-31") || a.position - b.position;
  }), [tasks, weekEnd, today]);
  const displayedDecisions = showMoreTasks ? pendingDecisions : pendingDecisions.slice(0, 12);
  const activeTasks = useMemo(() => tasks.filter((task) => task.status !== "done" && !task.deleted_at && !task.archived_at), [tasks]);
  const priorityTasks = useMemo(() => priorities.map((item) => ({ item, task: tasks.find((task) => task.id === item.taskId) })).filter((entry): entry is { item: PriorityDraft; task: TodoTask } => Boolean(entry.task && entry.task.status !== "done" && !entry.task.deleted_at && !entry.task.archived_at)), [priorities, tasks]);
  const nextDue = useMemo(() => tasks.filter((task) => task.recurrence_rule_id && task.status !== "done" && !task.archived_at && !task.deleted_at && task.due_on && task.due_on >= nextWeekStart && task.due_on <= nextWeekEnd), [tasks, nextWeekStart, nextWeekEnd]);

  async function refreshReview() { if (weekStart) await loadReview(weekStart); }
  async function createCapture() {
    if (!captureTitle.trim() || saving) return;
    if (captureDraftTimer.current) clearTimeout(captureDraftTimer.current);
    setSaving(true);
    const result = await createTodoWeeklyCaptureAction({ weekStart, title: captureTitle, notes: captureNotes });
    setSaving(false);
    if (!result.ok) { toast.error(result.message); return; }
    setCaptureTitle(""); setCaptureNotes(""); toast.success("Captura salva."); await refreshReview();
  }
  async function convertCapture(capture: TodoWeeklyReviewCapture) {
    const listId = captureList[capture.id] ?? lists[0]?.id;
    if (!listId) { toast.error("Crie ou selecione uma lista antes de transformar em tarefa."); return; }
    setSaving(true);
    const result = await convertTodoWeeklyCaptureAction({ id: capture.id, listId, scheduledOn: captureDate[capture.id] || null });
    setSaving(false);
    if (!result.ok) { toast.error(result.message); return; }
    toast.success("Captura transformada em tarefa."); await Promise.all([refreshReview(), refreshAll()]);
  }
  async function changeCapture(capture: TodoWeeklyReviewCapture, state: "archived" | "discarded") {
    const result = await updateTodoWeeklyCaptureAction({ id: capture.id, state });
    if (!result.ok) { toast.error(result.message); return; }
    toast.success(state === "archived" ? "Captura arquivada." : "Captura descartada."); await refreshReview();
  }
  async function mutateTask(task: TodoTask, fields: Record<string, unknown>) {
    setSaving(true);
    const result = await todoTaskAction({ operation: "update", id: task.id, ...fields });
    setSaving(false);
    if (!result.ok) { toast.error(result.message); return false; }
    await refreshAll(); return true;
  }
  async function confirmLifecycle(action: TodoTaskLifecycleAction) {
    if (!lifecycleTask) return false;
    const result = await todoTaskAction({ operation: action === "archive" ? "archive" : "trash", id: lifecycleTask.id });
    if (!result.ok) { toast.error(result.message); return false; }
    toast.success(action === "archive" ? "Tarefa arquivada." : "Tarefa movida para a lixeira.");
    setLifecycleTask(null); await refreshAll(); return true;
  }
  function updatePriority(id: string, update: Partial<PriorityDraft>) {
    if (update.plannedOn && reservedDays.includes(update.plannedOn)) { toast.error("Esse dia está reservado como espaço livre."); return; }
    setPriorities((current) => current.map((item) => item.taskId === id ? { ...item, ...update } : item)); setDirty(true);
  }
  async function toggleReservedDay(dayKey: string) {
    const reserved = !reservedDays.includes(dayKey);
    const occupied = priorities.some((item) => item.plannedOn === dayKey) || tasks.some((task) => task.status !== "done" && !task.archived_at && !task.deleted_at && task.due_on === dayKey);
    if (reserved && occupied) { toast.error("Mova as tarefas deste dia antes de reservar o espaço livre."); return; }
    if (!(await save(step))) return;
    setSaving(true);
    const result = await setTodoWeeklyReviewReservationAction({ weekStart, plannedOn: dayKey, reserved });
    setSaving(false);
    if (!result.ok) { toast.error(result.message); return; }
    setReservedDays((current) => reserved ? [...new Set([...current, dayKey])].sort() : current.filter((day) => day !== dayKey));
    toast.success(reserved ? "Espaço livre reservado." : "Reserva removida.");
  }
  function addPriority(id: string) {
    if (priorities.length >= 3 || priorities.some((item) => item.taskId === id)) return;
    setPriorities((current) => [...current, { taskId: id, position: current.length + 1, whyImportant: "", plannedOn: null, plannedTime: null }]); setDirty(true);
  }
  function movePriority(id: string, direction: -1 | 1) {
    setPriorities((current) => { const index = current.findIndex((item) => item.taskId === id); const next = index + direction; if (next < 0 || next >= current.length) return current; return arrayMove(current, index, next).map((item, position) => ({ ...item, position: position + 1 })); }); setDirty(true);
  }
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPriorities((current) => { const from = current.findIndex((item) => item.taskId === active.id); const to = current.findIndex((item) => item.taskId === over.id); return arrayMove(current, from, to).map((item, position) => ({ ...item, position: position + 1 })); }); setDirty(true);
  }
  async function changeStep(next: number) {
    if (next < 0 || next > 4) return;
    if (next === step) return;
    await save(next);
  }

  if (!weekStart || todoLoading || loading) return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8"><Skeleton className="h-10 w-72" /><Skeleton className="h-5 w-96 max-w-full" /><Skeleton className="h-64 w-full" /></main>;

  return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-12 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Planejamento</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Revisão semanal</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">Organize a mente, escolha prioridades e planeje uma semana possível.</p></div>
      <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1.5"><ClipboardCheck className="size-3.5" />{format(parseISO(`${weekStart}T12:00:00`), "d 'de' MMM", { locale: ptBR })} – {format(parseISO(`${weekEnd}T12:00:00`), "d 'de' MMM", { locale: ptBR })}</Badge>
    </header>

    <section aria-label="Etapas da revisão semanal" className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Etapa {Math.min(step + 1, 4)} de 4 · {stepLabels[Math.min(step, 3)]}</span><span>{Math.round((Math.min(step, 3) / 3) * 100)}%</span></div>
      <Progress value={Math.min(step, 3) / 3 * 100} className="h-1.5" />
      <div className="grid grid-cols-4 gap-2" aria-hidden="true">{stepLabels.map((label, index) => <span key={label} className={`truncate text-[11px] ${index === Math.min(step, 3) ? "font-semibold text-primary" : "text-muted-foreground"}`}>{label}</span>)}</div>
    </section>

    {step === 0 && <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)]">
      <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"><div><h2 className="text-lg font-semibold">O que está ocupando sua mente?</h2><p className="mt-1 text-sm text-muted-foreground">Anote sem organizar agora. Você decide o que fazer depois.</p></div><Label htmlFor="weekly-capture-title">Captura rápida</Label><Input id="weekly-capture-title" maxLength={240} value={captureTitle} onChange={(event) => setCaptureTitle(event.target.value)} placeholder="Uma ideia, pendência ou compromisso…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void createCapture(); } }} /><Textarea value={captureNotes} onChange={(event) => setCaptureNotes(event.target.value)} maxLength={2000} placeholder="Contexto opcional" aria-label="Detalhes da captura (opcional)" rows={3} /><Button onClick={() => void createCapture()} disabled={saving || !captureTitle.trim()}><Plus className="size-4" />Guardar captura</Button></div>
      <div className="space-y-3 rounded-xl border bg-card p-4 sm:p-6"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Capturas desta revisão</h3><Badge variant="secondary">{review?.captures.length ?? 0}</Badge></div>{review?.captures.filter((capture) => capture.state === "captured").length ? review.captures.filter((capture) => capture.state === "captured").map((capture) => <article key={capture.id} className="space-y-2 rounded-lg border p-3"><p className="text-sm font-medium">{capture.title}</p>{capture.notes ? <p className="text-xs text-muted-foreground">{capture.notes}</p> : null}<div className="grid gap-2 sm:grid-cols-2"><Select value={captureList[capture.id] ?? ""} onValueChange={(value) => setCaptureList((current) => ({ ...current, [capture.id]: value ?? "" }))}><SelectTrigger aria-label={`Lista da captura ${capture.title}`}><SelectValue placeholder="Escolha uma lista" /></SelectTrigger><SelectContent>{lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}</SelectContent></Select><Input type="date" aria-label={`Agendar captura ${capture.title}`} value={captureDate[capture.id] ?? ""} onChange={(event) => setCaptureDate((current) => ({ ...current, [capture.id]: event.target.value }))} /></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void convertCapture(capture)} disabled={saving || !lists.length}><Check className="size-3.5" />Transformar em tarefa</Button><Button size="sm" variant="ghost" onClick={() => void changeCapture(capture, "archived")}><Archive className="size-3.5" />Arquivar</Button><Button size="sm" variant="ghost" onClick={() => void changeCapture(capture, "discarded")}><X className="size-3.5" />Descartar</Button></div></article>) : <p className="rounded-lg bg-muted/40 px-3 py-4 text-sm text-muted-foreground">Nenhuma captura nesta revisão.</p>}<p className="text-xs text-muted-foreground">As capturas são salvas automaticamente nesta revisão.</p></div>
    </section>}

    {step === 1 && <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6"><div><h2 className="text-lg font-semibold">O que aconteceu nesta semana?</h2><p className="mt-1 text-sm text-muted-foreground">Confira o que foi concluído e decida com calma sobre o que continua pendente.</p></div><div className="grid gap-5 lg:grid-cols-2"><div className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-emerald-600" />Concluídas ({currentWeekCompleted.length})</h3>{currentWeekCompleted.length ? currentWeekCompleted.slice(0, 8).map((task) => <div key={task.id} className="rounded-lg bg-muted/40 px-3 py-2.5"><p className="text-sm line-through text-muted-foreground">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">Concluída em {format(new Date(task.completed_at!), "EEE, d 'de' MMM", { locale: ptBR })}</p></div>) : <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">Nenhuma tarefa concluída neste período.</p>}</div><div className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><Circle className="size-4 text-amber-600" />Pendências para revisar ({pendingDecisions.length})</h3>{displayedDecisions.length ? displayedDecisions.map((task) => <article key={task.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="flex min-w-0 items-start gap-2"><Checkbox checked={task.status === "done"} aria-label={`Concluir ${task.title}`} disabled={saving} onCheckedChange={(checked) => { if (checked === true) void (async () => { if (await mutateTask(task, { status: "done" })) toast.success("Tarefa concluída."); })(); }} /><button type="button" className="min-w-0 text-left" onClick={() => setSelectedTaskId(task.id)}><span className="block truncate text-sm font-medium">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{task.due_on ? `Prazo: ${format(parseISO(`${task.due_on}T12:00:00`), "d MMM", { locale: ptBR })}` : "Sem prazo"}{task.due_on && task.due_on < today ? " · atrasada" : ""}{task.recurrence_rule_id ? " · recorrente" : ""}</span></button></div><div className="flex flex-wrap items-center gap-2"><Select value={task.list_id} onValueChange={(value) => { if (value && value !== task.list_id) void mutateTask(task, { listId: value }); }}><SelectTrigger className="h-8 w-36" aria-label={`Mover ${task.title} para outra lista`}><SelectValue /></SelectTrigger><SelectContent>{lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}</SelectContent></Select><Input type="date" aria-label={`Novo prazo de ${task.title}`} className="h-8 w-36" value={task.due_on ?? ""} onChange={(event) => void mutateTask(task, { dueOn: event.target.value || null, dueAt: null })} /><Button type="button" size="icon" variant="ghost" aria-label={`Arquivar ${task.title}`} disabled={saving} onClick={() => setLifecycleTask(task)}><Archive className="size-4" /></Button></div></article>) : <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">Nenhuma pendência precisa de uma decisão agora.</p>}{pendingDecisions.length > 12 ? <Button variant="link" className="px-0" onClick={() => setShowMoreTasks((value) => !value)}>{showMoreTasks ? "Mostrar menos" : `Ver mais ${pendingDecisions.length - 12} tarefas`}</Button> : null}</div></div><div className="space-y-2"><h3 className="text-sm font-semibold">Próximas recorrências</h3>{nextDue.length ? <div className="flex flex-wrap gap-2">{nextDue.slice(0, 5).map((task) => <Badge key={task.id} variant="outline">{task.title} · {format(parseISO(`${task.due_on}T12:00:00`), "d MMM", { locale: ptBR })}</Badge>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma ocorrência recorrente próxima.</p>}</div></section>}

    {step === 2 && <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6"><div><h2 className="text-lg font-semibold">O que realmente importa na próxima semana?</h2><p className="mt-1 text-sm text-muted-foreground">Escolha até três tarefas reais. Você pode mudar a ordem a qualquer momento.</p></div>{priorityTasks.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={priorityTasks.map(({ item }) => item.taskId)} strategy={verticalListSortingStrategy}><div className="space-y-2">{priorityTasks.map(({ item, task }) => <SortablePriority key={task.id} item={{ ...item, position: priorityTasks.findIndex((entry) => entry.item.taskId === task.id) + 1 }} task={task} onMove={movePriority} onRemove={(id) => { setPriorities((current) => current.filter((priority) => priority.taskId !== id).map((priority, index) => ({ ...priority, position: index + 1 }))); setDirty(true); }} onWhy={(id, value) => updatePriority(id, { whyImportant: value })} />)}</div></SortableContext></DndContext> : <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Nenhuma prioridade escolhida ainda.</p>}<div className="max-w-xl space-y-2"><Label htmlFor="weekly-priority-add">Adicionar uma tarefa às prioridades</Label><Select value="" onValueChange={(value) => value && addPriority(value)}><SelectTrigger id="weekly-priority-add" disabled={priorities.length >= 3 || !activeTasks.some((task) => !priorities.some((item) => item.taskId === task.id))}><SelectValue placeholder={priorities.length >= 3 ? "Limite de três prioridades atingido" : "Escolha uma tarefa existente"} /></SelectTrigger><SelectContent>{activeTasks.filter((task) => !priorities.some((item) => item.taskId === task.id)).map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">A seleção aponta para as tarefas existentes; nenhuma cópia será criada.</p></div></section>}

    {step === 3 && <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6"><div><h2 className="text-lg font-semibold">Planeje uma semana possível</h2><p className="mt-1 text-sm text-muted-foreground">Distribua suas prioridades nos dias disponíveis. Deixar espaços livres também faz parte do plano.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{nextWeekDays.map((day) => { const key = dateKey(day); const isReserved = reservedDays.includes(key); const dayTasks = tasks.filter((task) => task.status !== "done" && !task.archived_at && !task.deleted_at && task.due_on === key); const occupied = dayTasks.length > 0 || priorities.some((item) => item.plannedOn === key); return <div key={key} className={`min-h-32 rounded-lg border p-2 ${isReserved ? "border-dashed border-emerald-500/50 bg-emerald-500/5" : "bg-muted/20"}`}><p className="text-xs font-semibold capitalize">{format(day, "EEE", { locale: ptBR })}</p><p className="text-xs text-muted-foreground">{format(day, "d MMM", { locale: ptBR })}</p><div className="mt-2 space-y-1">{dayTasks.slice(0, 2).map((task) => <p key={task.id} className="truncate rounded bg-muted px-1.5 py-1 text-[11px]" title={task.title}>{task.title}</p>)}{priorityTasks.filter(({ item }) => item.plannedOn === key && !dayTasks.some((task) => task.id === item.taskId)).map(({ task }) => <p key={task.id} className="truncate rounded bg-primary/10 px-1.5 py-1 text-[11px]" title={task.title}>{task.title}</p>)}{isReserved ? <p className="mt-2 text-[11px] font-medium text-emerald-700">Espaço livre reservado</p> : null}</div><Button type="button" size="sm" variant="ghost" className="mt-2 h-7 w-full px-1 text-[10px]" disabled={saving || (occupied && !isReserved)} aria-label={isReserved ? `Remover reserva de ${format(day, "EEEE d MMMM", { locale: ptBR })}` : `Reservar ${format(day, "EEEE d MMMM", { locale: ptBR })} como espaço livre`} onClick={() => void toggleReservedDay(key)}>{isReserved ? "Remover reserva" : occupied ? "Dia ocupado" : "Reservar espaço livre"}</Button></div>; })}</div><div className="space-y-3">{priorityTasks.length ? priorityTasks.map(({ item, task }, index) => <article key={task.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)_140px]"><div className="min-w-0"><Badge variant="secondary" className="mb-1">Prioridade {index + 1}</Badge><p className="truncate text-sm font-medium">{task.title}</p></div><div className="space-y-1"><Label htmlFor={`schedule-${task.id}`} className="text-xs">Dia</Label><Select value={item.plannedOn ?? "none"} onValueChange={(value) => updatePriority(task.id, { plannedOn: value === "none" ? null : value ?? null, plannedTime: value === "none" ? null : item.plannedTime })}><SelectTrigger id={`schedule-${task.id}`}><SelectValue placeholder="Escolha um dia" /></SelectTrigger><SelectContent><SelectItem value="none">Sem horário definido</SelectItem>{nextWeekDays.filter((day) => !reservedDays.includes(dateKey(day))).map((day) => <SelectItem key={dateKey(day)} value={dateKey(day)}>{format(day, "EEEE, d MMM", { locale: ptBR })}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label htmlFor={`time-${task.id}`} className="text-xs">Horário (opcional)</Label><Input id={`time-${task.id}`} type="time" disabled={!item.plannedOn} value={item.plannedTime ?? ""} onChange={(event) => updatePriority(task.id, { plannedTime: event.target.value || null })} /></div></article>) : <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Volte à etapa anterior para escolher até três prioridades.</p>}</div><details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Ver outros compromissos da semana ({nextDue.length})</summary><div className="mt-3 flex flex-wrap gap-2">{nextDue.length ? nextDue.slice(0, 8).map((task) => <Badge key={task.id} variant="outline">{task.title} · {task.due_on ? format(parseISO(`${task.due_on}T12:00:00`), "d MMM", { locale: ptBR }) : "Sem data"}</Badge>) : <p className="text-sm text-muted-foreground">Nenhum compromisso recorrente próximo.</p>}</div></details><div className="max-w-2xl space-y-2"><Label htmlFor="weekly-review-notes">Observações (opcional)</Label><Textarea id="weekly-review-notes" value={notes} maxLength={2000} placeholder="Algo que gostaria de lembrar ao longo da semana…" onChange={(event) => { setNotes(event.target.value); setDirty(true); }} rows={3} /></div></section>}

    {step === 4 && <section className="mx-auto max-w-3xl space-y-5 rounded-xl border bg-card p-5 sm:p-8"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-6" /></span><div><h2 className="text-xl font-semibold">Sua semana está organizada.</h2><p className="mt-1 text-sm text-muted-foreground">Um plano flexível para a próxima semana.</p></div></div><div className="space-y-2"><h3 className="text-sm font-semibold">Suas prioridades</h3>{priorityTasks.length ? priorityTasks.map(({ item, task }, index) => <div key={task.id} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3"><Badge variant="secondary">{index + 1}</Badge><div><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.plannedOn ? `${format(parseISO(`${item.plannedOn}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR })}${item.plannedTime ? ` · ${item.plannedTime}` : ""}` : "Sem dia definido"}{item.whyImportant ? ` · ${item.whyImportant}` : ""}</p></div></div>) : <p className="text-sm text-muted-foreground">Nenhuma prioridade foi selecionada.</p>}</div><div className="space-y-2"><h3 className="text-sm font-semibold">Compromissos importantes</h3>{nextDue.length ? nextDue.slice(0, 5).map((task) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"><p className="truncate text-sm">{task.title}</p><Badge variant="outline" className="shrink-0">{task.due_on ? format(parseISO(`${task.due_on}T12:00:00`), "d MMM", { locale: ptBR }) : "Sem data"}</Badge></div>) : <p className="text-sm text-muted-foreground">Nenhum compromisso recorrente previsto para a próxima semana.</p>}</div><div className="rounded-lg border p-3"><p className="text-sm font-medium">Pendências reorganizadas</p><p className="mt-1 text-sm text-muted-foreground">{pendingDecisions.length} tarefa(s) pendente(s) permanecem nas suas listas, com os prazos atualizados quando você planejou um dia.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void changeStep(0)}><ArrowLeft className="size-4" />Rever captura</Button><Button variant="outline" onClick={() => void changeStep(2)}>Editar prioridades</Button></div></section>}

    <footer className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-muted-foreground" aria-live="polite">{saving ? "Salvando…" : savedAt ? `Salvo ${format(new Date(savedAt), "HH:mm")}` : "As etapas e prioridades são salvas nesta revisão."}</div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void changeStep(step - 1)} disabled={step === 0 || saving}><ArrowLeft className="size-4" />Voltar</Button>{step < 3 ? <Button onClick={() => void changeStep(step + 1)} disabled={saving}>Continuar<ArrowRight className="size-4" /></Button> : step === 3 ? <Button onClick={() => void save(4, true)} disabled={saving}><Check className="size-4" />Salvar revisão</Button> : <Button onClick={() => void changeStep(3)} variant="outline" disabled={saving}><RotateCcw className="size-4" />Editar planejamento</Button>}</div>
    </footer>

    <TodoTaskDetailsSheet task={selectedTask} lists={lists} workspaces={workspaces} onSelectTask={(id) => setSelectedTaskId(id)} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }} onSaved={refreshAll} />
    <TodoTaskLifecycleDialog open={Boolean(lifecycleTask)} taskTitle={lifecycleTask?.title} onOpenChange={(open) => { if (!open) setLifecycleTask(null); }} onConfirm={confirmLifecycle} />
  </main>;
}
