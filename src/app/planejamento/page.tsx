import { PlanningScreen } from "@/features/planning/components/planning-screen";
import { getPlanningData } from "@/features/planning/data/get-planning-data";

export default async function PlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { week } = await searchParams;
  const data = await getPlanningData(Array.isArray(week) ? week[0] : week);
  return <PlanningScreen key={data.weekStart} data={data} />;
}
