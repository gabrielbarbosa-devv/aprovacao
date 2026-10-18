"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, BookOpen, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveQuestionBatchAction } from "@/features/question-logs/actions";
import { questionBatchSchema, questionSourceTypes } from "@/features/question-logs/domain/schemas";
import { getQuestionResult } from "@/features/question-logs/domain/types";
import type { QuestionBatch, QuestionExamOption, QuestionSessionOption, QuestionSourceType, QuestionSubjectOption, QuestionTopicOption } from "@/features/question-logs/domain/types";

const sourceLabels: Record<QuestionSourceType, string> = { plataforma: "Plataforma externa", prova_oficial: "Prova oficial", pdf: "PDF ou material", outro: "Outro" };

export function QuestionBatchDialog({ open, onOpenChange, today, subjects, topics, examTargets, studySessions, batch = null, initialSessionId = null }: {
  open: boolean; onOpenChange: (open: boolean) => void; today: string;
  subjects: QuestionSubjectOption[]; topics: QuestionTopicOption[]; examTargets: QuestionExamOption[];
  studySessions: QuestionSessionOption[]; batch?: QuestionBatch | null; initialSessionId?: string | null;
}) {
  const router = useRouter();
  const initialSession = studySessions.find((session) => session.id === (batch?.studySessionId ?? initialSessionId));
  const [studiedOn, setStudiedOn] = useState(batch?.studiedOn ?? initialSession?.studiedOn ?? today);
  const [subjectId, setSubjectId] = useState(batch?.subjectId ?? initialSession?.subjectId ?? "");
  const [topicId, setTopicId] = useState(batch?.topicId ?? initialSession?.topicId ?? "");
  const [sourceType, setSourceType] = useState<QuestionSourceType>(batch?.sourceType ?? "plataforma");
  const [sourceLabel, setSourceLabel] = useState(batch?.sourceLabel ?? "");
  const [examTargetId, setExamTargetId] = useState(batch?.examTargetId ?? "");
  const [studySessionId, setStudySessionId] = useState(batch?.studySessionId ?? initialSession?.id ?? "");
  const [questionCount, setQuestionCount] = useState(batch ? String(batch.questionCount) : initialSession?.questionCount ? String(initialSession.questionCount) : "");
  const [correctCount, setCorrectCount] = useState(batch ? String(batch.correctCount) : initialSession?.correctCount ? String(initialSession.correctCount) : "");
  const [durationMinutes, setDurationMinutes] = useState(batch?.durationMinutes ? String(batch.durationMinutes) : "");
  const [notes, setNotes] = useState(batch?.notes ?? "");
  const [replacesSessionTotals, setReplacesSessionTotals] = useState(batch?.replacesSessionTotals ?? Boolean(initialSession && initialSession.questionCount > 0));
  const [operationKey, setOperationKey] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedTarget = examTargets.find((target) => target.id === examTargetId);
  const selectedSession = studySessions.find((session) => session.id === studySessionId);
  const subjectOptions = useMemo(() => subjects.filter((subject) =>
    (subject.archivedAt === null || subject.id === subjectId)
    && (!selectedTarget || selectedTarget.subjectIds.includes(subject.id))), [subjects, subjectId, selectedTarget]);
  const availableTopics = useMemo(() => {
    let result = topics.filter((topic) => topic.subjectId === subjectId && (topic.archivedAt === null || topic.id === topicId));
    if (selectedTarget) {
      const targetTopicIdsForSubject = selectedTarget.topicIds.filter((id) => topics.find((topic) => topic.id === id)?.subjectId === subjectId);
      if (targetTopicIdsForSubject.length > 0) result = result.filter((topic) => targetTopicIdsForSubject.includes(topic.id));
    }
    if (selectedSession && selectedSession.subjectId === subjectId) result = result.filter((topic) => topic.id === selectedSession.topicId || topic.id === topicId);
    return result;
  }, [topics, subjectId, topicId, selectedTarget, selectedSession]);
  const availableSessions = studySessions.filter((session) => session.deletedAt === null || session.id === studySessionId)
    .filter((session) => (!subjectId || session.subjectId === subjectId) && (!selectedTarget || selectedTarget.subjectIds.includes(session.subjectId)));
  const questionsNumber = Number(questionCount);
  const correctNumber = Number(correctCount);
  const validCounts = questionCount !== "" && correctCount !== "" && Number.isSafeInteger(questionsNumber) && questionsNumber > 0 && Number.isSafeInteger(correctNumber) && correctNumber >= 0 && correctNumber <= questionsNumber;
  const result = getQuestionResult(validCounts ? questionsNumber : 0, validCounts ? correctNumber : 0);
  const initialSummaryAvailable = selectedSession !== undefined && selectedSession.questionCount > 0;

  function updateSubject(nextId: string) {
    setSubjectId(nextId);
    const nextTarget = examTargets.find((target) => target.id === examTargetId);
    const nextTopicIds = topics.filter((topic) => topic.subjectId === nextId && topic.archivedAt === null).map((topic) => topic.id);
    if (!nextTopicIds.includes(topicId)) setTopicId("");
    if (selectedSession && selectedSession.subjectId !== nextId) setStudySessionId("");
    if (nextTarget && !nextTarget.subjectIds.includes(nextId)) setExamTargetId("");
  }

  function updateTarget(nextId: string) {
    const nextTarget = examTargets.find((target) => target.id === nextId);
    setExamTargetId(nextId);
    if (nextTarget && subjectId && !nextTarget.subjectIds.includes(subjectId)) {
      setSubjectId(""); setTopicId(""); setStudySessionId("");
    } else if (nextTarget && topicId) {
      const mappedForSubject = nextTarget.topicIds.filter((id) => topics.find((topic) => topic.id === id)?.subjectId === subjectId);
      if (mappedForSubject.length > 0 && !mappedForSubject.includes(topicId)) setTopicId("");
    }
  }

  function updateSession(nextId: string) {
    setStudySessionId(nextId);
    const nextSession = studySessions.find((session) => session.id === nextId);
    if (!nextSession) { setReplacesSessionTotals(false); return; }
    setSubjectId(nextSession.subjectId);
    setTopicId(nextSession.topicId);
    setStudiedOn(nextSession.studiedOn);
    const canReplace = nextSession.questionCount > 0;
    setReplacesSessionTotals(canReplace);
    if (selectedTarget) {
      const mappedTopics = selectedTarget.topicIds.filter((id) => topics.find((topic) => topic.id === id)?.subjectId === nextSession.subjectId);
      if (mappedTopics.length > 0 && !mappedTopics.includes(nextSession.topicId)) setTopicId("");
    }
    if (canReplace) {
      setQuestionCount(String(nextSession.questionCount));
      setCorrectCount(String(nextSession.correctCount));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextOperationKey = operationKey || crypto.randomUUID();
    setOperationKey(nextOperationKey);
    const parsed = questionBatchSchema.safeParse({
      id: batch?.id ?? null, operationKey: nextOperationKey, studiedOn, subjectId: subjectId || "", topicId: topicId || null,
      sourceType, sourceLabel, examTargetId: examTargetId || null, studySessionId: studySessionId || null,
      questionCount: questionsNumber, correctCount: correctNumber, durationMinutes: durationMinutes === "" ? null : Number(durationMinutes),
      notes, replacesSessionTotals,
    });
    if (!parsed.success) { setFieldError(parsed.error.issues[0]?.message ?? "Confira os dados do registro."); return; }
    setFieldError(""); setSaving(true);
    try {
      const saved = await saveQuestionBatchAction(parsed.data);
      if (!saved.ok) { setFieldError(saved.message); toast.error(saved.message); return; }
      toast.success(saved.status === "exists" ? "Este registro já estava salvo." : batch ? "Lote atualizado." : "Questões registradas.");
      onOpenChange(false);
      router.refresh();
    } catch {
      const message = "Falha de conexão ao salvar. Seus dados continuam no formulário; tente novamente.";
      setFieldError(message); toast.error(message);
    } finally { setSaving(false); }
  }

  function changeOpen(next: boolean) { if (!saving) onOpenChange(next); }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent className="max-h-[94svh] overflow-y-auto p-0 sm:max-w-[680px]">
      <form onSubmit={submit} noValidate>
        <DialogHeader className="px-5 pt-5 sm:px-6 sm:pt-6"><div className="flex items-center justify-between gap-2 pr-7"><DialogTitle>{batch ? "Editar registro de questões" : "Registrar questões"}</DialogTitle><span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">Registro manual</span></div><DialogDescription>Informe os resultados de uma prática externa. O sistema calcula os erros.</DialogDescription></DialogHeader>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="questions-date" label="Data do estudo"><Input id="questions-date" type="date" value={studiedOn} max={today} onChange={(event) => setStudiedOn(event.target.value)} required /></Field>
            <Field id="questions-source-type" label="Tipo de origem"><select id="questions-source-type" value={sourceType} onChange={(event) => setSourceType(event.target.value as QuestionSourceType)} className={selectClass}>{questionSourceTypes.map((type) => <option key={type} value={type}>{sourceLabels[type]}</option>)}</select></Field>
            <Field id="questions-source" label="Origem das questões"><Input id="questions-source" value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} maxLength={120} placeholder="Ex.: QConcursos, prova FGV, PDF" required /></Field>
            <Field id="questions-exam" label="Concurso (opcional)"><select id="questions-exam" value={examTargetId} onChange={(event) => updateTarget(event.target.value)} className={selectClass}><option value="">Sem concurso</option>{examTargets.filter((target) => target.archivedAt === null || target.id === examTargetId).map((target) => <option key={target.id} value={target.id}>{target.name} · {target.institution}</option>)}</select></Field>
            <Field id="questions-subject" label="Matéria"><select id="questions-subject" value={subjectId} onChange={(event) => updateSubject(event.target.value)} className={selectClass} required><option value="">Selecione uma matéria</option>{subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject.archivedAt ? " · arquivada" : ""}</option>)}</select>{selectedTarget && subjectOptions.length === 0 ? <p className="text-xs text-muted-foreground">Vincule uma matéria a este concurso antes de registrar questões.</p> : null}</Field>
            <Field id="questions-topic" label="Tópico (opcional)"><select id="questions-topic" value={topicId} onChange={(event) => setTopicId(event.target.value)} className={selectClass} disabled={!subjectId}><option value="">Sem tópico específico</option>{availableTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}{topic.archivedAt ? " · arquivado" : ""}</option>)}</select></Field>
            <Field id="questions-session" label="Sessão de estudo (opcional)"><select id="questions-session" value={studySessionId} onChange={(event) => updateSession(event.target.value)} className={selectClass}><option value="">Sem sessão vinculada</option>{availableSessions.map((session) => <option key={session.id} value={session.id}>{session.subjectName} · {formatDate(session.studiedOn)} · {session.questionCount} questões</option>)}</select><p className="text-xs text-muted-foreground">Vincular não altera blocos nem revisões.</p></Field>
          </div>
          {initialSummaryAvailable && studySessionId ? <fieldset className="space-y-2 rounded-lg border bg-muted/20 p-3"><legend className="px-1 text-sm font-medium">Esta sessão já tem {selectedSession.questionCount} questões e {selectedSession.correctCount} acertos</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="radio" name="reconciliation" checked={replacesSessionTotals} onChange={() => setReplacesSessionTotals(true)} className="mt-0.5 accent-primary" /><span><span className="font-medium">Este lote representa esses totais</span><span className="block text-xs text-muted-foreground">Substitui o resumo nas métricas de questões, sem alterar a sessão, o planejamento ou as revisões.</span></span></label>
            <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="radio" name="reconciliation" checked={!replacesSessionTotals} onChange={() => setReplacesSessionTotals(false)} className="mt-0.5 accent-primary" /><span><span className="font-medium">Este lote é adicional</span><span className="block text-xs text-muted-foreground">Os números do estudo anterior e deste lote serão somados.</span></span></label>
          </fieldset> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="questions-count" label="Questões resolvidas"><Input id="questions-count" type="number" inputMode="numeric" min={1} max={100000} step={1} value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} required /></Field>
            <Field id="questions-correct" label="Acertos"><Input id="questions-correct" type="number" inputMode="numeric" min={0} max={100000} step={1} value={correctCount} onChange={(event) => setCorrectCount(event.target.value)} required /></Field>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-3 text-sm sm:col-span-2"><span className="text-muted-foreground">Erros calculados: <strong className="font-semibold text-foreground">{validCounts ? result.mistakeCount : "—"}</strong></span><span className="text-muted-foreground">Aproveitamento: <strong className="font-semibold text-primary">{validCounts && result.accuracy !== null ? formatPercent(result.accuracy) : "—"}</strong></span></div>
            <Field id="questions-duration" label="Tempo gasto em minutos (opcional)"><Input id="questions-duration" type="number" inputMode="numeric" min={1} max={1440} step={1} value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} placeholder="Ex.: 45" /></Field>
            <Field id="questions-notes" label="Observações (opcional)" className="sm:col-span-2"><Textarea id="questions-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} placeholder="Anotações rápidas sobre o desempenho" /></Field>
          </div>
          {selectedTarget ? <p className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground"><BookOpen aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />Matérias e tópicos disponíveis seguem os vínculos configurados em {selectedTarget.name}. O registro não altera seu planejamento.</p> : null}
          {fieldError ? <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{fieldError}</p> : null}
        </div>
        <DialogFooter className="px-5 pb-5 sm:px-6 sm:pb-6"><Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving || !subjectId || !validCounts}>{saving ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Salvando…</> : batch ? "Salvar alterações" : "Salvar registro"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: ReactNode }) {
  return <div className={`space-y-2 ${className ?? ""}`}><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function formatPercent(value: number): string { return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`; }
