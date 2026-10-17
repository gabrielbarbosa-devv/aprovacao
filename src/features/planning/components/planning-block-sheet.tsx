"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Clock3, Pin } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { updateStudyBlockAction } from "@/features/planning/actions";
import { formatStudyDate } from "@/lib/date/study-day";
import type { PlanningBlock, PlanningTopicOption } from "@/features/planning/domain/types";

export function PlanningBlockSheet({ block, topics, onClose }: { block: PlanningBlock | null; topics: PlanningTopicOption[]; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const activeBlock = block;
  if (!activeBlock) return null;

  function update(selected: PlanningBlock, status: PlanningBlock["status"] = selected.status, formData?: FormData) {
    const payload = {
      id: selected.id,
      topicId: formData?.get("topicId") || selected.topicId,
      plannedDate: formData?.get("plannedDate") || selected.plannedDate,
      plannedMinutes: formData?.get("plannedMinutes") || selected.plannedMinutes,
      plannedStartTime: formData ? (formData.get("plannedStartTime")?.toString() || null) : selected.plannedStartTime,
      status,
    };
    startTransition(async () => {
      const result = await updateStudyBlockAction(payload);
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(status === "ignorado" ? "Bloco marcado como ignorado." : status === "planejado" && selected.status === "ignorado" ? "Bloco restaurado." : "Bloco atualizado.");
      onClose();
      router.refresh();
    });
  }

  return (
    <>
      <Sheet open={Boolean(block)} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="px-0">
            <SheetTitle>{editing ? "Editar bloco" : activeBlock.subject}</SheetTitle>
            <SheetDescription>{editing ? "Ajuste a data ou a duração planejada." : activeBlock.topic}</SheetDescription>
          </SheetHeader>
          {editing ? (
            <form action={(formData) => update(activeBlock, activeBlock.status, formData)} className="space-y-4 px-4 pb-4">
              <div className="space-y-2"><Label htmlFor="edit-topic">Tópico</Label>
                <select id="edit-topic" name="topicId" defaultValue={activeBlock.topicId} required className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.subject} · {topic.topic}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label htmlFor="edit-date">Data</Label><Input id="edit-date" name="plannedDate" type="date" required defaultValue={activeBlock.plannedDate} /></div>
              <div className="space-y-2"><Label htmlFor="edit-duration">Duração (min)</Label><Input id="edit-duration" name="plannedMinutes" type="number" min={15} max={480} step={15} required defaultValue={activeBlock.plannedMinutes} /></div>
              <div className="space-y-2"><Label htmlFor="edit-time">Horário (opcional)</Label><Input id="edit-time" name="plannedStartTime" type="time" defaultValue={activeBlock.plannedStartTime ?? ""} /></div>
              <div className="flex gap-2"><Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar alterações"}</Button><Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button></div>
            </form>
          ) : (
            <div className="space-y-5 px-4 pb-4">
              <div className="flex flex-wrap gap-2"><Badge variant="secondary">{activeBlock.status.replaceAll("_", " ")}</Badge>{activeBlock.pinned ? <Badge variant="outline"><Pin className="size-3" /> Fixo</Badge> : null}</div>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="size-4" /><dt className="sr-only">Data</dt><dd>{formatStudyDate(activeBlock.plannedDate, "long")}</dd></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Clock3 className="size-4" /><dt className="sr-only">Duração</dt><dd>{activeBlock.plannedStartTime ? `${activeBlock.plannedStartTime.slice(0, 5)} · ` : ""}{activeBlock.plannedMinutes} minutos</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button type="button" variant="outline" disabled={pending || activeBlock.status === "concluido"} onClick={() => setEditing(true)}>Editar / mover</Button>
                {activeBlock.status === "ignorado" ? <Button type="button" disabled={pending} onClick={() => update(activeBlock, "planejado")}>Restaurar bloco</Button> : null}
                {(activeBlock.status === "planejado" || activeBlock.status === "em_andamento") ? <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmSkip(true)}>Marcar como ignorado</Button> : null}
              </div>
              {activeBlock.pinned ? <p className="text-xs text-muted-foreground">Este bloco está fixado e não será movido pela reorganização.</p> : null}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmSkip} onOpenChange={setConfirmSkip}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Marcar bloco como ignorado?</AlertDialogTitle><AlertDialogDescription>O bloco continuará no seu histórico, sem ser contabilizado como concluído. Você poderá restaurá-lo depois.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={() => update(activeBlock, "ignorado")}>Confirmar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
