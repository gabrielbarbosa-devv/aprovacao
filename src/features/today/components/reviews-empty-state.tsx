import { RefreshCw } from "lucide-react";

export function ReviewsEmptyState({ count }: { count: number }) {
  if (count > 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center px-5 py-8 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <RefreshCw aria-hidden="true" className="size-5" />
        </span>
        <h3 className="mt-4 text-sm font-semibold">{count} {count === 1 ? "revisão agendada" : "revisões agendadas"} para hoje</h3>
        <p className="mt-2 max-w-xs text-sm leading-5 text-muted-foreground">As revisões foram criadas a partir dos seus registros de estudo.</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-8 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <RefreshCw aria-hidden="true" className="size-5" />
      </span>
      <h3 className="mt-4 text-sm font-semibold">Nenhuma revisão pendente</h3>
      <p className="mt-2 max-w-xs text-sm leading-5 text-muted-foreground">
        Ao registrar seus estudos, as revisões serão agendadas automaticamente.
      </p>
    </div>
  );
}
