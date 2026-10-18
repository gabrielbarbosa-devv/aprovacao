"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { saveExamTargetAction } from "@/features/exams/actions";
import type { ExamPriority, ExamStage, ExamTarget, ExamSubject, ExamTopic } from "@/features/exams/domain/types";
import { examJurisdictions } from "@/features/exams/domain/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const stages: { value: ExamStage; label: string }[] = [
  { value: "em_preparacao", label: "Em preparação" },
  { value: "edital_publicado", label: "Edital publicado" },
  { value: "inscricao_aberta", label: "Inscrição aberta" },
  { value: "prova_realizada", label: "Prova realizada" },
];
const priorities: { value: ExamPriority; label: string }[] = [
  { value: "alta", label: "Alta" }, { value: "media", label: "Média" }, { value: "baixa", label: "Baixa" },
];

type ExamTargetFormProps = {
  target: ExamTarget | null;
  subjects?: ExamSubject[];
  topics?: ExamTopic[];
  onSaved: (id: string) => void;
  onCancel?: () => void;
};

export function ExamTargetForm({ target, subjects = [], topics = [], onSaved, onCancel }: ExamTargetFormProps) {
  const [saving, setSaving] = useState(false);
  const [subjectIds, setSubjectIds] = useState<string[]>(target?.subjectIds ?? []);
  const [topicIds, setTopicIds] = useState<string[]>(target?.topicIds ?? []);

  function toggleSubject(id: string) {
    const selected = subjectIds.includes(id);
    setSubjectIds((current) => selected ? current.filter((value) => value !== id) : [...current, id]);
    if (selected) setTopicIds((current) => current.filter((topicId) => topics.find((topic) => topic.id === topicId)?.subjectId !== id));
  }

  function toggleTopic(id: string) {
    setTopicIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const result = await saveExamTargetAction({
        id: target?.id ?? null,
        examName: form.get("examName"), institution: form.get("institution"), roleTitle: form.get("roleTitle"),
        jurisdiction: form.get("jurisdiction"), currentStage: form.get("currentStage"), priority: form.get("priority"),
        examDate: form.get("examDate") || null, applicationDeadline: form.get("applicationDeadline") || null,
        officialUrl: form.get("officialUrl"), notes: form.get("notes"), subjectIds, topicIds,
      });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(target ? "Concurso atualizado." : "Concurso adicionado.");
      onSaved(result.id ?? target?.id ?? "");
    } catch {
      toast.error("Não foi possível salvar o concurso. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const activeSubjects = subjects.filter((subject) => subject.archivedAt === null || subjectIds.includes(subject.id));
  return <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-6 sm:px-6">
      <section aria-labelledby="exam-data-heading" className="space-y-4">
        <div><h3 id="exam-data-heading" className="text-sm font-semibold">Dados</h3><p className="mt-1 text-xs text-muted-foreground">Informações e prazos informados por você.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="exam-name" name="examName" label="Nome do concurso" required defaultValue={target?.examName} placeholder="Ex.: PRF" />
          <Field id="exam-institution" name="institution" label="Órgão" required defaultValue={target?.institution} placeholder="Ex.: Polícia Rodoviária Federal" />
          <Field id="exam-role" name="roleTitle" label="Cargo pretendido" required defaultValue={target?.roleTitle} placeholder="Ex.: Policial Rodoviário Federal" />
          <SelectField id="exam-jurisdiction" name="jurisdiction" label="Abrangência" defaultValue={target?.jurisdiction ?? "Federal"} options={examJurisdictions.map((value) => ({ value, label: value }))} />
          <SelectField id="exam-stage" name="currentStage" label="Etapa atual" defaultValue={target?.currentStage ?? "em_preparacao"} options={stages} />
          <SelectField id="exam-priority" name="priority" label="Prioridade pessoal" defaultValue={target?.priority ?? "media"} options={priorities} />
          <Field id="exam-date" name="examDate" label="Data da prova (opcional)" type="date" defaultValue={target?.examDate ?? ""} />
          <Field id="exam-deadline" name="applicationDeadline" label="Prazo de inscrição (opcional)" type="date" defaultValue={target?.applicationDeadline ?? ""} />
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="exam-url">Edital ou fonte oficial (opcional)</Label><Input id="exam-url" name="officialUrl" type="url" defaultValue={target?.officialUrl ?? ""} placeholder="https://" maxLength={2000} /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="exam-notes">Observações (opcional)</Label><Textarea id="exam-notes" name="notes" defaultValue={target?.notes ?? ""} maxLength={4000} placeholder="Anotações pessoais sobre este objetivo" /></div>
        </div>
      </section>
      {target ? <section aria-labelledby="exam-subjects-heading" className="space-y-4 border-t pt-5">
        <div><h3 id="exam-subjects-heading" className="text-sm font-semibold">Matérias vinculadas</h3><p className="mt-1 text-xs text-muted-foreground">Selecione matérias já cadastradas. O histórico de estudo permanece compartilhado.</p></div>
        {activeSubjects.length ? <div className="space-y-3">
          {activeSubjects.map((subject) => {
            const selected = subjectIds.includes(subject.id);
            const subjectTopics = topics.filter((topic) => topic.subjectId === subject.id && (topic.archivedAt === null || topicIds.includes(topic.id)));
            return <div key={subject.id} className="rounded-xl border p-3">
              <CheckRow checked={selected} onChange={() => toggleSubject(subject.id)} label={subject.name} hint={subject.archivedAt ? "Matéria arquivada, vínculo existente" : undefined} />
              {selected && subjectTopics.length > 0 ? <div className="ml-7 mt-3 space-y-2 border-l pl-3">{subjectTopics.map((topic) => <CheckRow key={topic.id} checked={topicIds.includes(topic.id)} onChange={() => toggleTopic(topic.id)} label={topic.title} hint={topic.archivedAt ? "Tópico arquivado" : undefined} small />)}</div> : null}
              {selected && subjectTopics.length === 0 ? <p className="ml-7 mt-2 text-xs text-muted-foreground">Esta matéria ainda não tem tópicos disponíveis para vínculo.</p> : null}
            </div>;
          })}
        </div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Cadastre uma matéria antes de vinculá-la a este concurso.</p>}
      </section> : null}
    </div>
    <div className="flex justify-end gap-2 border-t bg-background px-5 py-4 sm:px-6">
      {onCancel ? <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button> : null}
      <Button type="submit" disabled={saving}>{saving ? "Salvando…" : target ? "Salvar alterações" : "Adicionar concurso"}</Button>
    </div>
  </form>;
}

function Field({ id, name, label, required, type = "text", defaultValue, placeholder }: { id: string; name: string; label: string; required?: boolean; type?: string; defaultValue?: string | null; placeholder?: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={name} type={type} required={required} defaultValue={defaultValue ?? ""} placeholder={placeholder} maxLength={120} /></div>;
}

function SelectField({ id, name, label, defaultValue, options }: { id: string; name: string; label: string; defaultValue: string; options: { value: string; label: string }[] }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><select id={id} name={name} defaultValue={defaultValue} className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

function CheckRow({ checked, onChange, label, hint, small = false }: { checked: boolean; onChange: () => void; label: string; hint?: string; small?: boolean }) {
  return <label className={`flex cursor-pointer items-start gap-2.5 ${small ? "text-sm" : "text-sm font-medium"}`}><input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 size-4 accent-primary" /><span className="min-w-0">{label}{hint ? <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span> : null}</span></label>;
}
