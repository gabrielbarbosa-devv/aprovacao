"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TodoWorkspace } from "@/features/todo/domain/types";

export type WorkspaceTaskPolicy = "keep_tasks" | "soft_delete_tasks";

type TodoWorkspaceDeleteDialogProps = {
  workspace: TodoWorkspace | null;
  linkedTaskCount: number;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (policy: WorkspaceTaskPolicy) => void;
};

export function TodoWorkspaceDeleteDialog({ workspace, linkedTaskCount, open, busy, onOpenChange, onConfirm }: TodoWorkspaceDeleteDialogProps) {
  const [policy, setPolicy] = useState<WorkspaceTaskPolicy | "">("");
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) setPolicy(""); onOpenChange(nextOpen); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir workspace?</DialogTitle>
          <DialogDescription>
            {workspace ? `“${workspace.name}” será removido. Há ${linkedTaskCount} registro(s) vinculado(s), incluindo os que já foram removidos logicamente. Escolha o destino das tarefas e do histórico.` : "Escolha o que fazer com as tarefas vinculadas."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="workspace-delete-policy">Tarefas vinculadas</Label>
          <Select value={policy} onValueChange={(value) => setPolicy(value as WorkspaceTaskPolicy | "")}>
            <SelectTrigger id="workspace-delete-policy" className="w-full" aria-label="Escolher destino das tarefas">
              <SelectValue placeholder="Escolha uma opção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep_tasks">Manter tarefas sem workspace</SelectItem>
              <SelectItem value="soft_delete_tasks">Remover tarefas (recuperáveis)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">A remoção de tarefas usa exclusão lógica. O histórico fica recuperável; nenhuma tarefa é apagada permanentemente.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button type="button" variant="destructive" disabled={!policy || busy} onClick={() => policy && onConfirm(policy)}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}Excluir workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
