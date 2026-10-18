import { AppShell } from "@/components/app-shell";
import { getMistakesPageData } from "@/features/mistakes/data/repository";
import { MistakesPage } from "@/features/mistakes/components/mistakes-page";

export default async function Page({ searchParams }: { searchParams: Promise<{ batchId?: string | string[] }> }) {
  const [data, query] = await Promise.all([getMistakesPageData(), searchParams]);
  const requestedBatchId = typeof query.batchId === "string" ? query.batchId : null;
  const initialBatchId = data.batches.some((batch) => batch.id === requestedBatchId && batch.deletedAt === null)
    ? requestedBatchId
    : null;

  return <AppShell email={data.email} activeItem="caderno-de-erros"><MistakesPage data={data} initialBatchId={initialBatchId} /></AppShell>;
}
