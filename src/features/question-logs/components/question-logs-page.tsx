"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Check, ChevronDown, Clock3, Ellipsis, FileQuestion, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteQuestionBatchAction } from "@/features/question-logs/actions";
import { QuestionBatchDialog } from "@/features/question-logs/components/question-batch-dialog";
import { getQuestionStats, type QuestionBatch, type QuestionLogRecord, type QuestionLogsPageData } from "@/features/question-logs/domain/types";

type Period = "30" | "90" | "all";
const sourceTypeLabels: Record<string, string> = { plataforma: "Plataforma externa", prova_oficial: "Prova oficial", pdf: "PDF ou material", outro: "Outro", registro_estudo: "Registro de estudo" };

export function QuestionLogsPage({ data, initialSessionId = null }: { data: QuestionLogsPageData; initialSessionId?: string | null }) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("30");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(Boolean(initialSessionId));
  const [editBatchId, setEditBatchId] = useState<string | null>(null);
  const [dialogSessionId, setDialogSessionId] = useState<string | null>(initialSessionId);
  const [deleteTarget, setDeleteTarget] = useState<QuestionBatch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const editingBatch = data.batches.find((batch) => batch.id === editBatchId) ?? null;

  const filteredRecords = useMemo(() => {
    const cutoff = period === "all" ? null : subtractDays(data.today, Number(period));
    const searchText = search.trim().toLocaleLowerCase("pt-BR");
    return data.records.filter((record) => {
      if (cutoff && record.studiedOn < cutoff) return false;
      if (subjectFilter !== "all" && record.subjectId !== subjectFilter) return false;
      if (searchText && ![record.subjectName, record.topicTitle ?? "", record.sourceLabel, record.examTargetName ?? "", sourceTypeLabels[record.sourceType] ?? ""].some((value) => value.toLocaleLowerCase("pt-BR").includes(searchText))) return false;
      return true;
    });
  }, [data.records, data.today, period, search, subjectFilter]);
  const stats = getQuestionStats(filteredRecords);
  const activeBatchCount = filteredRecords.filter((record) => record.kind === "batch").length;
  const hasFilters = period !== "30" || subjectFilter !== "all" || search.trim().length > 0;

  function openNew(sessionId: string | null = null) { setEditBatchId(null); setDialogSessionId(sessionId); setDialogOpen(true); }
  function openEdit(id: string) { setDialogSessionId(null); setEditBatchId(id); setDialogOpen(true); }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteQuestionBatchAction({ id: deleteTarget.id });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Lote arquivado. Totais e histórico foram atualizados.");
      setDeleteTarget(null);
      router.refresh();
    } catch { toast.error("Não foi possível arquivar este lote."); }
    finally { setDeleting(false); }
  }

  function changeDialog(open: boolean) {
    setDialogOpen(open);
    if (!open && initialSessionId) router.replace("/registros", { scroll: false });
    if (!open) { setEditBatchId(null); setDialogSessionId(null); }
  }

  return <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pb-10 pt-8 sm:px-8 sm:pt-10 lg:px-10">
    <section className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Prática externa</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[34px]">Registros de questões</h1><p className="mt-2 text-sm text-muted-foreground">Acompanhe o que resolveu e registre novos lotes sem perder o histórico.</p></div>
      <Button onClick={() => openNew()} className="gap-2 self-start"><Plus aria-hidden="true" className="size-4" />Registrar questões</Button>
    </section>

    <section aria-label="Resumo do período selecionado" className="mb-7 grid gap-3 sm:grid-cols-3">
      <Metric title="Questões registradas" value={stats.questionCount.toLocaleString("pt-BR")} hint={periodLabel(period)} />
      <Metric title="Acertos" value={stats.correctCount.toLocaleString("pt-BR")} hint={`${activeBatchCount} ${activeBatchCount === 1 ? "lote registrado" : "lotes registrados"}`} />
      <Metric title="Aproveitamento" value={stats.accuracy === null ? "—" : formatPercent(stats.accuracy)} hint={stats.questionCount === 0 ? "Sem questões no período" : `${stats.correctCount.toLocaleString("pt-BR")} de ${stats.questionCount.toLocaleString("pt-BR")} questões`} />
    </section>

    <Card className="gap-0 rounded-2xl py-0 shadow-sm shadow-foreground/[0.02]">
      <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Histórico de questões</CardTitle><CardDescription className="mt-1.5">Lotes manuais e resumos legados, contabilizados sem duplicidade.</CardDescription></div><Badge variant="secondary">{filteredRecords.length} {filteredRecords.length === 1 ? "registro" : "registros"}</Badge></div></CardHeader>
      <CardContent className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(200px,1fr)_180px_200px]">
          <label className="relative"><span className="sr-only">Buscar por matéria, tópico, origem ou concurso</span><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar matéria, tópico ou origem" className="pl-9" /></label>
          <FilterSelect label="Período" value={period} onChange={(value) => setPeriod(value as Period)} options={[{ value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" }, { value: "all", label: "Todo o período" }]} />
          <FilterSelect label="Matéria" value={subjectFilter} onChange={setSubjectFilter} options={[{ value: "all", label: "Todas as matérias" }, ...data.subjects.map((subject) => ({ value: subject.id, label: `${subject.name}${subject.archivedAt ? " (arquivada)" : ""}` }))]} />
        </div>

        {filteredRecords.length > 0 ? <>
          <div className="hidden overflow-x-auto rounded-xl border md:block"><table className="w-full min-w-[820px] text-sm"><thead className="bg-muted/30 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-4 py-3 text-left">Data</th><th className="px-4 py-3 text-left">Matéria / tópico</th><th className="px-4 py-3 text-left">Origem</th><th className="px-4 py-3 text-right">Feitas</th><th className="px-4 py-3 text-right">Acertos</th><th className="px-4 py-3 text-right">Taxa</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y">{filteredRecords.map((record) => <tr key={`${record.kind}-${record.id}`} className="hover:bg-muted/20"><td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{formatDate(record.studiedOn)}</td><td className="px-4 py-3.5"><p className="font-medium">{record.subjectName}</p><p className="mt-0.5 text-xs text-muted-foreground">{record.topicTitle ?? "Sem tópico específico"}{record.examTargetName ? ` · ${record.examTargetName}` : ""}</p>{record.kind === "study_summary" ? <Badge variant="outline" className="mt-1">Resumo anterior</Badge> : null}</td><td className="px-4 py-3.5"><p>{record.sourceLabel}</p><p className="mt-0.5 text-xs text-muted-foreground">{sourceTypeLabels[record.sourceType]}</p></td><td className="px-4 py-3.5 text-right tabular-nums">{record.questionCount}</td><td className="px-4 py-3.5 text-right tabular-nums">{record.correctCount}</td><td className="px-4 py-3.5 text-right"><AccuracyBadge record={record} /></td><td className="px-4 py-3.5 text-right"><RecordActions record={record} onEdit={openEdit} onDelete={(id) => setDeleteTarget(data.batches.find((batch) => batch.id === id) ?? null)} onDetail={openNew} /></td></tr>)}</tbody></table></div>
          <div className="space-y-2 md:hidden">{filteredRecords.map((record) => <article key={`${record.kind}-${record.id}`} className="rounded-xl border p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" />{formatDate(record.studiedOn)}</span>{record.durationMinutes ? <span className="inline-flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3.5" />{record.durationMinutes} min</span> : null}</div><p className="mt-1.5 truncate text-sm font-semibold">{record.subjectName}{record.topicTitle ? <span className="font-normal text-muted-foreground"> · {record.topicTitle}</span> : null}</p></div><RecordActions record={record} onEdit={openEdit} onDelete={(id) => setDeleteTarget(data.batches.find((batch) => batch.id === id) ?? null)} onDetail={openNew} /></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs"><span className="text-muted-foreground">{record.sourceLabel}{record.examTargetName ? ` · ${record.examTargetName}` : ""}</span><span>{record.correctCount}/{record.questionCount} acertos <span className="text-muted-foreground">· {record.questionCount - record.correctCount} erros</span></span><AccuracyBadge record={record} /></div>{record.kind === "study_summary" ? <Badge variant="outline" className="mt-2">Resumo anterior</Badge> : null}</article>)}</div>
        </> : data.records.length === 0 ? <div className="rounded-xl border border-dashed bg-muted/10 px-5 py-12 text-center"><span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground"><FileQuestion aria-hidden="true" className="size-5" /></span><h2 className="mt-3 text-sm font-semibold">Nenhum registro de questões</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Registre lotes feitos em plataformas, provas oficiais ou materiais externos. Não é necessário copiar enunciados.</p><Button className="mt-4 gap-2" onClick={() => openNew()}><Plus aria-hidden="true" className="size-4" />Registrar questões</Button></div> : <div className="rounded-xl border border-dashed px-5 py-10 text-center"><h2 className="text-sm font-semibold">Nenhum resultado para estes filtros</h2><p className="mt-1 text-sm text-muted-foreground">Tente outro período, matéria ou termo de busca.</p>{hasFilters ? <Button variant="outline" className="mt-4" onClick={() => { setPeriod("30"); setSubjectFilter("all"); setSearch(""); }}>Limpar filtros</Button> : null}</div>}

        <p className="mt-4 flex items-start gap-2 rounded-lg border border-primary/10 bg-primary/[0.03] px-3.5 py-3 text-xs leading-5 text-muted-foreground"><Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />Registre somente o total resolvido em uma plataforma externa. Não precisa copiar enunciados nem cadastrar erros individualmente.</p>
      </CardContent>
    </Card>

    {dialogOpen ? <QuestionBatchDialog key={editingBatch?.id ?? `new-${dialogSessionId ?? "manual"}`} open onOpenChange={changeDialog} today={data.today} subjects={data.subjects} topics={data.topics} examTargets={data.examTargets} studySessions={data.studySessions} batch={editingBatch} initialSessionId={editingBatch ? null : dialogSessionId} /> : null}
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir este lote de questões?</AlertDialogTitle><AlertDialogDescription>O lote será arquivado e sairá do histórico e dos totais. A sessão de estudo, o planejamento e as revisões vinculadas permanecerão intactos. Se este lote substituía um resumo anterior, o resumo voltará às métricas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void confirmDelete(); }}>{deleting ? "Arquivando…" : "Excluir lote"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </main>;
}

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) { return <Card className="gap-0 py-0 shadow-sm"><CardHeader className="px-5 pt-4"><CardDescription>{title}</CardDescription><CardTitle className="pt-1 text-2xl font-semibold tabular-nums">{value}</CardTitle></CardHeader><CardContent className="px-5 pb-4 pt-1 text-xs text-muted-foreground">{hint}</CardContent></Card>; }

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="relative"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /></label>; }

function AccuracyBadge({ record }: { record: QuestionLogRecord }) { const accuracy = record.questionCount ? Math.round(record.correctCount / record.questionCount * 1000) / 10 : null; return <Badge variant="secondary" className="tabular-nums">{accuracy === null ? "—" : formatPercent(accuracy)}</Badge>; }

function RecordActions({ record, onEdit, onDelete, onDetail }: { record: QuestionLogRecord; onEdit: (id: string) => void; onDelete: (id: string) => void; onDetail: (sessionId: string | null) => void }) {
  if (record.kind === "study_summary") return <Button size="sm" variant="outline" onClick={() => onDetail(record.studySessionId)} className="whitespace-nowrap">Detalhar lote</Button>;
  return <DropdownMenu><DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Ações do lote de ${record.subjectName}`} />}><Ellipsis aria-hidden="true" className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onEdit(record.id)}><Pencil aria-hidden="true" />Editar</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={() => onDelete(record.id)}><Trash2 aria-hidden="true" />Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function subtractDays(dateValue: string, amount: number): string { const date = new Date(`${dateValue}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() - amount); return date.toISOString().slice(0, 10); }
function formatDate(value: string): string { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)).replace(" de ", " "); }
function formatPercent(value: number): string { return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`; }
function periodLabel(period: Period): string { return period === "all" ? "Todo o período" : `Últimos ${period} dias`; }
