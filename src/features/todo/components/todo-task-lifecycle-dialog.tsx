"use client";

import { useState } from "react";
import { Archive, LoaderCircle, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type TodoTaskLifecycleAction = "archive" | "trash";

export function TodoTaskLifecycleDialog({
  open,
  taskTitle,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  taskTitle?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (action: TodoTaskLifecycleAction) => Promise<boolean>;
}) {
  const [pending, setPending] = useState<TodoTaskLifecycleAction | null>(null);

  async function confirm(action: TodoTaskLifecycleAction) {
    if (pending) return;
    setPending(action);
    try {
      if (await onConfirm(action)) onOpenChange(false);
    } finally {
      setPending(null);
    }
  }

  return <AlertDialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
        <AlertDialogDescription>
          {taskTitle ? <span className="mb-1 block font-medium text-foreground">{taskTitle}</span> : null}
          Esta tarefa será enviada para a lixeira. Você poderá recuperá-la por um período limitado.
          {pending ? <span className="sr-only">Processando operação.</span> : null}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-col sm:flex-row">
        <AlertDialogCancel disabled={pending !== null}>Cancelar</AlertDialogCancel>
        <Button type="button" variant="outline" disabled={pending !== null} onClick={() => void confirm("archive")}>
          {pending === "archive" ? <LoaderCircle className="size-4 animate-spin" /> : <Archive className="size-4" />}
          Arquivar
        </Button>
        <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={pending !== null} onClick={() => void confirm("trash")}>
          {pending === "trash" ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Mover para a lixeira
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
