import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <main className="mx-auto w-full max-w-[1130px] flex-1 space-y-5 px-5 py-8 sm:px-8 lg:px-10" aria-label="Carregando configurações" aria-busy="true">
    <div className="space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-64" /><Skeleton className="h-5 w-96 max-w-full" /></div>
    <Card className="max-w-[800px]"><CardHeader className="space-y-2"><Skeleton className="h-6 w-52" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent className="space-y-5"><Skeleton className="h-16 w-full" /><Skeleton className="h-10 w-52" /><Skeleton className="h-20 w-full" /></CardContent></Card>
  </main>;
}
