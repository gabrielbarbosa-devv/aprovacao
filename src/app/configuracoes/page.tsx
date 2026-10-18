import { SettingsPage } from "@/features/settings/components/settings-page";
import { getSettingsPageData } from "@/features/settings/data/get-settings-page-data";

export default async function Page() {
  const data = await getSettingsPageData();
  return <SettingsPage data={data} />;
}
