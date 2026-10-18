"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, ChevronDown, NotebookPen, Search, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MistakeEntrySheet } from "@/features/mistakes/components/mistake-entry-sheet";
import { filterMistakeEntries, getMistakeReasonLabel, getMistakeStatusLabel, type MistakeEntry, type MistakeReason, type MistakeStatus, type MistakesPageData } from "@/features/mistakes/domain/types";

type StatusFilter = MistakeStatus | "all";
const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: "needs_review", label: "Precisa revisar" },
  { value: "in_review", label: "Em revisão" },
  { value: "understood", label: "Compreendido" },
  { value: "all", label: "Todos" },
];
const reasons: { value: MistakeReason | "all"; label: string }[] = [
  { value: "all", label: "Todos os motivos" },
  { value: "conteudo", label: "Conteúdo" },
  { value: "interpretacao", label: "Interpretação" },
  { value: "desatencao", label: "Desatenção" },
  { value: "tempo", label: "Tempo" },
  { value: "confusao_regra", label: "Confusão de regra" },
  { value: "outro", label: "Outro" },
];

export function MistakesPage({ data, initialBatchId = null }: { data: MistakesPageData; initialBatchId?: string | null }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("needs_review");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState<MistakeReason | "all">("all");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialBatchId));
  const [selectedEntry, setSelectedEntry] = useState<MistakeEntry | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(initialBatchId);

  const visibleTopics = useMemo(() => data.topics.filter((topic) => subjectFilter === "all" || topic.subjectId === subjectFilter), [data.topics, subjectFilter]);
  const filteredEntries = useMemo(() => filterMistakeEntries(data.entries, {
    status: statusFilter,
    subjectId: subjectFilter,
    topicId: topicFilter,
    reason: reasonFilter,
    query,
  }), [data.entries, statusFilter, subjectFilter, topicFilter, reasonFilter, query]);
  const hasFilters = subjectFilter !== "all" || topicFilter !== "all" || reasonFilter !== "all" || query.trim() !== "";

  function openNew() {
    setSelectedEntry(null);
    setSelectedBatchId(null);
    setSheetOpen(true);
  }

  function openEntry(entry: MistakeEntry) {
    setSelectedEntry(entry);
    setSelectedBatchId(null);
    setSheetOpen(true);
  }

  function closeSheet(open: boolean) {
    setSheetOpen(open);
    if (!open) {
      setSelectedEntry(null);
      setSelectedBatchId(null);
      if (initialBatchId) router.replace("/caderno-de-erros", { scroll: false });
    }
  }

  function changeSubject(value: string) {
    setSubjectFilter(value);
    if (topicFilter !== "all" && !data.topics.some((topic) => topic.id === topicFilter && (value === "all" || topic.subjectId === value))) setTopicFilter("all");
  }

  const isEmpty = data.entries.length === 0;

  return <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pb-10 pt-8 sm:px-8 sm:pt-10 lg:px-10">
    <section className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Organização do estudo</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[34px]">Caderno de erros</h1><p className="mt-2 text-sm text-muted-foreground">Entenda suas dificuldades e guarde somente o que vale revisitar.</p></div>
      <Button onClick={openNew} className="gap-2 self-start"><Plus aria-hidden="true" className="size-4" />Adicionar dificuldade</Button>
    </section>

    <Card className="gap-0 rounded-2xl py-0 shadow-sm shadow-foreground/[0.02]">
      <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Dificuldades registradas</CardTitle><CardDescription className="mt-1.5">Anote apenas erros importantes ou recorrentes.</CardDescription></div>{data.entries.length > 0 ? <Badge variant="secondary">{data.entries.length} {data.entries.length === 1 ? "ficha" : "fichas"}</Badge> : null}</div>
      </CardHeader>
      <CardContent className="px-4 pb-5 pt-3 sm:px-6 sm:pb-6">
        <div role="tablist" aria-label="Filtrar fichas por situação" className="mb-5 flex gap-5 overflow-x-auto border-b">
          {statusTabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={statusFilter === tab.value} onClick={() => setStatusFilter(tab.value)} className={`-mb-px shrink-0 border-b-2 px-0.5 pb-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusFilter === tab.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{tab.label}</button>)}
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_190px_190px_200px]">
          <label className="relative"><span className="sr-only">Buscar no caderno por matéria, tópico ou anotação</span><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no caderno" className="pl-9" /></label>
          <FilterSelect label="Matéria" value={subjectFilter} onChange={changeSubject} options={[{ value: "all", label: "Todas as matérias" }, ...data.subjects.map((subject) => ({ value: subject.id, label: `${subject.name}${subject.archivedAt ? " · arquivada" : ""}` }))]} />
          <FilterSelect label="Tópico" value={topicFilter} onChange={setTopicFilter} options={[{ value: "all", label: "Todos os tópicos" }, ...visibleTopics.map((topic) => ({ value: topic.id, label: topic.title }))]} />
          <FilterSelect label="Motivo do erro" value={reasonFilter} onChange={(value) => setReasonFilter(value as MistakeReason | "all")} options={reasons} />
        </div>

        {filteredEntries.length ? <>
          <div className="hidden overflow-x-auto rounded-xl border md:block"><table className="w-full min-w-[760px] table-fixed text-sm"><colgroup><col className="w-[37%]" /><col className="w-[24%]" /><col className="w-[14%]" /><col className="w-[18%]" /><col className="w-[7%]" /></colgroup><thead className="bg-muted/30 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-4 py-3 text-left">Assunto</th><th className="px-4 py-3 text-left">Motivo do erro</th><th className="px-4 py-3 text-left">Data</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right"><span className="sr-only">Abrir</span></th></tr></thead><tbody className="divide-y">{filteredEntries.map((entry) => <tr key={entry.id} className="hover:bg-muted/20"><td className="px-4 py-3.5"><p className="font-medium">{entry.topicTitle ?? "Sem tópico específico"}</p><p className="mt-0.5 text-xs text-muted-foreground">{entry.subjectName}</p></td><td className="px-4 py-3.5 text-muted-foreground">{getMistakeReasonLabel(entry.reason)}</td><td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{formatDate(entry.createdAt, data.timezone)}</td><td className="px-4 py-3.5"><StatusBadge status={entry.status} /></td><td className="px-4 py-3.5 text-right"><Button variant="link" size="sm" onClick={() => openEntry(entry)} aria-label={`Abrir ficha: ${entry.topicTitle ?? entry.subjectName}`}>Abrir</Button></td></tr>)}</tbody></table></div>
          <div className="space-y-2 md:hidden">{filteredEntries.map((entry) => <article key={entry.id} className="rounded-xl border p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{entry.topicTitle ?? "Sem tópico específico"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.subjectName} · {getMistakeReasonLabel(entry.reason)}</p></div><StatusBadge status={entry.status} /></div><div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span>{formatDate(entry.createdAt, data.timezone)}</span><Button variant="link" size="sm" onClick={() => openEntry(entry)} aria-label={`Abrir ficha: ${entry.topicTitle ?? entry.subjectName}`}>Abrir</Button></div></article>)}</div>
        </> : isEmpty ? <div className="rounded-xl border border-dashed bg-muted/10 px-5 py-12 text-center"><span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground"><NotebookPen aria-hidden="true" className="size-5" /></span><h2 className="mt-3 text-sm font-semibold">Nenhuma dificuldade registrada</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Anote apenas erros importantes ou recorrentes que vale revisitar. Não é necessário criar uma ficha para cada questão errada.</p><Button className="mt-4 gap-2" onClick={openNew}><Plus aria-hidden="true" className="size-4" />Adicionar dificuldade</Button></div> : <div className="rounded-xl border border-dashed px-5 py-10 text-center"><span className="mx-auto grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground"><BookOpenText aria-hidden="true" className="size-4" /></span><h2 className="mt-3 text-sm font-semibold">Nenhuma dificuldade nesta seleção</h2><p className="mt-1 text-sm text-muted-foreground">Tente outro status ou ajuste os filtros para encontrar uma ficha.</p>{hasFilters || statusFilter !== "needs_review" ? <Button variant="outline" className="mt-4" onClick={() => { setStatusFilter("needs_review"); setSubjectFilter("all"); setTopicFilter("all"); setReasonFilter("all"); setQuery(""); }}>Limpar filtros</Button> : null}</div>}

        <p className="mt-4 rounded-lg border border-primary/10 bg-primary/[0.03] px-3.5 py-3 text-xs leading-5 text-muted-foreground">Cada anotação pode se vincular a um lote de questões. Ela não altera seu planejamento, suas revisões ou os totais de acertos.</p>
      </CardContent>
    </Card>

    {sheetOpen ? <MistakeEntrySheet key={selectedEntry?.id ?? `new-${selectedBatchId ?? "manual"}`} open onOpenChange={closeSheet} entry={selectedEntry} initialBatchId={selectedEntry ? null : selectedBatchId} subjects={data.subjects} topics={data.topics} batches={data.batches} /> : null}
  </main>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <label className="relative"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /></label>;
}

function StatusBadge({ status }: { status: MistakeStatus }) {
  const styles: Record<MistakeStatus, string> = {
    needs_review: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    in_review: "bg-primary/10 text-primary",
    understood: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  };
  return <Badge variant="secondary" className={`whitespace-nowrap ${styles[status]}`}>{getMistakeStatusLabel(status)}</Badge>;
}

function formatDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: timezone }).format(new Date(value)).replace(" de ", " ");
}
