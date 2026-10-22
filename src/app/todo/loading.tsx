import { Skeleton } from "@/components/ui/skeleton";

export default function TodoLoading() {
  return (
    <main className="app-page space-y-6" aria-label="Carregando tarefas" aria-busy="true">
      <div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-9 w-56" /><Skeleton className="h-4 w-72" /></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-52 w-full" />
    </main>
  );
}
