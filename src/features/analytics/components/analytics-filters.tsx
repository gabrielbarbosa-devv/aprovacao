"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalyticsFilters, AnalyticsSort, AnalyticsSubject } from "@/features/analytics/domain/types";

type AnalyticsFiltersProps = { filters: AnalyticsFilters; subjects: AnalyticsSubject[] };

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "custom", label: "Personalizado" },
] as const;
const sortOptions = [
  { value: "questions", label: "Questões resolvidas" },
  { value: "correct", label: "Acertos" },
  { value: "accuracy", label: "Aproveitamento" },
] as const;

export function AnalyticsFiltersBar({ filters, subjects }: AnalyticsFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState(filters.period);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [subjectId, setSubjectId] = useState(filters.subjectId ?? "all");
  const [sortBy, setSortBy] = useState<AnalyticsSort>(filters.sortBy);
  const [rangeError, setRangeError] = useState(false);
  const subjectOptions = [
    { value: "all", label: "Todas as matérias" },
    ...subjects.map((subject) => ({ value: subject.id, label: `${subject.name}${subject.archivedAt ? " (arquivada)" : ""}` })),
  ];

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalidRange = period === "custom" && (!from || !to || from > to);
    setRangeError(invalidRange);
    if (invalidRange) return;
    const query = new URLSearchParams();
    query.set("period", period);
    if (subjectId !== "all") query.set("subject", subjectId);
    if (sortBy !== "questions") query.set("sort", sortBy);
    if (period === "custom") {
      query.set("from", from);
      query.set("to", to);
    }
    startTransition(() => router.push(`/meu-progresso?${query.toString()}`, { scroll: false }));
  }

  return (
    <form onSubmit={applyFilters} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
      <div className="grid min-w-36 gap-2">
        <Label htmlFor="analytics-period">Período</Label>
        <Select items={periodOptions} value={period} onValueChange={(value) => { if (value === "7" || value === "30" || value === "90" || value === "custom") setPeriod(value); }}>
          <SelectTrigger id="analytics-period" aria-label="Período" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid min-w-44 gap-2">
        <Label htmlFor="analytics-subject">Matéria</Label>
        <Select items={subjectOptions} value={subjectId} onValueChange={(value) => { if (value) setSubjectId(value); }}>
          <SelectTrigger id="analytics-subject" aria-label="Matéria" className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as matérias</SelectItem>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.name}{subject.archivedAt ? " (arquivada)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid min-w-40 gap-2">
        <Label htmlFor="analytics-sort">Ordenar matérias</Label>
        <Select items={sortOptions} value={sortBy} onValueChange={(value) => { if (value === "questions" || value === "correct" || value === "accuracy") setSortBy(value); }}>
          <SelectTrigger id="analytics-sort" aria-label="Ordenar matérias" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="questions">Questões resolvidas</SelectItem>
            <SelectItem value="correct">Acertos</SelectItem>
            <SelectItem value="accuracy">Aproveitamento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {period === "custom" ? (
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div className="grid gap-2">
            <Label htmlFor="analytics-from">De</Label>
            <Input id="analytics-from" type="date" required value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="analytics-to">Até</Label>
            <Input id="analytics-to" type="date" required value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
      ) : null}

      {rangeError ? <p role="alert" className="text-sm text-destructive sm:basis-full">Escolha um intervalo válido: a data inicial deve ser anterior ou igual à final.</p> : null}

      <Button type="submit" disabled={isPending} className="sm:ml-auto">
        {isPending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
        {isPending ? "Atualizando" : "Aplicar filtros"}
      </Button>
      <span className="sr-only" aria-live="polite">{isPending ? "Atualizando indicadores." : ""}</span>
    </form>
  );
}
