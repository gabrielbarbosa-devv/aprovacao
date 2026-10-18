"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { createSubjectAction, updateSubjectAction } from "@/features/subjects/actions";
import type { Subject, SubjectColorToken, SubjectActionResult } from "@/features/subjects/domain/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const colors: { value: SubjectColorToken; label: string; className: string }[] = [
  { value: "blue", label: "Azul", className: "bg-primary" },
  { value: "green", label: "Verde", className: "bg-emerald-600" },
  { value: "violet", label: "Violeta", className: "bg-violet-600" },
  { value: "orange", label: "Laranja", className: "bg-orange-600" },
  { value: "rose", label: "Rosa", className: "bg-rose-600" },
];

export function SubjectFormDialog({ open, onOpenChange, subject }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: Subject | null;
}) {
  const [name, setName] = useState(subject?.name ?? "");
  const [colorToken, setColorToken] = useState<SubjectColorToken>(subject?.colorToken ?? "blue");
  const [saving, setSaving] = useState(false);
  const editing = subject !== null;

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen && !saving) {
      onOpenChange(false);
      setName("");
      setColorToken("blue");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result: SubjectActionResult = editing
      ? await updateSubjectAction({ id: subject.id, name, colorToken })
      : await createSubjectAction({ name, colorToken });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(editing ? "Matéria atualizada." : "Matéria adicionada.");
    onOpenChange(false);
    setName("");
    setColorToken("blue");
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{editing ? "Editar matéria" : "Adicionar matéria"}</DialogTitle>
        <DialogDescription>{editing ? "Altere o nome ou a cor usada para identificar esta matéria." : "Cadastre uma disciplina para organizar seus tópicos e o planejamento."}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2"><Label htmlFor="subject-name">Nome da matéria</Label><Input id="subject-name" autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Direito Constitucional" required /></div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Cor de identificação</legend>
          <div className="flex items-center gap-3" role="radiogroup" aria-label="Cor de identificação">
            {colors.map((color) => <label key={color.value} className="grid size-9 cursor-pointer place-items-center rounded-full outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <input type="radio" name="subject-color" value={color.value} checked={colorToken === color.value} onChange={() => setColorToken(color.value)} className="peer sr-only" aria-label={color.label} />
              <span className={`size-6 rounded-full ${color.className} peer-checked:ring-2 peer-checked:ring-ring peer-checked:ring-offset-2`} aria-hidden="true" />
            </label>)}
          </div>
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving || name.trim().length === 0}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Adicionar matéria"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
