import { ReinforcementPage } from "@/features/reinforcement/components/reinforcement-page";
import { getReinforcementData } from "@/features/reinforcement/data/get-reinforcement-data";

export default async function Page() {
  const data = await getReinforcementData();
  return <ReinforcementPage data={data} />;
}
