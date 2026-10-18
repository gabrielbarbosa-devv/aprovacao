"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAccuracy, getMistakeCount, studySessionSchema } from "@/features/study-sessions/domain/schemas";
import type { StudySessionRecord, StudyTopicOption } from "@/features/study-sessions/domain/types";
import { saveStudySessionAction } from "@/features/study-sessions/actions";
import { formatStudyDate } from "@/lib/date/study-day";

type BlockContext = { id: string; topicId: string; subject: string; topic: string; durationMinutes: number };
type Props = {
  topics: StudyTopicOption[];
  today: string;
  selectedBlock?: BlockContext | null;
  session?: StudySessionRecord | null;
  trigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function StudySessionDialog({ topics, today, selectedBlock = null, session = null, trigger = true, open: controlledOpen, onOpenChange }: Props) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const [topicId, setTopicId] = useState(session?.topicId ?? selectedBlock?.topicId ?? topics[0]?.id ?? "");
  const [studiedOn, setStudiedOn] = useState(session?.studiedOn ?? today);
  const [duration, setDuration] = useState(String(session?.durationMinutes ?? selectedBlock?.durationMinutes ?? 60));
  const [questions, setQuestions] = useState(String(session?.questionCount ?? 0));
  const [correct, setCorrect] = useState(String(session?.correctCount ?? 0));
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [operationKey, setOperationKey] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const selectedTopic = topics.find((topic) => topic.id === topicId);
  const parsedDuration = Number(duration);
  const parsedQuestions = Number(questions);
  const parsedCorrect = Number(correct);
  const accuracy = getAccuracy(parsedQuestions, parsedCorrect);
  const mistakes = getMistakeCount(parsedQuestions, parsedCorrect);
  const durationMessage = duration !== "" && (!Number.isInteger(parsedDuration) || parsedDuration <= 0) ? "Informe um tempo inteiro maior que zero." : "";
  const questionMessage = questions !== "" && (!Number.isInteger(parsedQuestions) || parsedQuestions < 0) ? "Use zero ou um número inteiro positivo." : "";
  const correctMessage = correct !== "" && (!Number.isInteger(parsedCorrect) || parsedCorrect < 0 || parsedCorrect > parsedQuestions) ? parsedCorrect > parsedQuestions ? "Os acertos não podem ser maiores que as questões resolvidas." : "Use zero ou um número inteiro positivo." : "";
  const dateError = useMemo(() => studiedOn && !/^\d{4}-\d{2}-\d{2}$/.test(studiedOn), [studiedOn]);

  function changeOpen(next: boolean) {
    if (pending) return;
    if (next && !open) {
      setTopicId(session?.topicId ?? selectedBlock?.topicId ?? topics[0]?.id ?? "");
      setStudiedOn(session?.studiedOn ?? today);
      setDuration(String(session?.durationMinutes ?? selectedBlock?.durationMinutes ?? 60));
      setQuestions(String(session?.questionCount ?? 0));
      setCorrect(String(session?.correctCount ?? 0));
      setNotes(session?.notes ?? "");
      setOperationKey(session ? "" : crypto.randomUUID());
      setFieldError("");
    }
    if (controlledOpen === undefined) setLocalOpen(next);
    onOpenChange?.(next);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = studySessionSchema.safeParse({
      sessionId: session?.id ?? null,
      operationKey: operationKey || crypto.randomUUID(),
      blockId: session?.blockId ?? selectedBlock?.id ?? null,
      topicId,
      studiedOn,
      durationMinutes: parsedDuration,
      questionCount: parsedQuestions,
      correctCount: parsedCorrect,
      notes,
    });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? "Confira os dados informados.");
      return;
    }
    if (!operationKey && !session) setOperationKey(result.data.operationKey);
    setFieldError("");
    startTransition(async () => {
      const saved = await saveStudySessionAction(result.data);
      if (!saved.ok) {
        toast.error(saved.message);
        return;
      }
      const dueDates = saved.reviewDates.map((date) => formatStudyDate(date, "short")).join(", ");
      toast.success(saved.status === "exists" ? "Este bloco já possui um registro ativo." : session ? "Registro atualizado." : "Estudo registrado.", {
        description: dueDates ? `Próximas revisões: ${dueDates}.` : undefined,
      });
      changeOpen(false);
      router.refresh();
    });
  }

  return <>
    {trigger ? <Button type="button" variant={selectedBlock ? "outline" : "default"} className="gap-2" onClick={() => changeOpen(true)}>
      {selectedBlock ? <BookOpen aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
      {session ? "Editar registro" : selectedBlock ? "Registrar resultado" : "Registrar estudo avulso"}
    </Button> : null}
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[540px]">
        <form onSubmit={submit} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>{session ? "Editar registro" : "Registrar estudo"}</DialogTitle>
            <DialogDescription>Registre apenas o que você fez, sem cadastrar questões.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-xl border border-primary/10 bg-primary/5 p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><BookOpen aria-hidden="true" className="size-5" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{selectedTopic?.subject ?? session?.subject ?? "Matéria indisponível"}</p><p className="truncate text-sm text-muted-foreground">{selectedTopic?.topic ?? session?.topic ?? "Tópico"}</p></div>
          </div>
          {!selectedBlock && !session ? <div className="space-y-2"><Label htmlFor="session-topic">Matéria e tópico</Label>
            <select id="session-topic" value={topicId} onChange={(event) => setTopicId(event.target.value)} required className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {topics.length ? topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.subject} · {topic.topic}</option>) : <option value="">Nenhum tópico ativo disponível</option>}
            </select>
          </div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="session-date">Data do estudo</Label><Input id="session-date" type="date" value={studiedOn} max={today} onChange={(event) => setStudiedOn(event.target.value)} required aria-invalid={Boolean(dateError)} /></div>
            <div className="space-y-2"><Label htmlFor="session-duration">Tempo estudado (minutos)</Label><Input id="session-duration" type="number" inputMode="numeric" min={1} max={1440} step={1} value={duration} onChange={(event) => setDuration(event.target.value)} required aria-invalid={Boolean(durationMessage)} />{durationMessage ? <p className="text-xs text-destructive">{durationMessage}</p> : null}</div>
            <div className="space-y-2"><Label htmlFor="session-questions">Questões resolvidas</Label><Input id="session-questions" type="number" inputMode="numeric" min={0} max={10000} value={questions} onChange={(event) => setQuestions(event.target.value)} required aria-invalid={Boolean(questionMessage)} />{questionMessage ? <p className="text-xs text-destructive">{questionMessage}</p> : null}</div>
            <div className="space-y-2"><Label htmlFor="session-correct">Acertos</Label><Input id="session-correct" type="number" inputMode="numeric" min={0} max={10000} value={correct} onChange={(event) => setCorrect(event.target.value)} required aria-invalid={Boolean(correctMessage)} />{correctMessage ? <p className="text-xs text-destructive">{correctMessage}</p> : null}</div>
          </div>
          <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Aproveitamento</span>
            {accuracy === null ? <span className="font-medium">Sem questões registradas</span> : <span className="font-semibold text-primary">{accuracy}% <span className="font-normal text-muted-foreground">· {mistakes} {mistakes === 1 ? "erro" : "erros"}</span></span>}
          </div>
          <div className="space-y-2"><Label htmlFor="session-notes">Observação (opcional)</Label><Textarea id="session-notes" value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: Preciso reforçar inferência textual…" rows={2} /></div>
          {fieldError ? <p role="alert" className="text-sm text-destructive">{fieldError}</p> : null}
          <DialogFooter className="border-t pt-4 sm:justify-between">
            <p className="self-center text-xs text-muted-foreground">3 revisões serão agendadas ao salvar.</p>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>Cancelar</Button><Button type="submit" disabled={pending || topics.length === 0}>{pending ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Salvando…</> : session ? "Salvar alterações" : "Salvar registro"}</Button></div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
