import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";

export function RouteLoading({ label = "Carregando" }: { label?: string }) {
  return (
    <main
      aria-busy="true"
      aria-label={label}
      className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-5 pb-10 pt-8 sm:px-8 sm:pt-10 lg:px-10"
    >
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex min-h-48 items-center justify-center rounded-2xl border bg-card">
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-5 text-primary" />
          <span>{label}…</span>
        </div>
      </div>
      <span className="sr-only">Aguarde enquanto seus dados são carregados.</span>
    </main>
  );
}
