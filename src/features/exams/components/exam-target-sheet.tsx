"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, BookOpen, ExternalLink, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { setExamTargetArchivedAction } from "@/features/exams/actions";
import { getTopicCoverage } from "@/features/exams/domain/types";
import type { ExamTarget, ExamSubject, ExamTopic } from "@/features/exams/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ExamTargetForm } from "@/features/exams/components/exam-target-form";

const stageLabels: Record<string, string> = { em_preparacao: "Em preparação", edital_publicado: "Edital publicado", inscricao_aberta: "Inscrição aberta", prova_realizada: "Prova realizada" };
const priorityLabels: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

export function ExamTargetSheet({ target, open, onOpenChange, subjects, topics, archived = false }: {
  target: ExamTarget; open: boolean; onOpenChange: (open: boolean) => void; subjects: ExamSubject[]; topics: ExamTopic[]; archived?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const coverage = getTopicCoverage(target.topics);

  async function updateArchive(shouldArchive: boolean) {
    setBusy(true);
    try {
      const result = await setExamTargetArchivedAction({ id: target.id, archived: shouldArchive });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(shouldArchive ? "Concurso arquivado." : "Concurso restaurado.");
      setConfirmArchive(false);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível atualizar o concurso.");
    } finally { setBusy(false); }
  }

  function saved() { setEditing(false); onOpenChange(false); router.refresh(); }

  return <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        {editing ? <>
          <SheetHeader className="border-b px-5 py-5 sm:px-6"><SheetTitle>Editar concurso</SheetTitle><SheetDescription>Atualize os dados e os vínculos deste objetivo.</SheetDescription></SheetHeader>
          <ExamTargetForm key={target.id} target={target} subjects={subjects} topics={topics} onSaved={saved} onCancel={() => setEditing(false)} />
        </> : <>
          <SheetHeader className="border-b px-5 py-5 pr-14 sm:px-6 sm:pr-14">
            <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{archived ? "Arquivado" : stageLabels[target.currentStage]}</Badge><Badge variant="outline">Prioridade {priorityLabels[target.priority]}</Badge></div>
            <SheetTitle className="pt-1 text-xl">{target.examName}</SheetTitle>
            <SheetDescription>{target.institution} · {target.roleTitle} · {target.jurisdiction}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            <section aria-labelledby="exam-detail-data"><h3 id="exam-detail-data" className="text-sm font-semibold">Dados</h3><dl className="mt-3 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <Detail label="Etapa" value={stageLabels[target.currentStage]} /><Detail label="Prioridade pessoal" value={priorityLabels[target.priority]} />
              <Detail label="Data da prova" value={formatDate(target.examDate)} /><Detail label="Prazo de inscrição" value={formatDate(target.applicationDeadline)} />
              {target.officialUrl ? <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Fonte informada por você</dt><dd className="mt-1"><a href={target.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 break-all text-sm text-primary underline-offset-4 hover:underline"><span className="truncate">{target.officialUrl}</span><ExternalLink aria-hidden="true" className="size-3.5 shrink-0" /></a></dd></div> : null}
              {target.notes ? <Detail label="Observações" value={target.notes} /> : null}
            </dl></section>
            <Separator />
            <section aria-labelledby="exam-detail-subjects"><div className="flex items-center justify-between gap-3"><div><h3 id="exam-detail-subjects" className="text-sm font-semibold">Matérias vinculadas</h3><p className="mt-1 text-xs text-muted-foreground">{target.subjects.length} {target.subjects.length === 1 ? "matéria" : "matérias"} associadas</p></div><Badge variant="secondary">{coverage.configured ? `${coverage.mastered}/${coverage.total} dominados` : "Cobertura não configurada"}</Badge></div>
              {target.subjects.length > 0 ? <div className="mt-4 space-y-3">{target.subjects.map((subject) => {
                const subjectTopics = target.topics.filter((topic) => topic.subjectId === subject.id);
                return <div key={subject.id} className="rounded-xl border p-3"><div className="flex items-center gap-2 text-sm font-medium"><BookOpen aria-hidden="true" className="size-4 text-primary" />{subject.name}{subject.archivedAt ? <Badge variant="outline">Arquivada</Badge> : null}</div>
                  {subjectTopics.length ? <ul className="mt-2 space-y-2 pl-6 text-sm text-muted-foreground">{subjectTopics.map((topic) => <li key={topic.id} className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3"><span className="min-w-0 break-words leading-5 [overflow-wrap:anywhere]">{topic.title}</span><span className="text-xs text-muted-foreground sm:whitespace-nowrap">{topic.status === "dominado" ? "Dominado" : topic.status === "em_andamento" ? "Em andamento" : topic.status === "concluido" ? "Concluído" : topic.status === "revisando" ? "Revisando" : "Não iniciado"}</span></li>)}</ul> : <p className="mt-2 pl-6 text-xs text-muted-foreground">Nenhum tópico vinculado.</p>}
                </div>;
              })}</div> : <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma matéria vinculada.</p>}
              {coverage.configured ? <p className="mt-3 text-xs text-muted-foreground">Cobertura baseada apenas nos tópicos vinculados marcados como dominados por você.</p> : <p className="mt-3 text-xs text-muted-foreground">Cobertura ainda não configurada: vincule tópicos do seu conteúdo para acompanhar o domínio.</p>}
            </section>
          </div>
          <div className="shrink-0 flex flex-wrap justify-between gap-2 border-t bg-muted/20 px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setConfirmArchive(true)} disabled={busy} className="gap-2">{archived ? <RotateCcw aria-hidden="true" className="size-4" /> : <Archive aria-hidden="true" className="size-4" />}{archived ? "Restaurar" : "Arquivar"}</Button>
            {!archived ? <Button onClick={() => setEditing(true)} className="gap-2"><Pencil aria-hidden="true" className="size-4" />Editar</Button> : null}
          </div>
        </>}
      </SheetContent>
    </Sheet>
    <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{archived ? "Restaurar concurso?" : "Arquivar concurso?"}</AlertDialogTitle><AlertDialogDescription>{archived ? "Ele voltará para a lista de concursos ativos." : "Ele sairá da lista ativa, mas poderá ser restaurado depois. Seus vínculos e registros de estudo serão mantidos."}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void updateArchive(!archived)}>{busy ? "Salvando…" : archived ? "Restaurar concurso" : "Arquivar concurso"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium leading-relaxed [overflow-wrap:anywhere]">{value}</dd></div>; }
function formatDate(value: string | null): string { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Não informada"; }
