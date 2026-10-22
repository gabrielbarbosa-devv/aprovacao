"use client";

import { useState, type FormEvent } from "react";
import { BriefcaseBusiness, FolderKanban, Heart, Laptop, LoaderCircle, Smartphone, Users } from "lucide-react";
import { toast } from "sonner";
import { todoWorkspaceAction } from "@/features/todo/actions";
import type { TodoWorkspace } from "@/features/todo/domain/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const iconOptions = [
  { value: "briefcase", label: "Pasta", Icon: BriefcaseBusiness },
  { value: "folder-kanban", label: "Projeto", Icon: FolderKanban },
  { value: "smartphone", label: "Aplicativo", Icon: Smartphone },
  { value: "laptop", label: "Tecnologia", Icon: Laptop },
  { value: "users", label: "Equipe", Icon: Users },
  { value: "heart", label: "Pessoal", Icon: Heart },
] as const;
const colors = [
  { value: "blue", label: "Azul" },
  { value: "violet", label: "Violeta" },
  { value: "green", label: "Verde" },
  { value: "orange", label: "Laranja" },
  { value: "rose", label: "Rosa" },
] as const;

type TodoWorkspaceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: TodoWorkspace | null;
  onSaved: () => Promise<void>;
};

export function TodoWorkspaceFormDialog({ open, onOpenChange, workspace = null, onSaved }: TodoWorkspaceFormDialogProps) {
  const [name, setName] = useState(workspace?.name ?? "");
  const [description, setDescription] = useState(workspace?.description ?? "");
  const [icon, setIcon] = useState(workspace?.icon ?? "briefcase");
  const [color, setColor] = useState(workspace?.color ?? "violet");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName(workspace?.name ?? "");
    setDescription(workspace?.description ?? "");
    setIcon(workspace?.icon ?? "briefcase");
    setColor(workspace?.color ?? "violet");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await (workspace
        ? todoWorkspaceAction({ operation: "update", id: workspace.id, name, description: description.trim() || null, icon, color })
        : todoWorkspaceAction({ operation: "create", name, description: description.trim() || null, icon, color }));
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      await onSaved();
      toast.success(workspace ? "Workspace atualizado." : "Workspace criado.");
      onOpenChange(false);
      reset();
    } catch {
      toast.error("Não foi possível salvar o workspace.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) reset(); onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{workspace ? "Editar workspace" : "Novo workspace"}</DialogTitle>
          <DialogDescription>Organize tarefas relacionadas no mesmo espaço de trabalho.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="space-y-2">
            <Label htmlFor="todo-workspace-name">Nome</Label>
            <Input id="todo-workspace-name" autoFocus maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: App Mobile" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="todo-workspace-description">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Textarea id="todo-workspace-description" maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que você está organizando neste espaço?" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select value={icon} onValueChange={(value) => value && setIcon(value)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{iconOptions.map(({ value, label, Icon }) => <SelectItem key={value} value={value}><span className="flex items-center gap-2"><Icon className="size-4" />{label}</span></SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Select value={color} onValueChange={(value) => value && setColor(value)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{colors.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : null}{workspace ? "Salvar alterações" : "Criar workspace"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
