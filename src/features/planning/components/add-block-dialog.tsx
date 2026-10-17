"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStudyBlockAction } from "@/features/planning/actions";
import type { PlanningTopicOption } from "@/features/planning/domain/types";

export function AddBlockDialog({ topics, initialDate }: { topics: PlanningTopicOption[]; initialDate: string }) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const subjects = [...new Map(topics.map(({ subjectId: id, subject }) => [id, subject])).entries()];
  const visibleTopics = topics.filter((topic) => topic.subjectId === subjectId);

  function begin() {
    setRequestId(crypto.randomUUID());
    const firstSubjectId = subjects[0]?.[0] ?? "";
    setSubjectId(firstSubjectId);
    setTopicId(topics.find((topic) => topic.subjectId === firstSubjectId)?.id ?? "");
    setOpen(true);
  }

  function submit(formData: FormData) {
    formData.set("id", requestId);
    formData.set("topicId", topicId);
    startTransition(async () => {
      const result = await saveStudyBlockAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Bloco adicionado ao planejamento.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" onClick={begin} disabled={topics.length === 0} className="gap-2" title={topics.length === 0 ? "Cadastre matérias e tópicos antes de adicionar blocos." : undefined}>
        <Plus aria-hidden="true" className="size-4" /> Novo bloco
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Adicionar bloco de estudo</DialogTitle>
              <DialogDescription>O bloco será salvo no seu planejamento e poderá ser movido depois.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="planning-subject">Matéria</Label>
              <select id="planning-subject" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setTopicId(topics.find((topic) => topic.subjectId === event.target.value)?.id ?? ""); }} required className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="" disabled>Selecione uma matéria</option>
                {subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="planning-topic">Tópico</Label>
              <select id="planning-topic" value={topicId} onChange={(event) => setTopicId(event.target.value)} required disabled={!subjectId} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                <option value="" disabled>Selecione um tópico</option>
                {visibleTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.topic}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1"><Label htmlFor="planning-date">Data</Label><Input id="planning-date" name="plannedDate" type="date" required defaultValue={initialDate} /></div>
              <div className="space-y-2"><Label htmlFor="planning-duration">Duração (min)</Label><Input id="planning-duration" name="plannedMinutes" type="number" min={15} max={480} step={15} defaultValue={120} required /></div>
              <div className="space-y-2"><Label htmlFor="planning-time">Horário (opcional)</Label><Input id="planning-time" name="plannedStartTime" type="time" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={pending || !topicId}>{pending ? "Salvando…" : "Salvar bloco"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
