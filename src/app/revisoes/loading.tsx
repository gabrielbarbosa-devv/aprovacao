import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <main className="app-page space-y-5">
    <section className="space-y-3"><Skeleton className="h-3 w-36" /><Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-96 max-w-full" /></section>
    <Skeleton className="h-10 w-full" />
    <div className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr]"><Skeleton className="h-56 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
  </main>;
}
