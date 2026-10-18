import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-7 sm:px-6 lg:px-10 lg:py-9" aria-label="Carregando desempenho" aria-busy="true">
      <div className="space-y-3"><Skeleton className="h-3 w-32" /><Skeleton className="h-10 w-64" /><Skeleton className="h-5 w-96 max-w-full" /></div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>
      <div className="grid gap-4 xl:grid-cols-2">{[0, 1].map((index) => <Skeleton key={index} className="h-80 rounded-xl" />)}</div>
    </main>
  );
}
