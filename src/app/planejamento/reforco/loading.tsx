import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <main className="mx-auto w-full max-w-[1240px] flex-1 space-y-5 px-5 pb-8 pt-8 sm:px-8 sm:pt-10 lg:px-10" aria-label="Carregando plano de reforço" aria-busy="true">
    <div className="space-y-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-10 w-72" /><Skeleton className="h-5 w-96 max-w-full" /></div>
    {[0, 1].map((item) => <Card key={item}><CardHeader className="space-y-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-full max-w-xl" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></CardContent></Card>)}
  </main>;
}
