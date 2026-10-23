"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CirclePause, LoaderCircle, MoreHorizontal, Pencil, Play, Plus, Repeat2, SkipForward, Square, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { loadTodoRecurrencesAction, todoRecurrenceExceptionAction, todoRecurrenceStateAction } from "@/features/todo/actions";
import { TodoTaskFormDialog } from "@/features/todo/components/todo-task-form-dialog";
import type { TodoRecurrenceSummary } from "@/features/todo/services/todo-services";
import { defaultTodoRecurrenceConfig } from "@/features/todo/domain/recurrence";
import { localDateKey } from "@/features/todo/domain/dashboard";
import { useTodoDashboardData } from "@/features/todo/hooks/todo-dashboard-context";
import { useTodoResource } from "@/features/todo/hooks/use-todo-resource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Filter = "all" | "active" | "paused" | "ended";
const stateLabels = { active: "Ativa", paused: "Pausada", ended: "Encerrada" } as const;
const frequencyLabels = { daily: "Diariamente", weekdays: "Dias úteis", weekly: "Semanalmente", monthly: "Mensalmente", yearly: "Anualmente", custom: "Personalizada" } as const;

function formatDate(date: string | null) {
  if (!date) return "Sem próxima data";
  const [year, month, day] = date.split("-").map(Number);
  return format(new Date(year, month - 1, day), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function TodoRecurringTasksPage() {
  const { lists, workspaces, refreshAll } = useTodoDashboardData();
  const recurrenceResource = useTodoResource(loadTodoRecurrencesAction);
  const rules = useMemo(() => recurrenceResource.data ?? [], [recurrenceResource.data]);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TodoRecurrenceSummary | null>(null);
  const [ending, setEnding] = useState<TodoRecurrenceSummary | null>(null);
  const [endingBusy, setEndingBusy] = useState(false);

  const refresh = recurrenceResource.refresh;

  const visible = useMemo(() => rules.filter((item) => filter === "all" || item.rule.status === filter), [filter, rules]);
  const today = localDateKey(new Date());

  async function changeState(item: TodoRecurrenceSummary, status: "active" | "paused" | "ended") {
    setBusyId(item.rule.id);
    try {
      const result = await todoRecurrenceStateAction({ id: item.rule.id, status });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(status === "paused" ? "Recorrência pausada." : status === "active" ? "Recorrência retomada." : "Recorrência encerrada.");
      await refresh();
    } catch { toast.error("Não foi possível atualizar a recorrência."); }
    finally { setBusyId(null); }
  }

  async function skipNext(item: TodoRecurrenceSummary) {
    if (!item.nextTask?.recurrence_on) { toast.error("Não há uma próxima ocorrência pendente para pular."); return; }
    setBusyId(item.rule.id);
    try {
      const result = await todoRecurrenceExceptionAction({ id: item.rule.id, occurrenceOn: item.nextTask.recurrence_on, action: "skipped" });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Ocorrência pulada.");
      await Promise.all([refresh(), refreshAll()]);
    } catch { toast.error("Não foi possível pular a ocorrência."); }
    finally { setBusyId(null); }
  }

  async function confirmEnd() {
    if (!ending) return;
    setEndingBusy(true);
    try { await changeState(ending, "ended"); setEnding(null); }
    finally { setEndingBusy(false); }
  }

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (item: TodoRecurrenceSummary) => {
    if (!item.templateTask && !item.nextTask) { toast.error("A tarefa-base não está mais disponível para edição."); return; }
    setEditing(item); setFormOpen(true);
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Tarefas</p><h1 className="text-3xl font-semibold tracking-tight">Tarefas recorrentes</h1><p className="mt-2 text-sm text-muted-foreground">Rotinas que se repetem sem ocupar sua mente.</p></div>
        <Button onClick={openCreate}><Plus aria-hidden="true" className="size-4" />Nova tarefa recorrente</Button>
      </header>

      <Tabs value={filter} onValueChange={(value) => { if (value === "all" || value === "active" || value === "paused" || value === "ended") setFilter(value); }}>
        <TabsList aria-label="Filtrar tarefas recorrentes"><TabsTrigger value="all">Todas <span className="ml-1 text-xs text-muted-foreground">{rules.length}</span></TabsTrigger><TabsTrigger value="active">Ativas</TabsTrigger><TabsTrigger value="paused">Pausadas</TabsTrigger><TabsTrigger value="ended">Encerradas</TabsTrigger></TabsList>
      </Tabs>

      {recurrenceResource.loading ? <div className="space-y-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}</div> : visible.length ? <div className="space-y-3">{visible.map((item) => {
        const next = item.nextTask?.recurrence_on ?? (item.rule.status === "active" ? item.rule.next_occurrence_on : null);
        const frequency = frequencyLabels[item.rule.frequency as keyof typeof frequencyLabels] ?? "Personalizada";
        const status = stateLabels[item.rule.status as keyof typeof stateLabels] ?? "Ativa";
        return <Card key={item.rule.id} className="shadow-none"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Repeat2 aria-hidden="true" className="size-4" /></span><div className="min-w-0"><p className="truncate font-medium">{item.templateTask?.title ?? "Tarefa recorrente"}</p><p className="mt-1 text-sm text-muted-foreground">{frequency}{item.rule.interval_count > 1 ? ` · a cada ${item.rule.interval_count}` : ""} · {item.listName}</p><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock aria-hidden="true" className="size-3.5" />Próxima ocorrência: {formatDate(next)}{item.config.timeOfDay ? ` às ${item.config.timeOfDay}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{item.rule.occurrences_created} {item.rule.occurrences_created === 1 ? "ocorrência criada" : "ocorrências criadas"} · {item.config.timezone}</p></div></div>
          <div className="flex items-center justify-between gap-2 sm:justify-end"><Badge variant={item.rule.status === "active" ? "secondary" : "outline"}>{status}</Badge>{busyId === item.rule.id ? <LoaderCircle aria-label="Atualizando" className="size-4 animate-spin text-muted-foreground" /> : <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Ações de ${item.templateTask?.title ?? "tarefa recorrente"}`} />}><MoreHorizontal aria-hidden="true" className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openEdit(item)} disabled={!item.templateTask}><Pencil aria-hidden="true" />Editar série</DropdownMenuItem>{item.rule.status === "active" ? <DropdownMenuItem onClick={() => void changeState(item, "paused")}><CirclePause aria-hidden="true" />Pausar</DropdownMenuItem> : item.rule.status === "paused" ? <DropdownMenuItem onClick={() => void changeState(item, "active")}><Play aria-hidden="true" />Retomar</DropdownMenuItem> : null}{item.rule.status === "active" && item.nextTask ? <DropdownMenuItem onClick={() => void skipNext(item)}><SkipForward aria-hidden="true" />Pular próxima ocorrência</DropdownMenuItem> : null}{item.rule.status !== "ended" ? <DropdownMenuItem variant="destructive" onClick={() => setEnding(item)}><XCircle aria-hidden="true" />Encerrar série</DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu>}</div>
        </CardContent></Card>;
      })}</div> : <Card className="shadow-none"><CardContent className="flex flex-col items-center gap-2 py-12 text-center"><span className="grid size-11 place-items-center rounded-full bg-muted"><Repeat2 aria-hidden="true" className="size-5 text-muted-foreground" /></span><p className="font-medium">{filter === "all" ? "Nenhuma tarefa recorrente ainda." : `Nenhuma tarefa ${filter === "active" ? "ativa" : filter === "paused" ? "pausada" : "encerrada"}.`}</p><p className="max-w-sm text-sm text-muted-foreground">Crie uma rotina recorrente no formulário de tarefa. As datas futuras serão geradas conforme necessário.</p><Button variant="outline" onClick={openCreate}><Plus aria-hidden="true" className="size-4" />Nova tarefa recorrente</Button></CardContent></Card>}

      <p className="text-xs text-muted-foreground">As ocorrências são materializadas em uma janela limitada de 45 dias sempre que suas tarefas são carregadas. Tarefas concluídas mantêm histórico separado.</p>

      <TodoTaskFormDialog key={editing?.rule.id ?? "new-recurring"} open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }} lists={lists} workspaces={workspaces} initialDate={editing?.config.startsOn ?? today} initialListId={(editing?.templateTask ?? editing?.nextTask)?.list_id} initialTask={editing?.templateTask ?? editing?.nextTask ?? null} initialRecurrence={editing?.config ?? defaultTodoRecurrenceConfig(today)} onCreated={async () => { await Promise.all([refresh(), refreshAll()]); }} />
      <AlertEnding open={Boolean(ending)} onOpenChange={(open) => { if (!open && !endingBusy) setEnding(null); }} busy={endingBusy} title={ending?.templateTask?.title ?? "esta série"} onConfirm={confirmEnd} />
    </main>
  );
}

function AlertEnding({ open, onOpenChange, busy, title, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; busy: boolean; title: string; onConfirm: () => void }) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Encerrar recorrência?</AlertDialogTitle><AlertDialogDescription>A série “{title}” será encerrada. As ocorrências já criadas permanecem na sua lista e no histórico.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={(event) => { event.preventDefault(); onConfirm(); }}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Square className="size-4" />}Encerrar série</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
