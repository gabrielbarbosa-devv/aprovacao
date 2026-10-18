"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, CalendarClock, ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { completeReviewAction, snoozeReviewAction } from "@/features/reviews/actions";
import type { EnrichedReviewTask } from "@/features/reviews/data/reviews-repository";
import { formatStudyDate, addStudyDays } from "@/lib/date/study-day";

type Props = { task: EnrichedReviewTask; today: string; completed?: boolean };

export function ReviewTaskDialog({ task, today, completed = false }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"review" | "snooze">("review");
  const [reviewedOn, setReviewedOn] = useState(today);
  const [difficulty, setDifficulty] = useState<1 | 3 | 5>(3);
  const [scheduleReinforcement, setScheduleReinforcement] = useState(false);
  const [questionCount, setQuestionCount] = useState("");
  const [correctCount, setCorrectCount] = useState("");
  const [notes, setNotes] = useState("");
  const [newDueOn, setNewDueOn] = useState(addStudyDays(today, 1));
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function start() {
    setMode("review");
    setReviewedOn(today);
    setDifficulty(3);
    setScheduleReinforcement(false);
    setQuestionCount("");
    setCorrectCount("");
    setNotes("");
    setNewDueOn(addStudyDays(today, 1));
    setReason("");
    setErrorMessage("");
    setOpen(true);
  }

  function complete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((questionCount === "") !== (correctCount === "")) {
      setErrorMessage("Informe questões e acertos juntos ou deixe os dois campos vazios.");
      return;
    }
    const questions = questionCount === "" ? null : Number(questionCount);
    const correct = correctCount === "" ? null : Number(correctCount);
    if (questions !== null && (!Number.isInteger(questions) || !Number.isInteger(correct) || questions < 0 || (correct ?? 0) < 0 || (correct ?? 0) > questions)) {
      setErrorMessage("Confira a quantidade de questões e acertos.");
      return;
    }
    setErrorMessage("");
    startTransition(async () => {
      const result = await completeReviewAction({ reviewId: task.id, reviewedOn, difficulty, scheduleReinforcement, questionCount: questions, correctCount: correct, notes });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(result.status === "already_completed" ? "Esta revisão já estava concluída." : "Revisão registrada.", {
        description: result.reinforcementCreated ? "Um reforço foi agendado para daqui a dois dias." : undefined,
      });
      setOpen(false);
      router.refresh();
    });
  }

  function snooze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    startTransition(async () => {
      const result = await snoozeReviewAction({ reviewId: task.id, newDueOn, reason });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(result.status === "already_scheduled" ? "Esta revisão já estava nessa data." : "Revisão reagendada.");
      setOpen(false);
      router.refresh();
    });
  }

  return <>
    <Button type="button" variant={completed ? "outline" : "default"} size="sm" onClick={start}>
      {completed ? "Ver resultado" : "Registrar revisão"}
    </Button>
    <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
        {mode === "review" ? (
          <form onSubmit={complete} noValidate className="space-y-5">
            <DialogHeader>
              <DialogTitle>{completed ? "Resultado da revisão" : "Registrar revisão"}</DialogTitle>
              <DialogDescription>Revise o conteúdo fora do app e registre como foi.</DialogDescription>
            </DialogHeader>
            <TopicReviewContext task={task} />
            {completed && task.outcome ? (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <p className="text-sm"><span className="font-medium">Data:</span> {formatStudyDate(task.outcome.reviewedOn, "long")}</p>
                <p className="text-sm"><span className="font-medium">Dificuldade:</span> {difficultyLabel(task.outcome.difficulty)}</p>
                {task.outcome.questionCount !== null && task.outcome.correctCount !== null ? <p className="text-sm"><span className="font-medium">Questões e acertos:</span> {task.outcome.questionCount} questões, {task.outcome.correctCount} acertos</p> : null}
                {task.outcome.notes ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.outcome.notes}</p> : null}
              </div>
            ) : null}
            {!completed ? <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor={`review-date-${task.id}`}>Data da revisão</Label><Input id={`review-date-${task.id}`} type="date" value={reviewedOn} max={today} onChange={(event) => setReviewedOn(event.target.value)} required /></div>
                <fieldset className="space-y-2"><legend className="text-sm font-medium">Dificuldade percebida</legend>
                  <div className="flex gap-2">{([{ value: 1, label: "Fácil" }, { value: 3, label: "Média" }, { value: 5, label: "Difícil" }] as const).map((option) => <Button key={option.value} type="button" size="sm" variant={difficulty === option.value ? "default" : "outline"} aria-pressed={difficulty === option.value} onClick={() => setDifficulty(option.value)}>{option.label}</Button>)}</div>
                </fieldset>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor={`review-questions-${task.id}`}>Questões feitas <span className="text-muted-foreground">(opcional)</span></Label><Input id={`review-questions-${task.id}`} type="number" inputMode="numeric" min={0} step={1} value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor={`review-correct-${task.id}`}>Acertos <span className="text-muted-foreground">(opcional)</span></Label><Input id={`review-correct-${task.id}`} type="number" inputMode="numeric" min={0} max={questionCount || undefined} step={1} value={correctCount} onChange={(event) => setCorrectCount(event.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label htmlFor={`review-notes-${task.id}`}>Observação <span className="text-muted-foreground">(opcional)</span></Label><Textarea id={`review-notes-${task.id}`} maxLength={2000} rows={3} placeholder="O que você percebeu ao revisar?" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
              {difficulty === 5 ? <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm"><input type="checkbox" checked={scheduleReinforcement} onChange={(event) => setScheduleReinforcement(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><span className="block font-medium">Agendar um reforço em dois dias</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Opcional. No máximo um reforço será criado para esta revisão.</span></span></label> : null}
              {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}
            </> : null}
            <DialogFooter className="-mx-4 -mb-4 flex-col-reverse sm:flex-row">
              {!completed ? <Button type="button" variant="outline" disabled={pending} onClick={() => { setErrorMessage(""); setMode("snooze"); }} className="sm:mr-auto"><CalendarClock aria-hidden="true" /> Adiar</Button> : null}
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Fechar</Button>
              {!completed ? <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />} Salvar revisão</Button> : null}
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={snooze} noValidate className="space-y-5">
            <DialogHeader><DialogTitle>Adiar revisão</DialogTitle><DialogDescription>Apenas a data desta tarefa muda. O registro do estudo e o histórico permanecem.</DialogDescription></DialogHeader>
            <div className="space-y-2"><Label htmlFor={`snooze-date-${task.id}`}>Nova data</Label><Input id={`snooze-date-${task.id}`} type="date" min={addStudyDays(today, 1)} value={newDueOn} onChange={(event) => setNewDueOn(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor={`snooze-reason-${task.id}`}>Motivo <span className="text-muted-foreground">(opcional)</span></Label><Textarea id={`snooze-reason-${task.id}`} maxLength={500} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
            {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}
            <DialogFooter className="-mx-4 -mb-4 flex-col-reverse sm:flex-row">
              <Button type="button" variant="outline" disabled={pending} onClick={() => { setErrorMessage(""); setMode("review"); }}><ArrowLeft aria-hidden="true" /> Voltar</Button>
              <Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null} Confirmar adiamento</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  </>;
}

function TopicReviewContext({ task }: { task: EnrichedReviewTask }) {
  return <section aria-label="Conteúdo do estudo relacionado" className="space-y-3 rounded-xl border border-primary/10 bg-primary/5 p-4">
    <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><BookOpen aria-hidden="true" className="size-5" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{task.subject}</p><p className="truncate text-sm text-muted-foreground">{task.topic}</p></div></div>
    <div className="grid gap-2 border-t border-primary/10 pt-3 text-xs text-muted-foreground sm:grid-cols-2">
      <p>Estudado em {formatStudyDate(task.studiedOn, "short")} · {task.studyDurationMinutes} min</p>
      <p>Etapa {task.kind === "reinforcement" ? "Reforço · D+2" : `D+${task.intervalDays}`}</p>
      {task.studyQuestionCount > 0 ? <p>Registro original: {task.studyCorrectCount}/{task.studyQuestionCount} acertos</p> : null}
    </div>
    {task.topicNotes ? <div className="border-t border-primary/10 pt-3"><p className="mb-1 text-xs font-semibold">Anotações do tópico</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{task.topicNotes}</p></div> : <p className="border-t border-primary/10 pt-3 text-xs text-muted-foreground">Este tópico não tem anotações registradas. Consulte seu material habitual para revisá-lo.</p>}
    {task.studyNotes ? <div className="border-t border-primary/10 pt-3"><p className="mb-1 text-xs font-semibold">Anotação do estudo original</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{task.studyNotes}</p></div> : null}
    {task.sourceUrl ? <a href={task.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border-t border-primary/10 pt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"><ExternalLink aria-hidden="true" className="size-4" /> Abrir material registrado</a> : null}
  </section>;
}

function difficultyLabel(difficulty: number | null) {
  if (difficulty === null) return "Não informada";
  if (difficulty <= 2) return "Fácil";
  if (difficulty <= 4) return "Média";
  return "Difícil";
}
