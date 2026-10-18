import { AppShell } from "@/components/app-shell";
import { AnalyticsPage } from "@/features/analytics/components/analytics-page";
import { getAnalyticsPageData } from "@/features/analytics/data/get-analytics";
import type { AnalyticsSearchParams } from "@/features/analytics/domain/filters";

export default async function Page({ searchParams }: { searchParams: Promise<AnalyticsSearchParams> }) {
  const data = await getAnalyticsPageData(await searchParams);
  return <AppShell email={data.email} activeItem="meu-progresso"><AnalyticsPage data={data} /></AppShell>;
}
