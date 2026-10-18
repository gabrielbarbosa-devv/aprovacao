"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Clock3, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteStudySessionAction } from "@/features/study-sessions/actions";
import { getAccuracy, getMistakeCount } from "@/features/study-sessions/domain/schemas";
import type { StudySessionRecord, StudyTopicOption } from "@/features/study-sessions/domain/types";
import { StudySessionDialog } from "@/features/study-sessions/components/study-session-dialog";
import { formatStudyDate } from "@/lib/date/study-day";

export function StudySessionHistory({ sessions, topics, today }: { sessions: StudySessionRecord[]; topics: StudyTopicOption[]; today: string }) {
  const [deleteTarget, setDeleteTarget] = useState<StudySessionRecord | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function deleteSession() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteStudySessionAction({ sessionId: deleteTarget.id });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Registro excluído. As revisões pendentes foram canceladas.");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  if (sessions.length === 0) return null;
  return <>
    <Card className="mt-6 py-0 shadow-sm">
      <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6"><CardTitle>Registros recentes</CardTitle><CardDescription>Seus estudos registrados nesta conta.</CardDescription></CardHeader>
      <CardContent className="space-y-2 px-5 pb-5 sm:px-6 sm:pb-6">
        {sessions.map((session) => {
          const accuracy = getAccuracy(session.questionCount, session.correctCount);
          const mistakes = getMistakeCount(session.questionCount, session.correctCount);
          const topicOption = topics.find((topic) => topic.id === session.topicId);
          return <article key={session.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" />{formatStudyDate(session.studiedOn, "short")}</span><span className="inline-flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3.5" />{session.durationMinutes} min</span></div>
              <p className="mt-1 truncate text-sm font-semibold">{session.subject} <span className="font-normal text-muted-foreground">· {session.topic}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">{session.questionCount === 0 ? "Sem questões registradas" : `${session.correctCount}/${session.questionCount} acertos · ${mistakes} ${mistakes === 1 ? "erro" : "erros"}${accuracy === null ? "" : ` · ${accuracy}%`}`}</p>
              {session.reviewDates.length ? <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Próximas revisões">{session.reviewDates.map((date, index) => <Badge key={`${session.id}-${date}`} variant="outline" className="text-[10px]">D+{[1, 7, 30][index] ?? ""} · {formatStudyDate(date, "short")}</Badge>)}</div> : null}
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <StudySessionDialog topics={topicOption ? [topicOption] : topics} today={today} session={session} />
              <Button type="button" variant="outline" size="icon" aria-label={`Excluir registro de ${session.subject}`} onClick={() => setDeleteTarget(session)}><Trash2 aria-hidden="true" className="size-4 text-destructive" /></Button>
            </div>
          </article>;
        })}
      </CardContent>
    </Card>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !pending) setDeleteTarget(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Excluir este registro?</AlertDialogTitle><AlertDialogDescription>O registro será arquivado e deixará de aparecer no histórico. As revisões pendentes deste estudo serão canceladas; revisões já concluídas e o histórico de auditoria serão preservados. Se houver um bloco vinculado sem outro registro ativo, ele voltará ao planejamento.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); deleteSession(); }}>{pending ? "Excluindo…" : "Excluir registro"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
