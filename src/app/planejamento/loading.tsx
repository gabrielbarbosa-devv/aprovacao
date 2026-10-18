import { Skeleton } from "@/components/ui/skeleton";

export default function PlanningLoading() {
  return <div className="min-h-svh bg-muted/30 lg:grid lg:grid-cols-[252px_minmax(0,1fr)]" aria-busy="true" aria-label="Carregando planejamento">
    <aside className="hidden border-r bg-background p-5 lg:block"><Skeleton className="h-10 w-40" /><div className="mt-10 space-y-3">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div></aside>
    <div className="flex min-w-0 flex-col"><header className="flex h-16 items-center border-b bg-background px-6"><Skeleton className="h-4 w-64" /></header>
      <main className="app-page">
        <div className="mb-6 flex items-start justify-between gap-5"><div className="space-y-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-72" /><Skeleton className="h-4 w-96 max-w-[80vw]" /></div><Skeleton className="h-9 w-32" /></div>
        <section className="rounded-xl border bg-background p-5 sm:p-6"><div className="mb-6 flex justify-between"><div className="space-y-2"><Skeleton className="h-5 w-44" /><Skeleton className="h-4 w-36" /></div><Skeleton className="h-9 w-36" /></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">{Array.from({ length: 7 }, (_, index) => <div key={index} className="space-y-2 rounded-xl border p-3"><Skeleton className="h-4 w-12" /><Skeleton className="h-3 w-16" /><Skeleton className="mt-4 h-16 w-full" /></div>)}</div><Skeleton className="mt-5 h-8 w-full" /></section>
        <span className="sr-only">Buscando seus blocos e tópicos salvos…</span>
      </main>
    </div>
  </div>;
}
