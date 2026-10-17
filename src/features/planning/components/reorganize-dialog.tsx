"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reorganizeStudyBlocksAction } from "@/features/planning/actions";
import { getWeekStart, formatShortDate } from "@/features/planning/domain/dates";
import { previewReorganization } from "@/features/planning/domain/reorganize";
import type { PlanningBlock } from "@/features/planning/domain/types";
import { addStudyDays } from "@/lib/date/study-day";

export function ReorganizeDialog({ overdue, allBlocks, today, dailyGoalMinutes }: { overdue: PlanningBlock[]; allBlocks: PlanningBlock[]; today: string; dailyGoalMinutes: number }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mode, setMode] = useState<"distribute" | "next-week">("distribute");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const selected = overdue.filter((block) => block.plannedDate >= from && block.plannedDate <= to);
  const mondayNextWeek = addStudyDays(getWeekStart(today), 7);
  const firstDate = mode === "next-week" ? mondayNextWeek : addStudyDays(today, 1);
  const changes = useMemo(() => previewReorganization(selected, allBlocks, firstDate, dailyGoalMinutes), [selected, allBlocks, firstDate, dailyGoalMinutes]);
  const previewById = new Map(changes.map((change) => [change.id, change.to]));
  const movedIds = new Set(changes.map(({ id }) => id));
  const dailyMinutes = new Map<string, number>();
  for (const block of allBlocks) {
    if (movedIds.has(block.id) || block.status === "ignorado") continue;
    if (changes.some((change) => change.to === block.plannedDate)) {
      dailyMinutes.set(block.plannedDate, (dailyMinutes.get(block.plannedDate) ?? 0) + block.plannedMinutes);
    }
  }
  for (const change of changes) {
    const block = selected.find(({ id }) => id === change.id);
    if (block) dailyMinutes.set(change.to, (dailyMinutes.get(change.to) ?? 0) + block.plannedMinutes);
  }
  const isIncomplete = changes.length !== selected.filter((block) => !block.pinned && block.status === "planejado").length;

  function begin() {
    const dates = overdue.filter((block) => !block.pinned).map((block) => block.plannedDate);
    setFrom(dates[0] ?? today);
    setTo(dates.at(-1) ?? today);
    setOpen(true);
  }

  function apply() {
    const candidates = selected.filter((block) => previewById.has(block.id));
    const expected = candidates.map(({ id, plannedDate, status, pinned }) => ({ id, planned_date: plannedDate, status, pinned }));
    const updates = candidates.map(({ id }) => ({ id, planned_date: previewById.get(id) ?? "" }));
    startTransition(async () => {
      const result = await reorganizeStudyBlocksAction({ expected, changes: updates });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Blocos reorganizados com sucesso.");
      setOpen(false);
      router.refresh();
    });
  }

  const firstOverdue = overdue[0]?.plannedDate ?? today;
  const lastOverdue = overdue.at(-1)?.plannedDate ?? today;

  return (
    <>
      <Button variant="outline" size="sm" onClick={begin} disabled={!overdue.some((block) => !block.pinned)} className="gap-2">
        <RefreshCw aria-hidden="true" className="size-3.5" /> Reorganizar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Reorganizar blocos pendentes</DialogTitle><DialogDescription>Escolha o período. A prévia usa seus blocos e sua meta diária e só será salva após confirmar.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="replan-from">De</Label><Input id="replan-from" type="date" min={firstOverdue} max={lastOverdue} value={from} onChange={(event) => setFrom(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="replan-to">Até</Label><Input id="replan-to" type="date" min={from || firstOverdue} max={lastOverdue} value={to} onChange={(event) => setTo(event.target.value)} /></div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Como distribuir</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"><input type="radio" name="replan-mode" checked={mode === "distribute"} onChange={() => setMode("distribute")} className="mt-0.5 accent-primary" /><span><span className="font-medium">Distribuir respeitando limite diário</span><span className="mt-1 block text-muted-foreground">Começa no próximo dia e inclui fins de semana.</span></span></label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"><input type="radio" name="replan-mode" checked={mode === "next-week"} onChange={() => setMode("next-week")} className="mt-0.5 accent-primary" /><span><span className="font-medium">Mover para a próxima semana</span><span className="mt-1 block text-muted-foreground">Começa na segunda-feira seguinte.</span></span></label>
          </fieldset>
          <section aria-labelledby="replan-preview-title" className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <h3 id="replan-preview-title" className="text-sm font-semibold">Prévia da alteração</h3>
            {selected.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum bloco pendente neste intervalo.</p> : (
              <ul className="max-h-48 space-y-2 overflow-auto text-sm">
                {selected.map((block) => <li key={block.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{block.subject} · {block.topic} · {block.plannedMinutes} min</span><span className="flex shrink-0 items-center gap-1 text-muted-foreground">{formatShortDate(block.plannedDate)} <ArrowRight className="size-3" /> {previewById.has(block.id) ? formatShortDate(previewById.get(block.id) ?? "") : block.pinned ? "fixado" : "sem capacidade"}</span></li>)}
              </ul>
            )}
            {dailyMinutes.size ? <div className="border-t pt-2 text-xs text-muted-foreground">{[...dailyMinutes].map(([date, minutes]) => <p key={date}>{formatShortDate(date)}: {minutes} min nesta prévia{(allBlocks.filter((block) => block.plannedDate === date && block.status !== "ignorado").reduce((sum, block) => sum + block.plannedMinutes, 0)) ? ` + blocos já previstos` : ""}</p>)}</div> : null}
            {isIncomplete ? <p role="status" className="text-xs text-amber-700">Alguns blocos não cabem na meta diária e ficaram fora da alteração.</p> : null}
          </section>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={pending || changes.length === 0} onClick={apply}>{pending ? "Aplicando…" : "Aplicar reorganização"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
