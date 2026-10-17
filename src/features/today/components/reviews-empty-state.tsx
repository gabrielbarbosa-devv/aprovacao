import { RefreshCw } from "lucide-react";

export function ReviewsEmptyState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-8 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <RefreshCw aria-hidden="true" className="size-5" />
      </span>
      <h3 className="mt-4 text-sm font-semibold">Nenhuma revisão pendente</h3>
      <p className="mt-2 max-w-xs text-sm leading-5 text-muted-foreground">
        As revisões serão exibidas depois que o registro de estudos estiver disponível.
      </p>
    </div>
  );
}
