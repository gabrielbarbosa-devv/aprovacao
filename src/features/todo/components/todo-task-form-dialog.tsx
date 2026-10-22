"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { todoTaskAction } from "@/features/todo/actions";
import type { TodoList, TodoWorkspace } from "@/features/todo/domain/types";
import { localDateKey } from "@/features/todo/domain/dashboard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TodoTaskFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: TodoList[];
  workspaces: TodoWorkspace[];
  initialDate: string;
  onCreated: () => Promise<void>;
};

export function TodoTaskFormDialog({ open, onOpenChange, lists, workspaces, initialDate, onCreated }: TodoTaskFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("none");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueOn, setDueOn] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [saving, setSaving] = useState(false);
  const listItems = lists.map((list) => ({ value: list.id, label: list.name }));
  const workspaceItems = [{ value: "none", label: "Sem workspace" }, ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))];
  const priorityItems = [{ value: "low", label: "Baixa" }, { value: "medium", label: "Média" }, { value: "high", label: "Alta" }] as const;

  const reset = () => {
    setTitle(""); setDescription(""); setWorkspaceId("none"); setPriority("medium"); setDueOn(""); setDueTime("");
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetListId = listId || lists[0]?.id;
    if (!targetListId) { toast.error("Crie ou selecione uma lista para salvar a tarefa."); return; }
    setSaving(true);
    try {
      const result = await todoTaskAction({
        operation: "create",
        title,
        description: description.trim() || null,
        listId: targetListId,
        workspaceId: workspaceId === "none" ? null : workspaceId,
        priority,
        startsOn: initialDate || localDateKey(new Date()),
        dueOn: dueOn || null,
        dueAt: dueOn && dueTime ? new Date(`${dueOn}T${dueTime}`).toISOString() : null,
      });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Tarefa criada.");
      reset();
      onOpenChange(false);
      await onCreated();
    } catch {
      toast.error("Não foi possível criar a tarefa. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) reset(); onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Nova tarefa</DialogTitle>
          <DialogDescription>Organize o que precisa fazer e escolha quando pretende concluir.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="todo-task-title">Tarefa</Label>
            <Input id="todo-task-title" autoFocus maxLength={240} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Separar documentos" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="todo-task-description">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Textarea id="todo-task-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} rows={3} placeholder="Anotações para ajudar na execução" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Lista</Label>
              <Select items={listItems} value={listId || lists[0]?.id || ""} onValueChange={(value) => setListId(value ?? "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione uma lista" /></SelectTrigger>
                <SelectContent>{lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Workspace <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Select items={workspaceItems} value={workspaceId} onValueChange={(value) => setWorkspaceId(value ?? "none")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Sem workspace</SelectItem>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select items={priorityItems} value={priority} onValueChange={(value) => { if (value === "low" || value === "medium" || value === "high") setPriority(value); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="todo-task-date">Prazo</Label>
              <Input id="todo-task-date" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="todo-task-time">Horário do prazo <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input id="todo-task-time" type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} />
              <p className="text-xs text-muted-foreground">O horário segue o fuso local do seu dispositivo.</p>
            </div>
          </div>
          <DialogFooter className="-mx-4 -mb-4 mt-6">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || lists.length === 0}>
              {saving ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Salvando…</> : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
