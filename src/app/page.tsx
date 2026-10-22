import { requireUser } from "@/lib/auth/require-user";
import { ModuleSelector } from "@/features/module-selector/components/module-selector";

export default async function HomePage() {
  await requireUser();
  return <ModuleSelector />;
}
