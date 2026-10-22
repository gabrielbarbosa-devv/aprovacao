"use client";

import { useState } from "react";
import { ptBR } from "date-fns/locale";
import { CalendarDays, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TodoList } from "@/features/todo/domain/types";
import type { TodoTaskDueFilter, TodoTaskListFilters, TodoTaskSort, TodoTaskStatusFilter } from "@/features/todo/domain/task-list";
import { localDateFromKey, localDateKey } from "@/features/todo/domain/dashboard";
import { cn } from "@/lib/utils";

const dueOptions: { value: TodoTaskDueFilter; label: string }[] = [
  { value: "all", label: "Qualquer prazo" },
  { value: "overdue", label: "Atrasadas" },
  { value: "this_week", label: "Esta semana" },
  { value: "upcoming", label: "Próximas" },
  { value: "no_date", label: "Sem data" },
];

const sortOptions: { value: TodoTaskSort; label: string }[] = [
  { value: "date", label: "Prazo mais próximo" },
  { value: "priority", label: "Maior prioridade" },
  { value: "created", label: "Mais recentes" },
];

export function TodoTaskFilters({ filters, lists, counts, onChange, onClear }: {
  filters: TodoTaskListFilters;
  lists: TodoList[];
  counts: { all: number; pending: number; completed: number };
  onChange: (changes: Partial<TodoTaskListFilters>) => void;
  onClear: () => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const listItems = [{ value: "all", label: "Todas as listas" }, ...lists.map((list) => ({ value: list.id, label: list.name }))];
  const priorityItems = [{ value: "all", label: "Todas" }, { value: "high", label: "Alta" }, { value: "medium", label: "Média" }, { value: "low", label: "Baixa" }];
  const selectedDateLabel = filters.dueDate ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(localDateFromKey(filters.dueDate)) : null;
  const hasActiveFilters = Boolean(filters.query.trim()) || filters.status !== "all" || filters.listId !== "all" || filters.priority !== "all" || filters.due !== "all" || Boolean(filters.dueDate) || filters.sort !== "date";

  return <section className="space-y-3 rounded-xl border bg-card p-3 sm:p-4" aria-label="Filtros de tarefas">
    <div className="grid gap-3 xl:grid-cols-[minmax(14rem,1.2fr)_minmax(0,1fr)] xl:items-center">
      <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={filters.query} onChange={(event) => onChange({ query: event.target.value })} placeholder="Buscar por título ou descrição" aria-label="Buscar por título ou descrição" className="pl-9" /></div>
      <Tabs value={filters.status} onValueChange={(value) => { if (value === "all" || value === "pending" || value === "completed") onChange({ status: value as TodoTaskStatusFilter }); }}>
        <TabsList className="grid h-9 w-full grid-cols-3 sm:w-fit sm:min-w-[22rem]">
          <TabsTrigger value="all" className="gap-1.5">Todas <Badge variant="secondary" className={cn("h-5 px-1.5 text-[10px]", filters.status === "all" && "bg-background")}>{counts.all}</Badge></TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">Pendentes <Badge variant="secondary" className={cn("h-5 px-1.5 text-[10px]", filters.status === "pending" && "bg-background")}>{counts.pending}</Badge></TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5">Concluídas <Badge variant="secondary" className={cn("h-5 px-1.5 text-[10px]", filters.status === "completed" && "bg-background")}>{counts.completed}</Badge></TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <Select items={listItems} value={filters.listId} onValueChange={(value) => value && onChange({ listId: value })}><SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por lista"><SelectValue /></SelectTrigger><SelectContent>{listItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
      <Select items={priorityItems} value={filters.priority} onValueChange={(value) => { if (value === "all" || value === "high" || value === "medium" || value === "low") onChange({ priority: value }); }}><SelectTrigger className="w-full sm:w-36" aria-label="Filtrar por prioridade"><SelectValue /></SelectTrigger><SelectContent>{priorityItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
      <Select items={dueOptions} value={filters.due} onValueChange={(value) => { if (dueOptions.some((item) => item.value === value)) onChange({ due: value as TodoTaskDueFilter }); }}><SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por prazo"><SelectValue /></SelectTrigger><SelectContent>{dueOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger render={<Button variant={filters.dueDate ? "secondary" : "outline"} className="w-full justify-start sm:w-auto" />}><CalendarDays aria-hidden="true" />{selectedDateLabel ?? "Data específica"}</PopoverTrigger><PopoverContent align="start" className="w-auto p-0"><Calendar mode="single" locale={ptBR} selected={filters.dueDate ? localDateFromKey(filters.dueDate) : undefined} onSelect={(date) => { onChange({ dueDate: date ? localDateKey(date) : "" }); setCalendarOpen(false); }} /></PopoverContent></Popover>
      <Select items={sortOptions} value={filters.sort} onValueChange={(value) => { if (sortOptions.some((item) => item.value === value)) onChange({ sort: value as TodoTaskSort }); }}><SelectTrigger className="w-full sm:ml-auto sm:w-48" aria-label="Ordenar tarefas"><SelectValue /></SelectTrigger><SelectContent>{sortOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
      {hasActiveFilters ? <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto sm:ml-0"><RotateCcw aria-hidden="true" />Limpar filtros</Button> : null}
    </div>
  </section>;
}
