import { AppShell } from "@/components/app-shell";
import { SubjectsPage } from "@/features/subjects/components/subjects-page";
import { getSubjectsPageData } from "@/features/subjects/data/get-subjects";

export default async function SubjectsRoute() {
  const data = await getSubjectsPageData();
  return <AppShell email={data.email} activeItem="materias"><SubjectsPage subjects={data.subjects} /></AppShell>;
}
