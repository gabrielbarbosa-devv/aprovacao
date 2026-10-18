import { Skeleton } from "@/components/ui/skeleton";

export default function SubjectsLoading() {
  return <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pb-10 pt-8 sm:px-8 lg:px-10" aria-busy="true" aria-label="Carregando matérias">
    <div className="mb-8 flex items-start justify-between gap-4"><div className="space-y-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-48" /><Skeleton className="h-4 w-64" /></div><Skeleton className="h-9 w-36" /></div>
    <section className="rounded-xl border bg-background p-5 sm:p-6"><div className="mb-5 flex justify-between"><Skeleton className="h-5 w-44" /><Skeleton className="h-6 w-24" /></div><div className="space-y-2">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-[72px] w-full rounded-xl" />)}</div></section>
    <span className="sr-only">Buscando suas matérias salvas…</span>
  </main>;
}
