"use client";

import { useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Archive, ArrowDown, ArrowUp, Ellipsis, Pencil, RotateCcw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { archiveSubjectAction, deleteEmptySubjectAction, reorderSubjectsAction, restoreSubjectAction, updateSubjectFocusAction } from "@/features/subjects/actions";
import type { Subject, SubjectActionResult } from "@/features/subjects/domain/types";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SubjectFormDialog } from "@/features/subjects/components/subject-form-dialog";

export function SubjectActionsMenu({ subject, activeSubjectIds, activeIndex }: { subject: Subject; activeSubjectIds?: string[]; activeIndex: number }) {
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const archived = subject.archivedAt !== null;

  async function run(action: () => Promise<SubjectActionResult>, successMessage: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    toast.success(successMessage);
    return true;
  }

  async function archive() {
    if (await run(() => archiveSubjectAction({ id: subject.id, expectedFutureBlocks: subject.futureBlockCount }), "Matéria arquivada. O histórico foi preservado.")) setConfirmArchive(false);
  }

  async function restore() {
    await run(() => restoreSubjectAction(subject.id), "Matéria restaurada.");
  }

  async function remove() {
    if (await run(() => deleteEmptySubjectAction(subject.id), "Matéria excluída.")) setConfirmDelete(false);
  }

  async function move(offset: -1 | 1) {
    if (!activeSubjectIds) return;
    const nextIndex = activeIndex + offset;
    if (nextIndex < 0 || nextIndex >= activeSubjectIds.length) return;
    const nextIds = [...activeSubjectIds];
    [nextIds[activeIndex], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[activeIndex]];
    await run(() => reorderSubjectsAction(nextIds), "Ordem das matérias atualizada.");
  }

  return <>
    {archived ? <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" onClick={restore}><RotateCcw aria-hidden="true" className="size-3.5" /><span className="hidden sm:inline">Restaurar</span><span className="sr-only sm:hidden">Restaurar {subject.name}</span></Button> : <Menu.Root>
      <Menu.Trigger render={<Button type="button" variant="ghost" size="icon" aria-label={`Ações de ${subject.name}`} />}><Ellipsis aria-hidden="true" /></Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
          <Menu.Popup className="min-w-48 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-md outline-none">
            <Menu.Item onClick={() => setEditing(true)} className="flex h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-highlighted:bg-muted"><Pencil aria-hidden="true" className="size-4" />Editar</Menu.Item>
            <Menu.Item disabled={busy} onClick={() => void run(() => updateSubjectFocusAction({ id: subject.id, isFocus: !subject.isFocus }), subject.isFocus ? "Matéria removida do foco principal." : "Matéria adicionada ao foco principal.")} className="flex h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-highlighted:bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-50"><Star aria-hidden="true" className="size-4" />{subject.isFocus ? "Remover do foco principal" : "Adicionar ao foco principal"}</Menu.Item>
            <Menu.Item disabled={!activeSubjectIds || activeIndex === 0} onClick={() => void move(-1)} className="flex h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-highlighted:bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-50"><ArrowUp aria-hidden="true" className="size-4" />Mover para cima</Menu.Item>
            <Menu.Item disabled={!activeSubjectIds || activeIndex >= (activeSubjectIds.length - 1)} onClick={() => void move(1)} className="flex h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-highlighted:bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-50"><ArrowDown aria-hidden="true" className="size-4" />Mover para baixo</Menu.Item>
            <Menu.Item onClick={() => setConfirmArchive(true)} className="flex h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm outline-none data-highlighted:bg-muted"><Archive aria-hidden="true" className="size-4" />Arquivar</Menu.Item>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item disabled={subject.topics.length > 0} onClick={() => setConfirmDelete(true)} className="flex h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-sm text-destructive outline-none data-highlighted:bg-destructive/10 data-disabled:cursor-not-allowed data-disabled:opacity-50"><Trash2 aria-hidden="true" className="size-4" />Excluir matéria</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>}

    {editing ? <SubjectFormDialog open={editing} onOpenChange={setEditing} subject={subject} /> : null}

    <AlertDialog open={confirmArchive} onOpenChange={(open) => { if (!busy) setConfirmArchive(open); }}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar {subject.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            A matéria sairá da lista ativa e deixará de ser oferecida para novos blocos. Tópicos, registros e histórico permanecem salvos.
            {subject.futureBlockCount > 0 ? ` Há ${subject.futureBlockCount} blocos futuros; eles permanecerão nas datas atuais. Para reorganizá-los, restaure a matéria e ajuste o planejamento.` : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="default" disabled={busy} onClick={archive}>{busy ? "Arquivando…" : subject.futureBlockCount > 0 ? "Arquivar e manter blocos" : "Arquivar matéria"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={confirmDelete} onOpenChange={(open) => { if (!busy) setConfirmDelete(open); }}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {subject.name}?</AlertDialogTitle>
          <AlertDialogDescription>Esta matéria não tem tópicos e será excluída permanentemente. Matérias com conteúdo só podem ser arquivadas para preservar os registros.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={remove}>{busy ? "Excluindo…" : "Excluir matéria"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
