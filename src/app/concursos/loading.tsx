import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <main className="app-page" aria-busy="true" aria-label="Carregando concursos">
    <div className="mb-6 flex justify-between gap-5"><div className="space-y-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-56" /><Skeleton className="h-4 w-72" /></div><Skeleton className="h-9 w-40" /></div>
    <div className="rounded-2xl border bg-card p-5 sm:p-6"><Skeleton className="h-5 w-48" /><Skeleton className="mt-6 h-9 w-40" /><div className="mt-4 grid gap-3 md:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[82px] rounded-xl" />)}</div></div>
    <span className="sr-only">Buscando seus concursos salvos…</span>
  </main>;
}
