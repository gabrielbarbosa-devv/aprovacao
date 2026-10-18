import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pb-10 pt-8 sm:px-8 sm:pt-10 lg:px-10" aria-busy="true" aria-label="Carregando registros de questões">
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div className="space-y-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-9 w-72" /><Skeleton className="h-4 w-80 max-w-[80vw]" /></div>
      <Skeleton className="h-10 w-44" />
    </div>
    <div className="mb-7 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}</div>
    <div className="rounded-2xl border bg-card p-5 sm:p-6"><Skeleton className="h-5 w-52" /><Skeleton className="mt-5 h-10 w-full" /><div className="mt-5 space-y-3">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-14 w-full" />)}</div></div>
    <span className="sr-only">Buscando seus registros salvos…</span>
  </main>;
}
