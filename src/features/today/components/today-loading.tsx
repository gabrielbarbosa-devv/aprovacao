import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TodayLoading() {
  return (
    <div className="min-h-svh bg-muted/30 lg:grid lg:grid-cols-[252px_minmax(0,1fr)]" aria-label="Carregando seus dados">
      <div className="hidden border-r bg-background p-5 lg:block"><Skeleton className="h-10 w-40" /></div>
      <div>
        <div className="h-16 border-b bg-background" />
        <main className="mx-auto grid w-full max-w-[1180px] gap-5 px-5 py-10 sm:px-8 xl:grid-cols-[1.55fr_0.95fr]">
          <section className="space-y-5 xl:col-span-2"><Skeleton className="h-8 w-72" /><Skeleton className="h-5 w-56" /></section>
          <Card><CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="mt-3 h-4 w-56" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent><Skeleton className="h-56 w-full" /></CardContent></Card>
        </main>
      </div>
    </div>
  );
}
