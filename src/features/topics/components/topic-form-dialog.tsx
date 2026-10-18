"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTopicAction, updateTopicAction } from "@/features/topics/actions";
import type { StudyTopic, TopicPriority, TopicStatus } from "@/features/topics/domain/types";
import { topicFieldsSchema } from "@/features/topics/domain/schemas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

export function TopicFormDialog({ subjectId, topic, open, onOpenChange }: {
  subjectId: string;
  topic: StudyTopic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(topic?.title ?? "");
  const [status, setStatus] = useState<TopicStatus>(topic?.status ?? "nao_iniciado");
  const [priority, setPriority] = useState<TopicPriority>(topic?.priority ?? "media");
  const [estimatedMinutes, setEstimatedMinutes] = useState(topic?.estimatedMinutes?.toString() ?? "");
  const [sourceUrl, setSourceUrl] = useState(topic?.sourceUrl ?? "");
  const [notes, setNotes] = useState(topic?.notes ?? "");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const estimate = estimatedMinutes.trim() === "" ? null : Number(estimatedMinutes);
    const parsed = topicFieldsSchema.safeParse({ title, status, priority, estimatedMinutes: estimate, sourceUrl, notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Confira os dados do tópico.");
      return;
    }
    startTransition(async () => {
      const result = topic
        ? await updateTopicAction({ ...parsed.data, id: topic.id, subjectId })
        : await createTopicAction({ ...parsed.data, subjectId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(topic ? "Tópico atualizado." : "Tópico adicionado.");
      onOpenChange(false);
    });
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!isPending) onOpenChange(nextOpen); }}>
    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{topic ? "Editar tópico" : "Adicionar tópico"}</DialogTitle>
        <DialogDescription>Organize o que você vai estudar e registre suas próprias referências e notas.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="topic-title">Nome do tópico</Label>
          <Input id="topic-title" autoFocus maxLength={140} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Interpretação de texto" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSelect id="topic-status" label="Status" value={status} onChange={(value) => setStatus(value as TopicStatus)} options={[
            ["nao_iniciado", "Não iniciado"], ["em_andamento", "Estudando"], ["revisando", "Revisando"], ["dominado", "Dominado"], ["concluido", "Concluído (registro anterior)"],
          ]} />
          <FieldSelect id="topic-priority" label="Prioridade" value={priority} onChange={(value) => setPriority(value as TopicPriority)} options={[["alta", "Alta"], ["media", "Média"], ["baixa", "Baixa"]]} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="topic-estimate">Tempo estimado (minutos, opcional)</Label>
          <Input id="topic-estimate" type="number" inputMode="numeric" min={1} max={480} step={1} value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} placeholder="Ex.: 45" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="topic-source">Material externo (link opcional)</Label>
          <Input id="topic-source" type="url" inputMode="url" maxLength={2048} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="topic-notes">Notas curtas (opcional)</Label>
          <Textarea id="topic-notes" maxLength={3000} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anote observações pessoais sobre este tópico." />
          <p className="text-right text-xs text-muted-foreground">{notes.length}/3000</p>
        </div>
        <DialogFooter className="-mx-4 -mb-4 flex-col-reverse gap-2 border-t bg-muted/30 p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" disabled={isPending} className="gap-2">{isPending ? <Spinner /> : null}{isPending ? "Salvando…" : topic ? "Salvar alterações" : "Adicionar tópico"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function FieldSelect({ id, label, value, onChange, options }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={(nextValue) => { if (nextValue) onChange(nextValue); }}>
      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}
