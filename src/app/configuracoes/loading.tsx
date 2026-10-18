import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <main className="app-page space-y-5" aria-label="Carregando configurações" aria-busy="true">
    <div className="space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-64" /><Skeleton className="h-5 w-96 max-w-full" /></div>
    <Card className="max-w-[800px]"><CardHeader className="space-y-2"><Skeleton className="h-6 w-52" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent className="space-y-5"><Skeleton className="h-16 w-full" /><Skeleton className="h-10 w-52" /><Skeleton className="h-20 w-full" /></CardContent></Card>
  </main>;
}
