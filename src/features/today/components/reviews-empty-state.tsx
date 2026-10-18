import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReviewTask } from "@/features/reviews/domain/types";
import { formatStudyDate } from "@/lib/date/study-day";

export function ReviewsEmptyState({ count, items, today }: { count: number; items: ReviewTask[]; today: string }) {
  if (count > 0) {
    return (
      <div className="space-y-3 px-5 pb-5 pt-2">
        {items.slice(0, 3).map((item) => <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
          <RefreshCw aria-hidden="true" className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.topic}</p><p className="truncate text-xs text-muted-foreground">{item.subject} · {item.kind === "reinforcement" ? "Reforço" : `D+${item.intervalDays}`}</p></div>
          {item.dueOn < today ? <Badge variant="destructive">Atrasada</Badge> : null}
          <span className="shrink-0 text-xs text-muted-foreground">{formatStudyDate(item.dueOn, "short")}</span>
        </div>)}
        {count > items.length ? <p className="text-xs text-muted-foreground">E mais {count - items.length} {count - items.length === 1 ? "revisão" : "revisões"} pendentes</p> : null}
        <Button render={<Link href="/revisoes" />} variant="outline" className="w-full">Ver fila de revisões <ArrowRight aria-hidden="true" /></Button>
      </div>
    );
  }
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-8 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><RefreshCw aria-hidden="true" className="size-5" /></span>
      <h3 className="mt-4 text-sm font-semibold">Nenhuma revisão pendente</h3>
      <p className="mt-2 max-w-xs text-sm leading-5 text-muted-foreground">Ao registrar estudos, as revisões aparecem nesta fila na data agendada.</p>
      <Button render={<Link href="/revisoes" />} variant="outline" className="mt-4">Ver revisões <ArrowRight aria-hidden="true" /></Button>
    </div>
  );
}
