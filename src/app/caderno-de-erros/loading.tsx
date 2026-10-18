import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <main className="app-page" aria-busy="true" aria-label="Carregando caderno de erros">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-5"><div className="space-y-3"><Skeleton className="h-3 w-32" /><Skeleton className="h-9 w-64" /><Skeleton className="h-4 w-80 max-w-[80vw]" /></div><Skeleton className="h-10 w-48" /></div>
    <div className="rounded-2xl border bg-card p-5 sm:p-6"><Skeleton className="h-5 w-52" /><Skeleton className="mt-5 h-8 w-80 max-w-full" /><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-9" /><Skeleton className="h-9" /><Skeleton className="h-9" /><Skeleton className="h-9" /></div><div className="mt-5 space-y-3">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-14 w-full" />)}</div></div>
    <span className="sr-only">Buscando suas anotações salvas…</span>
  </main>;
}
