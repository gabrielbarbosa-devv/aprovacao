"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, BookOpen, LoaderCircle, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { deleteMistakeEntryAction, saveMistakeEntryAction } from "@/features/mistakes/actions";
import { mistakeEntrySchema, mistakeReasons, mistakeStatuses, type MistakeEntryInput } from "@/features/mistakes/domain/schemas";
import { getMistakeStatusLabel, type MistakeBatchOption, type MistakeEntry, type MistakeReason, type MistakeStatus, type MistakeSubjectOption, type MistakeTopicOption } from "@/features/mistakes/domain/types";

const reasonOptions: Record<MistakeReason, string> = {
  conteudo: "Conteúdo",
  interpretacao: "Interpretação",
  desatencao: "Desatenção",
  tempo: "Tempo",
  confusao_regra: "Confusão de regra",
  outro: "Outro",
};

export function MistakeEntrySheet({ open, onOpenChange, entry, initialBatchId = null, subjects, topics, batches }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: MistakeEntry | null;
  initialBatchId?: string | null;
  subjects: MistakeSubjectOption[];
  topics: MistakeTopicOption[];
  batches: MistakeBatchOption[];
}) {
  const router = useRouter();
  const startingBatch = batches.find((batch) => batch.id === (entry?.questionBatchId ?? initialBatchId)) ?? null;
  const [subjectId, setSubjectId] = useState(entry?.subjectId ?? startingBatch?.subjectId ?? "");
  const [topicId, setTopicId] = useState(entry?.topicId ?? startingBatch?.topicId ?? "");
  const [questionBatchId, setQuestionBatchId] = useState(entry?.questionBatchId ?? initialBatchId ?? "");
  const [reason, setReason] = useState<MistakeReason>(entry?.reason ?? "conteudo");
  const [thought, setThought] = useState(entry?.thought ?? "");
  const [correctRule, setCorrectRule] = useState(entry?.correctRule ?? "");
  const [nextStep, setNextStep] = useState(entry?.nextStep ?? "");
  const [externalReference, setExternalReference] = useState(entry?.externalReference ?? "");
  const [status, setStatus] = useState<MistakeStatus>(entry?.status ?? "needs_review");
  const [operationKey, setOperationKey] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const subjectOptions = subjects.filter((subject) => subject.archivedAt === null || subject.id === subjectId);
  const topicOptions = useMemo(() => topics.filter((topic) => topic.subjectId === subjectId && (topic.archivedAt === null || topic.id === topicId)), [topics, subjectId, topicId]);
  const selectedBatch = batches.find((batch) => batch.id === questionBatchId) ?? null;
  const batchOptions = batches.filter((batch) => batch.subjectId === subjectId && (batch.deletedAt === null || batch.id === questionBatchId));

  function changeSubject(value: string) {
    setSubjectId(value);
    if (!topics.some((topic) => topic.id === topicId && topic.subjectId === value)) setTopicId("");
    if (selectedBatch && selectedBatch.subjectId !== value) setQuestionBatchId("");
  }

  function changeBatch(value: string) {
    setQuestionBatchId(value);
    const batch = batches.find((option) => option.id === value);
    if (!batch) return;
    setSubjectId(batch.subjectId);
    setTopicId(batch.topicId ?? "");
  }

  function changeTopic(value: string) {
    setTopicId(value);
    if (selectedBatch?.topicId && value && selectedBatch.topicId !== value) setQuestionBatchId("");
  }

  async function save(nextStatus: MistakeStatus = status) {
    const nextOperationKey = operationKey || crypto.randomUUID();
    setOperationKey(nextOperationKey);
    const input: MistakeEntryInput = {
      id: entry?.id ?? null,
      operationKey: nextOperationKey,
      subjectId,
      topicId: topicId || null,
      questionBatchId: questionBatchId || null,
      reason,
      thought,
      correctRule,
      nextStep,
      externalReference,
      status: nextStatus,
    };
    const parsed = mistakeEntrySchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Confira os dados da ficha.";
      setFieldError(message);
      return;
    }

    setPending(true);
    setFieldError("");
    try {
      const result = await saveMistakeEntryAction(parsed.data);
      if (!result.ok) {
        setFieldError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(result.status === "exists" ? "Esta ficha já estava salva." : entry ? "Ficha atualizada." : "Dificuldade anotada.");
      onOpenChange(false);
      router.refresh();
    } catch {
      const message = "Falha de conexão ao salvar. Seus dados continuam no formulário; tente novamente.";
      setFieldError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  async function confirmDelete() {
    if (!entry) return;
    setDeleting(true);
    try {
      const result = await deleteMistakeEntryAction({ id: entry.id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Ficha excluída. Seus estudos e registros de questões continuam intactos.");
      setDeleteOpen(false);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível excluir esta ficha.");
    } finally {
      setDeleting(false);
    }
  }

  const batchCaption = selectedBatch
    ? `${selectedBatch.subjectName}${selectedBatch.topicTitle ? ` · ${selectedBatch.topicTitle}` : ""} · ${selectedBatch.sourceLabel}${selectedBatch.deletedAt ? " · lote arquivado" : ""}`
    : null;

  return <>
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!pending && !deleting) onOpenChange(nextOpen); }}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-[600px]">
        <SheetHeader className="border-b px-5 py-5 sm:px-7">
          <SheetTitle className="text-lg">{entry ? "Detalhe da dificuldade" : "Adicionar dificuldade"}</SheetTitle>
          <SheetDescription>Registre o raciocínio e a regra que vale lembrar. Não guarde o enunciado da questão.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
            {batchCaption ? <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><BookOpen aria-hidden="true" className="size-4" /></span>
              <div className="min-w-0"><p className="text-xs font-semibold">Lote de questões vinculado</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{batchCaption}</p></div>
            </div> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="mistake-subject" label="Matéria">
                <select id="mistake-subject" value={subjectId} onChange={(event) => changeSubject(event.target.value)} required className={selectClass}>
                  <option value="">Selecione uma matéria</option>
                  {subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject.archivedAt ? " · arquivada" : ""}</option>)}
                </select>
              </Field>
              <Field id="mistake-topic" label="Tópico (opcional)">
                <select id="mistake-topic" value={topicId} onChange={(event) => changeTopic(event.target.value)} disabled={!subjectId} className={selectClass}>
                  <option value="">Sem tópico específico</option>
                  {topicOptions.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}{topic.archivedAt ? " · arquivado" : ""}</option>)}
                </select>
              </Field>
            </div>

            <Field id="mistake-batch" label="Lote de questões (opcional)">
              <select id="mistake-batch" value={questionBatchId} onChange={(event) => changeBatch(event.target.value)} disabled={!subjectId} className={selectClass}>
                <option value="">Sem lote vinculado</option>
                {batchOptions.map((batch) => <option key={batch.id} value={batch.id}>{batch.sourceLabel} · {formatDate(batch.studiedOn)}{batch.topicTitle ? ` · ${batch.topicTitle}` : ""}{batch.deletedAt ? " · arquivado" : ""}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">O vínculo é só de contexto; esta ficha não altera acertos nem erros calculados.</p>
            </Field>

            <Field id="mistake-reason" label="Motivo do erro">
              <select id="mistake-reason" value={reason} onChange={(event) => setReason(event.target.value as MistakeReason)} className={selectClass}>
                {mistakeReasons.map((option) => <option key={option} value={option}>{reasonOptions[option]}</option>)}
              </select>
            </Field>

            <Field id="mistake-thought" label="O que eu pensei na hora?">
              <Textarea id="mistake-thought" value={thought} onChange={(event) => setThought(event.target.value)} maxLength={3000} rows={3} required placeholder="Descreva o raciocínio que levou à dúvida ou ao erro." />
            </Field>
            <Field id="mistake-rule" label="O que preciso lembrar na próxima tentativa?">
              <Textarea id="mistake-rule" value={correctRule} onChange={(event) => setCorrectRule(event.target.value)} maxLength={3000} rows={3} required placeholder="Registre a regra correta ou a ideia principal." />
            </Field>
            <Field id="mistake-next-step" label="Próximo passo (opcional)">
              <Textarea id="mistake-next-step" value={nextStep} onChange={(event) => setNextStep(event.target.value)} maxLength={1000} rows={2} placeholder="Ex.: reler o tópico sobre inferência." />
            </Field>
            <Field id="mistake-reference" label="Referência externa (opcional)">
              <Input id="mistake-reference" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} maxLength={500} placeholder="Link HTTPS ou identificador externo" aria-describedby="mistake-reference-help" />
              <p id="mistake-reference-help" className="text-xs text-muted-foreground">Use um endereço HTTPS ou o identificador da questão. O enunciado não é armazenado.</p>
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Situação</legend>
              <div role="group" aria-label="Situação da dificuldade" className="grid grid-cols-3 rounded-lg border p-1">
                {mistakeStatuses.map((option) => <button key={option} type="button" aria-pressed={status === option} onClick={() => setStatus(option)} className={`min-h-9 rounded-md px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${status === option ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>{getMistakeStatusLabel(option)}</button>)}
              </div>
            </fieldset>
            {fieldError ? <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{fieldError}</p> : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            {entry ? <Button type="button" variant="ghost" className="justify-start text-destructive hover:text-destructive sm:mr-auto" onClick={() => setDeleteOpen(true)} disabled={pending || deleting}><Trash2 aria-hidden="true" className="size-4" />Excluir ficha</Button> : <span className="hidden text-xs text-muted-foreground sm:block">Somente você verá esta anotação.</span>}
            <div className="flex flex-wrap justify-end gap-2">
              {entry && status !== "understood" ? <Button type="button" variant="outline" onClick={() => void save("understood")} disabled={pending || deleting}>Marcar compreendido</Button> : null}
              {entry && status !== "needs_review" ? <Button type="button" variant="outline" onClick={() => void save("needs_review")} disabled={pending || deleting}>Voltar a revisar</Button> : null}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending || deleting}>Cancelar</Button>
              <Button type="submit" disabled={pending || deleting || !subjectId || !thought.trim() || !correctRule.trim()}>{pending ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Salvando…</> : entry ? "Salvar alterações" : "Salvar ficha"}</Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
    <AlertDialog open={deleteOpen} onOpenChange={(nextOpen) => { if (!deleting) setDeleteOpen(nextOpen); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Excluir esta ficha?</AlertDialogTitle><AlertDialogDescription>A anotação será arquivada e sairá do caderno. O lote de questões, o histórico de estudos, o planejamento e as revisões não serão alterados.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); void confirmDelete(); }}>{deleting ? "Excluindo…" : "Excluir ficha"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)).replace(" de ", " ");
}
