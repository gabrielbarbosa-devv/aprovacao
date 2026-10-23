"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownWideNarrow, ArrowRight, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, CircleCheck, CircleDot, Clock3, Folder, ListTodo, LoaderCircle, Plus, RefreshCw, Search, Target, UserRound } from "lucide-react";
import { toast } from "sonner";
import { todoTaskAction } from "@/features/todo/actions";
import { TodoTaskFormDialog } from "@/features/todo/components/todo-task-form-dialog";
import { TodoTaskDetailsSheet } from "@/features/todo/components/todo-task-details-sheet";
import { calculateTodoDashboardMetrics, isTaskActiveOn, isTaskScheduledOn, localDateFromKey, localDateKey, taskDueDateKey } from "@/features/todo/domain/dashboard";
import { dashboardPreferencesKey, parseExpandedDashboardSections, serializeExpandedDashboardSections } from "@/features/todo/domain/dashboard-preferences";
import { useTodoDashboardData, type TodoDashboardView } from "@/features/todo/hooks/todo-dashboard-context";
import type { TodoTask } from "@/features/todo/domain/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function priorityRank(priority: string): number {
  if (priority === "high") return 0;
  if (priority === "low") return 2;
  return 1;
}

function priorityText(priority: string): string {
  if (priority === "high") return "Alta";
  if (priority === "low") return "Baixa";
  return "Média";
}

function formatDateLong(key: string): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(localDateFromKey(key));
}

function formatDayAndMonth(key: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(localDateFromKey(key));
}

function moveMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function taskTime(task: TodoTask): string | null {
  if (!task.due_at) return null;
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(task.due_at));
}

function sortTasks(tasks: TodoTask[]): TodoTask[] {
  return [...tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)
    || (taskDueDateKey(a) ?? "9999-12-31").localeCompare(taskDueDateKey(b) ?? "9999-12-31")
    || a.position - b.position
    || a.created_at.localeCompare(b.created_at));
}

function DashboardSkeleton() {
  return <main className="mx-auto w-full max-w-[110rem] space-y-5 p-4 sm:p-6 xl:p-7"><Skeleton className="h-24 w-full" /><div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-28" />)}</div><div className="space-y-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div></main>;
}

export function TodoHome() {
  const {
    lists, tasks, workspaces, loading, refreshing, error, refreshAll, view, setView,
    selectedListId, setSelectedListId, selectedWorkspaceId, setSelectedWorkspaceId,
    selectedDate, setSelectedDate,
  } = useTodoDashboardData();
  const [today, setToday] = useState<string | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [savingTaskIds, setSavingTaskIds] = useState<Set<string>>(() => new Set());
  const [optimisticTasks, setOptimisticTasks] = useState<Map<string, TodoTask>>(() => new Map());
  const [searchText, setSearchText] = useState("");
  const [showAgenda, setShowAgenda] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["overview:priorities"]);
  const [preferencesUserId, setPreferencesUserId] = useState<string | null>(null);
  const [preferencesReady, setPreferencesReady] = useState(false);

  useEffect(() => {
    const now = new Date();
    const frame = window.requestAnimationFrame(() => {
      setToday(localDateKey(now));
      setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      const userId = authError ? null : data.user?.id ?? null;
      setPreferencesUserId(userId);
      if (userId) {
        try {
          const stored = window.localStorage.getItem(dashboardPreferencesKey(userId));
          if (stored !== null) setExpandedSections(parseExpandedDashboardSections(stored));
        } catch {
          // The dashboard remains usable when browser storage is unavailable.
        }
      }
      setPreferencesReady(true);
    }).catch(() => {
      if (active) setPreferencesReady(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!preferencesReady || !preferencesUserId) return;
    try {
      window.localStorage.setItem(dashboardPreferencesKey(preferencesUserId), serializeExpandedDashboardSections(expandedSections));
    } catch {
      // Storage is a presentation preference; failures must not affect task data.
    }
  }, [expandedSections, preferencesReady, preferencesUserId]);
  const visibleTasks = useMemo(() => tasks.map((task) => optimisticTasks.get(task.id) ?? task), [tasks, optimisticTasks]);
  const activeTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedList = lists.find((list) => list.id === (activeTask?.list_id ?? selectedListId));
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === activeTask?.workspace_id);
  const metrics = useMemo(() => today ? calculateTodoDashboardMetrics(visibleTasks, today) : null, [visibleTasks, today]);
  const activeView = selectedDate ? "today" : view;
  const overviewMode = view === "overview" && selectedDate === null;

  const filteredTasks = useMemo(() => {
    let result = visibleTasks;
    if (activeView === "completed") result = result.filter((task) => task.status === "done");
    else if (activeView === "today") {
      const date = selectedDate ?? today;
      result = result.filter((task) => date && (isTaskScheduledOn(task, date) || isTaskActiveOn(task, date)));
    } else if (activeView === "list" && selectedListId) result = result.filter((task) => task.list_id === selectedListId);
    else if (activeView === "workspace" && selectedWorkspaceId) result = result.filter((task) => task.workspace_id === selectedWorkspaceId);
    if (!selectedDate && ["overview", "lists", "workspaces"].includes(activeView)) result = result.filter((task) => task.status !== "done");
    return sortTasks(result);
  }, [visibleTasks, activeView, selectedDate, today, selectedListId, selectedWorkspaceId]);
  const searchedTasks = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase("pt-BR");
    return query ? filteredTasks.filter((task) => task.title.toLocaleLowerCase("pt-BR").includes(query) || (task.description ?? "").toLocaleLowerCase("pt-BR").includes(query)) : filteredTasks;
  }, [filteredTasks, searchText]);

  const todayTasks = useMemo(() => today ? sortTasks(visibleTasks.filter((task) => isTaskActiveOn(task, today))) : [], [visibleTasks, today]);
  const overviewTasks = useMemo(() => today ? sortTasks(visibleTasks.filter((task) => {
    if (isTaskScheduledOn(task, today) || isTaskActiveOn(task, today)) return true;
    return task.status === "done" && task.completed_at !== null && localDateKey(new Date(task.completed_at)) === today;
  })) : [], [visibleTasks, today]);
  const overviewPriorities = todayTasks.slice(0, 3);
  const overviewPriorityIds = useMemo(() => new Set(overviewPriorities.map((task) => task.id)), [overviewPriorities]);
  const remainingOverviewTasks = useMemo(() => overviewTasks.filter((task) => !overviewPriorityIds.has(task.id)), [overviewTasks, overviewPriorityIds]);
  const personalList = lists.find((list) => list.slug === "pessoal");
  const workList = lists.find((list) => list.slug === "trabalho");
  const overviewCategories = [
    { id: "list:pessoal", title: "Pessoal", icon: <UserRound aria-hidden="true" className="size-4" />, tasks: remainingOverviewTasks.filter((task) => task.list_id === personalList?.id) },
    { id: "list:trabalho", title: "Trabalho", icon: <BriefcaseBusiness aria-hidden="true" className="size-4" />, tasks: remainingOverviewTasks.filter((task) => task.list_id === workList?.id) },
    { id: "list:outras", title: "Outras listas", icon: <Folder aria-hidden="true" className="size-4" />, tasks: remainingOverviewTasks.filter((task) => task.list_id !== personalList?.id && task.list_id !== workList?.id) },
  ];
  const selectedDayTasks = useMemo(() => selectedDate ? sortTasks(visibleTasks.filter((task) => isTaskScheduledOn(task, selectedDate) || isTaskActiveOn(task, selectedDate))) : [], [visibleTasks, selectedDate]);
  const deadlines = useMemo(() => {
    if (!today) return [];
    return sortTasks(visibleTasks.filter((task) => task.status !== "done" && taskDueDateKey(task) !== null))
      .sort((a, b) => (taskDueDateKey(a) ?? "").localeCompare(taskDueDateKey(b) ?? "") || (taskTime(a) ?? "99:99").localeCompare(taskTime(b) ?? "99:99"))
      .slice(0, 5);
  }, [visibleTasks, today]);

  const activeListName = lists.find((list) => list.id === selectedListId)?.name;
  const activeWorkspaceName = workspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.name;
  const sectionTitle: Record<TodoDashboardView, string> = {
    overview: selectedDate ? `Tarefas de ${formatDayAndMonth(selectedDate)}` : "Prioridades de hoje",
    today: selectedDate ? `Tarefas de ${formatDayAndMonth(selectedDate)}` : "Prioridades de hoje",
    all: "Todas as tarefas",
    completed: "Tarefas concluídas",
    recurring: "Tarefas recorrentes",
    "weekly-review": "Revisão semanal",
    lists: "Suas listas",
    workspaces: "Seus workspaces",
    list: activeListName ?? "Tarefas da lista",
    workspace: activeWorkspaceName ?? "Tarefas do workspace",
  };

  async function toggleComplete(task: TodoTask) {
    if (savingTaskIds.has(task.id)) return;
    const nextStatus = task.status === "done" ? "todo" : "done";
    const optimistic: TodoTask = { ...task, status: nextStatus, completed_at: nextStatus === "done" ? new Date().toISOString() : null };
    setSavingTaskIds((current) => new Set(current).add(task.id));
    setOptimisticTasks((current) => new Map(current).set(task.id, optimistic));
    try {
      const result = await todoTaskAction({ operation: "update", id: task.id, status: nextStatus });
      if (!result.ok) {
        setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
        toast.error(result.message);
        return;
      }
      toast.success(nextStatus === "done" ? "Tarefa concluída." : "Tarefa reaberta.");
      setSelectedTaskId((current) => current === task.id && nextStatus === "done" ? null : current);
      await refreshAll();
      setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
    } catch {
      setOptimisticTasks((current) => { const next = new Map(current); next.delete(task.id); return next; });
      toast.error("Não foi possível atualizar a tarefa. Tente novamente.");
    } finally {
      setSavingTaskIds((current) => { const next = new Set(current); next.delete(task.id); return next; });
    }
  }

  function chooseDate(date: Date) {
    const key = localDateKey(date);
    setSelectedDate(key);
    setSelectedListId(null);
    setSelectedWorkspaceId(null);
    setView("today");
  }

  function updateExpandedSection(value: string, open: boolean) {
    setExpandedSections((current) => open
      ? current.includes(value) ? current : [...current, value]
      : current.filter((item) => item !== value));
  }

  if (loading && !today) return <DashboardSkeleton />;
  if (loading) return <DashboardSkeleton />;
  if (error) return <main className="mx-auto w-full max-w-3xl p-4 pt-10 sm:p-8"><Alert variant="destructive"><AlertTitle>Não foi possível carregar o To-Do</AlertTitle><AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-3">{error}<Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={refreshing}><RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Tentar novamente</Button></AlertDescription></Alert></main>;
  if (!today || !month || !metrics) return <DashboardSkeleton />;

  const nowHour = new Date().getHours();
  const greeting = nowHour < 12 ? "Bom dia" : nowHour < 18 ? "Boa tarde" : "Boa noite";
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthOffset = (monthStart.getDay() + 6) % 7;
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthOffset);
  const calendarDates = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  return (
    <>
      <main className={cn("mx-auto grid w-full max-w-[110rem] min-w-0 gap-5 p-4 sm:p-6 xl:gap-6 xl:p-7", overviewMode && !showAgenda ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="min-w-0 space-y-5">
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{overviewMode ? "Módulo de tarefas" : "Minhas tarefas"}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{overviewMode ? "Visão geral" : "Organize seu dia com clareza"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{overviewMode ? "Menos ruído, mais clareza para o seu dia." : `${greeting}. ${formatDateLong(today)}.`}</p>
              {!overviewMode ? <p className="mt-1 text-sm text-muted-foreground">Planeje, foque e avance nos seus objetivos.</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Atualizar tarefas" title="Atualizar" onClick={() => void refreshAll()} disabled={refreshing}>{refreshing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}</Button>
              {overviewMode ? <Button variant="outline" aria-expanded={showAgenda} onClick={() => setShowAgenda((current) => !current)}><CalendarDays aria-hidden="true" />{showAgenda ? "Ocultar agenda" : "Ver agenda"}</Button> : null}
              <Button onClick={() => setFormOpen(true)}><Plus aria-hidden="true" /> Nova tarefa</Button>
            </div>
          </section>

          <section aria-label="Resumo de tarefas" className={cn("grid gap-3", overviewMode ? "sm:grid-cols-3" : "sm:grid-cols-2 2xl:grid-cols-4")}>
            {overviewMode ? <>
              <MetricCard icon={<CalendarDays aria-hidden="true" />} value={metrics.today} label="Hoje" detail="Tarefas previstas para hoje" />
              <MetricCard icon={<ListTodo aria-hidden="true" />} value={visibleTasks.filter((task) => task.status !== "done").length} label="Pendentes" detail="Em todas as listas" tone="red" />
              <MetricCard icon={<CheckCircle2 aria-hidden="true" />} value={metrics.weekCompleted} label="Concluídas na semana" detail="Desde segunda-feira" tone="green" />
            </> : <>
              <MetricCard icon={<ListTodo aria-hidden="true" />} value={metrics.total} label="Tarefas no total" detail={`${tasks.filter((task) => task.status !== "done").length} em aberto`} />
              <MetricCard icon={<CalendarDays aria-hidden="true" />} value={metrics.today} label="Para hoje" detail="Com prazo ou atividade hoje" />
              <MetricCard icon={<CheckCircle2 aria-hidden="true" />} value={metrics.completed} label="Concluídas" detail="Tarefas concluídas" tone="green" />
              <Card className="min-w-0 shadow-none">
                <CardHeader className="space-y-2 p-4 pb-2"><div className="flex items-center justify-between gap-2"><CardDescription>Seu progresso da semana</CardDescription></div><div className="flex items-baseline gap-2"><span className="text-2xl font-bold tabular-nums">{metrics.weekPercent}%</span><span className="text-xs text-muted-foreground">{metrics.weekCompleted} de {metrics.weekTotal}</span></div></CardHeader>
                <CardContent className="px-4 pb-4"><Progress value={metrics.weekPercent} aria-label={`Progresso semanal: ${metrics.weekPercent}%`} /><p className="mt-2 text-xs text-muted-foreground">Tarefas da semana concluídas</p></CardContent>
              </Card>
            </>}
          </section>

          {overviewMode ? <section aria-label="Tarefas relevantes de hoje" className="space-y-3">
            <Accordion multiple value={expandedSections.includes("overview:priorities") ? ["overview:priorities"] : []} onValueChange={(next) => updateExpandedSection("overview:priorities", next.includes("overview:priorities"))}>
              <AccordionItem value="overview:priorities" className="overflow-hidden rounded-xl border bg-card shadow-none">
                <AccordionHeader><AccordionTrigger className="min-h-14 px-3 py-2.5 sm:px-4"><span className="flex min-w-0 flex-1 items-center gap-3"><Target aria-hidden="true" className="size-4 shrink-0 text-primary" /><span className="truncate font-semibold">Prioridades de hoje</span><Badge variant="secondary" className="shrink-0 tabular-nums">{overviewPriorities.length}</Badge></span></AccordionTrigger></AccordionHeader>
                <AccordionPanel className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150 px-3 pb-3 sm:px-4 sm:pb-4">
                  {overviewPriorities.length ? <div className="divide-y rounded-lg border">{overviewPriorities.map((task) => <OverviewTaskRow key={task.id} task={task} listName={lists.find((list) => list.id === task.list_id)?.name} saving={savingTaskIds.has(task.id)} onToggle={() => void toggleComplete(task)} onOpen={() => setSelectedTaskId(task.id)} />)}</div> : <CompactEmpty message={visibleTasks.some((task) => task.status !== "done") ? "Nenhuma tarefa prevista para hoje." : "Nenhuma tarefa pendente."} onAdd={() => setFormOpen(true)} />}
                </AccordionPanel>
              </AccordionItem>
            </Accordion>

            {overviewCategories.map((category) => {
              const categoryOpen = expandedSections.includes(category.id);
              return <Accordion key={category.id} multiple value={categoryOpen ? [category.id] : []} onValueChange={(next) => updateExpandedSection(category.id, next.includes(category.id))}>
                <AccordionItem value={category.id} className="overflow-hidden rounded-xl border bg-card shadow-none">
                  <AccordionHeader><AccordionTrigger className="min-h-14 px-3 py-2.5 sm:px-4"><span className="flex min-w-0 flex-1 items-center gap-3"><span className="shrink-0 text-muted-foreground">{category.icon}</span><span className="truncate font-semibold">{category.title}</span><Badge variant="secondary" className="shrink-0 tabular-nums">{category.tasks.length}</Badge></span></AccordionTrigger></AccordionHeader>
                  <AccordionPanel className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150 space-y-2 px-3 pb-3 sm:px-4 sm:pb-4">
                    {category.tasks.length === 0 ? <CompactEmpty message={overviewTasks.length > 0 && remainingOverviewTasks.length === 0 ? "As prioridades de hoje estão destacadas acima." : "Nenhuma tarefa para hoje nesta lista."} onAdd={() => setFormOpen(true)} /> : (["todo", "in_progress", "done"] as const).filter((status) => status === "todo" || category.tasks.some((task) => task.status === status)).map((status) => {
                      const statusId = `${category.id}:status:${status}`;
                      const statusTasks = category.tasks.filter((task) => task.status === status);
                      const label = status === "todo" ? "Pendentes" : status === "in_progress" ? "Em andamento" : "Concluídas";
                      const icon = status === "done" ? <CircleCheck aria-hidden="true" className="size-4" /> : status === "in_progress" ? <CircleDot aria-hidden="true" className="size-4" /> : <Circle aria-hidden="true" className="size-4" />;
                      return <Accordion key={statusId} multiple value={expandedSections.includes(statusId) ? [statusId] : []} onValueChange={(next) => updateExpandedSection(statusId, next.includes(statusId))}>
                        <AccordionItem value={statusId} className="overflow-hidden rounded-lg border bg-background">
                          <AccordionHeader><AccordionTrigger className="min-h-11 px-3 py-2"><span className="flex min-w-0 flex-1 items-center gap-2.5"><span className="text-muted-foreground">{icon}</span><span className="truncate text-sm font-medium">{label}</span><span className="text-xs tabular-nums text-muted-foreground">{statusTasks.length}</span></span></AccordionTrigger></AccordionHeader>
                          <AccordionPanel className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150 px-2 pb-2 sm:px-3">{statusTasks.length ? <div className="divide-y rounded-md border">{statusTasks.map((task) => <OverviewTaskRow key={task.id} task={task} listName={lists.find((list) => list.id === task.list_id)?.name} saving={savingTaskIds.has(task.id)} onToggle={() => void toggleComplete(task)} onOpen={() => setSelectedTaskId(task.id)} />)}</div> : <CompactEmpty message={status === "todo" ? "Nenhuma tarefa pendente." : status === "in_progress" ? "Nenhuma tarefa em andamento." : "Nenhuma tarefa concluída hoje."} onAdd={() => setFormOpen(true)} />}</AccordionPanel>
                        </AccordionItem>
                      </Accordion>;
                    })}
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>;
            })}
          </section> : null}

          {view === "lists" ? <Card><CardHeader><CardTitle className="text-base">Suas listas</CardTitle><CardDescription>Escolha uma lista para ver as tarefas.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{lists.length ? lists.map((list) => <Button key={list.id} variant="outline" className="h-auto justify-start gap-3 p-4" onClick={() => { setSelectedListId(list.id); setSelectedWorkspaceId(null); setView("list"); }}><ListTodo className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-left">{list.name}</span><Badge variant="secondary">{visibleTasks.filter((task) => task.list_id === list.id && task.status !== "done").length}</Badge></Button>) : <EmptyMessage title="Nenhuma lista disponível" description="As listas pessoais serão exibidas aqui quando estiverem prontas." />}</CardContent></Card> : view === "workspaces" ? <Card><CardHeader><CardTitle className="text-base">Seus workspaces</CardTitle><CardDescription>Projetos organizados por espaço.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{workspaces.length ? workspaces.map((workspace) => <Button key={workspace.id} variant="outline" className="h-auto justify-start gap-3 p-4" onClick={() => { setSelectedWorkspaceId(workspace.id); setSelectedListId(null); setView("workspace"); }}><Avatar className="size-8"><AvatarFallback><BriefcaseBusiness className="size-4" /></AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-left">{workspace.name}</span><Badge variant="secondary">{visibleTasks.filter((task) => task.workspace_id === workspace.id && task.status !== "done").length}</Badge></Button>) : <EmptyMessage title="Nenhum workspace disponível" description="Workspaces vinculados às suas tarefas aparecerão aqui." />}</CardContent></Card> : null}

          {view !== "lists" && view !== "workspaces" && !overviewMode ? <Card className="min-w-0 shadow-none">
            <CardHeader className="flex flex-col gap-3 space-y-0 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0"><CardTitle className="text-base">{sectionTitle[view]}</CardTitle><CardDescription className="mt-1">{activeView === "overview" && !selectedDate ? "Foque no que realmente importa para avançar." : selectedDate ? formatDateLong(selectedDate) : "Tarefas organizadas a partir dos seus registros."}</CardDescription></div>
              {filteredTasks.length ? <Badge variant="secondary" className="w-fit">{filteredTasks.length} {filteredTasks.length === 1 ? "tarefa" : "tarefas"}</Badge> : null}
            </CardHeader>
              {activeView === "all" ? <div className="px-4 pb-3 sm:px-5"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input className="pl-9" placeholder="Buscar tarefa" aria-label="Buscar tarefa" value={searchText} onChange={(event) => setSearchText(event.target.value)} /></div></div> : null}
              <CardContent className="px-4 pb-4 sm:px-5">
              {activeView === "overview" && !selectedDate && todayTasks.length === 0 && visibleTasks.length > 0 ? <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4" /> Você está sem tarefas para hoje.</div> : null}
              {searchedTasks.length ? <div className="divide-y rounded-xl border">
                {searchedTasks.map((task) => {
                  const list = lists.find((item) => item.id === task.list_id);
                  const time = taskTime(task);
                  return <div key={task.id} data-task-title={task.title.toLocaleLowerCase("pt-BR")} className="flex min-w-0 items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4">
                    <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" aria-label={task.status === "done" ? `Reabrir ${task.title}` : `Concluir ${task.title}`} aria-pressed={task.status === "done"} disabled={savingTaskIds.has(task.id)} onClick={() => void toggleComplete(task)}>
                      {savingTaskIds.has(task.id) ? <LoaderCircle className="size-4 animate-spin" /> : task.status === "done" ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5 text-muted-foreground" />}
                    </Button>
                    <button type="button" className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelectedTaskId(task.id)}>
                      <span className={cn("block break-words text-sm font-medium", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</span>
                      <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {list ? <span className="truncate">{list.name}</span> : null}
                        {task.due_at ? <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{time}</span> : task.due_on ? <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(localDateFromKey(task.due_on))}</span> : null}
                      </span>
                    </button>
                    <Badge variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "secondary" : "outline"} className="hidden shrink-0 sm:inline-flex">{priorityText(task.priority)}</Badge>
                    <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Abrir detalhes: ${task.title}`} onClick={() => setSelectedTaskId(task.id)}><ArrowRight className="size-4" /></Button>
                  </div>;
                })}
              </div> : <EmptyMessage title={searchText.trim() ? "Nenhuma tarefa encontrada" : emptyTitle(view, selectedDate, tasks.length)} description={searchText.trim() ? "Tente buscar por outro título ou descrição." : emptyDescription(view, selectedDate, tasks.length)} action={searchText.trim() ? undefined : <Button onClick={() => setFormOpen(true)}><Plus /> Nova tarefa</Button>} />}
              <Button variant="ghost" className="mt-3 w-full justify-start gap-2 border border-dashed text-muted-foreground hover:text-foreground" onClick={() => setFormOpen(true)}><Plus className="size-4" /> Adicionar uma nova tarefa</Button>
            </CardContent>
          </Card> : null}
        </div>

        {(!overviewMode || showAgenda) ? <aside className="min-w-0 space-y-5">
          <Card className="shadow-none">
            <CardHeader className="space-y-4 p-4 pb-2">
              <div className="flex items-center justify-between gap-2"><div><CardTitle className="text-base">Calendário</CardTitle><CardDescription className="mt-1">Datas com tarefas</CardDescription></div><Button variant="ghost" size="sm" onClick={() => today && chooseDate(localDateFromKey(today))}>Hoje</Button></div>
              <div className="flex items-center justify-between"><p className="text-sm font-semibold">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(monthStart)}</p><div className="flex items-center"><Button variant="ghost" size="icon" className="size-8" aria-label="Mês anterior" onClick={() => setMonth((current) => current ? moveMonth(current, -1) : current)}><ChevronLeft className="size-4" /></Button><Button variant="ghost" size="icon" className="size-8" aria-label="Próximo mês" onClick={() => setMonth((current) => current ? moveMonth(current, 1) : current)}><ChevronRight className="size-4" /></Button></div></div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="grid grid-cols-7 gap-1 text-center">{weekDays.map((day) => <span key={day} className="py-1 text-[10px] font-medium text-muted-foreground">{day}</span>)}
                {calendarDates.map((date) => {
                  const key = localDateKey(date);
                  const hasTasks = visibleTasks.some((task) => isTaskScheduledOn(task, key) || isTaskActiveOn(task, key));
                  const isToday = key === today;
                  const selected = key === (selectedDate ?? today);
                  return <button key={key} type="button" aria-label={`${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(date)}${hasTasks ? ", há tarefas" : ""}`} aria-pressed={selected} onClick={() => chooseDate(date)} className={cn("relative mx-auto grid size-8 place-items-center rounded-lg text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", date.getMonth() !== month.getMonth() && "text-muted-foreground/40", selected && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90", isToday && !selected && "ring-1 ring-primary text-primary")}>
                    {date.getDate()}{hasTasks && !selected ? <span className="absolute bottom-1 size-1 rounded-full bg-primary" /> : null}
                  </button>;
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-3"><div><CardTitle className="text-base">{selectedDate ? "Agenda do dia" : "Próximos prazos"}</CardTitle><CardDescription className="mt-1">{selectedDate ? formatDayAndMonth(selectedDate) : "Tarefas com data definida"}</CardDescription></div><ArrowDownWideNarrow className="size-4 text-muted-foreground" aria-hidden="true" /></CardHeader>
            <CardContent className="p-4 pt-0">
              {selectedDate ? selectedDayTasks.length ? <div className="space-y-1">{selectedDayTasks.slice(0, 6).map((task) => <DeadlineRow key={task.id} task={task} listName={lists.find((list) => list.id === task.list_id)?.name} onClick={() => setSelectedTaskId(task.id)} />)}</div> : <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Nenhuma tarefa nesta data.</p> : deadlines.length ? <div className="space-y-1">{deadlines.map((task) => <DeadlineRow key={task.id} task={task} listName={lists.find((list) => list.id === task.list_id)?.name} onClick={() => setSelectedTaskId(task.id)} />)}</div> : <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Nenhum prazo cadastrado.</p>}
              {!selectedDate && deadlines.length > 0 ? <Button variant="ghost" size="sm" className="mt-3 w-full justify-between" onClick={() => setView("all")}>Ver todas as tarefas <ArrowRight className="size-4" /></Button> : null}
            </CardContent>
          </Card>
        </aside> : null}
      </main>

      <TodoTaskFormDialog open={formOpen} onOpenChange={setFormOpen} lists={lists} workspaces={workspaces} initialDate={selectedDate ?? today} onCreated={refreshAll} />
      <TodoTaskDetailsSheet task={activeTask} list={selectedList} workspace={selectedWorkspace} lists={lists} workspaces={workspaces} onSelectTask={setSelectedTaskId} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }} onSaved={refreshAll} />
    </>
  );
}

function OverviewTaskRow({ task, listName, saving, onToggle, onOpen }: { task: TodoTask; listName?: string; saving: boolean; onToggle: () => void; onOpen: () => void }) {
  const time = taskTime(task);
  return <div className="flex min-w-0 items-center gap-2.5 px-2.5 py-2.5 sm:gap-3 sm:px-3">
    <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" aria-label={task.status === "done" ? `Reabrir ${task.title}` : `Concluir ${task.title}`} aria-pressed={task.status === "done"} disabled={saving} onClick={onToggle}>
      {saving ? <LoaderCircle className="size-4 animate-spin" /> : task.status === "done" ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5 text-muted-foreground" />}
    </Button>
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className={cn("block break-words text-sm font-medium", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</span>
      <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {task.description?.trim() ? <span className="max-w-full truncate">{task.description.trim()}</span> : null}
        {listName ? <span className="truncate">{listName}</span> : null}
        {time ? <span className="inline-flex shrink-0 items-center gap-1"><Clock3 aria-hidden="true" className="size-3" />{time}</span> : null}
      </span>
    </button>
    <Badge variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "secondary" : "outline"} className="hidden shrink-0 sm:inline-flex">{priorityText(task.priority)}</Badge>
    <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Abrir detalhes: ${task.title}`} onClick={onOpen}><ArrowRight aria-hidden="true" className="size-4" /></Button>
  </div>;
}

function CompactEmpty({ message = "Nenhuma tarefa pendente.", onAdd }: { message?: string; onAdd: () => void }) {
  return <div className="flex min-h-10 items-center justify-between gap-3 px-2 py-2 text-sm text-muted-foreground">
    <span>{message}</span>
    <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2" onClick={onAdd}><Plus aria-hidden="true" className="size-4" />Adicionar tarefa</Button>
  </div>;
}

function MetricCard({ icon, value, label, detail, tone }: { icon: ReactNode; value: number; label: string; detail: string; tone?: "green" | "red" }) {
  return <Card className="min-w-0 shadow-none"><CardHeader className="space-y-2 p-4 pb-1"><div className="flex items-center justify-between gap-2"><CardDescription>{label}</CardDescription><span className={cn("grid size-8 place-items-center rounded-lg bg-primary/10 text-primary", tone === "green" && "bg-emerald-500/10 text-emerald-600", tone === "red" && "bg-destructive/10 text-destructive")}>{icon}</span></div><CardTitle className="text-2xl tabular-nums">{value}</CardTitle></CardHeader><CardContent className="px-4 pb-4 text-xs text-muted-foreground">{detail}</CardContent></Card>;
}

function EmptyMessage({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center"><span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground"><Check className="size-5" /></span><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>{action ? <div className="mt-4">{action}</div> : null}</div>;
}

function DeadlineRow({ task, listName, onClick }: { task: TodoTask; listName?: string; onClick: () => void }) {
  const dueKey = taskDueDateKey(task);
  const time = taskTime(task);
  return <button type="button" onClick={onClick} className="flex w-full min-w-0 items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", task.priority === "high" ? "bg-destructive" : task.priority === "medium" ? "bg-primary" : "bg-muted-foreground/50")} aria-hidden="true" />
    <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{task.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{listName ?? "Sem lista"}{dueKey ? ` · ${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(localDateFromKey(dueKey))}` : ""}</span></span>
    {time ? <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{time}</span> : null}
  </button>;
}

function emptyTitle(view: TodoDashboardView, selectedDate: string | null, total: number) {
  if (view === "completed") return "Nenhuma tarefa concluída";
  if (selectedDate) return "Nenhuma tarefa nesta data";
  if (view === "today") return "Seu dia está livre";
  if (total > 0) return "Tudo em dia";
  return "Comece adicionando uma tarefa";
}

function emptyDescription(view: TodoDashboardView, selectedDate: string | null, total: number) {
  if (view === "completed") return "Quando você concluir uma tarefa, ela aparecerá aqui.";
  if (selectedDate) return "Escolha outra data no calendário ou crie uma tarefa para este dia.";
  if (view === "today") return "Não há tarefas previstas para hoje. Você pode organizar algo para mais tarde.";
  if (total > 0) return "Você concluiu todas as tarefas em aberto.";
  return "Suas tarefas reais aparecerão aqui depois que você as cadastrar.";
}
